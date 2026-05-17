-- C-1 fix: array_any matcher now also matches scalar array elements.
--
-- Arbeidstilsynet self-audit:
--   Pålegg-grunn addressed: GDPR Art. 35, AML § 4-3, IK-f § 5 nr. 7 —
--   regler som matcher `array_any` over law_refs / legal_basis / framework-
--   arrays må fyre på faktiske publiserte rader. Emitterne skriver
--   `legal_basis`/`law_refs` som `to_jsonb(text[])` — array av strenger.
--   Den eksisterende matcher-armen brukte `el @> w` der `w` er et JSON-
--   objekt (`{"value":"GDPR Art. 35"}`), så `"GDPR Art. 35" @> {...}`
--   er alltid false. Resultat: regelen gdpr-35-dpia-on-publish (og
--   tilsvarende _law_refs-regler) fyrte aldri.
--   Restrisiko deferred: object-array-matching (eksisterende oppførsel)
--   beholdes uendret bak skalar-fallback'en så ingen eksisterende regel
--   bryter.

create or replace function public.workflow_payload_matches_condition(
  p_condition jsonb,
  p_new jsonb,
  p_old jsonb,
  p_trigger text
)
returns boolean
language plpgsql
immutable
as $$
declare
  m text;
  p text;
  w jsonb;
  arr jsonb;
  el jsonb;
  kids jsonb;
  i int;
  cnt int;
begin
  if p_condition is null then
    return false;
  end if;

  m := coalesce(p_condition->>'match', 'always');

  if m = 'always' then
    return true;
  end if;

  if m = 'and' then
    kids := p_condition->'conditions';
    if kids is null or jsonb_typeof(kids) <> 'array' then
      return false;
    end if;
    for i in 0..jsonb_array_length(kids) - 1
    loop
      if not public.workflow_payload_matches_condition(kids->i, p_new, p_old, p_trigger) then
        return false;
      end if;
    end loop;
    return true;
  end if;

  if m = 'or' then
    kids := p_condition->'conditions';
    if kids is null or jsonb_typeof(kids) <> 'array' then
      return false;
    end if;
    for i in 0..jsonb_array_length(kids) - 1
    loop
      if public.workflow_payload_matches_condition(kids->i, p_new, p_old, p_trigger) then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if m = 'xor' then
    kids := p_condition->'conditions';
    if kids is null or jsonb_typeof(kids) <> 'array' then
      return false;
    end if;
    cnt := 0;
    for i in 0..jsonb_array_length(kids) - 1
    loop
      if public.workflow_payload_matches_condition(kids->i, p_new, p_old, p_trigger) then
        cnt := cnt + 1;
      end if;
    end loop;
    return cnt = 1;
  end if;

  if m = 'array_any' then
    p := p_condition->>'path';
    w := p_condition->'where';
    if p is null or w is null then
      return false;
    end if;
    arr := p_new #> string_to_array(p, '.');
    if arr is null or jsonb_typeof(arr) <> 'array' then
      return false;
    end if;
    for el in select * from jsonb_array_elements(arr)
    loop
      if w = '{}'::jsonb or w is null then
        return true;
      end if;
      -- C-1 fix: scalar array elements (string/number/boolean) match when
      -- `where` is an object with only a `value` key and the element
      -- equals that value. Preserves object-element @> object behaviour
      -- below for arrays-of-objects (existing law-refs[].ref shape).
      if jsonb_typeof(el) in ('string','number','boolean')
         and jsonb_typeof(w) = 'object'
         and (w ? 'value')
         and (select count(*) from jsonb_object_keys(w)) = 1
         and el = (w->'value') then
        return true;
      end if;
      if el @> w then
        return true;
      end if;
    end loop;
    return false;
  end if;

  if m = 'field_equals' then
    p := p_condition->>'path';
    if p is null then
      return false;
    end if;
    return (p_new #>> string_to_array(p, '.')) = (p_condition->>'value');
  end if;

  return false;
end;
$$;

comment on function public.workflow_payload_matches_condition(jsonb, jsonb, jsonb, text) is
  'Evaluates a workflow condition_json tree against the new/old payload. C-1 patch (2026-09-07) extends the array_any arm so scalar string/number/boolean elements match a `{"value": "..."}` right-hand-side — keeps the law_refs/legal_basis text[] case working without breaking the existing array-of-objects @> behaviour.';
