/* Избранное и недавно открытые статьи и шаблоны. Хранятся только в этом браузере, как черновики.
   Подключается в браузере как window.Bookmarks и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Bookmarks = api;
})(globalThis, function () {
  "use strict";

  const KEY = "norma.bookmarks.v1";
  const RECENT_LIMIT = 12;

  /** Ключ записи: статья «article:GK:395», шаблон «template:services». */
  function keyOf(item) {
    return item.kind === "article" ? `article:${item.lawId}:${item.number}` : `template:${item.templateId}`;
  }

  function clean(item) {
    return item.kind === "article"
      ? { kind: "article", lawId: item.lawId, number: item.number }
      : { kind: "template", templateId: item.templateId };
  }

  /** backend: объект с getItem и setItem, как localStorage. Ошибки хранилища не мешают работе. */
  function createBookmarks(backend) {
    function read() {
      try {
        const parsed = JSON.parse(backend.getItem(KEY) || "{}");
        return {
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          recent: Array.isArray(parsed.recent) ? parsed.recent : [],
        };
      } catch {
        return { favorites: [], recent: [] };
      }
    }

    function write(data) {
      try {
        backend.setItem(KEY, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }

    return {
      favorites: () => read().favorites,
      recent: () => read().recent,
      isFavorite: (item) => read().favorites.some((entry) => keyOf(entry) === keyOf(item)),
      /** Добавляет в избранное или убирает оттуда. Отдаёт новое состояние: true, если теперь в избранном. */
      toggleFavorite(item) {
        const data = read();
        const key = keyOf(item);
        const present = data.favorites.some((entry) => keyOf(entry) === key);
        data.favorites = present
          ? data.favorites.filter((entry) => keyOf(entry) !== key)
          : [{ ...clean(item), at: new Date().toISOString() }, ...data.favorites];
        write(data);
        return !present;
      },
      /** Запоминает открытие: запись поднимается наверх, старые за пределами лимита забываются. */
      touch(item) {
        const data = read();
        const key = keyOf(item);
        data.recent = [{ ...clean(item), at: new Date().toISOString() }, ...data.recent.filter((entry) => keyOf(entry) !== key)].slice(0, RECENT_LIMIT);
        write(data);
      },
      clearRecent() {
        const data = read();
        data.recent = [];
        write(data);
      },
    };
  }

  return { createBookmarks, keyOf, RECENT_LIMIT };
});
