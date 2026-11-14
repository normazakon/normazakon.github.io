/* Соглашения и расписки. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, number, title, subtitle, meta, heading, clause, paragraph, item, address,
    signatureLine, personFields, partyFields, personIntro, partyIntro, signatures, personSignatures,
    placeAndDate, closingClauses, filled,
  } = root.TemplateKit;

  /* ---------- Соглашение о расторжении ---------- */

  const hasSettlement = (values) => (values.settlement || "none") === "pay";

  const termination = {
    id: "termination",
    title: "Соглашение о расторжении договора",
    category: "Соглашения и расписки",
    summary: "Расторжение договора по согласию сторон, с расчётами или без них.",
    reviewed: false,
    basis: [{ lawId: "GK", number: "450" }, { lawId: "GK", number: "452" }, { lawId: "GK", number: "453" }],
    notes: [
      "Соглашение заключается в той же форме, что и договор. Если договор удостоверен нотариусом или зарегистрирован, проверьте, что требуется для соглашения.",
      "Проверьте особые условия расторжения в самом договоре.",
    ],
    sections: [
      { title: "Место и дата", fields: [text("city", "Город", { hint: "город" }), date("date", "Дата соглашения", { hint: "дата" })] },
      { title: "Первая сторона", fields: partyFields("first", "Сторона 1") },
      { title: "Вторая сторона", fields: partyFields("second", "Сторона 2") },
      {
        title: "Расторгаемый договор",
        fields: [
          text("contract_name", "Вид договора", { hint: "вид договора", help: "В родительном падеже не нужно. Например, договор оказания услуг" }),
          text("contract_number", "Номер договора", { hint: "номер", optional: true }),
          date("contract_date", "Дата договора", { hint: "дата договора" }),
          date("end_date", "Дата расторжения", { hint: "дата расторжения" }),
          select("settlement", "Расчёты", [
            { value: "none", label: "Взаимных претензий нет" },
            { value: "pay", label: "Одна сторона доплачивает другой" },
          ], { default: "none" }),
          select("payer", "Кто платит", [
            { value: "first", label: "Сторона 1", text: "Сторона 1" },
            { value: "second", label: "Сторона 2", text: "Сторона 2" },
          ], { default: "first", when: hasSettlement }),
          money("settlement_sum", "Сумма, ₽", { hint: "сумма", when: hasSettlement }),
          date("settlement_date", "Срок оплаты", { hint: "срок оплаты", when: hasSettlement }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20", first_kind: "person", first_name: "Иванов Иван Иванович", first_birth: "15.03.1985", first_passport: "0000 000000",
      first_issued: "вымышленным отделом 01.01.2015", first_address: "г. Энск, ул. Примерная, д. 1, кв. 1", second_kind: "ip", second_ip_name: "Петров Пётр Петрович",
      second_ogrnip: "000000000000000", second_inn: "000000000000", second_business_address: "г. Энск, ул. Образцовая, д. 2", contract_name: "договор оказания услуг",
      contract_number: "12", contract_date: "2026-03-01", end_date: "2026-11-30", settlement: "none",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.date, values.end_date);
      if (days !== null && days < 0) {
        return [{ level: "warning", text: "Дата расторжения раньше даты соглашения. Обязательства считаются прекращенными с момента заключения соглашения, если из него не вытекает иное.", basis: { lawId: "GK", number: "453" } }];
      }
      return [];
    },
    body: [
      title("СОГЛАШЕНИЕ"),
      subtitle("о расторжении договора"),
      meta("г. {{city}}", "{{date}}"),
      paragraph((values) => `${partyIntro("first", values)} (далее — «Сторона 1»), с одной стороны, и ${partyIntro("second", values)} (далее — «Сторона 2»), с другой стороны, вместе именуемые «Стороны», заключили настоящее соглашение о следующем.`),
      heading("Расторжение договора"),
      clause((values) => (String(values.contract_number || "").trim()
        ? "На основании пункта 1 статьи 450 Гражданского кодекса Российской Федерации Стороны расторгают заключенный между ними договор: {{contract_name}} № {{contract_number}} от {{contract_date}} (далее — «Договор»)."
        : "На основании пункта 1 статьи 450 Гражданского кодекса Российской Федерации Стороны расторгают заключенный между ними договор: {{contract_name}} от {{contract_date}} (далее — «Договор»).")),
      clause("Договор считается расторгнутым с {{end_date}}. С этой даты обязательства Сторон по Договору прекращаются."),
      heading("Расчеты"),
      clause("Стороны подтверждают, что не имеют друг к другу претензий по Договору.", (values) => !hasSettlement(values)),
      clause("{{payer}} уплачивает другой Стороне {{settlement_sum}} в срок до {{settlement_date}} включительно. После этой выплаты Стороны не имеют друг к другу претензий по Договору.", hasSettlement),
      heading("Заключительные положения"),
      clause("Соглашение вступает в силу с момента подписания Сторонами."),
      clause("Соглашение составлено в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из Сторон."),
      heading("Реквизиты и подписи Сторон"),
      signatures({ prefix: "first", role: "Сторона 1" }, { prefix: "second", role: "Сторона 2" }),
    ],
  };

  /* ---------- Расписка ---------- */

  const receiptHasInterest = (values) => (values.interest_mode || "free") === "percent";

  const receipt = {
    id: "receipt",
    title: "Расписка в получении займа",
    category: "Соглашения и расписки",
    summary: "Подтверждает передачу денег заемщику.",
    reviewed: false,
    basis: [{ lawId: "GK", number: "807" }, { lawId: "GK", number: "808" }, { lawId: "GK", number: "809" }, { lawId: "GK", number: "810" }],
    notes: [
      "Расписка должна удостоверять передачу денег, а не только намерение их передать.",
      "Без указания на беспроцентность заем больше 100 000 рублей считается процентным.",
    ],
    sections: [
      { title: "Место и дата", fields: [text("city", "Город", { hint: "город" }), date("date", "Дата расписки", { hint: "дата" })] },
      { title: "Заемщик", fields: personFields("borrower") },
      { title: "Займодавец", fields: personFields("lender") },
      {
        title: "Условия",
        fields: [
          money("amount", "Полученная сумма, ₽", { hint: "сумма" }),
          date("return_date", "Вернуть до", { hint: "срок возврата" }),
          select("interest_mode", "Проценты", [
            { value: "free", label: "Беспроцентный заем" },
            { value: "percent", label: "С процентами" },
          ], { default: "free" }),
          text("rate", "Ставка, % годовых", { hint: "ставка", when: receiptHasInterest }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20", borrower_name: "Петров Пётр Петрович", borrower_birth: "20.06.1988", borrower_passport: "0000 000002",
      borrower_issued: "вымышленным отделом 11.11.2016", borrower_address: "г. Энск, ул. Образцовая, д. 5", lender_name: "Иванов Иван Иванович",
      lender_birth: "15.03.1985", lender_passport: "0000 000000", lender_issued: "вымышленным отделом 01.01.2015",
      lender_address: "г. Энск, ул. Примерная, д. 1, кв. 1", amount: "300 000", return_date: "2027-05-20", interest_mode: "free",
    },
    checks: () => [],
    body: [
      title("РАСПИСКА"),
      meta("г. {{city}}", "{{date}}"),
      paragraph(() => `Я, ${personIntro("borrower")}, подтверждаю получение денег в заем в сумме {{amount}}.`),
      paragraph(() => `Займодавец: ${personIntro("lender")}.`),
      paragraph("Деньги получены полностью в день составления расписки."),
      paragraph("Обязуюсь вернуть указанную сумму в срок до {{return_date}} включительно."),
      paragraph("Заем является беспроцентным.", (values) => !receiptHasInterest(values)),
      paragraph("За пользование займом обязуюсь уплатить проценты по ставке {{rate}}% годовых.", receiptHasInterest),
      { type: "signatureLine", text: "{{borrower_name}}" },
    ],
  };

  root.TEMPLATES.push(termination, receipt);
})(typeof window !== "undefined" ? window : globalThis);
