begin;

select plan(12);

select has_table('public', 'listing_image_replacements', 'replacement staging table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.listing_image_replacements'::regclass),
  true,
  'replacement staging has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.listing_image_replacements', 'SELECT'),
  'anonymous visitors cannot see staged photos'
);
select ok(
  not has_table_privilege('authenticated', 'public.listing_image_replacements', 'INSERT'),
  'browser clients cannot reserve photo rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.listing_image_replacements', 'DELETE'),
  'browser clients cannot remove staged photo rows directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.reserve_listing_replacement_images(uuid,jsonb)',
    'EXECUTE'
  ),
  'anonymous visitors cannot reserve replacement photos'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.reserve_listing_replacement_images(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated users can invoke the owner-checked reservation RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.finalize_listing_replacement_images(uuid,text,text,text,text,text,bigint,text,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'anonymous visitors cannot finalize replacement photos'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_listing(text,text,text,text,text,bigint,text,text,jsonb,text[])',
    'EXECUTE'
  ),
  'old image-bypassing listing RPC is unavailable to browser clients'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.update_listing_details_unchecked(uuid,text,text,text,text,text,bigint,text,text,jsonb,jsonb)',
    'EXECUTE'
  ),
  'unchecked listing update is not callable by browser clients'
);
select ok(
  not has_table_privilege('anon', 'public.listing_pickup_addresses', 'SELECT'),
  'anonymous visitors cannot read private pickup addresses'
);
select ok(
  not has_table_privilege('authenticated', 'public.listing_images', 'INSERT'),
  'browser clients cannot publish image metadata directly'
);

select * from finish();
rollback;
