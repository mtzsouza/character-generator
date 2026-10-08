// App settings shared by the generator and the chat tab. Stored per browser in
// localStorage; the chat receives the duration through its session payload.

const SESSION_MINUTES_STORAGE = 'sessionMinutes';

export const DEFAULT_SESSION_MINUTES = 45;
export const MAX_SESSION_MINUTES = 180;

export function getSessionMinutes(){
  let stored;
  try { stored = localStorage.getItem(SESSION_MINUTES_STORAGE); }
  catch(e){ return DEFAULT_SESSION_MINUTES; }
  const minutes = Number(stored);
  if(!Number.isFinite(minutes) || minutes <= 0) return DEFAULT_SESSION_MINUTES;
  return clampSessionMinutes(minutes);
}

export function setSessionMinutes(minutes){
  try { localStorage.setItem(SESSION_MINUTES_STORAGE, String(clampSessionMinutes(minutes))); }
  catch(e){ /* storage unavailable - the value just won't persist */ }
}

// No lower bound beyond "a whole positive number of minutes" - short sessions
// are allowed on purpose.
export function clampSessionMinutes(minutes){
  const value = Math.round(Number(minutes));
  if(!Number.isFinite(value)) return DEFAULT_SESSION_MINUTES;
  return Math.min(MAX_SESSION_MINUTES, Math.max(1, value));
}
