# Terra2D — Fase 1 (base jugable)

Juego 2D de supervivencia y construcción estilo Terraria que se juega en el navegador,
tanto en **PC** (teclado + ratón) como en **celular** (controles táctiles).
Hecho con **Phaser 3 + Vite + JavaScript**.

## Cómo ejecutarlo

Requisitos: [Node.js](https://nodejs.org/) 18 o superior.

```bash
npm install        # solo la primera vez
npm run dev        # abre http://localhost:5173
```

### Probarlo en el celular

1. Conecta la PC y el celular a la **misma red Wi-Fi**.
2. Ejecuta `npm run dev:movil`.
3. En la consola aparece una línea `Network: http://192.168.x.x:5173/`: abre esa dirección en el navegador del celular.
4. Gira el teléfono en **horizontal** (también funciona en vertical, pero se ve menos mundo).

### Instalar en el celular (como una app)

El juego se publica solo en **https://renzomoran9.github.io/TERRARIA.../** cada vez que se suben cambios
(ver `.github/workflows/deploy-pages.yml`). Abre esa dirección en el celular y:

- **Android (Chrome):** en el menú principal aparece el botón **Instalar en el celular** (o menú ⋮ → *Instalar app*).
- **iPhone (Safari):** botón **Compartir** → **Agregar a inicio**.

Queda un ícono en la pantalla de inicio; se abre a pantalla completa (también en iPhone) y **funciona sin internet**.
La partida guardada de la app es independiente de la del navegador.

> Para que la publicación funcione hay que activarla **una sola vez** en GitHub:
> **Settings → Pages → Build and deployment → Source: GitHub Actions**.

### Versión para publicar

```bash
npm run build      # genera la carpeta dist/
npm run preview    # sirve dist/ en http://localhost:4173 para probarla
```

La carpeta `dist/` se puede subir tal cual a cualquier hosting estático (GitHub Pages, Netlify, itch.io…).

## Controles

| Acción                | PC                                  | Celular                                        |
| --------------------- | ----------------------------------- | ---------------------------------------------- |
| Moverse               | `A` / `D` o flechas                 | Joystick (abajo a la izquierda)                |
| Saltar                | `Espacio`, `W` o flecha arriba      | Botón grande con flecha, o joystick hacia arriba |
| Elegir el bloque      | Con el ratón                        | **Tocar un bloque lo marca** con el recuadro amarillo (no lo mina). Con el dedo apoyado, **el recuadro lo sigue**: deslízalo hasta el bloque exacto y suelta. Si tocas cerca (en el aire), el recuadro se ajusta al bloque más cercano. Sin marcar, el recuadro elige solo el bloque más cercano hacia donde miras |
| Minar / talar         | Mantener **clic izquierdo**         | Mantener el **botón de acción** (pico): mina el bloque del recuadro y se detiene al terminar |
| Colocar bloque        | **Clic derecho**                    | Botón de acción en modo COLOCAR (un toque = un bloque; manteniéndolo, sigue poniendo después de un momento) |
| Paredes y muebles     | Elegirlos en la barra y **clic derecho** (se ve una vista previa) | Elegirlos en la barra y botón de acción (el recuadro muestra dónde quedan) |
| Quitar paredes        | Elegir el **martillo** y mantener clic izquierdo | Elegir el martillo y mantener el botón de acción |
| Usar puerta, silla o cama | **Clic derecho** sobre ella      | **Tocarla**                                    |
| Atacar                | Elegir una **espada** y mantener clic izquierdo hacia el enemigo | Elegir una espada: el botón de acción pasa a **ATACAR** y se gira solo hacia el enemigo más cercano |
| Apuntar sin marcar    | —                                   | Inclinar el joystick mientras se mantiene la acción (abajo = cavar hacia abajo) |
| Cambiar modo          | —                                   | Botón de flechas (MINAR ↔ COLOCAR). Elegir un bloque en la barra pasa solo a COLOCAR; un pico, a MINAR |
| Barra rápida          | Teclas `1`–`9` o rueda del ratón    | Tocar la casilla                               |
| Inventario y crafteo  | `E` (cerrar: `E` o `Esc`)           | Botón de cuadritos                             |
| Modo debug (FPS)      | `F3`                                | Tocar el reloj                                 |
| Pantalla completa     | —                                   | Botón de esquinas (arriba a la derecha)        |

En el inventario: clic/toque en una casilla para tomar o soltar una pila; clic derecho (PC) para tomar la mitad o dejar de a uno.

Para craftear: toca (o haz clic en) una receta para elegirla; debajo aparece qué necesitas y cuánto tienes.
Luego aprieta el botón **Craftear**. Si lo mantienes apretado, fabrica varias veces seguidas.
Mantener el clic sobre bloques y arrastrar permite minar o construir seguido.
Las **antorchas, la mesa de trabajo y los muebles** se ponen y se quitan **de a uno por pulsación** (aunque se mantenga apretado).
Las puertas se abren solas al caminar contra ellas y se cierran al alejarse. Para levantarse de la silla o de la cama, moverse o saltar.

## Qué incluye la Fase 1

- **Mundo procedural con semilla** (ruido Simplex): colinas de pasto, capa de tierra, piedra, cuevas tipo túnel y
  cavernas profundas, carbón e hierro, árboles, roca madre al fondo y paredes de fondo bajo tierra.
  El mundo mide 2048 × 384 bloques, dividido en **chunks de 32×32** que se generan, cargan y descargan según la cámara.
  Para usar una semilla concreta: `http://localhost:5173/?seed=12345` (también acepta texto: `?seed=hola`).
- **Jugador**: casi 2 bloques de alto (pasa por túneles de 2 bloques) y menos de 1 de ancho (cabe por pozos de
  1 bloque), con cabeza grande como en Terraria. Movimiento con aceleración, salto (más alto si se mantiene), gravedad, colisión con
  bloques y subida automática de escalones de 1 bloque. La cámara lo sigue.
- **Animaciones del personaje** (31 poses): respira y parpadea; camina (más rápido cuanto más corre) levantando polvo;
  salta estirándose, cae, agita los brazos en caídas largas y aterriza aplastándose; levanta y baja el pico al minar
  (con chispas en cada golpe); estira el brazo con el bloque al colocar; lleva la antorcha encendida en la mano
  (ilumina alrededor); empuja las paredes; pone cara de dolor al recibir daño; festeja con brillos al talar un árbol
  o craftear; con poca vida respira agitado y suda (y los corazones laten); si no lo tocas mira para atrás, bosteza
  y se sienta a dormir con "zzz"; al morir cae de espaldas y se desvanece, y reaparece con brillos saludando.
- **Minar y construir**: el tiempo depende de la dureza del bloque y del mejor pico del inventario. Alcance de unos 5 bloques.
  Talar el tronco derriba el árbol entero. La piedra y el carbón requieren pico de madera; el hierro, pico de piedra.
- **Casas**: paredes de fondo de madera, piedra y tierra (se ponen junto a otra pared o a un bloque y se quitan con el
  martillo), puertas de 3 bloques de alto, sillas para sentarse, mesas y camas. La silla y la cama miran hacia donde
  está el jugador al colocarlas. Los muebles se quitan enteros minando cualquier parte y se caen si se les quita el suelo.
  **Cama**: dormir en ella la vuelve el punto de reaparición; de noche, la noche pasa rápido hasta la mañana.
- **Enemigos y combate**: **slimes** (saltan hacia ti; verdes de día, azules de noche y en cuevas) y **zombis**
  (solo de noche; caminan hacia ti, suben escalones y saltan obstáculos de 2 bloques, pero **no abren puertas**).
  Aparecen fuera de la pantalla y nunca donde hay paredes de fondo puestas por ti. Hacen daño al tocarte, te
  empujan y quedas invulnerable un momento (parpadeas). Espadas de madera y de piedra; los slimes sueltan **gel**
  (1 madera + 1 gel → 3 antorchas). Al reaparecer se van los enemigos cercanos.
  **Para que una casa te proteja**: piso, techo y costados de **bloques** (tablones, piedra…) y una **puerta**.
  Las paredes de fondo solo decoran (se pasa por delante) y evitan que aparezcan enemigos adentro.
- **Inventario**: 36 casillas (9 de barra rápida), pilas de hasta 99.
- **Crafteo**: Madera → Tablones → Mesa de trabajo; cerca de la mesa: Pico de madera y Pico de piedra (más rápido).
  Antorchas: 1 madera + 1 carbón → 4 (o 1 madera + 1 gel → 3). Cerca de la mesa: espada de madera (7 tablones) y
  de piedra (3 tablones + 10 piedra); para las casas: martillo de madera (8 tablones),
  paredes ×4 (1 tablón, 1 piedra o 1 tierra), puerta (6 tablones), silla (4), mesa (8) y cama (15 tablones + 5 madera).
  La lista de recetas se desplaza con la rueda del ratón, arrastrando con el dedo o con las flechas ▲▼.
- **Día y noche**: ciclo de 10 minutos con amanecer y atardecer graduales. La luz se propaga por bloques:
  bajo tierra está oscuro y las antorchas iluminan alrededor.
- **Vida**: barra de vida, daño por caídas de más de 12 bloques, regeneración lenta y reaparición en el punto de inicio.
- **Guardado** en `localStorage`: mundo modificado, inventario, posición, vida y hora.
  Automático cada 60 s, al cerrar o minimizar la página, y con el botón *Guardar* del inventario.
- **HUD**: corazones de vida, barra rápida y hora del día; FPS y otros datos en modo debug.
- **Gráficos**: pixel art con 3 variantes por bloque, bordes y esquinas redondeadas automáticos, pasto alto y flores,
  árboles con copa y ramas, personaje animado, cielo con degradado según la hora, sol, luna, estrellas y nubes,
  paisaje de fondo con paralaje (montañas, colinas y bosque), luz de color (antorchas cálidas, noche azulada,
  atardecer anaranjado) con brillo parpadeante, polvo al correr o aterrizar, fragmentos al romper bloques,
  texto al recoger ítems, grietas por etapas y fuente pixel art (Pixelify Sans, licencia OFL).

## Reemplazar el arte (placeholders)

Todo el arte actual son **placeholders** dibujados por código. El archivo central [`src/assets.js`](src/assets.js)
asocia cada clave de textura con un archivo dentro de `public/assets/`:

- Si el archivo **existe**, el juego usa esa imagen.
- Si **no existe**, usa el placeholder.

Para cambiar un gráfico solo hay que copiar la imagen con el nombre exacto en la carpeta indicada; no hace falta tocar código.
Con `npm run dev` la página se recarga sola al agregar o cambiar una imagen. Para la versión publicada, vuelve a ejecutar `npm run build`.

Se recomienda **PNG con transparencia**. Si una imagen tiene otro tamaño se escala al tamaño de dibujo
(los bloques siempre se dibujan a 32×32), así que también se pueden usar imágenes al doble de resolución.

### Lista completa de imágenes (63)

**Bloques.** Basta con dibujar un bloque "entero" de 32×32: el juego genera solo el contorno oscuro y las esquinas
redondeadas donde el bloque toca aire, y las 16 combinaciones de vecinos. El pasto tapado por otro bloque usa la imagen de la tierra.

| Archivo (dentro de `public/assets/`) | Tamaño (px) | Qué es                                                                      |
| ------------------------------------ | ----------- | --------------------------------------------------------------------------- |
| `tiles/grass.png`                    | 32 × 32     | Bloque de pasto (tierra con pasto arriba)                                   |
| `tiles/dirt.png`                     | 32 × 32     | Bloque de tierra (también ícono del ítem *Tierra*)                          |
| `tiles/stone.png`                    | 32 × 32     | Bloque de piedra (también ícono del ítem *Piedra*)                          |
| `tiles/coal_ore.png`                 | 32 × 32     | Mena de carbón                                                              |
| `tiles/iron_ore.png`                 | 32 × 32     | Mena de hierro (también ícono del ítem *Mineral de hierro*)                 |
| `tiles/log.png`                      | 32 × 32     | Tronco de árbol                                                             |
| `tiles/leaves.png`                   | 32 × 32     | Hojas (solo aparecen en partidas creadas antes del pase visual)             |
| `tiles/planks.png`                   | 32 × 32     | Tablones (también ícono del ítem)                                           |
| `tiles/workbench.png`                | 32 × 32     | Mesa de trabajo, con fondo transparente (también ícono)                     |
| `tiles/torch.png`                    | 32 × 32     | Antorcha, con fondo transparente (también ícono)                            |
| `tiles/bedrock.png`                  | 32 × 32     | Roca madre (fondo del mundo, indestructible)                                |
| `tiles/plant_grass.png`              | 32 × 32     | Pasto alto decorativo (transparente)                                        |
| `tiles/plant_flower_red.png`         | 32 × 32     | Flor roja decorativa (transparente)                                         |
| `tiles/plant_flower_yellow.png`      | 32 × 32     | Flor amarilla decorativa (transparente)                                     |
| `walls/dirt_wall.png`                | 32 × 32     | Pared de fondo de tierra (más oscura que el bloque)                         |
| `walls/stone_wall.png`               | 32 × 32     | Pared de fondo de piedra (más oscura que el bloque)                         |
| `walls/wood_wall.png`                | 32 × 32     | Pared de fondo de madera (más oscura que los tablones)                      |
| `furniture/door_closed.png`          | 32 × 96     | Puerta cerrada (1×3 bloques, fondo transparente)                            |
| `furniture/door_open.png`            | 32 × 96     | Puerta abierta (1×3 bloques; la hoja de canto del lado de las bisagras, a la izquierda) |
| `furniture/chair.png`                | 32 × 64     | Silla (1×2) **mirando a la derecha**: respaldo a la izquierda, asiento a unos 20 px del piso (se refleja para la izquierda) |
| `furniture/table.png`                | 96 × 64     | Mesa (3×2 bloques)                                                          |
| `furniture/bed.png`                  | 128 × 64    | Cama (4×2) con la cabecera y la almohada **a la izquierda**; el colchón a unos 32 px del piso (se refleja para el otro lado) |
| `trees/tree_top.png`                 | 432 × 128   | Copas de árbol: **3 variantes de 144×128** una al lado de la otra; la base de la copa va abajo al centro |
| `trees/tree_branch.png`              | 32 × 32     | Ramita con hojas que sale del tronco **hacia la derecha** (se refleja para la izquierda) |
| `items/wood.png`                     | 32 × 32     | Ícono de *Madera*                                                           |
| `items/coal.png`                     | 32 × 32     | Ícono de *Carbón*                                                           |
| `items/wood_pickaxe.png`             | 32 × 32     | Ícono de *Pico de madera* (mango abajo a la izquierda, cabeza arriba a la derecha) |
| `items/stone_pickaxe.png`            | 32 × 32     | Ícono de *Pico de piedra* (misma orientación)                               |
| `items/wood_hammer.png`              | 32 × 32     | Ícono de *Martillo de madera* (misma orientación que los picos)            |
| `items/wood_wall.png`                | 32 × 32     | Ícono de *Pared de madera*                                                  |
| `items/stone_wall.png`               | 32 × 32     | Ícono de *Pared de piedra*                                                  |
| `items/dirt_wall.png`                | 32 × 32     | Ícono de *Pared de tierra*                                                  |
| `items/door.png`                     | 32 × 32     | Ícono de *Puerta*                                                           |
| `items/chair.png`                    | 32 × 32     | Ícono de *Silla*                                                            |
| `items/table.png`                    | 32 × 32     | Ícono de *Mesa*                                                             |
| `items/bed.png`                      | 32 × 32     | Ícono de *Cama*                                                             |
| `items/gel.png`                      | 32 × 32     | Ícono de *Gel*                                                              |
| `items/wood_sword.png`               | 32 × 32     | Ícono de *Espada de madera* (mango abajo a la izquierda, punta arriba a la derecha: así se ve en la mano) |
| `items/stone_sword.png`              | 32 × 32     | Ícono de *Espada de piedra* (misma orientación)                             |
| `enemies/slime.png`                  | 96 × 24     | Slime: **3 cuadros de 32×24** (quieto, aplastado, estirado) en **gris claro**: el juego lo tiñe de verde o azul |
| `enemies/zombie.png`                 | 240 × 64    | Zombi: **5 cuadros de 48×64** mirando a la derecha (caminar ×4 y golpeado), pies abajo al centro |
| `player/player.png`                  | 384 × 256   | Jugador: **31 poses de 48×64**, 8 por fila, mirando a la derecha (los pies tocan el borde de abajo). Orden: quieto, respirar, parpadear, caminar ×8, saltar, caer, agitar brazos, aterrizar, golpe ×3 (levantar, bajar, impacto), usar, daño, festejo, empujar, mirar atrás, bostezo, cansado ×2, sentado/dormido ×2, saludo ×2, sentado en una silla (ver `src/player/animations.js`) |
| `backgrounds/mountains.png`          | 960 × 320   | Montañas lejanas (se repite en horizontal: los bordes izquierdo y derecho deben empalmar) |
| `backgrounds/hills.png`              | 960 × 240   | Colinas intermedias (repetible en horizontal)                               |
| `backgrounds/forest.png`             | 960 × 240   | Bosque cercano (repetible en horizontal)                                    |
| `backgrounds/cloud.png`              | 128 × 48    | Nube                                                                        |
| `backgrounds/sun.png`                | 64 × 64     | Sol                                                                         |
| `backgrounds/moon.png`               | 48 × 48     | Luna                                                                        |
| `backgrounds/stars.png`              | 256 × 256   | Estrellas sobre fondo transparente (repetible)                              |
| `fx/glow.png`                        | 128 × 128   | Brillo de las antorchas (degradado radial sobre fondo transparente)         |
| `ui/slot.png`                        | 48 × 48     | Casilla de inventario                                                       |
| `ui/slot_selected.png`               | 48 × 48     | Casilla seleccionada                                                        |
| `ui/heart.png`                       | 24 × 24     | Corazón de vida (cada corazón = 20 de vida)                                 |
| `ui/crack.png`                       | 128 × 32    | Grietas al minar: **4 etapas de 32×32** (transparente)                      |
| `ui/joystick_base.png`               | 160 × 160   | Base del joystick táctil                                                    |
| `ui/joystick_thumb.png`              | 72 × 72     | Palanca del joystick táctil                                                 |
| `ui/button_jump.png`                 | 96 × 96     | Botón táctil de salto                                                       |
| `ui/button_mine.png`                 | 80 × 80     | Botón táctil de acción en modo MINAR                                        |
| `ui/button_place.png`                | 80 × 80     | Botón táctil de acción en modo COLOCAR                                      |
| `ui/button_attack.png`               | 80 × 80     | Botón táctil de acción con una espada elegida (ATACAR)                      |
| `ui/button_swap.png`                 | 64 × 64     | Botón táctil para cambiar entre MINAR y COLOCAR                             |
| `ui/button_inventory.png`            | 64 × 64     | Botón táctil de inventario                                                  |
| `ui/button_fullscreen.png`           | 48 × 48     | Botón táctil de pantalla completa                                           |

Las hojas de sprites (`player.png`, `tree_top.png`, `crack.png`) también aceptan un solo cuadro: si el jugador tiene
un único cuadro de 48×64, se usa sin animación. El pico y la antorcha se dibujan en la mano de adelante según la
posición de la mano en cada pose de `src/player/animations.js` (si dibujas tus propias poses, respeta esas posiciones
o ajústalas ahí).

## Estructura del código

```
index.html
vite.config.js         Vite + plugin que lista las imágenes existentes en public/assets
public/assets/         Aquí van las imágenes (ver tabla)
src/
  main.js              Configuración de Phaser
  config.js            Constantes (tamaño del mundo, física, alcance, ciclo de día…)
  assets.js            Mapa central clave → imagen
  scenes/              BootScene (carga), BackgroundScene (cielo y paisaje), MenuScene, GameScene (mundo) y UIScene (interfaz)
  world/               Ruido con semilla, bloques, generador, datos por chunks, renderizado de chunks y tileset
  player/              Jugador: física, colisiones, vida y daño por caída (Player), poses (animations) y animaciones y efectos (PlayerAnimator)
  systems/             Inventario, ítems, crafteo, minar/colocar, muebles (Furniture), día/noche, iluminación, guardado y placeholders (pixel art por código)
  ui/                  HUD, barra rápida, inventario, controles táctiles, debug y avisos
```

## Notas de rendimiento

- Cada chunk visible es un Tilemap de Phaser (un solo lote de dibujo por capa); los chunks de puro cielo no crean nada.
- La iluminación usa 1 píxel por bloque en un canvas diminuto, estirado con filtrado suave y multiplicado sobre la escena: una sola imagen para toda la pantalla.
- Los bordes de los bloques se generan una vez al iniciar (tileset de 16 combinaciones × 3 variantes); en juego no cuestan nada.
- En celulares la cámara se aleja un poco (zoom 0,6–1) para mostrar más mundo en pantallas pequeñas.
- `window.__game` da acceso al juego desde la consola del navegador para depurar.
