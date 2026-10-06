// Shared Gemini API client: key storage, model selection and overload fallback.
// Used by both the population generator (app.js) and the patient chat (chat.js).

export const GEMINI_API_KEY_STORAGE = 'geminiApiKey';
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_FALLBACK_MODEL = 'gemini-3.6-flash';

export function getGeminiApiKey(){
  try { return localStorage.getItem(GEMINI_API_KEY_STORAGE) || ''; }
  catch(e){ return ''; }
}

export function setGeminiApiKey(key){
  try { localStorage.setItem(GEMINI_API_KEY_STORAGE, key); }
  catch(e){ /* localStorage unavailable (private mode, etc.) - key just won't persist */ }
}

function isOverloadError(status, detail){
  if(status === 429 || status === 503) return true;
  const text = (detail || '').toLowerCase();
  return text.includes('overload') || text.includes('high demand') || text.includes('unavailable');
}

async function requestModel(model, body){
  const apiKey = getGeminiApiKey();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if(!response.ok){
    let detail = '';
    try { const errJson = await response.json(); detail = (errJson.error && errJson.error.message) || ''; } catch(e){ /* body wasn't JSON */ }
    const err = new Error(`Falha ao chamar o Gemini (${response.status})${detail ? ': ' + detail : ''}`);
    err.status = response.status;
    err.overloaded = isOverloadError(response.status, detail);
    throw err;
  }
  return response.json();
}

// Calls the primary model, retrying once against the fallback model when the
// primary is overloaded/unavailable.
export async function generateContent(body){
  if(!getGeminiApiKey()) throw new Error('Nenhuma chave de API configurada.');
  try {
    return await requestModel(GEMINI_MODEL, body);
  } catch(err){
    if(err.overloaded && GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL){
      return requestModel(GEMINI_FALLBACK_MODEL, body);
    }
    throw err;
  }
}

export function responseText(data){
  const parts = (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  return parts.map(part => part.text || '').join('').trim();
}
