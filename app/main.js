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
      case "laws": return { name: "laws", nav: "laws", params: { lawId: first, number: second } };
      case "templates": return { name: "catalog", nav: "templates", params: {} };
      case "calc": return { name: "calc", nav: "calc", params: {} };
      case "terms": return { name: "terms", nav: "terms", params: {} };
      case "privacy": return { name: "privacy", nav: "privacy", params: {} };
      case "contacts": return { name: "contacts", nav: "contacts", params: {} };
      case "":
      case "home": return { name: "home", nav: "home", params: {} };
      default: return { name: "notFound", nav: null, params: {} };
    }
  }

  function showRoute() {
    const route = parseRoute(location.hash);
    view.replaceChildren();
    view.dataset.route = route.name;
    window.Views[route.name](view, route.params, app);
    document.querySelectorAll(".nav a, .footer-links a").forEach((link) => {
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
      `Тексты и редакции с официального портала pravo.gov.ru, последняя учтённая редакция от ${window.Editions.formatDate(updated)}.`;
  }

  // ссылка «Перейти к содержимому» переводит фокус, а не меняет адрес
  document.querySelector(".skip-link").addEventListener("click", (event) => {
    event.preventDefault();
    view.focus();
  });
  window.addEventListener("hashchange", showRoute);
  describeBase();
  showRoute();
})();
