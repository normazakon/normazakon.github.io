/* Настройки интерфейса из личного кабинета. Хранятся в этом браузере.
   Подключается в браузере как window.Settings и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Settings = api;
})(globalThis, function () {
  "use strict";

  const KEY = "norma.settings.v1";
  // до настроек подсветка правок запоминалась отдельно, в окне статьи
  const LEGACY_CHANGES_KEY = "norma.showChanges";

  const DOC_SCALES = [
    { value: "normal", label: "Обычный", scale: 1 },
    { value: "large", label: "Крупный", scale: 1.125 },
    { value: "xlarge", label: "Очень крупный", scale: 1.25 },
  ];

  const DEFAULTS = { docScale: "normal", showChanges: true, homeWatch: true, homeChanges: true };

  function clean(data, fallback = DEFAULTS) {
    const source = data && typeof data === "object" ? data : {};
    const flag = (key) => (typeof source[key] === "boolean" ? source[key] : fallback[key]);
    return {
      docScale: DOC_SCALES.some((item) => item.value === source.docScale) ? source.docScale : fallback.docScale,
      showChanges: flag("showChanges"),
      homeWatch: flag("homeWatch"),
      homeChanges: flag("homeChanges"),
    };
  }

  /** Множитель размера шрифта документа: 1, 1.125 или 1.25. */
  function scaleOf(value) {
    const found = DOC_SCALES.find((item) => item.value === value);
    return found ? found.scale : 1;
  }

  /** backend: объект с getItem и setItem, как localStorage. Ошибки хранилища не мешают работе. */
  function createSettings(backend) {
    function read() {
      let legacy = {};
      try {
        if (backend.getItem(LEGACY_CHANGES_KEY) === "off") legacy = { showChanges: false };
      } catch { /* хранилище недоступно */ }
      try {
        return clean(JSON.parse(backend.getItem(KEY) || "null") || legacy);
      } catch {
        return clean(legacy);
      }
    }

    /** Меняет одно или несколько полей. Отдаёт true, если сохранилось. */
    function update(fields) {
      try {
        backend.setItem(KEY, JSON.stringify(clean({ ...read(), ...fields })));
        return true;
      } catch {
        return false;
      }
    }

    return { read, update };
  }

  return { createSettings, scaleOf, DOC_SCALES, DEFAULTS, KEY };
});
