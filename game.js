/* ==========================================================================
   Turbo Times! (Up to 10 × 10) — Grade 3 Multiplication Game Engine
   ========================================================================== */

(function () {
  const STORAGE_KEYS = {
    bestStreak: 'turbotimes_best_streak_v1',
    highScore: 'turbotimes_high_score_v1',
    mastery: 'turbotimes_mastery_10x10_v1'
  };

  // Persistent Player Progress
  const store = {
    bestStreak: parseInt(localStorage.getItem(STORAGE_KEYS.bestStreak) || '0', 10),
    highScore: parseInt(localStorage.getItem(STORAGE_KEYS.highScore) || '0', 10),
    mastery: JSON.parse(localStorage.getItem(STORAGE_KEYS.mastery) || '{}')
  };

  function saveProgress() {
    localStorage.setItem(STORAGE_KEYS.bestStreak, String(store.bestStreak));
    localStorage.setItem(STORAGE_KEYS.highScore, String(store.highScore));
    localStorage.setItem(STORAGE_KEYS.mastery, JSON.stringify(store.mastery));
  }

  function countMasteredFacts() {
    let count = 0;
    for (let a = 1; a <= 10; a++) {
      for (let b = 1; b <= 10; b++) {
        if ((store.mastery[`${a}x${b}`] || 0) >= 1) count++;
      }
    }
    return count;
  }

  // Game Configuration & Live State
  const config = {
    timerMode: 'blitz60',    // 'blitz60' | 'rush90' | 'card10'
    inputMode: 'choices',    // 'choices' | 'keypad'
    selectedTables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  };

  const state = {
    active: false,
    locked: false,
    score: 0,
    streak: 0,
    roundBestStreak: 0,
    hasShield: false,
    correctCount: 0,
    attemptCount: 0,
    cardsRemaining: 20,
    timeTotal: 60,
    timeRemaining: 60,
    lastTickWholeSec: 60,
    rafId: null,
    lastFrameTs: 0,
    currentQ: null,          // { a, b, answer, choices }
    typedBuffer: '',
    recentKeys: [],
    retryQueue: [],          // [{ a, b, dueIn }]
    missedThisRound: new Map()
  };

  // ==========================================================================
  // Particle Celebration Engine (Canvas)
  // ==========================================================================
  const canvas = document.getElementById('fx-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function spawnBurst(x, y, count = 28) {
    const palette = ['#FF5A36', '#FFB800', '#16B378', '#1496E6', '#182232'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = 3 + Math.random() * 6.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.2,
        size: 5 + Math.random() * 6,
        color: palette[i % palette.length],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.25,
        life: 1,
        decay: 0.016 + Math.random() * 0.014
      });
    }
    if (particles.length === count) {
      requestAnimationFrame(stepParticles);
    }
  }

  function stepParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.rot += p.vrot;
      p.life -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.72);
      ctx.restore();
    }
    if (particles.length > 0) {
      requestAnimationFrame(stepParticles);
    }
  }

  // ==========================================================================
  // Dynamic Mascot SVG Renderer
  // ==========================================================================
  function getMascotSVG(streak, mood = 'ready') {
    const hasCrown = streak >= 20;
    const hasShades = streak >= 10;
    const isStarry = streak >= 5 && streak < 10;

    let eyesMarkup = `
      <circle cx="23" cy="29" r="3.2" fill="#182232"/>
      <circle cx="41" cy="29" r="3.2" fill="#182232"/>
      <circle cx="24" cy="27.8" r="1.1" fill="#FFF"/>
      <circle cx="42" cy="27.8" r="1.1" fill="#FFF"/>
    `;

    if (mood === 'oops') {
      eyesMarkup = `
        <path d="M20 27 L26 31 M26 27 L20 31" stroke="#182232" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M38 27 L44 31 M44 27 L38 31" stroke="#182232" stroke-width="2.6" stroke-linecap="round"/>
      `;
    } else if (hasShades) {
      eyesMarkup = `
        <rect x="16" y="25" width="13" height="8" rx="2.5" fill="#182232"/>
        <rect x="35" y="25" width="13" height="8" rx="2.5" fill="#182232"/>
        <line x1="29" y1="28" x2="35" y2="28" stroke="#182232" stroke-width="2.5"/>
        <line x1="18" y1="27" x2="22" y2="27" stroke="#FFF" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="37" y1="27" x2="41" y2="27" stroke="#FFF" stroke-width="1.5" stroke-linecap="round"/>
      `;
    } else if (isStarry) {
      eyesMarkup = `
        <circle cx="23" cy="29" r="3.8" fill="#182232"/>
        <circle cx="41" cy="29" r="3.8" fill="#182232"/>
        <circle cx="23" cy="29" r="1.8" fill="#FFB800"/>
        <circle cx="41" cy="29" r="1.8" fill="#FFB800"/>
      `;
    }

    const mouthMarkup = mood === 'oops'
      ? `<path d="M28 39 Q32 36 36 39" stroke="#182232" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
      : `<path d="M26 36 Q32 42 38 36" stroke="#182232" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;

    const crownMarkup = hasCrown
      ? `<polygon points="20,13 24,4 32,10 40,4 44,13" fill="#FFB800" stroke="#182232" stroke-width="2" stroke-linejoin="round"/>`
      : '';

    return `
      <svg width="54" height="54" viewBox="0 0 64 56" aria-hidden="true">
        <!-- Fox Ears -->
        <polygon points="14,22 10,7 25,15" fill="#FF5A36" stroke="#182232" stroke-width="2.4" stroke-linejoin="round"/>
        <polygon points="50,22 54,7 39,15" fill="#FF5A36" stroke="#182232" stroke-width="2.4" stroke-linejoin="round"/>
        <!-- Head -->
        <rect x="12" y="14" width="40" height="34" rx="16" fill="#FF5A36" stroke="#182232" stroke-width="2.4"/>
        <!-- Cheek Cream Patch -->
        <path d="M14 33 Q23 29 32 35 Q41 29 50 33 Q49 47 32 47 Q15 47 14 33 Z" fill="#FAF7F0"/>
        ${crownMarkup}
        ${eyesMarkup}
        <!-- Nose -->
        <ellipse cx="32" cy="33.5" rx="3" ry="2.1" fill="#182232"/>
        ${mouthMarkup}
      </svg>
    `;
  }

  // ==========================================================================
  // Adaptive Grade 3 Question Generator (1 × 1 up to 10 × 10)
  // ==========================================================================
  function generateChoices(a, b, answer) {
    const set = new Set([answer]);
    const candidates = [
      a * Math.max(1, b - 1),
      a * Math.min(10, b + 1),
      Math.max(1, a - 1) * b,
      Math.min(10, a + 1) * b,
      answer + a,
      answer - a,
      answer + b,
      answer - b,
      answer + 2,
      answer - 2,
      answer + 10,
      Math.max(1, answer - 10)
    ].filter((n) => n >= 1 && n <= 100 && n !== answer);

    // Shuffle candidates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (const c of candidates) {
      if (set.size >= 4) break;
      set.add(c);
    }

    while (set.size < 4) {
      const rnd = Math.floor(Math.random() * 100) + 1;
      if (rnd !== answer) set.add(rnd);
    }

    const arr = Array.from(set);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function nextQuestion() {
    // Decrement retry queue timers
    for (const item of state.retryQueue) {
      item.dueIn -= 1;
    }

    const dueIdx = state.retryQueue.findIndex((item) => item.dueIn <= 0);
    let a, b;

    if (dueIdx !== -1) {
      const due = state.retryQueue.splice(dueIdx, 1)[0];
      a = due.a;
      b = due.b;
    } else {
      const tables = config.selectedTables.length > 0
        ? config.selectedTables
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // Build candidate pool with slight boost to 3..9 facts when all tables are selected
      let bestPair = null;
      for (let attempt = 0; attempt < 18; attempt++) {
        const t = tables[Math.floor(Math.random() * tables.length)];
        // Slightly favor 2..10 over 1 so Grade 3 stays exciting while still including ×1!
        const otherPool = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
        const other = otherPool[Math.floor(Math.random() * otherPool.length)];
        const swap = Math.random() < 0.5;
        const candA = swap ? other : t;
        const candB = swap ? t : other;
        const key = `${candA}x${candB}`;

        if (!state.recentKeys.includes(key)) {
          bestPair = [candA, candB];
          break;
        }
        bestPair = [candA, candB];
      }
      [a, b] = bestPair;
    }

    const key = `${a}x${b}`;
    state.recentKeys.push(key);
    if (state.recentKeys.length > 5) state.recentKeys.shift();

    const answer = a * b;
    state.currentQ = {
      a,
      b,
      answer,
      choices: generateChoices(a, b, answer)
    };
    state.typedBuffer = '';

    if (config.timerMode === 'card10') {
      state.timeTotal = 10;
      state.timeRemaining = 10;
      state.lastTickWholeSec = 10;
    }

    renderQuestion();
  }

  // ==========================================================================
  // DOM References
  // ==========================================================================
  const els = {
    screenHome: document.getElementById('screen-home'),
    screenPlay: document.getElementById('screen-play'),
    screenSummary: document.getElementById('screen-summary'),

    homeMascot: document.getElementById('home-mascot'),
    recBestStreak: document.getElementById('rec-best-streak'),
    recHighScore: document.getElementById('rec-high-score'),
    recMastered: document.getElementById('rec-mastered'),

    timerPills: document.querySelectorAll('[data-timer-mode]'),
    inputPills: document.querySelectorAll('[data-input-mode]'),
    tablesContainer: document.getElementById('tables-selector'),
    btnAllTables: document.getElementById('btn-all-tables'),
    btnStart: document.getElementById('btn-start-game'),

    btnSound: document.getElementById('btn-sound'),
    btnMastery: document.getElementById('btn-mastery'),
    btnHomeTop: document.getElementById('btn-home-top'),

    hudScore: document.getElementById('hud-score'),
    streakBadge: document.getElementById('streak-badge'),
    streakFire: document.getElementById('streak-fire'),
    hudStreak: document.getElementById('hud-streak'),
    hudMult: document.getElementById('hud-mult'),
    shieldIcon: document.getElementById('shield-indicator'),
    hudBestLabel: document.getElementById('hud-right-label'),
    hudBestVal: document.getElementById('hud-right-val'),

    timerFill: document.getElementById('timer-fill'),
    timerSeconds: document.getElementById('timer-seconds'),

    arenaBox: document.getElementById('problem-arena'),
    playMascot: document.getElementById('play-mascot'),
    streakCallout: document.getElementById('streak-callout'),
    eqFactorA: document.getElementById('eq-a'),
    eqFactorB: document.getElementById('eq-b'),
    eqSlot: document.getElementById('eq-slot'),
    learningHelper: document.getElementById('learning-helper'),

    choicesGrid: document.getElementById('choices-grid'),
    keypadWrap: document.getElementById('keypad-wrap'),

    sumBadge: document.getElementById('sum-badge'),
    sumTitle: document.getElementById('sum-title'),
    sumScore: document.getElementById('sum-score'),
    sumBestStreak: document.getElementById('sum-best-streak'),
    sumSolved: document.getElementById('sum-solved'),
    sumAccuracy: document.getElementById('sum-accuracy'),
    trickyBox: document.getElementById('tricky-box'),
    trickyTitle: document.getElementById('tricky-title'),
    trickyPills: document.getElementById('tricky-pills'),
    btnPlayAgain: document.getElementById('btn-play-again'),
    btnBackSetup: document.getElementById('btn-back-setup'),

    modalMastery: document.getElementById('modal-mastery'),
    btnCloseMastery: document.getElementById('btn-close-mastery'),
    masteryGrid: document.getElementById('mastery-grid'),
    masteryProgressText: document.getElementById('mastery-progress-text'),
    btnResetStats: document.getElementById('btn-reset-stats')
  };

  // ==========================================================================
  // UI Rendering Helpers
  // ==========================================================================
  function showScreen(name) {
    els.screenHome.classList.toggle('active', name === 'home');
    els.screenPlay.classList.toggle('active', name === 'play');
    els.screenSummary.classList.toggle('active', name === 'summary');
    els.btnHomeTop.style.display = name === 'home' ? 'none' : 'inline-flex';
  }

  function refreshHomeStats() {
    els.homeMascot.innerHTML = getMascotSVG(store.bestStreak, 'ready');
    els.recBestStreak.textContent = `${store.bestStreak} 🔥`;
    els.recHighScore.textContent = store.highScore.toLocaleString();
    els.recMastered.textContent = `${countMasteredFacts()} / 100`;
    els.btnSound.textContent = window.arcadeAudio.muted ? '🔇 Muted' : '🔊 Sound';
  }

  function getMultiplier(streak) {
    if (streak >= 20) return 5;
    if (streak >= 10) return 4;
    if (streak >= 5) return 3;
    if (streak >= 3) return 2;
    return 1;
  }

  function getStreakStatusText(streak) {
    if (streak >= 20) return '👑 UNSTOPPABLE LEGEND!';
    if (streak >= 10) return '🚀 BLAZING STREAK! Cool Shades On!';
    if (streak >= 5) return '🔥 SIZZLING STREAK! Keep Rolling!';
    if (streak >= 3) return '⚡ Nice Combo! Heating Up!';
    if (streak >= 1) return '✨ Good Start! Build That Streak!';
    return '🎯 Ready, Set, Multiply!';
  }

  function updateHUD(mood = 'ready') {
    const mult = getMultiplier(state.streak);
    els.hudScore.textContent = state.score.toLocaleString();
    els.hudStreak.textContent = state.streak;
    els.hudMult.textContent = `${mult}×`;

    els.streakBadge.classList.toggle('tier-hot', state.streak >= 5 && state.streak < 20);
    els.streakBadge.classList.toggle('tier-legend', state.streak >= 20);
    els.streakFire.textContent = state.streak >= 20 ? '👑' : state.streak >= 5 ? '🔥' : '⚡';

    els.shieldIcon.classList.toggle('has-shield', state.hasShield);

    if (config.timerMode === 'card10') {
      els.hudBestLabel.textContent = 'Cards Left';
      els.hudBestVal.textContent = state.cardsRemaining;
    } else {
      els.hudBestLabel.textContent = 'Best Streak';
      els.hudBestVal.textContent = Math.max(store.bestStreak, state.roundBestStreak);
    }

    els.playMascot.innerHTML = getMascotSVG(state.streak, mood);
    els.streakCallout.textContent = getStreakStatusText(state.streak);
  }

  function spawnFloatToast(text, color) {
    const pop = document.createElement('div');
    pop.className = 'float-pop';
    if (color) pop.style.color = color;
    pop.textContent = text;
    els.arenaBox.appendChild(pop);
    setTimeout(() => pop.remove(), 760);
  }

  function renderQuestion() {
    const q = state.currentQ;
    els.eqFactorA.textContent = q.a;
    els.eqFactorB.textContent = q.b;
    els.eqSlot.textContent = '?';
    els.eqSlot.className = 'eq-slot';

    els.learningHelper.className = 'learning-helper';
    els.learningHelper.textContent = '';

    if (config.inputMode === 'choices') {
      els.choicesGrid.classList.remove('hidden');
      els.keypadWrap.classList.remove('active');
      els.choicesGrid.innerHTML = '';

      q.choices.forEach((val, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = `choice-btn-${idx + 1}`;
        btn.className = 'btn-tactile choice-btn';
        btn.innerHTML = `<span class="choice-key-hint">${idx + 1}</span><span>${val}</span>`;
        btn.addEventListener('click', () => submitAnswer(val, btn));
        els.choicesGrid.appendChild(btn);
      });
    } else {
      els.choicesGrid.classList.add('hidden');
      els.keypadWrap.classList.add('active');
    }
  }

  // ==========================================================================
  // Answer Checking & Streak Mechanics
  // ==========================================================================
  function submitAnswer(val, clickedBtn = null) {
    if (!state.active || state.locked) return;
    const q = state.currentQ;
    state.attemptCount += 1;

    if (val === q.answer) {
      state.locked = true;
      state.correctCount += 1;
      state.streak += 1;
      if (state.streak > state.roundBestStreak) {
        state.roundBestStreak = state.streak;
      }
      if (state.streak > store.bestStreak) {
        store.bestStreak = state.streak;
      }

      const mult = getMultiplier(state.streak);
      const speedBonus = Math.ceil((state.timeRemaining / state.timeTotal) * 25);
      const pts = (100 + speedBonus) * mult;
      state.score += pts;
      if (state.score > store.highScore) {
        store.highScore = state.score;
      }

      // Record mastery for both a×b and its visual cell
      const mKey = `${q.a}x${q.b}`;
      store.mastery[mKey] = (store.mastery[mKey] || 0) + 1;
      saveProgress();

      // Grant Streak Shield at every 10-streak if not already holding one
      let bonusText = `+${pts}`;
      if (state.streak % 10 === 0 && !state.hasShield) {
        state.hasShield = true;
        bonusText = `🛡️ Streak Shield! +${pts}`;
      } else if (state.streak % 5 === 0 && config.timerMode !== 'card10') {
        const addSec = config.timerMode === 'blitz60' ? 2 : 3;
        state.timeRemaining = Math.min(state.timeTotal, state.timeRemaining + addSec);
        bonusText = `+${addSec}s Time Boost! 🔥`;
      }

      window.arcadeAudio.playCorrect(state.streak);

      els.eqSlot.textContent = q.answer;
      els.eqSlot.className = 'eq-slot correct-flash';
      if (clickedBtn) clickedBtn.classList.add('is-correct');

      els.streakBadge.classList.remove('bump');
      void els.streakBadge.offsetWidth;
      els.streakBadge.classList.add('bump');

      spawnFloatToast(bonusText);
      updateHUD('ready');

      // Confetti burst on milestone streaks (5, 10, 15, 20...)
      if (state.streak % 5 === 0) {
        const rect = els.streakBadge.getBoundingClientRect();
        spawnBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 34);
      }

      if (config.timerMode === 'card10') {
        state.cardsRemaining -= 1;
        if (state.cardsRemaining <= 0) {
          setTimeout(endGame, 320);
          return;
        }
      }

      setTimeout(() => {
        if (!state.active) return;
        state.locked = false;
        nextQuestion();
      }, 240);
    } else {
      // Incorrect Answer
      state.locked = true;
      const factLabel = `${q.a} × ${q.b} = ${q.answer}`;
      state.missedThisRound.set(`${q.a}x${q.b}`, factLabel);

      // Schedule spaced retry in 3 questions so he gets to conquer it!
      if (!state.retryQueue.some((r) => r.a === q.a && r.b === q.b)) {
        state.retryQueue.push({ a: q.a, b: q.b, dueIn: 3 });
      }

      if (clickedBtn) clickedBtn.classList.add('is-wrong');
      // Highlight the true answer button in Choice mode
      if (config.inputMode === 'choices') {
        Array.from(els.choicesGrid.children).forEach((b) => {
          const num = parseInt(b.querySelector('span:last-child').textContent, 10);
          if (num === q.answer) b.classList.add('is-correct');
        });
      }

      els.eqSlot.textContent = q.answer;
      els.eqSlot.className = 'eq-slot wrong-flash';
      els.arenaBox.classList.remove('shake-anim');
      void els.arenaBox.offsetWidth;
      els.arenaBox.classList.add('shake-anim');

      if (state.hasShield && state.streak > 0) {
        state.hasShield = false;
        window.arcadeAudio.playShieldBlock();
        els.learningHelper.className = 'learning-helper visible';
        els.learningHelper.textContent = `🛡️ Shield saved your ${state.streak} streak! (${factLabel})`;
        updateHUD('ready');
      } else {
        state.streak = 0;
        window.arcadeAudio.playWrong();
        els.learningHelper.className = 'learning-helper visible miss-msg';
        els.learningHelper.textContent = `Almost! ${q.a} groups of ${q.b} is ${q.answer}`;
        updateHUD('oops');
      }

      if (config.timerMode === 'card10') {
        state.cardsRemaining -= 1;
        if (state.cardsRemaining <= 0) {
          setTimeout(endGame, 950);
          return;
        }
      }

      setTimeout(() => {
        if (!state.active) return;
        state.locked = false;
        nextQuestion();
      }, 950);
    }
  }

  // ==========================================================================
  // Keypad Buffer Handling
  // ==========================================================================
  function handleDigitInput(digitStr) {
    if (!state.active || state.locked || config.inputMode !== 'keypad') return;
    if (state.typedBuffer.length >= 3) return;

    window.arcadeAudio.playTap();
    state.typedBuffer += digitStr;
    els.eqSlot.textContent = state.typedBuffer;
    els.eqSlot.className = 'eq-slot filled';

    const typedNum = parseInt(state.typedBuffer, 10);
    const targetStr = String(state.currentQ.answer);

    // Instant auto-accept when the exact answer is typed!
    if (typedNum === state.currentQ.answer) {
      submitAnswer(typedNum);
    } else if (state.typedBuffer.length >= targetStr.length && !targetStr.startsWith(state.typedBuffer)) {
      // Same length as answer and wrong -> evaluate immediately
      submitAnswer(typedNum);
    }
  }

  function handleBackspace() {
    if (!state.active || state.locked || config.inputMode !== 'keypad') return;
    state.typedBuffer = state.typedBuffer.slice(0, -1);
    els.eqSlot.textContent = state.typedBuffer || '?';
    els.eqSlot.className = state.typedBuffer ? 'eq-slot filled' : 'eq-slot';
  }

  function handleEnterKey() {
    if (!state.active || state.locked || config.inputMode !== 'keypad') return;
    if (!state.typedBuffer) return;
    submitAnswer(parseInt(state.typedBuffer, 10));
  }

  // ==========================================================================
  // Game Loop & Timer
  // ==========================================================================
  function startGame() {
    window.arcadeAudio.ensureContext();
    window.arcadeAudio.playTap();

    state.active = true;
    state.locked = false;
    state.score = 0;
    state.streak = 0;
    state.roundBestStreak = 0;
    state.hasShield = false;
    state.correctCount = 0;
    state.attemptCount = 0;
    state.cardsRemaining = 20;
    state.recentKeys = [];
    state.retryQueue = [];
    state.missedThisRound.clear();

    if (config.timerMode === 'blitz60') {
      state.timeTotal = 60;
    } else if (config.timerMode === 'rush90') {
      state.timeTotal = 90;
    } else {
      state.timeTotal = 10;
    }
    state.timeRemaining = state.timeTotal;
    state.lastTickWholeSec = state.timeTotal;

    showScreen('play');
    updateHUD('ready');
    nextQuestion();

    cancelAnimationFrame(state.rafId);
    state.lastFrameTs = performance.now();
    state.rafId = requestAnimationFrame(loopTimer);
  }

  function loopTimer(now) {
    if (!state.active) return;
    const dt = (now - state.lastFrameTs) / 1000;
    state.lastFrameTs = now;

    if (!state.locked) {
      state.timeRemaining = Math.max(0, state.timeRemaining - dt);
    }

    const pct = Math.max(0, Math.min(100, (state.timeRemaining / state.timeTotal) * 100));
    els.timerFill.style.width = `${pct}%`;

    const isWarn = pct <= 38 && pct > 18;
    const isDanger = state.timeRemaining <= 5.0;
    els.timerFill.classList.toggle('warn', isWarn);
    els.timerFill.classList.toggle('danger', isDanger);
    els.timerSeconds.classList.toggle('danger', isDanger);

    const ceilSec = Math.ceil(state.timeRemaining);
    els.timerSeconds.textContent = `${ceilSec}s`;

    if (ceilSec < state.lastTickWholeSec && ceilSec > 0 && ceilSec <= 5) {
      window.arcadeAudio.playTick(ceilSec <= 3);
    }
    state.lastTickWholeSec = ceilSec;

    if (state.timeRemaining <= 0) {
      if (config.timerMode === 'card10') {
        // Card timed out -> treat as miss and advance
        submitAnswer(-1);
        if (state.active) {
          state.rafId = requestAnimationFrame(loopTimer);
        }
        return;
      }
      endGame();
      return;
    }

    state.rafId = requestAnimationFrame(loopTimer);
  }

  function endGame() {
    state.active = false;
    cancelAnimationFrame(state.rafId);
    saveProgress();

    const accuracy = state.attemptCount > 0
      ? Math.round((state.correctCount / state.attemptCount) * 100)
      : 100;

    const isRecordStreak = state.roundBestStreak > 0 && state.roundBestStreak >= store.bestStreak;
    window.arcadeAudio.playVictory(isRecordStreak);
    spawnBurst(window.innerWidth / 2, window.innerHeight * 0.3, 48);

    els.sumBadge.textContent = isRecordStreak ? '🏆 NEW BEST STREAK!' : '🎉 TIME UP! GREAT RUN!';
    els.sumTitle.textContent = state.roundBestStreak >= 15
      ? 'Multiplication Superstar!'
      : state.correctCount >= 10
        ? 'Awesome Turbo Speed!'
        : 'Nice Practice Round!';

    els.sumScore.textContent = state.score.toLocaleString();
    els.sumBestStreak.textContent = `${state.roundBestStreak} 🔥`;
    els.sumSolved.textContent = state.correctCount;
    els.sumAccuracy.textContent = `${accuracy}%`;

    els.trickyPills.innerHTML = '';
    if (state.missedThisRound.size > 0) {
      els.trickyTitle.textContent = '💡 Quick Review Power-Ups:';
      state.missedThisRound.forEach((factText) => {
        const span = document.createElement('span');
        span.className = 'fact-pill';
        span.textContent = factText;
        els.trickyPills.appendChild(span);
      });
    } else {
      els.trickyTitle.textContent = '🌟 Zero Misses! Spotless Round!';
      const span = document.createElement('span');
      span.className = 'fact-pill';
      span.textContent = '100% Clean Sweep!';
      els.trickyPills.appendChild(span);
    }

    refreshHomeStats();
    showScreen('summary');
  }

  // ==========================================================================
  // 10 × 10 Mastery Sticker Board
  // ==========================================================================
  function renderMasteryBoard() {
    els.masteryGrid.innerHTML = '';
    // Top-left corner
    const corner = document.createElement('div');
    corner.className = 'm-cell m-hdr';
    corner.textContent = '×';
    els.masteryGrid.appendChild(corner);

    for (let col = 1; col <= 10; col++) {
      const hdr = document.createElement('div');
      hdr.className = 'm-cell m-hdr';
      hdr.textContent = col;
      els.masteryGrid.appendChild(hdr);
    }

    for (let row = 1; row <= 10; row++) {
      const rHdr = document.createElement('div');
      rHdr.className = 'm-cell m-hdr';
      rHdr.textContent = row;
      els.masteryGrid.appendChild(rHdr);

      for (let col = 1; col <= 10; col++) {
        const hits = store.mastery[`${row}x${col}`] || 0;
        const cell = document.createElement('div');
        cell.className = 'm-cell';
        if (hits >= 3) {
          cell.classList.add('mastered-3');
        } else if (hits >= 1) {
          cell.classList.add('mastered-1');
        }
        cell.textContent = row * col;
        cell.title = `${row} × ${col} = ${row * col} (${hits} solved)`;
        els.masteryGrid.appendChild(cell);
      }
    }

    els.masteryProgressText.textContent = `${countMasteredFacts()} of 100 facts unlocked`;
  }

  // ==========================================================================
  // Event Wiring & Keyboard Shortcuts
  // ==========================================================================
  function buildTableChips() {
    els.tablesContainer.innerHTML = '';
    for (let t = 1; t <= 10; t++) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.id = `table-chip-${t}`;
      chip.className = 'table-chip' + (config.selectedTables.includes(t) ? ' active' : '');
      chip.textContent = `×${t}`;
      chip.addEventListener('click', () => {
        window.arcadeAudio.playTap();
        // If all 10 are currently selected, clicking a single table focuses on that one first!
        if (config.selectedTables.length === 10) {
          config.selectedTables = [t];
        } else if (config.selectedTables.includes(t)) {
          if (config.selectedTables.length > 1) {
            config.selectedTables = config.selectedTables.filter((x) => x !== t);
          }
        } else {
          config.selectedTables.push(t);
          config.selectedTables.sort((a, b) => a - b);
        }
        syncTableChipUI();
      });
      els.tablesContainer.appendChild(chip);
    }
    syncTableChipUI();
  }

  function syncTableChipUI() {
    const allSelected = config.selectedTables.length === 10;
    els.btnAllTables.textContent = allSelected ? '✓ All 1–10 Active' : 'Select All 1–10';
    Array.from(els.tablesContainer.children).forEach((chip, idx) => {
      const t = idx + 1;
      chip.classList.toggle('active', config.selectedTables.includes(t));
    });
  }

  els.btnAllTables.addEventListener('click', () => {
    window.arcadeAudio.playTap();
    config.selectedTables = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    syncTableChipUI();
  });

  els.timerPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      window.arcadeAudio.playTap();
      config.timerMode = pill.dataset.timerMode;
      els.timerPills.forEach((p) => p.classList.toggle('selected', p === pill));
    });
  });

  els.inputPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      window.arcadeAudio.playTap();
      config.inputMode = pill.dataset.inputMode;
      els.inputPills.forEach((p) => p.classList.toggle('selected', p === pill));
    });
  });

  // Build On-Screen Keypad
  function buildKeypad() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    keys.forEach((d) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `key-digit-${d}`;
      btn.className = 'btn-tactile key-btn';
      btn.textContent = d;
      btn.addEventListener('click', () => handleDigitInput(d));
      els.keypadWrap.appendChild(btn);
    });

    const clr = document.createElement('button');
    clr.type = 'button';
    clr.id = 'key-backspace';
    clr.className = 'btn-tactile key-btn key-clear';
    clr.textContent = '⌫';
    clr.addEventListener('click', handleBackspace);
    els.keypadWrap.appendChild(clr);

    const go = document.createElement('button');
    go.type = 'button';
    go.id = 'key-submit';
    go.className = 'btn-tactile key-btn key-enter';
    go.textContent = 'GO ↵';
    go.addEventListener('click', handleEnterKey);
    els.keypadWrap.appendChild(go);
  }

  els.btnStart.addEventListener('click', startGame);
  els.btnPlayAgain.addEventListener('click', startGame);

  els.btnBackSetup.addEventListener('click', () => {
    window.arcadeAudio.playTap();
    refreshHomeStats();
    showScreen('home');
  });

  els.btnHomeTop.addEventListener('click', () => {
    state.active = false;
    cancelAnimationFrame(state.rafId);
    window.arcadeAudio.playTap();
    refreshHomeStats();
    showScreen('home');
  });

  els.btnSound.addEventListener('click', () => {
    const muted = window.arcadeAudio.toggleMute();
    els.btnSound.textContent = muted ? '🔇 Muted' : '🔊 Sound';
  });

  els.btnMastery.addEventListener('click', () => {
    window.arcadeAudio.playTap();
    renderMasteryBoard();
    els.modalMastery.classList.add('open');
  });

  els.btnCloseMastery.addEventListener('click', () => {
    els.modalMastery.classList.remove('open');
  });

  els.modalMastery.addEventListener('click', (e) => {
    if (e.target === els.modalMastery) els.modalMastery.classList.remove('open');
  });

  els.btnResetStats.addEventListener('click', () => {
    if (confirm('Reset high score, best streak, and 10×10 board?')) {
      store.bestStreak = 0;
      store.highScore = 0;
      store.mastery = {};
      saveProgress();
      renderMasteryBoard();
      refreshHomeStats();
    }
  });

  // Physical Keyboard Support
  window.addEventListener('keydown', (e) => {
    if (els.modalMastery.classList.contains('open')) {
      if (e.key === 'Escape') els.modalMastery.classList.remove('open');
      return;
    }

    if (!state.active) {
      if (e.key === 'Enter' && els.screenHome.classList.contains('active')) {
        startGame();
      }
      return;
    }

    if (config.inputMode === 'choices') {
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const btn = els.choicesGrid.children[idx];
        if (btn && state.currentQ) {
          submitAnswer(state.currentQ.choices[idx], btn);
        }
      }
    } else {
      if (e.key >= '0' && e.key <= '9') {
        handleDigitInput(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleEnterKey();
      }
    }
  });

  // Initialize App
  buildTableChips();
  buildKeypad();
  refreshHomeStats();
  showScreen('home');
})();
