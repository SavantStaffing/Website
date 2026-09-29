-- Employer Ratings are for signed-in users (any role), not guests.
-- Guests see a sign-up prompt on /employer-ratings; this locks the data too.
REVOKE EXECUTE ON FUNCTION public.employer_rating_inputs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.employer_rating_inputs() TO authenticated;
