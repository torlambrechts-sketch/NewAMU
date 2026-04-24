-- Make inspection_templates support global (system) templates with organization_id = NULL.
-- Global templates are visible to all organizations but cannot be modified by org users.
-- Per-org templates remain org-scoped as before.

-- 1. Drop NOT NULL constraint so organization_id can be NULL for global templates.
alter table public.inspection_templates
  alter column organization_id drop not null;

-- 2. Drop old FK and re-add as nullable.
alter table public.inspection_templates
  drop constraint if exists inspection_templates_organization_id_fkey;
alter table public.inspection_templates
  add constraint inspection_templates_organization_id_fkey
  foreign key (organization_id) references public.organizations (id) on delete cascade;

-- 3. Update RLS: allow reading global (NULL) templates alongside org-scoped ones.
drop policy if exists "inspection_templates_select_org" on public.inspection_templates;
create policy "inspection_templates_select_org"
  on public.inspection_templates for select
  using (
    organization_id is null
    or organization_id = public.current_org_id()
  );

-- Write policy: users can only write org-scoped templates (not global ones).
drop policy if exists "inspection_templates_write_org" on public.inspection_templates;
create policy "inspection_templates_write_org"
  on public.inspection_templates for all
  using (organization_id = public.current_org_id())
  with check (organization_id = public.current_org_id());

-- 4. Seed 4 global HMS templates (organization_id = NULL).
--    Safe to re-run: checks by name before inserting.

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
    jsonb_build_object('key','e_002','label','Skjermarbeidsplass: skjerm, tastatur og mus er korrekt plassert','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften § 4','required',true,'helpText','Skjerm på armslengde, øvre kant i øyehøyde. Tastatur foran skjerm.'),
    jsonb_build_object('key','e_003','label','Tunge løft håndteres med hjelpemidler eller er under 25 kg','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',true),
    jsonb_build_object('key','e_004','label','Arbeidsstillinger varieres; pauser tas regelmessig','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','e_005','label','Hjelpemidler for manuell håndtering er tilgjengelige og i god stand','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','p_001','label','Arbeidsbelastning og tidsfrister er rimelige og forsvarlige','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',true,'helpText','Kartlegg tegn på stress, overbelastning eller ubalanse i arbeidsmengde.'),
    jsonb_build_object('key','p_002','label','Det er ingen kjente tegn til mobbing, trakassering eller konflikter','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',true),
    jsonb_build_object('key','p_003','label','Ansatte vet hva som forventes — klare arbeidsoppgaver og mål','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',false),
    jsonb_build_object('key','p_004','label','Pauserom og sosiale fasiliteter er tilgjengelige og vedlikeholdt','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',false,'helpText','Spiserom, kjøleskap, kaffekjøkken, garderobe.'),
    jsonb_build_object('key','p_005','label','Ansatte kan ta opp problemer med nærmeste leder uten frykt','fieldType','yes_no_na','hmsCategory','psykososialt','lawRef','AML § 4-3','required',false),
    jsonb_build_object('key','k_001','label','Stoffkartotek er oppdatert og tilgjengelig for alle ansatte','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','Stoffkartotekforskriften § 5','required',true,'helpText','Digitalt eller fysisk register. Alle kjemikalier som brukes skal være listet.'),
    jsonb_build_object('key','k_002','label','Sikkerhetsdatablad (SDS) foreligger for alle kjemikalier på arbeidsplassen','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5 / REACH','required',true),
    jsonb_build_object('key','k_003','label','Alle kjemikaliebeholdere er tydelig merket med GHS-piktogram','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','CLP-forordningen','required',true),
    jsonb_build_object('key','k_004','label','Kjemikalier er oppbevart korrekt — adskilt etter fareklasse','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true,'helpText','Brennbare stoffer adskilt fra oksiderende. Kjemikalieskap der krav foreligger.'),
    jsonb_build_object('key','k_005','label','Riktig verneutstyr for kjemikaliehåndtering er tilgjengelig og i bruk','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true,'helpText','Hansker, vernebriller, åndedrettsvern etter SDS-krav.'),
    jsonb_build_object('key','b_001','label','Brannslokkere er synlig plassert og innen kontrolldato','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 11-4','required',true,'helpText','Kontroller godkjenningsskilt og dato for siste service.'),
    jsonb_build_object('key','b_002','label','Brannalarm er testet og fungerer','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften','required',true),
    jsonb_build_object('key','b_003','label','Rømningsveier er fri og nødlysskilter fungerer','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brann- og eksplosjonsvernloven § 7','required',true),
    jsonb_build_object('key','b_004','label','Evakueringsplan er oppdatert og oppslått ved alle utganger','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften','required',true),
    jsonb_build_object('key','b_005','label','Brannøvelse er gjennomført siste 12 måneder','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brann- og eksplosjonsvernloven § 11','required',true,'helpText','Minst én fullstendig evakueringsøvelse per år.'),
    jsonb_build_object('key','m_001','label','Maskiner har CE-merking og bruksanvisning tilgjengelig','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','Arbeidsutstyrsforskriften § 10','required',true),
    jsonb_build_object('key','m_002','label','Verneutstyr (gitter, skjermer) er montert og fullt funksjonelt','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','Arbeidsutstyrsforskriften § 4','required',true),
    jsonb_build_object('key','m_003','label','Nødstopp er tilgjengelig, merket og testet','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','Maskindirektivet','required',true),
    jsonb_build_object('key','m_004','label','Vedlikeholdslogg er ført og vedlikehold gjennomført etter plan','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','AML § 4-2','required',false),
    jsonb_build_object('key','m_005','label','Operatører er opplært og autorisert på aktuelt utstyr','fieldType','yes_no_na','hmsCategory','maskiner','lawRef','AML § 4-2','required',true,'helpText','Opplæringen skal være dokumentert.'),
    jsonb_build_object('key','a_001','label','Avvik fra forrige vernerunde er lukket eller fulgt opp','fieldType','yes_no_na','hmsCategory','annet','lawRef','IK-forskriften § 5','required',true,'helpText','Gjennomgå protokoll fra forrige runde og sjekk status på avvikene.'),
    jsonb_build_object('key','a_002','label','Arbeidsplassen er ryddig og avfall sorteres korrekt','fieldType','yes_no_na','hmsCategory','annet','lawRef','IK-forskriften','required',false),
    jsonb_build_object('key','a_003','label','Kommentarer / observasjoner fra ansatte','fieldType','text','hmsCategory','annet','lawRef','AML § 3-1','required',false,'helpText','Skriv inn eventuelle tilbakemeldinger fra ansatte under runden.')
  ));

  v_brann jsonb := jsonb_build_object('title', 'Brannsikkerhet og rømning', 'items', jsonb_build_array(
    jsonb_build_object('key','br_001','label','Bygget er korrekt brannklassifisert; klasse og brannbelastning kjent','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brann- og eksplosjonsvernloven § 4','required',true),
    jsonb_build_object('key','br_002','label','Sprinkleranlegg er installert der krav foreligger og er i drift','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften § 11-5','required',true),
    jsonb_build_object('key','br_003','label','Alle brannslokkere er sjekket av autorisert firma siste år','fieldType','yes_no_na','hmsCategory','brann','lawRef','Brannforskriften','required',true,'helpText','Kontroller inspeksjonsmerkeder og dokumentasjon.'),
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
    jsonb_build_object('key','kj_002','label','SDS (sikkerhetsdatablad) foreligger for hvert kjemikalie på arbeidsstedet','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','Stoffkartotekforskriften / REACH','required',true,'helpText','SDS skal være på norsk eller engelsk og maksimalt 3 år gammelt.'),
    jsonb_build_object('key','kj_003','label','Alle beholdere er merket med produktnavn og GHS-piktogram','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','CLP-forordningen (GHS)','required',true),
    jsonb_build_object('key','kj_004','label','Kjemikalier er adskilt etter fareklasse i godkjent oppbevaring','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true,'helpText','Brennbare adskilt fra oksiderende. Syrer adskilt fra baser.'),
    jsonb_build_object('key','kj_005','label','Kjemikalieskapet er ventilert og låsbart','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_006','label','Ventilasjon/avtrekk er funksjonelt der kjemikalier brukes','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_007','label','Verneutstyr (hansker, briller, forkle) er tilgjengelig og korrekt type','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true,'helpText','Verneutstyr skal tilfredsstille krav i aktuelt SDS.'),
    jsonb_build_object('key','kj_008','label','Øyeskylleflasker og nødusj er tilgjengelig og innen holdbarhet','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_009','label','Spill- og absorpsjonsmidler er tilgjengelig ved oppbevaringssted','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true),
    jsonb_build_object('key','kj_010','label','Kjemikalieavfall klassifiseres og leveres godkjent mottak','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','Avfallsforskriften','required',true),
    jsonb_build_object('key','kj_011','label','Ansatte er opplært i bruk av SDS og kjemikaliesikkerhet','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5','required',true,'helpText','Opplæringen skal dokumenteres i opplæringsprotokoll.'),
    jsonb_build_object('key','kj_012','label','Substitusjonsplikt vurdert — kan farlig stoff erstattes?','fieldType','yes_no_na','hmsCategory','kjemikalier','lawRef','AML § 4-5 (substitusjonsprinsippet)','required',false,'helpText','Arbeidsgiver skal vurdere om farlige kjemikalier kan erstattes med mindre farlige alternativer.')
  ));

  v_ergo jsonb := jsonb_build_object('title', 'Ergonomi og kontorarbeidsplass', 'items', jsonb_build_array(
    jsonb_build_object('key','er_001','label','Stol er justerbar og støtter ryggrad korrekt','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften / AML § 4-4','required',true,'helpText','Setet skal ha justerbar høyde, ryggstøtte og armlener.'),
    jsonb_build_object('key','er_002','label','Skjerm er plassert i armslengde og øvre kant i øyehøyde','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften § 4','required',true),
    jsonb_build_object('key','er_003','label','Tastatur og mus er plassert slik at underarmene hviler horisontalt','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','Bildeskjermforskriften','required',true),
    jsonb_build_object('key','er_004','label','Det finnes heve-/senkebord eller alternativ tilrettelegging','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','er_005','label','Ansatte tar mikro-pauser og varierer stilling','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false,'helpText','Anbefalt: 5 min pause per time ved skjermarbeid. Blunkeøvelser, strekk.'),
    jsonb_build_object('key','er_006','label','Belysning er jevn; ingen sjenerende reflekser på skjerm','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',true,'helpText','Bruk persienner / gardin for å redusere glans fra vinduer.'),
    jsonb_build_object('key','er_007','label','Hodehøyde på headset / telefon forhindrer nakkestress','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','er_008','label','Gjentakelsesarbeid (scanning, pakking) er rotert eller variert','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',false),
    jsonb_build_object('key','er_009','label','Tunge løft: maksimalt 25 kg; hjelpemidler tilgjengelig','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4','required',true),
    jsonb_build_object('key','er_010','label','Ansatte med behov har fått ergonomisk tilrettelegging dokumentert','fieldType','yes_no_na','hmsCategory','ergonomi','lawRef','AML § 4-4 / Diskriminerings- og tilgjengelighetsloven','required',false,'helpText','Tilrettelegging skal skje i samråd med ansatt og ev. BHT.')
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
