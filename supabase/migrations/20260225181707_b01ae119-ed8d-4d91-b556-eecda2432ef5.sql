
-- Allow anonymous (public) read access to all tables since auth is removed

-- requirements
CREATE POLICY "Public read requirements" ON public.requirements FOR SELECT USING (true);

-- state_transitions
CREATE POLICY "Public read state_transitions" ON public.state_transitions FOR SELECT USING (true);

-- phase_feedbacks
CREATE POLICY "Public read phase_feedbacks" ON public.phase_feedbacks FOR SELECT USING (true);

-- doe_records
CREATE POLICY "Public read doe_records" ON public.doe_records FOR SELECT USING (true);

-- committee_reviews
CREATE POLICY "Public read committee_reviews" ON public.committee_reviews FOR SELECT USING (true);

-- committee_decisions
CREATE POLICY "Public read committee_decisions" ON public.committee_decisions FOR SELECT USING (true);

-- notifications
CREATE POLICY "Public read notifications" ON public.notifications FOR SELECT USING (true);

-- requirement_files
CREATE POLICY "Public read requirement_files" ON public.requirement_files FOR SELECT USING (true);

-- requirement_versions
CREATE POLICY "Public read requirement_versions" ON public.requirement_versions FOR SELECT USING (true);

-- designathon_events
CREATE POLICY "Public read designathon_events" ON public.designathon_events FOR SELECT USING (true);

-- designathon_teams
CREATE POLICY "Public read designathon_teams" ON public.designathon_teams FOR SELECT USING (true);

-- profiles
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);

-- Also allow public insert/update/delete for main tables so demo works without auth
CREATE POLICY "Public insert requirements" ON public.requirements FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update requirements" ON public.requirements FOR UPDATE USING (true);
CREATE POLICY "Public delete requirements" ON public.requirements FOR DELETE USING (true);

CREATE POLICY "Public insert state_transitions" ON public.state_transitions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert phase_feedbacks" ON public.phase_feedbacks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert doe_records" ON public.doe_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update doe_records" ON public.doe_records FOR UPDATE USING (true);
CREATE POLICY "Public insert committee_reviews" ON public.committee_reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update committee_reviews" ON public.committee_reviews FOR UPDATE USING (true);
CREATE POLICY "Public insert committee_decisions" ON public.committee_decisions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert requirement_files" ON public.requirement_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete requirement_files" ON public.requirement_files FOR DELETE USING (true);
CREATE POLICY "Public insert requirement_versions" ON public.requirement_versions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Public insert designathon_events" ON public.designathon_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update designathon_events" ON public.designathon_events FOR UPDATE USING (true);
CREATE POLICY "Public delete designathon_events" ON public.designathon_events FOR DELETE USING (true);
CREATE POLICY "Public insert designathon_teams" ON public.designathon_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update designathon_teams" ON public.designathon_teams FOR UPDATE USING (true);
CREATE POLICY "Public delete designathon_teams" ON public.designathon_teams FOR DELETE USING (true);
