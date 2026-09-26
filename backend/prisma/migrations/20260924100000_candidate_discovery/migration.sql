-- Candidate discovery widens from "opted in" to "everyone, with an opt-out".
--
-- Until now sourcing required `open_to_work = true`, so genuinely passive
-- candidates never appeared. One flag was doing two jobs: "I am job hunting"
-- and "recruiters may find me". They are now separate — `open_to_work` stays
-- as the badge and a ranking signal, and this decides discovery.
--
-- Default TRUE by product decision. Being found is therefore not evidence that
-- anyone agreed to it, which is why the setting stays easy to find, contact
-- details are still never exposed, and a profile the person hid
-- (privacy_settings -> profileVisible = false) is excluded whatever this says.
--
-- No index: it is true for nearly every row, so it would never be chosen.
ALTER TABLE "job_seeker_profiles"
    ADD COLUMN "discoverable" BOOLEAN NOT NULL DEFAULT true;
