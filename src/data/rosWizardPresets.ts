import type { RosWorkspaceCategory } from '../types/internalControl'

export type RosPresetHazard = {
  activity: string
  hazard: string
  existingControls: string
}

/** Vanlige farer per arbeidsområde — brukes i ROS-veiviseren */
export const ROS_WORKSPACE_PRESET_HAZARDS: Record<RosWorkspaceCategory, RosPresetHazard[]> = {
  general: [
    { activity: 'Generelt', hazard: 'Ukjente farer ved nye arbeidsoppgaver', existingControls: 'Opplæring, SJA ved endring' },
    { activity: 'Generelt', hazard: 'Mangelfull informasjon om risiko', existingControls: 'ROS, vernerunder' },
    { activity: 'Generelt', hazard: 'Psykososial belastning (arbeidsmengde)', existingControls: 'Medvirkning, tilpasning' },
    { activity: 'Generelt', hazard: 'Ergonomi og skjermarbeid', existingControls: 'Pause, tilrettelegging' },
    { activity: 'Generelt', hazard: 'Brann og rømning', existingControls: 'Øvelser, merking' },
    { activity: 'Generelt', hazard: 'Elektrisk sikkerhet', existingControls: 'Sjekkliste, kompetanse' },
    { activity: 'Generelt', hazard: 'Fall og snubling', existingControls: 'Orden, belysning' },
    { activity: 'Generelt', hazard: 'Støy', existingControls: 'Verneutstyr, tiltak' },
    { activity: 'Generelt', hazard: 'Temperatur / inneklima', existingControls: 'Ventilasjon, tilpasning' },
    { activity: 'Generelt', hazard: 'Vold og trusler', existingControls: 'Rutiner, varsling' },
  ],
  production: [
    { activity: 'Produksjon', hazard: 'Innklemning og knusing i maskiner', existingControls: 'Verner, stopp, opplæring' },
    { activity: 'Produksjon', hazard: 'Skjærende verktøy og spåner', existingControls: 'Vernebriller, prosedyre' },
    { activity: 'Produksjon', hazard: 'Løft og ergonomi', existingControls: 'Løftehjelp, arbeidsstillinger' },
    { activity: 'Produksjon', hazard: 'Støy fra maskiner', existingControls: 'Øyevern, støydemping' },
    { activity: 'Produksjon', hazard: 'Eksponering for støv/damp', existingControls: 'Avsug, åndedrettsvern' },
    { activity: 'Produksjon', hazard: 'Elektrisk farlige anlegg', existingControls: 'Lås, kompetanse' },
    { activity: 'Produksjon', hazard: 'Gaffeltruck / intern transport', existingControls: 'Sertifikat, soner' },
    { activity: 'Produksjon', hazard: 'Vedlikehold under drift', existingControls: 'Loto, tillatelser' },
    { activity: 'Produksjon', hazard: 'Glatte gulv og oljesøl', existingControls: 'Rydding, merking' },
    { activity: 'Produksjon', hazard: 'Tunge løft mellom linjer', existingControls: 'Kran, teamløft' },
  ],
  office: [
    { activity: 'Kontor', hazard: 'Belastningsskader ved skjermarbeid', existingControls: 'Pause, ergonomi' },
    { activity: 'Kontor', hazard: 'Fall på trapper og gangveier', existingControls: 'Belysning, håndløper' },
    { activity: 'Kontor', hazard: 'Brann og rømning', existingControls: 'Øvelser, slukkeutstyr' },
    { activity: 'Kontor', hazard: 'Psykososial belastning', existingControls: 'Oppfølging, AMU' },
    { activity: 'Kontor', hazard: 'Elektrisk utstyr og kabler', existingControls: 'Sjekk, PAT' },
    { activity: 'Kontor', hazard: 'Innbrudd og trusler', existingControls: 'Adgang, rutiner' },
    { activity: 'Kontor', hazard: 'Møterom — trippelrisiko (CO₂, støy)', existingControls: 'Ventilasjon' },
    { activity: 'Kontor', hazard: 'Arbeid alene', existingControls: 'Oppfølgingsrutine' },
    { activity: 'Kontor', hazard: 'Renhold — kjemikalier', existingControls: 'Datasheet, opplæring' },
    { activity: 'Kontor', hazard: 'Arbeid hjemmefra (ergonomi)', existingControls: 'Veiledning, utstyr' },
  ],
  warehouse: [
    { activity: 'Lager', hazard: 'Fall fra høyde / reoler', existingControls: 'Fallutstyr, sikring' },
    { activity: 'Lager', hazard: 'Gaffeltruck og gående i samme sone', existingControls: 'Soner, skilting' },
    { activity: 'Lager', hazard: 'Fallende last', existingControls: 'Sikring, stabling' },
    { activity: 'Lager', hazard: 'Manuelle løft', existingControls: 'Truck, team' },
    { activity: 'Lager', hazard: 'Kjølerom / kulde', existingControls: 'Klær, tid' },
    { activity: 'Lager', hazard: 'Støv og partikler', existingControls: 'Avsug, maske' },
    { activity: 'Lager', hazard: 'Kollisjon kjøretøy', existingControls: 'Speil, fart' },
    { activity: 'Lager', hazard: 'Brann i emballasje', existingControls: 'Røykvarslere, slukking' },
    { activity: 'Lager', hazard: 'Kjemikalier på lager', existingControls: 'Klassifisering, ADR' },
    { activity: 'Lager', hazard: 'Orderplukk — tidspress', existingControls: 'Plan, bemanning' },
  ],
  construction: [
    { activity: 'Bygg/anlegg', hazard: 'Fall fra høyde', existingControls: 'Rekkverk, sele' },
    { activity: 'Bygg/anlegg', hazard: 'Sammenstyrtning / gravearbeid', existingControls: 'Sikring, fagkyndig' },
    { activity: 'Bygg/anlegg', hazard: 'Maskiner og anleggskjøretøy', existingControls: 'Soner, signalmann' },
    { activity: 'Bygg/anlegg', hazard: 'Støy og vibrasjon', existingControls: 'Verneutstyr, tid' },
    { activity: 'Bygg/anlegg', hazard: 'Støv (silika, tre)', existingControls: 'Våtskjæring, maske' },
    { activity: 'Bygg/anlegg', hazard: 'Elektrisk arbeid', existingControls: 'Autorisasjon, LOTO' },
    { activity: 'Bygg/anlegg', hazard: 'Løft og rigging', existingControls: 'Signaler, kapasitet' },
    { activity: 'Bygg/anlegg', hazard: 'Asbest og farlig avfall', existingControls: 'Kartlegging, entreprenør' },
    { activity: 'Bygg/anlegg', hazard: 'Trafikk og adkomst', existingControls: 'Skilting, vakter' },
    { activity: 'Bygg/anlegg', hazard: 'Vær og underlag', existingControls: 'Plan B, sikring' },
  ],
  healthcare: [
    { activity: 'Helse/omsorg', hazard: 'Smitte og hygiene', existingControls: 'Smittevernutstyr, rutiner' },
    { activity: 'Helse/omsorg', hazard: 'Vold og trusler fra brukere', existingControls: 'Varsling, team' },
    { activity: 'Helse/omsorg', hazard: 'Løft og forflytning', existingControls: 'Hjelpemidler, to personer' },
    { activity: 'Helse/omsorg', hazard: 'Medisiner og skarpe gjenstander', existingControls: 'Lås, prosedyre' },
    { activity: 'Helse/omsorg', hazard: 'Arbeidstid og vaktbelastning', existingControls: 'Hvile, bemanning' },
    { activity: 'Helse/omsorg', hazard: 'Kjemikalier og desinfeksjon', existingControls: 'SDS, opplæring' },
    { activity: 'Helse/omsorg', hazard: 'Ergonomi ved pasientarbeid', existingControls: 'Justerbare høyder' },
    { activity: 'Helse/omsorg', hazard: 'Psykososial belastning', existingControls: 'Debrief, BHT' },
    { activity: 'Helse/omsorg', hazard: 'Brann og rømning (sårbare)', existingControls: 'Øvelser, plan' },
    { activity: 'Helse/omsorg', hazard: 'Arbeid alene på vakt', existingControls: 'Nødalarmer, oppringing' },
  ],
}

/** Ekstra rad når bruker bekrefter kjemikalier (produksjon/lager) */
export const ROS_CHEMICAL_ROW_PRESET: RosPresetHazard = {
  activity: 'Kjemikalier',
  hazard: 'Eksponering og feilhåndtering av farlige kjemikalier',
  existingControls: 'SDS, verneutstyr, opplæring, lagring etter regelverk',
}

export const ROS_WORKSPACE_LABELS: Record<RosWorkspaceCategory, string> = {
  general: 'Generelt',
  production: 'Produksjon',
  office: 'Kontor',
  warehouse: 'Lager / logistikk',
  construction: 'Bygg / anlegg',
  healthcare: 'Helse / omsorg',
}
