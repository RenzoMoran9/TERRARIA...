// Poses del personaje: cada una es un cuadro de la hoja de sprites (player.png).
// Coordenadas en píxeles de arte dentro de un cuadro de 24×32 (mirando a la derecha).
// Cuerpo en reposo: pelo desde la fila 1, cabeza 3-11, hombro 14, cadera 22, pies en la fila 31.
//   bob   = baja la parte de arriba del cuerpo (respirar, agacharse)
//   lean  = inclina el torso y la cabeza hacia adelante (+) o atrás (-)
//   lift  = levanta todo el cuerpo (saltito)
//   front/back = posición de la mano delantera/trasera [x, y] (antes de aplicar lean/bob/lift);
//                si la mano de adelante está por encima del hombro (y < 11), el brazo va detrás de la cabeza
//   frontLeg/backLeg = { dx: desplazamiento del pie, foot: fila del pie }
//   eyes  = open | closed | happy | wide | back | hurt | sleepy
//   mouth = line | smile | open | frown | o | yawn
// Las mismas poses las usa el dibujo de reemplazo y el juego (para poner el pico o la
// antorcha en la mano), así que una hoja propia debe respetar este orden de cuadros.

const WALK_FEET = [4, 3, 1, -2, -4, -3, -1, 2];
// Cuánto se levanta cada pie al pasar hacia adelante (solo cambia el dibujo de la pierna, no las manos)
const WALK_LIFT = [0, 0, 0, 0, 0, 1, 2, 1];

const walk = (i) => {
  const front = WALK_FEET[i];
  return {
    name: `walk${i}`,
    bob: i % 4 === 1 || i % 4 === 2 ? 1 : 0,
    frontLeg: { dx: front, foot: 31 - WALK_LIFT[i] },
    backLeg: { dx: -front, foot: 31 - WALK_LIFT[(i + 4) % 8] },
    front: [12 - Math.round(front * 0.6), 22],
    back: [9 + Math.round(front * 0.6), 22],
  };
};

export const POSES = [
  { name: 'idle' },
  { name: 'breath', bob: 1 },
  { name: 'blink', eyes: 'closed' },
  ...Array.from({ length: 8 }, (_, i) => walk(i)),
  { name: 'jump', frontLeg: { dx: 4, foot: 29 }, backLeg: { dx: -3 }, front: [17, 10], back: [6, 19], eyes: 'wide', mouth: 'o' },
  { name: 'fall', frontLeg: { dx: 2, foot: 30 }, backLeg: { dx: -2 }, front: [16, 8], back: [6, 9], eyes: 'wide', mouth: 'o' },
  { name: 'flail', frontLeg: { dx: -2, foot: 30 }, backLeg: { dx: 3, foot: 29 }, front: [19, 13], back: [4, 7], eyes: 'wide', mouth: 'open' },
  { name: 'land', bob: 3, frontLeg: { dx: 3 }, backLeg: { dx: -3 }, front: [17, 23], back: [5, 23], mouth: 'frown' },
  { name: 'swing1', lean: -1, front: [13, 1], back: [8, 21], frontLeg: { dx: 2 }, backLeg: { dx: -2 }, mouth: 'frown' },
  { name: 'swing2', lean: 1, front: [19, 14], back: [8, 21], frontLeg: { dx: 2 }, backLeg: { dx: -2 } },
  { name: 'swing3', lean: 2, bob: 1, front: [18, 21], back: [9, 20], frontLeg: { dx: 3 }, backLeg: { dx: -2 }, mouth: 'open' },
  { name: 'use', lean: 1, front: [19, 17], back: [9, 21], frontLeg: { dx: 2 }, backLeg: { dx: -1 } },
  { name: 'hurt', lean: -2, headDx: -1, front: [17, 17], back: [4, 16], frontLeg: { dx: -1 }, backLeg: { dx: 2 }, eyes: 'hurt', mouth: 'open' },
  { name: 'cheer', lift: 1, front: [17, 2], back: [6, 2], frontLeg: { dx: 2, foot: 30 }, backLeg: { dx: -2 }, eyes: 'happy', mouth: 'smile' },
  { name: 'push', lean: 3, front: [17, 16], back: [16, 18], frontLeg: { dx: 2 }, backLeg: { dx: -5 }, mouth: 'frown' },
  { name: 'look', front: [15, 21], eyes: 'back' },
  { name: 'yawn', front: [16, 1], back: [8, 1], eyes: 'closed', mouth: 'yawn' },
  { name: 'tired', bob: 1, lean: 1, headDy: 1, front: [15, 24], back: [10, 24], eyes: 'sleepy', mouth: 'frown' },
  { name: 'tired2', bob: 2, lean: 1, headDy: 1, front: [15, 24], back: [10, 24], eyes: 'sleepy', mouth: 'open' },
  { name: 'sit', bob: 5, front: [17, 24], back: [8, 24], frontLeg: { dx: 7 }, backLeg: { dx: 6 }, eyes: 'closed', sit: true },
  { name: 'sit2', bob: 6, front: [17, 23], back: [8, 23], frontLeg: { dx: 7 }, backLeg: { dx: 6 }, eyes: 'closed', mouth: 'o', sit: true },
  { name: 'wave1', front: [17, 4], eyes: 'happy', mouth: 'smile' },
  { name: 'wave2', front: [19, 7], eyes: 'happy', mouth: 'smile' },
  // Sentado en una silla: rodillas dobladas, manos sobre las piernas
  { name: 'seat', bob: 1, front: [16, 22], back: [13, 22], frontLeg: { dx: 6, knee: [18, 22] }, backLeg: { dx: 7, knee: [16, 22] }, mouth: 'smile' },
];

/** Índice de cuadro por nombre: FRAME.idle, FRAME.walk0, FRAME.swing1… */
export const FRAME = Object.fromEntries(POSES.map((p, i) => [p.name, i]));
export const WALK_FRAMES = 8;

// Hoja de sprites: 8 cuadros por fila
export const SHEET_COLS = 8;
export const SHEET_ROWS = Math.ceil(POSES.length / SHEET_COLS);
export const ART_W = 24; // ancho de un cuadro en píxeles de arte (×2 en pantalla)
export const ART_H = 32;

/** Mano delantera de una pose, en píxeles de arte dentro del cuadro (ya con lean/bob/lift). */
export function frontHand(frame) {
  const p = POSES[frame] || POSES[0];
  const [x, y] = p.front || [12, 22];
  return [x + (p.lean || 0) + 1, y + (p.bob || 0) - (p.lift || 0)];
}
