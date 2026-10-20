// Poses del personaje: cada una es un cuadro de la hoja de sprites (player.png).
// Coordenadas en píxeles de arte dentro de un cuadro de 24×44 (mirando a la derecha):
//   bob   = baja la parte de arriba del cuerpo (respirar, agacharse)
//   lean  = inclina el torso y la cabeza hacia adelante (+) o atrás (-)
//   lift  = levanta todo el cuerpo (saltito)
//   front/back = posición de la mano delantera/trasera [x, y] (antes de aplicar lean/bob/lift);
//                si la mano de adelante está por encima del hombro (y < 13), el brazo va detrás de la cabeza
//   frontLeg/backLeg = { dx: desplazamiento del pie, foot: fila del pie }
//   eyes  = open | closed | happy | wide | back | hurt | sleepy
//   mouth = line | smile | open | frown | o | yawn
// Las mismas poses las usa el dibujo de reemplazo y el juego (para poner el pico o la
// antorcha en la mano), así que una hoja propia debe respetar este orden de cuadros.

const WALK_FEET = [4, 3, 1, -2, -4, -3, -1, 2];

const walk = (i) => {
  const front = WALK_FEET[i];
  return {
    name: `walk${i}`,
    bob: i % 4 === 1 || i % 4 === 2 ? 1 : 0,
    frontLeg: { dx: front },
    backLeg: { dx: -front },
    front: [12 - Math.round(front * 0.6), 28],
    back: [9 + Math.round(front * 0.6), 28],
  };
};

export const POSES = [
  { name: 'idle' },
  { name: 'breath', bob: 1 },
  { name: 'blink', eyes: 'closed' },
  ...Array.from({ length: 8 }, (_, i) => walk(i)),
  { name: 'jump', frontLeg: { dx: 4, foot: 40 }, backLeg: { dx: -3 }, front: [17, 12], back: [6, 24], eyes: 'wide', mouth: 'o' },
  { name: 'fall', frontLeg: { dx: 2, foot: 42 }, backLeg: { dx: -2 }, front: [16, 10], back: [6, 11], eyes: 'wide', mouth: 'o' },
  { name: 'flail', frontLeg: { dx: -2, foot: 42 }, backLeg: { dx: 3, foot: 41 }, front: [19, 15], back: [4, 9], eyes: 'wide', mouth: 'open' },
  { name: 'land', bob: 4, frontLeg: { dx: 3 }, backLeg: { dx: -3 }, front: [17, 30], back: [5, 30], mouth: 'frown' },
  { name: 'swing1', lean: -1, front: [13, 2], back: [8, 27], frontLeg: { dx: 2 }, backLeg: { dx: -2 }, mouth: 'frown' },
  { name: 'swing2', lean: 1, front: [19, 16], back: [8, 26], frontLeg: { dx: 2 }, backLeg: { dx: -2 } },
  { name: 'swing3', lean: 2, bob: 1, front: [18, 27], back: [9, 25], frontLeg: { dx: 3 }, backLeg: { dx: -2 }, mouth: 'open' },
  { name: 'use', lean: 1, front: [19, 20], back: [9, 27], frontLeg: { dx: 2 }, backLeg: { dx: -1 } },
  { name: 'hurt', lean: -2, headDx: -1, front: [17, 21], back: [4, 19], frontLeg: { dx: -1 }, backLeg: { dx: 2 }, eyes: 'hurt', mouth: 'open' },
  { name: 'cheer', lift: 2, front: [17, 3], back: [6, 4], frontLeg: { dx: 2, foot: 42 }, backLeg: { dx: -2 }, eyes: 'happy', mouth: 'smile' },
  { name: 'push', lean: 3, front: [17, 19], back: [16, 22], frontLeg: { dx: 2 }, backLeg: { dx: -5 }, mouth: 'frown' },
  { name: 'look', front: [15, 27], eyes: 'back' },
  { name: 'yawn', front: [16, 1], back: [8, 1], eyes: 'closed', mouth: 'yawn' },
  { name: 'tired', bob: 2, lean: 1, headDy: 1, front: [15, 31], back: [10, 31], eyes: 'sleepy', mouth: 'frown' },
  { name: 'tired2', bob: 3, lean: 1, headDy: 1, front: [15, 32], back: [10, 32], eyes: 'sleepy', mouth: 'open' },
  { name: 'sit', bob: 9, front: [17, 36], back: [8, 36], frontLeg: { dx: 7 }, backLeg: { dx: 6 }, eyes: 'closed', sit: true },
  { name: 'sit2', bob: 10, front: [17, 37], back: [8, 37], frontLeg: { dx: 7 }, backLeg: { dx: 6 }, eyes: 'closed', mouth: 'o', sit: true },
  { name: 'wave1', front: [17, 6], eyes: 'happy', mouth: 'smile' },
  { name: 'wave2', front: [19, 9], eyes: 'happy', mouth: 'smile' },
];

/** Índice de cuadro por nombre: FRAME.idle, FRAME.walk0, FRAME.swing1… */
export const FRAME = Object.fromEntries(POSES.map((p, i) => [p.name, i]));
export const WALK_FRAMES = 8;

// Hoja de sprites: 8 cuadros por fila
export const SHEET_COLS = 8;
export const SHEET_ROWS = Math.ceil(POSES.length / SHEET_COLS);
export const ART_W = 24; // ancho de un cuadro en píxeles de arte (×2 en pantalla)
export const ART_H = 44;

/** Mano delantera de una pose, en píxeles de arte dentro del cuadro (ya con lean/bob/lift). */
export function frontHand(frame) {
  const p = POSES[frame] || POSES[0];
  const [x, y] = p.front || [12, 28];
  return [x + (p.lean || 0) + 1, y + (p.bob || 0) - (p.lift || 0)];
}
