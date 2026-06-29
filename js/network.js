'use strict';

function createGame() {
  var G = R.G;
  var roomId = Math.random().toString(36).substr(2, 6).toUpperCase();
  G.timerConfig = R.TIMER_OPTIONS[R.timerIdx] || 0;
  R.peer = new Peer('rhex-' + roomId, {debug: 0});
  R.peer.on('open', function() {
    var url = location.origin + location.pathname + '?room=' + roomId;
    document.getElementById('shareLink').value = url;
    document.getElementById('shareArea').style.display = '';
    document.getElementById('btnCreate').style.display = 'none';
    document.getElementById('btnInstructions').style.display = 'none';
  });
  R.peer.on('connection', function(c) { R.conn = c; G.myPlayer = 1; wireConn(); });
  R.peer.on('error', function(e) { console.error('Peer error:', e); });
}

function joinGame(roomId) {
  document.getElementById('btnCreate').style.display = 'none';
  document.getElementById('btnInstructions').style.display = 'none';
  document.getElementById('joinArea').style.display = '';
  R.peer = new Peer(undefined, {debug: 0});
  R.peer.on('open', function() {
    R.conn = R.peer.connect('rhex-' + roomId, {reliable: true});
    R.conn.on('open', function() { wireConn(); send({type: 'join'}); });
  });
  R.peer.on('error', function(e) { console.error('Peer error:', e); });
}

function wireConn() {
  R.conn.on('data', onMessage);
  R.conn.on('close', function() {
    R.backToMenu();
    R.playSound('ambience');
    R.showDisconnectWarning();
  });
}

function send(data) {
  if (R.conn && R.conn.open) R.conn.send(data);
}

function onMessage(data) {
  var G = R.G;
  switch (data.type) {
    case 'join':
      send({type: 'start', timer: G.timerConfig});
      R.startSetup();
      break;
    case 'start':
      G.myPlayer = 2;
      G.timerConfig = data.timer !== undefined ? data.timer : 60;
      R.startSetup();
      break;
    case 'setup-done':
      for (var i = 0; i < data.units.length; i++) {
        var ud = data.units[i];
        var u = R.unitById(ud.id);
        if (u) { u.skill = ud.skill; u.q = ud.q; u.r = ud.r; }
      }
      G.opReady = true;
      if (G.myReady) R.startPlanning();
      break;
    case 'timer-sync':
      if (G.myPlayer === 2 && G.phase === 'planning' && !G.myReady) {
        G.timerVal = data.val;
        R.updateGameHUD();
      }
      break;
    case 'plan-done':
      G.opActions = data.actions;
      G.opReady = true;
      if (G.myReady) R.runResolution();
      break;
    case 'rematch':
      R.startSetup();
      break;
  }
}

R.createGame = createGame;
R.joinGame = joinGame;
R.send = send;
R.onMessage = onMessage;
