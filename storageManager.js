/**
 * storageManager.js — Persistencia en localStorage
 *
 * Maneja el guardado y recuperación de:
 * - IDs de salas (room)
 * - Preferencia de tema (oscuro/claro)
 * - Obtención del ID de sala desde la URL (?room=ID)
 */

const STORAGE_KEYS = {
  ROOMS: 'p2pchat_rooms',
  THEME: 'p2pchat_theme',
};

export const StorageManager = {
  // ---- Salas ----

  /**
   * Obtiene la lista de IDs de salas guardadas.
   * @returns {string[]}
   */
  getRooms() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ROOMS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Guarda un ID de sala (evita duplicados).
   * @param {string} roomId
   */
  saveRoom(roomId) {
    const rooms = this.getRooms();
    if (!rooms.includes(roomId)) {
      rooms.unshift(roomId);
      localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    }
  },

  /**
   * Elimina un ID de sala.
   * @param {string} roomId
   */
  removeRoom(roomId) {
    const rooms = this.getRooms().filter((id) => id !== roomId);
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
  },

  // ---- Tema ----

  /**
   * @returns {'dark' | 'light'}
   */
  getTheme() {
    return localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
  },

  /**
   * @param {'dark' | 'light'} mode
   */
  saveTheme(mode) {
    localStorage.setItem(STORAGE_KEYS.THEME, mode);
  },

  // ---- URL ----

  /**
   * Extrae el parámetro ?room=ID de la URL actual.
   * @returns {string|null}
   */
  getRoomFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('room');
  },
};
