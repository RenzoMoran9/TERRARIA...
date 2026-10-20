import Phaser from 'phaser';
// Fuente pixel art (incluida en el proyecto: funciona sin internet)
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-700.css';
import { BootScene } from './scenes/BootScene.js';
import { BackgroundScene } from './scenes/BackgroundScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';

// Configuración principal de Phaser
const config = {
  type: Phaser.AUTO, // WebGL si está disponible, si no Canvas
  parent: 'game',
  backgroundColor: '#000000',
  pixelArt: true, // sin suavizado: estilo pixel art y mejor rendimiento
  roundPixels: true,
  disableContextMenu: true, // el clic derecho se usa para colocar bloques
  scale: {
    mode: Phaser.Scale.RESIZE, // el canvas ocupa toda la ventana (PC y celular)
    width: '100%',
    height: '100%',
  },
  input: {
    activePointers: 4, // multitáctil: joystick + salto + tocar bloques a la vez
  },
  render: {
    antialias: false,
    powerPreference: 'high-performance',
  },
  fps: { target: 60 },
  audio: { noAudio: true }, // la Fase 1 no tiene sonido
  // El orden importa: el fondo se dibuja primero (debajo), la interfaz al final (encima)
  scene: [BootScene, BackgroundScene, MenuScene, GameScene, UIScene],
};

const game = new Phaser.Game(config);

// Phaser a veces no se entera del nuevo tamaño al girar el celular o al entrar/salir de
// pantalla completa (el tamaño cambia en medio de su actualización). Cada 400 ms
// comprobamos que el canvas mida lo mismo que su contenedor y, si no, lo forzamos.
const container = document.getElementById('game');
setInterval(() => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w > 0 && h > 0 && (Math.abs(w - game.scale.width) > 1 || Math.abs(h - game.scale.height) > 1)) {
    game.scale.getParentBounds();
    game.scale.refresh();
  }
}, 400);

// --- App instalable (PWA) ---
// El service worker solo se registra en la versión publicada (no en `npm run dev`)
// y nunca dentro de otra página (por ejemplo, la vista previa de claude.ai).
const standalonePage = window.self === window.top;
if (import.meta.env.PROD && standalonePage && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[pwa] No se pudo registrar:', e));
  });
}
// Android/Chrome avisa cuando el juego se puede instalar: guardamos el aviso para el botón del menú
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__installPrompt = event;
  game.events.emit('installAvailable');
});

// Acceso desde la consola del navegador para depurar
window.__game = game;
