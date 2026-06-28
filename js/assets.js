'use strict';

/* ── SVG Icon Loading ─────────────────────────────────────── */

function loadSVGIcon(path, fillColor, strokeColor) {
  return fetch(path)
    .then(r => r.text())
    .then(svgText => {
      // Remove <style> tags and their contents
      svgText = svgText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
      // Remove class attributes
      svgText = svgText.replace(/\s*class="[^"]*"/gi, '');
      // Replace all fill colors (#000000 in various forms)
      svgText = svgText.replace(/fill\s*[:=]\s*["']?\s*#000000\s*["']?/gi, 'fill="' + fillColor + '"');
      // Optionally add stroke
      if (strokeColor) {
        svgText = svgText.replace(/<path /gi, '<path stroke="' + strokeColor + '" stroke-width="2" ');
      }
      const blob = new Blob([svgText], {type: 'image/svg+xml'});
      const url = URL.createObjectURL(blob);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    });
}

function loadAllIcons() {
  const basePath = 'assets/sprites/';
  const skills = [
    {key: 'shield', file: 'shield'},
    {key: 'bow',    file: 'bow'},
    {key: 'cloak',  file: 'hidden'},
    {key: 'target', file: 'target'}
  ];

  R.icons = {};
  const promises = [];

  for (const s of skills) {
    // White variant: fill white, no stroke
    promises.push(
      loadSVGIcon(basePath + s.file + '.svg', '#ffffff', null)
        .then(img => { R.icons[s.key + '_white'] = img; })
    );
    // Black variant: fill black, stroke white
    promises.push(
      loadSVGIcon(basePath + s.file + '.svg', '#000000', '#ffffff')
        .then(img => { R.icons[s.key + '_black'] = img; })
    );
  }

  return Promise.all(promises);
}

/* ── Sound Loading ────────────────────────────────────────── */

function loadAllSounds() {
  const defs = {
    ambience:  {src: 'assets/sounds/ambience.mp3',               loop: true, volume: 0.12},
    arrow:     {src: 'assets/sounds/arrow.mp3'},
    button:    {src: 'assets/sounds/button.mp3'},
    coin:      {src: 'assets/sounds/coin.mp3',                    volume: 0.5},
    collision: {src: 'assets/sounds/collision.mp3'},
    defeat:    {src: 'assets/sounds/defeat.mp3'},
    gameFound: {src: 'assets/sounds/game found.mp3'},
    shield:    {src: 'assets/sounds/shield.mp3'},
    target:    {src: 'assets/sounds/target.mp3'},
    vanish:    {src: 'assets/sounds/vanish.mp3'},
    waiting:   {src: 'assets/sounds/waiting for opponent.mp3',    loop: true, volume: 0.25}
  };

  R.sounds = {};

  for (const [name, def] of Object.entries(defs)) {
    const audio = new Audio(def.src);
    audio.loop = !!def.loop;
    audio.volume = def.volume !== undefined ? def.volume : 1;
    R.sounds[name] = audio;
  }
}

function playSound(name) {
  const snd = R.sounds[name];
  if (!snd) return;
  if (snd.loop) {
    snd.play().catch(() => {});
  } else {
    const clone = snd.cloneNode();
    clone.volume = snd.volume;
    clone.play().catch(() => {});
  }
}

function stopSound(name) {
  const snd = R.sounds[name];
  if (!snd) return;
  snd.pause();
  snd.currentTime = 0;
}

/* ── Exports ──────────────────────────────────────────────── */

R.loadAllIcons = loadAllIcons;
R.loadAllSounds = loadAllSounds;
R.playSound = playSound;
R.stopSound = stopSound;
