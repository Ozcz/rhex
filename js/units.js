'use strict';

function initUnits() {
  const G = R.G;
  G.units = [];
  R.spawnHexes(1).forEach((h, i) => G.units.push({
    id: 'p1-' + i, player: 1, q: h.q, r: h.r,
    skill: null, dead: false, cloaked: false, shielded: false
  }));
  R.spawnHexes(2).forEach((h, i) => G.units.push({
    id: 'p2-' + i, player: 2, q: h.q, r: h.r,
    skill: null, dead: false, cloaked: false, shielded: false
  }));
  G.scores = [0, 0, 0];
  G.turnNum = 0;
  G.winner = 0;
  G.arrows = [];
}

function myUnits() { return R.G.units.filter(u => u.player === R.G.myPlayer); }
function opUnits() { return R.G.units.filter(u => u.player !== R.G.myPlayer); }
function unitAt(q, r) { return R.G.units.find(u => !u.dead && u.q === q && u.r === r); }
function unitById(id) { return R.G.units.find(u => u.id === id); }

R.initUnits = initUnits;
R.myUnits = myUnits;
R.opUnits = opUnits;
R.unitAt = unitAt;
R.unitById = unitById;
