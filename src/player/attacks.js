/**
 * Combos de las armas: cada toque hace el siguiente movimiento de la lista (y vuelve al
 * primero al terminar o si pasa un rato sin atacar).
 *
 * Ángulo de la hoja (a): relativo hacia donde mira el jugador. 0 = adelante,
 * -π/2 = arriba, π/2 = abajo. 'aim' = hacia donde se apunta (más offset).
 * keys: [u, ángulo, extensión en px] con u de 0 a 1 a lo largo del movimiento.
 * dur: duración en golpes (1 = 1 / velocidad del arma).
 * hits: momentos (u) en que golpea. area: front (adelante), around (alrededor), line (a lo largo de la hoja).
 * dmg / kb / reach: multiplicadores de daño, empujón y alcance. up: lanza al enemigo hacia arriba.
 * hop: saltito (px) a mitad del golpe. lunge: impulso hacia adelante (px/s). slam: golpe al suelo con onda.
 * Distancia: shots = cuántos proyectiles por disparo, spread = separación (rad), speed / dmg = multiplicadores.
 */
const PI = Math.PI;

const SLASH_DOWN = { name: 'Tajo', dur: 1, keys: [[0, -2.3, 0], [0.32, -2.45, 0], [0.62, 1.3, 0], [1, 1.2, 0]], hits: [0.5], area: 'front' };
const SLASH_UP = { name: 'Revés', dur: 1, keys: [[0, 1.4, 0], [0.28, 1.5, 0], [0.58, -2.1, 0], [1, -2, 0]], hits: [0.45], area: 'front', up: 1 };
const STAB = { name: 'Estocada', dur: 0.9, pose: 'use', keys: [[0, 'aim', -6], [0.35, 'aim', -9], [0.55, 'aim', 22], [1, 'aim', 0]], hits: [0.5], area: 'line', reach: 1.25, dmg: 1.1 };
const SPIN = { name: 'Giro', dur: 1.25, keys: [[0, -1.6, 0], [0.12, -1.6, 0], [0.88, -1.6 + 2 * PI, 0], [1, -1.6 + 2 * PI, 0]], hits: [0.5], area: 'around', hop: 10, dmg: 1.2 };
const FINISHER = {
  name: '¡Golpe final!',
  dur: 1.5,
  keys: [[0, -2.4, 0], [0.45, -2.7, 0], [0.68, 1.5, 0], [1, 1.4, 0]],
  hits: [0.68],
  area: 'front',
  reach: 1.25,
  hopUp: 18,
  dmg: 1.6,
  kb: 1.5,
  slam: true,
};

export const COMBOS = {
  sword: [SLASH_DOWN, SLASH_UP, STAB, SPIN, FINISHER],
  dagger: [
    { ...STAB, name: 'Puñalada', dur: 0.8, dmg: 1 },
    { ...SLASH_DOWN, dur: 0.85 },
    { ...STAB, name: 'Puñalada baja', dur: 0.8, keys: [[0, 'aim+0.35', -4], [0.3, 'aim+0.35', -6], [0.5, 'aim+0.35', 18], [1, 'aim+0.35', 0]], dmg: 1 },
    { ...SLASH_UP, dur: 0.85 },
    { ...SPIN, name: 'Remolino', dur: 1.3, hits: [0.35, 0.75], dmg: 0.85, keys: [[0, -1.6, 0], [0.08, -1.6, 0], [0.92, -1.6 + 4 * PI, 0], [1, -1.6 + 4 * PI, 0]] },
  ],
  heavy: [
    { ...SLASH_DOWN, name: 'Mazazo', shake: 1.6 },
    { ...SLASH_UP, name: 'Gancho', up: 1.6, kb: 0.7 },
    { ...SPIN, name: 'Molino', dur: 1.4 },
    { ...SLASH_DOWN, name: 'Mazazo doble', dur: 1.3, keys: [[0, -2.3, 0], [0.2, 1.2, 0], [0.45, -2.3, 0], [0.7, 1.3, 0], [1, 1.2, 0]], hits: [0.15, 0.62], dmg: 0.8 },
    { ...FINISHER, name: '¡Terremoto!', area: 'around', reach: 1.7, dmg: 1.8, dur: 1.6 },
  ],
  spear: [
    { ...STAB, name: 'Estocada', reach: 1, dmg: 1 },
    { ...STAB, name: 'Estocada alta', reach: 1, dmg: 1, keys: [[0, 'aim-0.4', -6], [0.35, 'aim-0.4', -9], [0.55, 'aim-0.4', 22], [1, 'aim-0.4', 0]] },
    { name: 'Barrido', dur: 1.1, pose: 'use', keys: [[0, -1.3, 8], [0.25, -1.4, 8], [0.65, 1.1, 14], [1, 1, 6]], hits: [0.5], area: 'front', reach: 0.8 },
    { ...STAB, name: 'Doble estocada', dur: 1.2, reach: 1, dmg: 0.8, hits: [0.3, 0.72], keys: [[0, 'aim', -6], [0.25, 'aim', 22], [0.45, 'aim', -6], [0.68, 'aim', 22], [1, 'aim', 0]] },
    { ...STAB, name: '¡Embestida!', dur: 1.4, reach: 1.1, dmg: 1.5, kb: 1.4, lunge: 460, keys: [[0, 'aim', -10], [0.3, 'aim', -12], [0.5, 'aim', 28], [1, 'aim', 0]] },
  ],
  bow: [
    { name: 'Disparo', dur: 1, pose: 'aim', hits: [0.6], shots: 1 },
    { name: 'Disparo rápido', dur: 0.7, pose: 'aim', hits: [0.5], shots: 1 },
    { name: 'Doble disparo', dur: 1.2, pose: 'aim', hits: [0.4, 0.75], shots: 1 },
    { name: 'Abanico', dur: 1.1, pose: 'aim', hits: [0.6], shots: 3, spread: 0.16 },
    { name: '¡Tiro cargado!', dur: 1.6, pose: 'aim', hits: [0.75], shots: 1, speed: 1.35, dmg: 1.8, charge: true },
  ],
  throw: [
    { name: 'Lanzamiento', dur: 1, pose: 'use', hits: [0.6], shots: 1 },
    { name: 'Lanzamiento rápido', dur: 0.8, pose: 'use', hits: [0.5], shots: 1 },
    { name: 'Doble', dur: 1.2, pose: 'use', hits: [0.4, 0.75], shots: 1 },
    { name: 'Abanico', dur: 1.1, pose: 'use', hits: [0.6], shots: 3, spread: 0.18 },
    { name: '¡Tiro fuerte!', dur: 1.4, pose: 'use', hits: [0.7], shots: 1, speed: 1.3, dmg: 2, charge: true },
  ],
  boomerang: [{ name: 'Bumerán', dur: 1, pose: 'use', hits: [0.6], shots: 1 }],
};

/** Qué combo usa un arma (por su tipo, o por cómo es: la daga es rápida y la maza lenta). */
export function comboStyle(weapon) {
  const kind = weapon.kind;
  if (kind === 'bow' || kind === 'throw' || kind === 'boomerang') return kind;
  if (kind === 'thrust') return 'spear';
  if (weapon.style) return weapon.style;
  return 'sword';
}

/** Ángulo de la hoja en el momento u (relativo hacia donde mira; aimRel = apuntado relativo). */
export function bladeAt(move, u, aimRel) {
  const keys = move.keys;
  if (!keys) return { a: aimRel, ext: 0 };
  const val = (k) => {
    const v = k[1];
    if (typeof v === 'number') return v;
    const off = v.length > 3 ? Number(v.slice(3)) : 0;
    return aimRel + off;
  };
  if (u <= keys[0][0]) return { a: val(keys[0]), ext: keys[0][2] };
  for (let i = 1; i < keys.length; i++) {
    const k0 = keys[i - 1];
    const k1 = keys[i];
    if (u <= k1[0]) {
      const t = (u - k0[0]) / Math.max(1e-6, k1[0] - k0[0]);
      const s = t * t * (3 - 2 * t);
      return { a: val(k0) + (val(k1) - val(k0)) * s, ext: k0[2] + (k1[2] - k0[2]) * s };
    }
  }
  const last = keys[keys.length - 1];
  return { a: val(last), ext: last[2] };
}
