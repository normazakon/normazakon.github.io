/* Домашняя страница. Цифры и пример проверки берутся из настоящих данных приложения. */
(function () {
  "use strict";

  const { h, icon } = window.UI;


  const AUTOMATIONS = [
    ["Суммы прописью", "с правильными падежами рублей и копеек"],
    ["Государственная пошлина", "по шкале статьи 333.19 НК РФ"],
    ["Подсудность", "мировой судья или районный суд по цене иска"],
    ["Статус сторон", "условия для потребителя отличаются от условий для бизнеса"],
    ["Сроки", "пять лет найма, две недели при увольнении, десять дней на возражения"],
    ["Реквизиты", "контрольные числа ИНН и ОГРН"],
    ["Проценты по статье 395 ГК РФ", "по ключевой ставке Банка России с разбивкой по периодам"],
    ["Связанные документы", "из договора одной кнопкой: акт, претензия, иск"],
    ["Файлы Word", "проверка загруженного .docx без копирования текста"],
  ];

  // задачи, с которыми приходят на сайт: каждая ведёт туда, где её решают
  const TASKS = [
    { icon: "contract", tone: "blue", title: "Составить договор", text: "Оказание услуг, подряд, заём, аренда, купля-продажа", link: "#templates/Договоры" },
    { icon: "letter", tone: "orange", title: "Написать претензию", text: "Продавцу, исполнителю или должнику перед судом", link: "#templates/Претензии и уведомления" },
    { icon: "court", tone: "violet", title: "Обратиться в суд", text: "Иск, судебный приказ, возражения, апелляция", link: "#templates/Суд" },
    { icon: "check", tone: "green", title: "Проверить документ", text: "Найдём ошибки в ссылках на статьи законов", link: "#check" },
    { icon: "book", tone: "teal", title: "Найти статью закона", text: "Кодексы и законы в официальной редакции", link: "#laws" },
    { icon: "calc", tone: "amber", title: "Посчитать срок или сумму", text: "Срок обжалования, госпошлина, неустойка, проценты", link: "#calc" },
  ];

  const STEPS = [
    ["Выберите документ", "Договор, акт, доверенность, претензия, судебное заявление."],
    ["Заполните поля", "Пустые места подсвечены. Сервис ничего не додумывает за вас."],
    ["Заберите результат", "Скачайте файл Word и продолжайте работу в привычном редакторе."],
  ];

  const PLANNED = [
    ["ИИ-помощник", "ответы со ссылками на проверенные нормы, а не на догадки модели"],
    ["Судебная практика", "проверка реквизитов и выводов судебных актов"],
    ["Проверка контрагентов", "сведения о компании из ЕГРЮЛ по ИНН"],
    ["Больше законов", "Конституция и другие федеральные законы"],
    ["Проверка юристами", "шаблоны, просмотренные практикующими юристами"],
    ["Личный кабинет", "документы доступны на любом устройстве"],
  ];

  /** Число со словом в нужном падеже: 1 статья, 3 статьи, 5 статей. */
  function counted(count, one, few, many) {
    const tens = count % 100;
    const units = count % 10;
    const word = tens >= 11 && tens <= 14 ? many : units === 1 ? one : units >= 2 && units <= 4 ? few : many;
    return `${count.toLocaleString("ru-RU")} ${word}`;
  }

  /** Полоса доверия под поиском: цифры берутся из настоящей базы. */
  function heroPoints() {
    const laws = Object.values(window.LAW_BASE.laws);
    const articles = laws.reduce((sum, law) => sum + Object.keys(law.articles).length, 0);
    const updated = laws.map((law) => law.updated).sort().pop();
    return [
      `${counted(laws.length, "кодекс и закон", "кодекса и закона", "кодексов и законов")}, ${counted(articles, "статья", "статьи", "статей")}`,
      `Редакции pravo.gov.ru от ${window.Editions.formatDate(updated)}`,
      counted(window.TEMPLATES.length, "шаблон", "шаблона", "шаблонов"),
      "Данные остаются у вас",
    ];
  }

  /**
   * Поиск на первом экране: статья по номеру, статьи по заголовку, шаблоны и расчёты в одном списке.
   * Enter открывает первый результат, Esc закрывает список.
   */
  function heroSearch() {
    const input = h("input", {
      class: "hero-search-input", type: "search", id: "hero-search", autocomplete: "off",
      placeholder: "Например: 395 ГК или претензия продавцу", "aria-label": "Найти статью, шаблон или расчёт",
      "aria-controls": "hero-search-results",
    });
    const list = h("div", { class: "search-results", id: "hero-search-results", hidden: true, role: "listbox" });
    let timer = null;

    const close = () => { list.hidden = true; };
    const group = (title, items) => items.length ? [h("p", { class: "search-group" }, title), ...items] : [];
    const row = (props, iconName, tone, main, sub) => h(props.href ? "a" : "button", {
      class: `search-item tone-${tone}`, type: props.href ? undefined : "button", role: "option", ...props,
    }, h("span", { class: "tone-plate small" }, icon(iconName)), h("span", { class: "search-item-text" }, h("strong", {}, main), sub && h("span", {}, sub)));

    function render() {
      const query = input.value.trim();
      if (query.length < 2) { close(); return; }
      const found = window.SiteSearch.search(query, { base: window.LAW_BASE, templates: window.TEMPLATES, stem: window.TextSearch.stem });
      const items = [
        ...group("Статьи", found.articles.map((article) => row(
          { onClick: () => { close(); window.UI.showArticle(article.lawId, article.number); } },
          "book", "teal", `Ст. ${article.number} ${article.short}`, article.title))),
        ...group("Шаблоны", found.templates.map((template) => row({ href: `#template/${template.id}` }, "contract", "blue", template.title, template.summary))),
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
    // щелчок мимо поиска закрывает список; когда главную покидают, обработчик снимается
    const outside = (event) => {
      if (!wrap.isConnected) { document.removeEventListener("click", outside); return; }
      if (!wrap.contains(event.target)) close();
    };
    document.addEventListener("click", outside);
    return wrap;
  }

  const KIND_WORDS = { added: "новая", repealed: "утратила силу" };

  /** Одна группа ленты: закон, дата и первые статьи. Будущие статьи открываются в редакции на эту дату. */
  function changeGroup(group, upcoming) {
    const law = window.LAW_BASE.laws[group.lawId];
    if (!law) return null;
    const { formatDate } = window.Editions;
    const shown = group.articles.slice(0, 3);
    const more = group.articles.length - shown.length;
    return h("li", { class: "change-card" },
      h("div", { class: "change-head" },
        window.UI.lawBadge(group.lawId, law, true),
        h("strong", {}, law.short),
        h("span", { class: upcoming ? "change-date upcoming" : "change-date" }, `с ${formatDate(group.date)}`)),
      h("p", { class: "change-summary" }, `${upcoming ? "Вступят в силу изменения" : "Изменились"}: ${counted(group.articles.length, "статья", "статьи", "статей")}`),
      h("ul", { class: "change-list" }, shown.map(([number, kind]) => {
        const article = law.articles[number];
        return h("li", {}, h("button", {
          class: "change-article", type: "button",
          onClick: () => window.UI.showArticle(group.lawId, number, upcoming ? { date: group.date } : {}),
        }, h("span", { class: "change-number" }, `Ст. ${number}`), h("span", {}, article ? article.title : ""),
        KIND_WORDS[kind] && h("span", { class: kind === "repealed" ? "badge draft" : "badge" }, KIND_WORDS[kind])));
      })),
      more > 0 && h("p", { class: "change-more" }, `и ещё ${counted(more, "статья", "статьи", "статей")}`));
  }

  /** Лента изменений: собрана при сборке базы из дат официальных редакций. */
  function lawChanges() {
    const data = window.LAW_CHANGES;
    if (!data || (!data.recent.length && !data.upcoming.length)) return null;
    const column = (title, note, groups, upcoming) => h("div", { class: "changes-column" },
      h("h3", {}, title), h("p", { class: "changes-note" }, note),
      h("ul", { class: "change-cards" }, groups.slice(0, 4).map((group) => changeGroup(group, upcoming)).filter(Boolean)));
    return section("home-changes", "Что изменилось в законах и что вступит в силу",
      h("div", { class: "changes-grid" },
        column("Недавно изменились", `За ${data.recentDays} дней до сборки базы ${window.Editions.formatDate(data.builtAt)}`, data.recent, false),
        column("Скоро вступят в силу", "Уже приняты и опубликованы, но ещё не действуют", data.upcoming, true)));
  }

  /** Карточка «Продолжить работу». */
  function continueCard(props, tone, iconName, title, note) {
    return h("li", {}, h(props.href ? "a" : "button", { class: `continue-card tone-${tone}`, type: props.href ? undefined : "button", ...props },
      h("span", { class: "tone-plate small" }, icon(iconName)),
      h("span", { class: "continue-text" }, h("strong", {}, title), h("span", {}, note))));
  }

  /** «Продолжить работу» для тех, кто уже заходил: черновики, избранное и недавние. Новичку блок не показывается. */
  function continueWork(app) {
    const drafts = app && app.store ? app.store.list().slice(0, 3) : [];
    const { bookmarks } = window.UI;
    const seen = new Set();
    const saved = [...bookmarks.favorites(), ...bookmarks.recent()].filter((item) => {
      const key = window.Bookmarks.keyOf(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const cards = drafts.map((draft) => continueCard({ href: `#document/${draft.id}` }, "blue", "contract", draft.title,
      `Черновик, изменён ${window.UI.shortDateTime(draft.updatedAt)}`));
    for (const item of saved) {
      if (cards.length >= 6) break;
      if (item.kind === "article") {
        const law = window.LAW_BASE.laws[item.lawId];
        const article = law && law.articles[item.number];
        if (article) {
          cards.push(continueCard({ onClick: () => window.UI.showArticle(item.lawId, item.number) }, "teal", "book",
            `Ст. ${item.number} ${law.short}`, article.title));
        }
      } else {
        const template = window.TEMPLATES.find((entry) => entry.id === item.templateId);
        if (template) cards.push(continueCard({ href: `#template/${template.id}` }, "blue", "contract", template.title, "Шаблон"));
      }
    }
    if (!cards.length) return null;
    return h("section", { class: "home-continue" }, h("div", { class: "home-inner" },
      h("div", { class: "continue-head" }, h("h2", {}, "Продолжить работу"), h("a", { href: "#documents" }, "Все мои документы")),
      h("ul", { class: "continue-grid" }, cards)));
  }

  // у раздела только заголовок, без надписи-метки над ним
  function section(className, title, ...children) {
    return h("section", { class: `home-section ${className}` }, h("div", { class: "home-inner" },
      title && h("h2", {}, title),
      children));
  }

  function tasks() {
    return h("section", { class: "home-tasks" }, h("div", { class: "home-inner" },
      h("h2", {}, "Что нужно сделать?"),
      h("ul", { class: "task-grid" }, TASKS.map((task) => h("li", {},
        h("a", { class: `task-card tone-${task.tone}`, href: task.link },
          h("span", { class: "tone-plate" }, window.UI.icon(task.icon)),
          h("span", { class: "task-text" }, h("strong", {}, task.title), h("span", {}, task.text)),
          h("span", { class: "card-arrow" }, window.UI.icon("arrow"))))))));
  }

  window.Views = window.Views || {};
  window.Views.home = function (root, _params, app) {
    // блоки, которым нечего показать (например, «Продолжить работу» при первом визите), отдают null и пропускаются
    root.append(...[
      h("section", { class: "home-hero" }, h("div", { class: "home-inner hero-center" },
        h("h1", {}, "Юридические документы и законы в одном месте"),
        h("p", { class: "hero-lead" }, "Соберите документ по шаблону, найдите статью закона и посчитайте сроки."),
        heroSearch(),
        h("ul", { class: "hero-points" }, heroPoints().map((point) => h("li", {}, point))))),

      continueWork(app),
      tasks(),
      lawChanges(),

      section("home-cost", null,
        h("div", { class: "cost-card" },
          h("div", { class: "cost-copy" },
            h("h2", {}, "Одна неверная норма меняет всю сумму"),
            h("p", {}, "В иске по договору долевого участия легко по привычке указать потребительский штраф 50%. Часть 3 статьи 10 214-ФЗ называет 5%. Норма отмечает такое место и показывает текст статьи."),
            h("p", { class: "cost-note" }, "Вымышленный пример: присуждённая сумма 336 416,67 ₽. Какая редакция применяется, зависит от даты договора и спора.")),
          h("dl", { class: "cost-table" },
            h("div", {}, h("dt", {}, "Штраф 50%"), h("dd", {}, "168 208,33 ₽")),
            h("div", {}, h("dt", {}, "Штраф 5%"), h("dd", {}, "16 820,83 ₽")),
            h("div", { class: "cost-total" }, h("dt", {}, "Разница"), h("dd", {}, "151 387,50 ₽"))))),

      section("", "Что Норма делает за вас",
        h("ul", { class: "automation-list" }, AUTOMATIONS.map(([name, text]) => h("li", {},
          h("div", {}, h("strong", {}, name), h("span", {}, text)))))),

      section("home-steps", "От пустой страницы до файла Word",
        h("ol", { class: "steps" }, STEPS.map(([name, text]) => h("li", {}, h("h3", {}, name), h("p", {}, text))))),

      section("", "Что будет дальше",
        h("p", { class: "section-lead" }, "Сейчас Норма работает без искусственного интеллекта. Сначала мы строим надёжную основу, а помощник будет отвечать только по ней."),
        h("ul", { class: "roadmap" }, PLANNED.map(([name, text]) => h("li", {},
          h("span", { class: "badge plain" }, "В планах"), h("strong", {}, name), h("span", {}, text))))),

      h("section", { class: "home-final-wrap" }, h("div", { class: "home-inner" }, h("div", { class: "home-final" },
        h("div", {},
          h("h2", {}, "Начните с одного документа"),
          h("p", {}, "Шаблоны пока являются черновиками: практикующий юрист их ещё не проверял. Проверяйте результат перед использованием.")),
        h("a", { class: "button primary large", href: "#templates" }, "Выбрать шаблон"))))].filter(Boolean));
  };
})();
