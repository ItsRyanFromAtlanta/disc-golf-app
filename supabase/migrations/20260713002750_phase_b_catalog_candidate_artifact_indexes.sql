--
-- Phase B B1.7 follow-on advisor indexes.
--
-- These indexes cover the composite artifact-to-batch foreign key and the
-- optional reviewer-user foreign key. They are additive and do not alter the
-- candidate/artifact data contract.

begin;

create index catalog_import_artifacts_batch_checksum_idx
  on public.catalog_import_artifacts (import_batch_id, source_checksum);

create index catalog_import_candidate_reviews_reviewer_user_idx
  on public.catalog_import_candidate_reviews (reviewer_user_id)
  where reviewer_user_id is not null;

commit;
