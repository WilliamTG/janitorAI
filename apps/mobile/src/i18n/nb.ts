// Norsk bokmål — all brukersynlig tekst i appen hentes herfra (backlog B2).
// Nøkler er gruppert per flate. Backend-verdier (statuskoder, feltnavn) oversettes
// ved visning, aldri ved lagring.

export const nb = {
  common: {
    appName: 'DocrAI',
    ok: 'OK',
    cancel: 'Avbryt',
    save: 'Lagre',
    delete: 'Slett',
    retry: 'Prøv igjen',
    close: 'Lukk',
    back: 'Tilbake',
    next: 'Neste',
    done: 'Ferdig',
    open: 'Åpne',
    search: 'Søk',
    loadingEllipsis: 'Laster …',
    error: 'Noe gikk galt',
  },

  tabs: {
    home: 'Prosjekter',
    guide: 'Guide',
  },

  sync: {
    idle: 'Skysynk',
    syncing: 'Synkroniserer …',
    synced: 'Lagret i skyen',
    offline: 'Venter på nett — lagret lokalt',
    error: 'Synkfeil',
    disabled: 'Lagret på enheten',
    mediaNotSynced: 'Medier ikke synkronisert',
    syncNow: 'Synkroniser nå',
  },

  status: {
    draft: 'Utkast',
    processing: 'Behandler …',
    ready: 'Klar',
    failed: 'Feilet',
  },

  projects: {
    title: 'Prosjekter',
    subtitle: 'Befaringer og skadesaker',
    empty: 'Ingen prosjekter ennå',
    emptyHint: 'Opprett et prosjekt for å starte en befaring.',
    newProject: 'Nytt prosjekt',
    searchPlaceholder: 'Søk i prosjekter',
    filterAll: 'Alle',
    inspectorLabel: 'Takstperson',
    createdLabel: 'Opprettet',
    openProject: 'Åpne prosjekt',
    notesCount: 'notater',
    photosCount: 'bilder',
    audioCount: 'lydklipp',
    deleteTitle: 'Slette prosjektet?',
    deleteMessage: (name: string) =>
      `«${name}» og alle notater, bilder og opptak slettes. Dette kan ikke angres.`,
    deleteConfirm: 'Slett prosjektet',
    deleted: 'Prosjektet ble slettet',
    duplicateName: 'Et prosjekt har allerede dette navnet',
    nameLabel: 'Prosjektnavn',
    namePlaceholder: 'F.eks. Solbergveien 14, Rykkinn',
    nameFromAddressHint: 'Tips: bruk adressen som prosjektnavn',
    useAddress: 'Bruk adressen',
    projectMenu: 'Prosjektmeny',
  },

  detail: {
    notesTab: 'Notater',
    reportTab: 'Rapport',
    audioNote: 'Lydnotat',
    photo: 'Bilde',
    video: 'Video',
    stopRecording: 'Stopp opptak',
    recording: 'Tar opp …',
    seeReport: 'Se rapport',
    saveNote: 'Lagre notat',
    notePlaceholder: 'Skriv et notat …',
    play: 'Spill av',
    stop: 'Stopp',
    transcribing: 'Transkriberer …',
    transcriptionReady: 'Transkripsjon klar',
    transcriptionFailed: 'Transkripsjonen feilet',
    uploaded: 'Lastet opp',
    uploading: 'Laster opp …',
    deleteNoteTitle: 'Slette notatet?',
    deleteNoteMessage: 'Notatet og tilhørende medier slettes. Dette kan ikke angres.',
    photoAdded: 'Bilde lagt til',
    videoAdded: 'Video lagt til',
    audioSaved: 'Lydnotat lagret',
    noteSaved: 'Notat lagret',
    takePhoto: 'Ta bilde',
    chooseFromLibrary: 'Velg fra biblioteket',
    recordVideo: 'Ta opp video',
    chooseVideo: 'Velg video',
    mediaSourceTitle: 'Legg til bilde',
    videoSourceTitle: 'Legg til video',
    loadingVideo: 'Laster video …',
    description: 'Prosjektbeskrivelse',
    descriptionPlaceholder: 'Beskriv befaringen kort …',
  },

  report: {
    generate: 'Lag rapport',
    generating: 'Lager rapport …',
    generatingSteps: ['Analyserer video', 'Transkriberer tale', 'Vurderer skade', 'Skriver rapport'],
    ready: 'Rapporten er klar',
    failed: 'Rapportgenereringen feilet',
    openReport: 'Åpne rapporten',
    downloadPdf: 'Last ned PDF',
    downloadWord: 'Last ned Word',
    requiresVideo: 'Rapporten trenger minst én video fra befaringen.',
    details: 'Rapportdetaljer',
    approvedBy: 'Godkjent av takstperson',
  },

  auth: {
    accessTitle: 'Tilgangskode',
    accessMessage: 'Skriv inn tilgangskoden fra DocrAI',
    accessPlaceholder: 'Tilgangskode',
    accessSave: 'Lagre kode',
    accessMissing: 'Du må oppgi en tilgangskode for å synkronisere.',
  },

  guide: {
    title: 'Slik fungerer DocrAI',
    profileTitle: 'Takstperson',
    nameLabel: 'Navn',
    phoneLabel: 'Telefon',
    companyLabel: 'Firma',
  },
} as const;

// dd.mm.åååå (B2: norske datoformater)
export function formatDate(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export function formatTime(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mi}`;
}

export function formatDateTime(input: Date | string | number): string {
  const date = formatDate(input);
  const time = formatTime(input);
  return date && time ? `${date} kl. ${time}` : date;
}
