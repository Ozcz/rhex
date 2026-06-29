'use strict';

function init() {
  R.loadAllSounds();
  R.loadAllIcons();

  var params = new URLSearchParams(location.search);
  var room = params.get('room');
  if (room) {
    R.joinGame(room);
  } else {
    document.getElementById('btnCreate').onclick = function() {
      R.createGame();
      R.playSound('waiting');
    };
  }

  document.getElementById('btnTimer').onclick = function() {
    R.timerIdx = (R.timerIdx + 1) % R.TIMER_OPTIONS.length;
    var v = R.TIMER_OPTIONS[R.timerIdx];
    document.getElementById('btnTimer').querySelector('.front').textContent = v === 0 ? '∞' : String(v);
  };

  document.getElementById('btnCopy').onclick = function() {
    navigator.clipboard.writeText(document.getElementById('shareLink').value).catch(function() {});
  };

  document.getElementById('btnInstructions').onclick = function() { document.getElementById('instructions').classList.add('visible'); };
  document.getElementById('btnCloseInstructions').onclick = function() { document.getElementById('instructions').classList.remove('visible'); };

  document.getElementById('btnBackToMenuShare').onclick = function() {
    R.stopSound('waiting');
    R.backToMenu();
  };

  document.getElementById('hamburgerBtn').onclick = function() { document.getElementById('settingsModal').classList.add('visible'); };

  document.getElementById('btnSurrender').onclick = function() {
    document.getElementById('settingsModal').classList.remove('visible');
    R.send({type: 'rematch'});
    R.backToMenu();
  };
  document.getElementById('btnCloseSettings').onclick = function() { document.getElementById('settingsModal').classList.remove('visible'); };

  document.getElementById('btnBackToMenuEnd').onclick = function() {
    R.backToMenu();
  };

  document.addEventListener('pointerdown', function(e) {
    var btn = e.target.closest('.pushable');
    if (btn && !btn.disabled) R.playSound('button');
  });

  // Ambience starts on first interaction and never stops
  document.addEventListener('pointerdown', function() {
    R.playSound('ambience');
  }, {once: true});

  R.updateTitleVisibility();
  R.buildPawnCanvases();

  setTimeout(function() { document.body.classList.add('loaded'); }, 50);
}

document.addEventListener('DOMContentLoaded', init);
