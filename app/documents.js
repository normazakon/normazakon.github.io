/* «Мои документы»: черновики с поиском и сортировкой, заполненностью и быстрыми действиями, избранное и недавние.
   Черновики и закладки свои у каждого аккаунта и у гостя (Auth.personalBackend). */
(function () {
  "use strict";

  const { h, icon, shortDateTime } = window.UI;
  const Engine = window.TemplateEngine;
  const SORT_KEY = "norma.documentsSort";

  /** Как скачанный из редактора файл: «Название шаблона дата.docx». */
  function fileName(template, values) {
    const date = values.date || values.claim_date || new Date().toISOString().slice(0, 10);
    return `${template.title} ${date}.docx`.replace(/[\\/:*?"<>|]/g, "");
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

  function readSort() {
    try { return localStorage.getItem(SORT_KEY) === "title" ? "title" : "recent"; } catch { return "recent"; }
  }

  window.Views = window.Views || {};
  window.Views.documents = function (root, _params, app) {
    const { bookmarks } = window.UI;
    const user = app.auth.current();
    const list = h("div", {});
    const saved = h("div", {});
    const state = { query: "", sort: readSort(), templates: null };

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

    /** Заполненность черновика: { filled, total } или null, пока шаблон не загружен. */
    function progressOf(document) {
      const template = state.templates && state.templates.get(document.templateId);
      if (!template) return null;
      return Engine.render(template, Engine.withDefaults(template, document.values)).progress;
    }

    function card(document) {
      const entry = window.TemplateLoader.entry(document.templateId);
      const template = state.templates && state.templates.get(document.templateId);
      const [iconName, tone] = window.UI.templateLook(entry ? entry.category : "");
      const progress = progressOf(document);
      const percent = progress && progress.total ? Math.round(progress.filled / progress.total * 100) : null;
      const actions = h("div", { class: "doc-card-actions" });

      function showActions() {
        actions.replaceChildren(
          h("a", { class: "button primary", href: `#document/${document.id}` }, "Открыть"),
          template && h("button", { class: "button", type: "button", title: "Скачать в Word", onClick: () => {
            const result = Engine.render(template, Engine.withDefaults(template, document.values));
            window.UI.downloadFile(window.Docx.build(result.blocks), fileName(template, document.values), window.Docx.MIME);
          } }, icon("download"), "Word"),
          entry && h("button", { class: "button quiet", type: "button", title: "Сделать копию черновика", onClick: () => {
            app.store.save({ ...document, id: `doc-${Date.now().toString(36)}`, title: `${document.title} (копия)` });
            render();
          } }, icon("copy"), "Копия"),
          h("button", { class: "button quiet", type: "button", onClick: askToDelete }, "Удалить"));
      }

      function askToDelete() {
        actions.replaceChildren(
          h("span", { class: "doc-card-confirm" }, "Удалить черновик?"),
          h("button", { class: "button danger", type: "button", onClick: () => { app.store.remove(document.id); render(); } }, "Удалить навсегда"),
          h("button", { class: "button quiet", type: "button", onClick: showActions }, "Отмена"));
      }

      showActions();
      return h("li", { class: `doc-card tone-${tone}` },
        h("span", { class: "tone-plate" }, icon(iconName)),
        h("div", { class: "doc-card-main" },
          h("a", { class: "doc-card-title", href: `#document/${document.id}` }, document.title),
          h("div", { class: "doc-card-meta" },
            entry ? (entry.title !== document.title ? entry.title : entry.category) : "Шаблон больше не доступен",
            ` · изменён ${shortDateTime(document.updatedAt)}`),
          percent !== null && h("div", { class: "doc-progress" },
            h("span", { class: "doc-progress-bar", "aria-hidden": "true" }, h("span", { style: `width: ${percent}%` })),
            h("span", {}, percent === 100 ? "Все поля заполнены" : `Заполнено ${progress.filled} из ${progress.total}`))),
        actions);
    }

    const search = h("input", { class: "search", type: "search", placeholder: "Найти черновик по названию", "aria-label": "Найти черновик" });
    search.addEventListener("input", () => { state.query = search.value.trim().toLowerCase(); drawList(); });
    const sortButton = (value, label) => {
      const button = h("button", { type: "button", "aria-pressed": String(state.sort === value) }, label);
      button.addEventListener("click", () => {
        state.sort = value;
        try { localStorage.setItem(SORT_KEY, value); } catch { /* хранилище недоступно */ }
        sorter.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
        drawList();
      });
      return button;
    };
    const sorter = h("div", { class: "segmented", role: "group", "aria-label": "Порядок" }, sortButton("recent", "Сначала новые"), sortButton("title", "По названию"));
    const toolbar = h("div", { class: "doc-toolbar" }, search, sorter);

    function drawList() {
      const documents = app.store.list();
      if (!documents.length) {
        toolbar.hidden = true;
        list.replaceChildren(bookmarks.favorites().length || bookmarks.recent().length
          // избранное уже есть, поэтому большой пустой экран не нужен
          ? h("p", { class: "empty" }, "Черновиков пока нет. ", h("a", { href: "#templates" }, "Выбрать шаблон"))
          : h("div", { class: "empty-state" },
            h("span", { class: "empty-state-mark", "aria-hidden": "true" }, "§"),
            h("h2", {}, "Документов пока нет"),
            h("p", {}, "Выберите шаблон и начните заполнять: черновик сохранится здесь сам, и к нему можно вернуться в любой момент."),
            h("a", { class: "button primary", href: "#templates" }, "Выбрать шаблон")));
        return;
      }
      toolbar.hidden = documents.length < 2;
      const found = documents
        .filter((document) => !state.query || document.title.toLowerCase().includes(state.query))
        .sort((a, b) => (state.sort === "title" ? a.title.localeCompare(b.title, "ru") : b.updatedAt.localeCompare(a.updatedAt)));
      list.replaceChildren(
        h("div", { class: "doc-count" }, state.query ? `Найдено: ${found.length} из ${documents.length}` : `Черновиков: ${documents.length}`),
        found.length
          ? h("ul", { class: "doc-cards" }, found.map(card))
          : h("p", { class: "empty" }, "Ничего не нашлось. Попробуйте другое слово."));
    }

    function render() {
      drawList();
      const documents = app.store.list();
      window.TemplateLoader.loadMany(documents.map((document) => document.templateId))
        .then((templates) => { state.templates = templates; if (list.isConnected) drawList(); })
        .catch(() => {});
    }

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Мои документы"),
          h("p", {}, user
            ? "Черновики, избранное и недавно открытое вашего аккаунта. Черновик сохраняется сам, пока вы заполняете шаблон."
            : ["Вы не вошли в аккаунт: черновики сохраняются в этом браузере. ", h("a", { href: "#login", onClick: () => window.AuthPages.rememberReturn("#documents") }, "Войдите"), ", чтобы они были в вашем аккаунте."]))),
      toolbar,
      list,
      saved);
    render();
    renderBookmarks();
  };
})();
