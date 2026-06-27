'use strict';

/*
  Compound action format:
  - Alive: { unitId, move?: {q,r}, skill?: 'shield'|'cloak'|'bow', bowTarget?: {q,r}, bowDistance?: number }
  - Dead:  { unitId, type: 'respawn', target: {q,r} }

  A unit can MOVE and use SHIELD/CLOAK in the same turn.
  BOW replaces movement (no move field when bow is active).
*/

function getOrCreateAction(unitId) {
  if (!R.G.myActions[unitId]) R.G.myActions[unitId] = {unitId: unitId};
  return R.G.myActions[unitId];
}

function cleanupAction(unitId) {
  var a = R.G.myActions[unitId];
  if (a && !a.move && !a.skill && a.type !== 'respawn') {
    delete R.G.myActions[unitId];
  }
}

function buildOrderedActions() {
  var result = [];
  for (var i = 0; i < R.G.unitOrder.length; i++) {
    var uid = R.G.unitOrder[i];
    if (!uid) continue;
    var action = R.G.myActions[uid];
    if (action && (action.move || action.skill || action.type === 'respawn')) {
      result.push(action);
    }
  }
  return result;
}

function lockUnit(unitId) {
  var idx = R.G.unitOrder.indexOf(unitId);
  if (idx >= 0) return;
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

function onPointerDown(e) {
  var G = R.G;
  if (G.phase !== 'planning' || G.myReady) return;
  e.preventDefault();
  var rect = R.canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  var hex = R.screenToHex(sx, sy);

  if (!R.onBoard(hex.q, hex.r)) { hideHint(); return; }

  // Bow aim active: tapping finalizes
  if (R.bowAim.active) {
    if (R.onBoard(hex.q, hex.r)) {
      var bu = R.unitById(R.bowAim.unitId);
      if (bu) {
        var dist = R.hexDist(bu.q, bu.r, hex.q, hex.r);
        if (dist > 0) {
          lockUnit(bu.id);
          var ba = getOrCreateAction(bu.id);
          ba.skill = 'bow';
          ba.bowTarget = {q: hex.q, r: hex.r};
          ba.bowDistance = dist;
          delete ba.move;
        }
      }
    }
    R.bowAim.active = false; R.bowAim.unitId = null;
    R.bowAim.targetHex = null; R.bowAim.currentPos = null;
    hideHint();
    return;
  }

  // Tap existing bow target crosshair to re-aim
  for (var oi = 0; oi < G.unitOrder.length; oi++) {
    var uid = G.unitOrder[oi];
    if (!uid) continue;
    var ac = G.myActions[uid];
    if (ac && ac.skill === 'bow' && ac.bowTarget &&
        ac.bowTarget.q === hex.q && ac.bowTarget.r === hex.r) {
      R.canvas.setPointerCapture(e.pointerId);
      R.bowAim.active = true; R.bowAim.unitId = uid;
      R.bowAim.currentPos = {x: sx, y: sy};
      R.bowAim.targetHex = {q: hex.q, r: hex.r};
      delete ac.bowTarget; delete ac.bowDistance; delete ac.skill;
      cleanupAction(uid);
      showHint('DRAG THE TARGET, RELEASE TO FIRE');
      return;
    }
  }

  // Tap spawn hex for dead unit
  var deadUnassigned = R.myUnits().find(function(u) { return u.dead && !G.myActions[u.id]; });
  if (deadUnassigned && hex.r === R.spawnRow(G.myPlayer) && !R.unitAt(hex.q, hex.r)) {
    lockUnit(deadUnassigned.id);
    G.myActions[deadUnassigned.id] = {unitId: deadUnassigned.id, type: 'respawn', target: {q: hex.q, r: hex.r}};
    hideHint();
    checkAutoSelectDead();
    return;
  }

  // Tap a player unit: start drag/hold interaction
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
  var a = getOrCreateAction(unit.id);

  if (sd.targeted) {
    // BOW: toggle aim mode
    if (a.skill === 'bow') {
      delete a.skill; delete a.bowTarget; delete a.bowDistance;
      R.bowAim.active = false; R.bowAim.unitId = null;
      R.bowAim.targetHex = null; R.bowAim.currentPos = null;
      cleanupAction(unit.id);
      hideHint();
      return;
    }
    lockUnit(unit.id);
    a.skill = 'bow';
    delete a.move;
    R.bowAim.active = true;
    R.bowAim.unitId = unit.id;
    R.bowAim.currentPos = R.drag.currentPos ? {x: R.drag.currentPos.x, y: R.drag.currentPos.y} : null;
    R.bowAim.targetHex = {q: unit.q, r: unit.r};
    showHint('DRAG THE TARGET, RELEASE TO FIRE');
  } else {
    // SHIELD / CLOAK: toggle, keep existing move
    lockUnit(unit.id);
    if (a.skill === unit.skill) {
      delete a.skill;
      cleanupAction(unit.id);
    } else {
      a.skill = unit.skill;
    }
  }
}

function onPointerMove(e) {
  // Bow aim tracking
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

  // Bow aim release: finalize target
  if (R.bowAim.active && R.bowAim.targetHex) {
    var u = R.unitById(R.bowAim.unitId);
    if (u) {
      var dist = R.hexDist(u.q, u.r, R.bowAim.targetHex.q, R.bowAim.targetHex.r);
      if (dist > 0) {
        lockUnit(u.id);
        var a = getOrCreateAction(u.id);
        a.skill = 'bow';
        a.bowTarget = {q: R.bowAim.targetHex.q, r: R.bowAim.targetHex.r};
        a.bowDistance = dist;
        delete a.move;
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
      // Skill handled in onHoldActivate
    } else if (R.drag.moved && R.drag.targetHex) {
      if (R.drag.targetHex.q === R.drag.unit.q && R.drag.targetHex.r === R.drag.unit.r) {
        // Dragged back to self: clear move only, keep skill
        var cAct = R.G.myActions[R.drag.unit.id];
        if (cAct) { delete cAct.move; cleanupAction(R.drag.unit.id); }
        lockUnit(R.drag.unit.id);
      } else {
        // Assign move (if bow is active, dragging cancels bow and assigns move)
        lockUnit(R.drag.unit.id);
        var mAct = getOrCreateAction(R.drag.unit.id);
        if (mAct.skill === 'bow') {
          delete mAct.skill; delete mAct.bowTarget; delete mAct.bowDistance;
        }
        mAct.move = {q: R.drag.targetHex.q, r: R.drag.targetHex.r};
      }
    } else if (!R.drag.moved && !R.drag.isHold) {
      // Simple tap: lock priority
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
R.checkAutoSelectDead = checkAutoSelectDead;
R.showHint = showHint;
R.hideHint = hideHint;
