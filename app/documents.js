/* Сохранённые черновики. */
(function () {
  "use strict";

  const { h, shortDateTime } = window.UI;
  const Engine = window.TemplateEngine;

  function describe(document) {
    const template = window.TEMPLATES.find((item) => item.id === document.templateId);
    if (!template) return "Шаблон больше не доступен";
    const { progress } = Engine.render(template, Engine.withDefaults(template, document.values));
    return `Заполнено ${progress.filled} из ${progress.total}, изменён ${shortDateTime(document.updatedAt)}`;
  }

  window.Views = window.Views || {};
  window.Views.documents = function (root, _params, app) {
    const list = h("div", {});

    function row(document) {
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
          h("div", { class: "document-meta" }, describe(document))),
        actions);
    }

    function render() {
      const documents = app.store.list();
      if (!documents.length) {
        list.replaceChildren(h("div", { class: "empty-state" },
          h("span", { class: "empty-state-mark", "aria-hidden": "true" }, "§"),
          h("h2", {}, "Документов пока нет"),
          h("p", {}, "Выберите шаблон и начните заполнять: черновик сохранится здесь сам, и к нему можно вернуться в любой момент."),
          h("a", { class: "button primary", href: "#templates" }, "Выбрать шаблон")));
        return;
      }
      list.replaceChildren(h("ul", { class: "documents" }, documents.map(row)));
    }

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Мои документы"),
          h("p", {}, "Черновики сохраняются автоматически и только в этом браузере. На другом устройстве их не будет."))),
      list);
    render();
  };
})();
