// kartverket.ts – kartutsnitt uten avhengigheter: én WMTS-flis fra Kartverkets
// åpne cache (topo/webmercator) + markørposisjon som brøk innenfor flisen.

export type TilePin = {
  url: string;
  /** Markørens posisjon i flisen, 0–1 fra venstre/topp. */
  fx: number;
  fy: number;
};

export function tileForCoordinate(lat: number, lon: number, zoom = 16): TilePin {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const tileX = Math.floor(x);
  const tileY = Math.floor(y);
  return {
    url: `https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/${zoom}/${tileY}/${tileX}.png`,
    fx: x - tileX,
    fy: y - tileY,
  };
}
