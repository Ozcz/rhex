'use strict';

function hexToPixelRaw(q, r) {
  return {x: R.HEX * R.HEX_ASPECT * (R.S3 * q + R.S3 / 2 * r), y: R.HEX * (1.5 * r)};
}

function pixelToHexRaw(x, y) {
  const xn = x / R.HEX_ASPECT;
  return hexRound((R.S3 / 3 * xn - y / 3) / R.HEX, (2 / 3 * y) / R.HEX);
}

function hexRound(q, r) {
  let s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return {q: rq, r: rr};
}

function onBoard(q, r) {
  return Math.abs(q) <= R.RAD && Math.abs(r) <= R.RAD && Math.abs(q + r) <= R.RAD;
}

function neighbors(q, r) {
  return R.DIRS.map(d => ({q: q + d.q, r: r + d.r})).filter(h => onBoard(h.q, h.r));
}

function hexDist(q1, r1, q2, r2) {
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs((q1 + r1) - (q2 + r2))) / 2;
}

function rowDist(r, player) { return player === 1 ? r + 2 : 2 - r; }

function pointVal(r, player) { return R.ROW_VALS[rowDist(r, player)]; }

const boardHexes = [];
for (let r = -R.RAD; r <= R.RAD; r++)
  for (let q = -R.RAD; q <= R.RAD; q++)
    if (onBoard(q, r)) boardHexes.push({q, r});

function spawnRow(p) { return p === 1 ? -2 : 2; }

function spawnHexes(p) { return boardHexes.filter(h => h.r === spawnRow(p)); }

function hexesInLine(q1, r1, q2, r2) {
  const dq = q2 - q1, dr = r2 - r1;
  if (dq === 0 && dr === 0) return null;
  for (const d of R.DIRS) {
    if (d.q === 0 && d.r === 0) continue;
    let steps = 0;
    if (d.q !== 0) steps = dq / d.q;
    else if (d.r !== 0) steps = dr / d.r;
    else continue;
    if (steps > 0 && Number.isInteger(steps) && d.q * steps === dq && d.r * steps === dr) {
      return {dir: d, steps: steps};
    }
  }
  return null;
}

R.hexToPixelRaw = hexToPixelRaw;
R.pixelToHexRaw = pixelToHexRaw;
R.hexRound = hexRound;
R.onBoard = onBoard;
R.neighbors = neighbors;
R.hexDist = hexDist;
R.rowDist = rowDist;
R.pointVal = pointVal;
R.boardHexes = boardHexes;
R.spawnRow = spawnRow;
R.spawnHexes = spawnHexes;
R.hexesInLine = hexesInLine;
