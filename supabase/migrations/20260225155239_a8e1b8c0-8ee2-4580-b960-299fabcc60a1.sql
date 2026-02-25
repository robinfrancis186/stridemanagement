
-- ============================================================
-- Fix #3: Drop trigger on auth.users (reserved schema)
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ============================================================
-- Fix #4: Recreate ALL RLS policies as PERMISSIVE (default)
-- Drop all existing RESTRICTIVE policies and recreate them
-- ============================================================

-- === requirements ===
DROP POLICY IF EXISTS "Authenticated users can view requirements" ON public.requirements;
DROP POLICY IF EXISTS "Admins can insert requirements" ON public.requirements;
DROP POLICY IF EXISTS "Admins can update requirements" ON public.requirements;
DROP POLICY IF EXISTS "Admins can delete requirements" ON public.requirements;

CREATE POLICY "Authenticated users can view requirements" ON public.requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert requirements" ON public.requirements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Admins can update requirements" ON public.requirements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Admins can delete requirements" ON public.requirements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));

-- === state_transitions ===
DROP POLICY IF EXISTS "Authenticated users can view transitions" ON public.state_transitions;
DROP POLICY IF EXISTS "Admins can insert transitions" ON public.state_transitions;

CREATE POLICY "Authenticated users can view transitions" ON public.state_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert transitions" ON public.state_transitions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- === phase_feedbacks ===
DROP POLICY IF EXISTS "Authenticated users can view feedbacks" ON public.phase_feedbacks;
DROP POLICY IF EXISTS "Admins can insert feedbacks" ON public.phase_feedbacks;

CREATE POLICY "Authenticated users can view feedbacks" ON public.phase_feedbacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert feedbacks" ON public.phase_feedbacks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- === profiles ===
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- === user_roles ===
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coe_admin')) WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));
-- Allow users to insert their own role (for first-user bootstrap)
CREATE POLICY "Users can insert own role if none exist" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1)
);

-- === notifications ===
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- === requirement_files ===
DROP POLICY IF EXISTS "Authenticated users can view files" ON public.requirement_files;
DROP POLICY IF EXISTS "Admins can insert files" ON public.requirement_files;
DROP POLICY IF EXISTS "Admins can delete files" ON public.requirement_files;

CREATE POLICY "Authenticated users can view files" ON public.requirement_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert files" ON public.requirement_files FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Admins can delete files" ON public.requirement_files FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));

-- === requirement_versions ===
DROP POLICY IF EXISTS "Authenticated users can view versions" ON public.requirement_versions;
DROP POLICY IF EXISTS "Admins can insert versions" ON public.requirement_versions;

CREATE POLICY "Authenticated users can view versions" ON public.requirement_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert versions" ON public.requirement_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- === doe_records ===
DROP POLICY IF EXISTS "Authenticated users can view doe_records" ON public.doe_records;
DROP POLICY IF EXISTS "Admins can insert doe_records" ON public.doe_records;
DROP POLICY IF EXISTS "Admins can update doe_records" ON public.doe_records;

CREATE POLICY "Authenticated users can view doe_records" ON public.doe_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert doe_records" ON public.doe_records FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Admins can update doe_records" ON public.doe_records FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));

-- === committee_reviews ===
DROP POLICY IF EXISTS "Authenticated users can view committee_reviews" ON public.committee_reviews;
DROP POLICY IF EXISTS "Admins can insert committee_reviews" ON public.committee_reviews;
DROP POLICY IF EXISTS "Admins can update committee_reviews" ON public.committee_reviews;

CREATE POLICY "Authenticated users can view committee_reviews" ON public.committee_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert committee_reviews" ON public.committee_reviews FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Admins can update committee_reviews" ON public.committee_reviews FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));

-- === committee_decisions ===
DROP POLICY IF EXISTS "Authenticated users can view committee_decisions" ON public.committee_decisions;
DROP POLICY IF EXISTS "Admins can insert committee_decisions" ON public.committee_decisions;

CREATE POLICY "Authenticated users can view committee_decisions" ON public.committee_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert committee_decisions" ON public.committee_decisions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- === designathon_events ===
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.designathon_events;
DROP POLICY IF EXISTS "Admins can manage events" ON public.designathon_events;

CREATE POLICY "Authenticated users can view events" ON public.designathon_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage events" ON public.designathon_events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coe_admin')) WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- === designathon_teams ===
DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.designathon_teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.designathon_teams;

CREATE POLICY "Authenticated users can view teams" ON public.designathon_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage teams" ON public.designathon_teams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'coe_admin')) WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));
