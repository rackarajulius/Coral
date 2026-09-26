-- Company verification for employers.
--
-- The Verification model already carries everything needed — document, note,
-- reviewer, outcome — but its type enum only covered job-seeker evidence.
-- Without a COMPANY type, an employer on a personal email address could
-- complete onboarding and then be unable to post a job at all, with no route
-- through: a dead end for legitimate small businesses.
ALTER TYPE "VerificationType" ADD VALUE IF NOT EXISTS 'COMPANY';
