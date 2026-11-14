/* Акты. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, title, subtitle, meta, heading, clause, paragraph,
    partyFields, partyIntro, signatures, filled,
  } = root.TemplateKit;

  const hasRemarks = (values) => (values.result || "ok") === "remarks";

  const contractReference = (values) => (filled("contract_number")(values)
    ? "{{contract_name}} № {{contract_number}} от {{contract_date}}"
    : "{{contract_name}} от {{contract_date}}");

  /* ---------- Акт об оказании услуг или выполнении работ ---------- */

  const completion = {
    id: "completion",
    title: "Акт оказанных услуг или выполненных работ",
    category: "Акты",
    summary: "Подтверждает сдачу результата по договору. Можно записать замечания заказчика.",
    reviewed: false,
    basis: [{ lawId: "GK", number: "720" }, { lawId: "GK", number: "723" }, { lawId: "GK", number: "783" }],
    notes: [
      "Заказчик, принявший работу без проверки, теряет право ссылаться на явные недостатки. Осмотрите результат до подписания.",
      "Если есть замечания, запишите их в акте: на недостатки, обнаруженные при приемке, можно ссылаться, когда они в нем оговорены.",
    ],
    sections: [
      {
        title: "Договор",
        fields: [
          text("city", "Город", { hint: "город" }),
          date("date", "Дата акта", { hint: "дата" }),
          text("contract_name", "Вид договора", { hint: "вид договора", default: "договор оказания услуг" }),
          text("contract_number", "Номер договора", { hint: "номер", optional: true }),
          date("contract_date", "Дата договора", { hint: "дата договора" }),
        ],
      },
      { title: "Заказчик", fields: partyFields("customer", "Заказчик") },
      { title: "Исполнитель", fields: partyFields("contractor", "Исполнитель") },
      {
        title: "Что сдаётся",
        fields: [
          area("work", "Какие услуги или работы выполнены", { hint: "описание услуг или работ" }),
          money("price", "Стоимость, ₽", { hint: "стоимость" }),
          select("vat", "НДС", [
            { value: "none", label: "НДС не облагается" },
            { value: "included", label: "Стоимость включает НДС" },
          ], { default: "none" }),
          text("vat_rate", "Ставка НДС, %", { hint: "ставка", when: (values) => values.vat === "included" }),
          select("result", "Результат приемки", [
            { value: "ok", label: "Претензий нет" },
            { value: "remarks", label: "Есть замечания" },
          ], { default: "ok" }),
          area("remarks", "Замечания заказчика", { hint: "замечания", when: hasRemarks }),
          date("fix_date", "Устранить замечания до", { hint: "срок устранения", when: hasRemarks }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-12-04", contract_name: "договор оказания услуг", contract_number: "12", contract_date: "2026-11-20",
      customer_kind: "person", customer_name: "Иванов Иван Иванович", customer_birth: "15.03.1985", customer_passport: "0000 000000",
      customer_issued: "вымышленным отделом 01.01.2015", customer_address: "г. Энск, ул. Примерная, д. 1, кв. 1", contractor_kind: "ip",
      contractor_ip_name: "Петров Пётр Петрович", contractor_ogrnip: "000000000000000", contractor_inn: "000000000000",
      contractor_business_address: "г. Энск, ул. Образцовая, д. 2", work: "подготовка плана ремонта квартиры", price: "45 000", result: "ok",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.contract_date, values.date);
      return days !== null && days < 0 ? [{ level: "warning", text: "Дата акта раньше даты договора." }] : [];
    },
    body: [
      title("АКТ"),
      subtitle("оказанных услуг (выполненных работ)"),
      meta("г. {{city}}", "{{date}}"),
      paragraph((values) => `${partyIntro("customer", values)} (далее — «Заказчик») и ${partyIntro("contractor", values)} (далее — «Исполнитель») составили настоящий акт по договору: ${contractReference(values)} (далее — «Договор»).`),
      heading("Результат"),
      clause("Исполнитель оказал услуги (выполнил работы): {{work}}."),
      clause((values) => `Стоимость составляет {{price}}, ${values.vat === "included" ? "в том числе НДС по ставке {{vat_rate}}%" : "НДС не облагается"}.`),
      heading("Приемка"),
      clause("Заказчик принял результат и не имеет претензий по объему, качеству и срокам.", (values) => !hasRemarks(values)),
      clause("Заказчик заявил следующие замечания: {{remarks}}.", hasRemarks),
      clause("Исполнитель устраняет указанные замечания в срок до {{fix_date}} включительно.", hasRemarks),
      clause("Акт составлен в двух экземплярах, по одному для каждой из сторон."),
      heading("Подписи сторон"),
      signatures({ prefix: "customer", role: "Заказчик" }, { prefix: "contractor", role: "Исполнитель" }),
    ],
  };

  /* ---------- Акт приема-передачи ---------- */

  const transfer = {
    id: "transfer",
    title: "Акт приема-передачи имущества",
    category: "Акты",
    summary: "Фиксирует передачу вещи и ее состояние по договору.",
    reviewed: false,
    basis: [{ lawId: "GK", number: "223" }, { lawId: "GK", number: "456" }, { lawId: "GK", number: "655" }],
    notes: [
      "Опишите имущество так, чтобы его можно было однозначно определить.",
      "Для зданий и сооружений передаточный документ обязателен, уклонение от подписи считается отказом от передачи или принятия.",
    ],
    sections: [
      {
        title: "Договор",
        fields: [
          text("city", "Город", { hint: "город" }),
          date("date", "Дата акта", { hint: "дата" }),
          text("contract_name", "Вид договора", { hint: "вид договора" }),
          text("contract_number", "Номер договора", { hint: "номер", optional: true }),
          date("contract_date", "Дата договора", { hint: "дата договора" }),
        ],
      },
      { title: "Передающая сторона", fields: partyFields("sender", "Передающая сторона") },
      { title: "Принимающая сторона", fields: partyFields("receiver", "Принимающая сторона") },
      {
        title: "Имущество",
        fields: [
          area("property", "Что передаётся", { hint: "описание имущества", help: "Название, количество, серийные номера, адрес" }),
          area("condition", "Состояние", { hint: "состояние", default: "исправно, видимых повреждений нет" }),
          area("documents", "Документы и принадлежности", { hint: "документы и принадлежности", optional: true }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20", contract_name: "договор купли-продажи", contract_number: "7", contract_date: "2026-11-18", sender_kind: "person",
      sender_name: "Сидоров Семён Семёнович", sender_birth: "02.02.1980", sender_passport: "0000 000000", sender_issued: "вымышленным отделом 05.05.2010",
      sender_address: "г. Энск, ул. Примерная, д. 3", receiver_kind: "person", receiver_name: "Кузнецова Анна Павловна", receiver_birth: "07.07.1990",
      receiver_passport: "0000 000001", receiver_issued: "вымышленным отделом 09.09.2014", receiver_address: "г. Энск, ул. Образцовая, д. 4",
      property: "холодильник «Пример», серийный номер 000000", condition: "исправен, видимых повреждений нет",
    },
    checks: () => [],
    body: [
      title("АКТ"),
      subtitle("приема-передачи имущества"),
      meta("г. {{city}}", "{{date}}"),
      paragraph((values) => `${partyIntro("sender", values)} (далее — «Передающая сторона») и ${partyIntro("receiver", values)} (далее — «Принимающая сторона») составили настоящий акт по договору: ${contractReference(values)}.`),
      heading("Передача"),
      clause("Передающая сторона передала, а Принимающая сторона приняла следующее имущество: {{property}}."),
      clause("Состояние имущества на момент передачи: {{condition}}."),
      clause("Вместе с имуществом переданы: {{documents}}.", filled("documents")),
      clause("Принимающая сторона осмотрела имущество и не имеет претензий, кроме указанных в настоящем акте."),
      clause("Акт составлен в двух экземплярах, по одному для каждой из сторон."),
      heading("Подписи сторон"),
      signatures({ prefix: "sender", role: "Передала" }, { prefix: "receiver", role: "Приняла" }),
    ],
  };

  root.TEMPLATES.push(completion, transfer);
})(typeof window !== "undefined" ? window : globalThis);
