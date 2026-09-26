-- Public contact details for an employer.
--
-- The settings "Contact information" card asked for a support email and phone
-- number and had nowhere to put them: every other field on that form maps to a
-- column, so those two silently discarded whatever was typed. LinkedIn and
-- Twitter already had a home in social_links.
--
-- Deliberately separate from the account email on `users`: the address a
-- candidate should write to is rarely the recruiter's login, and conflating
-- them would publish a personal address on the company profile.
ALTER TABLE "employer_profiles"
  ADD COLUMN IF NOT EXISTS "support_email" TEXT,
  ADD COLUMN IF NOT EXISTS "support_phone" TEXT;
