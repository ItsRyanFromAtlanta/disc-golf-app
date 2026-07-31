-- Phase E — atomic onboarding provisioning (defect register `D-04`).
--
-- **NOT APPLIED.** Written, reviewed, and deliberately left unapplied; the client degrades to a
-- documented fallback while this is absent (see "Degradation" below). Apply with the other Phase E
-- migrations when an owner is at a console.
--
-- ORDERING: independent of every other Phase E migration. It defines one function and touches no
-- object any of them define. It depends only on the `bags` / `discs` / `bag_discs` shapes from
-- `bags_schema.sql` + `disc_locker_and_layouts_schema.sql`, on the partial unique index
-- `bags_one_default_per_user` (`bags_schema.sql:27-28`), on `bag_discs`'s `unique (bag_id, disc_id)`,
-- and on the `enforce_bag_capacity()` trigger in `layer1_foundation_schema.sql:230-253`, which still
-- fires for the membership insert below and is meant to.
--
-- Why: `PutterStep.provision()` wrote a bag, then a disc, then the membership as three sequential
-- unguarded PostgREST calls (four, counting the `capture_bag_version` RPC that `addDiscToBag` makes
-- afterwards). Nothing tied them together, and the *first* of the four is the one that must not
-- survive alone. `bags_one_default_per_user` is a partial unique index over `(user_id) where
-- is_default`, so once the bag row lands, every retry of the whole sequence collides with it and the
-- wizard renders the raw unique-violation string. There is no path forward in place.
--
-- The bag surviving alone is also worse than it looks, because that bag row is the *only* record
-- that a user was ever onboarded: `needsOnboarding(bags)` is `bags.length === 0`
-- (`src/lib/onboarding.js`). A partial failure therefore leaves an account that the gate considers
-- fully onboarded, holding an empty bag and no putter, with the wizard no longer reachable to fix
-- it. Atomicity is what keeps that signal honest — if the putter did not land, neither did the bag,
-- and the gate correctly runs the wizard again on next launch.
--
-- Compensating deletes are the obvious alternative and the wrong one, for the reason E2 audit
-- finding 3 already recorded for `create_course_with_layout`: a compensating delete runs on the same
-- connection that just failed, for the same reason it failed. One function body is one transaction
-- in Postgres — an exception anywhere inside it rolls back every row the call inserted — so a single
-- RPC is the whole fix.
--
-- `security invoker`, deliberately, not `security definer`. Every row written here is owner-scoped
-- user data, so the caller's own RLS must still apply: `bags` and `discs` are both governed by
-- `auth.uid() = user_id` policies and `bag_discs` by ownership derived through `bag_id`. A definer
-- function would bypass all three. `auth.uid()` is read explicitly and used as `user_id`, and the
-- function takes no owner argument, so it cannot be told to provision into someone else's account.
--
-- Contract:
--   provision_practice_stack(
--     p_bag_id   uuid            -- client-generated, for idempotent replay
--     p_bag_name text  = 'Practice Stack'
--     p_disc_id  uuid  = null    -- client-generated; null means "skip setup", bag only
--     p_disc     jsonb = null    -- disc fields, snake_case; null means "skip setup", bag only
--   ) returns jsonb              -- { "bag_id": uuid, "disc_id": uuid|null }
--
-- `p_disc` may carry `mold_id`, `manufacturer`, `mold`, `weight_grams`, `role`, `status` — the keys
-- `buildPutterDiscFields` produces. Unknown keys are ignored so the client's shape can grow without
-- a signature change. `mold` is the one required field (`discs.mold` is `not null`).
--
-- Idempotent replay. Every step converges rather than colliding, so the call is safe to repeat
-- with the same arguments after any failure — including a failure that happened after the server
-- committed but before the client heard about it:
--   * the bag resolves to the caller's existing default bag if there is one, and is only inserted
--     when there is not. This is also what makes re-entering `/onboarding` after completing it work
--     (`screens/onboarding.md` § 12 q3) instead of dying on the unique index;
--   * the disc is an `on conflict (id) do update`, so a replay re-applies the same values rather
--     than minting a second physical disc;
--   * the membership is an `on conflict (bag_id, disc_id) do nothing`.
-- The client supplies both ids from mount-stable state, which is what makes that convergence
-- reachable — the same reason `createRepository.useCreate` holds a mount-stable `clientId`.
--
-- Deliberately NOT included: the `capture_bag_version` snapshot that `addDiscToBag` takes. It is a
-- second RPC and a history nicety, not part of the provisioning invariant; folding it in here would
-- couple this function to `bag_versions` and make a snapshot failure roll back the putter. The
-- client takes it afterwards, non-fatally.
--
-- Degradation while this is unapplied: PostgREST answers an absent function with 404 / `PGRST202`
-- (`42883` from Postgres directly), both already in `DEPLOY_LAG_CODES`
-- (`src/lib/instantLaunch/errorClassification.js`). `provisionPracticeStack` treats exactly those as
-- "not deployed" and falls back to the sequential client path — which is now itself idempotent, so
-- retry-after-partial-failure converges even without this function. What the fallback cannot give is
-- atomicity: a partial failure there still leaves the bag behind, and the onboarding gate still
-- reads that bag as "onboarded". That is the gap this migration closes, and the reason to apply it.
--
-- Rollback:
--   drop function if exists public.provision_practice_stack(uuid, text, uuid, jsonb);
-- The migration creates no tables, columns, constraints, indexes or policies and rewrites no rows,
-- so dropping the function restores the database exactly. Bags and discs created through it are
-- ordinary rows, indistinguishable from ones the sequential client wrote. No client rollback is
-- needed: a build that calls the function degrades to the fallback the moment it disappears, which
-- is the same path it takes today.

begin;

create or replace function public.provision_practice_stack(
  p_bag_id uuid,
  p_bag_name text default 'Practice Stack',
  p_disc_id uuid default null,
  p_disc jsonb default null
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  owner_id uuid := (select auth.uid());
  bag_label text := coalesce(nullif(btrim(p_bag_name), ''), 'Practice Stack');
  resolved_bag_id uuid;
  resolved_disc_id uuid;
begin
  if owner_id is null then
    raise exception 'You must be signed in to set up a bag' using errcode = '28000';
  end if;
  if p_bag_id is null then
    raise exception 'A bag id is required' using errcode = '22023';
  end if;
  if p_disc is not null and jsonb_typeof(p_disc) <> 'object' then
    raise exception 'Disc fields must be supplied as a JSON object' using errcode = '22023';
  end if;

  -- Converge on the existing default rather than colliding with
  -- `bags_one_default_per_user`. Scoped to `owner_id` as well as `is_default`
  -- so this can never resolve to another account's bag even if the caller
  -- supplies an id that belongs to one.
  select id into resolved_bag_id
  from public.bags
  where user_id = owner_id and is_default
  limit 1;

  if resolved_bag_id is null then
    insert into public.bags (id, user_id, name, is_default)
    values (p_bag_id, owner_id, bag_label, true)
    returning id into resolved_bag_id;
  end if;

  -- "Skip setup" provisions the bag and nothing else: the bag's existence is
  -- the onboarding signal, but no disc is invented on the user's behalf.
  if p_disc is null or p_disc_id is null then
    return jsonb_build_object('bag_id', resolved_bag_id, 'disc_id', null);
  end if;

  if nullif(btrim(p_disc ->> 'mold'), '') is null then
    raise exception 'A disc needs a mold name' using errcode = '22023';
  end if;

  insert into public.discs (id, user_id, mold_id, manufacturer, mold, weight_grams, role, status)
  values (
    p_disc_id,
    owner_id,
    nullif(p_disc ->> 'mold_id', '')::uuid,
    nullif(p_disc ->> 'manufacturer', ''),
    btrim(p_disc ->> 'mold'),
    nullif(p_disc ->> 'weight_grams', '')::numeric,
    coalesce(nullif(p_disc ->> 'role', ''), 'primary_putter'),
    coalesce(nullif(p_disc ->> 'status', ''), 'in_locker')
  )
  on conflict (id) do update set
    mold_id = excluded.mold_id,
    manufacturer = excluded.manufacturer,
    mold = excluded.mold,
    weight_grams = excluded.weight_grams,
    role = excluded.role,
    status = excluded.status
  -- Bounds the replay: `on conflict do update` on a primary key would happily
  -- overwrite a row that belongs to someone else if an id ever collided.
  where public.discs.user_id = owner_id
  returning id into resolved_disc_id;

  if resolved_disc_id is null then
    raise exception 'That disc id already belongs to another account' using errcode = '42501';
  end if;

  insert into public.bag_discs (bag_id, disc_id)
  values (resolved_bag_id, resolved_disc_id)
  on conflict (bag_id, disc_id) do nothing;

  return jsonb_build_object('bag_id', resolved_bag_id, 'disc_id', resolved_disc_id);
end;
$$;

comment on function public.provision_practice_stack(uuid, text, uuid, jsonb) is
  'Creates the onboarding Practice Stack bag, the primary putter and its bag membership in one '
  'transaction, attributed to auth.uid(). security invoker, so the caller''s RLS on bags/discs/'
  'bag_discs still applies. Returns {bag_id, disc_id}; re-calling with the same ids converges '
  'instead of colliding with bags_one_default_per_user. Replaces the three sequential client '
  'writes whose partial failure left a default bag that blocked every retry and made the '
  'onboarding gate report a never-provisioned account as onboarded (defect register D-04).';

-- Least privilege, restated absolutely rather than additively so a replay
-- against a rebuilt database lands the same grants. Owner-scoped user data, so
-- anon has no business here even though the function derives its owner from the
-- JWT and would raise 28000 for an anonymous caller anyway.
revoke all on function public.provision_practice_stack(uuid, text, uuid, jsonb) from public;
revoke all on function public.provision_practice_stack(uuid, text, uuid, jsonb) from anon;
grant execute on function public.provision_practice_stack(uuid, text, uuid, jsonb) to authenticated;

commit;
