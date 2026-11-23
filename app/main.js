/* Запуск приложения и переходы между разделами по адресу страницы. */
(function () {
  "use strict";

  const view = document.getElementById("view");
  // app.auth — аккаунты: сейчас тестовый режим в браузере (lib/auth.js), позже сервер с теми же методами
  const app = {
    // черновики свои у каждого аккаунта и у гостя (Auth.personalBackend)
    store: window.Storage2.createStore(window.Auth.personalBackend(window.Storage2.browserBackend())),
    auth: window.Auth.createLocalAuth(window.Storage2.browserBackend()),
  };

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
      case "login": return { name: "login", nav: "account", params: {} };
      case "register": return { name: "register", nav: "account", params: {} };
      case "reset": return { name: "reset", nav: "account", params: {} };
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
    closeAccountMenu();
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

  /** Коротко о базе в подвале; подробно — в кабинете, в карточке «Помощь» (UI.baseDescription). */
  function describeBase() {
    const updated = Object.values(window.LAW_BASE.laws).map((law) => law.updated).sort().pop();
    document.getElementById("base-note").textContent =
      `Тексты законов с pravo.gov.ru и kremlin.ru, редакции по ${window.Editions.formatDate(updated)}.`;
  }

  /* Шапка справа: без входа — кнопка «Войти», после входа — кружок с инициалами и меню аккаунта.
     Поиск по всему открывается из любого раздела (кнопка, Ctrl+K или «/»). */
  const { h } = window.UI;
  const slot = document.getElementById("account-slot");
  let menu = null;

  function closeAccountMenu() {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    document.getElementById("account-link").setAttribute("aria-expanded", "false");
  }

  function renderAccount() {
    const user = app.auth.current();
    menu = null;
    if (!user) {
      const login = h("a", { class: "button primary topbar-login", id: "account-link", href: "#login", "data-section": "account" }, "Войти");
      login.addEventListener("click", () => window.AuthPages.rememberReturn(location.hash || "#home"));
      slot.replaceChildren(login);
      return;
    }
    const initials = window.Auth.initials(user.name);
    const button = h("button", {
      class: "avatar", id: "account-link", type: "button", "data-section": "account",
      "aria-haspopup": "menu", "aria-expanded": "false", "aria-controls": "account-menu", "aria-label": `Аккаунт: ${user.name}`,
    }, initials || window.UI.icon("user"));
    const telegram = window.SITE && window.SITE.telegram;
    const item = (props, iconName, text) => h(props.href ? "a" : "button", { class: "account-menu-item", role: "menuitem", type: props.href ? undefined : "button", ...props },
      window.UI.icon(iconName), text);
    menu = h("div", { class: "account-menu", id: "account-menu", role: "menu", hidden: true },
      h("div", { class: "account-menu-head" },
        h("span", { class: "avatar", "aria-hidden": "true" }, initials || window.UI.icon("user")),
        h("div", {}, h("strong", {}, user.name), h("span", {}, user.email))),
      h("div", { class: "account-menu-plan" }, h("span", { class: "badge" }, user.plan.title), h("span", {}, user.plan.price)),
      h("div", { class: "account-menu-list" },
        item({ href: "#account" }, "user", "Личный кабинет"),
        item({ href: "#documents" }, "contract", "Мои документы"),
        telegram && item({ href: telegram, target: "_blank", rel: "noopener noreferrer" }, "letter", "Поддержка")),
      h("div", { class: "account-menu-list" },
        item({ onClick: async () => { closeAccountMenu(); await app.auth.signOut(); window.dispatchEvent(new CustomEvent("norma:auth")); location.hash = "#home"; } },
          "logout", "Выйти")));
    menu.addEventListener("click", (event) => { if (event.target.closest("a")) closeAccountMenu(); });
    button.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) menu.querySelector(".account-menu-item").focus();
    });
    slot.replaceChildren(button, menu);
    if (location.hash === "#account") button.setAttribute("aria-current", "page");
  }
  // щелчок мимо меню и Esc закрывают его
  document.addEventListener("click", (event) => { if (menu && !slot.contains(event.target)) closeAccountMenu(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menu && !menu.hidden) { closeAccountMenu(); document.getElementById("account-link").focus(); }
  });
  // вошли или вышли: шапка и текущий экран показывают уже данные другого человека
  // экраны входа и кабинета сами решают, куда перейти после входа или выхода, их не трогаем
  window.addEventListener("norma:auth", () => {
    renderAccount();
    if (!/^#(login|register|reset|account)\b/.test(location.hash)) showRoute();
  });
  // вошли или вышли в другой вкладке
  window.addEventListener("storage", (event) => {
    if (event.key === window.Auth.KEY || event.key === null) { renderAccount(); showRoute(); }
  });
  renderAccount();

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

  /* Настройки из кабинета, которые касаются всего приложения: размер шрифта документов и статей. */
  const settings = window.Settings.createSettings(window.Storage2.browserBackend());
  function applySettings() {
    document.documentElement.style.setProperty("--doc-scale", String(window.Settings.scaleOf(settings.read().docScale)));
  }
  window.addEventListener("norma:settings", applySettings);
  applySettings();

  // ссылка «Перейти к содержимому» переводит фокус, а не меняет адрес
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    view.focus();
  });
  window.addEventListener("hashchange", showRoute);
  describeBase();
  showRoute();
})();
