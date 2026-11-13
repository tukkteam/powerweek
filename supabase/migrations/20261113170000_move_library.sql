-- PowerWeek · move library and workout times
--
-- Exercises may point at an illustrated move from the move library ("move": "bench-press")
-- and a workout may have a start time ("time": "19:00"). Both fields are optional, so every
-- stored plan stays valid; existing rows are not rewritten.
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
    '{"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"schemaVersion":{"type":"number","const":1},"days":{"type":"object","properties":{"mon":{"$ref":"#/$defs/Day"},"tue":{"$ref":"#/$defs/Day"},"wed":{"$ref":"#/$defs/Day"},"thu":{"$ref":"#/$defs/Day"},"fri":{"$ref":"#/$defs/Day"},"sat":{"$ref":"#/$defs/Day"},"sun":{"$ref":"#/$defs/Day"}},"required":["mon","tue","wed","thu","fri","sat","sun"],"additionalProperties":false}},"required":["schemaVersion","days"],"additionalProperties":false,"$defs":{"Day":{"type":"object","properties":{"agenda":{"maxItems":40,"type":"array","items":{"$ref":"#/$defs/AgendaItem"}},"workout":{"anyOf":[{"$ref":"#/$defs/Workout"},{"type":"null"}]},"meals":{"maxItems":12,"type":"array","items":{"$ref":"#/$defs/Meal"}},"note":{"type":"string","maxLength":500}},"required":["agenda","workout","meals"],"additionalProperties":false},"AgendaItem":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"title":{"type":"string","minLength":1,"maxLength":140},"time":{"$ref":"#/$defs/TimeOfDay"},"endTime":{"$ref":"#/$defs/TimeOfDay"},"note":{"type":"string","maxLength":280}},"required":["id","title"],"additionalProperties":false},"TimeOfDay":{"type":"string","pattern":"^([01][0-9]|2[0-3]):[0-5][0-9]$"},"Workout":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":80},"time":{"$ref":"#/$defs/TimeOfDay"},"exercises":{"maxItems":30,"type":"array","items":{"$ref":"#/$defs/Exercise"}},"note":{"type":"string","maxLength":280}},"required":["title","exercises"],"additionalProperties":false},"Exercise":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"name":{"type":"string","minLength":1,"maxLength":100},"sets":{"type":"integer","minimum":1,"maximum":99},"reps":{"type":"string","maxLength":20},"load":{"type":"string","maxLength":20},"note":{"type":"string","maxLength":280},"move":{"$ref":"#/$defs/MoveSlug"}},"required":["id","name"],"additionalProperties":false},"MoveSlug":{"type":"string","maxLength":48,"pattern":"^[a-z0-9]+(?:-[a-z0-9]+)*$"},"Meal":{"type":"object","properties":{"id":{"type":"string","minLength":1,"maxLength":64},"slot":{"type":"string","enum":["breakfast","lunch","snack","dinner"]},"title":{"type":"string","minLength":1,"maxLength":140},"note":{"type":"string","maxLength":280}},"required":["id","slot","title"],"additionalProperties":false}}}'::json,
    doc
  )
$$;

comment on function public.plan_doc_is_valid(jsonb) is 'True when a plan document matches the @powerweek/core JSON Schema.';
