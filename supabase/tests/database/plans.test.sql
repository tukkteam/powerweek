-- pgTAP tests for the plan model, its RPCs and Row Level Security.
-- Run locally with `supabase test db` (needs Docker); CI runs them on every PR.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

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
select ok(
  public.plan_doc_is_valid(jsonb_set(public.empty_plan_doc(), '{days,thu,workout}', '{"title":"Espalda","time":"19:00","exercises":[{"id":"e1","name":"Remo con barra","sets":4,"move":"barbell-row"}]}')),
  'exercises may name a move and workouts may have a start time'
);
select ok(
  not public.plan_doc_is_valid(jsonb_set(public.empty_plan_doc(), '{days,thu,workout}', '{"title":"Espalda","exercises":[{"id":"e1","name":"Remo","move":"Barbell Row"}]}')),
  'a move must be a slug'
);

-- A plan made of modules (version 2): the database checks the envelope, not what modules store.
select ok(
  public.plan_doc_is_valid('{"schemaVersion":2,"layout":["agenda","my-habits"],"modules":{"agenda":{"v":1,"data":{"days":{}}},"my-habits":{"v":3,"data":{"anything":[1,2,3]}}}}'::jsonb),
  'a document of modules is valid whatever each module stores'
);
select ok(public.plan_doc_is_valid('{"schemaVersion":2,"layout":[],"modules":{}}'::jsonb), 'a blank document of modules is valid');
select ok(
  not public.plan_doc_is_valid('{"schemaVersion":2,"layout":["Not An Id"],"modules":{}}'::jsonb),
  'the screen only lists module ids'
);
select ok(
  not public.plan_doc_is_valid('{"schemaVersion":2,"layout":[],"modules":{"agenda":{"data":{}}}}'::jsonb),
  'every module entry carries the version of its data'
);
select ok(
  not public.plan_doc_is_valid('{"schemaVersion":2,"layout":[],"modules":{},"days":{}}'::jsonb),
  'the envelope has no other keys'
);
select ok(
  not public.plan_doc_is_valid('{"schemaVersion":3,"layout":[],"modules":{}}'::jsonb),
  'unknown schema versions are rejected'
);
select is(public.plan_doc_version('{"days":{}}'::jsonb), 1, 'a document without schemaVersion counts as version 1');

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

select is(
  public.save_plan('{"schemaVersion":2,"layout":["agenda"],"modules":{"agenda":{"v":1,"data":{"days":{"mon":[{"id":"a1","title":"Yoga"}]}}}}}'::jsonb, 3, 'manual'),
  4,
  'a version 1 plan can be saved as a document of modules'
);
select throws_ok(
  $$ select public.save_plan(public.empty_plan_doc(), 4, 'manual') $$,
  'PW001', 'client_outdated', 'an app from before modules cannot overwrite a document of modules'
);
select is((select public.plan_doc_version(doc) from public.plans), 2, 'the refused save changed nothing');
select throws_ok(
  $$ select public.save_plan(jsonb_build_object('schemaVersion', 2, 'layout', '[]'::jsonb, 'modules', jsonb_build_object('big', jsonb_build_object('v', 1, 'data', jsonb_build_object('blob', repeat('x', 1100000))))), 4, 'manual') $$,
  '23514', null, 'a document over the size limit is rejected'
);
select is(public.undo_plan(4), 5, 'undo still works across the upgrade');
select is((select public.plan_doc_version(doc) from public.plans), 1, 'undo may restore a version 1 plan');

select throws_ok(
  $$ update public.plans set version = 99 $$,
  '42501', null, 'plans cannot be written directly'
);

insert into public.completions (user_id, on_date, item_id)
values ('11111111-1111-1111-1111-111111111111', '2026-11-11', 'a1');
select is((select count(*)::int from public.completions), 1, 'users can tick off their own items');
select ok(
  public.plan_doc_is_valid(jsonb_set(public.empty_plan_doc(), '{menu}', '{"lunch":{"options":[{"id":"o1","title":"Lentejas"}],"days":["mon"]}}')),
  'plans may share meal options across the week'
);
insert into public.meal_picks (on_date, slot, option_id) values ('2026-11-16', 'lunch', 'o1');
select is((select option_id from public.meal_picks where on_date = '2026-11-16'), 'o1', 'users can pick an option for a date');
update public.meal_picks set option_id = 'o2' where on_date = '2026-11-16' and slot = 'lunch';
select is((select option_id from public.meal_picks where on_date = '2026-11-16'), 'o2', 'users can change their pick');
select throws_ok(
  $$ insert into public.meal_picks (on_date, slot, option_id) values ('2026-11-16', 'brunch', 'o1') $$,
  '23514', null, 'picks only use known meal slots'
);
select throws_ok(
  $$ insert into public.completions (user_id, on_date, item_id) values ('22222222-2222-2222-2222-222222222222', '2026-11-11', 'x') $$,
  '42501', null, 'users cannot write completions for someone else'
);

-- Dated facts of any module.
insert into public.entries (on_date, module, key, value) values
  ('2026-11-23', 'agenda', 'a1', 'true'),
  ('2026-11-23', 'fuel', 'pick:lunch', '"o1"'),
  ('2026-11-23', 'my-habits', 'water', '3');
select is((select count(*)::int from public.entries), 3, 'users can record facts for a date');
update public.entries set value = '4' where module = 'my-habits' and key = 'water';
select is((select value from public.entries where key = 'water'), '4'::jsonb, 'users can change a fact');
delete from public.entries where module = 'agenda' and key = 'a1';
select is((select count(*)::int from public.entries), 2, 'users can remove a fact');
select throws_ok(
  $$ insert into public.entries (on_date, module, key, value) values ('2026-11-23', 'Not A Module', 'k', '1') $$,
  '23514', null, 'facts belong to a module id'
);
select throws_ok(
  $$ insert into public.entries (user_id, on_date, module, key, value) values ('22222222-2222-2222-2222-222222222222', '2026-11-23', 'agenda', 'x', 'true') $$,
  '42501', null, 'users cannot record facts for someone else'
);

-- Act as Bea: none of Ana's data is visible.
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.plan_revisions), 1, 'revisions are private');
select is((select count(*)::int from public.entries), 0, 'facts are private');

-- Anonymous (signed-out) requests see nothing.
reset role;
set local role anon;
select throws_ok($$ select * from public.plans $$, '42501', null, 'anon has no access to plans');
select throws_ok($$ select * from public.entries $$, '42501', null, 'anon has no access to facts');

select * from finish();
rollback;
