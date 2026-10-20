import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Lista (recursivamente) las imágenes que existen dentro de una carpeta.
function listImages(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listImages(full, base));
    else if (/\.(png|jpe?g|webp|gif)$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out;
}

// Plugin: expone 'virtual:asset-manifest' con la lista de imágenes presentes en /public/assets.
// Así el juego solo pide las imágenes que existen (sin errores 404) y usa placeholders para el resto.
// En desarrollo, al agregar/quitar/cambiar una imagen la página se recarga sola.
function assetManifest() {
  const VIRTUAL_ID = 'virtual:asset-manifest';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  let assetsDir = '';

  return {
    name: 'terra2d-asset-manifest',
    configResolved(config) {
      assetsDir = path.resolve(config.publicDir, 'assets');
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      return `export default ${JSON.stringify(listImages(assetsDir))};`;
    },
    configureServer(server) {
      const onAssetChange = (file) => {
        if (!path.resolve(file).startsWith(assetsDir)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(assetsDir);
      server.watcher.on('add', onAssetChange);
      server.watcher.on('unlink', onAssetChange);
      server.watcher.on('change', onAssetChange);
    },
  };
}

export default defineConfig({
  // Rutas relativas: el build funciona aunque se publique en una subcarpeta
  base: './',
  plugins: [assetManifest()],
  build: {
    // El JS compilado va a dist/bundle/ para no mezclarse con dist/assets/ (las imágenes)
    assetsDir: 'bundle',
    // Phaser ocupa ~1.2 MB; evitamos el aviso de tamaño de chunk
    chunkSizeWarningLimit: 2000,
  },
});
