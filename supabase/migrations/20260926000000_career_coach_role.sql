-- Fifth user type: Career Coach. Kept in its own migration because a new
-- enum value can't be referenced in the same transaction that adds it, and
-- the next migration's policies reference it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'career_coach';
