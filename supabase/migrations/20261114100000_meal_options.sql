-- PowerWeek · meal options
--
-- A meal slot can offer a range of options instead of one fixed dish: shared by the week
-- (plan "menu", optionally limited to some days) or for one day (day "menu"). Both fields are
-- optional, so every stored plan stays valid.
--
-- The option chosen for a calendar date is not part of the recurring plan: it lives in
-- meal_picks, one row per user, date and slot, like completions.
--
-- The schema literal is generated from packages/core (planJsonSchema) and checked by
-- packages/core/test/plan-schema.test.ts. Do not edit it by hand.

create or replace function public.plan_doc_is_valid(doc jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extensions.jsonb_matches_schema(
    '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"type":"number","const":1},"days":{"type":"object","properties":{"mon":{"$ref":"#/$defs/Day"},"tue":{"$ref":"#/$defs/Day"},"wed":{"$ref":"#/$defs/Day"},"thu":{"$ref":"#/$defs/Day"},"fri":{"$ref":"#/$defs/Day"},"sat":{"$ref":"#/$defs/Day"},"sun":{"$ref":"#/$defs/Day"}},"required":["mon","tue","wed","thu","fri","sat","sun"],"additionalProperties":false},"menu":{"$ref":"#/$defs/WeekMenu"}},"required":["schemaVersion","days"],"additionalProperties":false,"$defs":{"Day":{"type":"object","properties":{"agenda":{"maxItems":40,"type":"array","items":{"$ref":"#/$defs/AgendaItem"}},"workout":{"anyOf":[{"$ref":"#/$defs/Workout"},{"type":"null"}]},"meals":{"maxItems":12,"type":"array","items":{"$ref":"#/$defs/Meal"}},"menu":{"$ref":"#/$defs/DayMenu"},"note":{"type":"string","maxLength":500}},"required":["agenda","workout","meals"],"additionalProperties":false},"AgendaItem":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"title":{"type":"string","minLength":1,"maxLength":140},"time":{"$ref":"#/$defs/TimeOfDay"},"endTime":{"$ref":"#/$defs/TimeOfDay"},"note":{"type":"string","maxLength":280}},"required":["id","title"],"additionalProperties":false},"TimeOfDay":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},"Workout":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":80},"time":{"$ref":"#/$defs/TimeOfDay"},"exercises":{"maxItems":30,"type":"array","items":{"$ref":"#/$defs/Exercise"}},"note":{"type":"string","maxLength":280}},"required":["title","exercises"],"additionalProperties":false},"Exercise":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"name":{"type":"string","minLength":1,"maxLength":100},"sets":{"type":"integer","minimum":1,"maximum":99},"reps":{"type":"string","maxLength":20},"load":{"type":"string","maxLength":20},"note":{"type":"string","maxLength":280},"move":{"$ref":"#/$defs/MoveSlug"}},"required":["id","name"],"additionalProperties":false},"MoveSlug":{"type":"string","maxLength":48,"pattern":"^[a-z0-9]+(?:-[a-z0-9]+)*$"},"Meal":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"slot":{"type":"string","enum":["breakfast","lunch","snack","dinner"]},"title":{"type":"string","minLength":1,"maxLength":140},"note":{"type":"string","maxLength":280}},"required":["id","slot","title"],"additionalProperties":false},"DayMenu":{"type":"object","properties":{"breakfast":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"lunch":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"snack":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"dinner":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}}},"additionalProperties":false},"MealOption":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"title":{"type":"string","minLength":1,"maxLength":140},"note":{"type":"string","maxLength":280}},"required":["id","title"],"additionalProperties":false},"WeekMenu":{"type":"object","properties":{"breakfast":{"$ref":"#/$defs/WeekMenuEntry"},"lunch":{"$ref":"#/$defs/WeekMenuEntry"},"snack":{"$ref":"#/$defs/WeekMenuEntry"},"dinner":{"$ref":"#/$defs/WeekMenuEntry"}},"additionalProperties":false},"WeekMenuEntry":{"type":"object","properties":{"options":{"minItems":1,"maxItems":8,"type":"array","items":{"$ref":"#/$defs/MealOption"}},"days":{"minItems":1,"maxItems":7,"type":"array","items":{"type":"string","enum":["mon","tue","wed","thu","fri","sat","sun"]}}},"required":["options"],"additionalProperties":false}}}'::json,
    doc
  )
$$;

comment on function public.plan_doc_is_valid(jsonb) is 'True when a plan document matches the @powerweek/core JSON Schema.';

create table public.meal_picks (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  on_date date not null check (on_date between date '2020-01-01' and date '2100-12-31'),
  slot text not null check (slot in ('breakfast', 'lunch', 'snack', 'dinner')),
  option_id text not null check (char_length(option_id) between 1 and 64),
  updated_at timestamptz not null default now(),
  primary key (user_id, on_date, slot)
);

comment on table public.meal_picks is 'The meal option chosen for a slot on a calendar date.';

alter table public.meal_picks enable row level security;

create policy "meal_picks: owner can read" on public.meal_picks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "meal_picks: owner can add" on public.meal_picks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "meal_picks: owner can change" on public.meal_picks
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "meal_picks: owner can remove" on public.meal_picks
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.meal_picks from anon;
revoke truncate on table public.meal_picks from authenticated;
