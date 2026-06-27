'use strict';

R.G = {
  phase: 'lobby',
  myPlayer: 0,
  units: [],
  scores: [0, 0, 0],
  myActions: {},
  unitOrder: [],
  opActions: null,
  myReady: false,
  opReady: false,
  timerVal: 0,
  timerH: null,
  timerConfig: 60,
  winner: 0,
  turnNum: 0,
  arrows: []
};

R.peer = null;
R.conn = null;

R.canvas = null;
R.ctx = null;
R.cw = 0;
R.ch = 0;
R.dpr = 1;
R.centerX = 0;
R.centerY = 0;

R.setupCanvas = null;
R.setupCtx = null;
R.setupCW = 0;
R.setupCH = 0;
R.setupDpr = 1;
R.setupCenterX = 0;
R.setupCenterY = 0;
R.setupHEX = 40;
R.setupSelectedUnit = null;

R.drag = {
  unit: null, startHex: null, startPos: null, currentPos: null,
  targetHex: null, moved: false, holdTimer: null, isHold: false
};

R.bowAim = {active: false, unitId: null, currentPos: null, targetHex: null};

R.pawnWhiteCanvas = null;
R.pawnBlackCanvas = null;
R.pawnSize = 0;

R.shieldAnims = {};

R.canvasReady = false;
R.setupCanvasReady = false;

R.INK = [255, 255, 255];
R.PAPER = [0, 0, 0];

R.hoveredHex = null;
