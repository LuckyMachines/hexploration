const ENV = typeof import.meta !== 'undefined' ? import.meta.env || {} : {};
const PROCESS_ENV = typeof process !== 'undefined' ? process.env || {} : {};

export const LIVE_PLAY_URL = ENV.VITE_LIVE_PLAY_URL
  || PROCESS_ENV.VITE_LIVE_PLAY_URL
  || 'https://play.xenovoya.com';

export function internalToolsEnabled() {
  return String(ENV.VITE_ENABLE_INTERNAL_TOOLS || PROCESS_ENV.VITE_ENABLE_INTERNAL_TOOLS || '').toLowerCase() === 'true';
}
