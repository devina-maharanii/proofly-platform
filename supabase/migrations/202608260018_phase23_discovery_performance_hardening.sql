-- Phase 23 follow-up: optimize discovery ownership policy initialization and cover new project foreign keys.
-- Owner: Projects module. Risk: no change to discovery visibility or execute grants; only query-planning improvements.

drop policy "talent can view own saved projects" on public.talent_saved_projects;
create policy "talent can view own saved projects"
  on public.talent_saved_projects for select to authenticated
  using (user_id = (select auth.uid()));

drop policy "talent can view own recent project searches" on public.talent_project_search_history;
create policy "talent can view own recent project searches"
  on public.talent_project_search_history for select to authenticated
  using (user_id = (select auth.uid()));

drop policy "talent can view own project discovery events" on public.talent_project_discovery_events;
create policy "talent can view own project discovery events"
  on public.talent_project_discovery_events for select to authenticated
  using (user_id = (select auth.uid()));

create index talent_saved_projects_project_idx
  on public.talent_saved_projects(project_id);
create index talent_project_discovery_events_project_idx
  on public.talent_project_discovery_events(project_id)
  where project_id is not null;
