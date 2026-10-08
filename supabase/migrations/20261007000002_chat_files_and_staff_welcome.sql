-- =========================================================================
-- 1. Chat attachments
--
--   chat-files   private storage bucket; files live at
--                <conversation id>/<random id>/<file name>. Only the two
--                people in that conversation can upload or read them.
--                Up to 10 MB; documents, spreadsheets, text and images.
--   conversation_messages gains attachment_* columns; a message needs text,
--                an attachment, or both.
--   start_conversation / send_chat_message take an optional attachment.
--                The file must already be uploaded by the sender into that
--                conversation's folder; it's checked here.
--
-- 2. Welcome message for new recruiters and coaches
--
--   staff_welcome()  when someone becomes a recruiter (an admin approved
--                    them) or a career coach, adds one Inbox message linking
--                    to their hub's Getting started page.
--
-- Needs 20261005000008 (notifications.actions) and 20261007000001 (chat).
-- =========================================================================

-- ---------------------------------------------------------------- bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files', 'chat-files', false, 10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- The folder (first path segment) is the conversation id.
CREATE OR REPLACE FUNCTION public.chat_folder_member(_folder TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = _folder AND auth.uid() IN (c.user_a, c.user_b)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.chat_folder_member(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_folder_member(TEXT) TO authenticated;

CREATE POLICY "Chat members upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND public.chat_folder_member((storage.foldername(name))[1]));

CREATE POLICY "Chat members read files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files' AND public.chat_folder_member((storage.foldername(name))[1]));

-- ---------------------------------------------------------------- messages
ALTER TABLE public.conversation_messages
  ADD COLUMN attachment_path TEXT,
  ADD COLUMN attachment_name TEXT CHECK (char_length(attachment_name) <= 255),
  ADD COLUMN attachment_size INTEGER CHECK (attachment_size BETWEEN 0 AND 10485760),
  ADD COLUMN attachment_type TEXT CHECK (char_length(attachment_type) <= 120);

ALTER TABLE public.conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_body_check;
ALTER TABLE public.conversation_messages
  ADD CONSTRAINT conversation_messages_body_check
  CHECK (char_length(body) <= 4000 AND (char_length(btrim(body)) > 0 OR attachment_path IS NOT NULL));

DROP FUNCTION IF EXISTS public.start_conversation(UUID, TEXT);
DROP FUNCTION IF EXISTS public.send_chat_message(UUID, TEXT);
DROP FUNCTION IF EXISTS public.chat_insert_message(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.chat_insert_message(
  _conv UUID, _body TEXT, _file_path TEXT DEFAULT NULL, _file_name TEXT DEFAULT NULL,
  _file_size INTEGER DEFAULT NULL, _file_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  msg UUID;
BEGIN
  _body := btrim(coalesce(_body, ''));
  IF char_length(_body) = 0 AND _file_path IS NULL THEN
    RAISE EXCEPTION 'Write a message or attach a file.' USING ERRCODE = '22023';
  END IF;
  IF char_length(_body) > 4000 THEN
    RAISE EXCEPTION 'Messages can be up to 4,000 characters.' USING ERRCODE = '22023';
  END IF;
  IF _file_path IS NOT NULL AND NOT (
    _file_path LIKE _conv::text || '/%'
    AND EXISTS (SELECT 1 FROM storage.objects o
                WHERE o.bucket_id = 'chat-files' AND o.name = _file_path
                  AND (o.owner = me OR o.owner_id = me::text))
  ) THEN
    RAISE EXCEPTION 'Attachment not found. Try attaching it again.' USING ERRCODE = '22023';
  END IF;
  -- Simple flood guard.
  IF (SELECT count(*) FROM conversation_messages
      WHERE sender_id = me AND created_at > now() - interval '1 minute') >= 30 THEN
    RAISE EXCEPTION 'You''re sending messages too quickly. Wait a minute and try again.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO conversation_messages (conversation_id, sender_id, body, attachment_path, attachment_name, attachment_size, attachment_type)
  VALUES (_conv, me, _body, _file_path,
          CASE WHEN _file_path IS NOT NULL THEN left(coalesce(nullif(btrim(_file_name), ''), 'file'), 255) END,
          CASE WHEN _file_path IS NOT NULL THEN _file_size END,
          CASE WHEN _file_path IS NOT NULL THEN left(_file_type, 120) END)
  RETURNING id INTO msg;
  UPDATE conversations SET
    last_message_at = now(),
    a_read_at = CASE WHEN user_a = me THEN now() ELSE a_read_at END,
    b_read_at = CASE WHEN user_b = me THEN now() ELSE b_read_at END
  WHERE id = _conv;
  RETURN msg;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.chat_insert_message(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;

-- A new conversation starts with text; files can follow once it exists
-- (they're stored in the conversation's folder).
CREATE OR REPLACE FUNCTION public.start_conversation(_other UUID, _body TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  conv UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO conv FROM conversations
  WHERE user_a = least(me, _other) AND user_b = greatest(me, _other);
  IF conv IS NULL THEN
    IF NOT public.chat_can_start(me, _other) THEN
      RAISE EXCEPTION 'You can''t start a conversation with this person.' USING ERRCODE = '42501';
    END IF;
    INSERT INTO conversations (user_a, user_b, started_by)
    VALUES (least(me, _other), greatest(me, _other), me)
    RETURNING id INTO conv;
  END IF;
  PERFORM public.chat_insert_message(conv, _body);
  RETURN conv;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_chat_message(
  _conversation UUID, _body TEXT, _file_path TEXT DEFAULT NULL, _file_name TEXT DEFAULT NULL,
  _file_size INTEGER DEFAULT NULL, _file_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversations
                 WHERE id = _conversation AND auth.uid() IN (user_a, user_b)) THEN
    RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = '42501';
  END IF;
  RETURN public.chat_insert_message(_conversation, _body, _file_path, _file_name, _file_size, _file_type);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;

-- Conversation list and notifications show "📎 file name" for file-only messages.
CREATE OR REPLACE FUNCTION public.my_conversations()
RETURNS TABLE (
  id UUID,
  other_id UUID,
  other_name TEXT,
  other_role TEXT,
  last_message TEXT,
  last_sender_is_me BOOLEAN,
  last_message_at TIMESTAMPTZ,
  unread INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id,
         o.other,
         public.chat_name(o.other),
         public.chat_role(o.other),
         left(coalesce(nullif(m.body, ''), '📎 ' || m.attachment_name), 160),
         m.sender_id = auth.uid(),
         c.last_message_at,
         (SELECT count(*)::int FROM conversation_messages x
          WHERE x.conversation_id = c.id AND x.sender_id <> auth.uid()
            AND x.created_at > coalesce(CASE WHEN c.user_a = auth.uid() THEN c.a_read_at ELSE c.b_read_at END, '-infinity'))
  FROM conversations c
  CROSS JOIN LATERAL (SELECT CASE WHEN c.user_a = auth.uid() THEN c.user_b ELSE c.user_a END AS other) o
  LEFT JOIN LATERAL (
    SELECT body, sender_id, attachment_name FROM conversation_messages
    WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
  ) m ON true
  WHERE auth.uid() IN (c.user_a, c.user_b)
  ORDER BY c.last_message_at DESC
$$;

CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c conversations%ROWTYPE;
  recipient UUID;
  hub TEXT;
  url TEXT;
BEGIN
  SELECT * INTO c FROM conversations WHERE id = NEW.conversation_id;
  recipient := CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END;
  hub := CASE public.chat_role(recipient)
    WHEN 'admin' THEN '/admin/chat'
    WHEN 'career_coach' THEN '/coach/chat'
    WHEN 'recruiter' THEN '/recruiter/chat'
    ELSE '/talent/chat' END;
  url := hub || '?c=' || c.id::text;
  IF NOT EXISTS (SELECT 1 FROM notifications
                 WHERE user_id = recipient AND kind = 'chat_message' AND read_at IS NULL AND link = url) THEN
    INSERT INTO notifications (user_id, kind, title, body, link)
    VALUES (recipient, 'chat_message', 'New message from ' || public.chat_name(NEW.sender_id),
            left(coalesce(nullif(NEW.body, ''), '📎 ' || NEW.attachment_name), 200), url);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------- welcome
CREATE OR REPLACE FUNCTION public.staff_welcome()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM notifications WHERE user_id = NEW.user_id AND kind = 'welcome_' || NEW.role::text) THEN
    RETURN NEW;
  END IF;
  IF NEW.role = 'recruiter' THEN
    INSERT INTO notifications (user_id, kind, title, body, link, actions)
    VALUES (
      NEW.user_id, 'welcome_recruiter', 'Welcome to Savant',
      'Your recruiter account is ready. Getting started walks you through posting jobs, finding talent, requesting résumés, scheduling interviews and collecting documents.',
      '/recruiter/welcome',
      jsonb_build_array(
        jsonb_build_object('label', 'Getting started', 'to', '/recruiter/welcome'),
        jsonb_build_object('label', 'Post a job', 'to', '/recruiter/jobs'),
        jsonb_build_object('label', 'Find talent', 'to', '/recruiter/talent')
      )
    );
  ELSIF NEW.role = 'career_coach' THEN
    INSERT INTO notifications (user_id, kind, title, body, link, actions)
    VALUES (
      NEW.user_id, 'welcome_career_coach', 'Welcome to Savant',
      'Your coach account is ready. Getting started walks you through service requests, finding talent to coach, scheduling sessions, résumés and sending jobs.',
      '/coach/welcome',
      jsonb_build_array(
        jsonb_build_object('label', 'Getting started', 'to', '/coach/welcome'),
        jsonb_build_object('label', 'Service requests', 'to', '/coach'),
        jsonb_build_object('label', 'Find talent', 'to', '/coach/talent')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.staff_welcome() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER staff_welcome
  AFTER INSERT ON public.user_roles
  FOR EACH ROW WHEN (NEW.role IN ('recruiter', 'career_coach'))
  EXECUTE FUNCTION public.staff_welcome();
