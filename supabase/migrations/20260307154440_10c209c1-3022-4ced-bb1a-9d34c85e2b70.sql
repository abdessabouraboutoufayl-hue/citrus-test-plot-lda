
-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type varchar DEFAULT 'info',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "notifications_read_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Allow insert from triggers (service role / security definer)
CREATE POLICY "notifications_insert_system" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Function to notify admins when a new user signs up
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Insert a notification for each responsable_central
  FOR admin_record IN
    SELECT user_id FROM public.user_roles WHERE role = 'responsable_central'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      admin_record.user_id,
      'Nouveau compte créé',
      'Un nouvel utilisateur (' || COALESCE(NEW.email, 'email inconnu') || ') vient de créer un compte et attend l''attribution de droits d''accès.',
      'new_user',
      jsonb_build_object('new_user_id', NEW.id, 'new_user_email', NEW.email)
    );
  END LOOP;
  RETURN NEW;
END;
$$;

-- Trigger on profiles insert
CREATE TRIGGER on_new_user_notify_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_new_user();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
