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
| Bajar de una plataforma | `S` o flecha abajo                | Joystick hacia abajo                           |
| Habilidades           | `K` (o el botón del inventario)     | Tocar tu nivel (arriba a la izquierda)         |
| Poderes               | `Shift` correr · `Q` embestida · `F` bola de fuego · abajo en el aire: golpe sísmico | Joystick a fondo · botones ≫ y de fuego · joystick abajo en el aire |
| Elegir el bloque      | Con el ratón                        | **Tocar un bloque lo marca** con el recuadro amarillo (no lo mina). Con el dedo apoyado, **el recuadro lo sigue**: deslízalo hasta el bloque exacto y suelta. Si tocas cerca (en el aire), el recuadro se ajusta al bloque más cercano. Sin marcar, el recuadro elige solo el bloque más cercano hacia donde miras |
| Minar / talar         | Mantener **clic izquierdo**         | Mantener el **botón de acción** (pico): mina el bloque del recuadro y se detiene al terminar |
| Colocar bloque        | **Clic derecho**                    | Botón de acción en modo COLOCAR (un toque = un bloque; manteniéndolo, sigue poniendo después de un momento) |
| Paredes y muebles     | Elegirlos en la barra y **clic derecho** (se ve una vista previa) | Elegirlos en la barra y botón de acción (el recuadro muestra dónde quedan) |
| Quitar paredes        | Elegir el **martillo** y mantener clic izquierdo | Elegir el martillo y mantener el botón de acción |
| Usar puerta, silla o cama | **Clic derecho** sobre ella      | **Tocarla**                                    |
| Atacar                | Elegir un **arma** y hacer clic izquierdo hacia el enemigo: cada clic es el siguiente golpe del combo (mantener = sigue solo) | Elegir un arma: el botón de acción pasa a **ATACAR**; cada toque es un golpe del combo y se gira solo hacia el enemigo más cercano |
| Apuntar sin marcar    | —                                   | Inclinar el joystick mientras se mantiene la acción (abajo = cavar hacia abajo) |
| Cambiar modo          | —                                   | Botón de flechas (MINAR ↔ COLOCAR). Elegir un bloque en la barra pasa solo a COLOCAR; un pico, a MINAR |
| Barra rápida          | Teclas `1`–`9` o rueda del ratón    | Tocar la casilla                               |
| Inventario y crafteo  | `E` (cerrar: `E` o `Esc`)           | Botón de cuadritos                             |
| Revisar casa          | `H` (o el botón del inventario)     | Botón *Revisar casa* del inventario            |
| Mapa                  | `M` (o el botón *Mapa* del inventario); `N` muestra u oculta el minimapa | Tocar el minimapa (a la izquierda, bajo el nivel) |
| Hablar con un aldeano | **Clic derecho** sobre él           | **Tocarlo**                                    |
| Tomar una poción      | `R`                                 | Botón de poción (aparece si tienes)            |
| Tirar lo de la mano   | `T`                                 | En el inventario: *Tirar al suelo* o la *Basura* |
| Sonido / música       | Botón *Sonido* (menú o inventario)  | Botón *Sonido* (menú o inventario)             |
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
- **Casas (como en Terraria)**: una casa es un cuarto encerrado por un **marco** de bloques sólidos (piso, techo
  y costados) con una **puerta** o **plataforma** para entrar, y relleno por dentro con **paredes de fondo**.
  Las paredes de fondo van *detrás* del personaje (por eso se pasa por delante, igual que en Terraria): lo que
  frena a los enemigos es el marco de bloques y la puerta (los zombis **no abren puertas**).
  **Vista exterior / interior**: desde afuera, cada casa se ve con su **fachada** (el frente de madera, ladrillo o
  tierra según sus paredes, con **ventanas** donde pusiste paredes de vidrio); al entrar por la puerta la fachada
  se desvanece y se ve el interior con los muebles. Las casas pueden compartir paredes, pisos y techos (edificios).
  **Casa válida** (para los aldeanos que vendrán): 60 a 750 bloques contando el marco, paredes de fondo puestas por
  ti (se permiten huecos chicos), una **luz**, algo para **sentarse** (silla o cama), una **superficie** (mesa o
  mesa de trabajo) y una **entrada**; no vale en las Tierras Sombrías. El botón **Revisar casa** del inventario
  (tecla **H** en la PC) revisa el cuarto donde estás, lo marca en verde o rojo y dice qué le falta.
  Construcción: **plataformas de madera** (1 madera → 2, a mano: se pisan, se atraviesan saltando desde abajo y se
  baja apretando abajo / joystick hacia abajo; sirven de escaleras, puentes y entrada), **vidrio** (arena en el
  Horno), **ventanas de vidrio** (1 vidrio → 4), **tejas de madera** (1 tablón → 2) y **tejas rojas** (2 tierra +
  1 piedra en el Horno → 2) para los techos; paredes de fondo de madera, piedra y tierra (se quitan con el
  martillo), puertas de 3 bloques, sillas, mesas y camas. La silla y la cama miran hacia el jugador al colocarlas.
  Los muebles se quitan enteros y se caen si se les quita el suelo (también se apoyan sobre plataformas).
  **Cama**: dormir en ella la vuelve el punto de reaparición; de noche, la noche pasa rápido hasta la mañana.
- **Armaduras, pociones y cristales de vida** (como Terraria):
  | Armadura | Casco / Pechera / Grebas (defensa) | Juego completo | Receta |
  | --- | --- | --- | --- |
  | Madera | 1 / 2 / 1 | +1 | 20 / 30 / 25 tablones (Mesa) |
  | Cactus | 2 / 3 / 2 | +2 | 20 / 30 / 25 cactus (Mesa) |
  | Hierro | 3 / 4 / 3 | +3 | 15 / 25 / 20 lingotes (Yunque) |
  | Cristal | 5 / 7 / 5 | +5 | cristal + lingotes (Yunque) |
  | Oro | 4 / 5 / 4 | +4 | 15 / 25 / 20 lingotes de oro (Yunque) |
  | Infernal | 7 / 9 / 7 | +6 | 15 / 25 / 20 lingotes infernales (Yunque) |
  Cada golpe te quita **la mitad de tu defensa** menos. Se ponen en las casillas de armadura del inventario
  (arrastrando, o con clic derecho en la PC) y **el personaje se ve con lo que lleva puesto**.
  **Pociones de curación**: menor (+50, 2 gel + 1 flor + 1 vidrio → 2, en la Mesa; también la vende el Comerciante)
  y normal (+100, 2 menores + 1 cristal, o 2 menores + 1 hongo brillante). Se toman con **R** (PC), el **botón de poción** (celular) o eligiéndolas
  y con la acción; después hay que esperar 45 s. Las **flores** sueltan *Flor* al romperlas.
  **Cristales de vida**: brillan en el piso de las cuevas profundas; cada uno da **+20 de vida máxima** para siempre
  (hasta 15). Con más vida aparecen más corazones (hasta 10, en dos filas).
- **Aldeanos y monedas** (como los NPC de Terraria): los enemigos sueltan **monedas** de cobre, plata y oro
  (100 cobre = 1 plata, 100 plata = 1 oro; van a la bolsa, no ocupan lugar). Los aldeanos viven en **casas válidas**
  (cada uno en la suya), pasean de día y vuelven a casa de noche, abren puertas y se esconden tras la fachada:
  - **Guía**: está desde el principio; da consejos y dice qué falta para que vengan los demás.
  - **Comerciante**: llega cuando juntas 50 de cobre y hay una casa libre. Vende antorchas, flechas, plataformas,
    vidrio, carbón, lingotes, cofres, camas, armas y hasta un pico de hierro; compra lo tuyo a 1/5 de su valor.
  - **Enfermera**: llega cuando tienes más de 100 de vida máxima y ya vive el Comerciante; te cura por monedas.
  Para hablar: **tocarlo** (celular) o **clic derecho** (PC) estando cerca. *Revisar casa* dice quién vive ahí.
- **Tirar y borrar ítems**: en el inventario, la casilla **Basura** borra lo que pongas (lo último se puede
  recuperar tocándola); con un ítem agarrado, **Tirar al suelo** (o tocar fuera del inventario) lo deja en el
  suelo; en la PC, **T** tira lo que tienes en la mano. Lo tirado tarda unos segundos en poder recogerse.
- **Experiencia, niveles y habilidades**: ganas **XP** venciendo enemigos (más por los fuertes y los de zonas
  lejanas), minando minerales (carbón, hierro, cristal, piedra sombría), talando árboles, descubriendo zonas, cuando
  una casa queda válida y al fabricar algo por primera vez. Cada **nivel** cura toda la vida y da **1 punto de
  habilidad** (cartel "¡Subiste de nivel!"; el nivel y la barra de experiencia se ven bajo los corazones).
  En **Habilidades** (tecla **K**, botón del inventario o tocar tu nivel en el celular) se gastan los puntos en
  tres ramas; cada una pide un nivel mínimo y algunas necesitan la anterior:
  | Habilidad | Rama | Desde nivel | Qué hace / cómo se usa |
  | --- | --- | --- | --- |
  | Correr | Movimiento | 2 | 60% más rápido. PC: mantener **Shift**; celular: joystick **a fondo** |
  | Doble salto | Movimiento | 3 | Saltar otra vez en el aire |
  | Embestida (2 ptos) | Movimiento | 5 | Te lanzas hacia adelante golpeando a quien atraviesas; no te pegan mientras dura. PC: **Q**; celular: botón ≫ |
  | Piel dura (×3) | Combate | 2 | Cada golpe te quita 2 menos por nivel |
  | Bola de fuego (2 ptos) | Combate | 4 | Explota y quema a los cercanos. PC: **F** (apunta al ratón); celular: botón de fuego (apunta sola) |
  | Golpe sísmico (2 ptos) | Combate | 6 | En el aire, **abajo**: caes en picada y una onda golpea y lanza a todos alrededor (sin daño por caída) |
  | Vida extra (×3) | Supervivencia | 2 | +20 de vida máxima por nivel |
  | Regeneración (×2) | Supervivencia | 3 | Recuperas vida más rápido |
  | Imán | Supervivencia | 2 | Los objetos vienen desde el doble de lejos |
  | Minero veloz (×2) | Supervivencia | 3 | Minas y talas 30% más rápido por nivel |
  Correr, la embestida, la bola de fuego y el golpe sísmico gastan **energía** (barra amarilla bajo la experiencia),
  que se recarga sola. El daño de los poderes sube con tu nivel. Todo se guarda con la partida.
- **Mundo con zonas** (cada vez más peligrosas cuanto más lejos del inicio): el **Bosque** en el centro; hacia un
  lado **Desierto** (dunas, cactus que pinchan y una **pirámide con un cofre del tesoro**), **Tierras Sombrías**
  (pasto violeta, abismos, piedra sombría) y **Tierras de Cristal** (torres de cristal que brillan); hacia el otro,
  **Tundra nevada** (pinos, hielo), **Selva** (árboles gigantes con lianas, barro, flores que brillan) y el **Volcán**
  (ceniza, basalto, cráter con **lava que quema**). Cada zona tiene su propio paisaje de fondo con paralaje, su color
  de cielo y sus partículas (nieve, polvo de arena, luciérnagas, esporas, destellos, brasas y ceniza); el fondo se
  funde suavemente al pasar de una zona a otra. Al entrar por primera vez aparece el cartel **¡Zona descubierta!**
  con su nivel de peligro (★) y cuántas llevas (se guarda con la partida); arriba a la derecha se ve la zona actual.
  **Enemigos de cada zona**: escorpiones (Desierto), avispas que se lanzan en picada (Selva), ojos voladores
  (Tierras Sombrías y de Cristal), murciélagos de fuego (Volcán), slimes de arena, hielo, selva, sombra, cristal y
  lava, y zombis de cada zona. En las zonas lejanas tienen más vida, pegan más fuerte y aparecen más seguido.
  Sueltan materiales de su zona (arena, hielo, barro, piedra sombría, cristal, carbón, cactus).
  Las zonas nuevas aparecen completas en un **mundo nuevo**; en una partida vieja, lo que ya habías modificado se mantiene.
- **Mundo, segunda parte** (más allá de la superficie):
  - **Islas flotantes**: muy arriba en el cielo hay islas de **nubes** con pasto, árboles, una casita y un
    **cofre con premio** (arco de oro, espada de oro, pico de oro o cristal de vida, más lingotes de oro,
    pociones, nubes y flechas). Hay que construir hacia arriba (plataformas, bloques) para llegar.
    Debajo de cada isla cuelga una **neblina** suave que se mece con el viento.
  - **Cuevas de hongos**: bolsones bajo tierra con **pasto de hongos** azul y **hongos brillantes** que alumbran;
    los hongos sirven para la **poción de curación** (2 menores + 1 hongo). Tienen sus slimes de hongo.
  - **Inframundo**: el fondo del mundo, con mares de **lava**, ceniza, basalto y **piedra infernal**; el aire tiene
    un resplandor rojizo. Aparecen murciélagos de fuego y slimes de lava. ¡Cuidado con caerte en la lava!
  - **Minerales y picos por nivel**: el **oro** aparece en las cuevas profundas (necesita pico de hierro); la
    **piedra infernal** solo con **pico de oro**. En el Horno: 4 mineral de oro → 1 lingote de oro;
    3 piedra infernal + 1 basalto → 1 lingote infernal. En el Yunque:
    | Ítem | Receta | Datos |
    | --- | --- | --- |
    | Pico de oro | 12 lingotes de oro + 3 madera | nivel 4, muy rápido; mina la piedra infernal |
    | Espada de oro | 9 lingotes de oro | daño 32 |
    | Arco de oro | 8 lingotes de oro + 2 madera | dispara flechas más rápido y fuerte |
    | Pico infernal | 15 lingotes infernales | nivel 5, el más rápido |
    | Espada infernal | 18 lingotes infernales | daño 46, la más fuerte |
  Cada una de estas zonas tiene su cartel de descubrimiento, su música, sus partículas (esporas, nubes, brasas)
  y su fondo. El Guía también da consejos sobre ellas. Aparecen completas en un **mundo nuevo**.
- **Enemigos y combate**: **slimes** (saltan hacia ti; verdes de día, azules de noche y en cuevas) y **zombis**
  (solo de noche; caminan hacia ti, suben escalones y saltan obstáculos de 2 bloques, pero **no abren puertas**).
  Aparecen fuera de la pantalla y nunca donde hay paredes de fondo puestas por ti. Hacen daño al tocarte, te
  empujan y quedas invulnerable un momento (parpadeas). Espadas de madera y de piedra; los slimes sueltan **gel**
  (1 madera + 1 gel → 3 antorchas). Al reaparecer se van los enemigos cercanos.
- **Jefes y reliquias**: seis **guardianes** viven en guaridas bajo sus zonas (se baja por un **pozo con
  plataformas**) y protegen una **reliquia** que flota sobre un altar. Al acercarte al altar el jefe despierta
  (rugido, temblor, barra de vida arriba y música de pelea); dentro de su sala te ataca con sus propios
  movimientos y, con la mitad de la vida, **se enfurece** (más rápido y más ataques). Si te alejas o mueres,
  vuelve a dormir. El **Guía** (botón *¿Hay jefes?*) te dice dónde está cada uno, y en el mapa aparece una
  calavera cuando ves su guarida.
  | Jefe | Dónde | Cómo pelea | Reliquia (usarla una vez) |
  | --- | --- | --- | --- |
  | Rey Slime (700) | Bajo el Bosque | Saltos, salto gigante que aplasta, llama slimes; se teletransporta | Corona: +20 vida máx., +1 punto, +400 XP |
  | Escorpión Rey (1100) | Bajo la pirámide | Te persigue, abanico de aguijones; embiste | Aguijón dorado: +2 defensa, +1 punto, +700 XP |
  | Reina Avispa (1500) | Bajo la Selva | Aguijones desde arriba, embestidas de lado a lado, avispas | Corazón de la colmena: más regeneración, +2 puntos, +1000 XP |
  | Ojo Sombrío (2000) | Bajo las Tierras Sombrías | Orbes, ojitos, embestidas; abre la boca y acelera | Ojo de las sombras: +10% daño, +2 puntos, +1500 XP |
  | Golem de Cristal (2800) | Bajo las Tierras de Cristal | Astillas en todas direcciones, saltos que aplastan | Núcleo de cristal: +40 vida máx., +2 puntos, +2200 XP |
  | Señor de las Llamas (3800) | Inframundo, bajo el Volcán | Ráfagas de fuego, lluvia de fuego, aparece a tu lado | Llama eterna: +4 defensa, +15% daño, +3 puntos, +3500 XP |
  Al vencerlos sueltan su reliquia, **monedas de oro**, pociones y mucha **experiencia**. Cada reliquia se puede
  **usar una sola vez** (la mejora es para siempre) o **vendérsela al Comerciante** a buen precio. Al día
  siguiente la reliquia vuelve al altar y se puede pelear la revancha (da la mitad de premio).
- **Fauna** (como los bichos de Terraria): pájaros, conejos, mariposas y otros animales inofensivos aparecen cerca
  de ti según la zona y la hora, y **huyen si te acercas** (los pájaros levantan vuelo aleteando):
  bosque (pájaros, conejos, mariposas), desierto (lagartijas, buitres que planean), tundra (pingüinos, pájaros
  de las nieves), selva (loros, ranas), Tierras Sombrías (cuervos), Tierras de Cristal (mariposas que brillan),
  volcán e inframundo (polillas de brasa), islas flotantes (gaviotas), cuevas (ratones) y cuevas de hongos
  (caracoles brillantes). De noche quedan menos (conejos, ranas…). Se los oye: cantos, graznidos, croar, aleteos.
- **Mapa y orientación** (como en Terraria):
  - **Minimapa** (arriba a la derecha en la PC, a la izquierda en el celular): muestra lo que ya exploraste,
    con tu cabeza, **tu casa** (tu cama, o el inicio si no dormiste en una), los **aldeanos** y tus marcadores.
  - **Mapa completo** (`M`, botón *Mapa* del inventario o tocando el minimapa): empieza todo negro y se va
    descubriendo al explorar (en la superficie se ve más lejos, con el cielo). Se arrastra para moverlo, tiene
    zoom (rueda o − / +) y botones **Yo** y **Casa** para centrarlo. Muestra los nombres de las zonas
    descubiertas y abajo dice **dónde estás** y **hacia dónde queda tu casa** ("120 bloques al Oeste y 13 hacia
    abajo"). **Tocar el mapa pone o quita un marcador** (hasta 8). Lo explorado y los marcadores se guardan.
  - **Flechas en el borde de la pantalla**: cuando estás lejos, una flecha con una casita apunta a tu casa (con
    la distancia en bloques) y flechas rojas apuntan a tus marcadores.
  - **Brújula** (4 lingotes de hierro + 1 vidrio, Yunque) y **Medidor de profundidad** (4 lingotes + 3 carbón,
    Yunque): llevándolos en el inventario, bajo el minimapa se lee "120 al Este · 35 de profundidad".
  - **Espejo mágico** (está en el cofre de la pirámide; o 10 vidrio + 6 lingotes + 3 cristal en el Yunque):
    úsalo y vuelves a tu cama (o al inicio); no se gasta. **Poción de regreso** (1 hongo brillante + 1 flor +
    1 vidrio → 2, en la Mesa; también en los cofres de las islas): lo mismo, pero se gasta.
- **Combos de armas**: **un toque = un golpe entero** (no hace falta mantener apretado; si lo mantienes, sigue
  atacando solo). Cada toque hace el **siguiente movimiento** del combo (5 por arma) y el arma deja un rastro del
  color de su material; si dejas de atacar un segundo, el combo vuelve a empezar. El último golpe se anuncia.
  | Arma | Los 5 movimientos |
  | --- | --- |
  | Espadas | Tajo · Revés (lanza hacia arriba) · Estocada · Giro (golpea a los dos lados) · **Golpe final** (salta y cae con onda) |
  | Daga | Puñalada · Tajo · Puñalada baja · Revés · Remolino (dos golpes) |
  | Maza | Mazazo · Gancho (lanza lejos hacia arriba) · Molino · Mazazo doble · **Terremoto** (onda alrededor) |
  | Lanza | Estocada · Estocada alta · Barrido · Doble estocada · **Embestida** (te lanzas hacia adelante) |
  | Arcos | Disparo · Disparo rápido · Doble disparo · Abanico de 3 flechas · **Tiro cargado** (más rápido y fuerte) |
  | Cuchillos | Lanzamiento · Lanzamiento rápido · Doble · Abanico de 3 · **Tiro fuerte** |
- **Armas de todo tipo** (en la PC se apunta con el ratón; en el celular el botón ATACAR apunta solo al enemigo
  más cercano):
  | Arma | Tipo | Receta |
  | --- | --- | --- |
  | Espadas de madera, piedra y hierro | Golpe en arco | Mesa / Mesa / Yunque |
  | Daga de hierro | Muy rápida, poco alcance | 4 lingotes (Yunque) |
  | Maza de piedra | Lenta, golpe fuerte que empuja lejos | 3 tablones + 14 piedra (Mesa) |
  | Lanza de hierro | Estocada larga (3 bloques) | 6 lingotes + 4 madera (Yunque) |
  | Arcos de madera y de hierro | Disparan **flechas** (las gastan) | 10 madera (Mesa) / 8 lingotes + 2 madera (Yunque) |
  | Flechas de madera ×10 | Munición del arco | 1 madera + 1 piedra (Mesa) |
  | Bumerán de madera | Va, golpea y vuelve a la mano | 8 tablones (Mesa) |
  | Cuchillos arrojadizos ×15 | Se lanzan y se gastan | 1 lingote (Yunque) |
  | Espada de cactus | Golpe en arco (mejor que la de piedra) | 10 cactus (Mesa) |
  | Espada de cristal | La más fuerte por ahora | 20 cristal + 5 lingotes (Yunque) |
- **Progresión**: con el **Horno** (20 piedra + 4 madera + 3 antorchas, en la mesa) se funde el mineral de hierro
  (3 → 1 lingote) y se hacen **ladrillos de piedra** (2 piedra → 1, un bloque sólido para construir). Con 5 lingotes
  se hace el **Yunque de hierro**, donde se fabrican el pico (12 lingotes + 3 madera, el más rápido), la espada
  (8 lingotes, la más fuerte) y el martillo de hierro (10 lingotes + 3 madera). El horno ilumina y su fuego brilla.
  En el inventario se ve qué estaciones hay cerca (Mesa, Horno, Yunque).
- **Objetos en el suelo**: lo que rompes, talas, sueltan los enemigos o los muebles que se caen salta al suelo y
  vuela hacia ti cuando estás cerca (hasta ~6 bloques). Con el inventario lleno se queda esperando. Se guardan con la partida.
- **Cofres** (8 tablones + 2 madera, en la mesa; 2×2 bloques): guardan 30 pilas. Se abren tocándolos (celular) o con
  clic derecho (PC): el inventario se abre con el cofre al lado; **tocar una pila la pasa de un lado al otro**, y hay
  botones *Guardar todo* (la mochila, sin la barra rápida) y *Sacar todo*. Un cofre con cosas no se puede romper;
  si se le quita el suelo, se cae y suelta lo que tenía. Se cierra solo si te alejas.
- **Inventario**: 36 casillas (9 de barra rápida), pilas de hasta 99.
  **Información de los ítems**: mantener apretada una casilla (celular) o pasar el ratón (PC) muestra qué es y sus
  datos: daño, velocidad, daño por segundo, alcance y empuje de las armas; poder y velocidad de los picos; para qué
  sirve cada material o mueble. Funciona en la barra rápida, el inventario, los cofres y la lista de recetas.
- **Crafteo**: Madera → Tablones → Mesa de trabajo; cerca de la mesa: Pico de madera y Pico de piedra (más rápido).
  Antorchas: 1 madera + 1 carbón → 4 (o 1 madera + 1 gel → 3). Cerca de la mesa: espada de madera (7 tablones) y
  de piedra (3 tablones + 10 piedra); para las casas: martillo de madera (8 tablones),
  paredes ×4 (1 tablón, 1 piedra o 1 tierra), puerta (6 tablones), silla (4), mesa (8) y cama (15 tablones + 5 madera).
  La lista de recetas se desplaza con la rueda del ratón, arrastrando con el dedo o con las flechas ▲▼.
- **Sonido y música**: **sonidos reales** (generados con IA de efectos de sonido, en `src/sounds/`) para minar
  (distinto en tierra, piedra y madera, con variantes), romper, colocar, talar, recoger, monedas, pasos, saltar,
  aterrizar (más fuerte cuanto más alto), espadas, impactos, arcos, cuchillos, bola de fuego, explosiones,
  embestida, golpe sísmico, lava, puertas, cofres, crafteo, beber pociones, el espejo mágico, subir de nivel,
  zona descubierta y casa válida. Los **monstruos se oyen**: gruñidos de zombis, slimes que rebotan, chillidos de
  los voladores. Cada sonido varía un poco de tono para no repetirse, y los lejanos suenan más bajo.
  **Ambiente de cada zona** que se funde al cambiar: pájaros en el bosque de día, grillos y búho de noche, viento
  en el desierto y la tundra, selva, Tierras Sombrías, cristales, volcán, goteo en las cuevas, cuevas de hongos,
  viento en las islas y lava en el inframundo.
  **Música generativa** (hecha por código) que cambia con suavidad según dónde estás. Botón **Sonido** en el menú y
  en el inventario: todo → sin música → apagado (se recuerda). El sonido empieza con el primer toque o tecla
  (los navegadores no permiten sonar antes).
  **Cambiar un sonido**: reemplaza el archivo `src/sounds/nombre_0.mp3` (o agrega `nombre_1.mp3`, `nombre_2.mp3`…
  como variantes que se eligen al azar). Si falta el archivo de un efecto, el juego lo sintetiza.
- **Día y noche**: ciclo de 10 minutos con amanecer y atardecer graduales. La luz se propaga por bloques:
  bajo tierra está oscuro y las antorchas iluminan alrededor.
- **Vida**: barra de vida, daño por caídas de más de 12 bloques, regeneración lenta y reaparición en el punto de inicio.
- **Guardado** en `localStorage`: mundo modificado, inventario, posición, vida y hora.
  Automático cada 60 s, al cerrar o minimizar la página, y con el botón *Guardar* del inventario.
- **HUD**: corazones de vida, nivel con barra de experiencia y de energía, barra rápida y hora del día; FPS y otros datos en modo debug.
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

### Lista completa de imágenes (237)

**Fachadas.** Desde afuera, cada casa muestra la imagen del bloque que corresponde a sus paredes
(pared de madera → `tiles/planks.png`, de piedra → `tiles/stone_brick.png`, de tierra → `tiles/dirt.png`) y
`walls/window_outside.png` en las ventanas.

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
| `tiles/stone_brick.png`              | 32 × 32     | Ladrillo de piedra (también ícono del ítem)                                 |
| `tiles/wood_platform.png`            | 32 × 32     | Plataforma de madera: la tabla arriba (lo que se pisa), el resto transparente (también ícono) |
| `tiles/glass.png`                    | 32 × 32     | Bloque de vidrio (semitransparente) |
| `tiles/red_shingles.png`             | 32 × 32     | Tejas rojas (techos) |
| `tiles/wood_shingles.png`            | 32 × 32     | Tejas de madera (techos) |
| `tiles/life_crystal.png`             | 32 × 32     | Cristal de vida en la cueva (transparente alrededor) |
| `tiles/sand.png`                     | 32 × 32     | Arena (Desierto; también ícono) |
| `tiles/sandstone.png`                | 32 × 32     | Arenisca (piedra del Desierto y de la pirámide) |
| `tiles/snow.png`                     | 32 × 32     | Nieve (Tundra) |
| `tiles/ice.png`                      | 32 × 32     | Hielo (piedra de la Tundra) |
| `tiles/jungle_grass.png`             | 32 × 32     | Pasto de la Selva (sobre barro) |
| `tiles/mud.png`                      | 32 × 32     | Barro (Selva) |
| `tiles/shadow_grass.png`             | 32 × 32     | Pasto violeta (Tierras Sombrías) |
| `tiles/shadow_stone.png`             | 32 × 32     | Piedra sombría (necesita pico de hierro) |
| `tiles/crystal_grass.png`            | 32 × 32     | Pasto de cristal (Tierras de Cristal) |
| `tiles/crystal.png`                  | 32 × 32     | Cristal: torres que brillan (necesita pico de hierro) |
| `tiles/ash.png`                      | 32 × 32     | Ceniza (Volcán) |
| `tiles/basalt.png`                   | 32 × 32     | Basalto (roca del Volcán) |
| `tiles/lava.png`                     | 32 × 32     | Lava (no sólida, ilumina y quema) |
| `tiles/cactus.png`                   | 32 × 32     | Tronco de cactus (pincha; también ícono del ítem) |
| `tiles/plant_desert.png`             | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_desert2.png`            | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_snow.png`               | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_snow2.png`              | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_jungle.png`             | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_jungle2.png`            | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_shadow.png`             | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_shadow2.png`            | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_crystal.png`            | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_crystal2.png`           | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_crystal3.png`           | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_volcano.png`            | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/plant_volcano2.png`           | 32 × 32     | Planta decorativa de la zona (transparente) |
| `tiles/gold_ore.png`                 | 32 × 32     | Mineral de oro (cuevas profundas; necesita pico de hierro) |
| `tiles/hellstone.png`                | 32 × 32     | Piedra infernal (Inframundo; brilla, necesita pico de oro) |
| `tiles/cloud.png`                    | 32 × 32     | Nube (islas flotantes; también ícono) |
| `tiles/mushroom_grass.png`           | 32 × 32     | Pasto de hongos (cuevas de hongos, sobre barro) |
| `tiles/mushroom_plant.png`           | 32 × 32     | Hongo brillante (planta, transparente; también ícono del ítem) |
| `tiles/mushroom_plant2.png`          | 32 × 32     | Hongo brillante, otra forma (transparente) |
| `tiles/relic_altar.png`              | 32 × 32     | Altar de la reliquia (guaridas de los jefes; no se rompe) |
| `walls/dirt_wall.png`                | 32 × 32     | Pared de fondo de tierra (más oscura que el bloque)                         |
| `walls/stone_wall.png`               | 32 × 32     | Pared de fondo de piedra (más oscura que el bloque)                         |
| `walls/wood_wall.png`                | 32 × 32     | Pared de fondo de madera (más oscura que los tablones)                      |
| `walls/glass_wall.png`               | 32 × 32     | Ventana vista desde adentro (semitransparente: se ve el paisaje detrás) |
| `walls/window_outside.png`           | 32 × 32     | Ventana vista desde afuera, en la fachada de las casas |
| `walls/sandstone_wall.png`           | 32 × 32     | Pared de arenisca (dentro de la pirámide y cuevas del Desierto) |
| `walls/ice_wall.png`                 | 32 × 32     | Pared de hielo (cuevas de la Tundra) |
| `walls/mud_wall.png`                 | 32 × 32     | Pared de barro (cuevas de la Selva) |
| `walls/shadow_wall.png`              | 32 × 32     | Pared sombría (Tierras Sombrías) |
| `walls/ash_wall.png`                 | 32 × 32     | Pared de ceniza (Volcán) |
| `furniture/door_closed.png`          | 32 × 96     | Puerta cerrada (1×3 bloques, fondo transparente)                            |
| `furniture/door_open.png`            | 32 × 96     | Puerta abierta (1×3 bloques; la hoja de canto del lado de las bisagras, a la izquierda) |
| `furniture/chair.png`                | 32 × 64     | Silla (1×2) **mirando a la derecha**: respaldo a la izquierda, asiento a unos 20 px del piso (se refleja para la izquierda) |
| `furniture/table.png`                | 96 × 64     | Mesa (3×2 bloques)                                                          |
| `furniture/chest.png`                | 64 × 64     | Cofre (2×2 bloques)                                                         |
| `furniture/furnace.png`              | 64 × 64     | Horno (2×2 bloques) con la boca y el fuego abajo                            |
| `furniture/anvil.png`                | 64 × 32     | Yunque de hierro (2×1 bloques)                                              |
| `furniture/bed.png`                  | 128 × 64    | Cama (4×2) con la cabecera y la almohada **a la izquierda**; el colchón a unos 32 px del piso (se refleja para el otro lado) |
| `trees/tree_top.png`                 | 432 × 128   | Copas de árbol: **3 variantes de 144×128** una al lado de la otra; la base de la copa va abajo al centro |
| `trees/tree_branch.png`              | 32 × 32     | Ramita con hojas que sale del tronco **hacia la derecha** (se refleja para la izquierda) |
| `trees/tree_top_pine.png`            | 432 × 128   | Copas de pino nevado (3 variantes de 144×128, como `tree_top.png`) |
| `trees/tree_top_jungle.png`          | 432 × 128   | Copas de árbol de la Selva (3 variantes) |
| `trees/tree_top_shadow.png`          | 432 × 128   | Copas de árbol sombrío (3 variantes) |
| `items/wood.png`                     | 32 × 32     | Ícono de *Madera*                                                           |
| `items/coal.png`                     | 32 × 32     | Ícono de *Carbón*                                                           |
| `items/wood_pickaxe.png`             | 32 × 32     | Ícono de *Pico de madera* (mango abajo a la izquierda, cabeza arriba a la derecha) |
| `items/stone_pickaxe.png`            | 32 × 32     | Ícono de *Pico de piedra* (misma orientación)                               |
| `items/wood_hammer.png`              | 32 × 32     | Ícono de *Martillo de madera* (misma orientación que los picos)            |
| `items/wood_wall.png`                | 32 × 32     | Ícono de *Pared de madera*                                                  |
| `items/stone_wall.png`               | 32 × 32     | Ícono de *Pared de piedra*                                                  |
| `items/dirt_wall.png`                | 32 × 32     | Ícono de *Pared de tierra*                                                  |
| `items/glass_wall.png`               | 32 × 32     | Ícono de *Ventana de vidrio* |
| `items/coin_copper.png`              | 32 × 32     | Moneda de cobre |
| `items/coin_silver.png`              | 32 × 32     | Moneda de plata |
| `items/coin_gold.png`                | 32 × 32     | Moneda de oro |
| `items/wood_helmet.png`              | 32 × 32     | Casco de madera |
| `items/wood_chest.png`               | 32 × 32     | Pechera de madera |
| `items/wood_legs.png`                | 32 × 32     | Grebas de madera |
| `items/cactus_helmet.png`            | 32 × 32     | Casco de cactus |
| `items/cactus_chest.png`             | 32 × 32     | Pechera de cactus |
| `items/cactus_legs.png`              | 32 × 32     | Grebas de cactus |
| `items/iron_helmet.png`              | 32 × 32     | Casco de hierro |
| `items/iron_chest.png`               | 32 × 32     | Pechera de hierro |
| `items/iron_legs.png`                | 32 × 32     | Grebas de hierro |
| `items/crystal_helmet.png`           | 32 × 32     | Casco de cristal |
| `items/crystal_chest.png`            | 32 × 32     | Pechera de cristal |
| `items/crystal_legs.png`             | 32 × 32     | Grebas de cristal |
| `items/healing_potion.png`           | 32 × 32     | Poción de curación menor |
| `items/greater_healing_potion.png`   | 32 × 32     | Poción de curación |
| `items/life_crystal.png`             | 32 × 32     | Cristal de vida (ítem) |
| `items/flower.png`                   | 32 × 32     | Flor |
| `items/recall_potion.png`            | 32 × 32     | Poción de regreso |
| `items/magic_mirror.png`             | 32 × 32     | Espejo mágico |
| `items/compass.png`                  | 32 × 32     | Brújula |
| `items/depth_meter.png`              | 32 × 32     | Medidor de profundidad |
| `items/relic_crown.png`              | 32 × 32     | Corona del Rey Slime |
| `items/relic_stinger.png`            | 32 × 32     | Aguijón dorado |
| `items/relic_hive.png`               | 32 × 32     | Corazón de la colmena |
| `items/relic_eye.png`                | 32 × 32     | Ojo de las sombras |
| `items/relic_core.png`               | 32 × 32     | Núcleo de cristal |
| `items/relic_flame.png`              | 32 × 32     | Llama eterna |
| `items/gold_bar.png`                 | 32 × 32     | Lingote de oro |
| `items/hellstone_bar.png`            | 32 × 32     | Lingote infernal |
| `items/glowing_mushroom.png`         | 32 × 32     | Hongo brillante (ítem) |
| `items/gold_pickaxe.png`             | 32 × 32     | Pico de oro |
| `items/hell_pickaxe.png`             | 32 × 32     | Pico infernal |
| `items/gold_sword.png`               | 32 × 32     | Espada de oro |
| `items/hell_sword.png`               | 32 × 32     | Espada infernal |
| `items/gold_bow.png`                 | 32 × 32     | Arco de oro |
| `items/gold_helmet.png`              | 32 × 32     | Casco de oro |
| `items/gold_chest.png`               | 32 × 32     | Pechera de oro |
| `items/gold_legs.png`                | 32 × 32     | Grebas de oro |
| `items/hell_helmet.png`              | 32 × 32     | Casco infernal |
| `items/hell_chest.png`               | 32 × 32     | Pechera infernal |
| `items/hell_legs.png`                | 32 × 32     | Grebas infernales |
| `items/door.png`                     | 32 × 32     | Ícono de *Puerta*                                                           |
| `items/chair.png`                    | 32 × 32     | Ícono de *Silla*                                                            |
| `items/table.png`                    | 32 × 32     | Ícono de *Mesa*                                                             |
| `items/bed.png`                      | 32 × 32     | Ícono de *Cama*                                                             |
| `items/chest.png`                    | 32 × 32     | Ícono de *Cofre*                                                            |
| `items/furnace.png`                  | 32 × 32     | Ícono de *Horno*                                                            |
| `items/anvil.png`                    | 32 × 32     | Ícono de *Yunque de hierro*                                                 |
| `items/iron_bar.png`                 | 32 × 32     | Ícono de *Lingote de hierro*                                                |
| `items/iron_pickaxe.png`             | 32 × 32     | Ícono de *Pico de hierro* (misma orientación que los otros picos)          |
| `items/iron_sword.png`               | 32 × 32     | Ícono de *Espada de hierro* (misma orientación que las otras espadas)      |
| `items/iron_hammer.png`              | 32 × 32     | Ícono de *Martillo de hierro*                                               |
| `items/iron_dagger.png`              | 32 × 32     | Ícono de *Daga de hierro* (como todas las armas: mango abajo a la izquierda, punta arriba a la derecha) |
| `items/stone_mace.png`               | 32 × 32     | Ícono de *Maza de piedra*                                                   |
| `items/iron_spear.png`               | 32 × 32     | Ícono de *Lanza de hierro*                                                  |
| `items/wood_bow.png`                 | 32 × 32     | Ícono de *Arco de madera* **apuntando a la derecha** (cuerda a la izquierda) |
| `items/iron_bow.png`                 | 32 × 32     | Ícono de *Arco de hierro* (misma orientación)                               |
| `items/wood_arrow.png`               | 32 × 32     | *Flecha de madera* (punta arriba a la derecha; también se ve volando)       |
| `items/wood_boomerang.png`           | 32 × 32     | *Bumerán de madera* (también se ve girando en el aire)                      |
| `items/throwing_knife.png`           | 32 × 32     | *Cuchillo arrojadizo* (punta arriba a la derecha)                           |
| `items/gel.png`                      | 32 × 32     | Ícono de *Gel*                                                              |
| `items/wood_sword.png`               | 32 × 32     | Ícono de *Espada de madera* (mango abajo a la izquierda, punta arriba a la derecha: así se ve en la mano) |
| `items/stone_sword.png`              | 32 × 32     | Ícono de *Espada de piedra* (misma orientación)                             |
| `items/cactus.png`                   | 32 × 32     | Ícono de *Cactus* |
| `items/cactus_sword.png`             | 32 × 32     | Ícono de *Espada de cactus* |
| `items/crystal_sword.png`            | 32 × 32     | Ícono de *Espada de cristal* |
| `enemies/slime.png`                  | 96 × 24     | Slime: **3 cuadros de 32×24** (quieto, aplastado, estirado) en **gris claro**: el juego lo tiñe de verde o azul |
| `enemies/zombie.png`                 | 240 × 64    | Zombi: **5 cuadros de 48×64** mirando a la derecha (caminar ×4 y golpeado), pies abajo al centro |
| `enemies/scorpion.png`               | 120 × 24    | Escorpión: **3 cuadros de 40×24** caminando, mirando a la derecha |
| `enemies/wasp.png`                   | 64 × 28     | Avispa: **2 cuadros de 32×28** (alas arriba y abajo) |
| `enemies/eye.png`                    | 64 × 24     | Ojo volador: **2 cuadros de 32×24**, mirando a la derecha |
| `enemies/firebat.png`                | 108 × 24    | Murciélago de fuego: **3 cuadros de 36×24** (aleteo) |
| `critters/bird.png`                  | 96 × 20     | Pájaro (bosque): 4 cuadros de 24×20 (posado, picoteando, alas arriba, alas abajo) |
| `critters/parrot.png`                | 96 × 20     | Loro (selva), mismos 4 cuadros |
| `critters/crow.png`                  | 96 × 20     | Cuervo (Tierras Sombrías) |
| `critters/snowbird.png`              | 96 × 20     | Pájaro de las nieves (tundra) |
| `critters/gull.png`                  | 96 × 20     | Gaviota (islas flotantes) |
| `critters/bunny.png`                 | 84 × 24     | Conejo: 3 cuadros de 28×24 (sentado, agachado, saltando) |
| `critters/frog.png`                  | 48 × 20     | Rana (selva): 2 cuadros de 24×20 (sentada, saltando) |
| `critters/penguin.png`               | 40 × 24     | Pingüino (tundra): 2 cuadros de 20×24 |
| `critters/lizard.png`                | 64 × 16     | Lagartija (desierto, volcán): 2 cuadros de 32×16 |
| `critters/mouse.png`                 | 48 × 16     | Ratón (cuevas): 2 cuadros de 24×16 |
| `critters/snail.png`                 | 48 × 18     | Caracol brillante (cuevas de hongos): 2 cuadros de 24×18 |
| `critters/butterfly.png`             | 32 × 16     | Mariposa: 2 cuadros de 16×16 (alas abiertas y cerradas) |
| `critters/crystalfly.png`            | 32 × 16     | Mariposa de cristal (brilla) |
| `critters/emberfly.png`              | 32 × 16     | Polilla de brasa (volcán, inframundo; brilla) |
| `critters/vulture.png`               | 88 × 20     | Buitre (desierto): 2 cuadros de 44×20 |
| `bosses/slime_king.png`              | 288 × 72    | Rey Slime: 3 cuadros de 96×72 (quieto, aplastado, en el aire) |
| `bosses/scorpion_king.png`           | 240 × 56    | Escorpión Rey: 2 cuadros de 120×56 (caminando, disparando) |
| `bosses/queen_wasp.png`              | 192 × 80    | Reina Avispa: 2 cuadros de 96×80 (aleteo) |
| `bosses/shadow_eye.png`              | 192 × 96    | Ojo Sombrío: 2 cuadros de 96×96 (ojo; boca en la 2.ª fase) |
| `bosses/crystal_golem.png`           | 224 × 128   | Golem de Cristal: 2 cuadros de 112×128 (de pie, brazos arriba) |
| `bosses/flame_lord.png`              | 240 × 120   | Señor de las Llamas: 2 cuadros de 120×120 |
| `bosses/projectiles.png`             | 64 × 16     | Proyectiles de los jefes: 4 cuadros de 16×16 (aguijón, orbe sombrío, astilla de cristal, bola de fuego) |
| `npcs/guide.png`                     | 288 × 64    | Guía: **6 cuadros de 48×64** (quieto, caminar ×4, hablando), mirando a la derecha |
| `npcs/merchant.png`                  | 288 × 64    | Comerciante (igual que el Guía) |
| `npcs/nurse.png`                     | 288 × 64    | Enfermera (igual que el Guía) |
| `player/player.png`                  | 384 × 256   | Jugador: **31 poses de 48×64**, 8 por fila, mirando a la derecha (los pies tocan el borde de abajo). Orden: quieto, respirar, parpadear, caminar ×8, saltar, caer, agitar brazos, aterrizar, golpe ×3 (levantar, bajar, impacto), usar, daño, festejo, empujar, mirar atrás, bostezo, cansado ×2, sentado/dormido ×2, saludo ×2, sentado en una silla (ver `src/player/animations.js`) |
| `backgrounds/mountains.png`          | 960 × 320   | Montañas lejanas (se repite en horizontal: los bordes izquierdo y derecho deben empalmar) |
| `backgrounds/hills.png`              | 960 × 240   | Colinas intermedias (repetible en horizontal)                               |
| `backgrounds/forest.png`             | 960 × 240   | Bosque cercano (repetible en horizontal)                                    |
| `backgrounds/mountains_desert.png`   | 960 × 320   | Montañas lejanas de: Desierto (repetible) |
| `backgrounds/hills_desert.png`       | 960 × 240   | Colinas de: Desierto (repetible) |
| `backgrounds/forest_desert.png`      | 960 × 240   | Capa cercana de: Desierto (repetible) |
| `backgrounds/mountains_snow.png`     | 960 × 320   | Montañas lejanas de: Tundra (repetible) |
| `backgrounds/hills_snow.png`         | 960 × 240   | Colinas de: Tundra (repetible) |
| `backgrounds/forest_snow.png`        | 960 × 240   | Capa cercana de: Tundra (repetible) |
| `backgrounds/mountains_jungle.png`   | 960 × 320   | Montañas lejanas de: Selva (repetible) |
| `backgrounds/hills_jungle.png`       | 960 × 240   | Colinas de: Selva (repetible) |
| `backgrounds/forest_jungle.png`      | 960 × 240   | Capa cercana de: Selva (repetible) |
| `backgrounds/mountains_shadow.png`   | 960 × 320   | Montañas lejanas de: Tierras Sombrías (repetible) |
| `backgrounds/hills_shadow.png`       | 960 × 240   | Colinas de: Tierras Sombrías (repetible) |
| `backgrounds/forest_shadow.png`      | 960 × 240   | Capa cercana de: Tierras Sombrías (repetible) |
| `backgrounds/mountains_crystal.png`  | 960 × 320   | Montañas lejanas de: Tierras de Cristal (repetible) |
| `backgrounds/hills_crystal.png`      | 960 × 240   | Colinas de: Tierras de Cristal (repetible) |
| `backgrounds/forest_crystal.png`     | 960 × 240   | Capa cercana de: Tierras de Cristal (repetible) |
| `backgrounds/mountains_volcano.png`  | 960 × 320   | Montañas lejanas de: Volcán (repetible) |
| `backgrounds/hills_volcano.png`      | 960 × 240   | Colinas de: Volcán (repetible) |
| `backgrounds/forest_volcano.png`     | 960 × 240   | Capa cercana de: Volcán (repetible) |
| `backgrounds/cloud.png`              | 128 × 48    | Nube                                                                        |
| `backgrounds/sun.png`                | 64 × 64     | Sol                                                                         |
| `backgrounds/moon.png`               | 48 × 48     | Luna                                                                        |
| `backgrounds/stars.png`              | 256 × 256   | Estrellas sobre fondo transparente (repetible)                              |
| `fx/glow.png`                        | 128 × 128   | Brillo de las antorchas (degradado radial sobre fondo transparente)         |
| `fx/fireball.png`                    | 32 × 32     | Bola de fuego (se dibuja con brillo aditivo) |
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
| `ui/trash.png`                       | 32 × 32     | Tacho de la casilla Basura del inventario |
| `ui/button_potion.png`               | 64 × 64     | Botón táctil de curación rápida |
| `ui/button_dash.png`                 | 64 × 64     | Botón táctil de la Embestida |
| `ui/button_fire.png`                 | 64 × 64     | Botón táctil de la Bola de fuego |
| `ui/button_inventory.png`            | 64 × 64     | Botón táctil de inventario                                                  |
| `ui/button_fullscreen.png`           | 48 × 48     | Botón táctil de pantalla completa                                           |
| `ui/map_player.png`                  | 32 × 32     | Tu cabeza en el mapa |
| `ui/map_home.png`                    | 32 × 32     | Tu casa (cama o inicio) en el mapa y en la flecha |
| `ui/map_pin.png`                     | 32 × 32     | Marcador del mapa |
| `ui/map_guide.png`                   | 32 × 32     | Guía en el mapa |
| `ui/map_merchant.png`                | 32 × 32     | Comerciante en el mapa |
| `ui/map_nurse.png`                   | 32 × 32     | Enfermera en el mapa |
| `ui/map_boss.png`                    | 32 × 32     | Guarida de un jefe en el mapa (calavera) |

Las hojas de sprites (`player.png`, `tree_top.png`, `crack.png`) también aceptan un solo cuadro: si el jugador tiene
un único cuadro de 48×64, se usa sin animación. El pico y la antorcha se dibujan en la mano de adelante según la
posición de la mano en cada pose de `src/player/animations.js` (si dibujas tus propias poses, respeta esas posiciones
o ajústalas ahí). Con el dibujo por código, la armadura puesta cambia los colores del pelo (casco), la camisa
(pechera) y el pantalón y las botas (grebas); con una imagen propia del jugador, la armadura no se dibuja.

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
  player/              Jugador: física, colisiones, vida y daño por caída (Player), poses (animations), combos de las armas (attacks) y animaciones y efectos (PlayerAnimator)
  systems/             Sonido y música (Audio), inventario, ítems, crafteo, minar/colocar, muebles (Furniture), casas y fachadas (Housing), experiencia y habilidades (Skills, Abilities), aldeanos (Npcs), enemigos, zonas (Zones) y sus partículas (Ambience), neblina de las islas (IslandMist), mapa explorado (WorldMap), fauna (Critters), jefes y guaridas (Bosses), día/noche, iluminación, guardado y placeholders (pixel art por código)
  ui/                  HUD, barra rápida, inventario, mapa y minimapa (MapPanel), controles táctiles, debug y avisos
```

## Notas de rendimiento

- Cada chunk visible es un Tilemap de Phaser (un solo lote de dibujo por capa); los chunks de puro cielo no crean nada.
- La iluminación usa 1 píxel por bloque en un canvas diminuto, estirado con filtrado suave y multiplicado sobre la escena: una sola imagen para toda la pantalla.
- Los bordes de los bloques se generan una vez al iniciar (tileset de 16 combinaciones × 3 variantes); en juego no cuestan nada.
- En celulares la cámara se aleja un poco (zoom 0,6–1) para mostrar más mundo en pantallas pequeñas.
- `window.__game` da acceso al juego desde la consola del navegador para depurar.
