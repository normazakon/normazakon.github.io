/* Поиск по всему: статья по номеру, статьи по заголовку, шаблоны, официальные бланки и расчёты в одном списке.
   Один и тот же поиск стоит на главной и в окне поиска из шапки (Ctrl+K). */
(function () {
  "use strict";

  const { h, icon } = window.UI;

  /**
   * Строка поиска со списком результатов. Enter открывает первый результат, Esc закрывает список.
   * id — для поля и списка; onPick вызывается при выборе результата (окно поиска в шапке закрывается).
   */
  function create({ id, onPick, autofocus } = {}) {
    const input = h("input", {
      class: "hero-search-input", type: "search", id, autocomplete: "off",
      placeholder: "Например: 395 ГК или претензия продавцу", "aria-label": "Найти статью, шаблон или расчёт",
      "aria-controls": `${id}-results`,
    });
    const list = h("div", { class: "search-results", id: `${id}-results`, hidden: true, role: "listbox" });
    let timer = null;

    const close = () => { list.hidden = true; };
    const group = (title, items) => items.length ? [h("p", { class: "search-group" }, title), ...items] : [];
    const row = (props, iconName, tone, main, sub) => h(props.href ? "a" : "button", {
      class: `search-item tone-${tone}`, type: props.href ? undefined : "button", role: "option", ...props,
      onClick: (event) => { if (onPick) onPick(); if (props.onClick) props.onClick(event); },
    }, h("span", { class: "tone-plate small" }, icon(iconName)), h("span", { class: "search-item-text" }, h("strong", {}, main), sub && h("span", {}, sub)));

    function render() {
      const query = input.value.trim();
      if (query.length < 2) { close(); return; }
      const found = window.SiteSearch.search(query, { base: window.LAW_BASE, templates: window.TEMPLATE_INDEX, forms: window.OFFICIAL_FORMS, stem: window.TextSearch.stem });
      const items = [
        ...group("Статьи", found.articles.map((article) => row(
          { onClick: () => { close(); window.UI.showArticle(article.lawId, article.number); } },
          "book", "teal", window.UI.articleName(article.lawId, article.number), article.title))),
        ...group("Шаблоны", found.templates.map((template) => row({ href: `#template/${template.id}` }, "contract", "blue", template.title, template.summary))),
        ...group("Официальные бланки", found.forms.map((form) => row({ href: `#forms/${form.id}` }, "stamp", "violet", form.title, [form.code, form.agency].filter(Boolean).join(" · ")))),
        ...group("Расчёты и проверка", found.tools.map((tool) => row({ href: tool.link }, tool.link === "#check" ? "check" : "calc", "amber", tool.title, tool.text))),
      ];
      list.replaceChildren(...(items.length ? items : [h("p", { class: "search-empty" },
        "Ничего не нашлось. Попробуйте номер статьи с кодексом («81 ТК») или другое слово. ",
        h("a", { href: "#laws" }, "Искать в текстах законов"))]));
      list.hidden = false;
    }

    input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(render, 120); });
    input.addEventListener("focus", () => { if (input.value.trim().length >= 2) render(); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key === "Enter") {
        event.preventDefault();
        clearTimeout(timer);
        render();
        list.querySelector(".search-item")?.click();
      }
    });
    const wrap = h("div", { class: "hero-search" }, h("span", { class: "hero-search-icon", "aria-hidden": "true" }, "⌕"), input, list);
    // щелчок мимо поиска закрывает список; когда поиск убран со страницы, обработчик снимается
    const outside = (event) => {
      if (!wrap.isConnected) { document.removeEventListener("click", outside); return; }
      if (!wrap.contains(event.target)) close();
    };
    document.addEventListener("click", outside);
    if (autofocus) setTimeout(() => input.focus(), 0);
    wrap.input = input;
    return wrap;
  }

  window.SearchBox = { create };
})();
