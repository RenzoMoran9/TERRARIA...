# Arte mejorado (src/art)

Todo el arte del juego se dibuja por código en `src/systems/Placeholders.js` (si no hay una imagen en
`public/assets/`). Cada módulo de esta carpeta **reemplaza** pintores de ese archivo con el mismo nombre:

```js
export const PIXEL = { dirt(pc, v, asset) { ... } }; // pixel art en una cuadrícula a la mitad, escalada ×2
export const CTX = { mountains(ctx, w, h, v, asset) { ... } }; // dibujo directo con canvas
export function patch(api) { ... } // opcional: retocar tablas internas (api.BG_THEMES, api.PLAYER_COLORS…)
```

- Los ayudantes de `Placeholders.js` (fillNoise, drawPose, sword…) y de `PixelArt.js` (PixelCanvas, hash,
  pick) se pueden importar, pero solo usarlos al pintar (nunca al cargar el módulo: la importación es circular).
- Si un pintor nuevo falla, se usa el original y se avisa en la consola.

| Módulo | Qué dibuja |
| --- | --- |
| terrain.js | Bloques del terreno, minerales y lava (y el contorno de los bloques en `world/Tileset.js`) |
| building.js | Construcción, paredes de fondo y muebles |
| flora.js | Plantas, árboles, troncos y cactus |
| characters.js | Jugador y aldeanos |
| monsters.js | Enemigos, jefes y sus proyectiles |
| fauna.js | Bichos y mascotas |
| gear.js | Herramientas, armas y armaduras (íconos) |
| items.js | Materiales, pociones, monedas, reliquias y otros ítems |
| sky.js | Cielo, sol, luna, nubes y paisajes de fondo |
| ui.js | Interfaz: casillas, corazones, botones, íconos del mapa |
