-- Phase B B1.5 advisor follow-up: cover the exact column order of the three
-- composite foreign keys introduced by the applied catalog foundation.
-- Append-only; the applied foundation migration remains unchanged.

begin;

create index disc_mold_plastics_mold_manufacturer_idx
  on public.disc_mold_plastics (mold_id, manufacturer_id);

create index disc_mold_plastics_plastic_manufacturer_idx
  on public.disc_mold_plastics (plastic_id, manufacturer_id);

create index catalog_submission_evidence_submission_owner_idx
  on public.catalog_submission_evidence (submission_id, user_id);

commit;
