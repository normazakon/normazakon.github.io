/* Раздел расчётов: процессуальные сроки, государственная пошлина, проценты по статье 395 ГК РФ, неустойка. */
(function () {
  "use strict";

  const { h, showArticle } = window.UI;
  const { parseMoney, kopecksText, parseDate } = window.Russian;
  const { interest395, penalty, CalculationError, MORATORIUM } = window.Calculators;
  const Fees = window.CourtFees;

  const rubles = (kopecks) => (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dots = (iso) => iso.split("-").reverse().join(".");
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  function field(id, label, input, help) {
    return h("div", { class: "field" }, h("label", { htmlFor: id }, label), input, help && h("span", { class: "field-help" }, help));
  }

  function textInput(id, placeholder, onInput) {
    return h("input", { id, type: "text", inputMode: "decimal", autocomplete: "off", placeholder, onInput });
  }

  function dateInput(id, onInput) {
    return h("input", { id, type: "date", onInput });
  }

  function selectInput(id, options, onChange) {
    return h("select", { id, onChange }, options.map(([value, label]) => h("option", { value }, label)));
  }

  function basisLink(lawId, number, text) {
    return h("button", { class: "link-button", type: "button", onClick: () => showArticle(lawId, number) }, text);
  }

  function card(title, basis, fields, result) {
    return h("section", { class: "calc-card" }, h("h2", {}, title), h("p", { class: "calc-basis" }, basis), h("div", { class: "calc-fields" }, fields), result);
  }

  /* ---------- Пошлина ---------- */

  function feeCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const court = selectInput("fee-court", [
      ["general", "Суд общей юрисдикции или мировой судья"],
      ["arbitration", "Арбитражный суд"],
    ], update);
    const kind = selectInput("fee-kind", [["claim", "Исковое заявление"], ["order", "Заявление о судебном приказе"]], update);
    const price = textInput("fee-price", "например, 324 500", update);

    function update() {
      const kopecks = parseMoney(price.value);
      if (kopecks === null || kopecks === 0) {
        result.replaceChildren(h("p", {}, "Введите цену иска цифрами."));
        return;
      }
      const arbitration = court.value === "arbitration";
      const order = kind.value === "order";
      const fee = arbitration
        ? (order ? Fees.arbitrationOrderFee(kopecks) : Fees.arbitrationClaimFee(kopecks))
        : (order ? Fees.courtOrderFee(kopecks) : Fees.claimFee(kopecks));
      const notes = [];
      if (order && !arbitration && kopecks > Fees.COURT_ORDER_PRICE_LIMIT) notes.push("Судебный приказ в суде общей юрисдикции выносится при сумме не более 500 000 рублей.");
      result.replaceChildren(
        h("span", { class: "calc-total" }, `${rubles(fee)} ₽`),
        h("p", {}, kopecksText(fee)),
        h("p", {}, "Перед оплатой проверьте льготы по статье 333.36 НК РФ: например, потребители и работники по ряду исков освобождены от пошлины."),
        notes.map((note) => h("p", { class: "calc-error" }, note)));
    }

    update();
    return card("Государственная пошлина",
      h("span", {}, "По шкалам ", basisLink("NK", "333.19", "ст. 333.19"), " и ", basisLink("NK", "333.21", "ст. 333.21 НК РФ")),
      [field("fee-court", "Суд", court), field("fee-kind", "Что подаётся", kind), field("fee-price", "Цена иска, ₽", price)],
      result);
  }

  /* ---------- Проценты по 395 ---------- */

  function interestCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const sum = textInput("int-sum", "например, 300 000", update);
    const from = dateInput("int-from", update);
    const to = dateInput("int-to", update);
    let lastText = "";

    function update() {
      const kopecks = parseMoney(sum.value);
      if (kopecks === null || !parseDate(from.value) || !parseDate(to.value)) {
        result.replaceChildren(h("p", {}, "Введите сумму долга и даты просрочки."));
        return;
      }
      try {
        const calc = interest395(kopecks, from.value, to.value, window.KEY_RATES);
        lastText = [
          `Расчет процентов по статье 395 ГК РФ на сумму ${rubles(kopecks)} руб.`,
          "Период\tДней\tСтавка\tДней в году\tПроценты",
          ...calc.rows.map((row) => `${dots(row.from)}–${dots(row.to)}\t${row.days}\t${String(row.rate).replace(".", ",")}%\t${row.basis}\t${rubles(row.amount)}`),
          `Итого за ${calc.days} дн.: ${rubles(calc.total)} руб.`,
        ].join("\n");
        result.replaceChildren(
          h("span", { class: "calc-total" }, `${rubles(calc.total)} ₽`),
          h("p", {}, `за ${calc.days} дн. просрочки`),
          calc.overlapsMoratorium && h("p", { class: "calc-warning" }, `Период пересекается с ${dots(MORATORIUM.from)}–${dots(MORATORIUM.to)}. Проверьте, распространяется ли на должника мораторий по постановлению Правительства РФ от 28.03.2022 № 497: в этот период проценты могут не начисляться.`),
          h("div", { class: "calc-table-wrap" }, h("table", { class: "calc-table" },
            h("thead", {}, h("tr", {}, ["Период", "Дней", "Ставка", "Проценты"].map((name) => h("th", { scope: "col" }, name)))),
            h("tbody", {}, calc.rows.map((row) => h("tr", {},
              h("td", {}, `${dots(row.from)}–${dots(row.to)}`), h("td", {}, String(row.days)),
              h("td", {}, `${String(row.rate).replace(".", ",")}%`), h("td", {}, rubles(row.amount))))))),
          h("button", { class: "button small", type: "button", onClick: copy }, window.UI.icon("copy"), "Скопировать расчёт"),
          h("p", { id: "int-copied" }));
      } catch (error) {
        if (!(error instanceof CalculationError)) throw error;
        result.replaceChildren(h("p", { class: "calc-error" }, error.message));
      }
    }

    async function copy() {
      const note = document.getElementById("int-copied");
      try {
        await navigator.clipboard.writeText(lastText);
        note.textContent = "Расчёт скопирован, его можно вставить в приложение к иску.";
      } catch {
        note.textContent = "Браузер не разрешил копирование.";
      }
    }

    update();
    const updated = dots(window.KEY_RATES.lastDate);
    return card("Проценты за пользование чужими деньгами",
      h("span", {}, basisLink("GK", "395", "Ст. 395 ГК РФ"), `, ключевая ставка Банка России по ${updated}`),
      [
        field("int-sum", "Сумма долга, ₽", sum),
        field("int-from", "Первый день просрочки", from, "Обычно день, следующий за последним днем срока оплаты"),
        field("int-to", "Последний день", to, "День оплаты или дата, на которую считаете"),
      ],
      result);
  }

  /* ---------- Неустойка ---------- */

  const PRESETS = [
    ["", "Свой процент"],
    ["1", "1% в день: просрочка продавца, ст. 23 ЗоЗПП"],
    ["3", "3% в день: просрочка исполнителя, ст. 28 ЗоЗПП"],
  ];

  function penaltyCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const preset = selectInput("pen-preset", PRESETS, () => { if (preset.value) percent.value = preset.value; update(); });
    const base = textInput("pen-base", "например, 80 000", update);
    const percent = textInput("pen-percent", "например, 0,1", update);
    const from = dateInput("pen-from", update);
    const to = dateInput("pen-to", update);
    const cap = textInput("pen-cap", "не обязательно", update);

    function update() {
      const kopecks = parseMoney(base.value);
      const rate = Number(String(percent.value).replace(",", "."));
      if (kopecks === null || !rate || !parseDate(from.value) || !parseDate(to.value)) {
        result.replaceChildren(h("p", {}, "Введите сумму, процент и даты."));
        return;
      }
      const consumerCap = preset.value ? kopecks : 0;
      const limit = parseMoney(cap.value) || consumerCap;
      try {
        const calc = penalty(kopecks, rate, from.value, to.value, limit);
        result.replaceChildren(
          h("span", { class: "calc-total" }, `${rubles(calc.total)} ₽`),
          h("p", {}, `${rubles(kopecks)} × ${String(rate).replace(".", ",")}% × ${calc.days} дн. = ${rubles(calc.full)} ₽`),
          calc.limited && h("p", {}, preset.value && !parseMoney(cap.value)
            ? "Сумма ограничена ценой товара или услуги, как требует закон."
            : "Сумма ограничена указанным пределом."),
          h("p", {}, "Суд может уменьшить явно несоразмерную неустойку по статье 333 ГК РФ."));
      } catch (error) {
        if (!(error instanceof CalculationError)) throw error;
        result.replaceChildren(h("p", { class: "calc-error" }, error.message));
      }
    }

    update();
    return card("Неустойка",
      h("span", {}, "Договорная или законная, ", basisLink("GK", "330", "ст. 330"), " и ", basisLink("GK", "333", "ст. 333 ГК РФ")),
      [
        field("pen-preset", "Вид неустойки", preset),
        field("pen-base", "Сумма, на которую начисляется, ₽", base, "Для закона о защите прав потребителей это цена товара или услуги"),
        field("pen-percent", "Процент в день", percent),
        field("pen-from", "Первый день просрочки", from),
        field("pen-to", "Последний день", to),
        field("pen-cap", "Предел, ₽", cap, "Если договор или закон ограничивает сумму"),
      ],
      result);
  }

  /* ---------- Процессуальные сроки ---------- */

  function deadlineCard() {
    const D = window.Deadlines;
    const calendar = window.WORK_CALENDAR;
    const result = h("div", { class: "calc-result", role: "status" });
    const preset = selectInput("dl-preset", [...D.PRESETS.map((item) => [item.id, item.name]), ["custom", "Свой срок"]], () => { syncCustom(); update(); });
    const regime = selectInput("dl-regime", Object.entries(D.REGIMES).map(([id, item]) => [id, item.name]), () => { syncUnits(); update(); });
    const amount = h("input", { id: "dl-amount", type: "number", min: "1", max: "3650", step: "1", value: "10", inputMode: "numeric", onInput: update });
    const unit = selectInput("dl-unit", [], update);
    const start = dateInput("dl-start", update);
    const startLabel = h("label", { htmlFor: "dl-start" });
    const customFields = h("div", { class: "calc-subfields", hidden: true },
      field("dl-regime", "По какому кодексу", regime),
      field("dl-amount", "Срок", amount),
      field("dl-unit", "В чём исчисляется", unit));

    const UNIT_NAMES = { days: "дни", sutki: "сутки", weeks: "недели", months: "месяцы", years: "годы" };
    function syncUnits() {
      const current = unit.value;
      unit.replaceChildren(...D.REGIMES[regime.value].units.map((value) => h("option", { value }, UNIT_NAMES[value])));
      if (D.REGIMES[regime.value].units.includes(current)) unit.value = current;
    }
    function chosen() {
      return D.PRESETS.find((item) => item.id === preset.value) || null;
    }
    function syncCustom() {
      const item = chosen();
      customFields.hidden = Boolean(item);
      startLabel.textContent = item ? item.from : "Дата события, от которого считается срок";
    }

    function update() {
      const item = chosen();
      const input = item
        ? { regime: item.regime, amount: item.amount, unit: item.unit, start: start.value }
        : { regime: regime.value, amount: Number(amount.value), unit: unit.value, start: start.value };
      if (!start.value) {
        result.replaceChildren(h("p", {}, "Укажите дату события."));
        return;
      }
      let calc;
      try {
        calc = D.compute(input, calendar);
      } catch (error) {
        if (!(error instanceof D.DeadlineError)) throw error;
        result.replaceChildren(h("p", { class: "calc-error" }, error.message));
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const left = Math.round((Date.parse(calc.end) - Date.parse(today)) / 86400000);
      const status = left < 0 ? "Срок истёк" : left === 0 ? "Сегодня последний день" : `Осталось ${D.describeAmount(left, "days")}`;
      const regimeBasis = calc.regime.basis.flatMap(([lawId, number], index) => [index ? ", " : "", basisLink(lawId, number, `ст. ${number}`)]);
      const law = (lawId) => window.LAW_BASE.laws[lawId].short;
      const parts = [
        h("span", { class: "calc-total" }, `до ${D.format(calc.end)} включительно`),
        h("p", { class: left < 0 ? "calc-error" : "" },
          `${capitalize(D.WEEKDAY_NAMES[new Date(`${calc.end}T00:00:00Z`).getUTCDay()])}. Срок ${D.describeAmount(input.amount, input.unit)}. ${status}.`),
        h("ol", { class: "calc-steps" }, calc.steps.map((step) => h("li", {}, step))),
        calc.unknownYears.length > 0 ? h("p", { class: "calc-error" },
          `Переносов выходных на ${calc.unknownYears.join(" и ")} год в календаре нет: учтены только выходные и праздники из статьи 112 ТК РФ. Проверьте дату по постановлению Правительства о переносе выходных дней.`) : null,
        h("p", { class: "calc-basis" }, "Порядок исчисления: ", ...regimeBasis, ` ${law(input.regime)}.`,
          ...(item ? [" Срок: ", basisLink(item.basis[0], item.basis[1], `ст. ${item.basis[1]} ${law(item.basis[0])}`), "."] : [])),
      ];
      result.replaceChildren(...parts.filter(Boolean));
    }

    syncUnits();
    syncCustom();
    update();
    const years = Object.keys(calendar.years);
    return card("Процессуальные сроки",
      h("span", {}, `По правилам кодексов и производственному календарю на ${years[0]}–${years[years.length - 1]} годы`),
      [field("dl-preset", "Что подаётся", preset), customFields, h("div", { class: "field" }, startLabel, start)],
      result);
  }

  window.Views = window.Views || {};
  window.Views.calc = function (root) {
    root.append(
      h("div", { class: "page-head" }, h("div", {},
        h("h1", {}, "Расчёты"),
        h("p", {}, "Узнайте последний день срока, размер госпошлины, проценты за просрочку и неустойку. Расчёт идёт по правилам закона, но результат верен, только если верны ваши даты и суммы."))),
      h("div", { class: "calc-grid" }, deadlineCard(), feeCard(), interestCard(), penaltyCard()));
  };
})();
