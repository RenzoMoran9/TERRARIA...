// =====================================================================
//  Sonido y música (WebAudio).
//  - Efectos: sonidos reales en src/sounds (nombre_0.mp3, nombre_1.mp3… = variantes que
//    se eligen al azar). Si falta el archivo de un efecto, se sintetiza al momento
//    (osciladores + ruido filtrado), así que reemplazar o quitar archivos nunca rompe nada.
//  - Ambiente: un sonido de fondo que se repite según la zona (pájaros, viento, lava…).
//  - Música: se compone sola según el ánimo (zona, día/noche, cuevas) con una
//    progresión de acordes, un bajo, un colchón suave y una melodía.
//  El navegador solo deja sonar audio después de que el jugador toca o aprieta algo:
//  unlock() se llama con el primer gesto.
// =====================================================================

import { BLOCK, BLOCK_DEFS } from '../world/blocks.js';

const SETTINGS_KEY = 'terra2d-audio';
const MASTER = 0.9;
const SFX_VOL = 0.55;
const MUSIC_VOL = 0.2;
const AMBIENCE_VOL = 0.4;

// Sonidos reales: { 'step_0': url, ... } (Vite los empaqueta; en la versión de una sola página van adentro)
const SAMPLE_URLS = import.meta.glob('../sounds/*.mp3', { eager: true, query: '?url', import: 'default' });
// Volumen de cada sonido real (1 = normal): los que suenan muy seguido van más bajos
const SAMPLE_VOL = {
  step: 0.3, dig_soft: 0.55, dig_stone: 0.5, dig_wood: 0.55, swing: 0.5, pickup: 0.45, coin: 0.5, xp: 0.35, click: 0.45,
  place: 0.8, jump: 0.45, zombie: 0.5, slimeHop: 0.4, flyer: 0.45, drink: 0.8, teleport: 0.8, land: 0.55, hit: 0.75, hurt: 0.8, open: 0.5, lava: 0.7, levelUp: 0.8, zone: 0.75, house: 0.8,
};

/** data:audio/mpeg;base64,… → ArrayBuffer */
function dataUrlBytes(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);

// Escalas (semitonos desde la tónica)
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 4, 5, 7, 8, 10], // "árabe" (frigio dominante) para el desierto
  lydian: [0, 2, 4, 6, 7, 9, 11],
  penta: [0, 2, 4, 7, 9, 12, 14],
  minorPenta: [0, 3, 5, 7, 10, 12, 15],
};

/**
 * Ánimos musicales. root = nota MIDI de la tónica; bpm; prog = grados de los acordes;
 * lead/pad/bass/perc = instrumentos; density = cuántas notas de melodía (0..1).
 */
const MOODS = {
  menu: { scale: 'major', root: 60, bpm: 84, prog: [0, 4, 5, 3], lead: 'pluck', pad: true, bass: true, perc: 'soft', density: 0.55 },
  day: { scale: 'major', root: 62, bpm: 92, prog: [0, 3, 4, 0, 5, 3, 4, 4], lead: 'pluck', pad: true, bass: true, perc: 'soft', density: 0.6 },
  night: { scale: 'minor', root: 57, bpm: 70, prog: [0, 5, 3, 4], lead: 'bell', pad: true, bass: true, perc: null, density: 0.35 },
  cave: { scale: 'minor', root: 50, bpm: 60, prog: [0, 0, 5, 4], lead: 'drip', pad: true, bass: false, perc: null, density: 0.25 },
  desert: { scale: 'phrygian', root: 62, bpm: 96, prog: [0, 1, 0, 6], lead: 'reed', pad: true, bass: true, perc: 'hand', density: 0.6 },
  snow: { scale: 'lydian', root: 64, bpm: 76, prog: [0, 1, 4, 3], lead: 'bell', pad: true, bass: false, perc: null, density: 0.45 },
  jungle: { scale: 'dorian', root: 57, bpm: 104, prog: [0, 3, 6, 3], lead: 'marimba', pad: false, bass: true, perc: 'hand', density: 0.7 },
  shadow: { scale: 'minor', root: 53, bpm: 66, prog: [0, 1, 5, 4], lead: 'reed', pad: true, bass: true, perc: null, density: 0.3 },
  crystal: { scale: 'lydian', root: 67, bpm: 80, prog: [0, 4, 1, 5], lead: 'bell', pad: true, bass: false, perc: null, density: 0.55 },
  hell: { scale: 'phrygian', root: 45, bpm: 126, prog: [0, 1, 0, 4], lead: 'reed', pad: true, bass: true, perc: 'drum', density: 0.55 },
  mushroom: { scale: 'lydian', root: 62, bpm: 68, prog: [0, 1, 5, 4], lead: 'bell', pad: true, bass: false, perc: null, density: 0.4 },
  sky: { scale: 'penta', root: 69, bpm: 88, prog: [0, 3, 4, 3], lead: 'bell', pad: true, bass: false, perc: 'soft', density: 0.5 },
  volcano: { scale: 'phrygian', root: 48, bpm: 112, prog: [0, 1, 0, 5], lead: 'reed', pad: true, bass: true, perc: 'drum', density: 0.45 },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.settings = { sfx: true, music: true };
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (s && typeof s === 'object') this.settings = { sfx: s.sfx !== false, music: s.music !== false };
    } catch (e) {
      // sin almacenamiento: valores por defecto
    }
    this.listener = null; // objeto con centerX/centerY (el jugador): los sonidos lejanos suenan más bajo
    this.samples = {}; // nombre → [AudioBuffer] (variantes)
    this.ambience = null; // { name, src, gain } que suena ahora
    this.wantedAmbience = null;
    this.last = {}; // último momento de cada efecto (para no amontonar el mismo sonido)
    this.mood = null;
    this.wantedMood = 'menu';
    this.nextNoteTime = 0;
    this.step = 0;
    this.timer = null;
  }

  /** Crea el contexto de audio con el primer gesto del jugador (requisito de los navegadores). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = MASTER;
      // Compresor suave: evita que muchos sonidos juntos saturen
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.master.connect(this.comp).connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = this.settings.sfx ? SFX_VOL : 0;
      this.sfxBus.connect(this.master);
      this.ambBus = c.createGain();
      this.ambBus.gain.value = this.settings.sfx ? AMBIENCE_VOL : 0;
      this.ambBus.connect(this.master);
      this._loadSamples();
      this.musicBus = c.createGain();
      this.musicBus.gain.value = this.settings.music ? MUSIC_VOL : 0;
      this.musicBus.connect(this.master);
      this.musicFade = c.createGain(); // para cambiar de canción suavemente
      this.musicFade.gain.value = 0;
      this.musicFade.connect(this.musicBus);
      // Eco suave para la música
      this.delay = c.createDelay(1);
      this.delay.delayTime.value = 0.32;
      const fb = c.createGain();
      fb.gain.value = 0.28;
      const wet = c.createGain();
      wet.gain.value = 0.35;
      this.delay.connect(fb).connect(this.delay);
      this.delay.connect(wet).connect(this.musicBus);
      // Ruido blanco reutilizable
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.timer = setInterval(() => this._schedule(), 90);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.ctx.suspend();
        else this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // ------------------------------------------------------------ ajustes

  /** Ciclo: todo → solo efectos → silencio → todo. Devuelve el texto del estado. */
  cycleSetting() {
    const { sfx, music } = this.settings;
    if (sfx && music) this.settings = { sfx: true, music: false };
    else if (sfx) this.settings = { sfx: false, music: false };
    else this.settings = { sfx: true, music: true };
    this._applySettings();
    return this.settingLabel();
  }

  settingLabel() {
    const { sfx, music } = this.settings;
    return sfx && music ? 'Sonido: todo' : sfx ? 'Sonido: sin música' : 'Sonido: apagado';
  }

  _applySettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (e) {
      // no se pudo guardar
    }
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx ? SFX_VOL : 0, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.settings.sfx ? AMBIENCE_VOL : 0, t, 0.2);
    this.musicBus.gain.setTargetAtTime(this.settings.music ? MUSIC_VOL : 0, t, 0.2);
  }

  // ------------------------------------------------------------ bloques básicos

  _out(vol, x, y) {
    // Más bajo cuanto más lejos del jugador (a ~25 bloques ya no se oye)
    let v = vol;
    if (x !== undefined && this.listener) {
      const d = Math.hypot(x - this.listener.centerX, (y ?? this.listener.centerY) - this.listener.centerY) / 32;
      v *= Math.max(0, 1 - d / 25);
    }
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(this.sfxBus);
    return g;
  }

  /** Carga y decodifica los sonidos reales (en segundo plano: mientras tanto suenan los sintetizados). */
  _loadSamples() {
    for (const [path, url] of Object.entries(SAMPLE_URLS)) {
      const m = path.match(/([A-Za-z_]+?)_(\d+)\.mp3$/);
      if (!m) continue;
      const name = m[1];
      // (en la versión de una sola página vienen adentro como data: URL; se decodifican sin pedir nada)
      const bytes = url.startsWith('data:') ? Promise.resolve(dataUrlBytes(url)) : fetch(url).then((r) => r.arrayBuffer());
      bytes
        .then((data) => this.ctx.decodeAudioData(data))
        .then((buf) => {
          (this.samples[name] ||= []).push(buf);
          if (name === this.wantedAmbience) this._switchAmbience();
        })
        .catch((e) => console.warn('[sonido] No se pudo cargar', path, e));
    }
  }

  /** Toca un sonido real (una variante al azar, con un poquito de cambio de tono). */
  _playSample(name, out, opts) {
    const list = this.samples[name];
    const src = this.ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = opts.rate ?? rand(0.94, 1.06);
    src.connect(out);
    src.start();
  }

  // ------------------------------------------------------------ ambiente

  /** Sonido de fondo de la zona (se cambia con un fundido). null = silencio. */
  setAmbience(name) {
    if (this.wantedAmbience === name) return;
    this.wantedAmbience = name;
    if (this.ready) this._switchAmbience();
  }

  _switchAmbience() {
    const c = this.ctx;
    const name = this.wantedAmbience;
    const cur = this.ambience;
    if (cur && cur.name === name) return;
    const buf = name && this.samples[name]?.[0];
    if (!buf && name) return; // todavía se está cargando: se cambia cuando llegue
    const t = c.currentTime;
    if (cur) {
      cur.gain.gain.setTargetAtTime(0, t, 0.6);
      cur.src.stop(t + 3);
    }
    this.ambience = null;
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, t, 0.8);
    src.connect(gain).connect(this.ambBus);
    src.start(t, Math.random() * buf.duration);
    this.ambience = { name, src, gain };
  }

  /** Tono con envolvente: f0 → f1 (Hz) en dur segundos. */
  tone(dest, { type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.5, attack = 0.005, delay = 0, curve = 'exp' }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Ruido filtrado (golpes, pasos, explosiones, viento). */
  noise(dest, { filter = 'lowpass', f0 = 1000, f1 = f0, q = 1, dur = 0.12, vol = 0.5, attack = 0.003, delay = 0 }) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rand(0.8, 1.2);
    const bq = c.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bq).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ efectos

  /**
   * Toca un efecto. opts: { x, y } (posición en el mundo), vol (multiplicador), y otros
   * datos propios del efecto (p. ej. fall para el aterrizaje).
   */
  play(name, opts = {}) {
    if (!this.ready || !this.settings.sfx) return;
    const fx = SFX[name];
    if (!fx) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] ?? -1) < (fx.gap ?? 0.03)) return; // evita amontonar el mismo sonido
    this.last[name] = now;
    if (this.samples[name]) {
      const fall = opts.fall !== undefined ? Math.min(1.2, 0.4 + opts.fall / 8) : 1; // aterrizajes: más fuerte cuanto más alto
      this._playSample(name, this._out((SAMPLE_VOL[name] ?? 1) * (opts.vol ?? 1) * fall, opts.x, opts.y), opts);
      return;
    }
    const out = this._out((fx.vol ?? 1) * (opts.vol ?? 1), opts.x, opts.y);
    fx.fn(this, out, opts);
  }

  // ------------------------------------------------------------ música

  /** Elige el ánimo de la música (se cambia con un fundido). */
  setMood(mood) {
    this.wantedMood = MOODS[mood] ? mood : 'day';
    // El ambiente acompaña a la música: pájaros de día, grillos de noche, viento en la nieve…
    this.setAmbience(mood === 'menu' ? 'amb_day' : `amb_${this.wantedMood}`);
  }

  _schedule() {
    if (!this.ready) return;
    const c = this.ctx;
    const t = c.currentTime;
    // Cambio de canción: baja el volumen, cambia y vuelve a subir
    if (this.mood !== this.wantedMood) {
      if (this.mood === null || this.musicFade.gain.value < 0.02) {
        this.mood = this.wantedMood;
        this.song = this._compose(MOODS[this.mood]);
        this.step = 0;
        this.nextNoteTime = t + 0.1;
        this.musicFade.gain.cancelScheduledValues(t);
        this.musicFade.gain.setValueAtTime(0.0001, t);
        this.musicFade.gain.exponentialRampToValueAtTime(1, t + 2.5);
      } else if (!this.fadingOut) {
        this.fadingOut = true;
        this.musicFade.gain.cancelScheduledValues(t);
        this.musicFade.gain.setValueAtTime(this.musicFade.gain.value, t);
        this.musicFade.gain.linearRampToValueAtTime(0.0001, t + 1.5);
        setTimeout(() => (this.fadingOut = false), 1500);
      }
    }
    if (!this.song || !this.settings.music) {
      this.nextNoteTime = t + 0.1;
      return;
    }
    while (this.nextNoteTime < t + 0.35) {
      this._playStep(this.step, this.nextNoteTime);
      this.nextNoteTime += this.song.stepDur;
      this.step++;
    }
  }

  /** Arma una canción: progresión de acordes y un motivo de melodía de 2 compases (se repite con variaciones). */
  _compose(m) {
    const scale = SCALES[m.scale];
    const stepDur = 60 / m.bpm / 2; // corcheas
    const motif = [];
    let deg = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < 16; i++) {
      const play = Math.random() < m.density || i % 4 === 0;
      deg = Math.max(0, Math.min(9, deg + Math.floor(rand(-2, 3))));
      motif.push(play ? deg : null);
    }
    return { m, scale, stepDur, motif, variant: [...motif] };
  }

  /** Nota de la escala (grado, puede pasar de la octava). */
  _note(m, scale, degree, octave = 0) {
    const n = scale.length;
    const o = Math.floor(degree / n);
    const d = ((degree % n) + n) % n;
    return m.root + scale[d] + 12 * (o + octave);
  }

  _playStep(step, t) {
    const { m, scale, stepDur, motif } = this.song;
    const bar = Math.floor(step / 8);
    const chordDeg = m.prog[bar % m.prog.length];
    const inBar = step % 8;
    const dest = this.musicFade;
    // Cada 4 compases la melodía cambia un poco
    if (step % 32 === 0 && step > 0) {
      this.song.variant = motif.map((d) => (d === null ? (Math.random() < 0.15 ? chordDeg + 2 : null) : Math.random() < 0.25 ? d + (Math.random() < 0.5 ? 1 : -1) : d));
    }
    // Colchón: el acorde entero al empezar cada compás
    if (m.pad && inBar === 0) {
      for (const k of [0, 2, 4]) this._pad(dest, midiHz(this._note(m, scale, chordDeg + k, -1)), t, stepDur * 8);
    }
    // Bajo: tónica del acorde en los tiempos 1 y 3
    if (m.bass && (inBar === 0 || inBar === 4)) {
      this._bass(dest, midiHz(this._note(m, scale, chordDeg, -2)), t, stepDur * 3);
    }
    // Melodía: en los tiempos fuertes cae en una nota del acorde (suena más armoniosa)
    let deg = this.song.variant[step % 16];
    if (deg !== null && deg !== undefined) {
      if (inBar % 4 === 0) {
        const tones = [chordDeg, chordDeg + 2, chordDeg + 4, chordDeg + 7];
        deg = tones.reduce((best, d) => (Math.abs(d - deg) < Math.abs(best - deg) ? d : best), tones[0]);
      }
      this._lead(m.lead, dest, midiHz(this._note(m, scale, deg, 0)), t, stepDur);
    }
    // Percusión
    if (m.perc === 'soft' && inBar % 2 === 1) this._hat(dest, t, 0.05);
    if (m.perc === 'hand') {
      if (inBar === 0 || inBar === 3 || inBar === 6) this._tom(dest, t, inBar === 0 ? 120 : 180, 0.35);
      if (inBar % 2 === 1) this._hat(dest, t, 0.06);
    }
    if (m.perc === 'drum') {
      if (inBar === 0 || inBar === 4) this._tom(dest, t, 70, 0.6);
      if (inBar === 2 || inBar === 6) this._tom(dest, t, 110, 0.35);
    }
  }

  _env(g, t, attack, dur, vol) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  _pad(dest, f, t, dur) {
    const c = this.ctx;
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    this._env(g, t, dur * 0.3, dur * 1.05, 0.05);
    for (const det of [-6, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur * 1.1);
    }
    lp.connect(g).connect(dest);
  }

  _bass(dest, f, t, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f;
    this._env(g, t, 0.01, dur, 0.22);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _lead(kind, dest, f, t, step) {
    const c = this.ctx;
    const g = c.createGain();
    const echo = this.delay;
    if (kind === 'bell' || kind === 'drip') {
      // Campana: dos senoidales (una inarmónica) con caída larga
      const dur = kind === 'drip' ? 0.9 : 1.6;
      for (const [ratio, v] of [[1, 0.14], [2.76, 0.05]]) {
        const o = c.createOscillator();
        const gg = c.createGain();
        o.type = 'sine';
        o.frequency.value = f * ratio * (kind === 'drip' ? 2 : 1);
        if (kind === 'drip') o.frequency.exponentialRampToValueAtTime(f * ratio * 2.4, t + 0.08);
        this._env(gg, t, 0.004, dur, v);
        o.connect(gg).connect(dest);
        gg.connect(echo);
        o.start(t);
        o.stop(t + dur + 0.05);
      }
      return;
    }
    const o = c.createOscillator();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    if (kind === 'reed') {
      // Caña (desierto, sombras, volcán): diente de sierra filtrado con vibrato
      o.type = 'sawtooth';
      lp.frequency.value = 1400;
      const vib = c.createOscillator();
      const vg = c.createGain();
      vib.frequency.value = 5.5;
      vg.gain.value = f * 0.012;
      vib.connect(vg).connect(o.frequency);
      vib.start(t);
      vib.stop(t + step * 2.2);
      this._env(g, t, 0.04, step * 2, 0.08);
    } else if (kind === 'marimba') {
      o.type = 'sine';
      lp.frequency.value = 3000;
      this._env(g, t, 0.003, 0.45, 0.2);
    } else {
      // Pluck: triangular con caída rápida
      o.type = 'triangle';
      lp.frequency.value = 2600;
      this._env(g, t, 0.004, step * 2.4, 0.15);
    }
    o.frequency.value = f;
    o.connect(lp).connect(g).connect(dest);
    g.connect(echo);
    o.start(t);
    o.stop(t + step * 2.6);
  }

  _hat(dest, t, vol) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = c.createGain();
    this._env(g, t, 0.002, 0.05, vol);
    src.connect(hp).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.08);
  }

  _tom(dest, t, f, vol) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.18);
    this._env(g, t, 0.003, 0.25, vol);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.3);
  }
}

// ---------------------------------------------------------------- catálogo de efectos
// fn(a, out, opts): a = el motor (tone, noise), out = salida con el volumen ya aplicado.
// gap = segundos mínimos entre dos veces el mismo efecto.
const SFX = {
  // Minar: según el material
  dig_soft: { gap: 0.06, fn: (a, o) => a.noise(o, { f0: 900, f1: 300, dur: 0.09, vol: 0.5 }) },
  dig_stone: {
    gap: 0.06,
    fn: (a, o) => {
      a.noise(o, { filter: 'bandpass', f0: 3200, q: 3, dur: 0.06, vol: 0.6 });
      a.tone(o, { type: 'square', f0: rand(900, 1200), f1: 500, dur: 0.05, vol: 0.12 });
    },
  },
  dig_wood: {
    gap: 0.06,
    fn: (a, o) => {
      a.tone(o, { type: 'triangle', f0: rand(220, 260), f1: 140, dur: 0.09, vol: 0.5 });
      a.noise(o, { filter: 'bandpass', f0: 1200, q: 2, dur: 0.05, vol: 0.25 });
    },
  },
  break: { gap: 0.04, fn: (a, o) => a.noise(o, { f0: 2400, f1: 200, dur: 0.18, vol: 0.55 }) },
  place: {
    gap: 0.05,
    fn: (a, o) => {
      a.tone(o, { type: 'sine', f0: 180, f1: 90, dur: 0.08, vol: 0.5 });
      a.noise(o, { f0: 1500, f1: 400, dur: 0.05, vol: 0.25 });
    },
  },
  tree: {
    gap: 0.3,
    fn: (a, o) => {
      a.noise(o, { filter: 'bandpass', f0: 600, f1: 150, q: 1.5, dur: 0.5, vol: 0.5 });
      a.tone(o, { type: 'triangle', f0: 120, f1: 50, dur: 0.4, vol: 0.4, delay: 0.1 });
      a.noise(o, { filter: 'highpass', f0: 3000, dur: 0.6, vol: 0.15, delay: 0.15 }); // hojas
    },
  },
  pickup: {
    gap: 0.045,
    vol: 0.6,
    fn: (a, o) => {
      a.tone(o, { type: 'square', f0: 880, f1: 1320, dur: 0.07, vol: 0.1, curve: 'lin' });
    },
  },
  // Movimiento
  jump: { gap: 0.1, vol: 0.6, fn: (a, o) => a.tone(o, { type: 'sine', f0: 260, f1: 520, dur: 0.12, vol: 0.25 }) },
  doubleJump: {
    gap: 0.1,
    fn: (a, o) => {
      a.tone(o, { type: 'sine', f0: 420, f1: 900, dur: 0.14, vol: 0.25 });
      a.noise(o, { f0: 2000, f1: 600, dur: 0.18, vol: 0.2 });
    },
  },
  coin: { gap: 0.05, fn: (a, o) => [0, 0.06].forEach((d) => a.tone(o, { type: 'square', f0: 1800, f1: 2400, dur: 0.06, vol: 0.12, delay: d })) },
  zombie: { gap: 1.2, fn: (a, o) => a.tone(o, { type: 'sawtooth', f0: 110, f1: 80, dur: 0.6, vol: 0.12, attack: 0.1 }) },
  slimeHop: { gap: 0.25, fn: (a, o) => a.tone(o, { type: 'sine', f0: 180, f1: 420, dur: 0.12, vol: 0.2 }) },
  flyer: { gap: 1, fn: (a, o) => a.tone(o, { type: 'square', f0: 2400, f1: 1600, dur: 0.12, vol: 0.06 }) },
  drink: { gap: 0.3, fn: (a, o) => [0, 0.18].forEach((d) => a.tone(o, { type: 'sine', f0: 320, f1: 200, dur: 0.12, vol: 0.25, delay: d })) },
  teleport: { gap: 0.3, fn: (a, o) => a.tone(o, { type: 'sine', f0: 400, f1: 1600, dur: 0.5, vol: 0.25 }) },
  land: {
    gap: 0.1,
    fn: (a, o, { fall = 1 }) => {
      const k = Math.min(1, 0.3 + fall / 8);
      a.noise(o, { f0: 600, f1: 120, dur: 0.1 + k * 0.1, vol: 0.35 * k });
      if (fall > 4) a.tone(o, { type: 'sine', f0: 110, f1: 50, dur: 0.18, vol: 0.4 * k });
    },
  },
  step: { gap: 0.18, vol: 0.35, fn: (a, o) => a.noise(o, { f0: 700, f1: 250, dur: 0.05, vol: 0.3 }) },
  dash: {
    gap: 0.2,
    fn: (a, o) => {
      a.noise(o, { filter: 'bandpass', f0: 600, f1: 3000, q: 1.2, dur: 0.25, vol: 0.5 });
      a.tone(o, { type: 'sawtooth', f0: 200, f1: 600, dur: 0.2, vol: 0.08 });
    },
  },
  pound: {
    gap: 0.2,
    fn: (a, o) => {
      a.tone(o, { type: 'sine', f0: 140, f1: 35, dur: 0.5, vol: 0.9 });
      a.noise(o, { f0: 1600, f1: 80, dur: 0.6, vol: 0.6 });
    },
  },
  // Combate
  swing: { gap: 0.08, fn: (a, o) => a.noise(o, { filter: 'bandpass', f0: 500, f1: 2400, q: 1.5, dur: 0.14, vol: 0.75 }) },
  hit: {
    gap: 0.04,
    fn: (a, o) => {
      a.noise(o, { f0: 1800, f1: 300, dur: 0.08, vol: 0.55 });
      a.tone(o, { type: 'square', f0: 300, f1: 120, dur: 0.07, vol: 0.12 });
    },
  },
  slimeDie: { gap: 0.05, fn: (a, o) => a.tone(o, { type: 'sine', f0: 600, f1: 90, dur: 0.22, vol: 0.4 }) },
  enemyDie: {
    gap: 0.05,
    fn: (a, o) => {
      a.tone(o, { type: 'sawtooth', f0: 300, f1: 60, dur: 0.3, vol: 0.18 });
      a.noise(o, { f0: 1200, f1: 150, dur: 0.25, vol: 0.35 });
    },
  },
  hurt: {
    gap: 0.15,
    fn: (a, o) => {
      a.tone(o, { type: 'square', f0: 330, f1: 160, dur: 0.16, vol: 0.18 });
      a.noise(o, { f0: 1000, f1: 300, dur: 0.1, vol: 0.3 });
    },
  },
  die: {
    gap: 1,
    fn: (a, o) => {
      for (let i = 0; i < 4; i++) a.tone(o, { type: 'triangle', f0: [392, 330, 262, 196][i], dur: 0.3, vol: 0.3, delay: i * 0.18 });
    },
  },
  bow: {
    gap: 0.08,
    fn: (a, o) => {
      a.tone(o, { type: 'triangle', f0: 600, f1: 300, dur: 0.12, vol: 0.3 });
      a.noise(o, { filter: 'highpass', f0: 2500, dur: 0.1, vol: 0.2 });
    },
  },
  throw: { gap: 0.08, fn: (a, o) => a.noise(o, { filter: 'bandpass', f0: 1500, f1: 3500, q: 2, dur: 0.12, vol: 0.35 }) },
  fireball: {
    gap: 0.1,
    fn: (a, o) => {
      a.noise(o, { filter: 'lowpass', f0: 400, f1: 2400, dur: 0.3, vol: 0.5 });
      a.tone(o, { type: 'sawtooth', f0: 120, f1: 240, dur: 0.25, vol: 0.08 });
    },
  },
  explode: {
    gap: 0.06,
    fn: (a, o) => {
      a.noise(o, { f0: 2000, f1: 60, dur: 0.55, vol: 0.75 });
      a.tone(o, { type: 'sine', f0: 120, f1: 40, dur: 0.4, vol: 0.5 });
    },
  },
  lava: { gap: 0.4, fn: (a, o) => a.noise(o, { filter: 'highpass', f0: 2500, f1: 5000, dur: 0.35, vol: 0.4 }) },
  // Casa y objetos
  door: {
    gap: 0.15,
    fn: (a, o) => {
      a.tone(o, { type: 'triangle', f0: 160, f1: 120, dur: 0.12, vol: 0.4 });
      a.noise(o, { filter: 'bandpass', f0: 900, q: 3, dur: 0.1, vol: 0.2 });
    },
  },
  chest: {
    gap: 0.2,
    fn: (a, o) => {
      a.tone(o, { type: 'triangle', f0: 200, f1: 260, dur: 0.15, vol: 0.35 });
      a.tone(o, { type: 'sine', f0: 660, dur: 0.2, vol: 0.12, delay: 0.1 });
    },
  },
  craft: {
    gap: 0.1,
    fn: (a, o) => {
      for (let i = 0; i < 3; i++) a.tone(o, { type: 'triangle', f0: [660, 880, 1320][i], dur: 0.18, vol: 0.18, delay: i * 0.06 });
    },
  },
  click: { gap: 0.03, vol: 0.5, fn: (a, o) => a.tone(o, { type: 'square', f0: 1200, dur: 0.03, vol: 0.08 }) },
  open: { gap: 0.1, vol: 0.5, fn: (a, o) => a.noise(o, { filter: 'bandpass', f0: 600, f1: 1800, q: 1, dur: 0.12, vol: 0.3 }) },
  // Logros
  levelUp: {
    gap: 0.5,
    fn: (a, o) => {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => a.tone(o, { type: 'triangle', f0: f, dur: 0.35, vol: 0.22, delay: i * 0.08 }));
      a.tone(o, { type: 'sine', f0: 1568, dur: 0.8, vol: 0.12, delay: 0.42 });
    },
  },
  zone: {
    gap: 1,
    fn: (a, o) => {
      for (const [f, d] of [[392, 0], [494, 0.12], [587, 0.24], [784, 0.36]]) a.tone(o, { type: 'sine', f0: f, dur: 1.2, vol: 0.16, delay: d, attack: 0.02 });
    },
  },
  learn: {
    gap: 0.3,
    fn: (a, o) => {
      a.tone(o, { type: 'sine', f0: 880, f1: 1760, dur: 0.3, vol: 0.2 });
      a.tone(o, { type: 'triangle', f0: 1320, dur: 0.4, vol: 0.12, delay: 0.12 });
    },
  },
  house: {
    gap: 1,
    fn: (a, o) => {
      for (const [f, d] of [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.3]]) a.tone(o, { type: 'triangle', f0: f, dur: 0.6, vol: 0.18, delay: d });
    },
  },
  xp: { gap: 0.08, vol: 0.4, fn: (a, o) => a.tone(o, { type: 'sine', f0: 1400, f1: 1800, dur: 0.06, vol: 0.12 }) },
};

/** Sonido al picar un bloque según su material (piedra, madera o blando). */
export function digSound(id) {
  const def = BLOCK_DEFS[id];
  if (!def) return 'dig_soft';
  if (def.crop || id === BLOCK.LOG || id === BLOCK.PLANKS || id === BLOCK.WORKBENCH || id === BLOCK.WOOD_PLATFORM || id === BLOCK.WOOD_SHINGLES || id === BLOCK.CACTUS) return 'dig_wood';
  return def.tier >= 1 || def.hardness >= 1.2 ? 'dig_stone' : 'dig_soft';
}

/** Motor de sonido único para todo el juego. */
export const audio = new AudioEngine();

// El primer toque o tecla habilita el sonido (requisito de los navegadores)
if (typeof window !== 'undefined') {
  window.__audio = audio; // para depurar desde la consola (como window.__game)
  const unlock = () => audio.unlock();
  // (al tocar la pantalla, el navegador recién lo permite al levantar el dedo)
  for (const ev of ['pointerup', 'mousedown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { passive: true });
}
