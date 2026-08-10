/**
 * ids.ts – kryptografisk uforutsigbare identifikatorer for prosjekter, rom,
 * notater og foto.
 *
 * Sikkerhet (revisjon S14): tidligere ble IDer laget av `Date.now().toString()`.
 * Prosjekt-IDen er global primærnøkkel på tvers av testere på serveren, så
 * forutsigbare millisekund-stempler lot en tester «okkupere» eller kollidere med
 * andres IDer. UUID-er fjerner både kollisjonsrisikoen (samme millisekund) og
 * gjettbarheten.
 */

/** Returner en UUID v4. Bruker web-/RN-crypto når tilgjengelig, ellers en
 *  getRandomValues-basert reserve. Aldri Math.random for IDer. */
export function newId(): string {
  const c: Crypto | undefined =
    typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    // Siste utvei (bør ikke inntreffe i Expo/RN): tidsstempel + tilfeldighet,
    // fortsatt unikt nok til å unngå kollisjon i praksis.
    const seed = Date.now();
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (seed >>> (i % 4) * 8) ^ Math.floor(Math.random() * 256);
    }
  }
  // Sett versjon (4) og variant-bit slik en gyldig UUID v4 krever.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}
