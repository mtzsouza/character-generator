// Patient chat - runs in its own tab and only ever sees a single patient's data,
// handed over through a session entry in localStorage.

import { generateContent, responseText, getGeminiApiKey, setGeminiApiKey } from './gemini.js';
import { buildPatientSystemPrompt, resolvePhase } from './prompts/chatPrompt.js';
import { buildGuardrailPrompt, GUARDRAIL_RESPONSE_SCHEMA, GUARDRAIL_NOTICES, OVERRIDABLE_CATEGORIES } from './prompts/guardrailPrompt.js';

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session') || '';
const SESSION_KEY = `chatSession:${sessionId}`;
const HISTORY_KEY = `chatHistory:${sessionId}`;

function loadJSON(key){
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}
function saveJSON(key, value){
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch(e){ /* storage unavailable or full - the chat still works in memory */ }
}

const patientHeading = document.getElementById('patientHeading');
const sessionError = document.getElementById('sessionError');
const chatWorkspace = document.getElementById('chatWorkspace');
const anamnese = document.getElementById('anamnese');
const chatMessages = document.getElementById('chatMessages');
const chatError = document.getElementById('chatError');
const chatForm = document.getElementById('chatForm');
const checkingNotice = document.getElementById('checkingNotice');
const guardrailNotice = document.getElementById('guardrailNotice');
const guardrailHeading = document.getElementById('guardrailHeading');
const guardrailReason = document.getElementById('guardrailReason');
const guardrailActions = document.getElementById('guardrailActions');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

// Settings modal (Gemini API key) ------------------------------------------
const settingsModal = document.getElementById('settingsModal');
const geminiApiKeyInput = document.getElementById('geminiApiKeyInput');
function openSettingsModal(){
  geminiApiKeyInput.value = getGeminiApiKey();
  geminiApiKeyInput.type = 'password';
  settingsModal.hidden = false;
  document.body.classList.add('modal-open');
}
function closeSettingsModal(){
  settingsModal.hidden = true;
  document.body.classList.remove('modal-open');
}
document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
document.getElementById('closeSettingsBtn').addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (ev)=>{ if(ev.target === settingsModal) closeSettingsModal(); });
window.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape' && !settingsModal.hidden) closeSettingsModal(); });
document.getElementById('saveSettingsBtn').addEventListener('click', ()=>{ setGeminiApiKey(geminiApiKeyInput.value.trim()); closeSettingsModal(); });
document.getElementById('toggleKeyVisibilityBtn').addEventListener('click', ()=>{
  geminiApiKeyInput.type = geminiApiKeyInput.type === 'password' ? 'text' : 'password';
});

// Session ------------------------------------------------------------------
const patient = sessionId ? loadJSON(SESSION_KEY) : null;

function startSession(){
  document.title = `Sessão com ${patient.name}`;
  patientHeading.textContent = patient.name;
  chatWorkspace.hidden = false;
  renderAnamnese();
  renderMessages();
  chatInput.focus();
}

// The anamnese intentionally shows only intake-level information. Personality
// scores, functional scores and the generated stories stay hidden - uncovering
// them through the conversation is the point of the exercise.
const ANAMNESE_FIELDS = [
  ['Gênero', 'gender'],
  ['Faixa etária', 'ageRange'],
  ['Ocupação', 'occupation'],
  ['Saúde física', 'physicalHealth'],
  ['Histórico familiar de psicopatologia', 'hereditaryPsychopathologyTendencies'],
  ['Encaminhamento', 'reasonForFirstVisit']
];

function renderAnamnese(){
  anamnese.innerHTML = '';
  ANAMNESE_FIELDS.forEach(([label, key]) => {
    const row = document.createElement('div');
    row.className = 'anamnese-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'profile-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = patient[key] || '-';
    row.append(labelEl, valueEl);
    anamnese.appendChild(row);
  });
}

// Chat ---------------------------------------------------------------------
// `history` doubles as the Gemini `contents` array, so the whole conversation is
// resent on every turn and nothing said earlier in this session is forgotten.
let history = loadJSON(HISTORY_KEY) || [];
let pending = false;
let checking = false;

function renderMessages(){
  chatMessages.innerHTML = '';
  if(!history.length && !pending){
    const empty = document.createElement('p');
    empty.className = 'small chat-empty';
    empty.textContent = 'A sessão vai começar. Cumprimente o paciente para iniciar a conversa.';
    chatMessages.appendChild(empty);
  }
  history.forEach(message => {
    const el = document.createElement('div');
    el.className = `chat-message ${message.role === 'user' ? 'from-psychologist' : 'from-patient'}`;
    const author = document.createElement('span');
    author.className = 'chat-author';
    author.textContent = message.role === 'user' ? 'Você (psicólogo)' : patient.name;
    const body = document.createElement('p');
    body.textContent = message.text;
    el.append(author, body);
    chatMessages.appendChild(el);
  });
  if(pending){
    const el = document.createElement('div');
    el.className = 'chat-message from-patient chat-pending';
    const author = document.createElement('span');
    author.className = 'chat-author';
    author.textContent = patient.name;
    const body = document.createElement('p');
    const spinner = document.createElement('i');
    spinner.setAttribute('data-lucide', 'loader-2');
    spinner.className = 'spinner';
    body.append(spinner, document.createTextNode(' escrevendo...'));
    el.append(author, body);
    chatMessages.appendChild(el);
    if(window.lucide) window.lucide.createIcons();
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setPending(value){
  pending = value;
  chatInput.disabled = value;
  sendBtn.disabled = value;
  renderMessages();
}

function showChatError(message){
  chatError.textContent = message;
  chatError.hidden = false;
}

// How many turns of context the guardrail judge sees, so tone and
// appropriateness are judged against what the patient just said.
const GUARDRAIL_CONTEXT_TURNS = 6;

function setChecking(value){
  checking = value;
  chatInput.disabled = value;
  sendBtn.disabled = value;
  checkingNotice.hidden = !value;
}

function hideGuardrailNotice(){
  guardrailNotice.hidden = true;
  guardrailActions.innerHTML = '';
}

// Blocked messages never reach `history`, so they neither pollute the patient's
// context nor advance the conversation phase.
function showGuardrailBlock({ kind, category, reason, text }){
  chatInput.value = text;
  guardrailHeading.textContent = kind === 'error'
    ? 'Não foi possível verificar a mensagem.'
    : (GUARDRAIL_NOTICES[category] || GUARDRAIL_NOTICES.none);
  guardrailReason.textContent = kind === 'error'
    ? 'A verificação falhou, então a mensagem não foi enviada. Tente novamente.'
    : (reason || '');
  guardrailReason.hidden = !guardrailReason.textContent;
  guardrailActions.innerHTML = '';
  guardrailNotice.hidden = false;
  // Hard-blocked categories (injection, inappropriate) get the notice but no
  // action button - there is deliberately no way to send them.
  const action = kind === 'error'
    ? { label: 'Tentar novamente', send: ()=> sendMessage(text) }
    : OVERRIDABLE_CATEGORIES.includes(category)
      ? { label: 'Enviar mesmo assim', send: ()=> sendMessage(text, { skipGuardrail: true }) }
      : null;
  if(!action) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button';
  button.textContent = action.label;
  button.addEventListener('click', ()=>{ hideGuardrailNotice(); chatInput.value = ''; action.send(); });
  guardrailActions.appendChild(button);
}

async function checkGuardrails(text){
  const data = await generateContent({
    contents: [{ parts: [{ text: buildGuardrailPrompt(text, history.slice(-GUARDRAIL_CONTEXT_TURNS)) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: GUARDRAIL_RESPONSE_SCHEMA }
  });
  const raw = responseText(data);
  if(!raw) throw new Error('Verificação sem resposta.');
  const verdict = JSON.parse(raw);
  if(typeof verdict.allowed !== 'boolean') throw new Error('Verificação inválida.');
  return verdict;
}

async function sendMessage(text, { skipGuardrail = false } = {}){
  if(!getGeminiApiKey()){ openSettingsModal(); return; }
  chatError.hidden = true;
  hideGuardrailNotice();

  // Fail closed: a failed check blocks the message rather than letting it through.
  if(!skipGuardrail){
    setChecking(true);
    let verdict;
    try {
      verdict = await checkGuardrails(text);
    } catch(err){
      setChecking(false);
      showGuardrailBlock({ kind: 'error', text });
      return;
    }
    setChecking(false);
    if(!verdict.allowed){
      showGuardrailBlock({ kind: 'violation', category: verdict.category, reason: verdict.reason, text });
      return;
    }
  }

  history.push({ role: 'user', text });
  saveJSON(HISTORY_KEY, history);
  setPending(true);
  try {
    // The phase is derived from the turn count, so a reloaded session resumes
    // wherever the conversation actually was.
    const exchange = history.filter(message => message.role === 'user').length;
    const data = await generateContent({
      systemInstruction: { parts: [{ text: buildPatientSystemPrompt(patient, resolvePhase(exchange)) }] },
      contents: history.map(message => ({ role: message.role, parts: [{ text: message.text }] }))
    });
    const reply = responseText(data);
    if(!reply) throw new Error('O paciente não respondeu. Tente enviar novamente.');
    history.push({ role: 'model', text: reply });
    saveJSON(HISTORY_KEY, history);
  } catch(err){
    showChatError((err && err.message) || 'Erro ao falar com o paciente.');
  }
  setPending(false);
}

chatForm.addEventListener('submit', (ev)=>{
  ev.preventDefault();
  const text = chatInput.value.trim();
  if(!text || pending || checking) return;
  chatInput.value = '';
  sendMessage(text);
});

chatInput.addEventListener('keydown', (ev)=>{
  if(ev.key === 'Enter' && !ev.shiftKey){
    ev.preventDefault();
    chatForm.requestSubmit();
  }
});

if(window.lucide) window.lucide.createIcons();

// Bootstrap last, so every binding above is initialised before the session renders.
if(!patient){
  patientHeading.textContent = 'Sessão não encontrada';
  sessionError.hidden = false;
  sessionError.textContent = 'Nenhum paciente foi carregado nesta aba. Volte ao gerador, abra o perfil de um personagem que já tenha histórias geradas e clique no ícone de conversa.';
} else {
  startSession();
}
