-- "Maybe" is how interviewers actually score a borderline candidate, and the
-- existing UI already offered it. Omitting it would have forced a real opinion
-- into a yes or a no.
--
-- It counts as NOT advancing in the fairness analysis, which only treats
-- STRONG_YES and YES as selection events — so adverse-impact ratios stay
-- correct without any change there.
ALTER TYPE "ScorecardRecommendation" ADD VALUE IF NOT EXISTS 'MAYBE' AFTER 'YES';
