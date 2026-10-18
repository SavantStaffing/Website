-- =========================================================================
-- Restore function privileges after the move to savantalent-prod.
--
--   Loading the Lovable Cloud export into a fresh Supabase project left
--   Supabase's default grants (EXECUTE for anon and authenticated) on every
--   function, because the dump's ACLs don't revoke privileges the source
--   never had. This replays every REVOKE/GRANT on functions from the
--   earlier migrations, in order, so later grants still win. Statements for
--   functions whose signature has since changed are skipped.
-- =========================================================================

-- 20260910000000_init_auth_and_jobs.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260910000000_init_auth_and_jobs.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.own_organization_id(uuid) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260910000000_init_auth_and_jobs.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260910000000_init_auth_and_jobs.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260924000000_job_scout_and_role_features.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fill_job_company_name() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260924000000_job_scout_and_role_features.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260924000000_job_scout_and_role_features.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_application_request() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260924000000_job_scout_and_role_features.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.own_org_permission(uuid) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260924000000_job_scout_and_role_features.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_org_permission(uuid, text) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260924000000_job_scout_and_role_features.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_org_permission(uuid, text) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260926000001_preparation_services.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260926000001_preparation_services.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.guard_service_request_update() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260926000001_preparation_services.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_service_request() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260927000001_coach_invites.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.coach_invite_status(TEXT) FROM PUBLIC;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260927000001_coach_invites.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.coach_invite_status(TEXT) TO anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260927000001_coach_invites.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000000_employer_ethics.sql
DO $$ BEGIN EXECUTE 'REVOKE ALL ON public.scout_secrets FROM anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000001_admin_scout_diagnostics.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admin_scout_diagnostics(INTEGER) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000001_admin_scout_diagnostics.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.admin_scout_diagnostics(INTEGER) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000002_inbox_schedule_admin_alerts.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.display_name(UUID) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000002_inbox_schedule_admin_alerts.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_service_request_schedule() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000002_inbox_schedule_admin_alerts.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_interview_scheduled() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000002_inbox_schedule_admin_alerts.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_admins(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000002_inbox_schedule_admin_alerts.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.admin_alert_form() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000003_employer_ratings.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.employer_rating_inputs() FROM PUBLIC;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000003_employer_ratings.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.employer_rating_inputs() TO anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000006_job_search_apis.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.record_scout_api_request(TEXT) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000006_job_search_apis.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.record_scout_api_request(TEXT) TO service_role;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000007_employer_ratings_members_only.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.employer_rating_inputs() FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20260928000007_employer_ratings_members_only.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.employer_rating_inputs() TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_service_request() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.talent_assignment_guard() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_talent_assignment() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_assigned(UUID, UUID) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_assigned(UUID, UUID) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.is_assigned_folder(UUID, TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_assigned_folder(UUID, TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.coach_talent_directory() FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261002000000_talent_assignments.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.coach_talent_directory() TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000000_external_applications.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.set_application_archived(UUID, BOOLEAN) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000000_external_applications.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.set_application_archived(UUID, BOOLEAN) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000000_external_applications.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_application_completed(UUID) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000000_external_applications.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_application_completed(UUID) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000004_fair_chance.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.fair_chance_reflag_jobs() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000005_where_you_work_matters.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.employer_listing_counts() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000005_where_you_work_matters.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.employer_listing_counts() TO service_role;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000005_where_you_work_matters.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.employer_rating_inputs() FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000005_where_you_work_matters.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.employer_rating_inputs() TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000006_shared_jobs.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.share_job_recipients(UUID) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000006_shared_jobs.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.share_job_recipients(UUID) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000006_shared_jobs.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.share_job(UUID, UUID[], TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000006_shared_jobs.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.share_job(UUID, UUID[], TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000007_recruiter_approval.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000007_recruiter_approval.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.decide_recruiter_request(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000007_recruiter_approval.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.decide_recruiter_request(UUID, BOOLEAN, TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261005000008_talent_welcome.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.talent_welcome() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_role(UUID) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_name(UUID) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_can_start(UUID, UUID) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_insert_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.my_conversations() FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.my_conversations() TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_contacts(TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.chat_contacts(TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000001_chat.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_folder_member(TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.chat_folder_member(TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_insert_message(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261007000002_chat_files_and_staff_welcome.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.staff_welcome() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.help_assistant_use() FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.help_assistant_use() TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rotate_calendar_feed() FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.rotate_calendar_feed() TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.calendar_events_for(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.calendar_events_for(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.my_calendar(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.my_calendar(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.staff_intro_insert(UUID, public.app_role) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261012000001_help_calendar_staff_intro.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.staff_intro() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261014000001_talent_intake.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.notify_talent_intake() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261015000001_account_names.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.username_taken(TEXT, UUID) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261015000001_account_names.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.free_username(TEXT, UUID) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261015000001_account_names.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.username_available(TEXT) FROM PUBLIC;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261015000001_account_names.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.username_available(TEXT) TO anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261015000001_account_names.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261015000001_account_names.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.chat_name(UUID) FROM PUBLIC, anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261017000001_password_status.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.email_needs_password(TEXT) FROM PUBLIC;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261017000001_password_status.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.email_needs_password(TEXT) TO anon, authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261017000001_password_status.sql
DO $$ BEGIN EXECUTE 'REVOKE EXECUTE ON FUNCTION public.my_has_password() FROM PUBLIC, anon;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
-- 20261017000001_password_status.sql
DO $$ BEGIN EXECUTE 'GRANT EXECUTE ON FUNCTION public.my_has_password() TO authenticated;'; EXCEPTION WHEN undefined_function OR undefined_object THEN NULL; END $$;
