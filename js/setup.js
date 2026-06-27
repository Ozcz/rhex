'use strict';

function hexToScreenSetup(q, r) {
  var raw = R.hexToPixelRaw(q, r);
  var flip = R.G.myPlayer === 1 ? -1 : 1;
  return {x: R.setupCenterX + raw.x * flip, y: R.setupCenterY + raw.y * flip};
}

function screenToHexSetup(sx, sy) {
  var flip = R.G.myPlayer === 1 ? -1 : 1;
  var oldHEX = R.HEX;
  R.HEX = R.setupHEX;
  var result = R.pixelToHexRaw((sx - R.setupCenterX) * flip, (sy - R.setupCenterY) * flip);
  R.HEX = oldHEX;
  return result;
}

function renderSetup() {
  if (!R.setupCtx) return;
  var c = R.setupCtx;
  c.clearRect(0, 0, R.setupCW, R.setupCH);
  var savedHEX = R.HEX;
  R.HEX = R.setupHEX;

  for (var i = 0; i < R.boardHexes.length; i++) {
    var h = R.boardHexes[i];
    var s = hexToScreenSetup(h.q, h.r);
    R.drawHexShape(c, s.x, s.y + R.HEX_THICK, R.HEX - 2);
    c.fillStyle = '#fff'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
  }
  for (var j = 0; j < R.boardHexes.length; j++) {
    var h2 = R.boardHexes[j];
    var s2 = hexToScreenSetup(h2.q, h2.r);
    R.drawHexShape(c, s2.x, s2.y, R.HEX - 2);
    c.fillStyle = '#000'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
  }

  var drawSz = R.HEX * 2.0;
  var yShift = -drawSz * 0.1;
  var mine = R.myUnits();

  for (var k = 0; k < mine.length; k++) {
    var u = mine[k];
    if (u.dead) continue;
    var us = hexToScreenSetup(u.q, u.r);

    // Draw SVG pawn (white on dark setup screen)
    c.drawImage(R.pawnWhiteCanvas, us.x - drawSz / 2, us.y + yShift - drawSz / 2, drawSz, drawSz);

    // Selection ring
    if (R.setupSelectedUnit === u.id) {
      c.beginPath(); c.arc(us.x, us.y, drawSz * 0.35, 0, Math.PI * 2);
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    }

    // Skill icon on pawn
    if (u.skill) {
      c.font = (R.HEX * 0.45) + 'px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(R.SKILL_DEF[u.skill].icon, us.x, us.y + yShift);
    }
  }

  R.HEX = savedHEX;
  requestAnimationFrame(renderSetup);
}

function initSetupCanvas() {
  R.setupCanvas = document.getElementById('setupCanvas');
  R.setupCtx = R.setupCanvas.getContext('2d');
  resizeSetupCanvas();
  if (!R.setupCanvasReady) {
    window.addEventListener('resize', resizeSetupCanvas);
    R.setupCanvas.addEventListener('pointerdown', onSetupPointerDown);
    R.setupCanvasReady = true;
  }
  requestAnimationFrame(renderSetup);
}

function resizeSetupCanvas() {
  if (!R.setupCanvas) return;
  R.setupDpr = window.devicePixelRatio || 1;
  var rect = R.setupCanvas.getBoundingClientRect();
  R.setupCW = rect.width; R.setupCH = rect.height;
  R.setupCanvas.width = R.setupCW * R.setupDpr;
  R.setupCanvas.height = R.setupCH * R.setupDpr;
  R.setupCtx.setTransform(R.setupDpr, 0, 0, R.setupDpr, 0, 0);
  R.setupCenterX = R.setupCW / 2;
  R.setupCenterY = R.setupCH / 2;
  var maxH = R.setupCH / 8 * 0.98;
  var maxW = R.setupCW / (5 * R.S3 * R.HEX_ASPECT) * 0.98;
  R.setupHEX = Math.min(maxH, maxW, 80);
  R.setupHEX = Math.max(R.setupHEX, 18);
}

function onSetupPointerDown(e) {
  if (R.G.myReady) return;
  e.preventDefault();
  var rect = R.setupCanvas.getBoundingClientRect();
  var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  var savedHEX = R.HEX; R.HEX = R.setupHEX;
  var hex = screenToHexSetup(sx, sy);
  R.HEX = savedHEX;
  if (!R.onBoard(hex.q, hex.r)) return;
  var unit = R.myUnits().find(function(u) { return !u.dead && u.q === hex.q && u.r === hex.r; });
  if (unit) {
    R.setupSelectedUnit = unit.id;
    updateSetupSkillButtons();
    document.getElementById('setupStatus').textContent = 'TAP A SKILL BELOW TO ASSIGN IT';
  }
}

function buildSetupUI() {
  R.myUnits().forEach(function(u) { u.skill = 'shield'; });
  var mine = R.myUnits();
  R.setupSelectedUnit = mine.length > 0 ? mine[0].id : null;
  var row = document.getElementById('setupSkillRow');
  row.innerHTML = '';
  for (var key in R.SKILL_DEF) {
    if (!R.SKILL_DEF.hasOwnProperty(key)) continue;
    var sd = R.SKILL_DEF[key];
    var btn = document.createElement('button');
    btn.className = 'pushable compact';
    btn.dataset.skill = key;
    btn.innerHTML = '<span class="shadow"></span><span class="edge"></span><span class="front">' + sd.icon + ' ' + sd.name.toUpperCase() + '</span>';
    btn.addEventListener('click', (function(k) {
      return function() {
        if (R.G.myReady || !R.setupSelectedUnit) return;
        var u = R.unitById(R.setupSelectedUnit);
        if (!u) return;
        u.skill = k;
        updateSetupSkillButtons();
      };
    })(key));
    row.appendChild(btn);
  }
  updateSetupSkillButtons();
  var rb = document.getElementById('btnSetupReady');
  rb.onclick = function() { R.finishSetup(); };
  rb.disabled = false;
  rb.classList.remove('is-ready');
  rb.querySelector('.front').textContent = 'READY';
  document.getElementById('setupStatus').textContent = 'TAP A UNIT, THEN TAP A SKILL BELOW';
}

function updateSetupSkillButtons() {
  var row = document.getElementById('setupSkillRow');
  var btns = row.querySelectorAll('.pushable');
  var selUnit = R.setupSelectedUnit ? R.unitById(R.setupSelectedUnit) : null;
  btns.forEach(function(btn) {
    var sk = btn.dataset.skill;
    var isActive = selUnit && selUnit.skill === sk;
    if (isActive) btn.classList.remove('subtle');
    else btn.classList.add('subtle');
  });
}

R.hexToScreenSetup = hexToScreenSetup;
R.screenToHexSetup = screenToHexSetup;
R.renderSetup = renderSetup;
R.initSetupCanvas = initSetupCanvas;
R.resizeSetupCanvas = resizeSetupCanvas;
R.buildSetupUI = buildSetupUI;
R.updateSetupSkillButtons = updateSetupSkillButtons;
