'use strict';

/*
  Shield/Cloak are persistent unit states. During planning, toggles are
  tracked in R.plannedToggles (local only). Applied during resolution.
  Only BOW uses the action system as type:'skill'.
*/

R.plannedToggles = {};

function buildOrderedActions() {
  var result = [];
  for (var i = 0; i < R.G.unitOrder.length; i++) {
    var uid = R.G.unitOrder[i];
    if (!uid) continue;
    var action = R.G.myActions[uid];
    if (action) result.push(action);
  }
  return result;
}

function lockUnit(unitId) {
  if (R.G.unitOrder.indexOf(unitId) >= 0) return;
  var emptyIdx = R.G.unitOrder.indexOf(null);
  if (emptyIdx >= 0) R.G.unitOrder[emptyIdx] = unitId;
}

function allLocked() {
  return R.G.unitOrder.every(function(uid) { return uid !== null; });
}

function resetAllAssignments() {
  var G = R.G;
  G.myActions = {};
  G.unitOrder = [null, null, null];
  R.plannedToggles = {};
  R.bowAim.active = false;
  R.bowAim.unitId = null;
  R.bowAim.targetHex = null;
  R.bowAim.currentPos = null;
  hideHint();

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
}

function isSkillPlannedOn(unit) {
  var toggle = R.plannedToggles[unit.id];
  if (toggle !== undefined) return toggle;
  return unit.shielded || unit.cloaked;
}

function onPointerDown(e) {
  var G = R.G;
  if (G.phase === 'setup') { if (R.onSetupPointerDown) R.onSetupPointerDown(e); return; }
  if (G.phase !== 'planning' || G.myReady) return;
  e.preventDefault();
  var rect = R.canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  var hex = R.screenToHex(sx, sy);

  if (!R.onBoard(hex.q, hex.r)) { hideHint(); return; }

  if (R.bowAim.active) {
    var bu = R.unitById(R.bowAim.unitId);
    if (bu && R.onBoard(hex.q, hex.r)) {
      var dist = R.hexDist(bu.q, bu.r, hex.q, hex.r);
      if (dist > 0) {
        lockUnit(bu.id);
        G.myActions[bu.id] = {unitId: bu.id, type: 'skill', skill: 'bow', targetHex: {q: hex.q, r: hex.r}, distance: dist};
      }
    }
    R.bowAim.active = false; R.bowAim.unitId = null;
    R.bowAim.targetHex = null; R.bowAim.currentPos = null;
    hideHint();
    return;
  }

  for (var oi = 0; oi < G.unitOrder.length; oi++) {
    var uid = G.unitOrder[oi];
    if (!uid) continue;
    var ac = G.myActions[uid];
    if (ac && ac.type === 'skill' && ac.skill === 'bow' && ac.targetHex &&
        ac.targetHex.q === hex.q && ac.targetHex.r === hex.r) {
      R.canvas.setPointerCapture(e.pointerId);
      R.bowAim.active = true; R.bowAim.unitId = uid;
      R.bowAim.currentPos = {x: sx, y: sy};
      R.bowAim.targetHex = {q: hex.q, r: hex.r};
      delete G.myActions[uid];
      showHint('DRAG THE TARGET, RELEASE TO FIRE');
      return;
    }
  }

  if (hex.r === R.spawnRow(G.myPlayer) && !R.unitAt(hex.q, hex.r)) {
    var hexTaken = false;
    for (var key in G.myActions) {
      var act = G.myActions[key];
      if (act.type === 'respawn' && act.target.q === hex.q && act.target.r === hex.r) {
        hexTaken = true; break;
      }
    }
    if (!hexTaken) {
      var deadUnit = R.myUnits().find(function(u) { return u.dead && !G.myActions[u.id]; });
      if (!deadUnit) {
        deadUnit = R.myUnits().find(function(u) { return u.dead && G.myActions[u.id] && G.myActions[u.id].type === 'respawn'; });
      }
      if (deadUnit) {
        lockUnit(deadUnit.id);
        G.myActions[deadUnit.id] = {unitId: deadUnit.id, type: 'respawn', target: {q: hex.q, r: hex.r}};
        hideHint();
        checkAutoSelectDead();
        return;
      }
    }
  }

  var unit = R.unitAt(hex.q, hex.r);
  if (unit && unit.player === G.myPlayer && !unit.dead) {
    R.canvas.setPointerCapture(e.pointerId);
    R.drag.unit = unit;
    R.drag.startHex = {q: hex.q, r: hex.r};
    R.drag.startPos = {x: sx, y: sy};
    R.drag.currentPos = {x: sx, y: sy};
    R.drag.targetHex = null;
    R.drag.moved = false;
    R.drag.isHold = false;
    R.drag.holdTimer = setTimeout(function() {
      if (!R.drag.moved && R.drag.unit) {
        R.drag.isHold = true;
        if (navigator.vibrate) navigator.vibrate(30);
        onHoldActivate(R.drag.unit);
      }
    }, R.LONG_PRESS_MS);
    return;
  }
}

function onHoldActivate(unit) {
  if (!unit.skill) return;
  var sd = R.SKILL_DEF[unit.skill];

  if (sd.targeted) {
    var G = R.G;
    var existing = G.myActions[unit.id];
    if (existing && existing.type === 'skill' && existing.skill === 'bow') {
      delete G.myActions[unit.id];
      R.bowAim.active = false; R.bowAim.unitId = null;
      R.bowAim.targetHex = null; R.bowAim.currentPos = null;
      hideHint();
      return;
    }
    lockUnit(unit.id);
    G.myActions[unit.id] = {unitId: unit.id, type: 'skill', skill: 'bow'};
    R.bowAim.active = true;
    R.bowAim.unitId = unit.id;
    R.bowAim.currentPos = R.drag.currentPos ? {x: R.drag.currentPos.x, y: R.drag.currentPos.y} : null;
    R.bowAim.targetHex = {q: unit.q, r: unit.r};
    showHint('DRAG THE TARGET, RELEASE TO FIRE');
  } else {
    // Shield/Cloak: toggle PLANNED state (not applied until resolution)
    var currentlyOn = isSkillPlannedOn(unit);
    R.plannedToggles[unit.id] = !currentlyOn;
    R.playSound(unit.skill === 'shield' ? 'shield' : 'vanish');
  }
}

function onPointerMove(e) {
  if (R.bowAim.active) {
    e.preventDefault();
    var rect = R.canvas.getBoundingClientRect();
    var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    R.bowAim.currentPos = {x: sx, y: sy};
    var hex = R.screenToHex(sx, sy);
    if (R.onBoard(hex.q, hex.r)) R.bowAim.targetHex = hex;
    return;
  }
  if (!R.drag.unit) return;
  e.preventDefault();
  var rect2 = R.canvas.getBoundingClientRect();
  var sx2 = e.clientX - rect2.left, sy2 = e.clientY - rect2.top;
  R.drag.currentPos = {x: sx2, y: sy2};
  var dx = sx2 - R.drag.startPos.x, dy = sy2 - R.drag.startPos.y;
  if (Math.sqrt(dx*dx + dy*dy) > 12 && !R.drag.moved) {
    R.drag.moved = true;
    clearTimeout(R.drag.holdTimer);
    R.drag.isHold = false;
  }
  if (R.drag.moved) {
    var hex2 = R.screenToHex(sx2, sy2);
    var nb = R.neighbors(R.drag.unit.q, R.drag.unit.r);
    var isCurrent = hex2.q === R.drag.unit.q && hex2.r === R.drag.unit.r;
    var valid = nb.find(function(n) { return n.q === hex2.q && n.r === hex2.r; });
    R.drag.targetHex = (valid || isCurrent) ? hex2 : null;
  }
}

function onPointerUp(e) {
  e.preventDefault();
  clearTimeout(R.drag.holdTimer);
  var G = R.G;

  if (R.bowAim.active && R.bowAim.targetHex) {
    var u = R.unitById(R.bowAim.unitId);
    if (u) {
      var dist = R.hexDist(u.q, u.r, R.bowAim.targetHex.q, R.bowAim.targetHex.r);
      if (dist > 0) {
        lockUnit(u.id);
        G.myActions[u.id] = {unitId: u.id, type: 'skill', skill: 'bow', targetHex: {q: R.bowAim.targetHex.q, r: R.bowAim.targetHex.r}, distance: dist};
      }
    }
    R.bowAim.active = false; R.bowAim.unitId = null;
    R.bowAim.targetHex = null; R.bowAim.currentPos = null;
    hideHint();
    R.drag.unit = null; R.drag.targetHex = null;
    R.drag.currentPos = null; R.drag.moved = false; R.drag.isHold = false;
    return;
  }

  if (R.drag.unit) {
    if (R.drag.isHold && !R.drag.moved) {
      // handled in onHoldActivate
    } else if (R.drag.moved && R.drag.targetHex) {
      if (R.drag.targetHex.q === R.drag.unit.q && R.drag.targetHex.r === R.drag.unit.r) {
        delete G.myActions[R.drag.unit.id];
        lockUnit(R.drag.unit.id);
      } else {
        lockUnit(R.drag.unit.id);
        G.myActions[R.drag.unit.id] = {unitId: R.drag.unit.id, type: 'move', target: {q: R.drag.targetHex.q, r: R.drag.targetHex.r}};
      }
    } else if (!R.drag.moved && !R.drag.isHold) {
      lockUnit(R.drag.unit.id);
    }
  } else {
    hideHint();
  }

  R.drag.unit = null; R.drag.targetHex = null;
  R.drag.currentPos = null; R.drag.moved = false; R.drag.isHold = false;
}

function checkAutoSelectDead() {
  var assigned = new Set(Object.keys(R.G.myActions));
  var d = R.myUnits().find(function(u) { return u.dead && !assigned.has(u.id); });
  if (d) showHint('TAP A SPAWN TILE TO RESPAWN');
}

function showHint(msg) {
  document.getElementById('skillHint').textContent = msg;
  document.getElementById('skillHint').classList.add('visible');
}

function hideHint() {
  document.getElementById('skillHint').classList.remove('visible');
}

R.buildOrderedActions = buildOrderedActions;
R.lockUnit = lockUnit;
R.allLocked = allLocked;
R.resetAllAssignments = resetAllAssignments;
R.onPointerDown = onPointerDown;
R.onPointerMove = onPointerMove;
R.onPointerUp = onPointerUp;
R.isSkillPlannedOn = isSkillPlannedOn;
R.checkAutoSelectDead = checkAutoSelectDead;
R.showHint = showHint;
R.hideHint = hideHint;
