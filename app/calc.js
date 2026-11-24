/* Раздел расчётов: процессуальные сроки, государственная пошлина, проценты по статье 395 ГК РФ, неустойка,
   компенсация за задержку зарплаты, пени за ЖКУ, отпускные. */
(function () {
  "use strict";

  const { h, showArticle } = window.UI;
  const { parseMoney, kopecksText, parseDate } = window.Russian;
  const { interest395, penalty, salaryCompensation, utilityPenalty, vacationPay, alimonyAmount, alimonyPenalty, deductionRefund, rateOn, CalculationError, MORATORIUM } = window.Calculators;
  const Fees = window.CourtFees;

  const rubles = (kopecks) => (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dots = (iso) => iso.split("-").reverse().join(".");
  const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  /** Показывает результат расчета; пропускает пустые части (условные блоки вида `условие && h(...)`), чтобы не появлялось «false». */
  function fill(target, ...parts) {
    target.replaceChildren(...parts.flat().filter((part) => part !== false && part !== null && part !== undefined && part !== ""));
  }

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

  // иконка и оттенок карточек расчётов, по id карточки
  const CARD_LOOK = {
    deadline: ["clock", "amber"], fee: ["court", "violet"], interest: ["percent", "green"], penalty: ["calc", "orange"],
    salary: ["briefcase", "blue"], utility: ["building", "teal"], vacation: ["calc", "rose"],
    alimony: ["user", "violet"], deduction: ["percent", "amber"],
  };

  /** Предупреждение, если ставка после последней известной даты взята по последнему известному значению. */
  function extendedNote(extendedFrom) {
    if (!extendedFrom) return null;
    const last = window.KEY_RATES.changes[window.KEY_RATES.changes.length - 1][1];
    return h("p", { class: "calc-warning" }, `Ключевая ставка в базе известна по ${dots(window.KEY_RATES.lastDate)}. С ${dots(extendedFrom)} расчет идет по последней известной ставке ${String(last).replace(".", ",")} %: если Банк России ее менял, пересчитайте этот период.`);
  }

  /** Таблица периодов по ставкам: период, дни, ставка, сумма. */
  function periodsTable(rows) {
    return h("div", { class: "calc-table-wrap" }, h("table", { class: "calc-table" },
      h("thead", {}, h("tr", {}, ["Период", "Дней", "Ставка", "Сумма"].map((name) => h("th", { scope: "col" }, name)))),
      h("tbody", {}, rows.map((row) => h("tr", {},
        h("td", {}, `${dots(row.from)}–${dots(row.to)}`), h("td", {}, String(row.days)),
        h("td", {}, `${String(row.rate).replace(".", ",")}%`), h("td", {}, rubles(row.amount)))))));
  }

  function card(title, basis, fields, result) {
    return h("section", { class: "calc-card" }, h("div", { class: "calc-card-head" }, h("span", { class: "tone-plate" }), h("h2", {}, title)), h("p", { class: "calc-basis" }, basis), h("div", { class: "calc-fields" }, fields), result);
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
        fill(result, h("p", {}, "Введите цену иска цифрами."));
        return;
      }
      const arbitration = court.value === "arbitration";
      const order = kind.value === "order";
      const fee = arbitration
        ? (order ? Fees.arbitrationOrderFee(kopecks) : Fees.arbitrationClaimFee(kopecks))
        : (order ? Fees.courtOrderFee(kopecks) : Fees.claimFee(kopecks));
      const notes = [];
      if (order && !arbitration && kopecks > Fees.COURT_ORDER_PRICE_LIMIT) notes.push("Судебный приказ в суде общей юрисдикции выносится при сумме не более 500 000 рублей.");
      fill(result, 
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
        fill(result, h("p", {}, "Введите сумму долга и даты просрочки."));
        return;
      }
      try {
        const calc = interest395(kopecks, from.value, to.value, window.KEY_RATES, { extend: true });
        lastText = [
          `Расчет процентов по статье 395 ГК РФ на сумму ${rubles(kopecks)} руб.`,
          "Период\tДней\tСтавка\tДней в году\tПроценты",
          ...calc.rows.map((row) => `${dots(row.from)}–${dots(row.to)}\t${row.days}\t${String(row.rate).replace(".", ",")}%\t${row.basis}\t${rubles(row.amount)}`),
          `Итого за ${calc.days} дн.: ${rubles(calc.total)} руб.`,
        ].join("\n");
        fill(result, 
          h("span", { class: "calc-total" }, `${rubles(calc.total)} ₽`),
          h("p", {}, `за ${calc.days} дн. просрочки`),
          extendedNote(calc.extendedFrom),
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
        fill(result, h("p", { class: "calc-error" }, error.message));
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
        fill(result, h("p", {}, "Введите сумму, процент и даты."));
        return;
      }
      const consumerCap = preset.value ? kopecks : 0;
      const limit = parseMoney(cap.value) || consumerCap;
      try {
        const calc = penalty(kopecks, rate, from.value, to.value, limit);
        fill(result, 
          h("span", { class: "calc-total" }, `${rubles(calc.total)} ₽`),
          h("p", {}, `${rubles(kopecks)} × ${String(rate).replace(".", ",")}% × ${calc.days} дн. = ${rubles(calc.full)} ₽`),
          calc.limited && h("p", {}, preset.value && !parseMoney(cap.value)
            ? "Сумма ограничена ценой товара или услуги, как требует закон."
            : "Сумма ограничена указанным пределом."),
          h("p", {}, "Суд может уменьшить явно несоразмерную неустойку по статье 333 ГК РФ."));
      } catch (error) {
        if (!(error instanceof CalculationError)) throw error;
        fill(result, h("p", { class: "calc-error" }, error.message));
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

  /* ---------- Компенсация за задержку зарплаты ---------- */

  function salaryCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const sum = textInput("sal-sum", "например, 60 000", update);
    const due = dateInput("sal-due", update);
    const paid = dateInput("sal-paid", update);

    function update() {
      const kopecks = parseMoney(sum.value);
      if (kopecks === null || !parseDate(due.value) || !parseDate(paid.value)) {
        fill(result, h("p", {}, "Введите сумму и даты."));
        return;
      }
      try {
        const calc = salaryCompensation(kopecks, due.value, paid.value, window.KEY_RATES, { extend: true });
        fill(result, 
          h("span", { class: "calc-total" }, `${rubles(calc.total)} ₽`),
          h("p", {}, `за ${calc.days} дн. задержки, ${kopecksText(calc.total)}`),
          extendedNote(calc.extendedFrom),
          periodsTable(calc.rows),
          h("p", {}, "Это минимальный размер: коллективный или трудовой договор может установить больше."));
      } catch (error) {
        if (!(error instanceof CalculationError)) throw error;
        fill(result, h("p", { class: "calc-error" }, error.message));
      }
    }

    update();
    return card("Компенсация за задержку зарплаты",
      h("span", {}, "1/150 ключевой ставки за каждый день, ", basisLink("TK", "236", "ст. 236 ТК РФ")),
      [
        field("sal-sum", "Невыплаченная сумма, ₽", sum, "Зарплата, отпускные или выплаты при увольнении после удержания НДФЛ"),
        field("sal-due", "Когда должны были выплатить", due),
        field("sal-paid", "День выплаты", paid, "Или дата, на которую считаете"),
      ],
      result);
  }

  /* ---------- Пени за ЖКУ ---------- */

  function utilityCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const sum = textInput("utl-sum", "например, 10 000", update);
    const due = dateInput("utl-due", update);
    const paid = dateInput("utl-paid", update);
    const rate = textInput("utl-rate", "по ключевой ставке", update);

    function update() {
      const kopecks = parseMoney(sum.value);
      if (kopecks === null || !parseDate(due.value) || !parseDate(paid.value)) {
        fill(result, h("p", {}, "Введите сумму долга и даты."));
        return;
      }
      // ставка рефинансирования с 2016 года равна ключевой; берется на день фактической оплаты
      const own = Number(String(rate.value).replace(",", "."));
      const known = paid.value <= window.KEY_RATES.lastDate;
      const percent = own > 0 ? own : rateOn(known ? paid.value : window.KEY_RATES.lastDate, window.KEY_RATES.changes);
      try {
        const calc = utilityPenalty(kopecks, due.value, paid.value, percent);
        const rows = [
          [`1–${calc.free}-й день`, `${calc.free}`, "—", rubles(0)],
          calc.first ? [`с ${dots(calc.firstFrom)}`, String(calc.first), "1/300", rubles(calc.firstAmount)] : null,
          calc.second ? [`с ${dots(calc.secondFrom)}`, String(calc.second), "1/130", rubles(calc.secondAmount)] : null,
        ].filter(Boolean);
        fill(result, 
          h("span", { class: "calc-total" }, `${rubles(calc.total)} ₽`),
          h("p", {}, `${calc.overdue} дн. просрочки, ставка ${String(percent).replace(".", ",")} %`),
          !own && !known && h("p", { class: "calc-warning" }, `Ключевая ставка в базе известна по ${dots(window.KEY_RATES.lastDate)}: взята последняя известная. Если на день оплаты ставка другая, укажите ее в поле «Ставка».`),
          h("div", { class: "calc-table-wrap" }, h("table", { class: "calc-table" },
            h("thead", {}, h("tr", {}, ["Дни просрочки", "Дней", "Доля ставки", "Пени"].map((name) => h("th", { scope: "col" }, name)))),
            h("tbody", {}, rows.map((row) => h("tr", {}, row.map((cell) => h("td", {}, cell))))))),
          h("p", {}, "Первые 30 дней просрочки пени не начисляются. Правительство может временно ограничивать ставку для расчета пеней (так было с 2022 года): проверьте, действует ли ограничение на день оплаты."));
      } catch (error) {
        if (!(error instanceof CalculationError)) throw error;
        fill(result, h("p", { class: "calc-error" }, error.message));
      }
    }

    update();
    return card("Пени за жилье и коммунальные услуги",
      h("span", {}, "1/300 ставки с 31-го дня, 1/130 с 91-го, ", basisLink("JK", "155", "ч. 14 ст. 155 ЖК РФ")),
      [
        field("utl-sum", "Долг, ₽", sum),
        field("utl-due", "Последний день срока оплаты", due, "Обычно 10-е число месяца, следующего за расчетным"),
        field("utl-paid", "День оплаты", paid, "Или дата, на которую считаете"),
        field("utl-rate", "Ставка, %", rate, "Пусто — ключевая ставка на день оплаты"),
      ],
      result);
  }

  /* ---------- Отпускные ---------- */

  function vacationCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const earnings = textInput("vac-earn", "например, 720 000", update);
    const months = h("input", { id: "vac-months", type: "number", min: "1", max: "12", step: "1", value: "12", inputMode: "numeric", onInput: update });
    const days = h("input", { id: "vac-days", type: "number", min: "1", step: "1", value: "28", inputMode: "numeric", onInput: update });

    function update() {
      const kopecks = parseMoney(earnings.value);
      if (kopecks === null) {
        fill(result, h("p", {}, "Введите зарплату за расчетный период."));
        return;
      }
      try {
        const calc = vacationPay(kopecks, Number(months.value), Number(days.value));
        fill(result, 
          h("span", { class: "calc-total" }, `${rubles(calc.total)} ₽`),
          h("p", {}, `Средний дневной заработок ${rubles(calc.daily)} ₽ × ${calc.days} дн.`),
          h("p", {}, "Сумма до удержания НДФЛ. Если в каком-то месяце были больничный, отпуск или командировка, этот месяц считается неполным: дни в нем учитываются по особым правилам, и средний заработок будет точнее у работодателя."));
      } catch (error) {
        if (!(error instanceof CalculationError)) throw error;
        fill(result, h("p", { class: "calc-error" }, error.message));
      }
    }

    update();
    return card("Отпускные и компенсация за отпуск",
      h("span", {}, "Средний дневной заработок: зарплата ÷ месяцы ÷ 29,3, ", basisLink("TK", "139", "ст. 139 ТК РФ")),
      [
        field("vac-earn", "Зарплата за расчетный период, ₽", earnings, "Начисленная за 12 месяцев до отпуска, до удержания НДФЛ"),
        field("vac-months", "Полностью отработанных месяцев", months),
        field("vac-days", "Дней отпуска или неиспользованного отпуска", days),
      ],
      result);
  }

  /* ---------- Алименты ---------- */

  function alimonyCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const income = textInput("ali-income", "например, 80 000", update);
    const children = selectInput("ali-children", [["1", "Один ребенок — 1/4"], ["2", "Двое детей — 1/3"], ["3", "Трое и больше — 1/2"]], update);
    const debt = textInput("ali-debt", "не обязательно", update);
    const from = dateInput("ali-from", update);
    const to = dateInput("ali-to", update);

    function update() {
      const parts = [];
      const kopecks = parseMoney(income.value);
      if (kopecks) {
        const calc = alimonyAmount(kopecks, Number(children.value));
        parts.push(h("span", { class: "calc-total" }, `${rubles(calc.monthly)} ₽ в месяц`), h("p", {}, `${calc.share} дохода, ${kopecksText(calc.monthly)}`));
      } else {
        parts.push(h("p", {}, "Введите доход, чтобы посчитать алименты."));
      }
      const owed = parseMoney(debt.value);
      if (owed && parseDate(from.value) && parseDate(to.value)) {
        try {
          const late = alimonyPenalty(owed, from.value, to.value);
          parts.push(h("p", { class: "calc-subtotal" }, `Неустойка за просрочку: ${rubles(late.total)} ₽`),
            h("p", {}, `${rubles(owed)} × 0,1 % × ${late.days} дн. Суд может ее уменьшить, если она явно несоразмерна.`));
        } catch (error) {
          if (!(error instanceof CalculationError)) throw error;
          parts.push(h("p", { class: "calc-error" }, error.message));
        }
      }
      parts.push(h("p", {}, "Алименты удерживают из заработка и иного дохода после удержания НДФЛ. Неустойка 0,1 % в день положена, если алименты взысканы судом; по соглашению — как в нем указано."));
      fill(result, parts);
    }

    update();
    return card("Алименты на детей",
      h("span", {}, "Доля дохода по ", basisLink("SK", "81", "ст. 81 СК РФ"), ", неустойка по ", basisLink("SK", "115", "ст. 115 СК РФ")),
      [
        field("ali-income", "Доход в месяц, ₽", income, "Заработок и иной доход после удержания НДФЛ"),
        field("ali-children", "Сколько детей", children),
        field("ali-debt", "Долг по алиментам, ₽", debt, "Для расчета неустойки за просрочку"),
        field("ali-from", "Первый день просрочки", from),
        field("ali-to", "Последний день", to),
      ],
      result);
  }

  /* ---------- Налоговый вычет ---------- */

  const DEDUCTION_KINDS = [
    ["property", "Покупка или строительство жилья — до 2 млн ₽"],
    ["mortgage", "Проценты по ипотеке — до 3 млн ₽"],
    ["social", "Лечение, свое обучение, спорт — до 150 тыс. ₽ в год"],
    ["childEducation", "Обучение детей — до 110 тыс. ₽ на ребенка"],
    ["expensiveTreatment", "Дорогостоящее лечение — без предела"],
  ];

  function deductionCard() {
    const result = h("div", { class: "calc-result", role: "status" });
    const kind = selectInput("ded-kind", DEDUCTION_KINDS, () => { childrenField.hidden = kind.value !== "childEducation"; update(); });
    const expenses = textInput("ded-sum", "например, 6 500 000", update);
    const children = h("input", { id: "ded-children", type: "number", min: "1", step: "1", value: "1", inputMode: "numeric", onInput: update });
    const childrenField = field("ded-children", "Сколько детей учились", children);
    childrenField.hidden = true;
    const taxPaid = textInput("ded-tax", "не обязательно", update);
    const rate = selectInput("ded-rate", [["13", "13 % — доход до 2,4 млн ₽ в год"], ["15", "15 % — доход от 2,4 до 5 млн ₽"]], update);

    function update() {
      const kopecks = parseMoney(expenses.value);
      if (!kopecks) {
        fill(result, h("p", {}, "Введите сумму расходов."));
        return;
      }
      try {
        const calc = deductionRefund(kind.value, kopecks, { children: Number(children.value) || 1, rate: Number(rate.value), taxPaid: parseMoney(taxPaid.value) || 0 });
        fill(result,
          h("span", { class: "calc-total" }, `${rubles(calc.refund)} ₽`),
          h("p", {}, `вернут с вычета ${rubles(calc.deduction)} ₽${calc.limited ? " (расходы больше предела)" : ""}`),
          calc.rest > 0 && h("p", { class: "calc-warning" }, calc.carry
            ? `За этот год вернут ${rubles(calc.thisYear)} ₽ — не больше удержанного налога. Остаток ${rubles(calc.rest)} ₽ переносится на следующие годы.`
            : `За этот год вернут только ${rubles(calc.thisYear)} ₽ — не больше удержанного налога. Остаток ${rubles(calc.rest)} ₽ на следующие годы не переносится.`),
          h("p", {}, "Вычет получают через налоговую по декларации 3-НДФЛ или у работодателя. Социальные вычеты — за три последних года, имущественный за жилье — один раз в жизни, остаток предела переносится на другое жилье."));
      } catch (error) {
        if (!(error instanceof CalculationError)) throw error;
        fill(result, h("p", { class: "calc-error" }, error.message));
      }
    }

    update();
    return card("Налоговый вычет",
      h("span", {}, "Сколько НДФЛ вернут: ", basisLink("NK", "220", "ст. 220"), " и ", basisLink("NK", "219", "ст. 219 НК РФ")),
      [
        field("ded-kind", "Вид вычета", kind),
        field("ded-sum", "Расходы, ₽", expenses),
        childrenField,
        field("ded-tax", "НДФЛ, удержанный за год, ₽", taxPaid, "Из справки о доходах: больше него за год не вернут"),
        field("ded-rate", "Ставка НДФЛ", rate),
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
        fill(result, h("p", {}, "Укажите дату события."));
        return;
      }
      let calc;
      try {
        calc = D.compute(input, calendar);
      } catch (error) {
        if (!(error instanceof D.DeadlineError)) throw error;
        fill(result, h("p", { class: "calc-error" }, error.message));
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
      fill(result, ...parts.filter(Boolean));
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
  window.Views.calc = function (root, params = {}) {
    const cards = {
      deadline: deadlineCard(), fee: feeCard(), interest: interestCard(), penalty: penaltyCard(),
      salary: salaryCard(), utility: utilityCard(), vacation: vacationCard(),
      alimony: alimonyCard(), deduction: deductionCard(),
    };
    for (const [id, element] of Object.entries(cards)) {
      element.id = `calc-${id}`;
      const [iconName, tone] = CARD_LOOK[id];
      element.classList.add(`tone-${tone}`);
      element.querySelector(".calc-card-head .tone-plate").append(window.UI.icon(iconName));
    }
    root.append(
      h("div", { class: "page-head" }, h("div", {},
        h("h1", {}, "Расчёты"),
        h("p", {}, "Последний день срока, госпошлина, проценты и неустойка, компенсация за задержку зарплаты, пени за ЖКУ, отпускные, алименты и налоговые вычеты. Расчёт идёт по правилам закона, но результат верен, только если верны ваши даты и суммы."))),
      // девять карточек: на телефоне до нужной далеко листать, поэтому сверху — переход к каждой
      h("nav", { class: "calc-jump", "aria-label": "Перейти к расчету" }, Object.entries(cards).map(([id, element]) =>
        h("button", { class: "chip", type: "button", onClick: () => element.scrollIntoView({ block: "start", behavior: "smooth" }) },
          element.querySelector("h2").textContent))),
      h("div", { class: "calc-grid" }, Object.values(cards)));
    // #calc/fee из поиска на главной сразу показывает нужный расчёт
    const target = cards[params.card];
    if (target) {
      target.classList.add("calc-card-target");
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
    }
  };
})();
