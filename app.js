// Character Population Generator - app.js
// Runs deferred after DOM parsing

// Trait definitions are loaded from the JSON data files before the app starts.
const [personalityTraits, functionalTraits] = await Promise.all([
  fetch('personality.json').then(response => response.json()),
  fetch('functionality.json').then(response => response.json())
]);
const personalityFacets = personalityTraits.flatMap(trait => trait.facets.map(facet => facet.key));
const functionalVars = functionalTraits.map(trait => trait.key);
const allVars = [...personalityFacets, ...functionalVars];

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

// Clear any existing
probInputs.innerHTML = '';
const fGroup = document.createElement('div'); fGroup.className='prob-group'; fGroup.style.marginTop='6px'; fGroup.innerHTML = '<em>Functionality</em>';
probInputs.appendChild(fGroup);
createLabeledSlider(fGroup, 'functionalVariability', 'Variability', 0.2, 6.0, 0.1, functionalVariability, (v)=>{ functionalVariability = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });
createLabeledSlider(fGroup, 'functionalTrend', 'Trend', -1.0, 1.0, 0.05, functionalTrend, (v)=>{ functionalTrend = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });

const pGroup = document.createElement('div'); pGroup.className='prob-group'; pGroup.style.marginTop='6px'; pGroup.innerHTML = '<em>Personality</em>';
probInputs.appendChild(pGroup);
createLabeledSlider(pGroup, 'personalityVariability', 'Variability', 0.2, 6.0, 0.1, personalityVariability, (v)=>{ personalityVariability = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });
createLabeledSlider(pGroup, 'personalityTrend', 'Trend', -1.0, 1.0, 0.05, personalityTrend, (v)=>{ personalityTrend = v; if(state.characters.length && state.generated) generatePopulation(state.characters.length); });

function applyVarTrend(value, variability, trend){
  // variability: scale distance from center (5)
  let v = 5 + (value - 5) * variability;
  // trend: mix toward 0 or 10
  const t = Math.max(-1, Math.min(1, trend));
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
  probInputs.querySelectorAll('input').forEach((el,i)=>el.value=blockProbs[i]);
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

function genCharacter(idNum){
  const id = 'CHAR-'+String(idNum).padStart(6,'0');
  const p = {};
  const f = {};
  personalityFacets.forEach(name=>{ const raw = sampleFromBlock(pickBlockIndex()); p[name]=applyVarTrend(raw, personalityVariability, personalityTrend); });
  functionalVars.forEach(name=>{ const raw = sampleFromBlock(pickBlockIndex()); f[name]=applyVarTrend(raw, functionalVariability, functionalTrend); });
  const pAvg = +(Object.values(p).reduce((a,b)=>a+b,0)/personalityFacets.length).toFixed(4);
  const fAvg = +(Object.values(f).reduce((a,b)=>a+b,0)/functionalVars.length).toFixed(4);
  return {id, personality:p, functional:f, personalityAvg:pAvg, functionalAvg:fAvg};
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
  const xLabel = document.createElementNS('http://www.w3.org/2000/svg','text'); xLabel.setAttribute('x',W/2); xLabel.setAttribute('y',H-6); xLabel.setAttribute('text-anchor','middle'); xLabel.classList.add('tick-text'); xLabel.textContent='Personality'; gAxes.appendChild(xLabel);
  const yLabel = document.createElementNS('http://www.w3.org/2000/svg','text'); yLabel.setAttribute('x',14); yLabel.setAttribute('y',H/2); yLabel.setAttribute('transform',`rotate(-90 14 ${H/2})`); yLabel.setAttribute('text-anchor','middle'); yLabel.classList.add('tick-text'); yLabel.textContent='Functionality'; gAxes.appendChild(yLabel);
  svg.setAttribute('aria-label', 'Personality by functionality score plot');

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
  let html = `<div class="profile-summary"><div><span class="profile-label">Personality average</span><strong>${ch.personalityAvg.toFixed(4)}</strong></div><div><span class="profile-label">Functionality average</span><strong>${ch.functionalAvg.toFixed(4)}</strong></div></div>`;
  html += '<section class="profile-section"><h3>Functionality</h3><div class="functional-grid">';
  functionalTraits.forEach(trait => html += `<div class="profile-value"><span>${trait.name}<small>${trait.key}</small></span><strong>${ch.functional[trait.key].toFixed(2)}</strong></div>`);
  html += '</div></section><section class="profile-section"><h3>Personality</h3><div class="profile-grid">';
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
  if(!state.characters.length) return alert('No population to export');
  const header = ['Character ID', ...personalityFacets, ...functionalVars, 'Personality Average','Functionality Average'];
  const rows = [header.join(',')];
  state.characters.forEach(ch=>{
    const line = [ch.id, ...personalityFacets.map(k=>ch.personality[k].toFixed(4)), ...functionalVars.map(k=>ch.functional[k].toFixed(4)), ch.personalityAvg.toFixed(4), ch.functionalAvg.toFixed(4)];
    rows.push(line.join(','));
  });
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download='population.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function importCSVFile(file){
  const reader = new FileReader();
  reader.onload = (ev) => { parseCSV(ev.target.result); };
  reader.readAsText(file);
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l.length>0);
  if(lines.length<2) return alert('CSV appears empty');
  const header = lines[0].split(',').map(h=>h.trim());
  const indices = {};
  header.forEach((h,i)=>indices[h]=i);
  // validate required columns
  if(indices['Character ID'] === undefined) return alert('CSV missing Character ID column');
  // build characters
  const chars = [];
  for(let i=1;i<lines.length;i++){
    const cols = lines[i].split(',');
    const id = cols[indices['Character ID']];
    const p = {}; const f = {};
    let valid=true;
    personalityFacets.forEach(k=>{ if(indices[k]!==undefined) p[k]=parseFloat(cols[indices[k]]); else valid=false; });
    functionalVars.forEach(k=>{ if(indices[k]!==undefined) f[k]=parseFloat(cols[indices[k]]); else valid=false; });
    if(!valid) continue;
    const pAvg = +(Object.values(p).reduce((a,b)=>a+b,0)/personalityFacets.length).toFixed(4);
    const fAvg = +(Object.values(f).reduce((a,b)=>a+b,0)/functionalVars.length).toFixed(4);
    chars.push({id, personality:p, functional:f, personalityAvg:pAvg, functionalAvg:fAvg});
  }
  if(!chars.length) return alert('No valid rows found in CSV');
  state.characters = chars;
  state.generated = false;
  renderAll();
}

// Wire UI
document.getElementById('generateBtn').addEventListener('click', ()=>{
  const n = parseInt(document.getElementById('popSize').value)||0;
  if(n<=0) return alert('Enter a positive population size');
  if(n>1000) return alert('Population size cannot exceed 1000');
  generatePopulation(n);
});
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

// initial render with default population
generatePopulation(parseInt(document.getElementById('popSize').value));

if(window.lucide) window.lucide.createIcons();
