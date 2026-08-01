/**
 * Persistencia de registros capturados — IndexedDB (no localStorage: las
 * fotos van en base64 dentro del registro y pueden pesar varios MB por
 * auditoría; localStorage tiene ~5-10MB de cupo total y fallaría en
 * silencio o con excepción antes de acumular una jornada completa).
 *
 * Cada registro se escribe apenas se agrega (no solo al exportar), para que
 * un cierre de pestaña, un crash del navegador o quedarse sin batería no
 * borre auditorías que el operador todavía no descargó. Se borra de aquí
 * solo cuando el operador elimina el registro a mano o limpia el log —
 * nunca automáticamente al exportar (igual que el comportamiento en
 * memoria de siempre).
 */
class RecordStore {
  static DB_NAME = 'auditorias_svc_db';
  static DB_VERSION = 1;
  static STORE = 'records';
  static _dbPromise = null;

  static open() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          const store = db.createObjectStore(this.STORE, { keyPath: 'uid' });
          store.createIndex('formId', 'formId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._dbPromise;
  }

  static genUid(formId) {
    return `${formId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  static async put(uid, formId, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).put({ uid, formId, data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async delete(uid) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      tx.objectStore(this.STORE).delete(uid);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async clearForm(formId) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readwrite');
      const idx = tx.objectStore(this.STORE).index('formId');
      const cursorReq = idx.openCursor(IDBKeyRange.only(formId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Reconstruye { [formId]: record[] } completo. El orden dentro de cada
   * arreglo sigue el orden de inserción del uid (contiene el timestamp).
   */
  static async loadAll() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).getAll();
      req.onsuccess = () => {
        const grouped = {};
        (req.result || [])
          .sort((a, b) => (a.uid < b.uid ? -1 : 1))
          .forEach((row) => {
            if (!grouped[row.formId]) grouped[row.formId] = [];
            grouped[row.formId].push(row.data);
          });
        resolve(grouped);
      };
      req.onerror = () => reject(req.error);
    });
  }
}
