-- disc_molds enrichment (Track 1B follow-on): free-text description + the
-- source URL the catalog data was captured from.
--
-- Append-only follow-on to disc_locker_and_layouts_schema.sql. Additive,
-- nullable, idempotent — safe to run anytime, no backup needed. Added to
-- accommodate scraped manufacturer catalog data (e.g. Innova disc pages),
-- which carry a prose description we want to keep alongside flight numbers.

alter table disc_molds
  add column if not exists description text,
  add column if not exists source_url text;
