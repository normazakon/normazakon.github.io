/* Подгрузка шаблонов по требованию. При открытии приложения загружается только индекс (data/templates-index.js):
   его хватает каталогу, поиску и главной. Сам шаблон — поля, текст, проверки — лежит в файле data/templates/<файл>.js
   и загружается, когда его открывают в редакторе. Общие блоки (common.js), судебные помощники (court.js) и связи
   между шаблонами (links.js) загружаются один раз перед первым шаблоном. Сервис-воркер хранит все файлы шаблонов,
   поэтому без сети шаблоны тоже открываются. */
(function (root) {
  "use strict";

  const BASE = ["common", "court", "links"];
  const scripts = new Map();

  function script(name) {
    if (!scripts.has(name)) {
      scripts.set(name, new Promise((resolve, reject) => {
        const element = document.createElement("script");
        element.src = `data/templates/${name}.js`;
        element.onload = resolve;
        element.onerror = () => {
          scripts.delete(name);
          element.remove();
          reject(new Error(`Не удалось загрузить шаблоны: ${name}`));
        };
        document.head.append(element);
      }));
    }
    return scripts.get(name);
  }

  const entryOf = (id) => (root.TEMPLATE_INDEX || []).find((item) => item.id === id) || null;
  const loadedOf = (id) => (root.TEMPLATES || []).find((item) => item.id === id) || null;

  /** Полный шаблон по id или null, если такого нет в индексе. */
  async function load(id) {
    const entry = entryOf(id);
    if (!entry) return null;
    const ready = loadedOf(id);
    if (ready) return ready;
    // общие файлы — строго по порядку: common.js создает TemplateKit, остальные им пользуются
    for (const name of BASE) await script(name);
    if (!BASE.includes(entry.file)) await script(entry.file);
    return loadedOf(id);
  }

  /** Несколько шаблонов сразу; отсутствующие пропускаются. */
  async function loadMany(ids) {
    const templates = await Promise.all([...new Set(ids)].map(load));
    return new Map(templates.filter(Boolean).map((template) => [template.id, template]));
  }

  root.TemplateLoader = { load, loadMany, entry: entryOf };
})(typeof window !== "undefined" ? window : globalThis);
