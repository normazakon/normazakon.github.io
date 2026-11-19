/* Официальные бланки: формы ведомств со ссылкой на официальный источник и утвердившим приказом. */
(function () {
  "use strict";

  const { h } = window.UI;

  /** «Приказ ФНС России от 31.08.2020 № ЕД-7-14/617@» */
  function actText(act) {
    return `${act.kind} от ${window.Editions.formatDate(act.date)} № ${act.number}`;
  }

  /** Переключатель «Конструкторы | Официальные бланки» в шапке раздела «Шаблоны». */
  function templatesSwitch(active) {
    const item = (key, label, hash) => h("button", {
      type: "button", "aria-pressed": String(active === key),
      onClick: () => { if (active !== key) location.hash = hash; },
    }, label);
    return h("div", { class: "segmented templates-switch", role: "group", "aria-label": "Что показать" },
      item("templates", "Конструкторы", "#templates"), item("forms", "Официальные бланки", "#forms"));
  }
  window.UI.templatesSwitch = templatesSwitch;

  function formCard(form, highlighted) {
    return h("li", { id: `form-${form.id}`, class: highlighted ? "form-card highlighted" : "form-card" },
      h("div", { class: "form-card-head" },
        h("span", { class: "badge form-agency" }, form.agency),
        form.code && h("span", { class: "form-code" }, form.code)),
      h("h2", { class: "form-title" }, form.title),
      form.note && h("p", { class: "form-note" }, form.note),
      h("p", { class: "form-act" }, "Утверждена: ", actText(form.act)),
      form.changes.length > 0 && h("p", { class: "form-changes" }, `Изменения: ${form.changes.join("; ")}.`),
      h("a", { class: "button small form-link", href: form.url, target: "_blank", rel: "noopener noreferrer" },
        window.UI.icon("external"),
        form.source === "pravo.gov.ru" ? "Приказ с формой на pravo.gov.ru" : "Форма на сайте ФНС"),
      h("p", { class: "form-checked" }, `Сверено с источником ${window.Editions.formatDate(form.checked)}`));
  }

  window.Views = window.Views || {};
  window.Views.forms = function (root, params = {}) {
    const forms = window.OFFICIAL_FORMS;
    const state = { category: null };
    const categories = [...new Set(forms.map((form) => form.category))];
    const results = h("ul", { class: "forms-list" });
    const found = h("p", { class: "catalog-found", "aria-live": "polite" });
    const categoryRow = h("div", { class: "chips catalog-filter", role: "group", "aria-label": "Разделы бланков" });
    const search = h("input", {
      class: "search", type: "search", id: "form-search", placeholder: "Найти бланк: название, код формы, ведомство", "aria-label": "Найти бланк",
      onInput: () => update(),
    });

    const chip = (label, active, count, onClick) => h("button", {
      class: "chip", type: "button", "aria-pressed": String(active), onClick,
    }, label, h("span", { class: "chip-count" }, String(count)));

    function update() {
      const byQuery = window.SiteSearch.rankForms(forms, search.value, window.TextSearch.stem);
      const matches = byQuery.filter((form) => !state.category || form.category === state.category);
      results.replaceChildren(...matches.map((form) => formCard(form, form.id === params.formId)));
      found.textContent = search.value.trim() || state.category ? `Найдено ${matches.length} из ${forms.length}` : "";
      if (!matches.length) results.replaceChildren(h("li", { class: "empty" }, "Такого бланка пока нет. Попробуйте другое слово или раздел."));
      categoryRow.replaceChildren(
        chip("Все", !state.category, byQuery.length, () => { state.category = null; update(); }),
        ...categories.map((name) => chip(name, state.category === name, byQuery.filter((form) => form.category === name).length,
          () => { state.category = name; update(); })));
    }

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Официальные бланки"),
          h("p", {}, "Формы, утверждённые приказами ведомств. У каждой указан приказ и его изменения, ссылка ведёт на официальный источник. Текст форм мы не меняем и у себя не храним.")),
        templatesSwitch("forms")),
      h("div", { class: "forms-tools" }, search, categoryRow),
      found,
      results);
    update();
    if (params.formId) document.getElementById(`form-${params.formId}`)?.scrollIntoView({ block: "center" });
  };
})();
