// A1 — befaringsløypa: romtaksonomi og adaptiv huskeliste.
// Taksonomien bruker standardens egne kategorier (jf. NS 3600/Befar-analysen):
// «Rom under terreng» er vannskadenes faktiske geografi, og de tekniske
// kategoriene (etasjeskille, loft/tak, utvendig) er kontrollpunkter, ikke rom.

import { Project } from './types';

/** Hurtigvalg når takstpersonen legger til rom — dekker vanlige skadesaker. */
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
  'Loft/takkonstruksjon',
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

export function roomNameById(project: Project | null | undefined, roomId?: string): string | null {
  if (!project || !roomId) return null;
  const room = (project.rooms || []).find((r) => r.id === roomId);
  return room ? room.name : null;
}
