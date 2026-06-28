'use strict';

/* ── SVG Icon Loading ── */

function loadSVGIcon(path, fillColor, strokeColor) {
  return fetch(path)
    .then(function(r) { return r.text(); })
    .then(function(svgText) {
      // Remove <style> tags
      svgText = svgText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      // Remove class attributes
      svgText = svgText.replace(/\s*class="[^"]*"/gi, '');
      // Replace fill in style="fill:#000000;..." (CSS syntax)
      svgText = svgText.replace(/style="([^"]*)"/gi, function(match, inner) {
        var replaced = inner.replace(/fill\s*:\s*#000000/gi, 'fill:' + fillColor);
        return 'style="' + replaced + '"';
      });
      // Replace fill="#000000" (attribute syntax)
      svgText = svgText.replace(/fill="#000000"/gi, 'fill="' + fillColor + '"');
      // Add fill to paths that have none (e.g. bow.svg after style strip)
      svgText = svgText.replace(/<path(?![^>]*fill=)/gi, '<path fill="' + fillColor + '"');
      // Add stroke if requested
      if (strokeColor) {
        svgText = svgText.replace(/<path /gi, '<path stroke="' + strokeColor + '" stroke-width="2" ');
      }
      var blob = new Blob([svgText], {type: 'image/svg+xml'});
      var url = URL.createObjectURL(blob);
      return new Promise(function(resolve) {
        var img = new Image();
        img.onload = function() { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function() { URL.revokeObjectURL(url); resolve(null); };
        img.src = url;
      });
    });
}

function loadAllIcons() {
  var basePath = 'assets/sprites/';
  var skills = [
    {key: 'shield', file: 'shield'},
    {key: 'bow',    file: 'bow'},
    {key: 'cloak',  file: 'hidden'},
    {key: 'target', file: 'target'}
  ];

  R.icons = {};
  var promises = [];

  for (var i = 0; i < skills.length; i++) {
    (function(s) {
      promises.push(
        loadSVGIcon(basePath + s.file + '.svg', '#ffffff', null)
          .then(function(img) { R.icons[s.key + '_white'] = img; })
      );
      promises.push(
        loadSVGIcon(basePath + s.file + '.svg', '#000000', '#ffffff')
          .then(function(img) { R.icons[s.key + '_black'] = img; })
      );
    })(skills[i]);
  }

  return Promise.all(promises);
}

/* ── Sound Loading ── */

function loadAllSounds() {
  var defs = {
    ambience:  {src: 'assets/sounds/ambience.mp3',            loop: true, volume: 0.12},
    arrow:     {src: 'assets/sounds/arrow.mp3',                volume: 1},
    button:    {src: 'assets/sounds/button.mp3',               volume: 1},
    coin:      {src: 'assets/sounds/coin.mp3',                 volume: 0.5},
    collision: {src: 'assets/sounds/collision.mp3',            volume: 1},
    defeat:    {src: 'assets/sounds/defeat.mp3',               volume: 1},
    gameFound: {src: 'assets/sounds/game found.mp3',           volume: 1},
    shield:    {src: 'assets/sounds/shield.mp3',               volume: 1},
    target:    {src: 'assets/sounds/target.mp3',               volume: 1},
    vanish:    {src: 'assets/sounds/vanish.mp3',               volume: 1},
    waiting:   {src: 'assets/sounds/waiting for opponent.mp3', loop: true, volume: 0.25}
  };

  R.sounds = {};

  for (var name in defs) {
    if (!defs.hasOwnProperty(name)) continue;
    var d = defs[name];
    var audio = new Audio(d.src);
    audio.loop = !!d.loop;
    audio.volume = d.volume !== undefined ? d.volume : 1;
    R.sounds[name] = audio;
  }
}

function playSound(name) {
  var snd = R.sounds[name];
  if (!snd) return;
  if (snd.loop) {
    snd.play().catch(function() {});
  } else {
    var clone = snd.cloneNode();
    clone.volume = snd.volume;
    clone.addEventListener('ended', function() { clone.remove(); });
    clone.play().catch(function() {});
  }
}

function stopSound(name) {
  var snd = R.sounds[name];
  if (!snd) return;
  snd.pause();
  snd.currentTime = 0;
}

R.loadAllIcons = loadAllIcons;
R.loadAllSounds = loadAllSounds;
R.playSound = playSound;
R.stopSound = stopSound;
