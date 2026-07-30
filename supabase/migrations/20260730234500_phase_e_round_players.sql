-- Phase E2: group-scorecard groundwork — who else was on the card.
--
-- WRITTEN, NOT APPLIED. No live database has this table.
--
-- This is groundwork, not a group feature. It builds the one thing a later
-- group scorecard cannot be retrofitted with — an ownership model — and stops
-- there. Nothing here shares data between accounts: no invitations, no
-- notifications, no real-time sync, no leaderboard, no second user's view.
--
-- ============================================================================
-- THE DECISION: a companion's card is a MARKER OWNED BY THE ROUND'S CREATOR,
-- not a row owned by the companion.
-- ============================================================================
--
-- A round today is `rounds(id, user_id)` bridged 1:1 to `activities(id, user_id)`
-- (`20260712193922_phase_a_activity_lifecycle.sql`): a round *is* an activity,
-- stored under the same UUID. A group round has several players' cards, so
-- there are exactly two places the second card can live.
--
-- **Rejected — a row owned by the companion.** "Dave's card is Dave's round."
-- It is the more principled-sounding answer and it breaks four contracts at
-- once:
--
--   1. *The single-active invariant.* `activities_one_current_per_user_idx` is
--      `unique (user_id) where state in ('active','paused')`. A round owned by
--      Dave needs an activity owned by Dave. If Dave is also keeping his own
--      card in his own app — the normal case, since that is why he is standing
--      there — my write and his round collide on that index. The invariant is
--      a Phase A contract (§ 1), so the group feature would have to weaken it
--      for everybody to accommodate a case that only exists here.
--   2. *RLS.* Every owner-scoped policy in this schema is `auth.uid() = user_id`.
--      For me to write Dave's card, either Dave's rows have to be writable by
--      someone who is not Dave — the exact thing least-privilege RLS exists to
--      prevent — or there has to be a grant mechanism. A grant mechanism is an
--      invitation, and invitations are explicitly out of scope.
--   3. *Soft deletion.* `activities.hidden_at` hides a round (§ 1). If Dave
--      owns his card, hiding my round leaves his half behind, and my delete
--      would have to reach into another account's data to clean up. Hide and
--      restore stop being one operation.
--   4. *Dave may not have an account at all.* Most people you play with do not
--      use this app. A model that requires one is a model that cannot record
--      the ordinary Saturday round.
--
-- **Chosen — a marker owned by me.** A companion row is *my private record of
-- who I played with and what I saw them shoot*. It is the same kind of fact as
-- `rounds.weather_summary`: my observation, in my account, about the round I
-- played. That makes every consequence fall out cleanly:
--
--   * *Single-active invariant:* untouched. This table creates **no**
--     `activities` rows. A group round is still one activity, because it is
--     still one round that one person played.
--   * *RLS:* the plain `auth.uid() = user_id` policy is sufficient AND
--     complete. There is no cross-account write to authorize, so there is no
--     hole to leave open. See the composite foreign key below, which makes
--     attaching a companion to somebody else's round structurally impossible
--     rather than merely denied.
--   * *Soft deletion:* a companion row hangs off `rounds`, which hangs off
--     `activities`. Hiding sets `activities.hidden_at`; the round and its
--     roster are hidden together because the roster is not independently
--     visible anywhere. It cannot be orphaned, because it is not an activity.
--     Account deletion needs no new code either: `user_id references
--     auth.users on delete cascade` is the same path `delete_own_account()`
--     already relies on (`20260729213112`).
--   * *Privacy:* `PRODUCT_ROADMAP.md` says community data is opt-in and that
--     private names never enter community aggregates. A companion's name is a
--     THIRD PARTY's name, recorded by someone else — the most sensitive shape
--     this data can take. Owning it as a private marker is what keeps it
--     private by construction: it is readable by exactly one account, it is
--     not joined to any shared table, and nothing aggregates it. There is no
--     opt-in to design because there is no sharing.
--
-- **The cost, stated honestly.** My card for Dave is not Dave's round, and it
-- never becomes one. If Dave later wants that round in his own account, that is
-- a *claim*, and a claim needs his consent. Note the direction: the future
-- `round_player_claims` table must be owned by the CLAIMANT — Dave asserts
-- "that row is me" — not by me asserting "that row is Dave". Inverting it is
-- what lets RLS enforce the consent instead of trusting the writer. That is
-- precisely why there is deliberately **no `player_user_id` column here**:
-- adding one now would ship the consent-free version of the link, and a table
-- where I can write another user's UUID beside a name is an unconsented
-- assertion about a person, whatever the read policy says.
--
-- ============================================================================
-- Ideal format (stated before the DDL, per the schema convention)
-- ============================================================================
--
--   id uuid primary key default gen_random_uuid() — server-assigned, because
--     the client resolves writes on the natural key below and must not send an
--     id at all. See the note on the column.
--   round_id uuid not null, user_id uuid not null, with a COMPOSITE foreign key
--     to `rounds (id, user_id)`. Not two separate FKs: the composite form is
--     what makes "my companion row on your round" unrepresentable rather than
--     merely refused, the same reasoning `rounds_activity_owner_fkey` used for
--     the activity bridge. It needs `rounds (id, user_id)` to be unique, which
--     is added below and is additive.
--   position smallint not null, CHECK 1..7, UNIQUE (round_id, position).
--     Position is the seat on the card, and it is the NATURAL KEY a write
--     resolves on — E2 audit finding 1 is the whole reason: `round_holes`
--     resolved on its surrogate id, so a replay whose local id had changed took
--     the INSERT branch, violated the natural key, and poisoned the outbox
--     forever. Upserting on `(round_id, position)` converges instead. Two
--     devices adding a different person to seat 3 offline resolve to one row,
--     which is the right outcome for a private single-owner note and, more to
--     the point, is an outcome rather than a permanent failure.
--     The 1..7 bound is the DB half of the app-side `ROUND_PLAYER_LIMIT`
--     interlock — capped in both places, per the AGENTS.md rule that a cap is
--     never enforced in only one layer. Seven companions is eight on a card,
--     past any real disc golf group; the owner is not in this table, because
--     the owner is the round.
--   display_name text not null, CHECK 1..60 characters after trimming. Free
--     text on purpose: "Dave", "Dad", "the guy from the pro shop". Not a
--     reference to anything, because a reference is an identity claim.
--   total_score integer null, CHECK >= 0.
--   created_at / updated_at timestamptz not null default now().
--
--   Indexes: `(round_id, position)` arrives with the unique constraint and is
--     the only access path — the roster is always read for one round. A
--     `user_id` index is added because account-wide reads (data export, a future
--     purge audit) filter on it and RLS evaluates it on every row.
--
-- **`total_score` is always a STATED number today**, and that is not a hedge —
-- there is no companion scorecard to derive one from. When per-hole companion
-- scoring lands (below) it must bring its own explicit provenance
-- discriminator, exactly as `rounds.scoring_mode` did for activity-only rounds
-- (`20260730212900`), and must NOT infer "stated" from the absence of hole
-- rows. Absence is ambiguous; that migration's header explains why at length.
--
-- ============================================================================
-- What is deliberately NOT built, and where the next feature picks up
-- ============================================================================
--
--   * **Per-hole companion scores.** The shape is decided so the later feature
--     is additive rather than a rewrite: a NEW table
--     `round_player_holes (id, round_player_id, user_id, hole_id, score, ...)`
--     with `unique (round_player_id, hole_id)`.
--     It is explicitly NOT a nullable `round_holes.round_player_id`, and the
--     reason matters. `round_holes` is read by `fetchRound`, `roundScoreSummary`,
--     `insights/coursePrep`, `insights/roundConditions`, `insights/roundVolume`
--     and the data export. Adding a player dimension to it would mean every one
--     of those needs `round_player_id is null` added, forever, and the first one
--     that forgets silently folds a companion's 6 into the owner's stroke
--     average. This repository has now fixed that exact shape twice — audit
--     finding 6 and F1, both "the guarantee lived in the consumer instead of the
--     data layer". A separate table cannot be forgotten. It also keeps
--     `round_holes.disc_id -> discs(id)` honest: a companion's throw was made
--     with a disc that is not in my locker, and recording it as if it were
--     would put another person's physical-disc identity in my collection.
--   * **Claiming / linking to a real account** (`round_player_claims`, owned by
--     the claimant, above). This is the entire social surface and it needs the
--     public identity, privacy, moderation and opt-in design that
--     `PRODUCT_ROADMAP.md` lists as the revisit trigger for the Social row.
--   * **Invitations, notifications, real-time sync, leaderboards, shared views.**
--     None of them, and none of them are made harder by this table.
--   * **Ranking.** `insights/groupScorecard.js` reports the card in seat order
--     and never sorts by score or names a winner. Head-to-head is
--     `FEATURE_BACKLOG.md`'s LATER (deliberate) row and stays there.
--   * **A per-companion notes column.** Rejected: it widens the private
--     third-party data surface with no groundwork value. A note about a person
--     is exactly the field that should require a deliberate decision.
--
-- ============================================================================
-- Deploy window
-- ============================================================================
--
-- The client reads this table before writing to it and treats a missing-table
-- answer as "not deployed yet": `PGRST205` / `42P01` are in `DEPLOY_LAG_CODES`
-- (`src/lib/instantLaunch/errorClassification.js`), which deliberately attaches
-- no HTTP status so they classify TRANSIENT. `roundPlayerRepository.js` uses
-- the same two codes to resolve `available: false`, and the panel then states
-- the feature is not available on this deployment instead of offering an editor
-- whose writes would queue forever. Nothing about an ordinary round changes:
-- a round with no companions writes nothing here and is byte-identical to
-- today's round on either side of this migration.
--
-- The data export (`dataExportRepository.js`) lists this table as
-- `optionalUntilDeployed`, so an export taken before this migration lands
-- succeeds with an empty `round_players` dataset and a manifest note, instead
-- of aborting E1's all-or-nothing read on a table that does not exist yet. Only
-- those two deploy-lag codes are tolerated; any other failure still aborts the
-- whole export.
--
-- ============================================================================
-- RLS and negative tests
-- ============================================================================
--
-- Policies are per-command rather than one `for all`, so each grant can be read
-- and revoked on its own. Full CRUD is granted, including DELETE, and that is a
-- considered exception to the "corrections preserve previous values" rule: a
-- roster entry is a private LABEL, not a sporting fact, so removing a mistyped
-- name destroys no evidence. When `round_player_holes` lands, those rows ARE
-- sporting facts and their delete policy has to be decided separately — a
-- cascade from here would silently take scores with the label.
--
-- **The negative tests are WRITTEN AND UNPROVEN.** They live in
-- `verify_round_players_rls.sql` at the repository root — deliberately not
-- under `supabase/migrations/`, where `db push` would execute them. They cannot
-- be run from this environment: it has no live database credentials and this
-- migration is unapplied. Nobody should describe this table's RLS as verified
-- until that file has been run against a real Postgres with two authenticated
-- roles and every listed expectation observed.
--
-- ============================================================================
-- Rollback
-- ============================================================================
--
--   begin;
--   revoke all on table public.round_players from authenticated, service_role;
--   drop table if exists public.round_players;
--   alter table public.rounds drop constraint if exists rounds_id_user_uniq;
--   commit;
--
-- Dropping the table discards every recorded companion; rounds, holes, totals,
-- weather, bag snapshots and activities are untouched by both the apply and the
-- rollback. Drop the unique constraint LAST — it is the composite FK's target.
-- Leaving it in place is also harmless if some future child table wants it.
-- Roll the client back first, or its companion writes fail with `PGRST205`,
-- which the client treats as deploy lag and retries, so nothing is lost but
-- those writes stay queued until one side moves.

begin;

-- The composite foreign key below needs `(id, user_id)` to be unique on the
-- parent. `rounds.id` is already the primary key, so this adds no new
-- uniqueness rule — only the index a composite reference is allowed to point
-- at. Guarded because `add constraint` has no `if not exists` form and this
-- migration must be safe to re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rounds_id_user_uniq'
      and conrelid = 'public.rounds'::regclass
  ) then
    alter table public.rounds add constraint rounds_id_user_uniq unique (id, user_id);
  end if;
end $$;

create table public.round_players (
  -- Defaulted, unlike `practice_experiment_markers.id`, and for a specific
  -- reason: the client upserts on `(round_id, position)` and deliberately does
  -- NOT send `id`, because PostgREST's merge-duplicates updates every column
  -- supplied and sending the id would rewrite the primary key the local Dexie
  -- mirror is indexed by. That is the fix E2 audit finding 1 applied to
  -- `round_holes`, applied here from the start instead of after the outage.
  -- Without a default, the insert half of that upsert has no id at all.
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  position smallint not null check (position between 1 and 7),
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  total_score integer check (total_score is null or total_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, position),
  -- Owner-consistent by construction: a companion row cannot name a round that
  -- belongs to a different account, because there is no such (round_id, user_id)
  -- pair to reference. Same shape as `rounds_activity_owner_fkey`.
  constraint round_players_round_owner_fkey
    foreign key (round_id, user_id)
    references public.rounds (id, user_id)
    on delete cascade
);

create index round_players_user_idx on public.round_players (user_id);

alter table public.round_players enable row level security;

create policy round_players_select_own
  on public.round_players
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy round_players_insert_own
  on public.round_players
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- `using` and `with check` are both present on purpose: without `with check` an
-- owner could update a row's `user_id` to another account and hand their own
-- private note to a stranger's account.
create policy round_players_update_own
  on public.round_players
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy round_players_delete_own
  on public.round_players
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.round_players from public, anon, authenticated;
grant select, insert, update, delete on table public.round_players to authenticated;
grant all on table public.round_players to service_role;

commit;
