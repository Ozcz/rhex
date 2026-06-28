'use strict';

// Setup uses the shared board canvas (R.canvas / R.ctx)

function renderSetup() {
  if (!R.ctx || R.G.phase !== 'setup') return;
  var c = R.ctx;
  c.clearRect(0, 0, R.cw, R.ch);

  var hexDraw = R.HEX - 5;

  // Board hexes: thickness layer (outline only)
  for (var i = 0; i < R.boardHexes.length; i++) {
    var h = R.boardHexes[i];
    var s = R.hexToScreen(h.q, h.r);
    R.drawHexShape(c, s.x, s.y + R.HEX_THICK, hexDraw);
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
  }
  // Board hexes: top face
  for (var j = 0; j < R.boardHexes.length; j++) {
    var h2 = R.boardHexes[j];
    var s2 = R.hexToScreen(h2.q, h2.r);
    R.drawHexShape(c, s2.x, s2.y, hexDraw);
    c.fillStyle = '#000'; c.fill();
    c.strokeStyle = '#fff'; c.lineWidth = 1; c.stroke();
  }

  var drawSz = R.HEX * 2.4;
  var yShift = -drawSz * 0.22;
  var mine = R.myUnits();

  for (var k = 0; k < mine.length; k++) {
    var u = mine[k];
    if (u.dead) continue;
    var us = R.hexToScreen(u.q, u.r);

    c.drawImage(R.pawnBlackCanvas, us.x - drawSz / 2, us.y + yShift - drawSz / 2, drawSz, drawSz);

    if (R.setupSelectedUnit === u.id) {
      c.beginPath(); c.arc(us.x, us.y + yShift, drawSz * 0.35, 0, Math.PI * 2);
      c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
    }

    if (u.skill) {
      c.font = (R.HEX * 0.45) + 'px sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(R.SKILL_DEF[u.skill].icon, us.x, us.y + yShift);
    }
  }

  requestAnimationFrame(renderSetup);
}

function initSetupCanvas() {
  R.setupMainCanvas();
  requestAnimationFrame(renderSetup);
}

function onSetupPointerDown(e) {
  if (R.G.myReady) return;
  e.preventDefault();
  var rect = R.canvas.getBoundingClientRect();
  var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
  var hex = R.screenToHex(sx, sy);
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

R.renderSetup = renderSetup;
R.initSetupCanvas = initSetupCanvas;
R.onSetupPointerDown = onSetupPointerDown;
R.buildSetupUI = buildSetupUI;
R.updateSetupSkillButtons = updateSetupSkillButtons;
