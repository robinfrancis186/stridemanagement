
-- DoE records table
CREATE TABLE public.doe_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  testing_protocol TEXT,
  sample_size INTEGER,
  baseline_data JSONB DEFAULT '{}'::jsonb,
  beneficiary_profiles JSONB DEFAULT '[]'::jsonb,
  pre_test_data JSONB DEFAULT '{}'::jsonb,
  post_test_data JSONB DEFAULT '{}'::jsonb,
  results_summary TEXT,
  statistical_analysis JSONB DEFAULT '{}'::jsonb,
  improvement_metrics JSONB DEFAULT '{}'::jsonb,
  beneficiary_feedback TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.doe_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view doe_records" ON public.doe_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert doe_records" ON public.doe_records FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'coe_admin'::app_role));
CREATE POLICY "Admins can update doe_records" ON public.doe_records FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'coe_admin'::app_role));

CREATE TRIGGER update_doe_records_updated_at BEFORE UPDATE ON public.doe_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Committee reviews table (individual member scores)
CREATE TABLE public.committee_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL,
  user_need_score NUMERIC(3,1) CHECK (user_need_score >= 0 AND user_need_score <= 10),
  technical_feasibility_score NUMERIC(3,1) CHECK (technical_feasibility_score >= 0 AND technical_feasibility_score <= 10),
  doe_results_score NUMERIC(3,1) CHECK (doe_results_score >= 0 AND doe_results_score <= 10),
  cost_effectiveness_score NUMERIC(3,1) CHECK (cost_effectiveness_score >= 0 AND cost_effectiveness_score <= 10),
  safety_score NUMERIC(3,1) CHECK (safety_score >= 0 AND safety_score <= 10),
  weighted_total NUMERIC(4,1),
  feedback_text TEXT,
  recommendation TEXT CHECK (recommendation IN ('APPROVE', 'REVISE', 'REJECT')),
  conditions TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.committee_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view committee_reviews" ON public.committee_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert committee_reviews" ON public.committee_reviews FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'coe_admin'::app_role));
CREATE POLICY "Admins can update committee_reviews" ON public.committee_reviews FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'coe_admin'::app_role));

-- Committee decisions table (consolidated)
CREATE TABLE public.committee_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'REVISE', 'REJECT')),
  revision_instructions TEXT,
  conditions TEXT,
  decided_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.committee_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view committee_decisions" ON public.committee_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert committee_decisions" ON public.committee_decisions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'coe_admin'::app_role));
