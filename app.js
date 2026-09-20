// CountQuest MVP app.js
// Self-contained static prototype. Uses SpeechSynthesis for voice instructions.

// ----- Game configuration -----
const LEVELS = [
  { id: 1, type: 'count', title: 'Count the Objects', max: 8, min: 3, note: 'Tap each object to count.' },
  { id: 2, type: 'recognition', title: 'Which Number?', max: 8, min: 2, note: 'Choose the correct number.' },
  { id: 3, type: 'make-number', title: 'Make the Number', max: 8, min: 2, note: 'Tap objects until the number matches.' },
  { id: 4, type: 'addition', title: 'Simple Addition', max: 5, min: 1, note: 'Add both groups.' },
  { id: 5, type: 'subtraction', title: 'Simple Subtraction', max: 8, min: 2, note: 'Tap objects to remove until the answer matches.' },
  { id: 6, type: 'mix', title: 'Mixed Challenges', max: 8, min: 2, note: 'A fun mix!' }
];

// State
let state = {
  currentLevel: 0,
  score: 0,
  startTime: null,
  levelStartTime: null,
  totalTime: 0,
  attempts: 0,
  correct: 0,
  played: 0,
  stickers: [],
  questionRecords: [] // for CSV
};

// DOM refs
const el = id => document.getElementById(id);
const gameArea = el('game-area');
const levelNumber = el('level-number');
const totalLevels = el('total-levels');
const levelBanner = el('level-banner');
const btnStart = el('btn-start');
const btnReset = el('btn-reset');
const btnInstruct = el('btn-instruct');
const btnMute = el('btn-mute');
const btnSkip = el('btn-skip');
const scoreEl = el('score');
const timeEl = el('time');
const playedEl = el('played');
const correctEl = el('correct');
const totalTimeEl = el('total-time');
const stickersEl = el('stickers');
const downloadCSV = el('btn-download-csv');
const copySummary = el('btn-copy-summary');

let voiceEnabled = true;
let levelTimer = null;
let tickInterval = null;

// Utility speak
function speak(text){
  if(!voiceEnabled || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 1.1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// Small sound: feedback using WebAudio beep
function beep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.08);
  }catch(e){/*ignore*/}
}

// Utility random
function randInt(min, max){return Math.floor(Math.random()*(max-min+1))+min}

// Set up UI
function init(){
  totalLevels.textContent = LEVELS.length;
  el('score').textContent = state.score;
  el('level-number').textContent = 1;
  btnStart.addEventListener('click', startNextLevel);
  btnReset.addEventListener('click', resetGame);
  btnInstruct.addEventListener('click', () => replayInstruction());
  btnMute.addEventListener('click', () => { voiceEnabled = !voiceEnabled; btnMute.textContent = voiceEnabled ? '🔈' : '🔇'; });
  btnSkip.addEventListener('click', () => { finishLevel(true); });
  downloadCSV.addEventListener('click', downloadQuestionCSV);
  copySummary.addEventListener('click', copySummaryText);
  updateStickers();
  renderWelcome();
}

function renderWelcome(){
  levelBanner.textContent = 'Ready for Level 1';
  gameArea.innerHTML = `
    <div style="text-align:center">
      <h2>Welcome to CountQuest!</h2>
      <p class="muted">A fun counting game for young learners. Tap Start Level to begin.</p>
      <div style="margin-top:14px"><button id="demo-play" class="primary big">Start Level</button></div>
    </div>
  `;
  document.getElementById('demo-play').addEventListener('click', startNextLevel);
  speak('Welcome to Count Quest! Press Start Level to begin.');
}

// Start next level
function startNextLevel(){
  if(state.currentLevel >= LEVELS.length) {
    // completed all levels, reset to 0 or restart
    state.currentLevel = 0;
  }
  state.currentLevel += 1;
  levelNumber.textContent = state.currentLevel;
  const lvlSpec = LEVELS[state.currentLevel-1];
  levelBanner.textContent = `Level ${state.currentLevel}: ${lvlSpec.title}`;
  state.levelStartTime = Date.now();
  startLevel(lvlSpec);
}

function startLevel(spec){
  // generate a challenge for spec.type
  const type = spec.type === 'mix' ? ['count','recognition','addition','subtraction','make-number'][randInt(0,4)] : spec.type;
  const count = randInt(spec.min, spec.max);
  const challenge = { level: state.currentLevel, type, count, spec };

  if(type === 'count') return renderCount(challenge);
  if(type === 'recognition') return renderRecognition(challenge);
  if(type === 'make-number') return renderMakeNumber(challenge);
  if(type === 'addition') return renderAddition(challenge);
  if(type === 'subtraction') return renderSubtraction(challenge);
}

// Render helpers: use simple emoji objects for clarity and no external assets
function renderCount(ch){
  speak(`Level ${ch.level}. Count the objects. Tap each one to count.`);
  gameArea.innerHTML = '';
  const info = document.createElement('div');
  info.innerHTML = `<h3>Tap to count</h3><p class="muted">Tap each item. When finished, press Submit.</p>`;
  gameArea.appendChild(info);

  const grid = document.createElement('div'); grid.className='game-grid';
  for(let i=0;i<ch.count;i++){
    const div = document.createElement('div'); div.className='object'; div.tabIndex=0; div.textContent='🎈';
    div.addEventListener('click', ()=>{div.classList.toggle('tapped'); updateCountDisplay();});
    grid.appendChild(div);
  }
  gameArea.appendChild(grid);

  const controls = document.createElement('div'); controls.className='choice-row';
  const submit = document.createElement('button'); submit.className='primary'; submit.textContent='Submit';
  const showAnswer = document.createElement('button'); showAnswer.className='btn'; showAnswer.textContent='Show Answer';
  controls.appendChild(submit); controls.appendChild(showAnswer);
  gameArea.appendChild(controls);

  function counted(){
    return grid.querySelectorAll('.object.tapped').length;
  }
  function updateCountDisplay(){
    // subtle voice feedback on each tap
    const c = counted();
    speak(String(c));
  }

  submit.addEventListener('click', ()=>{
    const childAnswer = counted();
    const correct = ch.count;
    recordAndHandle(ch, `Tapped ${childAnswer}`, correct, childAnswer);
  });
  showAnswer.addEventListener('click', ()=>{
    // highlight correct answer by tapping all
    grid.querySelectorAll('.object').forEach((el,i)=>{ if(i < ch.count) el.classList.add('tapped'); });
    speak(`There are ${ch.count} objects.`);
  });
}

function renderRecognition(ch){
  speak(`Level ${ch.level}. Count the items and choose the correct number.`);
  gameArea.innerHTML = '';
  const info = document.createElement('div'); info.innerHTML = `<h3>Which number?</h3><p class="muted">Count the items, then pick the right number.</p>`;
  gameArea.appendChild(info);

  const grid = document.createElement('div'); grid.className='game-grid';
  for(let i=0;i<ch.count;i++){ const d=document.createElement('div'); d.className='object'; d.textContent='🍎'; d.addEventListener('click',()=>{d.classList.toggle('tapped');}); grid.appendChild(d); }
  gameArea.appendChild(grid);

  // choices: correct + 2 random
  const choices = new Set(); choices.add(ch.count);
  while(choices.size<3) choices.add(Math.max(1, ch.count + randInt(-2,2)));
  const choiceRow = document.createElement('div'); choiceRow.className='choice-row';
  Array.from(choices).sort(()=>Math.random()-0.5).forEach(n=>{
    const b=document.createElement('div'); b.className='choice'; b.textContent=n; b.tabIndex=0;
    b.addEventListener('click',()=>{
      const isCorrect = n===ch.count;
      b.classList.add(isCorrect ? 'correct' : 'wrong');
      if(isCorrect){ recordAndHandle(ch,'Chose '+n,ch.count,n); } else { recordAndHandle(ch,'Chose '+n,ch.count,n); }
    });
    choiceRow.appendChild(b);
  });
  gameArea.appendChild(choiceRow);
}

function renderMakeNumber(ch){
  speak(`Level ${ch.level}. Make the number ${ch.count}. Tap to add objects.`);
  gameArea.innerHTML = '';
  const info = document.createElement('div'); info.innerHTML = `<h3>Make ${ch.count}</h3><p class="muted">Tap the + button to add objects until the number matches.</p>`;
  gameArea.appendChild(info);

  const display = document.createElement('div'); display.style.margin='12px'; display.style.fontSize='28px'; display.textContent='0';
  gameArea.appendChild(display);

  const objWrap = document.createElement('div'); objWrap.className='game-grid'; gameArea.appendChild(objWrap);

  let current = 0;
  function refresh(){
    display.textContent = String(current);
    objWrap.innerHTML = '';
    for(let i=0;i<current;i++){ const d=document.createElement('div'); d.className='object'; d.textContent='🧸'; objWrap.appendChild(d); }
  }
  const row = document.createElement('div'); row.className='choice-row';
  const add = document.createElement('button'); add.className='btn'; add.textContent='+'; const remove = document.createElement('button'); remove.className='btn'; remove.textContent='-'; const submit = document.createElement('button'); submit.className='primary'; submit.textContent='Submit';
  row.appendChild(add); row.appendChild(remove); row.appendChild(submit);
  gameArea.appendChild(row);

  add.addEventListener('click', ()=>{ if(current < 12) current++; refresh(); speak(String(current)); });
  remove.addEventListener('click', ()=>{ if(current>0) current--; refresh(); speak(String(current)); });
  submit.addEventListener('click', ()=>{ recordAndHandle(ch,'Made '+current,ch.count,current); });
  refresh();
}

function renderAddition(ch){
  // two groups a + b
  const a = randInt(1, ch.max-1);
  const b = randInt(1, ch.max-1);
  const sum = a + b;
  speak(`Level ${ch.level}. Add the two groups. ${a} plus ${b}.`);
  gameArea.innerHTML = '';
  const info = document.createElement('div'); info.innerHTML = `<h3>${a} + ${b}</h3><p class="muted">Count both groups and pick the correct answer.</p>`;
  gameArea.appendChild(info);

  const groups = document.createElement('div'); groups.style.display='flex'; groups.style.gap='12px'; groups.style.marginTop='12px';
  const g1 = document.createElement('div'); g1.style.display='grid'; g1.style.gridTemplateColumns='repeat(4,1fr)'; g1.style.gap='8px';
  for(let i=0;i<a;i++){ const d=document.createElement('div'); d.className='object'; d.textContent='🍓'; g1.appendChild(d); }
  const g2 = document.createElement('div'); g2.style.display='grid'; g2.style.gridTemplateColumns='repeat(4,1fr)'; g2.style.gap='8px';
  for(let i=0;i<b;i++){ const d=document.createElement('div'); d.className='object'; d.textContent='🍓'; g2.appendChild(d); }
  groups.appendChild(g1); groups.appendChild(g2); gameArea.appendChild(groups);

  const choices = new Set([sum]);
  while(choices.size<3) choices.add(Math.max(0, sum + randInt(-2,2)));
  const choiceRow = document.createElement('div'); choiceRow.className='choice-row';
  Array.from(choices).sort(()=>Math.random()-0.5).forEach(n=>{
    const b=document.createElement('div'); b.className='choice'; b.textContent=n; b.addEventListener('click', ()=>{ recordAndHandle({...ch, detail:`${a}+${b}`}, 'Chose '+n, sum, n); }); choiceRow.appendChild(b);
  });
  gameArea.appendChild(choiceRow);
}

function renderSubtraction(ch){
  const total = randInt(Math.max(2,ch.min), ch.max);
  const remove = randInt(1, total-1);
  const answer = total - remove;
  speak(`Level ${ch.level}. Subtraction. ${total} minus ${remove}. How many left?`);
  gameArea.innerHTML = '';
  const info = document.createElement('div'); info.innerHTML = `<h3>${total} - ${remove}</h3><p class="muted">Tap an object to remove it. Submit when done.</p>`;
  gameArea.appendChild(info);

  const objWrap = document.createElement('div'); objWrap.className='game-grid';
  for(let i=0;i<total;i++){ const d=document.createElement('div'); d.className='object'; d.textContent='🐻'; d.addEventListener('click', ()=>{ d.remove(); }); objWrap.appendChild(d); }
  gameArea.appendChild(objWrap);
  const submit = document.createElement('button'); submit.className='primary'; submit.textContent='Submit'; gameArea.appendChild(submit);
  submit.addEventListener('click', ()=>{ const childAnswer = objWrap.querySelectorAll('.object').length; recordAndHandle(ch, 'Remaining '+childAnswer, answer, childAnswer); });
}

// record a question attempt and handle results
function recordAndHandle(ch, prompt, correct, childAnswer){
  state.attempts += 1;
  const timeSpent = Math.round((Date.now() - state.levelStartTime)/1000);
  const ok = childAnswer === correct;
  if(ok){ state.score += 10; state.correct += 1; state.played += 1; giveSticker(); speak('Great job!'); beep(); }
  else { state.played += 1; speak('Nice try! The correct answer is ' + correct); }
  state.totalTime += timeSpent;
  // record
  state.questionRecords.push({level: state.currentLevel, type: ch.type || ch.spec.type, prompt: ch.detail || prompt, correct, childAnswer, timeSpent});
  // update parental panel
  updateStats();
  // small delay then auto advance
  setTimeout(()=>{ finishLevel(false); }, 900);
}

function finishLevel(skip){
  // if skip, record as skipped
  if(skip){
    state.questionRecords.push({level: state.currentLevel, type: 'skipped', prompt: 'skipped', correct: '', childAnswer: 'skipped', timeSpent:0});
  }
  if(state.currentLevel >= LEVELS.length){
    // game finished
    showFinal();
  } else {
    // auto go to next
    startNextLevel();
  }
}

function showFinal(){
  speak('Well done! You completed all levels.');
  gameArea.innerHTML = `<div style="text-align:center"><h2>All done!</h2><p>You scored ${state.score} points and earned ${state.stickers.length} stickers.</p><button id="btn-replay" class="primary big">Play Again</button></div>`;
  document.getElementById('btn-replay').addEventListener('click', resetGame);
}

function giveSticker(){
  const icons = ['🌟','🏅','🎉','⭐','🥇','🎈'];
  const pick = icons[randInt(0,icons.length-1)];
  state.stickers.push(pick);
  updateStickers();
}

function updateStickers(){
  stickersEl.innerHTML = '';
  if(state.stickers.length===0){ stickersEl.innerHTML = '<div class="muted">No stickers yet — earn some by answering correctly!</div>' ; return; }
  state.stickers.forEach(s=>{ const d=document.createElement('div'); d.className='sticker'; d.textContent=s; stickersEl.appendChild(d); });
}

function updateStats(){
  scoreEl.textContent = state.score;
  playedEl.textContent = state.played;
  correctEl.textContent = state.correct;
  totalTimeEl.textContent = state.totalTime + 's';
}

function resetGame(){
  state = { currentLevel:0, score:0, startTime: null, levelStartTime:null, totalTime:0, attempts:0, correct:0, played:0, stickers:[], questionRecords:[] };
  updateStats(); updateStickers(); renderWelcome();
}

function replayInstruction(){
  // speak current banner text as short instruction
  const text = levelBanner.textContent || 'Ready to play CountQuest';
  speak(text);
}

function downloadQuestionCSV(){
  if(state.questionRecords.length===0){ alert('No questions yet — play some levels first.'); return; }
  const headers = ['level','type','prompt','correct','childAnswer','timeSpentSeconds'];
  const rows = state.questionRecords.map(r=>headers.map(h=>JSON.stringify(String(r[h]===undefined? '': r[h]))).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'countquest_questions.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function copySummaryText(){
  const summary = `CountQuest Summary\nScore: ${state.score}\nLevels Played: ${state.played}\nCorrect: ${state.correct}\nTime: ${state.totalTime}s\nStickers: ${state.stickers.join(' ')}`;
  navigator.clipboard?.writeText(summary).then(()=>{ alert('Summary copied to clipboard'); }, ()=>{ alert(summary); });
}

// Tick: update elapsed time display
setInterval(()=>{
  if(state.levelStartTime){ const s = Math.round((Date.now()-state.levelStartTime)/1000); timeEl.textContent = s + 's'; }
}, 500);

// Initialize on load
window.addEventListener('load', init);
