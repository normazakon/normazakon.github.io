/* Главная приложения: рабочее место. Поиск, продолжение работы, частые задачи и лента изменений законов.
   Рассказ о сервисе живёт на лендинге (index.html), здесь его нет. */
(function () {
  "use strict";

  const { h, icon } = window.UI;


  // задачи, с которыми приходят на сайт: каждая ведёт туда, где её решают
  const TASKS = [
    { icon: "contract", tone: "blue", title: "Составить договор", text: "Оказание услуг, подряд, заём, аренда, купля-продажа", link: "#templates/Договоры" },
    { icon: "letter", tone: "orange", title: "Написать претензию", text: "Продавцу, исполнителю или должнику перед судом", link: "#templates/Претензии и уведомления" },
    { icon: "court", tone: "violet", title: "Обратиться в суд", text: "Иск, судебный приказ, возражения, апелляция", link: "#templates/Суд" },
    { icon: "check", tone: "green", title: "Проверить документ", text: "Найдём ошибки в ссылках на статьи законов", link: "#check" },
    { icon: "book", tone: "teal", title: "Найти статью закона", text: "Кодексы и законы в официальной редакции", link: "#laws" },
    { icon: "calc", tone: "amber", title: "Посчитать срок или сумму", text: "Срок обжалования, госпошлина, неустойка, проценты", link: "#calc" },
    { icon: "building", tone: "rose", title: "Проверить контрагента", text: "Статус, адрес и руководитель по ИНН из ЕГРЮЛ", link: "#company" },
    { icon: "stamp", tone: "violet", title: "Заполнить официальный бланк", text: "Заявления в ФНС, МВД, ЗАГС и Росреестр", link: "#forms" },
    { icon: "briefcase", tone: "blue", title: "Оформить трудовые документы", text: "Трудовой договор, увольнение, приказы", link: "#templates/Трудовые отношения" },
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
    const codes = laws.length - (window.LAW_BASE.laws.KONST ? 1 : 0);
    return [
      `${window.LAW_BASE.laws.KONST ? "Конституция и " : ""}${counted(codes, "кодекс и закон", "кодекса и закона", "кодексов и законов")}, ${counted(articles, "статья", "статьи", "статей")}`,
      `Официальные редакции от ${window.Editions.formatDate(updated)}`,
      counted(window.TEMPLATE_INDEX.length, "шаблон", "шаблона", "шаблонов"),
      "Данные остаются у вас",
    ];
  }

  const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const VISIBLE_DATES = 5;
  const VISIBLE_ARTICLES = 8;

  /** Список статей одного закона за одну дату: раскрывается по нажатию на значок. */
  function changeArticles(group, upcoming) {
    const law = window.LAW_BASE.laws[group.lawId];
    const shown = group.articles.slice(0, VISIBLE_ARTICLES);
    const more = group.articles.length - shown.length;
    return h("div", { class: "timeline-panel" },
      h("ul", {}, shown.map(([number, kind]) => h("li", {}, h("button", {
        class: "timeline-article", type: "button",
        onClick: () => window.UI.showArticle(group.lawId, number, upcoming ? { date: group.date } : {}),
      },
      h("span", { class: "timeline-number" }, `Ст. ${number}`),
      h("span", { class: "timeline-title" }, law.articles[number] ? law.articles[number].title : ""),
      kind === "added" && h("span", { class: "badge" }, "новая"),
      kind === "repealed" && h("span", { class: "badge draft" }, "утратила силу"))))),
      more > 0 && h("a", { class: "timeline-more", href: `#laws/${group.lawId}` }, `и ещё ${counted(more, "статья", "статьи", "статей")} в ${law.short}`));
  }

  /** Строка ленты: дата слева, значки законов с числом статей справа. */
  function timelineRow(date, groups, upcoming) {
    const [year, month, day] = date.split("-");
    const panel = h("div", { class: "timeline-detail", hidden: true });
    let opened = null;
    const chips = groups.map((group) => {
      const law = window.LAW_BASE.laws[group.lawId];
      const chip = h("button", {
        class: "timeline-chip", type: "button", "aria-expanded": "false",
        title: `${law.name}: ${counted(group.articles.length, "статья", "статьи", "статей")}`,
      }, window.UI.lawBadge(group.lawId, law, true), h("span", { class: "timeline-count" }, String(group.articles.length)));
      chip.addEventListener("click", () => {
        const same = opened === chip;
        chips.forEach((other) => other.setAttribute("aria-expanded", "false"));
        opened = same ? null : chip;
        panel.hidden = same;
        if (!same) {
          chip.setAttribute("aria-expanded", "true");
          panel.replaceChildren(changeArticles(group, upcoming));
        }
      });
      return chip;
    });
    return h("li", { class: "timeline-row" },
      h("div", { class: upcoming ? "timeline-date upcoming" : "timeline-date" },
        h("strong", {}, String(Number(day))), h("span", {}, `${MONTHS_SHORT[Number(month) - 1]} ${year}`)),
      h("div", { class: "timeline-body" }, h("div", { class: "timeline-chips" }, chips), panel));
  }

  /** Колонка ленты: даты по порядку, лишние прячутся за «Показать все». */
  function timelineColumn(title, groups, upcoming) {
    const byDate = new Map();
    for (const group of groups) {
      if (!window.LAW_BASE.laws[group.lawId]) continue;
      byDate.set(group.date, [...(byDate.get(group.date) || []), group]);
    }
    const rows = [...byDate].map(([date, items]) => timelineRow(date, items, upcoming));
    rows.slice(VISIBLE_DATES).forEach((row) => { row.hidden = true; });
    const toggle = rows.length > VISIBLE_DATES && h("button", { class: "link-button timeline-toggle", type: "button" }, `Показать все даты (${rows.length})`);
    if (toggle) {
      toggle.addEventListener("click", () => {
        rows.forEach((row) => { row.hidden = false; });
        toggle.remove();
      });
    }
    return h("div", { class: "timeline-column" }, h("h3", {}, title), h("ol", { class: "timeline" }, rows), toggle);
  }

  /** Лента изменений: собрана при сборке базы из дат официальных редакций. */
  function lawChanges() {
    const data = window.LAW_CHANGES;
    if (!data || (!data.recent.length && !data.upcoming.length)) return null;
    return section("home-changes", "Что изменилось в законах и что вступит в силу",
      h("p", { class: "section-lead" }, "Нажмите на значок закона, чтобы увидеть изменённые статьи."),
      h("div", { class: "changes-grid" },
        timelineColumn("Скоро вступят в силу", data.upcoming, true),
        timelineColumn("Недавно изменились", data.recent, false)));
  }

  const VISIBLE_WATCHED = 5;

  /** «Изменилось в ваших статьях»: изменения в статьях из избранного и в основаниях шаблонов и черновиков. */
  function watchedChanges(app) {
    const { bookmarks } = window.UI;
    const drafts = app && app.store ? app.store.list() : [];
    const { watched, items } = window.Watch.watchedChanges({
      favorites: bookmarks.favorites(), drafts, templates: window.TEMPLATE_INDEX, changes: window.LAW_CHANGES,
    });
    const head = h("div", { class: "continue-head" }, h("h2", {}, "Изменилось в ваших статьях"));
    const wrap = (...children) => h("section", { class: "home-watch" }, h("div", { class: "home-inner" }, head, ...children));

    if (!watched) {
      return wrap(h("p", { class: "continue-empty" },
        "Отмечайте статьи и шаблоны звёздочкой или начните документ по шаблону: здесь появится, что в их статьях изменилось и что скоро вступит в силу."));
    }
    if (!items.length) {
      return wrap(h("p", { class: "continue-empty watch-calm" },
        `В ${counted(watched, "статье", "статьях", "статьях")}, за которыми вы следите, за последние ${window.LAW_CHANGES.recentDays} дней изменений не было, новых редакций пока не ожидается.`));
    }

    const rows = items.map((item) => {
      const law = window.LAW_BASE.laws[item.lawId];
      const article = law && law.articles[item.number];
      const [year, month, day] = item.date.split("-");
      const status = item.kind === "added" ? "новая" : item.kind === "repealed" ? (item.upcoming ? "утратит силу" : "утратила силу") : null;
      return h("li", {}, h("button", {
        class: `watch-item${item.upcoming ? " upcoming" : ""}`, type: "button",
        onClick: () => window.UI.showArticle(item.lawId, item.number, item.upcoming ? { date: item.date } : {}),
      },
      h("span", { class: "watch-date" },
        h("span", {}, item.upcoming ? "вступит" : "изменена"),
        h("strong", {}, String(Number(day))), h("span", {}, `${MONTHS_SHORT[Number(month) - 1]} ${year}`)),
      h("span", { class: "watch-text" },
        h("span", { class: "watch-title" }, h("strong", {}, window.UI.articleName(item.lawId, item.number)),
          status && h("span", { class: item.kind === "repealed" ? "badge draft" : "badge" }, status)),
        article && h("span", { class: "watch-name" }, article.title),
        h("span", { class: "watch-reason" }, window.Watch.reasonText(item.reasons))),
      h("span", { class: "card-arrow" }, window.UI.icon("arrow"))));
    });
    rows.slice(VISIBLE_WATCHED).forEach((row) => { row.hidden = true; });
    const toggle = rows.length > VISIBLE_WATCHED && h("button", { class: "link-button timeline-toggle", type: "button" }, `Показать все (${rows.length})`);
    if (toggle) toggle.addEventListener("click", () => { rows.forEach((row) => { row.hidden = false; }); toggle.remove(); });
    const upcoming = items.filter((item) => item.upcoming).length;
    const summary = [upcoming && `${counted(upcoming, "изменение вступит", "изменения вступят", "изменений вступят")} в силу`,
      items.length - upcoming && `${counted(items.length - upcoming, "статья изменилась", "статьи изменились", "статей изменились")} за ${window.LAW_CHANGES.recentDays} дней`]
      .filter(Boolean).join(", ");
    head.append(h("span", { class: "watch-summary" }, `${summary}. Под наблюдением ${counted(watched, "статья", "статьи", "статей")}.`));
    return wrap(h("ul", { class: "watch-list" }, rows), toggle);
  }

  /** Карточка «Продолжить работу». */
  function continueCard(props, tone, iconName, title, note) {
    return h("li", {}, h(props.href ? "a" : "button", { class: `continue-card tone-${tone}`, type: props.href ? undefined : "button", ...props },
      h("span", { class: "tone-plate small" }, icon(iconName)),
      h("span", { class: "continue-text" }, h("strong", {}, title), h("span", {}, note))));
  }

  /** «Продолжить работу»: черновики, избранное и недавние. Пока их нет, блок подсказывает, что здесь появится. */
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
            window.UI.articleName(item.lawId, item.number), article.title));
        }
      } else {
        const template = window.TEMPLATE_INDEX.find((entry) => entry.id === item.templateId);
        if (template) cards.push(continueCard({ href: `#template/${template.id}` }, "blue", "contract", template.title, "Шаблон"));
      }
    }
    const body = cards.length
      ? h("ul", { class: "continue-grid" }, cards)
      : h("p", { class: "continue-empty" }, "Здесь появятся ваши черновики, избранные шаблоны и статьи, которые вы открывали. ",
        h("a", { href: "#templates" }, "Выбрать шаблон"));
    return h("section", { class: "home-continue" }, h("div", { class: "home-inner" },
      h("div", { class: "continue-head" }, h("h2", {}, "Продолжить работу"), cards.length > 0 && h("a", { href: "#documents" }, "Все мои документы")),
      body));
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

  const homeSettings = () => window.Settings.createSettings(window.Storage2.browserBackend()).read();

  /** Заголовок главной: по имени из аккаунта, если человек вошёл. */
  function greeting(app) {
    const user = app && app.auth && app.auth.current();
    return user ? `Здравствуйте, ${user.name}` : "Что найти?";
  }

  window.Views = window.Views || {};
  window.Views.home = function (root, _params, app) {
    // блоки, которым нечего показать (например, лента изменений без данных), отдают null и пропускаются
    root.append(...[
      h("section", { class: "home-hero" }, h("div", { class: "home-inner hero-center" },
        h("h1", {}, greeting(app)),
        h("p", { class: "hero-lead" }, "Статья по номеру, шаблон, официальный бланк или расчёт: одна строка для всего."),
        window.SearchBox.create({ id: "hero-search" }),
        h("ul", { class: "hero-points" }, heroPoints().map((point) => h("li", {}, point))))),

      continueWork(app),
      // блоки, которые можно скрыть в настройках кабинета
      homeSettings().homeWatch && watchedChanges(app),
      tasks(),
      homeSettings().homeChanges && lawChanges(),
    ].filter(Boolean));
  };
})();
