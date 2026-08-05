// kartverket.ts – kartutsnitt uten avhengigheter: én WMTS-flis (Kartverket
// topo/webmercator, proxyet gjennom vårt API) + markørposisjon som brøk
// innenfor flisen. Proxyen gjør at klienten aldri kaller tredjepart direkte.

import { getApiBaseUrl } from '@/src/config/api';

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
    url: `${getApiBaseUrl()}/api/flis/${zoom}/${tileY}/${tileX}`,
    fx: x - tileX,
    fy: y - tileY,
  };
}
