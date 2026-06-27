'use strict';

/* ── Screen management ── */

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(id).classList.add('active');
  document.getElementById('hamburgerBtn').style.display =
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
  rb.querySelector('.front').textContent = 'WAITING...';
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
  G.units.forEach(function(u) { u.shielded = false; });

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
      updateGameHUD();
      if (G.myPlayer === 1 && G.timerVal % 5 === 0) R.send({type: 'timer-sync', val: G.timerVal});
    }, function() { submitPlan(); });
  } else {
    G.timerVal = 0;
  }
}

/* ── HUD ── */

function updateGameHUD() {
  var G = R.G;
  var t = document.getElementById('gameTimer');
  if (t) {
    t.textContent = G.timerConfig > 0 ? String(G.timerVal) : '∞';
    t.classList.toggle('urgent', G.timerConfig > 0 && G.timerVal <= 3);
  }
  buildPts('p1pts', G.scores[1]);
  buildPts('p2pts', G.scores[2]);
  var sd = document.getElementById('scoreDiff');
  if (sd) sd.textContent = String(Math.abs(G.scores[1] - G.scores[2]));
}

function buildPts(id, score) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  for (var i = 0; i < score; i++) {
    var b = document.createElement('div');
    b.className = 'bar';
    el.appendChild(b);
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
  rb.querySelector('.front').textContent = 'WAITING...';
  R.hideHint();
  R.bowAim.active = false; R.bowAim.unitId = null;
  R.bowAim.targetHex = null; R.bowAim.currentPos = null;

  var orderedActions = R.buildOrderedActions();
  R.send({type: 'plan-done', actions: orderedActions});
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
    resolveStep(p1Acts[step] || null, p2Acts[step] || null, step);
    advanceArrows();
    G.units.forEach(function(u) {
      var o = oldPos[u.id];
      if (o && (o.q !== u.q || o.r !== u.r)) R.startUnitAnim(u, o.q, o.r);
    });
    await sleep(R.ANIM_MS + 200);
  }

  G.turnNum++;
  calcScores();
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

  // Activate shields (compound: skill field)
  for (var si = 0; si < actions.length; si++) {
    if (actions[si].skill === 'shield') {
      var su = R.unitById(actions[si].unitId);
      if (su && !su.dead) { su.shielded = true; R.triggerShieldAnim(su.id, false); }
    }
  }

  // Process moves (compound: move field)
  var movers = actions.filter(function(a) { return a.move && a.type !== 'respawn'; });
  if (movers.length === 2) {
    var t0 = movers[0].move, t1 = movers[1].move;
    var u0 = R.unitById(movers[0].unitId), u1 = R.unitById(movers[1].unitId);
    if (t0.q === t1.q && t0.r === t1.r) { /* cancel: both move to same hex */ }
    else if (u0 && u1 && t0.q === u1.q && t0.r === u1.r && t1.q === u0.q && t1.r === u0.r) { /* cancel: swap */ }
    else { for (var mi = 0; mi < movers.length; mi++) processMove(movers[mi]); }
  } else {
    for (var mj = 0; mj < movers.length; mj++) processMove(movers[mj]);
  }

  // Process other skills: bow, cloak
  for (var ki = 0; ki < actions.length; ki++) {
    var ka = actions[ki];
    if (ka.type === 'respawn') continue;
    var ku = R.unitById(ka.unitId);
    if (!ku || ku.dead) continue;
    if (ka.skill === 'bow' && ka.bowTarget) {
      var dist = R.hexDist(ku.q, ku.r, ka.bowTarget.q, ka.bowTarget.r);
      R.G.arrows.push({
        fromQ: ku.q, fromR: ku.r,
        targetQ: ka.bowTarget.q, targetR: ka.bowTarget.r,
        stepsRemaining: dist, player: ka.player
      });
    }
    if (ka.skill === 'cloak') {
      ku.cloaked = !ku.cloaked;
    }
  }
}

function processMove(a) {
  var u = R.unitById(a.unitId);
  if (!u || u.dead) return;
  var enemy = R.unitAt(a.move.q, a.move.r);
  if (enemy && enemy.player !== u.player) {
    if (enemy.shielded) {
      enemy.shielded = false;
      R.triggerShieldAnim(enemy.id, true);
      return;
    }
    enemy.dead = true; enemy.cloaked = false;
  } else if (enemy && enemy.player === u.player) {
    return;
  }
  u.q = a.move.q; u.r = a.move.r; u.cloaked = false;
}

/* ── Arrow advancement ── */

function advanceArrows() {
  var G = R.G;
  var toRemove = [];
  for (var i = 0; i < G.arrows.length; i++) {
    var arrow = G.arrows[i];
    arrow.stepsRemaining--;
    if (arrow.stepsRemaining <= 0) {
      var target = R.unitAt(arrow.targetQ, arrow.targetR);
      if (target && target.player !== arrow.player) {
        if (target.shielded) {
          target.shielded = false;
          R.triggerShieldAnim(target.id, true);
        } else {
          target.dead = true; target.cloaked = false;
        }
      }
      toRemove.push(i);
    }
  }
  for (var j = toRemove.length - 1; j >= 0; j--) G.arrows.splice(toRemove[j], 1);
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
