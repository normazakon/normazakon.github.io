/* Тексты статей лежат по файлу на закон и подгружаются только когда нужны.
   Подключение через <script> работает и при открытии index.html с диска. */
(function () {
  "use strict";

  const pending = new Map();

  function texts() {
    window.LAW_TEXTS = window.LAW_TEXTS || {};
    return window.LAW_TEXTS;
  }

  function isLoaded(lawId) {
    return Boolean(texts()[lawId]);
  }

  function load(lawId) {
    if (isLoaded(lawId)) return Promise.resolve(texts()[lawId]);
    if (pending.has(lawId)) return pending.get(lawId);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `data/texts/${encodeURIComponent(lawId)}.js`;
      script.onload = () => (isLoaded(lawId) ? resolve(texts()[lawId]) : reject(new Error("Файл текстов пуст")));
      script.onerror = () => {
        pending.delete(lawId);
        reject(new Error("Не удалось загрузить тексты"));
      };
      document.head.append(script);
    });
    pending.set(lawId, promise);
    return promise;
  }

  /** Абзацы статьи, если тексты закона уже загружены, иначе null. */
  function get(lawId, number) {
    return (isLoaded(lawId) && texts()[lawId][number]) || null;
  }

  window.LawTexts = { load, get, isLoaded };
})();
