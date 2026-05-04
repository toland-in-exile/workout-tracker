// Workout Tracker — app entry point
'use strict';

// ── Program Structure ───────────────────────────────────
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SPLITS = {
  1: 'backchest',   // Mon
  2: 'bistris',     // Tue
  3: 'legs',        // Wed
  4: 'backchest',   // Thu
  5: 'bistris',     // Fri
  6: 'legs',        // Sat
};
const SPLIT_LABELS = {
  backchest: 'Back & Chest',
  bistris:   'Bis & Tris',
  legs:      'Legs',
};

function getPhase(dayOfWeek) {
  if (dayOfWeek >= 1 && dayOfWeek <= 3) return 'strength';
  if (dayOfWeek >= 4 && dayOfWeek <= 6) return 'endurance';
  return 'rest';
}

function getTodayInfo() {
  const dow = new Date().getDay();
  return {
    dow,
    dayName: DAYS[dow],
    split: SPLITS[dow] || null,
    splitLabel: SPLITS[dow] ? SPLIT_LABELS[SPLITS[dow]] : null,
    phase: getPhase(dow),
  };
}

// ── Settings ────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  restDuration: 90,
  showProgress: true,
  defaultIncrement: 5,
  timerSound: true,
};

function getSettings() {
  const saved = JSON.parse(localStorage.getItem('wt_settings') || '{}');
  return { ...DEFAULT_SETTINGS, ...saved };
}

function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  localStorage.setItem('wt_settings', JSON.stringify(s));
}

// ── Data Layer (localStorage) ───────────────────────────
const Store = {
  _progKey:  'wt_program',
  _histKey:  'wt_history',
  _cardKey:  'wt_cardio',

  getProgram() {
    return JSON.parse(localStorage.getItem(this._progKey) || '{}');
  },
  saveProgram(prog) {
    localStorage.setItem(this._progKey, JSON.stringify(prog));
  },

  getHistory() {
    return JSON.parse(localStorage.getItem(this._histKey) || '[]');
  },
  logSession(session) {
    const hist = this.getHistory();
    session.date = new Date().toISOString();
    hist.unshift(session);
    localStorage.setItem(this._histKey, JSON.stringify(hist));
  },

  getCardio() {
    return JSON.parse(localStorage.getItem(this._cardKey) || '[]');
  },
  logCardio(entry) {
    const list = this.getCardio();
    entry.date = new Date().toISOString();
    list.unshift(entry);
    localStorage.setItem(this._cardKey, JSON.stringify(list));
  },

  _bwKey: 'wt_bodyweight',

  getBodyweight() {
    return JSON.parse(localStorage.getItem(this._bwKey) || '[]');
  },
  logBodyweight(entry) {
    const list = this.getBodyweight();
    list.unshift(entry);
    list.sort((a, b) => new Date(b.date) - new Date(a.date));
    localStorage.setItem(this._bwKey, JSON.stringify(list));
  },
  deleteBodyweight(idx) {
    const list = this.getBodyweight();
    list.splice(idx, 1);
    localStorage.setItem(this._bwKey, JSON.stringify(list));
  },

  // Find the most recent strength session for a given split
  getLastStrengthSession(split) {
    return this.getHistory().find(
      s => s.split === split && s.phase === 'strength'
    ) || null;
  },

  // Find the most recent session of any phase for a split
  getLastSession(split) {
    return this.getHistory().find(s => s.split === split) || null;
  },
};

// ── View Navigation ─────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
  });
}

// ── Home View ───────────────────────────────────────────
function renderHome() {
  const info = getTodayInfo();
  const badge = document.getElementById('phase-badge');
  const label = document.getElementById('today-label');
  const btnText = document.getElementById('btn-today-text');

  badge.textContent = info.phase.toUpperCase();
  badge.className = 'phase-badge ' + info.phase;

  if (info.split) {
    label.textContent = `${info.dayName} — ${info.splitLabel}`;
    btnText.textContent = `Start ${info.splitLabel}`;
    document.getElementById('btn-today').style.display = '';
  } else {
    label.textContent = `${info.dayName} — Rest Day`;
    btnText.textContent = '';
    document.getElementById('btn-today').style.display = 'none';
  }

  renderSchedule();
  renderWeeklySummary();
  renderStreak();
}

function renderSchedule() {
  const today = new Date().getDay();
  const el = document.getElementById('schedule');
  el.innerHTML = DAYS.map((d, i) => {
    const split = SPLITS[i];
    const phase = getPhase(i);
    const isToday = i === today;
    const splitShort = split ? SPLIT_LABELS[split].replace('&', '&amp;') : 'Rest';
    return `<div class="sched-day${isToday ? ' today' : ''}">
      ${d}<span class="sched-split">${splitShort}</span>
    </div>`;
  }).join('');
}

// ── Edit Program ────────────────────────────────────────
let currentEditDay = 'backchest';

function switchEditDay(day) {
  currentEditDay = day;
  document.querySelectorAll('#day-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.day === day);
  });
  renderEditExercises();
}

function renderEditExercises() {
  const prog = Store.getProgram();
  const exercises = prog[currentEditDay] || [];
  const container = document.getElementById('exercise-list');

  container.innerHTML = exercises.map((ex, i) => `
    <div class="exercise-card" data-idx="${i}">
      <div class="exercise-header">
        <div class="flex items-center gap-sm">
          <div class="exercise-reorder">
            <button class="btn-reorder" onclick="reorderExercise(${i}, -1)" ${i === 0 ? 'disabled' : ''}>▲</button>
            <button class="btn-reorder" onclick="reorderExercise(${i}, 1)" ${i === exercises.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
          <span class="text-dim text-sm">Exercise ${i + 1}</span>
        </div>
        <button class="btn-remove" onclick="removeExercise(${i})">Remove</button>
      </div>
      <input type="text" placeholder="Exercise name" data-field="name" value="${ex.name || ''}" list="exercise-suggestions">
      <div class="exercise-row-3 mt-sm">
        <div>
          <label class="label">Sets</label>
          <input type="number" placeholder="3" data-field="sets" min="1" value="${ex.sets || ''}">
        </div>
        <div>
          <label class="label">Reps</label>
          <input type="number" placeholder="10" data-field="reps" min="1" value="${ex.reps || ''}">
        </div>
        <div>
          <label class="label">+lbs</label>
          <input type="number" placeholder="5" data-field="increment" min="0" step="2.5" value="${ex.increment || ''}">
        </div>
      </div>
    </div>`).join('');
}

function addExerciseCard() {
  const prog = Store.getProgram();
  if (!prog[currentEditDay]) prog[currentEditDay] = [];
  prog[currentEditDay].push({ name: '', sets: 3, reps: 10, increment: getSettings().defaultIncrement });
  Store.saveProgram(prog);
  renderEditExercises();
}

function removeExercise(idx) {
  const prog = Store.getProgram();
  prog[currentEditDay].splice(idx, 1);
  Store.saveProgram(prog);
  renderEditExercises();
}

function reorderExercise(idx, direction) {
  saveCurrentTabSilently();
  const prog = Store.getProgram();
  const list = prog[currentEditDay];
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= list.length) return;
  [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
  Store.saveProgram(prog);
  renderEditExercises();
}

function saveProgram() {
  const prog = Store.getProgram();
  const cards = document.querySelectorAll('.exercise-card');
  const exercises = [];

  for (const card of cards) {
    const name = card.querySelector('[data-field="name"]').value.trim();
    const sets = parseInt(card.querySelector('[data-field="sets"]').value) || 3;
    const reps = parseInt(card.querySelector('[data-field="reps"]').value) || 10;
    const increment = parseFloat(card.querySelector('[data-field="increment"]').value) || 5;
    if (!name) { card.querySelector('[data-field="name"]').focus(); return; }
    exercises.push({ name, sets, reps, increment });
  }

  prog[currentEditDay] = exercises;
  Store.saveProgram(prog);
  showView('home');
}

// ── Select Workout ──────────────────────────────────────
function renderWorkoutList() {
  const prog = Store.getProgram();
  const splits = Object.keys(SPLIT_LABELS);
  const container = document.getElementById('workout-list');
  const empty = document.getElementById('no-workouts');

  const available = splits.filter(s => prog[s] && prog[s].length);

  if (!available.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = available.map(s => {
    const exCount = prog[s].length;
    return `
      <div class="workout-item" data-split="${s}">
        <div class="workout-item-info">
          <h3>${SPLIT_LABELS[s]}</h3>
          <p>${exCount} exercise${exCount !== 1 ? 's' : ''}</p>
        </div>
        <span class="workout-item-arrow">›</span>
      </div>`;
  }).join('');

  container.querySelectorAll('.workout-item').forEach(el => {
    el.addEventListener('click', () => startWorkout(el.dataset.split));
  });
}

// ── Active Workout ──────────────────────────────────────
let activeSplit = null;
let activePhase = null;

function startWorkout(split, phaseOverride) {
  const prog = Store.getProgram();
  const exercises = prog[split];
  if (!exercises || !exercises.length) return;

  activeSplit = split;
  activePhase = phaseOverride || getPhase(new Date().getDay());
  // Default to strength if starting on a rest day via manual pick
  if (activePhase === 'rest') activePhase = 'strength';

  document.getElementById('active-workout-title').textContent = SPLIT_LABELS[split];

  // Phase hint
  const hint = document.getElementById('phase-hint');
  const lastStrength = Store.getLastStrengthSession(split);

  if (activePhase === 'strength') {
    hint.innerHTML = `<strong>Strength phase</strong> — bump weight up (+increment), even if you only hit 7-8 reps.`;
  } else {
    if (lastStrength) {
      hint.innerHTML = `<strong>Endurance phase</strong> — match your strength-phase weight and go for max reps.`;
    } else {
      hint.innerHTML = `<strong>Endurance phase</strong> — go for reps at a comfortable weight.`;
    }
  }

  // Build exercise rows with pre-filled weights from last session
  const lastSession = activePhase === 'endurance'
    ? Store.getLastStrengthSession(split)
    : Store.getLastSession(split);

  const includeWarmup = document.getElementById('warmup-check').checked;

  const container = document.getElementById('active-exercise-list');
  container.innerHTML = exercises.map((ex, ei) => {
    // Find last weights for this exercise
    const lastSets = lastSession
      ? lastSession.sets.filter(s => s.exercise === ei)
      : [];

    let setRows = '';

    // Warm-up sets (50% and 75% of working weight)
    if (includeWarmup) {
      const lastWorking = lastSets.length ? lastSets[0].weight : 0;
      const baseWeight = activePhase === 'strength' ? lastWorking + (ex.increment || 5) : lastWorking;
      if (baseWeight > 0) {
        const warmups = [
          { pct: 50, weight: Math.round(baseWeight * 0.5 / 5) * 5 },
          { pct: 75, weight: Math.round(baseWeight * 0.75 / 5) * 5 },
        ];
        warmups.forEach((w, wi) => {
          setRows += `
            <div class="warmup-set">
              <div class="warmup-label">Warm-up ${wi + 1} (${w.pct}%)</div>
              <div class="set-row">
                <span class="set-label">W${wi + 1}</span>
                <input type="number" value="${Math.ceil(ex.reps / 2)}" data-ex="${ei}" data-set="w${wi + 1}" data-field="reps" data-warmup="true">
                <input type="number" value="${w.weight}" data-ex="${ei}" data-set="w${wi + 1}" data-field="weight" data-warmup="true">
                <input type="checkbox" class="set-check" data-ex="${ei}" data-set="w${wi + 1}" data-warmup="true">
              </div>
            </div>`;
        });
      }
    }

    for (let s = 1; s <= ex.sets; s++) {
      const prev = lastSets.find(ls => ls.set === s);
      let prefillWeight = '';

      if (activePhase === 'strength' && prev && prev.weight) {
        prefillWeight = prev.weight + (ex.increment || 5);
      } else if (activePhase === 'endurance' && prev && prev.weight) {
        prefillWeight = prev.weight;
      }

      // Prefill reps: use last session's actual reps if available, otherwise program default
      const prefillReps = prev && prev.reps ? prev.reps : ex.reps;

      setRows += `
        <div class="set-row">
          <span class="set-label">${s}</span>
          <input type="number" value="${prefillReps}" data-ex="${ei}" data-set="${s}" data-field="reps">
          <input type="number" ${prefillWeight ? `value="${prefillWeight}"` : `placeholder="lbs"`} data-ex="${ei}" data-set="${s}" data-field="weight">
          <input type="checkbox" class="set-check" data-ex="${ei}" data-set="${s}">
        </div>`;
    }

    return `
      <div class="active-exercise" data-ex-idx="${ei}">
        <div class="flex justify-between items-center">
          <h3>${ex.name}</h3>
          <span class="text-dim text-sm">+${ex.increment || 5} lbs/wk</span>
        </div>
        <div class="active-sets" data-ex="${ei}">
          ${setRows}
        </div>
        <div class="active-ex-btns mt-sm">
          <button class="btn-add-set" data-ex="${ei}">＋ Add Set</button>
          <button class="btn-finish-ex" data-ex="${ei}">Done ✓</button>
        </div>
      </div>`;
  }).join('');

  wireActiveListeners();
  showView('active');
}

function wireActiveListeners() {
  updateProgress();

  // Checkboxes → rest timer + progress
  document.querySelectorAll('#active-exercise-list .set-check').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) startRestTimer();
      updateProgress();
    });
  });

  // "Done ✓" buttons — check all unchecked sets in that exercise, start timer
  document.querySelectorAll('.btn-finish-ex').forEach(btn => {
    btn.addEventListener('click', () => {
      const ei = btn.dataset.ex;
      const unchecked = document.querySelectorAll(`.active-sets[data-ex="${ei}"] .set-check:not(:checked)`);
      unchecked.forEach(cb => { cb.checked = true; });
      btn.classList.add('finished');
      btn.textContent = 'Done ✓';
      startRestTimer();
      updateProgress();
    });
  });

  // "+ Add Set" buttons
  document.querySelectorAll('.btn-add-set').forEach(btn => {
    btn.addEventListener('click', () => {
      const ei = parseInt(btn.dataset.ex);
      const setsContainer = document.querySelector(`.active-sets[data-ex="${ei}"]`);
      const existing = setsContainer.querySelectorAll('.set-row').length;
      const newSet = existing + 1;

      // Copy weight from last set if available
      const lastWeight = setsContainer.querySelector('.set-row:last-child [data-field="weight"]');
      const prefill = lastWeight ? lastWeight.value : '';
      const prog = Store.getProgram();
      const ex = (prog[activeSplit] || [])[ei];
      const repsPlaceholder = ex ? ex.reps : 10;

      const html = `
        <div class="set-row">
          <span class="set-label">${newSet}</span>
          <input type="number" placeholder="${repsPlaceholder} reps" data-ex="${ei}" data-set="${newSet}" data-field="reps">
          <input type="number" placeholder="${prefill || 'lbs'}" data-ex="${ei}" data-set="${newSet}" data-field="weight"
            ${prefill ? `value="${prefill}"` : ''}>
          <input type="checkbox" class="set-check" data-ex="${ei}" data-set="${newSet}">
        </div>`;
      setsContainer.insertAdjacentHTML('beforeend', html);

      // Wire the new checkbox
      const newCb = setsContainer.querySelector('.set-row:last-child .set-check');
      newCb.addEventListener('change', () => {
        if (newCb.checked) startRestTimer();
        updateProgress();
      });
      updateProgress();
    });
  });
}

function finishWorkout() {
  stopRestTimer();
  if (!activeSplit) return;

  const sets = [];
  document.querySelectorAll('#active-exercise-list .set-row').forEach(row => {
    const repsInput   = row.querySelector('[data-field="reps"]');
    const weightInput = row.querySelector('[data-field="weight"]');
    const checked     = row.querySelector('.set-check').checked;
    const isWarmup    = repsInput.dataset.warmup === 'true';
    sets.push({
      exercise: parseInt(repsInput.dataset.ex),
      set:      isWarmup ? repsInput.dataset.set : parseInt(repsInput.dataset.set),
      reps:     parseInt(repsInput.value) || 0,
      weight:   parseFloat(weightInput.value) || 0,
      done:     checked,
      warmup:   isWarmup,
    });
  });

  const notes = document.getElementById('session-notes').value.trim();

  Store.logSession({
    split: activeSplit,
    splitLabel: SPLIT_LABELS[activeSplit],
    phase: activePhase,
    sets,
    notes,
  });

  document.getElementById('session-notes').value = '';

  activeSplit = null;
  activePhase = null;
  showView('home');
}

// ── Cardio ──────────────────────────────────────────────
function saveCardio() {
  const type     = document.getElementById('cardio-type').value;
  const duration = parseInt(document.getElementById('cardio-duration').value) || 0;
  const distance = parseFloat(document.getElementById('cardio-distance').value) || null;
  const notes    = document.getElementById('cardio-notes').value.trim();

  if (!duration) { document.getElementById('cardio-duration').focus(); return; }

  Store.logCardio({ type, duration, distance, notes });

  // Reset form
  document.getElementById('cardio-duration').value = '';
  document.getElementById('cardio-distance').value = '';
  document.getElementById('cardio-notes').value = '';

  showView('home');
}

// ── History ─────────────────────────────────────────────
let historyFilter = 'all';

function renderHistory() {
  const lifting = Store.getHistory().map((s, i) => ({ ...s, kind: 'lifting', srcIdx: i }));
  const cardio  = Store.getCardio().map((c, i) => ({ ...c, kind: 'cardio', srcIdx: i }));

  let entries;
  if (historyFilter === 'lifting') entries = lifting;
  else if (historyFilter === 'cardio') entries = cardio;
  else entries = [...lifting, ...cardio].sort((a, b) => new Date(b.date) - new Date(a.date));

  const container = document.getElementById('history-list');
  const empty = document.getElementById('no-history');

  if (!entries.length) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = entries.map(entry => {
    if (entry.kind === 'cardio') return renderCardioCard(entry, entry.srcIdx);
    return renderLiftingCard(entry, entry.srcIdx);
  }).join('');

  // Toggle expand on click
  container.querySelectorAll('.history-card-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      hdr.closest('.history-card').classList.toggle('expanded');
    });
  });
}

function renderLiftingCard(session, i) {
  const d = new Date(session.date);
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Group sets by exercise
  const prog = Store.getProgram();
  const exercises = prog[session.split] || [];
  const grouped = {};
  for (const s of session.sets) {
    if (!grouped[s.exercise]) grouped[s.exercise] = [];
    grouped[s.exercise].push(s);
  }

  // Check for PRs in this session
  const prs = detectPRs(session);
  const prNames = new Set(prs.map(p => p.exercise));

  let detailHTML = '';
  for (const [ei, sets] of Object.entries(grouped)) {
    const exName = exercises[ei] ? exercises[ei].name : `Exercise ${parseInt(ei) + 1}`;
    const prBadge = prNames.has(exName) ? ' <span class="pr-badge">🏆 PR</span>' : '';
    const lines = sets.filter(s => !s.warmup).map(s => {
      const cls = s.done ? 'done' : 'skipped';
      return `<div class="history-set-line"><span class="${cls}">Set ${s.set}: ${s.weight} lbs × ${s.reps} reps</span></div>`;
    }).join('');
    detailHTML += `<div class="history-ex"><div class="history-ex-name">${exName}${prBadge}</div>${lines}</div>`;
  }

  const notesHTML = session.notes ? `<div class="history-notes">"${session.notes}"</div>` : '';

  return `
    <div class="history-card" data-idx="${i}" data-kind="lifting">
      <div class="history-card-header">
        <div>
          <h3>${session.splitLabel || session.split}</h3>
          <div class="history-date">${dateStr} · ${timeStr}</div>
        </div>
        <span class="history-phase ${session.phase}">${session.phase}</span>
      </div>
      <div class="history-detail">
        ${detailHTML}
        ${notesHTML}
        <div class="history-actions">
          <button class="btn-edit-session" onclick="editSession('lifting', ${i})">Edit</button>
          <button class="btn-delete-session" onclick="deleteSession('lifting', ${i})">Delete</button>
        </div>
      </div>
    </div>`;
}

function renderCardioCard(entry, i) {
  const d = new Date(entry.date);
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const icons = { run: '🏃', bike: '🚴', row: '🚣', elliptical: '🏋', swim: '🏊', walk: '🚶', other: '💪' };
  const icon = icons[entry.type] || '💪';
  const distStr = entry.distance ? ` · ${entry.distance} mi` : '';

  return `
    <div class="history-card">
      <div class="history-card-header">
        <div>
          <h3><span class="history-cardio-icon">${icon}</span>${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}</h3>
          <div class="history-date">${dateStr}</div>
        </div>
        <span class="history-phase endurance">cardio</span>
      </div>
      <div class="history-cardio-stats">${entry.duration} min${distStr}</div>
      ${entry.notes ? `<div class="history-cardio-notes">"${entry.notes}"</div>` : ''}
      <button class="btn-delete-session" onclick="deleteSession('cardio', ${i})">Delete</button>
    </div>`;
}

// ── Stats / Charts ──────────────────────────────────────
let currentMetric = 'weight';

function getAllExerciseNames() {
  const prog = Store.getProgram();
  const names = [];
  for (const split of Object.keys(SPLIT_LABELS)) {
    const exercises = prog[split] || [];
    for (const ex of exercises) {
      if (ex.name && !names.includes(ex.name)) names.push(ex.name);
    }
  }
  return names;
}

function renderStatsView() {
  const select = document.getElementById('stats-exercise');
  const names = getAllExerciseNames();

  if (!names.length) {
    document.getElementById('no-stats').style.display = 'block';
    document.getElementById('stats-chart').style.display = 'none';
    document.getElementById('stats-summary').style.display = 'none';
    return;
  }

  const prev = select.value;
  select.innerHTML = names.map(n => `<option value="${n}"${n === prev ? ' selected' : ''}>${n}</option>`).join('');
  if (!prev || !names.includes(prev)) select.value = names[0];

  renderChart();
}

function getExerciseData(exName) {
  const history = Store.getHistory();
  const prog = Store.getProgram();
  const points = [];

  // Walk history oldest→newest
  for (let i = history.length - 1; i >= 0; i--) {
    const session = history[i];
    const exercises = prog[session.split] || [];
    const exIdx = exercises.findIndex(e => e.name === exName);
    if (exIdx === -1) continue;

    const exSets = session.sets.filter(s => s.exercise === exIdx);
    const doneSets = exSets.filter(s => s.done);
    if (!doneSets.length) continue;

    const maxWeight = Math.max(...doneSets.map(s => s.weight));
    const totalReps = doneSets.reduce((sum, s) => sum + s.reps, 0);
    const totalVol  = doneSets.reduce((sum, s) => sum + (s.weight * s.reps), 0);

    points.push({
      date: new Date(session.date),
      phase: session.phase,
      weight: maxWeight,
      reps: totalReps,
      volume: totalVol,
      // Carry session detail for popup
      sets: exSets,
      splitLabel: session.splitLabel || session.split,
    });
  }
  return points;
}

// Store rendered dot positions for click detection
let chartDots = [];

function renderChart() {
  const exName = document.getElementById('stats-exercise').value;
  const points = getExerciseData(exName);
  const canvas = document.getElementById('stats-chart');
  const summary = document.getElementById('stats-summary');
  const noStats = document.getElementById('no-stats');

  if (points.length < 1) {
    noStats.style.display = 'block';
    canvas.style.display = 'none';
    summary.style.display = 'none';
    return;
  }

  noStats.style.display = 'none';
  canvas.style.display = 'block';
  summary.style.display = 'block';
  document.getElementById('chart-popup').style.display = 'none';
  chartDots = [];

  // Draw
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = rect.height;
  const pad = { top: 20, right: 15, bottom: 30, left: 45 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  const values = points.map(p => p[currentMetric]);
  const minV = Math.min(...values) * 0.9;
  const maxV = Math.max(...values) * 1.1 || 1;

  function x(i) { return pad.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW); }
  function y(v) { return pad.top + plotH - ((v - minV) / (maxV - minV)) * plotH; }

  // Grid lines
  ctx.strokeStyle = '#1e2d4a';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const gy = pad.top + (i / gridSteps) * plotH;
    ctx.beginPath();
    ctx.moveTo(pad.left, gy);
    ctx.lineTo(W - pad.right, gy);
    ctx.stroke();

    const label = Math.round(maxV - (i / gridSteps) * (maxV - minV));
    ctx.fillStyle = '#7a8baa';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText(label, pad.left - 8, gy + 4);
  }

  // Date labels
  ctx.textAlign = 'center';
  const labelCount = Math.min(points.length, 6);
  const step = Math.max(1, Math.floor(points.length / labelCount));
  for (let i = 0; i < points.length; i += step) {
    const d = points[i].date;
    const lbl = `${d.getMonth() + 1}/${d.getDate()}`;
    ctx.fillStyle = '#7a8baa';
    ctx.fillText(lbl, x(i), H - 8);
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  for (let i = 0; i < points.length; i++) {
    const px = x(i), py = y(values[i]);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Gradient fill under line
  const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.lineTo(x(points.length - 1), pad.top + plotH);
  ctx.lineTo(x(0), pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Dots — color by phase, store positions for click detection
  for (let i = 0; i < points.length; i++) {
    const px = x(i), py = y(values[i]);
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = points[i].phase === 'endurance' ? '#34d399' : '#60a5fa';
    ctx.fill();
    ctx.strokeStyle = '#0a0e1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    chartDots.push({ x: px, y: py, idx: i, point: points[i], exName });
  }

  // Summary stats
  const first = values[0];
  const last = values[values.length - 1];
  const diff = last - first;
  const best = Math.max(...values);
  const metricLabel = currentMetric === 'weight' ? 'lbs' : currentMetric === 'reps' ? 'reps' : 'lbs·reps';
  const diffClass = diff >= 0 ? 'up' : 'down';
  const diffSign = diff >= 0 ? '+' : '';

  summary.innerHTML = `
    <div class="stat-row"><span class="stat-label">Current</span><span class="stat-value">${last} ${metricLabel}</span></div>
    <div class="stat-row"><span class="stat-label">Best</span><span class="stat-value">${best} ${metricLabel}</span></div>
    <div class="stat-row"><span class="stat-label">Change</span><span class="stat-value ${diffClass}">${diffSign}${diff} ${metricLabel}</span></div>
    <div class="stat-row"><span class="stat-label">Sessions</span><span class="stat-value">${points.length}</span></div>`;
}

// ── Chart Click → Session Popup ──────────────────────────
function handleChartClick(e) {
  const canvas = document.getElementById('stats-chart');
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Find nearest dot within 20px tap radius
  let closest = null;
  let closestDist = Infinity;
  for (const dot of chartDots) {
    const dist = Math.sqrt((clickX - dot.x) ** 2 + (clickY - dot.y) ** 2);
    if (dist < closestDist && dist < 25) {
      closest = dot;
      closestDist = dist;
    }
  }

  if (!closest) {
    document.getElementById('chart-popup').style.display = 'none';
    return;
  }

  showChartPopup(closest.point, closest.exName);
}

function showChartPopup(point, exName) {
  const popup = document.getElementById('chart-popup');
  const title = document.getElementById('chart-popup-title');
  const body = document.getElementById('chart-popup-body');

  const d = point.date;
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const phaseClass = point.phase === 'endurance' ? 'endurance' : 'strength';
  const phaseBg = point.phase === 'endurance'
    ? 'background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3)'
    : 'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3)';

  title.textContent = exName;

  let setsHTML = '';
  if (point.sets && point.sets.length) {
    setsHTML = point.sets.map(s => {
      const cls = s.done ? 'done' : 'skipped';
      return `<div class="popup-set-line"><span class="${cls}">Set ${s.set}: ${s.weight} lbs × ${s.reps} reps</span></div>`;
    }).join('');
  }

  body.innerHTML = `
    <div class="popup-date">${dateStr} · ${timeStr}
      <span class="popup-phase" style="${phaseBg}">${point.phase}</span>
    </div>
    ${setsHTML}
    <div style="margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid var(--border)">
      <div class="popup-stat-row"><span class="popup-stat-label">Max Weight</span><span class="popup-stat-value">${point.weight} lbs</span></div>
      <div class="popup-stat-row"><span class="popup-stat-label">Total Reps</span><span class="popup-stat-value">${point.reps}</span></div>
      <div class="popup-stat-row"><span class="popup-stat-label">Volume</span><span class="popup-stat-value">${point.volume} lbs·reps</span></div>
    </div>`;

  popup.style.display = 'block';
}

// ── Weekly Summary ──────────────────────────────────────
function renderWeeklySummary() {
  const history = Store.getHistory();
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun

  // Find start of this week (Monday)
  const monday = new Date(now);
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  // Check which days have sessions this week
  const completedDays = new Set();
  for (const session of history) {
    const sd = new Date(session.date);
    if (sd >= monday) {
      completedDays.add(sd.getDay());
    }
  }

  const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const dayNums = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 through Sun=0

  const el = document.getElementById('week-summary');
  el.innerHTML = dayLabels.map((label, i) => {
    const dNum = dayNums[i];
    const done = completedDays.has(dNum);
    const isToday = dNum === dayOfWeek;
    let cls = 'week-summary-day';
    if (done) cls += ' completed';
    if (isToday) cls += ' today';
    const check = done ? '✓' : (dNum === 0 ? '—' : '○');
    return `<div class="${cls}"><span class="summary-check">${check}</span>${label}</div>`;
  }).join('');
}

// ── Edit History Session ────────────────────────────────
function editSession(kind, idx) {
  if (kind !== 'lifting') return;
  const hist = Store.getHistory();
  const session = hist[idx];
  if (!session) return;

  const prog = Store.getProgram();
  const exercises = prog[session.split] || [];

  const card = document.querySelector(`.history-card[data-idx="${idx}"][data-kind="lifting"]`);
  if (!card) return;
  const detail = card.querySelector('.history-detail');

  // Group sets by exercise
  const grouped = {};
  for (const s of session.sets) {
    if (!grouped[s.exercise]) grouped[s.exercise] = [];
    grouped[s.exercise].push(s);
  }

  let editHTML = '';
  for (const [ei, sets] of Object.entries(grouped)) {
    const exName = exercises[ei] ? exercises[ei].name : `Exercise ${parseInt(ei) + 1}`;
    const rows = sets.map(s => `
      <div class="history-edit-row">
        <span class="set-label">${s.set}</span>
        <input type="number" value="${s.reps}" data-ex="${ei}" data-set="${s.set}" data-field="reps">
        <input type="number" value="${s.weight}" data-ex="${ei}" data-set="${s.set}" data-field="weight">
        <input type="checkbox" class="set-check" data-ex="${ei}" data-set="${s.set}" ${s.done ? 'checked' : ''}>
      </div>`).join('');
    editHTML += `<div class="history-ex"><div class="history-ex-name">${exName}</div>${rows}</div>`;
  }

  editHTML += `
    <div class="card mt-sm">
      <label class="label">Notes</label>
      <input type="text" id="edit-notes-${idx}" value="${session.notes || ''}" placeholder="Session notes...">
    </div>
    <div class="history-actions mt-sm">
      <button class="btn-outline" onclick="renderHistory()">Cancel</button>
      <button class="btn-primary" onclick="saveEditSession(${idx})">Save</button>
    </div>`;

  detail.innerHTML = editHTML;
  card.classList.add('expanded');
}

function saveEditSession(idx) {
  const hist = Store.getHistory();
  const session = hist[idx];
  const card = document.querySelector(`.history-card[data-idx="${idx}"][data-kind="lifting"]`);

  const newSets = [];
  card.querySelectorAll('.history-edit-row').forEach(row => {
    const repsInput = row.querySelector('[data-field="reps"]');
    const weightInput = row.querySelector('[data-field="weight"]');
    const checked = row.querySelector('.set-check').checked;
    newSets.push({
      exercise: parseInt(repsInput.dataset.ex),
      set: parseInt(repsInput.dataset.set),
      reps: parseInt(repsInput.value) || 0,
      weight: parseFloat(weightInput.value) || 0,
      done: checked,
    });
  });

  session.sets = newSets;
  session.notes = document.getElementById(`edit-notes-${idx}`).value.trim();
  localStorage.setItem('wt_history', JSON.stringify(hist));
  renderHistory();
}

// ── Confirmation Modal ──────────────────────────────────
let modalResolve = null;

function confirm(msg) {
  return new Promise(resolve => {
    modalResolve = resolve;
    document.getElementById('modal-msg').textContent = msg;
    document.getElementById('modal').style.display = 'flex';
  });
}

function closeModal(result) {
  document.getElementById('modal').style.display = 'none';
  if (modalResolve) { modalResolve(result); modalResolve = null; }
}

// ── Rest Timer ──────────────────────────────────────────
let restInterval = null;
let restRemaining = 0;
let restTotal = 90;

function startRestTimer() {
  const sel = document.getElementById('rest-duration');
  restTotal = parseInt(sel.value) || getSettings().restDuration;
  saveSetting('restDuration', restTotal);
  restRemaining = restTotal;
  const el = document.getElementById('rest-timer');
  const countEl = document.getElementById('rest-count');
  const ringEl = document.getElementById('ring-fg');
  const circumference = 2 * Math.PI * 45; // r=45

  el.style.display = 'flex';
  countEl.textContent = restRemaining;
  ringEl.style.strokeDashoffset = '0';

  clearInterval(restInterval);
  restInterval = setInterval(() => {
    restRemaining--;
    countEl.textContent = restRemaining;
    const progress = 1 - (restRemaining / restTotal);
    ringEl.style.strokeDashoffset = (progress * circumference).toFixed(1);

    if (restRemaining <= 0) {
      timerAlert();
      stopRestTimer();
    }
  }, 1000);
}

function stopRestTimer() {
  clearInterval(restInterval);
  restInterval = null;
  document.getElementById('rest-timer').style.display = 'none';
}

function timerAlert() {
  if (!getSettings().timerSound) return;

  // Vibrate
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);

  // Beep using Web Audio API
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(delay => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.15);
    });
  } catch (e) {}
}

// ── Export / Import ─────────────────────────────────────
function exportData() {
  const data = {
    program:  Store.getProgram(),
    history:  Store.getHistory(),
    cardio:   Store.getCardio(),
    bodyweight: Store.getBodyweight(),
    exported: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(file) {
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { alert('Invalid JSON file.'); return; }

  const ok = await confirm(`Import will replace all current data. Continue?`);
  if (!ok) return;

  if (data.program)    Store.saveProgram(data.program);
  if (data.history)    localStorage.setItem('wt_history', JSON.stringify(data.history));
  if (data.cardio)     localStorage.setItem('wt_cardio', JSON.stringify(data.cardio));
  if (data.bodyweight) localStorage.setItem('wt_bodyweight', JSON.stringify(data.bodyweight));

  renderHome();
  showView('home');
}

// ── Delete Session ──────────────────────────────────────
async function deleteSession(kind, idx) {
  const ok = await confirm('Delete this entry from history?');
  if (!ok) return;

  if (kind === 'lifting') {
    const hist = Store.getHistory();
    hist.splice(idx, 1);
    localStorage.setItem('wt_history', JSON.stringify(hist));
  } else {
    const cardio = Store.getCardio();
    cardio.splice(idx, 1);
    localStorage.setItem('wt_cardio', JSON.stringify(cardio));
  }
  renderHistory();
}

// ── Progress Tracker ────────────────────────────────────
function updateProgress() {
  const settings = getSettings();
  const wrap = document.getElementById('progress-wrap');
  if (!settings.showProgress) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';

  const total = document.querySelectorAll('#active-exercise-list .set-check').length;
  const done = document.querySelectorAll('#active-exercise-list .set-check:checked').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${done}/${total} — ${pct}%`;
}

// ── Settings View ───────────────────────────────────────
function loadSettingsView() {
  const s = getSettings();
  document.getElementById('setting-rest').value = s.restDuration;
  document.getElementById('setting-progress').checked = s.showProgress;
  document.getElementById('setting-increment').value = s.defaultIncrement;
  document.getElementById('setting-sound').checked = s.timerSound;
}

function wireSettingsListeners() {
  document.getElementById('setting-rest').addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    saveSetting('restDuration', val);
    document.getElementById('rest-duration').value = val;
  });

  document.getElementById('setting-progress').addEventListener('change', (e) => {
    saveSetting('showProgress', e.target.checked);
  });

  document.getElementById('setting-increment').addEventListener('change', (e) => {
    saveSetting('defaultIncrement', parseFloat(e.target.value) || 5);
  });

  document.getElementById('setting-sound').addEventListener('change', (e) => {
    saveSetting('timerSound', e.target.checked);
  });

  document.getElementById('settings-export').addEventListener('click', exportData);

  document.getElementById('settings-import-trigger').addEventListener('click', () => {
    document.getElementById('settings-import').click();
  });
  document.getElementById('settings-import').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  document.getElementById('settings-clear').addEventListener('click', async () => {
    const ok = await confirm('This will permanently delete ALL workouts, history, and settings. Are you sure?');
    if (!ok) return;
    localStorage.removeItem('wt_program');
    localStorage.removeItem('wt_history');
    localStorage.removeItem('wt_cardio');
    localStorage.removeItem('wt_settings');
    renderHome();
    showView('home');
  });
}

// ── PR Detection ────────────────────────────────────────
function detectPRs(session) {
  const history = Store.getHistory();
  const prog = Store.getProgram();
  const exercises = prog[session.split] || [];
  const prs = [];

  for (let ei = 0; ei < exercises.length; ei++) {
    const currentSets = session.sets.filter(s => s.exercise === ei && s.done && !s.warmup);
    if (!currentSets.length) continue;

    const currentMax = Math.max(...currentSets.map(s => s.weight));

    // Check all prior sessions for this exercise
    let prevMax = 0;
    for (const prev of history) {
      if (prev.date === session.date) continue;
      const prevExercises = prog[prev.split] || [];
      const prevIdx = prevExercises.findIndex(e => e.name === exercises[ei].name);
      if (prevIdx === -1) continue;
      const prevSets = prev.sets.filter(s => s.exercise === prevIdx && s.done && !s.warmup);
      if (prevSets.length) prevMax = Math.max(prevMax, ...prevSets.map(s => s.weight));
    }

    if (currentMax > prevMax && prevMax > 0) {
      prs.push({ exercise: exercises[ei].name, weight: currentMax, prev: prevMax });
    }
  }
  return prs;
}

function getPRsForExercise(exName) {
  const history = Store.getHistory();
  const prog = Store.getProgram();
  let maxWeight = 0;
  let prDate = null;

  for (const session of history) {
    const exercises = prog[session.split] || [];
    const exIdx = exercises.findIndex(e => e.name === exName);
    if (exIdx === -1) continue;
    const sets = session.sets.filter(s => s.exercise === exIdx && s.done && !s.warmup);
    if (!sets.length) continue;
    const sessionMax = Math.max(...sets.map(s => s.weight));
    if (sessionMax > maxWeight) {
      maxWeight = sessionMax;
      prDate = session.date;
    }
  }
  return { weight: maxWeight, date: prDate };
}

// ── Streak Calculation ──────────────────────────────────
function calculateStreak() {
  const history = Store.getHistory();
  if (!history.length) return 0;

  // Get unique workout dates (as date strings)
  const dates = [...new Set(history.map(s => s.date.slice(0, 10)))].sort().reverse();
  if (!dates.length) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i <= 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - i);
    const checkStr = checkDate.toISOString().slice(0, 10);
    const dow = checkDate.getDay();

    // Skip rest days (Sunday)
    if (dow === 0) continue;

    if (dates.includes(checkStr)) {
      streak++;
    } else {
      // Allow today to be incomplete if it's not over yet
      if (i === 0) continue;
      break;
    }
  }
  return streak;
}

function renderStreak() {
  const streak = calculateStreak();
  const el = document.getElementById('streak-count');
  el.textContent = `${streak} day${streak !== 1 ? 's' : ''}`;
}

// ── Plate Calculator ────────────────────────────────────
const PLATE_SIZES = [45, 35, 25, 10, 5, 2.5];
const PLATE_COLORS = {
  45: { bg: '#1d4ed8', h: 50 },
  35: { bg: '#7c3aed', h: 44 },
  25: { bg: '#059669', h: 38 },
  10: { bg: '#d97706', h: 32 },
  5:  { bg: '#dc2626', h: 26 },
  2.5:{ bg: '#6b7280', h: 20 },
};

function calculatePlates() {
  const target = parseFloat(document.getElementById('plate-target').value) || 0;
  const bar = parseFloat(document.getElementById('plate-bar').value) || 45;
  const resultDiv = document.getElementById('plate-result');
  const breakdownDiv = document.getElementById('plate-breakdown');
  const visualDiv = document.getElementById('plate-visual');

  if (target <= bar) {
    resultDiv.style.display = 'none';
    return;
  }

  let perSide = (target - bar) / 2;
  const plates = [];

  for (const size of PLATE_SIZES) {
    const count = Math.floor(perSide / size);
    if (count > 0) {
      plates.push({ size, count });
      perSide -= count * size;
    }
  }

  resultDiv.style.display = 'block';
  breakdownDiv.innerHTML = plates.map(p =>
    `<div class="plate-row"><span>${p.size} lbs</span><span class="plate-count">× ${p.count}</span></div>`
  ).join('') + (perSide > 0 ? `<div class="plate-row text-dim"><span>Remaining: ${perSide} lbs (no plate match)</span></div>` : '');

  // Visual
  let visualHTML = '';
  const allPlates = [];
  for (const p of plates) {
    for (let i = 0; i < p.count; i++) allPlates.push(p.size);
  }
  const reversed = [...allPlates].reverse();
  reversed.forEach(size => {
    const c = PLATE_COLORS[size];
    visualHTML += `<div class="plate-disc" style="background:${c.bg};height:${c.h}px;width:${Math.max(18, size / 2)}px">${size}</div>`;
  });
  visualHTML += `<div class="plate-bar-visual"></div>`;
  allPlates.forEach(size => {
    const c = PLATE_COLORS[size];
    visualHTML += `<div class="plate-disc" style="background:${c.bg};height:${c.h}px;width:${Math.max(18, size / 2)}px">${size}</div>`;
  });
  visualDiv.innerHTML = visualHTML;
}

// ── Bodyweight Tracking ─────────────────────────────────
function renderBodyweightView() {
  document.getElementById('bw-date').value = new Date().toISOString().slice(0, 10);
  renderBWHistory();
  renderBWChart();
}

function saveBodyweight() {
  const weight = parseFloat(document.getElementById('bw-weight').value);
  const date = document.getElementById('bw-date').value;
  if (!weight) { document.getElementById('bw-weight').focus(); return; }

  Store.logBodyweight({ weight, date: date || new Date().toISOString().slice(0, 10) });
  document.getElementById('bw-weight').value = '';
  renderBWHistory();
  renderBWChart();
}

function renderBWHistory() {
  const list = Store.getBodyweight();
  const container = document.getElementById('bw-history');
  if (!list.length) { container.innerHTML = '<p class="text-dim text-sm" style="text-align:center">No entries yet.</p>'; return; }

  container.innerHTML = '<div class="card">' + list.slice(0, 20).map((e, i) => {
    const d = new Date(e.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `<div class="bw-entry">
      <span class="bw-weight">${e.weight} lbs</span>
      <span class="bw-date">${dateStr}</span>
      <button class="bw-delete" onclick="deleteBW(${i})">✕</button>
    </div>`;
  }).join('') + '</div>';
}

function deleteBW(idx) {
  Store.deleteBodyweight(idx);
  renderBWHistory();
  renderBWChart();
}

function renderBWChart() {
  const list = Store.getBodyweight();
  const canvas = document.getElementById('bw-chart');
  const ctx = canvas.getContext('2d');

  if (list.length < 2) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const points = [...list].reverse();
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width, H = rect.height;
  const pad = { top: 15, right: 15, bottom: 25, left: 40 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  ctx.clearRect(0, 0, W, H);

  const values = points.map(p => p.weight);
  const minV = Math.min(...values) - 2;
  const maxV = Math.max(...values) + 2;
  const x = i => pad.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = v => pad.top + plotH - ((v - minV) / (maxV - minV)) * plotH;

  // Grid
  ctx.strokeStyle = '#1e2d4a'; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const gy = pad.top + (i / 3) * plotH;
    ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(W - pad.right, gy); ctx.stroke();
    ctx.fillStyle = '#7a8baa'; ctx.font = '11px system-ui'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxV - (i / 3) * (maxV - minV)), pad.left - 6, gy + 4);
  }

  // Line
  ctx.beginPath(); ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  points.forEach((p, i) => { i === 0 ? ctx.moveTo(x(i), y(p.weight)) : ctx.lineTo(x(i), y(p.weight)); });
  ctx.stroke();

  // Fill
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  grad.addColorStop(0, 'rgba(168,85,247,0.25)'); grad.addColorStop(1, 'rgba(168,85,247,0)');
  ctx.lineTo(x(points.length - 1), pad.top + plotH); ctx.lineTo(x(0), pad.top + plotH);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  // Dots
  points.forEach((p, i) => {
    ctx.beginPath(); ctx.arc(x(i), y(p.weight), 4, 0, Math.PI * 2);
    ctx.fillStyle = '#a855f7'; ctx.fill();
    ctx.strokeStyle = '#0a0e1a'; ctx.lineWidth = 2; ctx.stroke();
  });
}

// ── Event Wiring ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderHome();

  // Load settings
  const settings = getSettings();
  document.getElementById('rest-duration').value = settings.restDuration;
  restTotal = settings.restDuration;
  wireSettingsListeners();

  // Settings gear
  document.getElementById('btn-settings').addEventListener('click', () => {
    loadSettingsView();
    showView('settings');
  });

  // Home buttons
  document.getElementById('btn-today').addEventListener('click', () => {
    const info = getTodayInfo();
    if (info.split) startWorkout(info.split, info.phase);
  });

  document.getElementById('btn-select').addEventListener('click', () => {
    renderWorkoutList();
    showView('select');
  });

  document.getElementById('btn-cardio-open').addEventListener('click', () => {
    showView('cardio');
  });

  document.getElementById('btn-bodyweight-open').addEventListener('click', () => {
    renderBodyweightView();
    showView('bodyweight');
  });

  // Plate calculator
  document.getElementById('btn-plate-calc').addEventListener('click', () => {
    showView('platecalc');
  });
  document.getElementById('plate-target').addEventListener('input', calculatePlates);
  document.getElementById('plate-bar').addEventListener('input', calculatePlates);

  // Bodyweight
  document.getElementById('btn-save-bw').addEventListener('click', saveBodyweight);

  document.getElementById('btn-create').addEventListener('click', () => {
    currentEditDay = 'backchest';
    switchEditDay('backchest');
    showView('create');
  });

  // Day tabs in edit view
  document.querySelectorAll('#day-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Save current tab's exercises before switching
      saveCurrentTabSilently();
      switchEditDay(tab.dataset.day);
    });
  });

  // Create view
  document.getElementById('btn-add-exercise').addEventListener('click', addExerciseCard);
  document.getElementById('btn-save-workout').addEventListener('click', saveProgram);

  // Active view
  document.getElementById('btn-finish-workout').addEventListener('click', async () => {
    const ok = await confirm('Finish and log this workout?');
    if (ok) finishWorkout();
  });

  // Rest timer
  document.getElementById('rest-skip').addEventListener('click', stopRestTimer);
  document.getElementById('rest-duration').addEventListener('change', () => {
    if (restInterval) startRestTimer(); // restart with new duration
  });

  // Cardio
  document.getElementById('btn-save-cardio').addEventListener('click', saveCardio);

  // Modal buttons
  document.getElementById('modal-confirm').addEventListener('click', () => closeModal(true));
  document.getElementById('modal-cancel').addEventListener('click', () => closeModal(false));

  // Back buttons
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      renderHome();
      showView(btn.dataset.goto);
    });
  });

  // History tabs
  document.querySelectorAll('#history-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#history-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      historyFilter = tab.dataset.htab;
      renderHistory();
    });
  });

  // Stats controls
  document.getElementById('stats-exercise').addEventListener('change', renderChart);
  document.getElementById('stats-chart').addEventListener('click', handleChartClick);
  document.getElementById('chart-popup-close').addEventListener('click', () => {
    document.getElementById('chart-popup').style.display = 'none';
  });

  document.querySelectorAll('.stats-toggle .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.stats-toggle .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMetric = tab.dataset.metric;
      renderChart();
    });
  });

  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'home') renderHome();
      if (btn.dataset.view === 'select') renderWorkoutList();
      if (btn.dataset.view === 'history') renderHistory();
      if (btn.dataset.view === 'stats') renderStatsView();
      showView(btn.dataset.view);
    });
  });

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});

// Silently persist current tab exercises when switching tabs
function saveCurrentTabSilently() {
  const prog = Store.getProgram();
  const cards = document.querySelectorAll('.exercise-card');
  if (!cards.length) return;

  const exercises = [];
  for (const card of cards) {
    const name = card.querySelector('[data-field="name"]').value.trim();
    const sets = parseInt(card.querySelector('[data-field="sets"]').value) || 3;
    const reps = parseInt(card.querySelector('[data-field="reps"]').value) || 10;
    const increment = parseFloat(card.querySelector('[data-field="increment"]').value) || 5;
    exercises.push({ name, sets, reps, increment });
  }

  prog[currentEditDay] = exercises;
  Store.saveProgram(prog);
}
