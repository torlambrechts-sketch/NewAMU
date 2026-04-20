-- ROS: expand global (organization_id IS NULL) template library with sector-specific hazard stubs.
-- Architecture matches 20260726120000_ros_global_templates.sql: public.ros_templates + definition.hazard_stubs
-- (there is no separate ros_template_hazards table — stubs live in JSONB).

do $$
declare
  v_workshop jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object(
        'description', 'Klemfare ved bruk av maskiner og produksjonsutstyr',
        'category_code', 'sys_machinery',
        'law_domain', 'AML',
        'existing_controls', 'Typisk risikoprofil: alvorlig konsekvens ved klemskade, middels sannsynlighet uten vern og opplæring — vurder i ROS-matrisen og dokumenter barrierer (f.eks. vern, stopp, LOTO).'
      ),
      jsonb_build_object(
        'description', 'Eksponering for sveiserøyk og støv (helsefare over tid)',
        'category_code', 'sys_chemical_bio',
        'law_domain', 'AML',
        'existing_controls', 'Krever kartlegging av stoffer, lokavsug/rensesystem og helseundersøkelser i henhold til internkontroll og forskrifter for farlige stoffer.'
      ),
      jsonb_build_object(
        'description', 'Støybelastning fra maskinpark (risiko for hørselsskade)',
        'category_code', 'sys_physical',
        'law_domain', 'AML',
        'existing_controls', 'Mål støynivåer, vurder hørselvern, skjerming og rotasjon i støyutsatte arbeider (AML kap. 4).'
      ),
      jsonb_build_object(
        'description', 'Utslipp av olje og kjemikalier til gulv (fallfare og miljø)',
        'category_code', 'sys_chemical_bio',
        'law_domain', 'AML',
        'existing_controls', 'Vurder sølvern, opptak, merking, avfallshåndtering og glatte flater som gir økt fallrisiko — se også miljøkrav for avløp og lagring.'
      )
    )
  );

  v_healthcare jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object(
        'description', 'Tunge løft og ugunstige arbeidsstillinger (belastningsskade)',
        'category_code', 'sys_ergonomic',
        'law_domain', 'AML',
        'existing_controls', 'Vurder hjelpemidler, arbeidsstillinger, pauser og opplæring i manuell håndtering (AML § 4-4, forskrift om utførelse av arbeid).'
      ),
      jsonb_build_object(
        'description', 'Vold og utagerende oppførsel fra brukere (psykisk og fysisk skade)',
        'category_code', 'sys_psych_org',
        'law_domain', 'AML',
        'existing_controls', 'Kartlegg risiko, rutiner for varsling, trygghetsteam og opplæring i konflikthåndtering; vurder fysiske tiltak og samarbeid med verneombud.'
      ),
      jsonb_build_object(
        'description', 'Smittefare ved håndtering av biologisk materiale',
        'category_code', 'sys_chemical_bio',
        'law_domain', 'AML',
        'existing_controls', 'Følg smittevernrutiner, personlig verneutstyr, håndhygiene og avfallsrutiner i tråd med helsefaglige retningslinjer og internkontroll.'
      ),
      jsonb_build_object(
        'description', 'Sekundærtraumatisering og psykisk utmattelse hos ansatte',
        'category_code', 'sys_psych_org',
        'law_domain', 'AML',
        'existing_controls', 'Vurder arbeidsbelastning, debriefing, veiledning og tilgang til helsetjenester; dokumenter i ROS og handlingsplan (psykososialt arbeidsmiljø).'
      )
    )
  );

  v_logistics jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object(
        'description', 'Påkjørsler og sammenstøt ved truckkjøring og intern transport',
        'category_code', 'sys_accidents_external',
        'law_domain', 'AML',
        'existing_controls', 'Kritisk risiko ved kryssende trafikk — skilting, kjøreruter, synlighet, truckførerbevis og sikker adferd må vurderes særskilt i ROS.'
      ),
      jsonb_build_object(
        'description', 'Fallende gjenstander fra reolsystemer og lagringsløsninger',
        'category_code', 'sys_machinery',
        'law_domain', 'AML',
        'existing_controls', 'Kontroller belastning, sikring, lastsikring og vedlikehold av reoler i henhold til leverandørs krav og internkontroll.'
      ),
      jsonb_build_object(
        'description', 'Utslipp og eksponering ved håndtering av farlig gods ved lasting og lossing',
        'category_code', 'sys_chemical_bio',
        'law_domain', 'AML',
        'existing_controls', 'ADR, sikkerhetsdatablad, verneutstyr og beredskap ved søl — koordiner med transportør og mottak.'
      ),
      jsonb_build_object(
        'description', 'Trafikkulykker under transportoppdrag på vei',
        'category_code', 'sys_accidents_external',
        'law_domain', 'AML',
        'existing_controls', 'Kjøretøytilstand, kjøretid, vær, last og kjøre- og hviletidsbestemmelser skal inn i risikovurderingen.'
      )
    )
  );

  v_construction jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object(
        'description', 'Fall fra høyde ved arbeid på stillas, tak og overkant (dødsrisiko)',
        'category_code', 'sys_accidents_external',
        'law_domain', 'AML',
        'existing_controls', 'Fallvern, opplæring, verneutstyr og sikring av arbeidsområde iht. forskrift om utførelse av arbeid og leverandørs krav til stillas.'
      ),
      jsonb_build_object(
        'description', 'Graving og grunnarbeid med risiko for ras og kollaps',
        'category_code', 'sys_accidents_external',
        'law_domain', 'AML',
        'existing_controls', 'Geoteknisk vurdering, sikring av grøft, avstand til bygg og koordinering mot andre aktører (SHA-plan).'
      ),
      jsonb_build_object(
        'description', 'Bruk av farlig verktøy og sagutstyr (kutt, spark, kast)',
        'category_code', 'sys_machinery',
        'law_domain', 'AML',
        'existing_controls', 'Sikker bruk av arbeidsutstyr, vern, opplæring og kontroll av verktøy i henhold til arbeidsutstyrsforskriften.'
      ),
      jsonb_build_object(
        'description', 'Strømgjennomgang og elektrisk fare ved provisoriske anlegg',
        'category_code', 'sys_machinery',
        'law_domain', 'ETL',
        'existing_controls', 'Kvalifisert personell, låsbar tavle, jordfeilbryter og oppdaterte tegninger; følg krav i forskrift om elektriske lavspenningsanlegg.'
      )
    )
  );

  v_cleaning jsonb := jsonb_build_object(
    'version', 1,
    'hazard_stubs', jsonb_build_array(
      jsonb_build_object(
        'description', 'Eksponering for sterke vaskemidler (hud og luftveier)',
        'category_code', 'sys_chemical_bio',
        'law_domain', 'AML',
        'existing_controls', 'Sikkerhetsdatablad, fortynningsgrad, verneutstyr og ventilasjon; opplæring i sikker håndtering av kjemikalier.'
      ),
      jsonb_build_object(
        'description', 'Repeterende bevegelser i armer og skuldre ved ergonomisk belastende arbeid',
        'category_code', 'sys_ergonomic',
        'law_domain', 'AML',
        'existing_controls', 'Vurder arbeidsutstyr, høydejustering, mikropauser og rotasjon mellom oppgaver.'
      ),
      jsonb_build_object(
        'description', 'Alenearbeid i tomme bygg (trygghetsfølelse og varsling)',
        'category_code', 'sys_psych_org',
        'law_domain', 'AML',
        'existing_controls', 'Rutiner for innlåsning, nødnummer, periodisk kontakt og risikovurdering av sted og tidspunkt.'
      )
    )
  );
begin
  if not exists (select 1 from public.ros_templates where organization_id is null and deleted_at is null and name = 'Verksted og industri') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Verksted og industri', v_workshop, true);
  end if;

  if not exists (select 1 from public.ros_templates where organization_id is null and deleted_at is null and name = 'Helse, omsorg og sosiale tjenester') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Helse, omsorg og sosiale tjenester', v_healthcare, true);
  end if;

  if not exists (select 1 from public.ros_templates where organization_id is null and deleted_at is null and name = 'Transport, lager og logistikk') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Transport, lager og logistikk', v_logistics, true);
  end if;

  if not exists (select 1 from public.ros_templates where organization_id is null and deleted_at is null and name = 'Bygg og anlegg (grovmaskert)') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Bygg og anlegg (grovmaskert)', v_construction, true);
  end if;

  if not exists (select 1 from public.ros_templates where organization_id is null and deleted_at is null and name = 'Renholdsvirksomhet') then
    insert into public.ros_templates (organization_id, name, definition, is_active)
    values (null, 'Renholdsvirksomhet', v_cleaning, true);
  end if;
end;
$$;
