'use strict';

/* ── SVG pawn pre-rendering ── */

var PAWN_RENDER_SIZE = 256;

function prerenderPawnSVG(fillColor, strokeColor, size) {
  var oc = document.createElement('canvas');
  oc.width = size; oc.height = size;
  var c = oc.getContext('2d');
  var svgW = 785, svgH = 1280;
  var scale = Math.min(size / svgW, size / svgH) * 0.92;
  var ox = (size - svgW * scale) / 2;
  var oy = (size - svgH * scale) / 2;
  c.save();
  c.translate(ox, oy);
  c.scale(scale, scale);
  c.translate(0, 1280);
  c.scale(0.1, -0.1);
  try {
    var path = new Path2D(R.PAWN_PATH_STR);
    if (strokeColor) {
      c.strokeStyle = strokeColor;
      c.lineWidth = 250;
      c.lineJoin = 'round';
      c.stroke(path);
    }
    c.fillStyle = fillColor;
    c.fill(path);
  } catch(e) {
    c.restore();
    return prerenderPawnFallback(fillColor, strokeColor, size);
  }
  c.restore();
  return oc;
}

function prerenderPawnFallback(fillColor, strokeColor, size) {
  var oc = document.createElement('canvas');
  oc.width = size; oc.height = size;
  var c = oc.getContext('2d');
  var cx = size / 2, cy = size / 2, s = size * 0.42;
  c.fillStyle = fillColor;
  if (strokeColor) { c.strokeStyle = strokeColor; c.lineWidth = 3; }
  c.beginPath(); c.ellipse(cx, cy + s*0.72, s*0.7, s*0.18, 0, 0, Math.PI*2); c.fill(); if (strokeColor) c.stroke();
  c.beginPath();
  c.moveTo(cx - s*0.52, cy + s*0.55); c.lineTo(cx - s*0.22, cy - s*0.15);
  c.lineTo(cx + s*0.22, cy - s*0.15); c.lineTo(cx + s*0.52, cy + s*0.55);
  c.closePath(); c.fill(); if (strokeColor) c.stroke();
  c.beginPath(); c.ellipse(cx, cy - s*0.15, s*0.28, s*0.1, 0, 0, Math.PI*2); c.fill(); if (strokeColor) c.stroke();
  c.beginPath(); c.arc(cx, cy - s*0.48, s*0.28, 0, Math.PI*2); c.fill(); if (strokeColor) c.stroke();
  c.beginPath(); c.arc(cx, cy - s*0.78, s*0.1, 0, Math.PI*2); c.fill(); if (strokeColor) c.stroke();
  return oc;
}

function buildPawnCanvases() {
  R.pawnWhiteCanvas = prerenderPawnSVG('#ffffff', '#000000', PAWN_RENDER_SIZE);
  R.pawnBlackCanvas = prerenderPawnSVG('#000000', '#ffffff', PAWN_RENDER_SIZE);
}

/* ── Coordinate transforms ── */

function hexToScreen(q, r) {
  var raw = R.hexToPixelRaw(q, r);
  var flip = R.G.myPlayer === 1 ? -1 : 1;
  return {x: R.centerX + raw.x * flip, y: R.centerY + raw.y * flip};
}

function screenToHex(sx, sy) {
  var flip = R.G.myPlayer === 1 ? -1 : 1;
  return R.pixelToHexRaw((sx - R.centerX) * flip, (sy - R.centerY) * flip);
}

/* ── Drawing helpers ── */

var HEX_GAP = 5;

function drawHexShape(c, cx, cy, size) {
  var w = size * R.HEX_ASPECT, h = size;
  c.beginPath();
  for (var i = 0; i < 6; i++) {
    var a = Math.PI / 3 * i - Math.PI / 6;
    c.lineTo(cx + w * Math.cos(a), cy + h * Math.sin(a));
  }
  c.closePath();
}

function inkS() { return 'rgb(' + R.INK[0] + ',' + R.INK[1] + ',' + R.INK[2] + ')'; }
function paperS() { return 'rgb(' + R.PAPER[0] + ',' + R.PAPER[1] + ',' + R.PAPER[2] + ')'; }
function inkA(a) { return 'rgba(' + R.INK[0] + ',' + R.INK[1] + ',' + R.INK[2] + ',' + a + ')'; }

function parseRGB(str) {
  var m = (str || '').match(/(\d+\.?\d*)/g);
  if (!m || m.length < 3) return [255, 255, 255];
  return [Math.round(+m[0]), Math.round(+m[1]), Math.round(+m[2])];
}

/* ── SVG icon draw helper ── */

function drawIcon(c, img, x, y, size) {
  if (!img || !img.complete) return;
  c.drawImage(img, x - size/2, y - size/2, size, size);
}

/* ── Thick arrow for movement indicators ── */

function drawThickArrow(c, fromX, fromY, toX, toY, color, width) {
  var dx = toX - fromX, dy = toY - fromY;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;
  var nx = dx / len, ny = dy / len;
  var px = -ny, py = nx;
  var headLen = Math.min(width * 3, len * 0.4);
  var headW = width * 2;
  var halfW = width / 2;
  c.beginPath();
  c.moveTo(fromX + px * halfW, fromY + py * halfW);
  c.lineTo(toX - nx * headLen + px * halfW, toY - ny * headLen + py * halfW);
  c.lineTo(toX - nx * headLen + px * headW, toY - ny * headLen + py * headW);
  c.lineTo(toX, toY);
  c.lineTo(toX - nx * headLen - px * headW, toY - ny * headLen - py * headW);
  c.lineTo(toX - nx * headLen - px * halfW, toY - ny * headLen - py * halfW);
  c.lineTo(fromX - px * halfW, fromY - py * halfW);
  c.closePath();
  c.fillStyle = color;
  c.fill();
}

/* ── Animation helpers ── */

function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

function startUnitAnim(unit, fromQ, fromR) {
  unit.animStart = performance.now();
  unit.animFromQ = fromQ;
  unit.animFromR = fromR;
}

function getUnitScreenPos(unit) {
  if (unit.animStart) {
    var t = Math.min(1, (performance.now() - unit.animStart) / R.ANIM_MS);
    var e = easeInOutCubic(t);
    var q = unit.animFromQ + (unit.q - unit.animFromQ) * e;
    var r = unit.animFromR + (unit.r - unit.animFromR) * e;
    if (t >= 1) unit.animStart = null;
    return hexToScreen(q, r);
  }
  return hexToScreen(unit.q, unit.r);
}

/* ── Shield effect ── */

function triggerShieldAnim(unitId, blocking) {
  R.shieldAnims[unitId] = {startTime: performance.now(), blocking: !!blocking};
}

function drawShieldEffect(c, x, y, unit, isMine) {
  var ico = R.icons['shield' + (isMine ? '_white' : '_black')];
  var anim = R.shieldAnims[unit.id];
  var now = performance.now();
  if (anim) {
    var elapsed = now - anim.startTime;
    var duration = anim.blocking ? 300 : 600;
    if (elapsed > duration) { delete R.shieldAnims[unit.id]; if (!unit.shielded) return; }
    var t = Math.min(1, elapsed / duration);
    if (anim.blocking) {
      c.globalAlpha = 0.7 * (1 - t);
      drawIcon(c, ico, x, y, R.HEX * (0.4 + t * 0.3));
      c.globalAlpha = 1.0;
    } else {
      c.globalAlpha = 0.5;
      drawIcon(c, ico, x, y, R.HEX * (0.2 + t * 0.4));
      c.globalAlpha = 1.0;
    }
    return;
  }
  if (unit.shielded) {
    c.globalAlpha = 0.5;
    drawIcon(c, ico, x, y, R.HEX * 0.6);
    c.globalAlpha = 1.0;
  }
}

/* ── Arrow visuals (in-flight projectiles) ── */

function drawArrowProjectile(c, x, y, goingUp) {
  var sz = R.HEX * 0.5;
  var dir = goingUp ? -1 : 1;
  c.save();
  c.translate(x, y);
  // Shaft
  c.beginPath();
  c.moveTo(0, dir * sz * 0.7);
  c.lineTo(0, dir * -sz * 0.3);
  c.strokeStyle = inkA(0.8);
  c.lineWidth = 2.5;
  c.stroke();
  // Arrowhead
  c.beginPath();
  c.moveTo(0, dir * -sz * 0.8);
  c.lineTo(-sz * 0.22, dir * -sz * 0.25);
  c.lineTo(sz * 0.22, dir * -sz * 0.25);
  c.closePath();
  c.fillStyle = inkA(0.8);
  c.fill();
  c.restore();
}

function drawArrows(c) {
  var G = R.G;
  var now = performance.now();
  var ANIM_DUR = 400;
  var offTop = -R.HEX;

  for (var i = 0; i < G.arrows.length; i++) {
    var arrow = G.arrows[i];
    if (arrow.player !== G.myPlayer) continue;

    var fromS = hexToScreen(arrow.fromQ, arrow.fromR);
    var toS = hexToScreen(arrow.targetQ, arrow.targetR);

    // Launch animation: arrow rises from pawn off the top of screen
    if (arrow.launchTime) {
      var elapsed = now - arrow.launchTime;
      if (elapsed < ANIM_DUR) {
        var t = elapsed / ANIM_DUR;
        drawArrowProjectile(c, fromS.x, fromS.y + (offTop - fromS.y) * t, true);
      }
    }

    // Landing animation: arrow falls from top of screen to target
    if (arrow.landingTime) {
      var elapsed2 = now - arrow.landingTime;
      if (elapsed2 < ANIM_DUR) {
        var t2 = elapsed2 / ANIM_DUR;
        drawArrowProjectile(c, toS.x, offTop + (toS.y - offTop) * t2, false);
      }
    }
  }
}

/* ── Main render loop ── */

function render() {
  var G = R.G;
  if (G.phase !== 'planning' && G.phase !== 'resolution' && G.phase !== 'gameover') {
    requestAnimationFrame(render);
    return;
  }
  var ctx = R.ctx;
  if (!ctx) { requestAnimationFrame(render); return; }
  var now = performance.now();
  ctx.clearRect(0, 0, R.cw, R.ch);

  var cs = getComputedStyle(document.body);
  R.INK = parseRGB(cs.getPropertyValue('--c-fg'));
  R.PAPER = parseRGB(cs.getPropertyValue('--c-bg'));

  var isDark = R.INK[0] > 128;
  var inkIcon = isDark ? '_white' : '_black';

  var hexDraw = R.HEX - HEX_GAP;

  // Board hexes: thickness layer (outline only, no fill — matches button edge)
  for (var hi = 0; hi < R.boardHexes.length; hi++) {
    var h = R.boardHexes[hi];
    var s = hexToScreen(h.q, h.r);

    // Hex spawn ripple animation
    var dist = R.hexDist(0, 0, h.q, h.r);
    var delay = dist * 120;
    var elapsed = now - R.boardAnimStart - delay;
    if (R.boardAnimStart > 0 && elapsed < 0) continue;
    var hexAlpha = (R.boardAnimStart > 0 && elapsed < 300) ? Math.min(1, elapsed / 300) : 1;
    var hexRise = (R.boardAnimStart > 0 && elapsed < 300) ? (1 - elapsed/300) * 15 : 0;

    ctx.globalAlpha = hexAlpha;
    drawHexShape(ctx, s.x, s.y + R.HEX_THICK - hexRise, hexDraw);
    ctx.strokeStyle = inkS(); ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Board hexes: top face (no hover lift)
  for (var hi2 = 0; hi2 < R.boardHexes.length; hi2++) {
    var h2 = R.boardHexes[hi2];
    var s2 = hexToScreen(h2.q, h2.r);

    // Hex spawn ripple animation
    var dist2 = R.hexDist(0, 0, h2.q, h2.r);
    var delay2 = dist2 * 120;
    var elapsed2 = now - R.boardAnimStart - delay2;
    if (R.boardAnimStart > 0 && elapsed2 < 0) continue;
    var hexAlpha2 = (R.boardAnimStart > 0 && elapsed2 < 300) ? Math.min(1, elapsed2 / 300) : 1;
    var hexRise2 = (R.boardAnimStart > 0 && elapsed2 < 300) ? (1 - elapsed2/300) * 15 : 0;

    ctx.globalAlpha = hexAlpha2;
    drawHexShape(ctx, s2.x, s2.y - hexRise2, hexDraw);
    ctx.fillStyle = paperS(); ctx.fill();
    ctx.strokeStyle = inkS(); ctx.lineWidth = 1; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Drag highlights (valid move targets)
  if (R.drag.unit && R.drag.moved && G.phase === 'planning') {
    var stayS = hexToScreen(R.drag.unit.q, R.drag.unit.r);
    var isStayT = R.drag.targetHex && R.drag.targetHex.q === R.drag.unit.q && R.drag.targetHex.r === R.drag.unit.r;
    drawHexShape(ctx, stayS.x, stayS.y, hexDraw);
    ctx.fillStyle = isStayT ? inkA(0.12) : inkA(0.08); ctx.fill();
    var nb = R.neighbors(R.drag.unit.q, R.drag.unit.r);
    for (var ni = 0; ni < nb.length; ni++) {
      var n = nb[ni];
      var ns = hexToScreen(n.q, n.r);
      drawHexShape(ctx, ns.x, ns.y, hexDraw);
      var isT = R.drag.targetHex && R.drag.targetHex.q === n.q && R.drag.targetHex.r === n.r;
      ctx.fillStyle = isT ? inkA(0.12) : inkA(0.08); ctx.fill();
    }
  }

  // Bow target icons (assigned) — SVG icon
  if (G.phase === 'planning') {
    for (var oi = 0; oi < G.unitOrder.length; oi++) {
      var uid = G.unitOrder[oi];
      if (!uid) continue;
      var a = G.myActions[uid];
      if (a && a.type === 'skill' && a.skill === 'bow' && a.targetHex) {
        var ts = hexToScreen(a.targetHex.q, a.targetHex.r);
        drawIcon(ctx, R.icons['target' + inkIcon], ts.x, ts.y, R.HEX * 0.5);
      }
    }
  }

  // Bow aim drag: highlight hex + target preview
  if (R.bowAim.active && R.bowAim.targetHex) {
    var ats = hexToScreen(R.bowAim.targetHex.q, R.bowAim.targetHex.r);
    drawHexShape(ctx, ats.x, ats.y, hexDraw);
    ctx.fillStyle = inkA(0.15); ctx.fill();
    ctx.globalAlpha = 0.5;
    drawIcon(ctx, R.icons['target' + inkIcon], ats.x, ats.y, R.HEX * 0.5);
    ctx.globalAlpha = 1.0;
  }

  // Respawn highlights
  if (G.phase === 'planning' && !R.bowAim.active) {
    var assigned = new Set(Object.keys(G.myActions));
    var deadNeedRespawn = R.myUnits().find(function(u) { return u.dead && !assigned.has(u.id); });
    if (deadNeedRespawn) {
      var spawns = R.spawnHexes(G.myPlayer);
      for (var si = 0; si < spawns.length; si++) {
        var sh = spawns[si];
        if (!R.unitAt(sh.q, sh.r)) {
          var ss = hexToScreen(sh.q, sh.r);
          drawHexShape(ctx, ss.x, ss.y, hexDraw);
          ctx.fillStyle = inkA(0.08); ctx.fill();
        }
      }
    }
  }

  // Action indicators
  if (G.phase === 'planning') {
    for (var ai = 0; ai < G.unitOrder.length; ai++) {
      var auid = G.unitOrder[ai];
      if (!auid) continue;
      var act = G.myActions[auid];
      if (!act) continue;
      var au = R.unitById(act.unitId);
      if (!au) continue;

      if (act.type === 'move' && !au.dead) {
        var mFrom = hexToScreen(au.q, au.r);
        var mTo = hexToScreen(act.target.q, act.target.r);
        drawThickArrow(ctx, mFrom.x, mFrom.y, mTo.x, mTo.y, inkA(0.18), 4);
      }

      if (act.type === 'skill' && act.skill === 'bow' && act.targetHex && !au.dead) {
        var bFrom = hexToScreen(au.q, au.r);
        var bTo = hexToScreen(act.targetHex.q, act.targetHex.r);
        ctx.beginPath(); ctx.moveTo(bFrom.x, bFrom.y); ctx.lineTo(bTo.x, bTo.y);
        ctx.strokeStyle = inkA(0.12); ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      }

      if (act.type === 'respawn' && act.target) {
        var rTo = hexToScreen(act.target.q, act.target.r);
        var rOrderIdx = G.unitOrder.indexOf(act.unitId);
        if (rOrderIdx >= 0) {
          var rbr = R.HEX * 0.2;
          ctx.beginPath(); ctx.arc(rTo.x, rTo.y, rbr, 0, Math.PI * 2);
          ctx.fillStyle = inkA(0.85); ctx.fill();
          ctx.fillStyle = paperS();
          ctx.font = '600 ' + (rbr * 1.3) + 'px Inter,sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(['I','II','III'][rOrderIdx] || String(rOrderIdx + 1), rTo.x, rTo.y);
        }
      }
    }
  }

  // Drag line
  if (R.drag.unit && R.drag.moved && R.drag.currentPos && G.phase === 'planning') {
    var dlFrom = hexToScreen(R.drag.unit.q, R.drag.unit.r);
    ctx.beginPath(); ctx.moveTo(dlFrom.x, dlFrom.y); ctx.lineTo(R.drag.currentPos.x, R.drag.currentPos.y);
    ctx.strokeStyle = inkA(0.08); ctx.lineWidth = 1; ctx.stroke();
  }

  // Bow aim drag line
  if (R.bowAim.active && R.bowAim.currentPos) {
    var bau = R.unitById(R.bowAim.unitId);
    if (bau) {
      var baFrom = hexToScreen(bau.q, bau.r);
      ctx.beginPath(); ctx.moveTo(baFrom.x, baFrom.y); ctx.lineTo(R.bowAim.currentPos.x, R.bowAim.currentPos.y);
      ctx.strokeStyle = inkA(0.15); ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // Draw units as SVG pawns
  var drawSize = R.HEX * 2.4;
  var yShift = -drawSize * 0.22;

  for (var ui = 0; ui < G.units.length; ui++) {
    var u = G.units[ui];
    if (u.dead) continue;
    if (u.cloaked && u.player !== G.myPlayer) continue;
    var isDragging = R.drag.unit && R.drag.unit.id === u.id && R.drag.moved;
    var us = isDragging ? R.drag.currentPos : getUnitScreenPos(u);
    var isMine = u.player === G.myPlayer;
    var pawnCanvas = isMine ? R.pawnWhiteCanvas : R.pawnBlackCanvas;

    ctx.save();

    // Pawn entrance animation
    var pawnAnimT = 1;
    if (R.pawnAnimStart > 0) {
      var pIdx = isMine ? R.myUnits().indexOf(u) : R.opUnits().indexOf(u);
      var pDelay = pIdx * 120;
      var pElapsed = now - R.pawnAnimStart - pDelay;
      if (pElapsed < 0) { ctx.restore(); continue; }
      pawnAnimT = Math.min(1, pElapsed / 300);
    }
    if (R.enemyPawnAnimStart > 0 && !isMine) {
      var eIdx = R.opUnits().indexOf(u);
      var eDelay = eIdx * 120;
      var eElapsed = now - R.enemyPawnAnimStart - eDelay;
      if (eElapsed < 0) { ctx.restore(); continue; }
      pawnAnimT = Math.min(1, eElapsed / 300);
    }

    var pawnYOffset = (1 - pawnAnimT) * -20;

    if (u.cloaked) ctx.globalAlpha = 0.3 * pawnAnimT;
    else if (isDragging) ctx.globalAlpha = 0.7 * pawnAnimT;
    else ctx.globalAlpha = pawnAnimT;
    ctx.drawImage(pawnCanvas, us.x - drawSize / 2, us.y + yShift - drawSize / 2 + pawnYOffset, drawSize, drawSize);
    ctx.restore();

    // Shield visual
    if (u.shielded || R.shieldAnims[u.id]) drawShieldEffect(ctx, us.x, us.y + yShift + pawnYOffset, u, isMine);

    // Skill icon on pawn belly — opaque when active state, faded when inactive
    if (u.skill && R.SKILL_DEF[u.skill]) {
      var sd = R.SKILL_DEF[u.skill];
      var skillIsOn = u.shielded || u.cloaked;
      ctx.save();
      ctx.globalAlpha = (skillIsOn ? 0.85 : 0.25) * pawnAnimT;
      drawIcon(ctx, R.icons[sd.svgKey + (isMine ? '_black' : '_white')], us.x, us.y + yShift + pawnYOffset + drawSize * 0.18, R.HEX * 0.5);
      ctx.restore();
    }

    // Order balloon (I/II/III) only
    if (isMine && !isDragging) {
      var orderIdx = G.unitOrder.indexOf(u.id);
      if (orderIdx >= 0) {
        var pr = drawSize / 2;
        var bx = us.x + pr * 0.45, by = us.y + yShift - pr * 0.6 + pawnYOffset;
        var br = R.HEX * 0.22;
        ctx.save();
        ctx.globalAlpha = pawnAnimT;
        ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = inkA(0.85); ctx.fill();
        ctx.fillStyle = paperS();
        ctx.font = '600 ' + (br * 1.2) + 'px Inter,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(['I','II','III'][orderIdx] || String(orderIdx + 1), bx, by);
        ctx.restore();
      }
    }
  }

  // In-flight arrows
  drawArrows(ctx);

  // Hold indicator ring
  if (R.drag.unit && !R.drag.moved && R.drag.isHold && R.drag.startPos) {
    ctx.beginPath();
    ctx.arc(R.drag.startPos.x, R.drag.startPos.y, R.HEX * 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = inkA(0.2); ctx.lineWidth = 1; ctx.stroke();
  }

  requestAnimationFrame(render);
}

/* ── Canvas setup & resize ── */

function setupMainCanvas() {
  R.canvas = document.getElementById('board');
  R.ctx = R.canvas.getContext('2d');
  resizeCanvas();
  if (!R.canvasReady) {
    window.addEventListener('resize', resizeCanvas);
    R.canvas.addEventListener('pointerdown', R.onPointerDown);
    R.canvas.addEventListener('pointermove', R.onPointerMove);
    R.canvas.addEventListener('pointerup', R.onPointerUp);
    R.canvas.addEventListener('pointercancel', R.onPointerUp);
    R.canvasReady = true;
  }
}

function startGameRenderLoop() {
  requestAnimationFrame(render);
}

function resizeCanvas() {
  R.dpr = window.devicePixelRatio || 1;
  var rect = R.canvas.getBoundingClientRect();
  R.cw = rect.width; R.ch = rect.height;
  R.canvas.width = R.cw * R.dpr;
  R.canvas.height = R.ch * R.dpr;
  R.ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  R.centerX = R.cw / 2;
  var maxH = R.ch / 8 * 0.98;
  var maxW = R.cw / (5 * R.S3 * R.HEX_ASPECT) * 0.98;
  R.HEX = Math.min(maxH, maxW, 80);
  R.HEX = Math.max(R.HEX, 18);
  R.centerY = R.ch / 2;
  buildPawnCanvases();
}

R.prerenderPawnSVG = prerenderPawnSVG;
R.prerenderPawnFallback = prerenderPawnFallback;
R.buildPawnCanvases = buildPawnCanvases;
R.hexToScreen = hexToScreen;
R.screenToHex = screenToHex;
R.drawHexShape = drawHexShape;
R.drawIcon = drawIcon;
R.inkS = inkS;
R.paperS = paperS;
R.inkA = inkA;
R.parseRGB = parseRGB;
R.easeInOutCubic = easeInOutCubic;
R.startUnitAnim = startUnitAnim;
R.getUnitScreenPos = getUnitScreenPos;
R.triggerShieldAnim = triggerShieldAnim;
R.drawShieldEffect = drawShieldEffect;
R.drawArrows = drawArrows;
R.render = render;
R.setupMainCanvas = setupMainCanvas;
R.startGameRenderLoop = startGameRenderLoop;
R.resizeCanvas = resizeCanvas;
