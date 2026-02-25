
-- Storage bucket for requirement files
INSERT INTO storage.buckets (id, name, public) VALUES ('requirement-files', 'requirement-files', false);

CREATE POLICY "Authenticated users can view files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'requirement-files');
CREATE POLICY "Admins can upload files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'requirement-files' AND public.has_role(auth.uid(), 'coe_admin'::app_role));
CREATE POLICY "Admins can delete files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'requirement-files' AND public.has_role(auth.uid(), 'coe_admin'::app_role));

-- Notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'::app_role));

-- Requirement file attachments tracking table
CREATE TABLE public.requirement_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.requirement_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view files" ON public.requirement_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert files" ON public.requirement_files FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'::app_role));
CREATE POLICY "Admins can delete files" ON public.requirement_files FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'::app_role));

-- Version history table for requirement edits
CREATE TABLE public.requirement_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  changed_by UUID,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.requirement_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view versions" ON public.requirement_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert versions" ON public.requirement_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'::app_role));

-- Designathon events table
CREATE TABLE public.designathon_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.designathon_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view events" ON public.designathon_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.designathon_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'coe_admin'::app_role));

CREATE TRIGGER update_designathon_events_updated_at BEFORE UPDATE ON public.designathon_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link requirements to designathon events
CREATE TABLE public.designathon_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.designathon_events(id) ON DELETE CASCADE,
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE SET NULL,
  team_name TEXT NOT NULL,
  members TEXT[] DEFAULT '{}'::text[],
  submission_url TEXT,
  score NUMERIC(4,1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.designathon_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teams" ON public.designathon_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teams" ON public.designathon_teams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'coe_admin'::app_role));
