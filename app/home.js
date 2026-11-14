/* Домашняя страница. Цифры и пример проверки берутся из настоящих данных приложения. */
(function () {
  "use strict";

  const { h, icon } = window.UI;

  const CHECK_SAMPLE = "Истец вправе отказаться от договора на основании ст. 450.2 ГК РФ. Обязательства исполняются надлежащим образом (ст. 309 ГК РФ). Срок обращения в суд указан в ст. 392 ТК РФ.";

  const FEATURES = [
    {
      title: "Документы из шаблонов",
      text: "Заполняете поля, а договор, претензия или иск собираются рядом. Пункты нумеруются сами и меняются под ваши условия.",
      detail: () => `150 000 ₽ в тексте станет «${window.Russian.moneyText("150 000")}»`,
      link: "#templates",
      action: "Выбрать шаблон",
    },
    {
      title: "Проверка ссылок",
      text: "Вставьте текст или загрузите файл Word. Проверка покажет несуществующие статьи, утратившие силу нормы, лишние части и невозможные даты актов.",
      detail: () => "Постановление от 30.02.2024 будет отмечено сразу: такой даты нет",
      link: "#check",
      action: "Проверить документ",
    },
    {
      title: "База законов",
      text: "Полные тексты статей десяти кодексов и законов. Сразу видно, действует статья или утратила силу.",
      detail: () => "Ищите и по словам из текста: по запросу «ключевой ставкой» найдётся статья 395 ГК РФ",
      link: "#laws",
      action: "Открыть законы",
    },
  ];

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

  const STEPS = [
    ["Выберите документ", "Договор, акт, доверенность, претензия, судебное заявление."],
    ["Заполните поля", "Пустые места подсвечены. Сервис ничего не додумывает за вас."],
    ["Заберите результат", "Скачайте файл Word и продолжайте работу в привычном редакторе."],
  ];

  const PLANNED = [
    ["ИИ-помощник", "ответы со ссылками на проверенные нормы, а не на догадки модели"],
    ["Официальные редакции", "тексты законов с датами действия"],
    ["Судебная практика", "проверка реквизитов и выводов судебных актов"],
    ["Проверка юристами", "шаблоны, просмотренные практикующими юристами"],
    ["Сроки с учетом выходных", "процессуальные сроки по производственному календарю"],
    ["Личный кабинет", "документы доступны на любом устройстве"],
  ];

  /** Число со словом в нужном падеже: 1 статья, 3 статьи, 5 статей. */
  function counted(count, one, few, many) {
    const tens = count % 100;
    const units = count % 10;
    const word = tens >= 11 && tens <= 14 ? many : units === 1 ? one : units >= 2 && units <= 4 ? few : many;
    return `${count.toLocaleString("ru-RU")} ${word}`;
  }

  function heroPoints() {
    const laws = Object.values(window.LAW_BASE.laws);
    const articles = laws.reduce((sum, law) => sum + Object.keys(law.articles).length, 0);
    return [
      counted(window.TEMPLATES.length, "шаблон", "шаблона", "шаблонов"),
      `${counted(articles, "статья", "статьи", "статей")} из ${laws.length} кодексов и законов`,
      "Документы не покидают ваш компьютер",
    ];
  }

  /** Короткое пояснение к найденной ссылке для заметок на полях. */
  function noteText(finding) {
    if (finding.severity === "ok") return "Статья действует, текст есть в базе";
    const suggestion = finding.suggestions && finding.suggestions[0];
    const number = suggestion && suggestion.split(":")[0];
    return number ? `${finding.status}. Возможно, имелась в виду ст. ${number}` : finding.status;
  }

  /** Лист документа с настоящей проверкой ссылок и заметками на полях. */
  function heroPaper() {
    const { findings } = window.Checker.analyze(CHECK_SAMPLE, window.LAW_BASE);
    const text = h("p", { class: "hero-paper-text" });
    let position = 0;
    for (const finding of findings) {
      text.append(CHECK_SAMPLE.slice(position, finding.start), h("span", { class: `mark ${finding.severity}` }, CHECK_SAMPLE.slice(finding.start, finding.end)));
      position = finding.end;
    }
    text.append(CHECK_SAMPLE.slice(position));
    return h("figure", { class: "hero-paper", "aria-label": "Пример проверки ссылок в документе" },
      h("p", { class: "hero-paper-title" }, "ИСКОВОЕ ЗАЯВЛЕНИЕ"),
      text,
      h("ul", { class: "hero-notes" }, findings.map((finding) => h("li", {},
        h("b", {}, finding.label),
        h("span", { class: finding.severity }, noteText(finding))))),
      h("figcaption", {}, "Проверка настоящая: она выполнилась, когда открылась страница."));
  }

  function section(className, label, title, ...children) {
    return h("section", { class: `home-section ${className}` }, h("div", { class: "home-inner" },
      label && h("p", { class: "section-label" }, label),
      title && h("h2", {}, title),
      children));
  }

  window.Views = window.Views || {};
  window.Views.home = function (root) {
    root.append(
      h("section", { class: "home-hero" }, h("div", { class: "home-inner hero-grid" },
        h("div", { class: "hero-copy" },
          h("p", { class: "hero-badge" }, "Для юристов и нотариусов"),
          h("h1", {}, "Документы и нормы права в одном окне"),
          h("p", { class: "hero-lead" }, "Соберите договор, претензию или иск из шаблона, сверьте ссылки на статьи с базой законов и рассчитайте пошлину. Всё, что вы вводите, остаётся на вашем компьютере."),
          h("div", { class: "hero-actions" },
            h("a", { class: "button primary large", href: "#templates" }, "Выбрать шаблон"),
            h("a", { class: "button large", href: "#check" }, "Проверить документ")),
          h("ul", { class: "hero-points" }, heroPoints().map((point) => h("li", {}, point)))),
        heroPaper())),

      section("", "Возможности", "Три инструмента вместо трёх вкладок",
        h("div", { class: "feature-grid" }, FEATURES.map((feature) => h("article", { class: "feature" },
          h("h3", {}, feature.title),
          h("p", {}, feature.text),
          h("p", { class: "feature-detail" }, feature.detail()),
          h("a", { class: "feature-link", href: feature.link }, feature.action, icon("arrow")))))),

      section("home-cost", "Пример", null,
        h("div", { class: "cost-card" },
          h("div", { class: "cost-copy" },
            h("h2", {}, "Одна неверная норма меняет всю сумму"),
            h("p", {}, "В иске по договору долевого участия легко по привычке указать потребительский штраф 50%. Часть 3 статьи 10 214-ФЗ называет 5%. Норма отмечает такое место и показывает текст статьи."),
            h("p", { class: "cost-note" }, "Вымышленный пример: присуждённая сумма 336 416,67 ₽. Какая редакция применяется, зависит от даты договора и спора.")),
          h("dl", { class: "cost-table" },
            h("div", {}, h("dt", {}, "Штраф 50%"), h("dd", {}, "168 208,33 ₽")),
            h("div", {}, h("dt", {}, "Штраф 5%"), h("dd", {}, "16 820,83 ₽")),
            h("div", { class: "cost-total" }, h("dt", {}, "Разница"), h("dd", {}, "151 387,50 ₽"))))),

      section("", "Автоматизация", "Считает и сверяет за вас",
        h("ul", { class: "automation-list" }, AUTOMATIONS.map(([name, text]) => h("li", {},
          h("div", {}, h("strong", {}, name), h("span", {}, text)))))),

      section("home-steps", "Как это работает", "От пустой страницы до файла Word",
        h("ol", { class: "steps" }, STEPS.map(([name, text]) => h("li", {}, h("h3", {}, name), h("p", {}, text))))),

      section("", "Дорожная карта", "Что будет дальше",
        h("p", { class: "section-lead" }, "Сейчас Норма работает без искусственного интеллекта. Сначала мы строим надёжную основу, а помощник будет отвечать только по ней."),
        h("ul", { class: "roadmap" }, PLANNED.map(([name, text]) => h("li", {},
          h("span", { class: "badge plain" }, "В планах"), h("strong", {}, name), h("span", {}, text))))),

      h("section", { class: "home-final-wrap" }, h("div", { class: "home-inner" }, h("div", { class: "home-final" },
        h("div", {},
          h("h2", {}, "Начните с одного документа"),
          h("p", {}, "Шаблоны пока являются черновиками: практикующий юрист их ещё не проверял. Проверяйте результат перед использованием.")),
        h("a", { class: "button primary large", href: "#templates" }, "Выбрать шаблон")))));
  };
})();
