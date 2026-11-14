/* Черновики документов в браузере пользователя.
   Хранилище может быть недоступно (приватный режим), поэтому все ошибки перехватываются. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Storage2 = api;
})(globalThis, function () {
  "use strict";

  const KEY = "norma.documents.v1";

  function createStore(backend) {
    let available = true;

    function readAll() {
      try {
        const parsed = JSON.parse(backend.getItem(KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        available = false;
        return [];
      }
    }

    function writeAll(documents) {
      try {
        backend.setItem(KEY, JSON.stringify(documents));
        available = true;
        return true;
      } catch {
        available = false;
        return false;
      }
    }

    return {
      isAvailable: () => available,
      list: () => readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      get: (id) => readAll().find((document) => document.id === id) || null,
      save(document) {
        const others = readAll().filter((item) => item.id !== document.id);
        return writeAll([...others, { ...document, updatedAt: new Date().toISOString() }]);
      },
      remove(id) {
        return writeAll(readAll().filter((document) => document.id !== id));
      },
    };
  }

  function browserBackend() {
    try {
      return globalThis.localStorage;
    } catch {
      return { getItem: () => { throw new Error("недоступно"); }, setItem: () => { throw new Error("недоступно"); } };
    }
  }

  return { createStore, browserBackend };
});
