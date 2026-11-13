-- pgTAP tests for the plan model, its RPCs and Row Level Security.
-- Run locally with `supabase test db` (needs Docker); CI runs them on every PR.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Two users. The auth trigger must give each a profile, an empty plan and a seed revision.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.com', '{"locale":"en","time_zone":"Europe/London"}'),
  ('22222222-2222-2222-2222-222222222222', 'bea@example.com', '{}');

select is((select count(*)::int from public.plans), 2, 'a plan is created for every new user');
select is((select locale from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'en', 'profile locale comes from sign-up metadata');
select is((select version from public.plans where user_id = '22222222-2222-2222-2222-222222222222'), 1, 'plans start at version 1');
select ok(public.plan_doc_is_valid(public.empty_plan_doc()), 'the empty plan matches the JSON Schema');
select ok(not public.plan_doc_is_valid('{"schemaVersion":1,"days":{}}'::jsonb), 'a plan without days is rejected');

-- Act as Ana.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.plans), 1, 'a user only sees their own plan');
select is((select version from public.my_plan()), 1, 'my_plan returns the caller''s plan');

select is(
  public.save_plan(
    jsonb_set(public.empty_plan_doc(), '{days,mon,agenda}', '[{"id":"a1","title":"Yoga","time":"07:30"}]'),
    1, 'assistant', 'los lunes yoga a las 7:30'
  ),
  2,
  'save_plan bumps the version'
);
select is((select count(*)::int from public.plan_revisions), 2, 'the save is recorded as a revision');

select throws_ok(
  $$ select public.save_plan(public.empty_plan_doc(), 1, 'manual') $$,
  '40001', 'version_conflict', 'a stale version is rejected'
);
select throws_ok(
  $$ select public.save_plan(jsonb_set(public.empty_plan_doc(), '{days,mon,agenda}', '[{"id":"x","title":"Bad","time":"25:00"}]'), 2, 'manual') $$,
  '23514', null, 'an invalid document violates the schema check'
);
select throws_ok(
  $$ select public.save_plan(public.empty_plan_doc(), 2, 'seed') $$,
  '22023', 'invalid_source', 'clients cannot forge seed or undo revisions'
);

select is(public.undo_plan(2), 3, 'undo creates a new version');
select is(
  (select doc -> 'days' -> 'mon' -> 'agenda' from public.plans),
  '[]'::jsonb,
  'undo restores the previous document'
);

select throws_ok(
  $$ update public.plans set version = 99 $$,
  '42501', null, 'plans cannot be written directly'
);

insert into public.completions (user_id, on_date, item_id)
values ('11111111-1111-1111-1111-111111111111', '2026-11-11', 'a1');
select is((select count(*)::int from public.completions), 1, 'users can tick off their own items');
select throws_ok(
  $$ insert into public.completions (user_id, on_date, item_id) values ('22222222-2222-2222-2222-222222222222', '2026-11-11', 'x') $$,
  '42501', null, 'users cannot write completions for someone else'
);

-- Act as Bea: none of Ana's data is visible.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.plan_revisions), 1, 'revisions are private');

-- Anonymous (signed-out) requests see nothing.
reset role;
set local role anon;
select throws_ok($$ select * from public.plans $$, '42501', null, 'anon has no access to plans');

select * from finish();
rollback;
