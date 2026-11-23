/* Запуск приложения и переходы между разделами по адресу страницы. */
(function () {
  "use strict";

  const view = document.getElementById("view");
  const app = { store: window.Storage2.createStore(window.Storage2.browserBackend()) };

  /** Разбирает адрес вида #template/loan в раздел и параметры. */
  function parseRoute(hash) {
    let parts;
    try {
      parts = hash.replace(/^#/, "").split("/").map(decodeURIComponent);
    } catch (error) {
      return { name: "notFound", nav: null, params: {} };
    }
    const [section, first, second] = parts;
    switch (section) {
      case "template": return { name: "editor", nav: "templates", params: { templateId: first } };
      case "document": return { name: "editor", nav: "documents", params: { documentId: first } };
      case "documents": return { name: "documents", nav: "documents", params: {} };
      case "check": return { name: "check", nav: "check", params: {} };
      case "company": return { name: "company", nav: "check", params: {} };
      case "laws": return { name: "laws", nav: "laws", params: { lawId: first, number: second } };
      case "templates": return { name: "catalog", nav: "templates", params: { category: first } };
      case "forms": return { name: "forms", nav: "templates", params: { formId: first } };
      case "calc": return { name: "calc", nav: "calc", params: { card: first } };
      case "terms": return { name: "terms", nav: "terms", params: {} };
      case "privacy": return { name: "privacy", nav: "privacy", params: {} };
      case "contacts": return { name: "contacts", nav: "contacts", params: {} };
      case "account": return { name: "account", nav: "account", params: {} };
      case "":
      case "home": return { name: "home", nav: "home", params: {} };
      default: return { name: "notFound", nav: null, params: {} };
    }
  }

  function showRoute() {
    const route = parseRoute(location.hash);
    // окно статьи открыто поверх прежнего экрана: при переходе (в том числе кнопкой «Назад») его закрываем,
    // а если новый адрес сам ведёт на статью, раздел законов откроет её заново
    for (const dialog of [document.getElementById("article-dialog"), searchDialog]) if (dialog && dialog.open) dialog.close();
    view.replaceChildren();
    // класс перезапускает анимацию появления экрана (в styles.css, при «уменьшить движение» её нет)
    view.classList.remove("view-enter");
    void view.offsetWidth;
    view.classList.add("view-enter");
    view.dataset.route = route.name;
    window.Views[route.name](view, route.params, app);
    document.querySelectorAll(".nav a, .footer-links a, #account-link").forEach((link) => {
      if (link.dataset.section === route.nav) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    window.scrollTo(0, 0);
  }

  function describeBase() {
    const { laws, builtAt } = window.LAW_BASE;
    const all = Object.values(laws);
    const articles = all.reduce((sum, law) => sum + Object.keys(law.articles).length, 0);
    const texts = all.reduce((sum, law) => sum + Object.values(law.articles).filter((article) => article.hasText).length, 0);
    const updated = all.map((law) => law.updated).sort().pop();
    document.getElementById("base-note").textContent =
      `База собрана ${window.Editions.formatDate(builtAt)}: статей ${articles.toLocaleString("ru-RU")}, с полным текстом ${texts.toLocaleString("ru-RU")}. ` +
      `Тексты и редакции с официального портала pravo.gov.ru, Конституция с официального сайта Президента kremlin.ru. ` +
      `Последняя учтённая редакция от ${window.Editions.formatDate(updated)}.`;
  }

  /* Шапка: кружок кабинета с инициалами и поиск по всему из любого раздела (кнопка, Ctrl+K или «/»). */
  const profile = window.Profile.createProfile(window.Storage2.browserBackend());
  const accountLink = document.getElementById("account-link");
  const userIcon = accountLink.innerHTML;
  function showAvatar() {
    const { name } = profile.read();
    const initials = window.Profile.initials(name);
    if (initials) accountLink.textContent = initials;
    else accountLink.innerHTML = userIcon;
    accountLink.setAttribute("aria-label", name ? `Личный кабинет: ${name}` : "Личный кабинет");
  }
  window.addEventListener("norma:profile", showAvatar);
  // профиль поменяли в другой вкладке
  window.addEventListener("storage", (event) => { if (event.key === window.Profile.KEY || event.key === null) showAvatar(); });
  showAvatar();

  const searchDialog = document.getElementById("search-dialog");
  function openSearch() {
    if (searchDialog.open) return;
    const box = window.SearchBox.create({ id: "palette-search", onPick: () => searchDialog.close() });
    document.getElementById("search-dialog-body").replaceChildren(box);
    searchDialog.showModal();
    box.input.focus();
  }
  document.getElementById("search-open").addEventListener("click", openSearch);
  // щелчок по затемнению вокруг окна закрывает его
  searchDialog.addEventListener("click", (event) => { if (event.target === searchDialog) searchDialog.close(); });
  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
    // KeyK — та же клавиша в русской раскладке («Л»)
    const isK = event.code === "KeyK" || event.key.toLowerCase() === "k";
    if ((event.ctrlKey || event.metaKey) && isK) {
      event.preventDefault();
      openSearch();
    } else if (event.key === "/" && !typing && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      openSearch();
    }
  });

  // ссылка «Перейти к содержимому» переводит фокус, а не меняет адрес
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    view.focus();
  });
  window.addEventListener("hashchange", showRoute);
  describeBase();
  showRoute();
})();
