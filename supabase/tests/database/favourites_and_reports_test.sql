begin;

select plan(16);

select has_table('public', 'favourites', 'favourites table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.favourites'::regclass),
  true,
  'favourites have RLS enabled'
);
select ok(not has_table_privilege('anon', 'public.favourites', 'SELECT'), 'guests cannot read favourites');
select ok(has_table_privilege('authenticated', 'public.favourites', 'SELECT'), 'signed-in users can read favourites under RLS');
select ok(has_table_privilege('authenticated', 'public.favourites', 'INSERT'), 'signed-in users can save active listings under RLS');
select ok(has_table_privilege('authenticated', 'public.favourites', 'DELETE'), 'signed-in users can remove their favourites');
select ok(not has_table_privilege('authenticated', 'public.favourites', 'UPDATE'), 'browser clients cannot change favourite ownership');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favourites' and policyname = 'users read their favourites'),
  'favourite reads have an owner policy'
);
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'favourites' and policyname = 'users save active listings'),
  'favourite inserts have an active-listing policy'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.reports'::regclass),
  true,
  'reports have RLS enabled'
);
select ok(not has_table_privilege('authenticated', 'public.reports', 'INSERT'), 'browser clients cannot insert unvalidated reports');
select ok(not has_table_privilege('anon', 'public.reports', 'SELECT'), 'guests cannot read reports');
select ok(has_table_privilege('authenticated', 'public.reports', 'SELECT'), 'users can read their reports under RLS');
select ok(
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reports' and policyname = 'users read their own reports'),
  'report reads have an owner policy'
);
select ok(
  has_function_privilege('authenticated', 'public.submit_listing_report(uuid,text,text)', 'EXECUTE'),
  'signed-in users can invoke guarded report submission'
);
select ok(
  not has_function_privilege('anon', 'public.submit_listing_report(uuid,text,text)', 'EXECUTE'),
  'guests cannot submit reports'
);

select * from finish();
rollback;
