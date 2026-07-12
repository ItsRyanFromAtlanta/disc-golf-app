-- Phase B B1.5 final advisor follow-up: cover the composite optional link from
-- a private configuration to its owner-consistent public submission.

create index user_disc_configurations_submission_owner_idx
  on public.user_disc_configurations (submitted_as_id, user_id)
  where submitted_as_id is not null;
