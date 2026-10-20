import { SAVE_KEY, SAVE_VERSION } from '../config.js';

/**
 * Guardado en localStorage.
 * Se guarda: semilla, chunks modificados (comprimidos), inventario, posición, vida, hora y día.
 * Los chunks no modificados no se guardan: se regeneran con la semilla.
 */
export const SaveSystem = {
  hasSave() {
    return this.load() !== null;
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.version !== SAVE_VERSION || typeof data.seed !== 'number') return null;
      return data;
    } catch (e) {
      console.warn('[guardado] No se pudo leer la partida:', e);
      return null;
    }
  },

  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('[guardado] No se pudo guardar la partida:', e);
      return false;
    }
  },

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      // localStorage no disponible: no hay nada que borrar
    }
  },
};
