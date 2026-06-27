'use strict';

var buttonClickSound = new Audio('assets/sounds/buttonClick.mp3');
buttonClickSound.preload = 'auto';

function playButtonClick() {
  buttonClickSound.currentTime = 0;
  buttonClickSound.play().catch(function() {});
}

function init() {
  var params = new URLSearchParams(location.search);
  var room = params.get('room');
  if (room) {
    R.joinGame(room);
  } else {
    document.getElementById('btnCreate').onclick = R.createGame;
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

  document.getElementById('btnBackToMenuShare').onclick = R.backToMenu;

  document.getElementById('hamburgerBtn').onclick = function() { document.getElementById('settingsModal').classList.add('visible'); };

  document.getElementById('btnSurrender').onclick = function() {
    document.getElementById('settingsModal').classList.remove('visible');
    R.send({type: 'rematch'});
    R.backToMenu();
  };
  document.getElementById('btnCloseSettings').onclick = function() { document.getElementById('settingsModal').classList.remove('visible'); };

  document.getElementById('btnBackToMenuEnd').onclick = R.backToMenu;

  // Play click sound on every pushable button press
  document.addEventListener('pointerdown', function(e) {
    var btn = e.target.closest('.pushable');
    if (btn && !btn.disabled) playButtonClick();
  });

  R.updateTitleVisibility();
  R.buildPawnCanvases();
}

document.addEventListener('DOMContentLoaded', init);
