-- =============================================================================
-- PowerWeek · initial schema
--
-- One weekly plan document per user (JSONB validated by pg_jsonschema against the
-- JSON Schema generated from @powerweek/core), an append-only revision log that
-- powers undo, per-date completions, and an assistant request log used for rate
-- limiting. Row Level Security is enabled on every table; plan writes only happen
-- through the security-definer functions below so every change leaves a revision.
-- =============================================================================

create extension if not exists pg_jsonschema with schema extensions;

-- -----------------------------------------------------------------------------
-- Plan document helpers
-- -----------------------------------------------------------------------------

create or replace function public.empty_plan_doc()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select '{"schemaVersion":1,"days":{"mon":{"agenda":[],"workout":null,"meals":[]},"tue":{"agenda":[],"workout":null,"meals":[]},"wed":{"agenda":[],"workout":null,"meals":[]},"thu":{"agenda":[],"workout":null,"meals":[]},"fri":{"agenda":[],"workout":null,"meals":[]},"sat":{"agenda":[],"workout":null,"meals":[]},"sun":{"agenda":[],"workout":null,"meals":[]}}}'::jsonb
$$;

comment on function public.empty_plan_doc() is 'A week with nothing planned (schemaVersion 1).';

-- The schema literal is generated from packages/core (planJsonSchema) and checked
-- by packages/core/test/plan-schema.test.ts. Do not edit it by hand: change the zod
-- schema, regenerate, and add a new migration that replaces this function.
create or replace function public.plan_doc_is_valid(doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extensions.jsonb_matches_schema(
    '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"type":"number","const":1},"days":{"type":"object","properties":{"mon":{"$ref":"#/$defs/Day"},"tue":{"$ref":"#/$defs/Day"},"wed":{"$ref":"#/$defs/Day"},"thu":{"$ref":"#/$defs/Day"},"fri":{"$ref":"#/$defs/Day"},"sat":{"$ref":"#/$defs/Day"},"sun":{"$ref":"#/$defs/Day"}},"required":["mon","tue","wed","thu","fri","sat","sun"],"additionalProperties":false}},"required":["schemaVersion","days"],"additionalProperties":false,"$defs":{"Day":{"type":"object","properties":{"agenda":{"maxItems":40,"type":"array","items":{"$ref":"#/$defs/AgendaItem"}},"workout":{"anyOf":[{"$ref":"#/$defs/Workout"},{"type":"null"}]},"meals":{"maxItems":12,"type":"array","items":{"$ref":"#/$defs/Meal"}},"note":{"type":"string","maxLength":500}},"required":["agenda","workout","meals"],"additionalProperties":false},"AgendaItem":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"title":{"type":"string","minLength":1,"maxLength":140},"time":{"$ref":"#/$defs/TimeOfDay"},"endTime":{"$ref":"#/$defs/TimeOfDay"},"note":{"type":"string","maxLength":280}},"required":["id","title"],"additionalProperties":false},"TimeOfDay":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},"Workout":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":80},"exercises":{"maxItems":30,"type":"array","items":{"$ref":"#/$defs/Exercise"}},"note":{"type":"string","maxLength":280}},"required":["title","exercises"],"additionalProperties":false},"Exercise":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"name":{"type":"string","minLength":1,"maxLength":100},"sets":{"type":"integer","minimum":1,"maximum":99},"reps":{"type":"string","maxLength":20},"load":{"type":"string","maxLength":20},"note":{"type":"string","maxLength":280}},"required":["id","name"],"additionalProperties":false},"Meal":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"slot":{"type":"string","enum":["breakfast","lunch","snack","dinner"]},"title":{"type":"string","minLength":1,"maxLength":140},"note":{"type":"string","maxLength":280}},"required":["id","slot","title"],"additionalProperties":false}}}'::json,
    doc
  )
$$;

comment on function public.plan_doc_is_valid(jsonb) is 'True when a plan document matches the @powerweek/core JSON Schema.';

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'es' check (locale in ('es', 'en')),
  time_zone text not null default 'Europe/Madrid' check (char_length(time_zone) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Display preferences, one row per user.';

create table public.plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  doc jsonb not null default public.empty_plan_doc(),
  version integer not null default 1 check (version >= 1),
  updated_at timestamptz not null default now(),
  constraint plans_doc_valid check (public.plan_doc_is_valid(doc))
);

comment on table public.plans is 'The weekly plan of each user. Written only through save_plan() and undo_plan().';

create table public.plan_revisions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null,
  doc jsonb not null,
  source text not null check (source in ('seed', 'assistant', 'manual', 'undo')),
  input text check (char_length(input) <= 2000),
  operations jsonb,
  changes jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);

comment on table public.plan_revisions is 'Append-only history of plan versions (last 200 per user). Powers undo and the activity log.';

create index plan_revisions_user_created_idx on public.plan_revisions (user_id, created_at desc);

create table public.completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  on_date date not null check (on_date between date '2020-01-01' and date '2100-12-31'),
  item_id text not null check (char_length(item_id) between 1 and 64),
  created_at timestamptz not null default now(),
  primary key (user_id, on_date, item_id)
);

comment on table public.completions is 'Plan items ticked off on a given calendar date.';

create table public.assistant_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('ok', 'no_changes', 'invalid_output', 'model_error', 'conflict')),
  model text check (char_length(model) <= 120),
  latency_ms integer check (latency_ms >= 0),
  created_at timestamptz not null default now()
);

comment on table public.assistant_requests is 'One row per assistant call; used for per-user rate limiting and basic observability.';

create index assistant_requests_user_created_idx on public.assistant_requests (user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- New users get a profile, an empty plan and its seed revision
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := coalesce(new.raw_user_meta_data ->> 'locale', 'es');
  v_time_zone text := coalesce(new.raw_user_meta_data ->> 'time_zone', 'Europe/Madrid');
begin
  if v_locale not in ('es', 'en') then
    v_locale := 'es';
  end if;
  if char_length(v_time_zone) not between 1 and 64 then
    v_time_zone := 'Europe/Madrid';
  end if;

  insert into public.profiles (id, locale, time_zone)
  values (new.id, v_locale, v_time_zone)
  on conflict (id) do nothing;

  insert into public.plans (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.plan_revisions (user_id, version, doc, source)
  values (new.id, 1, public.empty_plan_doc(), 'seed')
  on conflict (user_id, version) do nothing;

  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Plan API (called through PostgREST RPC with the user's JWT)
-- -----------------------------------------------------------------------------

-- Returns the caller's plan, creating it if a trigger was ever missed.
create or replace function public.my_plan()
returns table (doc jsonb, version integer, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.plans (user_id) values (v_user)
  on conflict (user_id) do nothing;
  insert into public.plan_revisions (user_id, version, doc, source)
  values (v_user, 1, public.empty_plan_doc(), 'seed')
  on conflict (user_id, version) do nothing;

  return query
    select p.doc, p.version, p.updated_at
      from public.plans p
     where p.user_id = v_user;
end
$$;

-- Optimistic-concurrency write: succeeds only if the stored version is still
-- p_expected_version. Returns the new version and records a revision.
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
  v_version integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_source not in ('assistant', 'manual') then
    raise exception 'invalid_source' using errcode = '22023';
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

-- Reverts the change that produced p_version, as long as nothing changed since.
-- The revert is itself a new version, so history stays linear.
create or replace function public.undo_plan(p_version integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_previous jsonb;
  v_version integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select r.doc into v_previous
    from public.plan_revisions r
   where r.user_id = v_user
     and r.version = p_version - 1;

  if v_previous is null then
    raise exception 'nothing_to_undo' using errcode = 'P0002';
  end if;

  update public.plans
     set doc = v_previous,
         version = public.plans.version + 1,
         updated_at = now()
   where user_id = v_user
     and public.plans.version = p_version
  returning public.plans.version into v_version;

  if v_version is null then
    raise exception 'version_conflict' using errcode = '40001';
  end if;

  insert into public.plan_revisions (user_id, version, doc, source)
  values (v_user, v_version, v_previous, 'undo');

  return v_version;
end
$$;

-- Deletes the caller's account and, through cascades, all of their data.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_revisions enable row level security;
alter table public.completions enable row level security;
alter table public.assistant_requests enable row level security;

create policy "profiles: owner can read" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: owner can update" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "plans: owner can read" on public.plans
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "plan_revisions: owner can read" on public.plan_revisions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "completions: owner can read" on public.completions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "completions: owner can add" on public.completions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "completions: owner can remove" on public.completions
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "assistant_requests: owner can read" on public.assistant_requests
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "assistant_requests: owner can log" on public.assistant_requests
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- Privileges (defence in depth on top of RLS)
-- -----------------------------------------------------------------------------

revoke all on table public.profiles, public.plans, public.plan_revisions, public.completions,
  public.assistant_requests from anon;
revoke insert, update, delete, truncate on table public.plans, public.plan_revisions from authenticated;
revoke insert, delete, truncate on table public.profiles from authenticated;
revoke update, truncate on table public.completions, public.assistant_requests from authenticated;
revoke delete on table public.assistant_requests from authenticated;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.my_plan() from public, anon;
revoke all on function public.save_plan(jsonb, integer, text, text, jsonb, jsonb) from public, anon;
revoke all on function public.undo_plan(integer) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.my_plan() to authenticated;
grant execute on function public.save_plan(jsonb, integer, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.undo_plan(integer) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: other devices refresh when the plan changes
-- -----------------------------------------------------------------------------

alter publication supabase_realtime add table public.plans;
