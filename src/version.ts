/**
 * App version, injected at build time from package.json.
 *
 * Scheme: decimal minor steps — 0.01, 0.02 … 0.09, 0.1 … 0.5, 1.0.
 * `npm run release -- bump` moves one step; `-- set 0.5` jumps.
 */
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';

export function versionLabel(version: string = APP_VERSION): string {
  return `v${version}`;
}
