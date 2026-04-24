-- Fix: don't auto-fill organization_id when NULL (allows global templates).
-- Also re-seeds the 4 global templates in case the trigger corrupted them
-- by assigning a real org_id during the previous migration run.

-- 1. Fix trigger to not override intentional NULLs.
create or replace function public.inspection_templates_before_insert_defaults()
returns trigger
language plpgsql
as $$
begin
  -- Only auto-fill org when no value was supplied AND there's an active session.
  -- A NULL organization_id is valid for system/global templates.
  if new.organization_id is null and auth.uid() is not null then
    new.organization_id := public.current_org_id();
  end if;
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

-- 2. Delete any incorrectly org-scoped copies of the 4 default templates
--    (those that were supposed to be global but got an org_id from the trigger).
--    Only deletes rows not referenced by any inspection_round.
delete from public.inspection_templates
where
  organization_id is not null
  and name in (
    'Standard HMS-vernerunde',
    'Brannsikkerhet og rømning',
    'Kjemikalie- og stoffhåndtering',
    'Ergonomi og kontorarbeidsplass'
  )
  and not exists (
    select 1 from public.inspection_rounds r
    where r.template_id = public.inspection_templates.id
  );

-- 3. Re-insert the 4 global templates (only if absent).
do $$
declare
  v_std jsonb := jsonb_build_object('title', 'Standard HMS-vernerunde', 'items', jsonb_build_array(
    jsonb_build_object('key','f_001','label','Nødutganger er fri, ulåst og tydelig merket','fieldType','yes_no_na','hmsCategory','fysisk','lawRef','AML § 4-4','required',true,'helpText','Kontroller at ingen nødutganger er blokkert av varer, møbler eller lås.'),
    jsonb_build_object('key','f_002','label','Ventilasjon og inneklima er tilfredsstillende','fieldType','yes_no_na','hmsCategory','fysisk','lawRef','AML § 4-4','required',true,'helpText','Sjekk temperatur (18–22 °C), luftkvalitet og at aggregat ikke er støyende.'),
    jsonb_build_object('key','f_003','label','Belysning er tilstrekkelig på alle arbeidsstasjoner','fieldType','yes_no_na','hmsCategory','fysisk','lawRef','AML § 4-4','required',true,'helpText','Minimum 300 lux på arbeidsbord, 500 lux ved fint presisionsarbeid.'),
    jsonb_build_object('key','f_004','label','Gangveier og gulv er fri for snublefeller og søl','fieldType','yes_no_na','hmsCategory','fysisk','lawRef','AML § 4-4','required',true),
    jsonb_build_object('key','f_005','label','Støynivå er akseptabelt; hørselsvern tilgjengelig der det trengs','fieldType','yes_no_na','hmsCategory','fysisk','lawRef','AML § 4-4','required',true,'helpText','Hørselsvern skal tilbys ved støy over 80 dB(A). Påbud over 85 dB(A).'),
    jsonb_build_object('key','f_006','label','Temperatur er innenfor komfortabelt område (18–24 °C)','fieldType','yes_no_na','hmsCategory','fysisk','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','e_001','label','Arbeidsstasjoner er ergonomisk tilpasset den ansatte','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',true,'helpText','Stol, bord, skjerm og tastatur skal kunne justeres til brukeren.'),
    jsonb_build_object('key','e_002','label','Skjermarbeidsplass: skjerm, tastatur og mus er korrekt plassert','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften § 4','required',true),
    jsonb_build_object('key','e_003','label','Tunge løft håndteres med hjelpemidler eller er under 25 kg','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',true),
    jsonb_build_object('key','e_004','label','Arbeidsstillinger varieres; pauser tas regelmessig','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','e_005','label','Hjelpemidler for manuell håndtering er tilgjengelige og i god stand','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','p_001','label','Arbeidsbelastning og tidsfrister er rimelige og forsvarlige','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',true,'helpText','Kartlegg tegn på stress, overbelastning eller ubalanse i arbeidsmengde.'),
    jsonb_build_object('key','p_002','label','Det er ingen kjente tegn til mobbing, trakassering eller konflikter','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',true),
    jsonb_build_object('key','p_003','label','Ansatte vet hva som forventes — klare arbeidsoppgaver og mål','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',false),
    jsonb_build_object('key','p_004','label','Pauserom og sosiale fasiliteter er tilgjengelige og vedlikeholdt','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',false),
    jsonb_build_object('key','p_005','label','Ansatte kan ta opp problemer med nærmeste leder uten frykt','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',false),
    jsonb_build_object('key','k_001','label','Stoffkartotek er oppdatert og tilgjengelig for alle ansatte','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','Stoffkartotekforskriften § 5','required',true),
    jsonb_build_object('key','k_002','label','Sikkerhetsdatablad (SDS) foreligger for alle kjemikalier','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5 / REACH','required',true),
    jsonb_build_object('key','k_003','label','Alle kjemikaliebeholdere er tydelig merket med GHS-piktogram','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','CLP-forordningen','required',true),
    jsonb_build_object('key','k_004','label','Kjemikalier er oppbevart korrekt — adskilt etter fareklasse','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','k_005','label','Riktig verneutstyr for kjemikaliehåndtering er tilgjengelig','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','b_001','label','Brannslokkere er synlig plassert og innen kontrolldato','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 11-4','required',true),
    jsonb_build_object('key','b_002','label','Brannalarm er testet og fungerer','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften','required',true),
    jsonb_build_object('key','b_003','label','Rømningsveier er fri og nødlysskilter fungerer','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brann- og eksplosjonsvernloven § 7','required',true),
    jsonb_build_object('key','b_004','label','Evakueringsplan er oppdatert og oppslått ved alle utganger','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften','required',true),
    jsonb_build_object('key','b_005','label','Brannøvelse er gjennomført siste 12 måneder','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brann- og eksplosjonsvernloven § 11','required',true),
    jsonb_build_object('key','m_001','label','Maskiner har CE-merking og bruksanvisning tilgjengelig','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','Arbeidsutstyrsforskriften § 10','required',true),
    jsonb_build_object('key','m_002','label','Verneutstyr (gitter, skjermer) er montert og funksjonelt','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','Arbeidsutstyrsforskriften § 4','required',true),
    jsonb_build_object('key','m_003','label','Nødstopp er tilgjengelig, merket og testet','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','Maskindirektivet','required',true),
    jsonb_build_object('key','m_004','label','Vedlikeholdslogg er ført og vedlikehold gjennomført etter plan','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','AML § 4-2','required',false),
    jsonb_build_object('key','m_005','label','Operatører er opplært og autorisert på aktuelt utstyr','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','AML § 4-2','required',true),
    jsonb_build_object('key','a_001','label','Avvik fra forrige vernerunde er lukket eller fulgt opp','fieldType','yes_no_na','hmsCategory','annet','lawRef','IK-forskriften § 5','required',true),
    jsonb_build_object('key','a_002','label','Arbeidsplassen er ryddig og avfall sorteres korrekt','fieldType','yes_no_na','hmsCategory','annet','lawRef','IK-forskriften','required',false),
    jsonb_build_object('key','a_003','label','Kommentarer / observasjoner fra ansatte','fieldType','text','hmsCategory','annet','lawRef','AML § 3-1','required',false)
  ));
  v_brann jsonb := jsonb_build_object('title', 'Brannsikkerhet og rømning', 'items', jsonb_build_array(
    jsonb_build_object('key','br_001','label','Bygget er korrekt brannklassifisert','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brann- og eksplosjonsvernloven § 4','required',true),
    jsonb_build_object('key','br_002','label','Sprinkleranlegg er installert der krav foreligger og er i drift','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 11-5','required',true),
    jsonb_build_object('key','br_003','label','Alle brannslokkere er sjekket av autorisert firma siste år','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften','required',true),
    jsonb_build_object('key','br_004','label','Brannslanger og tilhørende utstyr er intakt og tilgjengelig','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 11-4','required',true),
    jsonb_build_object('key','br_005','label','Rømningsveier har min. 1,2 m bredde og er uten hindringer','fieldType','yes_no_na','hmsCategory','brann','lawRef','FOBTOT § 7','required',true),
    jsonb_build_object('key','br_006','label','Nødlysskilter (NS 3875) er montert og belyst på alle rømningsveier','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 7-8','required',true),
    jsonb_build_object('key','br_007','label','Selvlukkende branndører er funksjonelle og ikke kilt opp','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 7-7','required',true),
    jsonb_build_object('key','br_008','label','Nødbelysning har batteribackup og er testet','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 7-8','required',true),
    jsonb_build_object('key','br_009','label','Brannvernleder er utpekt og har dokumentert opplæring (16 t)','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 11-3','required',true),
    jsonb_build_object('key','br_010','label','Evakueringsplan er oppdatert med plantegning og møteplass','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften','required',true),
    jsonb_build_object('key','br_011','label','Brannøvelse er gjennomført siste 12 måneder og protokoll ført','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brann- og eksplosjonsvernloven § 11','required',true),
    jsonb_build_object('key','br_012','label','Brennbart materiale er oppbevart i godkjent skap eller rom','fieldType','yes_no_na','hmsCategory','brann','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','br_013','label','El-tavle er ryddig, merket og fri for brennbart materiale','fieldType','yes_no_na','hmsCategory','brann','lawRef','Lavspenningsforskriften','required',true),
    jsonb_build_object('key','br_014','label','Foto av eventuell skade eller avvik','fieldType','photo','hmsCategory','brann','required',false)
  ));
  v_kjem jsonb := jsonb_build_object('title', 'Kjemikalie- og stoffhåndtering', 'items', jsonb_build_array(
    jsonb_build_object('key','kj_001','label','Stoffkartotek er komplett, oppdatert og digitalt tilgjengelig','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','Stoffkartotekforskriften § 5','required',true),
    jsonb_build_object('key','kj_002','label','SDS foreligger for hvert kjemikalie på arbeidsstedet','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','Stoffkartotekforskriften / REACH','required',true),
    jsonb_build_object('key','kj_003','label','Alle beholdere er merket med produktnavn og GHS-piktogram','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','CLP-forordningen (GHS)','required',true),
    jsonb_build_object('key','kj_004','label','Kjemikalier er adskilt etter fareklasse i godkjent oppbevaring','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_005','label','Kjemikalieskapet er ventilert og låsbart','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_006','label','Ventilasjon/avtrekk er funksjonelt der kjemikalier brukes','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_007','label','Verneutstyr (hansker, briller, forkle) er tilgjengelig og korrekt type','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_008','label','Øyeskylleflasker og nødusj er tilgjengelig og innen holdbarhet','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_009','label','Spill- og absorpsjonsmidler er tilgjengelig ved oppbevaringssted','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_010','label','Kjemikalieavfall klassifiseres og leveres godkjent mottak','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','Avfallsforskriften','required',true),
    jsonb_build_object('key','kj_011','label','Ansatte er opplært i bruk av SDS og kjemikaliesikkerhet','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_012','label','Substitusjonsplikt vurdert — kan farlig stoff erstattes?','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',false)
  ));
  v_ergo jsonb := jsonb_build_object('title', 'Ergonomi og kontorarbeidsplass', 'items', jsonb_build_array(
    jsonb_build_object('key','er_001','label','Stol er justerbar og støtter ryggrad korrekt','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften / AML § 4-4','required',true),
    jsonb_build_object('key','er_002','label','Skjerm er plassert i armslengde og øvre kant i øyehøyde','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften § 4','required',true),
    jsonb_build_object('key','er_003','label','Tastatur og mus er plassert slik at underarmene hviler horisontalt','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften','required',true),
    jsonb_build_object('key','er_004','label','Det finnes heve-/senkebord eller alternativ tilrettelegging','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','er_005','label','Ansatte tar mikro-pauser og varierer stilling','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','er_006','label','Belysning er jevn; ingen sjenerende reflekser på skjerm','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',true),
    jsonb_build_object('key','er_007','label','Hodehøyde på headset / telefon forhindrer nakkestress','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','er_008','label','Gjentakelsesarbeid (scanning, pakking) er rotert eller variert','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','er_009','label','Tunge løft: maksimalt 25 kg; hjelpemidler tilgjengelig','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',true),
    jsonb_build_object('key','er_010','label','Ansatte med behov har fått ergonomisk tilrettelegging dokumentert','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4 / Diskriminerings- og tilgjengelighetsloven','required',false)
  ));
begin
  if not exists (select 1 from public.inspection_templates where organization_id is null and name = 'Standard HMS-vernerunde') then
    insert into public.inspection_templates (organization_id, name, checklist_definition, is_active)
    values (null, 'Standard HMS-vernerunde', v_std, true);
  end if;
  if not exists (select 1 from public.inspection_templates where organization_id is null and name = 'Brannsikkerhet og rømning') then
    insert into public.inspection_templates (organization_id, name, checklist_definition, is_active)
    values (null, 'Brannsikkerhet og rømning', v_brann, true);
  end if;
  if not exists (select 1 from public.inspection_templates where organization_id is null and name = 'Kjemikalie- og stoffhåndtering') then
    insert into public.inspection_templates (organization_id, name, checklist_definition, is_active)
    values (null, 'Kjemikalie- og stoffhåndtering', v_kjem, true);
  end if;
  if not exists (select 1 from public.inspection_templates where organization_id is null and name = 'Ergonomi og kontorarbeidsplass') then
    insert into public.inspection_templates (organization_id, name, checklist_definition, is_active)
    values (null, 'Ergonomi og kontorarbeidsplass', v_ergo, true);
  end if;
end;
$$;
