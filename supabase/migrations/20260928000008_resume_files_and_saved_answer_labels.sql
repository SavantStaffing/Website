-- =========================================================================
-- Autofill: resume files, and readable saved answers.
--
--   resumes (storage bucket, private)  one file per talent at
--                                      {user_id}/{filename}; PDF or Word, 5 MB.
--                                      Talent read and write only their own
--                                      folder; Autofill hands the extension a
--                                      short-lived signed URL (service role).
--   talent_profiles.resume_*           which file is current.
--   saved_answers.question_label       the question as the form asked it, for
--                                      the talent's Saved answers page
--                                      (question_key stays the matching key).
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes', 'resumes', false, 5242880,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Talent read own resume" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Talent upload own resume" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.has_role(auth.uid(), 'talent')
  );
CREATE POLICY "Talent replace own resume" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Talent delete own resume" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

ALTER TABLE public.talent_profiles
  ADD COLUMN resume_path TEXT,
  ADD COLUMN resume_filename TEXT CHECK (char_length(resume_filename) <= 200),
  ADD COLUMN resume_uploaded_at TIMESTAMPTZ;

ALTER TABLE public.saved_answers
  ADD COLUMN question_label TEXT CHECK (char_length(question_label) <= 500);
