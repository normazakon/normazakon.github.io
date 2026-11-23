/* Сохранённые черновики. */
(function () {
  "use strict";

  const { h, shortDateTime } = window.UI;
  const Engine = window.TemplateEngine;

  /** Подпись черновика. Шаблоны подгружаются по требованию: пока шаблон не загружен, показываем только дату. */
  function describe(document, templates) {
    if (!window.TemplateLoader.entry(document.templateId)) return "Шаблон больше не доступен";
    const template = templates && templates.get(document.templateId);
    const changed = `изменён ${shortDateTime(document.updatedAt)}`;
    if (!template) return changed[0].toUpperCase() + changed.slice(1);
    const { progress } = Engine.render(template, Engine.withDefaults(template, document.values));
    return `Заполнено ${progress.filled} из ${progress.total}, ${changed}`;
  }

  /** Строка избранного или недавнего: статья открывается в окне, шаблон по ссылке. Отдаёт null, если записи больше нет. */
  function bookmarkItem(item) {
    if (item.kind === "article") {
      const law = window.LAW_BASE.laws[item.lawId];
      const article = law && law.articles[item.number];
      if (!article) return null;
      return h("li", {}, h("button", { class: "bookmark", type: "button", onClick: () => window.UI.showArticle(item.lawId, item.number) },
        h("span", { class: "bookmark-kind" }, window.UI.articleName(item.lawId, item.number)),
        h("span", { class: "bookmark-title" }, article.title)));
    }
    const template = window.TemplateLoader.entry(item.templateId);
    if (!template) return null;
    return h("li", {}, h("a", { class: "bookmark", href: `#template/${template.id}` },
      h("span", { class: "bookmark-kind" }, "Шаблон"),
      h("span", { class: "bookmark-title" }, template.title)));
  }

  /** Блок «Избранное» или «Недавно открытые»; пустой блок не показываем. */
  function bookmarkSection(title, items, action) {
    const rows = items.map(bookmarkItem).filter(Boolean);
    if (!rows.length) return null;
    return h("section", { class: "bookmarks" },
      h("div", { class: "bookmarks-head" }, h("h2", {}, title), action),
      h("ul", { class: "bookmark-list" }, rows));
  }

  window.Views = window.Views || {};
  window.Views.documents = function (root, _params, app) {
    const list = h("div", {});
    const saved = h("div", {});
    const { bookmarks } = window.UI;

    function renderBookmarks() {
      saved.replaceChildren(...[
        bookmarkSection("Избранное", bookmarks.favorites()),
        bookmarkSection("Недавно открытые", bookmarks.recent(),
          h("button", { class: "link-button", type: "button", onClick: () => { bookmarks.clearRecent(); renderBookmarks(); } }, "Очистить")),
      ].filter(Boolean));
    }
    // окно статьи может добавить или убрать звёздочку, поэтому после его закрытия обновляем блоки
    const dialog = document.getElementById("article-dialog");
    const onClose = () => (saved.isConnected ? renderBookmarks() : dialog.removeEventListener("close", onClose));
    dialog.addEventListener("close", onClose);

    function row(document, templates) {
      const actions = h("div", { class: "document-actions" });

      function showActions() {
        actions.replaceChildren(
          h("a", { class: "button", href: `#document/${document.id}` }, "Открыть"),
          h("button", { class: "button quiet", type: "button", onClick: askToDelete }, "Удалить"));
      }

      function askToDelete() {
        actions.replaceChildren(
          h("button", { class: "button danger", type: "button", onClick: () => { app.store.remove(document.id); render(); } }, "Удалить навсегда"),
          h("button", { class: "button quiet", type: "button", onClick: showActions }, "Отмена"));
      }

      showActions();
      return h("li", { class: "document-row" },
        h("div", {},
          h("div", { class: "document-title" }, document.title),
          h("div", { class: "document-meta" }, describe(document, templates))),
        actions);
    }

    function render() {
      const documents = app.store.list();
      if (!documents.length && (bookmarks.favorites().length || bookmarks.recent().length)) {
        // избранное уже есть, поэтому большой пустой экран не нужен
        list.replaceChildren(h("p", { class: "empty" }, "Черновиков пока нет. ", h("a", { href: "#templates" }, "Выбрать шаблон")));
        return;
      }
      if (!documents.length) {
        list.replaceChildren(h("div", { class: "empty-state" },
          h("span", { class: "empty-state-mark", "aria-hidden": "true" }, "§"),
          h("h2", {}, "Документов пока нет"),
          h("p", {}, "Выберите шаблон и начните заполнять: черновик сохранится здесь сам, и к нему можно вернуться в любой момент."),
          h("a", { class: "button primary", href: "#templates" }, "Выбрать шаблон")));
        return;
      }
      const draw = (templates) => list.replaceChildren(h("ul", { class: "documents" }, documents.map((document) => row(document, templates))));
      draw(null);
      window.TemplateLoader.loadMany(documents.map((document) => document.templateId))
        .then((templates) => { if (list.isConnected) draw(templates); })
        .catch(() => {});
    }

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Мои документы"),
          h("p", {}, "Черновики, избранное и недавно открытое сохраняются автоматически и только в этом браузере. На другом устройстве их не будет."))),
      list,
      saved);
    render();
    renderBookmarks();
  };
})();
