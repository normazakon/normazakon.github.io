/* «Что нового»: лента обновлений из data/changelog.js. Последнее увиденное запоминается в браузере,
   чтобы на главной и в меню показать отметку о свежем обновлении. */
(function () {
  "use strict";

  const { h } = window.UI;
  const SEEN_KEY = "norma.newsSeen";
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  const entries = () => window.CHANGELOG || [];
  const latest = () => (entries()[0] ? entries()[0].date : null);
  const dayText = (iso) => {
    const [year, month, day] = iso.split("-").map(Number);
    return `${day} ${MONTHS[month - 1]} ${year}`;
  };

  function seen() {
    try { return localStorage.getItem(SEEN_KEY); } catch { return null; }
  }

  /** Есть ли обновление, которого человек еще не видел. */
  function hasUnseen() {
    const last = latest();
    return Boolean(last && (!seen() || seen() < last));
  }

  function markSeen() {
    const last = latest();
    if (!last) return;
    try { localStorage.setItem(SEEN_KEY, last); } catch { /* хранилище недоступно */ }
    window.dispatchEvent(new CustomEvent("norma:news"));
  }

  /** Плашка на главной о свежем обновлении; закрывается крестиком. Отдает null, если показывать нечего. */
  function banner() {
    if (!hasUnseen()) return null;
    const entry = entries()[0];
    const box = h("div", { class: "news-banner" },
      h("span", { class: "badge" }, "Новое"),
      h("a", { href: "#news" }, entry.title),
      h("button", { class: "news-banner-close", type: "button", "aria-label": "Скрыть", onClick: () => { markSeen(); box.remove(); } }, "×"));
    return h("section", { class: "home-news" }, h("div", { class: "home-inner" }, box));
  }

  window.Views = window.Views || {};
  window.Views.news = function (root) {
    const before = seen();
    root.append(
      h("div", { class: "page-head" }, h("div", {},
        h("h1", {}, "Что нового"),
        h("p", {}, "Что появилось в «Норме» и где это найти. Нашли ошибку или хотите предложить шаблон — напишите нам через «Сообщить об ошибке»."))),
      h("ol", { class: "news-list" }, entries().map((entry) => h("li", { class: `news-item${before && entry.date > before ? " is-new" : ""}` },
        h("time", { class: "news-date", dateTime: entry.date }, dayText(entry.date)),
        h("div", { class: "news-body" },
          h("h2", {}, entry.title),
          h("p", {}, entry.text),
          entry.items && h("ul", { class: "news-points" }, entry.items.map((item) => h("li", {}, item))),
          entry.links && h("div", { class: "news-links" }, entry.links.map(([text, href]) => h("a", { class: "button", href }, text))))))));
    markSeen();
  };

  window.News = { banner, hasUnseen, markSeen };
})();
