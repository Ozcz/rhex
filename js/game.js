'use strict';

/* ── Screen management ── */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  document.getElementById('hamburgerBtn').style.display =
    (id === 'screenSetup' || id === 'screenGame') ? '' : 'none';
  document.getElementById('boardWrap').style.display =
    (id === 'screenSetup' || id === 'screenGame') ? '' : 'none';
  updateTitleVisibility();
}

function updateTitleVisibility() {
  var title = document.getElementById('appTitle');
  if (!title) return;
  var G = R.G;
  var hide = G.phase === 'planning' || G.phase === 'resolution' || G.phase === 'setup' || G.phase === 'gameover';
  title.style.display = hide ? 'none' : '';
}

function backToMenu() {
  var G = R.G;
  R.stopTimer();
  if (R.conn) { R.conn.close(); R.conn = null; }
  if (R.peer) { R.peer.destroy(); R.peer = null; }
  document.body.classList.remove('theme-anim');
  document.body.classList.remove('inverted');
  G.phase = 'lobby';
  G.myPlayer = 0;
  G.myReady = false;
  G.opReady = false;
  hideOverlay();
  document.getElementById('settingsModal').classList.remove('visible');
  document.getElementById('shareArea').style.display = 'none';
  document.getElementById('joinArea').style.display = 'none';
  document.getElementById('btnCreate').style.display = '';
  document.getElementById('btnInstructions').style.display = '';
  showScreen('lobby');
}

/* ── Timer ── */

function startTimer(sec, onTick, onDone) {
  var G = R.G;
  clearInterval(G.timerH);
  G.timerVal = sec;
  onTick(G.timerVal);
  G.timerH = setInterval(function() {
    G.timerVal--;
    onTick(G.timerVal);
    if (G.timerVal <= 0) { clearInterval(G.timerH); onDone(); }
  }, 1000);
}

function stopTimer() { clearInterval(R.G.timerH); }

/* ── Game flow ── */

function startSetup() {
  var G = R.G;
  G.phase = 'setup';
  G.myReady = false;
  G.opReady = false;
  document.body.classList.remove('theme-anim');
  document.body.classList.remove('inverted');
  R.playSound('gameFound');
  R.stopSound('waiting');
  R.stopSound('ambience');
  R.boardAnimStart = performance.now();
  R.enemyPawnAnimStart = 0;
  R.prevScores = [0, 0, 0];
  setTimeout(function() { R.pawnAnimStart = performance.now(); }, 700);
  R.initUnits();
  showScreen('screenSetup');
  R.buildSetupUI();
  setTimeout(function() { R.initSetupCanvas(); }, 50);
}

function finishSetup() {
  var G = R.G;
  if (G.myReady) return;
  R.myUnits().forEach(function(u) { if (!u.skill) u.skill = 'shield'; });
  G.myReady = true;
  document.getElementById('setupStatus').textContent = 'WAITING FOR OPPONENT...';
  var rb = document.getElementById('btnSetupReady');
  rb.disabled = true;
  rb.classList.add('is-ready');
  R.send({type: 'setup-done', units: R.myUnits().map(function(u) { return {id: u.id, q: u.q, r: u.r, skill: u.skill}; })});
  if (G.opReady) startPlanning();
}

function startPlanning() {
  var G = R.G;
  G.phase = 'planning';
  G.myReady = false;
  G.opReady = false;
  G.myActions = {};
  G.opActions = null;
  R.bowAim.active = false; R.bowAim.unitId = null;
  R.bowAim.targetHex = null; R.bowAim.currentPos = null;
  G.unitOrder = [null, null, null];

  if (G.turnNum === 0) R.enemyPawnAnimStart = performance.now();

  R.myUnits().forEach(function(u) {
    if (u.dead) {
      var spawn = R.spawnHexes(G.myPlayer).find(function(h) { return !R.unitAt(h.q, h.r); });
      if (spawn) {
        var nextSlot = G.unitOrder.indexOf(null);
        if (nextSlot >= 0) {
          G.unitOrder[nextSlot] = u.id;
          G.myActions[u.id] = {unitId: u.id, type: 'respawn', target: {q: spawn.q, r: spawn.r}};
        }
      }
    }
  });

  showScreen('screenGame');
  R.setupMainCanvas();
  R.startGameRenderLoop();
  document.body.classList.add('theme-anim');
  document.body.classList.add('inverted');

  var rb = document.getElementById('btnGameReady');
  rb.disabled = false;
  rb.classList.remove('is-ready');
  rb.querySelector('.front').textContent = 'READY';
  rb.onclick = function() { submitPlan(); };

  document.getElementById('btnReset').onclick = function() { R.resetAllAssignments(); };
  R.checkAutoSelectDead();
  updateGameHUD();

  if (G.timerConfig > 0) {
    startTimer(G.timerConfig, function() {
      updateTimerOnly();
      if (G.myPlayer === 1 && G.timerVal % 5 === 0) R.send({type: 'timer-sync', val: G.timerVal});
    }, function() { submitPlan(); });
  } else {
    G.timerVal = 0;
  }
}

/* ── HUD ── */

function updateTimerOnly() {
  var G = R.G;
  var t = document.getElementById('gameTimer');
  if (t) {
    t.textContent = G.timerConfig > 0 ? String(G.timerVal) : '∞';
    t.classList.toggle('urgent', G.timerConfig > 0 && G.timerVal <= 3);
  }
}

function updateGameHUD() {
  updateTimerOnly();
  var G = R.G;
  var sd = document.getElementById('scoreDiff');
  if (sd) sd.textContent = String(Math.abs(G.scores[1] - G.scores[2]));

  // Animate score bars: compare with previous, animate gains/losses
  animateScoreBars('p1pts', G.scores[1], R.prevScores[1], '#4ecdc4');
  animateScoreBars('p2pts', G.scores[2], R.prevScores[2], '#e85d75');
}

function animateScoreBars(id, newScore, oldScore, color) {
  var el = document.getElementById(id);
  if (!el) return;
  var currentBars = el.children.length;

  if (newScore > currentBars) {
    // Add new bars with drop animation
    for (var i = currentBars; i < newScore; i++) {
      var b = document.createElement('div');
      b.className = 'bar';
      b.style.background = color;
      b.style.animationDelay = ((i - currentBars) * 0.1) + 's';
      el.appendChild(b);
    }
  } else if (newScore < currentBars) {
    // Remove bars with fade-up animation
    var toRemove = currentBars - newScore;
    for (var j = 0; j < toRemove; j++) {
      var bar = el.lastElementChild;
      if (bar) {
        bar.style.animation = 'barFadeUp 0.3s ease forwards';
        bar.style.animationDelay = (j * 0.1) + 's';
        (function(b) {
          setTimeout(function() { if (b.parentNode) b.parentNode.removeChild(b); }, 300 + j * 100);
        })(bar);
      }
    }
  }
}

/* ── Submit & resolution ── */

function submitPlan() {
  var G = R.G;
  if (G.myReady) return;
  G.myReady = true;
  stopTimer();
  var rb = document.getElementById('btnGameReady');
  rb.disabled = true;
  rb.classList.add('is-ready');
  R.hideHint();
  R.bowAim.active = false; R.bowAim.unitId = null;
  R.bowAim.targetHex = null; R.bowAim.currentPos = null;

  var orderedActions = R.buildOrderedActions();
  var unitStates = R.myUnits().map(function(u) { return {id: u.id, shielded: u.shielded, cloaked: u.cloaked}; });
  R.send({type: 'plan-done', actions: orderedActions, states: unitStates});
  if (G.opActions) runResolution();
}

async function runResolution() {
  var G = R.G;
  G.phase = 'resolution';
  updateTitleVisibility();
  var orderedActions = R.buildOrderedActions();
  var p1Acts = G.myPlayer === 1 ? orderedActions : G.opActions;
  var p2Acts = G.myPlayer === 2 ? orderedActions : G.opActions;

  for (var step = 0; step < 3; step++) {
    var oldPos = {};
    G.units.forEach(function(u) { oldPos[u.id] = {q: u.q, r: u.r}; });

    advanceArrows();
    resolveStep(p1Acts[step] || null, p2Acts[step] || null, step);

    G.units.forEach(function(u) {
      var o = oldPos[u.id];
      if (o && (o.q !== u.q || o.r !== u.r)) R.startUnitAnim(u, o.q, o.r);
    });
    await sleep(R.ANIM_MS + 200);
  }
  advanceArrows();

  G.turnNum++;
  var oldScores = [0, R.prevScores[1], R.prevScores[2]];
  calcScores();

  var p1Diff = G.scores[1] - oldScores[1];
  var p2Diff = G.scores[2] - oldScores[2];
  var gains = Math.max(p1Diff, p2Diff, 0);
  for (var ci = 0; ci < gains; ci++) {
    (function(delay) { setTimeout(function() { R.playSound('coin'); }, delay); })(ci * 120);
  }
  R.prevScores = [0, G.scores[1], G.scores[2]];

  updateGameHUD();

  if (checkWin()) {
    G.phase = 'gameover';
    document.body.classList.remove('theme-anim');
    document.body.classList.remove('inverted');
    showScreen('screenGameover');
    document.getElementById('winText').textContent = G.winner === G.myPlayer ? 'YOU WIN' : 'YOU LOSE';
    document.getElementById('finalScore').textContent = 'P1 ' + G.scores[1] + '  --  P2 ' + G.scores[2];
    document.getElementById('btnRematch').onclick = function() { R.send({type: 'rematch'}); startSetup(); };
  } else {
    startPlanning();
  }
}

function resolveStep(a1, a2, stepIdx) {
  var actions = [];
  if (a1) actions.push(Object.assign({}, a1, {player: 1}));
  if (a2) actions.push(Object.assign({}, a2, {player: 2}));

  // Respawns
  for (var i = 0; i < actions.length; i++) {
    var a = actions[i];
    if (a.type === 'respawn') {
      var u = R.unitById(a.unitId);
      if (u && u.dead && !R.unitAt(a.target.q, a.target.r)) {
        u.dead = false; u.q = a.target.q; u.r = a.target.r;
        u.cloaked = false; u.shielded = false;
      }
    }
  }

  var skillers = actions.filter(function(a) { return a.type === 'skill'; });
  var movers = actions.filter(function(a) { return a.type === 'move'; });

  // Split movers: normal first, passive (shielded/cloaked) after
  var normalMovers = [];
  var passiveMovers = [];
  for (var mi = 0; mi < movers.length; mi++) {
    var mu = R.unitById(movers[mi].unitId);
    if (mu && (mu.shielded || mu.cloaked)) passiveMovers.push(movers[mi]);
    else normalMovers.push(movers[mi]);
  }

  // Both passive at same step → cancel moves, reveal stealth
  if (passiveMovers.length === 2 && normalMovers.length === 0) {
    for (var ri = 0; ri < passiveMovers.length; ri++) {
      var ru = R.unitById(passiveMovers[ri].unitId);
      if (ru && ru.cloaked) { ru.cloaked = false; R.playSound('vanish'); }
    }
    R.playSound('collision');
  } else {
    // Normal movers: check collisions between them
    if (normalMovers.length === 2) {
      var t0 = normalMovers[0].target, t1 = normalMovers[1].target;
      var u0 = R.unitById(normalMovers[0].unitId), u1 = R.unitById(normalMovers[1].unitId);
      if (t0.q === t1.q && t0.r === t1.r) { R.playSound('collision'); }
      else if (u0 && u1 && t0.q === u1.q && t0.r === u1.r && t1.q === u0.q && t1.r === u0.r) { R.playSound('collision'); }
      else { processMove(normalMovers[0]); processMove(normalMovers[1]); }
    } else if (normalMovers.length === 1) {
      processMove(normalMovers[0]);
    }

    // Passive movers resolve after normal movers
    for (var pi = 0; pi < passiveMovers.length; pi++) {
      processMove(passiveMovers[pi]);
    }
  }

  // Process bow skill (only skill that uses the action system)
  for (var ki = 0; ki < skillers.length; ki++) {
    var ka = skillers[ki];
    var ku = R.unitById(ka.unitId);
    if (!ku || ku.dead) continue;
    if (ka.skill === 'bow' && ka.targetHex) {
      var dist = R.hexDist(ku.q, ku.r, ka.targetHex.q, ka.targetHex.r);
      R.G.arrows.push({
        fromQ: ku.q, fromR: ku.r,
        targetQ: ka.targetHex.q, targetR: ka.targetHex.r,
        stepsRemaining: dist, totalDist: dist,
        launchTime: performance.now(),
        player: ka.player
      });
      R.playSound('arrow');
    }
  }
}

function processMove(m) {
  var u = R.unitById(m.unitId);
  if (!u || u.dead) return;
  var enemy = R.unitAt(m.target.q, m.target.r);
  if (enemy && enemy.player !== u.player) {
    if (enemy.shielded) {
      enemy.shielded = false;
      R.triggerShieldAnim(enemy.id, true);
      R.playSound('shield');
      return;
    }
    enemy.dead = true; enemy.cloaked = false;
    R.playSound('defeat');
  } else if (enemy && enemy.player === u.player) {
    return;
  }
  u.q = m.target.q; u.r = m.target.r;
}

/* ── Arrow advancement ── */

function advanceArrows() {
  var G = R.G;
  var now = performance.now();
  for (var j = G.arrows.length - 1; j >= 0; j--) {
    if (G.arrows[j].landingTime && now - G.arrows[j].landingTime > 500) {
      G.arrows.splice(j, 1);
    }
  }
  for (var i = 0; i < G.arrows.length; i++) {
    var arrow = G.arrows[i];
    if (arrow.landingTime) continue;
    arrow.stepsRemaining--;
    if (arrow.stepsRemaining <= 0) {
      arrow.landingTime = performance.now();
      R.playSound('target');
      var target = R.unitAt(arrow.targetQ, arrow.targetR);
      if (target && target.player !== arrow.player) {
        if (target.shielded) {
          target.shielded = false;
          R.triggerShieldAnim(target.id, true);
          R.playSound('shield');
        } else {
          target.dead = true; target.cloaked = false;
          R.playSound('defeat');
        }
      }
    }
  }
}

/* ── Scoring & win ── */

function calcScores() {
  var G = R.G;
  G.scores[1] = 0; G.scores[2] = 0;
  for (var i = 0; i < G.units.length; i++) {
    var u = G.units[i];
    if (u.dead || u.cloaked) continue;
    G.scores[u.player] += R.pointVal(u.r, u.player);
  }
}

function checkWin() {
  var G = R.G;
  if (Math.abs(G.scores[1] - G.scores[2]) >= R.WIN_DIFF) {
    G.winner = G.scores[1] > G.scores[2] ? 1 : 2;
    return true;
  }
  return false;
}

/* ── Utility ── */

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function showOverlay(msg, showMenu) {
  document.getElementById('overlayText').textContent = msg;
  var mb = document.getElementById('btnOverlayMenu');
  mb.style.display = showMenu ? '' : 'none';
  mb.onclick = backToMenu;
  document.getElementById('overlay').classList.add('visible');
}

function hideOverlay() {
  document.getElementById('overlay').classList.remove('visible');
  document.getElementById('btnOverlayMenu').style.display = 'none';
}

function showDisconnectWarning() {
  var el = document.getElementById('disconnectWarning');
  el.style.display = '';
  setTimeout(function() { el.style.display = 'none'; }, 3000);
}

R.showScreen = showScreen;
R.updateTitleVisibility = updateTitleVisibility;
R.backToMenu = backToMenu;
R.startTimer = startTimer;
R.stopTimer = stopTimer;
R.startSetup = startSetup;
R.finishSetup = finishSetup;
R.startPlanning = startPlanning;
R.updateGameHUD = updateGameHUD;
R.submitPlan = submitPlan;
R.runResolution = runResolution;
R.calcScores = calcScores;
R.checkWin = checkWin;
R.sleep = sleep;
R.showOverlay = showOverlay;
R.hideOverlay = hideOverlay;
R.showDisconnectWarning = showDisconnectWarning;
