drop policy if exists "Colleagues read published company posts" on public.company_engagement_posts;
drop policy if exists "Admins read all company posts" on public.company_engagement_posts;

create policy "Colleagues read permitted company posts"
on public.company_engagement_posts for select
to authenticated
using (
  published = true
  or exists (
    select 1
    from public.profiles viewer
    where viewer.id = (select auth.uid())
      and viewer.role = 'admin'
  )
);
