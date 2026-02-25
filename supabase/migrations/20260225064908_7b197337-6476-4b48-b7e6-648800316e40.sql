
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('coe_admin', 'leadership_viewer');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- 4. Requirements table
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('CDC','SEN','BLIND','ELDERLY','BUDS','OTHER')),
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P1','P2','P3')),
  tech_level TEXT NOT NULL DEFAULT 'LOW' CHECK (tech_level IN ('LOW','MEDIUM','HIGH')),
  disability_types TEXT[] DEFAULT '{}',
  therapy_domains TEXT[] DEFAULT '{}',
  market_price NUMERIC(10,2),
  stride_target_price NUMERIC(10,2),
  gap_flags TEXT[] DEFAULT '{}',
  current_state TEXT NOT NULL DEFAULT 'S1',
  path_assignment TEXT CHECK (path_assignment IN ('INTERNAL','DESIGNATHON')),
  revision_number INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. State transitions table
CREATE TABLE public.state_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  transitioned_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Phase feedbacks table
CREATE TABLE public.phase_feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID REFERENCES public.requirements(id) ON DELETE CASCADE NOT NULL,
  from_state TEXT NOT NULL,
  to_state TEXT NOT NULL,
  phase_notes TEXT,
  blockers_resolved TEXT[] DEFAULT '{}',
  key_decisions TEXT[] DEFAULT '{}',
  phase_specific_data JSONB DEFAULT '{}',
  submitted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phase_feedbacks ENABLE ROW LEVEL SECURITY;

-- 8. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 9. Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'coe_admin'));

-- 10. User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'coe_admin'));

-- 11. Requirements policies (both roles can read, only admins can write)
CREATE POLICY "Authenticated users can view requirements" ON public.requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert requirements" ON public.requirements FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Admins can update requirements" ON public.requirements FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));
CREATE POLICY "Admins can delete requirements" ON public.requirements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'coe_admin'));

-- 12. State transitions policies
CREATE POLICY "Authenticated users can view transitions" ON public.state_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert transitions" ON public.state_transitions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- 13. Phase feedbacks policies
CREATE POLICY "Authenticated users can view feedbacks" ON public.phase_feedbacks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert feedbacks" ON public.phase_feedbacks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'coe_admin'));

-- 14. Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 15. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requirements_updated_at BEFORE UPDATE ON public.requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
