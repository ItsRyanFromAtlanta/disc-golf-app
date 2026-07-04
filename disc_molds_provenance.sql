-- disc_molds provenance (Track 1B follow-on): who / where / when catalog data
-- was captured from. `source_url` was already added in disc_molds_enrichment.sql;
-- this adds the human-readable source name and the capture timestamp. Additive,
-- nullable, idempotent — safe to run anytime, no backup needed.
--
-- SEEDING CONVENTION (see CLAUDE.md "Seeding disc catalog data"): every seeded
-- mold should record its provenance —
--   * source_name  — e.g. 'Innova', 'MVP', 'Axiom', 'Streamline'
--   * source_url    — the specific manufacturer page the data came from
--   * scraped_at    — when it was captured
--   * image_url     — the manufacturer's own image URL, REFERENCED for
--                     attribution/display only. Never download or re-host the
--                     image file; store the URL.

alter table disc_molds
  add column if not exists source_name text,
  add column if not exists scraped_at timestamptz;
