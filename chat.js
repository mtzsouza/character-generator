// Patient chat - runs in its own tab and only ever sees a single patient's data,
// handed over through a session entry in localStorage.

import { generateContent, responseText, getGeminiApiKey } from './gemini.js';
import { DEFAULT_SESSION_MINUTES } from './settings.js';
import { buildPatientSystemPrompt, resolvePhase, resolveSessionPressure } from './prompts/chatPrompt.js';
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

// Session timer -----------------------------------------------------------
// The clock is started manually and its end time is persisted, so a reload
// resumes the real remaining time instead of handing back a fresh session.
const TIMER_KEY = `chatTimer:${sessionId}`;
const TIMER_HIDDEN_STORAGE = 'timerHidden';
const timerStartBtn = document.getElementById('timerStartBtn');
const timerDisplay = document.getElementById('timerDisplay');
const timerVisibilityBtn = document.getElementById('timerVisibilityBtn');
const timerTooltip = document.getElementById('timerTooltip');
const timerEndBtn = document.getElementById('timerEndBtn');
const endSessionModal = document.getElementById('endSessionModal');

let durationMs = DEFAULT_SESSION_MINUTES * 60000;
let endsAt = null;
let tickHandle = null;
// When the clock runs out the psychologist still gets one closing message, so
// the session can be wrapped up instead of being cut mid-sentence.
let finalMessageUsed = false;
let tooltipDismissed = false;

// idle -> running -> grace (one last message) -> closed
function timerState(){
  if(!endsAt) return 'idle';
  if(remainingMs() > 0) return 'running';
  return finalMessageUsed ? 'closed' : 'grace';
}
function isExpired(){
  const state = timerState();
  return state === 'grace' || state === 'closed';
}
function persistTimer(){
  saveJSON(TIMER_KEY, { endsAt, finalMessageUsed });
}
function remainingMs(){
  return endsAt ? Math.max(0, endsAt - Date.now()) : durationMs;
}
function formatClock(ms){
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function isTimerHidden(){
  try { return localStorage.getItem(TIMER_HIDDEN_STORAGE) === '1'; } catch(e){ return false; }
}
function setTimerHidden(hidden){
  try { localStorage.setItem(TIMER_HIDDEN_STORAGE, hidden ? '1' : '0'); } catch(e){ /* preference just won't persist */ }
}

// Runs twice a second, so it only touches text.
function renderClock(){
  timerDisplay.textContent = isTimerHidden() ? '--:--' : formatClock(remainingMs());
  timerDisplay.classList.toggle('timer-ended', isExpired());
}

// Rebuilds icons, so it runs only on an actual state change.
function renderTimerChrome(){
  const hidden = isTimerHidden();
  const state = timerState();
  timerTooltip.hidden = !(state === 'grace' && !tooltipDismissed);
  timerStartBtn.hidden = state !== 'idle';
  timerEndBtn.disabled = isExpired();
  timerVisibilityBtn.innerHTML = `<i data-lucide="${hidden ? 'eye-off' : 'eye'}" aria-hidden="true"></i>`;
  timerVisibilityBtn.title = hidden ? 'Mostrar o tempo' : 'Ocultar o tempo';
  timerVisibilityBtn.setAttribute('aria-label', timerVisibilityBtn.title);
  if(window.lucide) window.lucide.createIcons();
  renderClock();
}

function stopTicking(){
  if(tickHandle){ clearInterval(tickHandle); tickHandle = null; }
}

function tick(){
  renderClock();
  if(timerState() !== 'running'){
    stopTicking();
    renderTimerChrome();
    updateComposerState();
    renderMessages();
  }
}

function startTimer(){
  if(timerState() !== 'idle') return;
  endsAt = Date.now() + durationMs;
  persistTimer();
  stopTicking();
  tickHandle = setInterval(tick, 500);
  renderTimerChrome();
  updateComposerState();
  renderMessages();
  chatInput.focus();
}

function openEndSessionModal(){
  if(isExpired()) return;
  endSessionModal.hidden = false;
  document.body.classList.add('modal-open');
  document.getElementById('endSessionConfirmBtn').focus();
}
function closeEndSessionModal(){
  endSessionModal.hidden = true;
  document.body.classList.remove('modal-open');
}

// Ending early is deliberate, so it closes the session outright - no closing
// message, unlike letting the clock run out.
function endSessionNow(){
  closeEndSessionModal();
  if(isExpired()) return;
  endsAt = Date.now();
  finalMessageUsed = true;
  tooltipDismissed = true;
  persistTimer();
  stopTicking();
  renderClock();
  renderTimerChrome();
  updateComposerState();
  renderMessages();
}

timerStartBtn.addEventListener('click', startTimer);
timerEndBtn.addEventListener('click', openEndSessionModal);
document.getElementById('endSessionConfirmBtn').addEventListener('click', endSessionNow);
document.getElementById('endSessionCancelBtn').addEventListener('click', closeEndSessionModal);
document.getElementById('endSessionCloseBtn').addEventListener('click', closeEndSessionModal);
endSessionModal.addEventListener('click', (ev)=>{ if(ev.target === endSessionModal) closeEndSessionModal(); });
window.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape' && !endSessionModal.hidden) closeEndSessionModal(); });
timerVisibilityBtn.addEventListener('click', ()=>{ setTimerHidden(!isTimerHidden()); renderTimerChrome(); });
document.getElementById('timerTooltipClose').addEventListener('click', ()=>{ tooltipDismissed = true; renderTimerChrome(); });

function initTimer(){
  durationMs = (patient.durationMinutes || DEFAULT_SESSION_MINUTES) * 60000;
  const stored = loadJSON(TIMER_KEY);
  if(stored && typeof stored.endsAt === 'number') endsAt = stored.endsAt;
  finalMessageUsed = !!(stored && stored.finalMessageUsed);
  if(timerState() === 'running') tickHandle = setInterval(tick, 500);
  renderTimerChrome();
}

// Session ------------------------------------------------------------------
const patient = sessionId ? loadJSON(SESSION_KEY) : null;

function startSession(){
  document.title = `Sessão com ${patient.name}`;
  patientHeading.textContent = patient.name;
  chatWorkspace.hidden = false;
  renderAnamnese();
  // The timer must be restored before the first render: the empty-state message
  // depends on whether the session is idle, running or already over.
  initTimer();
  renderMessages();
  updateComposerState();
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
    const state = timerState();
    const empty = document.createElement('p');
    empty.className = 'small chat-empty';
    empty.textContent = state === 'idle'
      ? 'Inicie a sessão para começar.'
      : state === 'grace'
        ? 'O tempo acabou. Você ainda pode enviar uma última mensagem.'
        : state === 'closed'
          ? 'A sessão terminou.'
          : 'A sessão vai começar. Cumprimente o paciente para iniciar a conversa.';
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
  updateComposerState();
  renderMessages();
}

function canSend(){
  const state = timerState();
  return (state === 'running' || state === 'grace') && !pending && !checking;
}

function updateComposerState(){
  const state = timerState();
  const blocked = !canSend();
  chatInput.disabled = blocked;
  sendBtn.disabled = blocked;
  chatInput.placeholder = state === 'idle'
    ? 'Inicie a sessão no cronômetro para começar...'
    : state === 'grace'
      ? 'O tempo acabou. Escreva sua última mensagem...'
      : state === 'closed'
        ? 'A sessão terminou.'
        : 'Escreva sua fala como psicólogo...';
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
  checkingNotice.hidden = !value;
  updateComposerState();
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
  const state = timerState();
  if(state !== 'running' && state !== 'grace'){
    showChatError(state === 'idle' ? 'Inicie a sessão para enviar mensagens.' : 'A sessão terminou.');
    return;
  }
  if(!getGeminiApiKey()){
    showChatError('Nenhuma chave da API configurada. Configure-a no gerador de personagens e abra a conversa novamente.');
    return;
  }
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

  const isFinalMessage = timerState() === 'grace';
  const remainingRatio = durationMs > 0 ? remainingMs() / durationMs : 0;
  if(isFinalMessage){
    finalMessageUsed = true;
    persistTimer();
    renderTimerChrome();
  }
  history.push({ role: 'user', text });
  saveJSON(HISTORY_KEY, history);
  setPending(true);
  try {
    // The phase is derived from the turn count, so a reloaded session resumes
    // wherever the conversation actually was.
    const exchange = history.filter(message => message.role === 'user').length;
    const data = await generateContent({
      systemInstruction: { parts: [{ text: buildPatientSystemPrompt(patient, resolvePhase(exchange), resolveSessionPressure(remainingRatio, isFinalMessage)) }] },
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
