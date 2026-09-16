// Character Population Generator - app.js
// Runs deferred after DOM parsing

// Trait definitions are loaded from the JSON data files before the app starts.
const [personalityTraits, functionalTraits, names, occupations, hobbies, sexualOrientations, physicalHealthOptions, hereditaryTendencies, categoricalDefaults] = await Promise.all([
  fetch('data/personality.json').then(response => response.json()),
  fetch('data/functionality.json').then(response => response.json()),
  fetch('data/names.json').then(response => response.json()),
  fetch('data/occupation.json').then(response => response.json()),
  fetch('data/hobby.json').then(response => response.json()),
  fetch('data/sexualOrientation.json').then(response => response.json()),
  fetch('data/physicalHealth.json').then(response => response.json()),
  fetch('data/hereditaryPsychopathologyTendencies.json').then(response => response.json()),
  fetch('data/categoricalProbabilities.json').then(response => response.json())
]);
const personalityFacets = personalityTraits.flatMap(trait => trait.facets.map(facet => facet.key));
// Neuroticism facets run in the opposite direction from the other four domains: higher N
// means more anxiety/hostility/depression/vulnerability, which is the "negative" pole, while
// higher E/O/A/C is generally the "positive" pole. The Trend slider is meant to skew the whole
// generated personality toward more positive (+1) or more negative (-1); applied uniformly it
// would push Neuroticism the wrong way (positive trend making people MORE anxious). So we
// invert the trend's direction specifically for Neuroticism facets when sampling them.
const neuroticismFacetKeys = new Set((personalityTraits.find(trait => trait.key === 'N') || {facets:[]}).facets.map(facet => facet.key));
const functionalVars = functionalTraits.map(trait => trait.key);
const allVars = [...personalityFacets, ...functionalVars];
const ageRanges = Object.keys(occupations);
const nameOptions = {
  male: names.male.firstNames.flatMap(firstName => names.male.surnames.map(surname => `${firstName} ${surname}`)),
  female: names.female.firstNames.flatMap(firstName => names.female.surnames.map(surname => `${firstName} ${surname}`))
};
const genderKeyMap = { 'Masculino': 'male', 'Feminino': 'female' };
const categoricalTraits = {
  gender: ['Masculino', 'Feminino'],
  ageRange: ageRanges,
  sexualOrientation: sexualOrientations,
  physicalHealth: physicalHealthOptions,
  hereditaryPsychopathologyTendencies: hereditaryTendencies,
  hobby: hobbies,
  occupation: [...new Set(Object.values(occupations).flat())]
};
function normalizedProbabilities(values, defaults = {}){
  const probabilities = Object.fromEntries(values.map(value => [value, Math.max(0, Number(defaults[value]) || 0)]));
  const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
  if(total > 0) return Object.fromEntries(Object.entries(probabilities).map(([value, probability]) => [value, +(probability / total * 100).toFixed(2)]));
  return Object.fromEntries(values.map(value => [value, +(100 / values.length).toFixed(2)]));
}

const categoricalProbabilities = Object.fromEntries(Object.entries(categoricalTraits).map(([key, values]) => [
  key,
  normalizedProbabilities(values, categoricalDefaults[key])
]));

// Default six-block probabilities
let blockProbs = [2.5,13.5,34,34,13.5,2.5];
const blocks = [0,1.6667,3.3333,5.0,6.6667,8.3333,10.0];

const state = {characters:[]};

// UI: replace block inputs with variability/trend sliders per trait category
const probInputs = document.getElementById('probInputs');
let personalityVariability = 2.0; // 0.2..2.0
let personalityTrend = 0.0; // -1..1 (negative -> toward 0, positive -> toward 10)
let functionalVariability = 2.0;
let functionalTrend = 0.0;

function createLabeledSlider(container, id, labelText, min, max, step, value, oninput){
  const row = document.createElement('div'); row.className='prob-row';
  const lbl = document.createElement('label'); lbl.textContent = labelText;
  const valSpan = document.createElement('span'); valSpan.style.marginLeft='8px'; valSpan.id = id+'Val'; valSpan.textContent = String(value);
  const inp = document.createElement('input'); inp.type='range'; inp.min=min; inp.max=max; inp.step=step; inp.value=value; inp.id=id;
  inp.addEventListener('input',(ev)=>{ valSpan.textContent = ev.target.value; if(oninput) oninput(parseFloat(ev.target.value)); });
  row.appendChild(lbl); row.appendChild(inp); row.appendChild(valSpan);
  container.appendChild(row);
  return inp;
}

const categoricalSources = categoricalDefaults.sources || {};

const categoricalModal = document.createElement('div');
categoricalModal.className = 'categorical-modal-backdrop';
categoricalModal.hidden = true;
categoricalModal.innerHTML = '<section class="categorical-modal" role="dialog" aria-modal="true" aria-labelledby="categoricalModalTitle"><div class="categorical-modal-header"><div class="categorical-modal-heading"><h2 id="categoricalModalTitle"></h2><a class="categorical-modal-source" href="#" target="_blank" rel="noopener noreferrer" title="fonte" aria-label="Fonte da probabilidade"><i data-lucide="info" aria-hidden="true"></i></a></div><button class="modal-close categorical-modal-close" type="button" aria-label="Fechar probabilidades do traço"><i data-lucide="x" aria-hidden="true"></i></button></div><div class="categorical-modal-content"></div></section>';
document.body.appendChild(categoricalModal);
const categoricalModalTitle = categoricalModal.querySelector('#categoricalModalTitle');
const categoricalModalSource = categoricalModal.querySelector('.categorical-modal-source');
const categoricalModalContent = categoricalModal.querySelector('.categorical-modal-content');
let activeCategoricalGroup = null;
let activeCategoricalOptions = null;

function closeCategoricalModal(){
  if(activeCategoricalGroup && activeCategoricalOptions){
    activeCategoricalOptions.hidden = true;
    activeCategoricalGroup.appendChild(activeCategoricalOptions);
  }
  activeCategoricalGroup = null;
  activeCategoricalOptions = null;
  categoricalModal.hidden = true;
  document.body.classList.remove('modal-open');
}

function openCategoricalModal(group, label, options, traitKey){
  if(activeCategoricalOptions) closeCategoricalModal();
  activeCategoricalGroup = group;
  activeCategoricalOptions = options;
  options.hidden = false;
  categoricalModalTitle.textContent = `Probabilidades de ${label}`;
  const source = categoricalSources[traitKey];
  if(source){
    categoricalModalSource.href = source.url;
    categoricalModalSource.title = 'fonte';
    categoricalModalSource.setAttribute('aria-label', `Fonte da probabilidade: ${source.label}`);
    categoricalModalSource.hidden = false;
  } else {
    categoricalModalSource.hidden = true;
  }
  categoricalModalContent.appendChild(options);
  categoricalModal.hidden = false;
  document.body.classList.add('modal-open');
  if(window.lucide) window.lucide.createIcons();
}

function updateCategoricalProbability(traitKey, changedValue, changedProbability, options){
  const probabilities = categoricalProbabilities[traitKey];
  const otherValues = Object.keys(probabilities).filter(value => value !== changedValue);
  const nextProbability = Math.max(0, Math.min(100, changedProbability));
  probabilities[changedValue] = nextProbability;
  const remaining = 100 - nextProbability;
  const otherTotal = otherValues.reduce((sum, value) => sum + probabilities[value], 0);
  if(otherTotal > 0){
    otherValues.forEach(value => { probabilities[value] = +(probabilities[value] / otherTotal * remaining).toFixed(2); });
  } else {
    otherValues.forEach(value => { probabilities[value] = otherValues.length ? +(remaining / otherValues.length).toFixed(2) : 0; });
  }
  const displayedTotal = Object.values(probabilities).reduce((sum, value) => sum + value, 0);
  const correction = +(100 - displayedTotal).toFixed(2);
  if(otherValues.length) probabilities[otherValues[otherValues.length - 1]] = +(probabilities[otherValues[otherValues.length - 1]] + correction).toFixed(2);
  options.querySelectorAll('input[type="range"]').forEach(input => {
    const value = input.dataset.option;
    input.value = probabilities[value];
    input.nextElementSibling.textContent = `${probabilities[value].toFixed(2)}%`;
  });
  if(state.characters.length && state.generated) generatePopulation(state.characters.length);
}

const categoricalTraitLabels = {
  gender: 'Gênero',
  ageRange: 'Faixa etária',
  sexualOrientation: 'Orientação sexual',
  physicalHealth: 'Saúde física',
  hereditaryPsychopathologyTendencies: 'Tendências de psicopatologia hereditária',
  hobby: 'Hobby',
  occupation: 'Ocupação'
};

function createProbabilityControls(container, traitKey, values){
  const group = document.createElement('div');
  group.className = 'categorical-group';
  const label = categoricalTraitLabels[traitKey] || traitKey;
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'categorical-trigger';
  trigger.textContent = label;
  const options = document.createElement('div');
  options.className = 'categorical-options';
  options.hidden = true;
  values.forEach((value, index) => {
    const input = createLabeledSlider(options, `${traitKey}-${index}`, value, 0, 100, 0.1, categoricalProbabilities[traitKey][value], (probability) => updateCategoricalProbability(traitKey, value, probability, options));
    input.dataset.option = value;
    input.nextElementSibling.textContent = `${categoricalProbabilities[traitKey][value].toFixed(2)}%`;
  });
  trigger.addEventListener('click', () => openCategoricalModal(group, label, options, traitKey));
  group.appendChild(trigger);
  container.appendChild(group);
}

// Clear any existing
probInputs.innerHTML = '';
const fGroup = document.createElement('div'); fGroup.className='prob-group'; fGroup.style.marginTop='6px'; fGroup.innerHTML = '<em>Funcionalidade</em>';
probInputs.appendChild(fGroup);
createLabeledSlider(fGroup, 'functionalVariability', 'Variabilidade', 0.2, 6.0, 0.1, functionalVariability, (v)=>{ functionalVariability = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });
createLabeledSlider(fGroup, 'functionalTrend', 'Tendência', -1.0, 1.0, 0.05, functionalTrend, (v)=>{ functionalTrend = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });

const pGroup = document.createElement('div'); pGroup.className='prob-group'; pGroup.style.marginTop='6px'; pGroup.innerHTML = '<em>Personalidade</em>';
probInputs.appendChild(pGroup);
createLabeledSlider(pGroup, 'personalityVariability', 'Variabilidade', 0.2, 6.0, 0.1, personalityVariability, (v)=>{ personalityVariability = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });
createLabeledSlider(pGroup, 'personalityTrend', 'Tendência', -1.0, 1.0, 0.05, personalityTrend, (v)=>{ personalityTrend = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });

const categoricalGroup = document.createElement('div');
categoricalGroup.className = 'prob-group categorical-controls';
categoricalGroup.innerHTML = '<em>Traços categóricos</em>';
probInputs.appendChild(categoricalGroup);
Object.entries(categoricalTraits).forEach(([traitKey, values]) => createProbabilityControls(categoricalGroup, traitKey, values));

function applyVarTrend(value, variability, trend, invert){
  // variability: scale distance from center (5)
  let v = 5 + (value - 5) * variability;
  // trend: mix toward 0 or 10. For inverted facets (Neuroticism) the trend direction is
  // flipped, so a positive ("more positive personality") trend still pushes Neuroticism
  // toward 0 instead of 10, and a negative trend pushes it toward 10 instead of 0.
  const t = Math.max(-1, Math.min(1, trend)) * (invert ? -1 : 1);
  const mix = Math.abs(t);
  if(mix>0){
    const target = t>0 ? 10 : 0;
    v = v * (1 - mix) + target * mix;
  }
  v = Math.max(0, Math.min(10, v));
  return +v.toFixed(2);
}

function normalizeProbs(){
  let s = blockProbs.reduce((a,b)=>a+b,0);
  if(s<=0) s = 1;
  blockProbs = blockProbs.map(v=>+(v/s*100).toFixed(4));
  document.querySelectorAll('#scoreProbability-0, #scoreProbability-1, #scoreProbability-2, #scoreProbability-3, #scoreProbability-4, #scoreProbability-5').forEach((el,i)=>el.value=blockProbs[i]);
}

function pickBlockIndex(){
  const r = Math.random()*100; let cum=0;
  for(let i=0;i<blockProbs.length;i++){ cum+=blockProbs[i]; if(r<=cum) return i; }
  return blockProbs.length-1;
}

function sampleFromBlock(i){
  const lo = blocks[i]; const hi = blocks[i+1];
  const val = lo + Math.random()*(hi - lo);
  return +val.toFixed(2);
}

function pickWeighted(values, probabilities){
  const weightedValues = values.map(value => ({value, weight: Math.max(0, probabilities[value] || 0)}));
  const total = weightedValues.reduce((sum, item) => sum + item.weight, 0);
  if(total <= 0) return values[Math.floor(Math.random() * values.length)];
  let cursor = Math.random() * total;
  for(const item of weightedValues){
    cursor -= item.weight;
    if(cursor <= 0) return item.value;
  }
  return weightedValues[weightedValues.length - 1].value;
}

function pickTrait(traitKey){
  return pickWeighted(categoricalTraits[traitKey], categoricalProbabilities[traitKey]);
}

function pickName(gender){
  const key = genderKeyMap[gender] || gender.toLowerCase();
  return pickWeighted(nameOptions[key], Object.fromEntries(nameOptions[key].map(name => [name, 1])));
}

// Neuroticism facets are scored so that higher = more anxiety, hostility, depression,
// self-consciousness, impulsiveness and vulnerability - the opposite valence of the other
// four domains, where higher is generally the more adaptive pole (e.g. more trust, more
// competence). Averaging all 30 facets flat would let a highly neurotic character drag the
// score up instead of down. Instead we average domain-level scores and invert Neuroticism
// into Emotional Stability (10 - N) first, which is the standard way to fold it into an
// overall "positive personality" index.
function personalityPositiveIndex(p){
  const domainAverages = personalityTraits.map(trait => {
    const values = trait.facets.map(facet => p[facet.key]);
    const domainAvg = values.reduce((a,b)=>a+b,0) / values.length;
    return trait.key === 'N' ? 10 - domainAvg : domainAvg;
  });
  return +(domainAverages.reduce((a,b)=>a+b,0) / domainAverages.length).toFixed(4);
}

function genCharacter(idNum){
  const id = 'CHAR-'+String(idNum).padStart(6,'0');
  const p = {};
  const f = {};
  personalityFacets.forEach(name=>{ const raw = sampleFromBlock(pickBlockIndex()); p[name]=applyVarTrend(raw, personalityVariability, personalityTrend, neuroticismFacetKeys.has(name)); });
  functionalVars.forEach(name=>{ const raw = sampleFromBlock(pickBlockIndex()); f[name]=applyVarTrend(raw, functionalVariability, functionalTrend); });
  const gender = pickTrait('gender');
  const ageRange = pickTrait('ageRange');
  const occupationPool = occupations[ageRange];
  const pAvg = personalityPositiveIndex(p);
  const fAvg = +(Object.values(f).reduce((a,b)=>a+b,0)/functionalVars.length).toFixed(4);
  return {id, name: pickName(gender), gender, ageRange, occupation: pickWeighted(occupationPool, categoricalProbabilities.occupation), hobby: pickTrait('hobby'), sexualOrientation: pickTrait('sexualOrientation'), physicalHealth: pickTrait('physicalHealth'), hereditaryPsychopathologyTendencies: pickTrait('hereditaryPsychopathologyTendencies'), personality:p, functional:f, personalityAvg:pAvg, functionalAvg:fAvg};
}

function generatePopulation(n){
  state.characters = [];
  for(let i=1;i<=n;i++) state.characters.push(genCharacter(i));
  state.generated = true;
  renderAll();
}

// SVG helpers
const scatterSVG = document.getElementById('scatterPlot');
// Zoom state applied to points group only
let pointsGroup = null;
let pointSize = 4; // visible point radius (configurable)
let selectedIdx = null;
const tooltip = document.getElementById('tooltip');

function clearSVG(svg){ while(svg.firstChild) svg.removeChild(svg.firstChild); }

function renderScatter2D(svg){
  clearSVG(svg);
  // use rendered size so the plot fits the screen without scrolling
  const rect = svg.getBoundingClientRect();
  const W = rect.width; const H = rect.height; const margin=56;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // draw axes
  const gAxes = document.createElementNS('http://www.w3.org/2000/svg','g');
  gAxes.classList.add('axes-group');
  const axisX = document.createElementNS('http://www.w3.org/2000/svg','line');
  axisX.setAttribute('x1',margin); axisX.setAttribute('x2',W-margin);
  axisX.setAttribute('y1',H-margin); axisX.setAttribute('y2',H-margin); axisX.classList.add('axis-line'); gAxes.appendChild(axisX);
  const axisY = document.createElementNS('http://www.w3.org/2000/svg','line');
  axisY.setAttribute('x1',margin); axisY.setAttribute('x2',margin);
  axisY.setAttribute('y1',margin); axisY.setAttribute('y2',H-margin); axisY.classList.add('axis-line'); gAxes.appendChild(axisY);

  // ticks and labels for X (0..10)
  for(let t=0;t<=10;t+=1){
    const x = margin + (t/10)*(W - 2*margin);
    const tick = document.createElementNS('http://www.w3.org/2000/svg','line');
    tick.setAttribute('x1',x); tick.setAttribute('x2',x); tick.setAttribute('y1',H-margin); tick.setAttribute('y2',H-margin+6); tick.classList.add('axis-line'); gAxes.appendChild(tick);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',x); txt.setAttribute('y',H-margin+20); txt.setAttribute('text-anchor','middle'); txt.classList.add('tick-text','x-tick-text'); txt.dataset.t = t; txt.textContent = String(t);
    gAxes.appendChild(txt);
  }
  // ticks and labels for Y (0..10)
  for(let t=0;t<=10;t+=1){
    const y = margin + (1 - t/10)*(H - 2*margin);
    const tick = document.createElementNS('http://www.w3.org/2000/svg','line');
    tick.setAttribute('x1',margin-6); tick.setAttribute('x2',margin); tick.setAttribute('y1',y); tick.setAttribute('y2',y); tick.classList.add('axis-line'); gAxes.appendChild(tick);
    const txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',margin-10); txt.setAttribute('y',y+4); txt.setAttribute('text-anchor','end'); txt.classList.add('tick-text','y-tick-text'); txt.dataset.t = t; txt.textContent = String(t);
    gAxes.appendChild(txt);
  }

  // axis labels
  const xLabel = document.createElementNS('http://www.w3.org/2000/svg','text'); xLabel.setAttribute('x',W/2); xLabel.setAttribute('y',H-6); xLabel.setAttribute('text-anchor','middle'); xLabel.classList.add('tick-text'); xLabel.textContent='Personalidade'; gAxes.appendChild(xLabel);
  const yLabel = document.createElementNS('http://www.w3.org/2000/svg','text'); yLabel.setAttribute('x',14); yLabel.setAttribute('y',H/2); yLabel.setAttribute('transform',`rotate(-90 14 ${H/2})`); yLabel.setAttribute('text-anchor','middle'); yLabel.classList.add('tick-text'); yLabel.textContent='Funcionalidade'; gAxes.appendChild(yLabel);
  svg.setAttribute('aria-label', 'Gráfico de personalidade por funcionalidade');

  // append axes group first so it stays static
  svg.appendChild(gAxes);

  // create or replace points group and append points into it
  pointsGroup = document.createElementNS('http://www.w3.org/2000/svg','g');
  pointsGroup.classList.add('points-group');
  state.characters.forEach((ch,idx)=>{
    const x = margin + (ch.personalityAvg/10)*(W - 2*margin);
    const y = margin + (1 - ch.functionalAvg/10)*(H - 2*margin);
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r', pointSize);
    c.dataset.idx = idx;
    const hue = 200 - (ch.personalityAvg/10)*100;
    c.setAttribute('fill', `hsl(${hue} 70% 45%)`);
    c.setAttribute('class','point');
    c.style.cursor='pointer';
    c.addEventListener('mousemove', (ev)=>{ showTooltip(ev, ch.id); });
    c.addEventListener('mouseout', ()=>{ hideTooltip(); });
    c.addEventListener('click', ()=>{ selectedIdx = idx; showProfile(ch); highlightSelected(pointsGroup, idx); });
    pointsGroup.appendChild(c);
  });
  svg.appendChild(pointsGroup);
}

function highlightSelected(container, idx){
  // container should be the points group or svg; normalize
  const group = container && container.querySelector ? (container.querySelector('.points-group') || container) : pointsGroup;
  if(!group) return;
  Array.from(group.querySelectorAll('circle')).forEach((el,i)=>{
    if(i===idx){ el.classList.add('selected'); el.setAttribute('r', Math.max(pointSize*2, pointSize+2)); }
    else { el.classList.remove('selected'); el.setAttribute('r', pointSize); }
  });
}

function showTooltip(ev, text){
  tooltip.style.display='block'; tooltip.textContent = text;
  const pad=8; const x = ev.clientX + pad; const y = ev.clientY + pad;
  tooltip.style.left = x+'px'; tooltip.style.top = y+'px';
}
function hideTooltip(){ tooltip.style.display='none'; }

function showProfile(ch){
  const profileDiv = document.getElementById('profile');
  const profileModal = document.getElementById('profileModal');
  document.getElementById('profileModalTitle').textContent = ch.id;
  let html = `<div class="profile-summary"><div><span class="profile-label">Nome</span><strong>${ch.name}</strong></div><div><span class="profile-label">Gênero</span><strong>${ch.gender}</strong></div><div><span class="profile-label">Faixa etária</span><strong>${ch.ageRange}</strong></div><div><span class="profile-label">Ocupação</span><strong>${ch.occupation}</strong></div><div><span class="profile-label">Hobby</span><strong>${ch.hobby}</strong></div><div><span class="profile-label">Orientação sexual</span><strong>${ch.sexualOrientation}</strong></div><div><span class="profile-label">Saúde física</span><strong>${ch.physicalHealth}</strong></div><div><span class="profile-label">Tendência de psicopatologia hereditária</span><strong>${ch.hereditaryPsychopathologyTendencies}</strong></div><div><span class="profile-label">Média de personalidade</span><strong>${ch.personalityAvg.toFixed(4)}</strong></div><div><span class="profile-label">Média de funcionalidade</span><strong>${ch.functionalAvg.toFixed(4)}</strong></div></div>`;
  html += '<section class="profile-section"><h3>Funcionalidade</h3><div class="functional-grid">';
  functionalTraits.forEach(trait => html += `<div class="profile-value"><span>${trait.name}<small>${trait.key}</small></span><strong>${ch.functional[trait.key].toFixed(2)}</strong></div>`);
  html += '</div></section><section class="profile-section"><h3>Personalidade</h3><div class="profile-grid">';
  personalityTraits.forEach(trait=>{
    html += `<div class="profile-trait"><h4>${trait.name}</h4>`;
    trait.facets.forEach(facet=>{
      const v = ch.personality[facet.key];
      html += `<div class="profile-value"><span>${facet.key} <small>${facet.name}</small></span><strong>${v.toFixed(2)}</strong></div>`;
    });
    html += '</div>';
  });
  html += '</div></section>';
  profileDiv.innerHTML = html;
  profileModal.hidden = false;
  document.body.classList.add('modal-open');
}

function renderAll(){
  renderScatter2D(scatterSVG);
}

// CSV Export/Import
function exportCSV(){
  if(!state.characters.length) return alert('Nenhuma população para exportar');
  const header = ['ID do Personagem', 'Nome', 'Gênero', 'Faixa etária', 'Ocupação', 'Hobby', 'Orientação sexual', 'Saúde física', 'Tendência de psicopatologia hereditária', ...personalityFacets, ...functionalVars, 'Média de Personalidade','Média de Funcionalidade'];
  const rows = [header.join(',')];
  state.characters.forEach(ch=>{
    const line = [ch.id, ch.name, ch.gender, ch.ageRange, ch.occupation, ch.hobby, ch.sexualOrientation, ch.physicalHealth, ch.hereditaryPsychopathologyTendencies, ...personalityFacets.map(k=>ch.personality[k].toFixed(4)), ...functionalVars.map(k=>ch.functional[k].toFixed(4)), ch.personalityAvg.toFixed(4), ch.functionalAvg.toFixed(4)];
    rows.push(line.join(','));
  });
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download='populacao.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function importCSVFile(file){
  const reader = new FileReader();
  reader.onload = (ev) => { parseCSV(ev.target.result); };
  reader.readAsText(file);
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
  if(lines.length<2) return alert('O CSV parece estar vazio');
  const header = lines[0].split(',').map(h=>h.trim());
  const indices = {};
  header.forEach((h,i)=>indices[h]=i);
  // validate required columns
  if(indices['ID do Personagem'] === undefined) return alert('O CSV não possui a coluna ID do Personagem');
  // build characters
  const chars = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(',');
    const id = cols[indices['ID do Personagem']];
    const p = {}; const f = {};
    let valid=true;
    personalityFacets.forEach(k=>{ if(indices[k]!==undefined) p[k]=parseFloat(cols[indices[k]]); else valid=false; });
    functionalVars.forEach(k=>{ if(indices[k]!==undefined) f[k]=parseFloat(cols[indices[k]]); else valid=false; });
    if(!valid) continue;
    const pAvg = personalityPositiveIndex(p);
    const fAvg = +(Object.values(f).reduce((a,b)=>a+b,0)/functionalVars.length).toFixed(4);
    chars.push({
      id,
      name: cols[indices['Nome']] || 'Personagem importado',
      gender: cols[indices['Gênero']] || 'Masculino',
      ageRange: cols[indices['Faixa etária']] || ageRanges[0],
      occupation: cols[indices['Ocupação']] || occupations[ageRanges[0]][0],
      hobby: cols[indices['Hobby']] || hobbies[0],
      sexualOrientation: cols[indices['Orientação sexual']] || sexualOrientations[0],
      physicalHealth: cols[indices['Saúde física']] || physicalHealthOptions[0],
      hereditaryPsychopathologyTendencies: cols[indices['Tendência de psicopatologia hereditária']] || hereditaryTendencies[0],
      personality:p,
      functional:f,
      personalityAvg:pAvg,
      functionalAvg:fAvg
    });
  }
  if(!chars.length) return alert('Nenhuma linha válida encontrada no CSV');
  state.characters = chars;
  state.generated = false;
  renderAll();
}

// Wire UI
function regenerateFromPopulationInput(){
  const n = parseInt(document.getElementById('popSize').value)||0;
  if(n<=0) return alert('Informe um tamanho de população positivo');
  if(n>1000) return alert('O tamanho da população não pode exceder 1000');
  generatePopulation(n);
}
document.getElementById('popSize').addEventListener('change', regenerateFromPopulationInput);
document.getElementById('exportBtn').addEventListener('click', exportCSV);
document.getElementById('importBtn').addEventListener('click', ()=>document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (ev)=>{ const f = ev.target.files[0]; if(f) importCSVFile(f); });

// Point size slider wiring
const sizeSlider = document.getElementById('pointSizeSlider');
const sizeVal = document.getElementById('pointSizeVal');
if(sizeSlider){
  sizeSlider.addEventListener('input', (ev)=>{
    pointSize = parseFloat(ev.target.value) || 2;
    sizeVal.textContent = pointSize;
    // update existing points without full re-render
    if(pointsGroup){
      Array.from(pointsGroup.querySelectorAll('circle')).forEach((el)=>{
        if(el.classList.contains('selected')) el.setAttribute('r', Math.max(pointSize*2, pointSize+2));
        else el.setAttribute('r', pointSize);
      });
    }
  });
}

// Character profile modal
const profileModal = document.getElementById('profileModal');
const closeProfileBtn = document.getElementById('closeProfileBtn');
function closeProfile(){
  profileModal.hidden = true;
  document.body.classList.remove('modal-open');
}
closeProfileBtn.addEventListener('click', closeProfile);
profileModal.addEventListener('click', (ev)=>{ if(ev.target === profileModal) closeProfile(); });
window.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape' && !profileModal.hidden) closeProfile(); });
categoricalModal.querySelector('.categorical-modal-close').addEventListener('click', closeCategoricalModal);
categoricalModal.addEventListener('click', (ev)=>{ if(ev.target === categoricalModal) closeCategoricalModal(); });
window.addEventListener('keydown', (ev)=>{ if(ev.key === 'Escape' && !categoricalModal.hidden) closeCategoricalModal(); });

// initial render with default population
generatePopulation(parseInt(document.getElementById('popSize').value));

if(window.lucide) window.lucide.createIcons();
