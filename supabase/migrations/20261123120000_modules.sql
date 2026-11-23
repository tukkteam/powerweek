-- PowerWeek · modules
--
-- A plan becomes a document made of modules (schemaVersion 2): which modules are on screen, in
-- what order, and the data of each one:
--
--   { "schemaVersion": 2, "layout": ["agenda", "fuel"], "modules": { "agenda": { "v": 1, "data": { … } } } }
--
-- The database checks that envelope and bounds its size. What each module stores inside "data"
-- is checked by the module itself in the app, so a new module needs no migration.
--
-- Nothing stored is rewritten here. Plans at version 1 stay valid and the app upgrades each one
-- the next time it is saved. From then on an app from before modules can no longer write that
-- plan: save_plan refuses to replace a document with an older schemaVersion, so an old tab left
-- open fails safely instead of overwriting newer data.
--
-- Dated facts (an item ticked off, the meal option chosen for a date) move to one table,
-- entries, shared by every module. completions and meal_picks are copied and left in place for
-- apps that have not been reloaded yet; a later migration removes them.

-- -----------------------------------------------------------------------------
-- Plan document
-- -----------------------------------------------------------------------------

-- The schemaVersion of a document; 1 when it has none or it is not a number.
create or replace function public.plan_doc_version(doc jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(doc -> 'schemaVersion') = 'number'
      then least(greatest((doc ->> 'schemaVersion')::numeric, 0), 1000000)::integer
    else 1
  end
$$;

comment on function public.plan_doc_version(jsonb) is 'schemaVersion of a plan document (1 when missing).';

-- Both schema literals are generated. Version 2 comes from @tukkteam/modules (docJsonSchema)
-- and is checked by apps/web/modules/schema.test.ts; version 1 is the frozen schema of the
-- last migration that defined it. Do not edit them by hand.
create or replace function public.plan_doc_is_valid(doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when public.plan_doc_version(doc) = 2 then extensions.jsonb_matches_schema(
      '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"type":"number","const":2},"layout":{"maxItems":24,"type":"array","items":{"type":"string","pattern":"^[a-z][a-z0-9-]{1,31}$"}},"modules":{"type":"object","propertyNames":{"type":"string","pattern":"^[a-z][a-z0-9-]{1,31}$"},"additionalProperties":{"type":"object","properties":{"v":{"type":"integer","minimum":1,"maximum":9999},"data":{"type":"object","propertyNames":{"type":"string"},"additionalProperties":{}}},"required":["v","data"],"additionalProperties":false}}},"required":["schemaVersion","layout","modules"],"additionalProperties":false}'::json,
      doc
    )
    else extensions.jsonb_matches_schema(
      '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"type":"number","const":1},"days":{"type":"object","properties":{"mon":{"$ref":"#/$defs/Day"},"tue":{"$ref":"#/$defs/Day"},"wed":{"$ref":"#/$defs/Day"},"thu":{"$ref":"#/$defs/Day"},"fri":{"$ref":"#/$defs/Day"},"sat":{"$ref":"#/$defs/Day"},"sun":{"$ref":"#/$defs/Day"}},"required":["mon","tue","wed","thu","fri","sat","sun"],"additionalProperties":false},"menu":{"$ref":"#/$defs/WeekMenu"}},"required":["schemaVersion","days"],"additionalProperties":false,"$defs":{"Day":{"type":"object","properties":{"agenda":{"maxItems":40,"type":"array","items":{"$ref":"#/$defs/AgendaItem"}},"workout":{"anyOf":[{"$ref":"#/$defs/Workout"},{"type":"null"}]},"meals":{"maxItems":12,"type":"array","items":{"$ref":"#/$defs/Meal"}},"menu":{"$ref":"#/$defs/DayMenu"},"note":{"type":"string","maxLength":500}},"required":["agenda","workout","meals"],"additionalProperties":false},"AgendaItem":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"title":{"type":"string","minLength":1,"maxLength":140},"time":{"$ref":"#/$defs/TimeOfDay"},"endTime":{"$ref":"#/$defs/TimeOfDay"},"note":{"type":"string","maxLength":280}},"required":["id","title"],"additionalProperties":false},"TimeOfDay":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},"Workout":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":80},"time":{"$ref":"#/$defs/TimeOfDay"},"exercises":{"maxItems":30,"type":"array","items":{"$ref":"#/$defs/Exercise"}},"note":{"type":"string","maxLength":280}},"required":["title","exercises"],"additionalProperties":false},"Exercise":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"name":{"type":"string","minLength":1,"maxLength":100},"sets":{"type":"integer","minimum":1,"maximum":99},"reps":{"type":"string","maxLength":20},"load":{"type":"string","maxLength":20},"note":{"type":"string","maxLength":280},"move":{"$ref":"#/$defs/MoveSlug"}},"required":["id","name"],"additionalProperties":false},"MoveSlug":{"type":"string","maxLength":48,"pattern":"^[a-z0-9]+(?:-[a-z0-9]+)*$"},"Meal":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"slot":{"type":"string","enum":["breakfast","lunch","snack","dinner"]},"title":{"type":"string","minLength":1,"maxLength":140},"note":{"type":"string","maxLength":280}},"required":["id","slot","title"],"additionalProperties":false},"DayMenu":{"type":"object","properties":{"breakfast":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"lunch":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"snack":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"dinner":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}}},"additionalProperties":false},"MealOption":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"title":{"type":"string","minLength":1,"maxLength":140},"note":{"type":"string","maxLength":280}},"required":["id","title"],"additionalProperties":false},"WeekMenu":{"type":"object","properties":{"breakfast":{"$ref":"#/$defs/WeekMenuEntry"},"lunch":{"$ref":"#/$defs/WeekMenuEntry"},"snack":{"$ref":"#/$defs/WeekMenuEntry"},"dinner":{"$ref":"#/$defs/WeekMenuEntry"}},"additionalProperties":false},"WeekMenuEntry":{"type":"object","properties":{"options":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"days":{"minItems":1,"maxItems":7,"type":"array","items":{"type":"string","enum":["mon","tue","wed","thu","fri","sat","sun"]}}},"required":["options"],"additionalProperties":false}}}'::json,
      doc
    )
  end
$$;

comment on function public.plan_doc_is_valid(jsonb) is 'True when a plan document is a valid version 1 plan or a valid version 2 envelope of modules.';

-- Module data is free-form inside the envelope, so the document gets a size limit.
alter table public.plans
  add constraint plans_doc_size check (octet_length(doc::text) <= 1048576);

-- Same contract as before, plus the guard against writing an older schemaVersion.
create or replace function public.save_plan(
  p_doc jsonb,
  p_expected_version integer,
  p_source text,
  p_input text default null,
  p_operations jsonb default null,
  p_changes jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_stored integer;
  v_version integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_source not in ('assistant', 'manual') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;

  select public.plan_doc_version(p.doc) into v_stored
    from public.plans p
   where p.user_id = v_user;
  if public.plan_doc_version(p_doc) < coalesce(v_stored, 1) then
    raise exception 'client_outdated' using errcode = 'PW001';
  end if;

  update public.plans
     set doc = p_doc,
         version = public.plans.version + 1,
         updated_at = now()
   where user_id = v_user
     and public.plans.version = p_expected_version
  returning public.plans.version into v_version;

  if v_version is null then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  insert into public.plan_revisions (user_id, version, doc, source, input, operations, changes)
  values (v_user, v_version, p_doc, p_source, left(p_input, 2000), p_operations, p_changes);

  delete from public.plan_revisions
   where user_id = v_user
     and public.plan_revisions.version <= v_version - 200;

  return v_version;
end
$$;

-- -----------------------------------------------------------------------------
-- Dated facts
-- -----------------------------------------------------------------------------

create table public.entries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  on_date date not null check (on_date between date '2020-01-01' and date '2100-12-31'),
  module text not null check (module ~ '^[a-z][a-z0-9-]{1,31}$'),
  key text not null check (char_length(key) between 1 and 96),
  value jsonb not null check (octet_length(value::text) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, on_date, module, key)
);

comment on table public.entries is 'What happened on a calendar date, per module: an item ticked off, an option chosen, a count. The plan says what a week looks like; entries say what a date was like.';

create trigger entries_touch_updated_at
  before update on public.entries
  for each row execute function public.touch_updated_at();

alter table public.entries enable row level security;

create policy "entries: owner can read" on public.entries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "entries: owner can add" on public.entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "entries: owner can change" on public.entries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "entries: owner can remove" on public.entries
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.entries from anon;
revoke truncate on table public.entries from authenticated;

-- Carry over what people already ticked and chose. Ticks were stored by item id only: the id
-- "workout" is a finished session, every other id is an agenda item.
insert into public.entries (user_id, on_date, module, key, value, updated_at)
select c.user_id,
       c.on_date,
       case when c.item_id = 'workout' then 'train' else 'agenda' end,
       c.item_id,
       'true'::jsonb,
       c.created_at
  from public.completions c
on conflict do nothing;

insert into public.entries (user_id, on_date, module, key, value, updated_at)
select p.user_id, p.on_date, 'fuel', 'pick:' || p.slot, to_jsonb(p.option_id), p.updated_at
  from public.meal_picks p
on conflict do nothing;

comment on table public.completions is 'Deprecated: ticks live in entries. Kept until every app has been reloaded.';
comment on table public.meal_picks is 'Deprecated: picks live in entries. Kept until every app has been reloaded.';
