// A1 — befaringsløypa: romtaksonomi og adaptiv huskeliste.
// Taksonomien bruker standardens egne kategorier (jf. NS 3600/Befar-analysen):
// «Rom under terreng» er vannskadenes faktiske geografi, og de tekniske
// kategoriene (etasjeskille, loft/tak, utvendig) er kontrollpunkter, ikke rom.

import { Project } from './types';

/** Hurtigvalg når takstpersonen legger til rom — dekker vanlige skadesaker.
 * Fullfører Befar-taksonomien: de tekniske kategoriene (etasjeskille,
 * tekniske installasjoner) er kontrollpunkter, ikke rom — men de er der
 * vannskadene faktisk bor. */
export const ROOM_SUGGESTIONS = [
  'Kjeller bad',
  'Bad',
  'Vaskerom',
  'Kjøkken',
  'Kjeller gang',
  'Rom under terreng',
  'Stue',
  'Soverom',
  'Bod',
  'Etasjeskille',
  'Loft/takkonstruksjon',
  'Tekniske installasjoner',
  'Utvendig',
] as const;

/** Våtrom styrer både huskelisten og Byggforsk-delsettet AI-en siterer fra. */
export function isWetRoom(name: string): boolean {
  return /bad|vaskerom|våtrom|wc|dusj/i.test(name);
}

/**
 * Huskeliste for våtrom (Befar-mønsteret: sjekklisten i synsfeltet mens man
 * vurderer). Statisk påminnelse — appen påstår ikke at punktene er dekket.
 */
export const WET_ROOM_CHECKLIST = [
  'Sluk og klemring — nærbilde',
  'Membran/overgang gulv–vegg',
  'Fuktmåling med avlest verdi (si verdien høyt i opptaket)',
  'Oversiktsbilde av hele rommet',
] as const;

/**
 * Adaptiv huskeliste per romkategori — Befar-mønsteret generalisert fra
 * våtrom til hele taksonomien. Punktene er fangst-instrukser (foto/tale),
 * ikke tilstandsvurderinger: appen bærer sjekklisten, fagpersonen vurderer.
 * Rekkefølgen avgjør ved flertreff («Kjeller bad» treffer våtrom først).
 */
const ROOM_CHECKLISTS: { match: RegExp; title: string; items: readonly string[] }[] = [
  {
    match: /bad|vaskerom|våtrom|wc|dusj/i,
    title: 'Huskeliste — våtrom',
    items: WET_ROOM_CHECKLIST,
  },
  {
    match: /kjeller|under terreng/i,
    title: 'Huskeliste — rom under terreng',
    items: [
      'Fukt/saltutslag på grunnmur — nærbilde',
      'Overgang gulv–vegg langs yttervegg',
      'Sluk/drenering — plassering og tilstand',
      'Fuktmåling med avlest verdi (si verdien høyt i opptaket)',
      'Oversiktsbilde av hele rommet',
    ],
  },
  {
    match: /loft|takkonstruksjon/i,
    title: 'Huskeliste — loft/takkonstruksjon',
    items: [
      'Undertak/taktro — misfarging eller fuktskjolder',
      'Gjennomføringer (pipe, ventilasjon) — nærbilde',
      'Isolasjon og lufting ved raft',
      'Fuktmåling i treverk med avlest verdi',
    ],
  },
  {
    match: /utvendig|fasade|tak\b/i,
    title: 'Huskeliste — utvendig',
    items: [
      'Tak, takrenner og nedløp ved skadested',
      'Terrengfall inn mot grunnmur',
      'Kledning/fasade — nærbilde av skadested',
      'Vinduer og dører — beslag og fuger',
    ],
  },
  {
    match: /kjøkken/i,
    title: 'Huskeliste — kjøkken',
    items: [
      'Under kjøkkenbenk/vask — rør og koblinger, nærbilde',
      'Lekkasjesikring/vannstoppventil — finnes den?',
      'Gulv foran oppvaskmaskin og kjøleskap',
      'Fuktmåling ved mistanke — si verdien høyt i opptaket',
    ],
  },
  {
    match: /etasjeskille/i,
    title: 'Huskeliste — etasjeskille',
    items: [
      'Himling under skadested — misfarging/nedbøying',
      'Gjennomføringer (rør, sluk) sett ovenfra',
      'Fuktmåling på begge sider av skillet',
    ],
  },
  {
    match: /teknisk/i,
    title: 'Huskeliste — tekniske installasjoner',
    items: [
      'Varmtvannsbereder — alder, plassering, lekkasjespor',
      'Rør-i-rør-skap/fordelerskap — nærbilde',
      'Stoppekran — plassering og funksjon (nevn i opptaket)',
    ],
  },
];

/** Finn huskelisten for et rom — null når kategorien ikke har egen liste. */
export function checklistForRoom(
  name: string,
): { title: string; items: readonly string[] } | null {
  const hit = ROOM_CHECKLISTS.find((c) => c.match.test(name));
  return hit ? { title: hit.title, items: hit.items } : null;
}

export function roomNameById(project: Project | null | undefined, roomId?: string): string | null {
  if (!project || !roomId) return null;
  const room = (project.rooms || []).find((r) => r.id === roomId);
  return room ? room.name : null;
}
