-- =========================================================================
-- Chat: one-to-one conversations between accounts, limited to the right
-- relationships. Enforced here, so the browser can't get around it.
--
--   Who may START a conversation (chat_can_start):
--     admin     -> anyone
--     coach     -> any talent
--     recruiter -> talent visible to recruiters, or assigned to them
--     talent    -> any career coach
--   Talent can never start one with a recruiter; they reply once the
--   recruiter has written first. Once a conversation exists, both people
--   can write in it.
--
--   conversations           one row per pair (user_a < user_b)
--   conversation_messages   the messages; readable by the two people only
--   start_conversation()    opens (or reuses) a conversation with a first message
--   send_chat_message()     replies in an existing conversation
--   my_conversations()      the caller's conversations, newest first, with
--                           the other person's name, role and unread count
--   chat_contacts()         people the caller may start a conversation with
--   mark_conversation_read()
--
-- New messages notify the recipient in their Inbox (one unread
-- notification per conversation at a time, not one per message).
-- =========================================================================

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  a_read_at TIMESTAMPTZ,
  b_read_at TIMESTAMPTZ,
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
CREATE INDEX conversations_a_idx ON public.conversations (user_a, last_message_at DESC);
CREATE INDEX conversations_b_idx ON public.conversations (user_b, last_message_at DESC);

CREATE TABLE public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX conversation_messages_conv_idx ON public.conversation_messages (conversation_id, created_at);

-- Read access only; all writes go through the functions below.
GRANT SELECT ON public.conversations, public.conversation_messages TO authenticated;
GRANT ALL ON public.conversations, public.conversation_messages TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read their conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (auth.uid() IN (user_a, user_b));

CREATE POLICY "Participants read their messages" ON public.conversation_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)
  ));

-- Live updates in the Chat page (row-level security still applies).
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;

-- -------------------------------------------------------------------------
-- Names and roles shown in chat. Never falls back to an email address.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_role(_uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_uid, 'admin') THEN 'admin'
    WHEN public.has_role(_uid, 'career_coach') THEN 'career_coach'
    WHEN public.has_role(_uid, 'recruiter') THEN 'recruiter'
    WHEN public.has_role(_uid, 'talent') THEN 'talent'
  END
$$;
REVOKE EXECUTE ON FUNCTION public.chat_role(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_name(_uid UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coalesce(
    nullif(trim(coalesce(tp.first_name, '') || ' ' || coalesce(tp.last_name, '')), ''),
    nullif(btrim(p.username), ''),
    CASE public.chat_role(_uid)
      WHEN 'admin' THEN 'Savant team'
      WHEN 'career_coach' THEN 'Career coach'
      WHEN 'recruiter' THEN 'Recruiter'
      ELSE 'Savant member' END
  )
  FROM public.profiles p LEFT JOIN public.talent_profiles tp ON tp.user_id = p.id
  WHERE p.id = _uid
$$;
REVOKE EXECUTE ON FUNCTION public.chat_name(UUID) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------------------
-- Who may start a conversation with whom
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_can_start(_from UUID, _to UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _from IS NOT NULL AND _to IS NOT NULL AND _from <> _to AND (
    public.has_role(_from, 'admin')
    OR (public.has_role(_from, 'career_coach') AND public.has_role(_to, 'talent'))
    OR (public.has_role(_from, 'recruiter') AND public.has_role(_to, 'talent') AND (
          EXISTS (SELECT 1 FROM public.talent_profiles tp WHERE tp.user_id = _to AND tp.visible_to_recruiters)
          OR public.is_assigned(_from, _to)))
    OR (public.has_role(_from, 'talent') AND public.has_role(_to, 'career_coach'))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.chat_can_start(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- -------------------------------------------------------------------------
-- Writing
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_insert_message(_conv UUID, _body TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me UUID := auth.uid();
  msg UUID;
BEGIN
  _body := btrim(coalesce(_body, ''));
  IF char_length(_body) = 0 THEN
    RAISE EXCEPTION 'Write a message first.' USING ERRCODE = '22023';
  END IF;
  IF char_length(_body) > 4000 THEN
    RAISE EXCEPTION 'Messages can be up to 4,000 characters.' USING ERRCODE = '22023';
  END IF;
  -- Simple flood guard.
  IF (SELECT count(*) FROM conversation_messages
      WHERE sender_id = me AND created_at > now() - interval '1 minute') >= 30 THEN
    RAISE EXCEPTION 'You''re sending messages too quickly. Wait a minute and try again.' USING ERRCODE = '54000';
  END IF;
  INSERT INTO conversation_messages (conversation_id, sender_id, body)
  VALUES (_conv, me, _body)
  RETURNING id INTO msg;
  UPDATE conversations SET
    last_message_at = now(),
    a_read_at = CASE WHEN user_a = me THEN now() ELSE a_read_at END,
    b_read_at = CASE WHEN user_b = me THEN now() ELSE b_read_at END
  WHERE id = _conv;
  RETURN msg;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.chat_insert_message(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Opens a conversation with someone (or reuses the existing one) and sends
-- the first message. Returns the conversation id.
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

-- Replies in an existing conversation.
CREATE OR REPLACE FUNCTION public.send_chat_message(_conversation UUID, _body TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM conversations
                 WHERE id = _conversation AND auth.uid() IN (user_a, user_b)) THEN
    RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = '42501';
  END IF;
  RETURN public.chat_insert_message(_conversation, _body);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE conversations SET
    a_read_at = CASE WHEN user_a = auth.uid() THEN now() ELSE a_read_at END,
    b_read_at = CASE WHEN user_b = auth.uid() THEN now() ELSE b_read_at END
  WHERE id = _conversation AND auth.uid() IN (user_a, user_b);
  -- Clear this conversation's chat notification too.
  UPDATE notifications SET read_at = now()
  WHERE user_id = auth.uid() AND kind = 'chat_message' AND read_at IS NULL
    AND link LIKE '%c=' || _conversation::text;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID) TO authenticated;

-- -------------------------------------------------------------------------
-- Reading
-- -------------------------------------------------------------------------
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
         left(m.body, 160),
         m.sender_id = auth.uid(),
         c.last_message_at,
         (SELECT count(*)::int FROM conversation_messages x
          WHERE x.conversation_id = c.id AND x.sender_id <> auth.uid()
            AND x.created_at > coalesce(CASE WHEN c.user_a = auth.uid() THEN c.a_read_at ELSE c.b_read_at END, '-infinity'))
  FROM conversations c
  CROSS JOIN LATERAL (SELECT CASE WHEN c.user_a = auth.uid() THEN c.user_b ELSE c.user_a END AS other) o
  LEFT JOIN LATERAL (
    SELECT body, sender_id FROM conversation_messages
    WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
  ) m ON true
  WHERE auth.uid() IN (c.user_a, c.user_b)
  ORDER BY c.last_message_at DESC
$$;
REVOKE EXECUTE ON FUNCTION public.my_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_conversations() TO authenticated;

-- People the caller may start a conversation with, optionally searched by
-- name. Shows names, role and a short detail only.
CREATE OR REPLACE FUNCTION public.chat_contacts(_q TEXT DEFAULT NULL)
RETURNS TABLE (id UUID, name TEXT, role TEXT, detail TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM (
    SELECT p.id,
           public.chat_name(p.id) AS name,
           public.chat_role(p.id) AS role,
           nullif(coalesce(tp.current_title, tp.headline, ''), '') AS detail
    FROM profiles p
    LEFT JOIN talent_profiles tp ON tp.user_id = p.id
    WHERE p.id <> auth.uid() AND public.chat_can_start(auth.uid(), p.id)
  ) t
  WHERE _q IS NULL OR btrim(_q) = '' OR t.name ILIKE '%' || btrim(_q) || '%' OR t.detail ILIKE '%' || btrim(_q) || '%'
  ORDER BY t.name
  LIMIT 50
$$;
REVOKE EXECUTE ON FUNCTION public.chat_contacts(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_contacts(TEXT) TO authenticated;

-- -------------------------------------------------------------------------
-- Inbox notification for the recipient: one unread per conversation.
-- -------------------------------------------------------------------------
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
    VALUES (recipient, 'chat_message', 'New message from ' || public.chat_name(NEW.sender_id), left(NEW.body, 200), url);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_chat_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER notify_chat_message
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message();
