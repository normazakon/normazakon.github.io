/* Документы для судов общей юрисдикции. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, title, subtitle, paragraph, item, address, signatureLine, filled,
  } = root.TemplateKit;

  const ID_HELP = "Один из идентификаторов: СНИЛС, ИНН, серия и номер паспорта или водительского удостоверения.";
  const ID_UNKNOWN_HELP = `${ID_HELP} Если сведения об ответчике неизвестны, напишите об этом.`;

  /** Сведения о гражданине, которых требуют статьи 124 и 131 ГПК РФ. */
  function courtPerson(prefix, { other = false } = {}) {
    return [
      text(`${prefix}_name`, "ФИО", { hint: "ФИО" }),
      text(`${prefix}_birth`, "Дата и место рождения", { hint: "дата и место рождения" }),
      text(`${prefix}_address`, "Место жительства", { hint: "место жительства" }),
      text(`${prefix}_id`, "Идентификатор", { hint: "идентификатор", help: other ? ID_UNKNOWN_HELP : ID_HELP }),
      ...(other ? [text(`${prefix}_work`, "Место работы", { hint: "место работы", optional: true, help: "Если известно" })] : []),
    ];
  }

  function courtPersonLines(label, prefix) {
    return [
      address(`${label}: {{${prefix}_name}}`),
      address(`Дата и место рождения: {{${prefix}_birth}}`),
      address(`Место жительства: {{${prefix}_address}}`),
      address(`Идентификатор: {{${prefix}_id}}`),
      address(`Место работы: {{${prefix}_work}}`, filled(`${prefix}_work`)),
    ];
  }

  const sumOf = (helpers, ...values) => {
    let total = 0;
    for (const value of values) {
      if (!String(value ?? "").trim()) continue;
      const kopecks = helpers.parseMoney(value);
      if (kopecks === null) return null;
      total += kopecks;
    }
    return total;
  };

  const claimTotal = (values, helpers) => (filled("debt")(values) ? sumOf(helpers, values.debt, values.interest, values.late_interest) : null);

  /* ---------- Иск о взыскании долга по займу ---------- */

  const loanSuit = {
    id: "loan-suit",
    title: "Исковое заявление о взыскании долга по займу",
    category: "Суд",
    summary: "Иск гражданина к гражданину. Считает цену иска и государственную пошлину.",
    reviewed: false,
    basis: [
      { lawId: "GPK", number: "131" }, { lawId: "GPK", number: "132" }, { lawId: "GPK", number: "23" }, { lawId: "GPK", number: "24" }, { lawId: "GPK", number: "28" },
      { lawId: "GK", number: "807" }, { lawId: "GK", number: "810" }, { lawId: "GK", number: "811" }, { lawId: "NK", number: "333.19" },
    ],
    notes: [
      "Иск предъявляется по месту жительства ответчика, если договором не определено иное.",
      "Проценты по статье 395 ГК РФ считаются по ключевой ставке за соответствующие периоды. Приложите расчет, подписанный истцом.",
      "Пошлина рассчитана по шкале статьи 333.19 НК РФ. Перед оплатой проверьте сумму и льготы по статье 333.36 НК РФ.",
      "При цене до 500 000 рублей и письменном договоре подумайте о судебном приказе: он быстрее и дешевле, но отменяется по возражению должника.",
    ],
    sections: [
      {
        title: "Суд",
        fields: [text("court", "Суд", { hint: "наименование суда", help: "По месту жительства ответчика" })],
      },
      { title: "Истец", fields: courtPerson("plaintiff") },
      { title: "Ответчик", fields: courtPerson("defendant", { other: true }) },
      {
        title: "Заем",
        fields: [
          date("loan_date", "Дата займа", { hint: "дата займа" }),
          money("loan_sum", "Сумма займа, ₽", { hint: "сумма займа" }),
          date("return_date", "Срок возврата", { hint: "срок возврата" }),
          text("evidence", "Чем подтвержден заем", { hint: "доказательство займа", help: "Например, договор займа и расписка от 20.11.2025" }),
        ],
      },
      {
        title: "Требования",
        fields: [
          money("debt", "Невозвращенная сумма, ₽", { hint: "сумма долга" }),
          money("interest", "Проценты за пользование займом, ₽", { hint: "проценты по договору", optional: true }),
          money("late_interest", "Проценты за просрочку, ₽", { hint: "проценты за просрочку", optional: true, help: "По статьям 395 и 811 ГК РФ, если заявляются" }),
          date("demand_date", "Дата требования о возврате", { hint: "дата требования", optional: true }),
          area("attachments", "Приложения", { hint: "приложения", default: "квитанция об уплате государственной пошлины; копия договора займа и расписки; расчет взыскиваемой суммы; документы о направлении ответчику копии иска" }),
          date("suit_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    computed: {
      price: { hint: "цена иска", field: "debt", value: (values, helpers) => { const total = claimTotal(values, helpers); return total === null ? null : helpers.kopecksText(total); } },
      fee: { hint: "государственная пошлина", field: "debt", value: (values, helpers) => { const total = claimTotal(values, helpers); return total === null ? null : helpers.kopecksText(helpers.claimFee(total)); } },
    },
    example: {
      court: "Энский районный суд", plaintiff_name: "Иванов Иван Иванович", plaintiff_birth: "15.03.1985, г. Энск", plaintiff_address: "г. Энск, ул. Примерная, д. 1, кв. 1", plaintiff_id: "паспорт 0000 000000",
      defendant_name: "Петров Пётр Петрович", defendant_birth: "20.06.1988, г. Энск", defendant_address: "г. Энск, ул. Образцовая, д. 5", defendant_id: "паспорт 0000 000002",
      loan_date: "2025-11-20", loan_sum: "300 000", return_date: "2026-05-20", evidence: "договор займа и расписка от 20.11.2025", debt: "300 000", late_interest: "24 500",
      attachments: "квитанция об уплате государственной пошлины; копия договора займа и расписки; расчет взыскиваемой суммы; документы о направлении ответчику копии иска", suit_date: "2026-11-07",
    },
    checks(values, helpers) {
      const result = [];
      const total = claimTotal(values, helpers);
      if (total !== null && total > helpers.MAGISTRATE_PRICE_LIMIT) {
        result.push({ level: "info", text: "Цена иска больше 50 000 рублей: дело подсудно районному суду.", basis: { lawId: "GPK", number: "24" } });
      } else if (total !== null) {
        result.push({ level: "warning", text: "Цена иска не больше 50 000 рублей: дело подсудно мировому судье.", basis: { lawId: "GPK", number: "23" } });
      }
      if (total !== null && total <= helpers.COURT_ORDER_PRICE_LIMIT) {
        result.push({ level: "info", text: "По требованию из письменной сделки на сумму до 500 000 рублей можно подать заявление о судебном приказе.", basis: { lawId: "GPK", number: "122" } });
      }
      return result;
    },
    body: [
      address("В {{court}}"),
      ...courtPersonLines("Истец", "plaintiff"),
      ...courtPersonLines("Ответчик", "defendant"),
      address("Цена иска: {{price}}"),
      address("Государственная пошлина: {{fee}}"),
      title("ИСКОВОЕ ЗАЯВЛЕНИЕ"),
      subtitle("о взыскании долга по договору займа"),
      paragraph("{{loan_date}} истец передал ответчику в заем деньги в сумме {{loan_sum}}. Заем подтверждается: {{evidence}}. Ответчик обязался возвратить сумму займа в срок до {{return_date}}."),
      paragraph("Истец предъявил требование о возврате {{demand_date}}.", filled("demand_date")),
      paragraph("В установленный срок ответчик обязательство не исполнил. Невозвращенная сумма составляет {{debt}}."),
      paragraph("Согласно пункту 1 статьи 810 Гражданского кодекса Российской Федерации заемщик обязан возвратить займодавцу полученную сумму займа в срок и в порядке, которые предусмотрены договором. Согласно пункту 1 статьи 811 этого Кодекса на невозвращенную в срок сумму подлежат уплате проценты в размере, предусмотренном пунктом 1 статьи 395 Кодекса."),
      paragraph("Расчет цены иска приложен к настоящему заявлению. Цена иска составляет {{price}}."),
      paragraph("На основании изложенного, руководствуясь статьями 131 и 132 Гражданского процессуального кодекса Российской Федерации, прошу суд взыскать с ответчика в пользу истца:"),
      item("сумму долга {{debt}};"),
      item("проценты за пользование займом {{interest}};", filled("interest")),
      item("проценты за просрочку возврата {{late_interest}};", filled("late_interest")),
      item("расходы по уплате государственной пошлины {{fee}}."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{plaintiff_name}}", "{{suit_date}}"),
    ],
  };

  /* ---------- Заявление о судебном приказе ---------- */

  const orderTotal = (values, helpers) => (filled("debt")(values) ? sumOf(helpers, values.debt, values.interest) : null);

  const courtOrder = {
    id: "court-order",
    title: "Заявление о вынесении судебного приказа",
    category: "Суд",
    summary: "Взыскание долга до 500 000 рублей по письменной сделке. Считает пошлину.",
    reviewed: false,
    basis: [
      { lawId: "GPK", number: "121" }, { lawId: "GPK", number: "122" }, { lawId: "GPK", number: "123" }, { lawId: "GPK", number: "124" },
      { lawId: "GPK", number: "125" }, { lawId: "GPK", number: "126" }, { lawId: "NK", number: "333.19" },
    ],
    notes: [
      "К заявлению нужно приложить документ об уплате пошлины и уведомление о вручении или иные документы о направлении должнику копии заявления и приложений.",
      "Суд откажет, если из документов усматривается спор о праве или должник находится вне России.",
      "Судья выносит приказ в течение десяти дней без вызова сторон. Должник может подать возражения, и тогда приказ отменяется.",
    ],
    sections: [
      { title: "Суд", fields: [text("court", "Кому подаётся", { hint: "мировому судье судебного участка", help: "Например, Мировому судье судебного участка № 1 г. Энска. Подается по общим правилам подсудности." })] },
      { title: "Взыскатель", fields: courtPerson("creditor") },
      { title: "Должник", fields: courtPerson("debtor", { other: true }) },
      {
        title: "Требование",
        fields: [
          text("deal", "Сделка в простой письменной форме", { hint: "сделка", help: "Например, договор займа от 20.11.2025" }),
          area("circumstances", "Обстоятельства", { hint: "обстоятельства требования", help: "Что обязан был сделать должник и что не сделал" }),
          money("debt", "Сумма долга, ₽", { hint: "сумма долга" }),
          money("interest", "Проценты или неустойка, ₽", { hint: "проценты", optional: true }),
          area("attachments", "Приложения", { hint: "приложения", default: "документ об уплате государственной пошлины; копия договора; расчет задолженности; документы о направлении должнику копии заявления" }),
          date("application_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    computed: {
      total: { hint: "сумма требования", field: "debt", value: (values, helpers) => { const total = orderTotal(values, helpers); return total === null ? null : helpers.kopecksText(total); } },
      fee: { hint: "государственная пошлина", field: "debt", value: (values, helpers) => { const total = orderTotal(values, helpers); return total === null ? null : helpers.kopecksText(helpers.courtOrderFee(total)); } },
    },
    example: {
      court: "Мировому судье судебного участка № 1 г. Энска", creditor_name: "Иванов Иван Иванович", creditor_birth: "15.03.1985, г. Энск", creditor_address: "г. Энск, ул. Примерная, д. 1, кв. 1", creditor_id: "паспорт 0000 000000",
      debtor_name: "Петров Пётр Петрович", debtor_birth: "20.06.1988, г. Энск", debtor_address: "г. Энск, ул. Образцовая, д. 5", debtor_id: "паспорт 0000 000002", deal: "договор займа от 20.11.2025",
      circumstances: "должник получил 300 000 рублей и обязался вернуть их до 20.05.2026, но не вернул", debt: "300 000",
      attachments: "документ об уплате государственной пошлины; копия договора; расчет задолженности; документы о направлении должнику копии заявления", application_date: "2026-11-07",
    },
    checks(values, helpers) {
      const total = orderTotal(values, helpers);
      if (total !== null && total > helpers.COURT_ORDER_PRICE_LIMIT) {
        return [{ level: "warning", text: "Сумма больше 500 000 рублей: судебный приказ по такому требованию не выносится. Подайте исковое заявление.", basis: { lawId: "GPK", number: "121" } }];
      }
      return [];
    },
    body: [
      address("{{court}}"),
      ...courtPersonLines("Взыскатель", "creditor"),
      ...courtPersonLines("Должник", "debtor"),
      address("Сумма требования: {{total}}"),
      address("Государственная пошлина: {{fee}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("о вынесении судебного приказа"),
      paragraph("Требование основано на сделке, совершенной в простой письменной форме: {{deal}}."),
      paragraph("Обстоятельства: {{circumstances}}."),
      paragraph("Сумма требования составляет {{total}}. Спора о праве нет, документы подтверждают требование."),
      paragraph("На основании изложенного, руководствуясь статьями 121, 122 и 124 Гражданского процессуального кодекса Российской Федерации, прошу вынести судебный приказ о взыскании с должника в пользу взыскателя:"),
      item("суммы долга {{debt}};"),
      item("процентов или неустойки {{interest}};", filled("interest")),
      item("расходов по уплате государственной пошлины {{fee}}."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{creditor_name}}", "{{application_date}}"),
    ],
  };

  /* ---------- Возражения на судебный приказ ---------- */

  const OBJECTION_DAYS = 10;

  const orderObjection = {
    id: "order-objection",
    title: "Возражения относительно судебного приказа",
    category: "Суд",
    summary: "Должник просит отменить приказ. Проверяет десятидневный срок.",
    reviewed: false,
    basis: [{ lawId: "GPK", number: "128" }, { lawId: "GPK", number: "129" }, { lawId: "GPK", number: "112" }],
    notes: [
      "Срок на возражения составляет десять дней со дня получения приказа.",
      "При поступлении возражений в срок судья отменяет приказ. Причины несогласия можно указать, но закон этого условием не называет.",
      "Если срок пропущен, нужно обосновать невозможность подать возражения вовремя по независящим причинам.",
    ],
    sections: [
      { title: "Суд", fields: [text("court", "Кому подаётся", { hint: "мировому судье судебного участка", help: "Например, Мировому судье судебного участка № 1 г. Энска" })] },
      {
        title: "Стороны",
        fields: [
          text("debtor_name", "Должник", { hint: "ФИО должника" }),
          text("debtor_address", "Адрес должника", { hint: "адрес должника" }),
          text("creditor_name", "Взыскатель", { hint: "взыскатель" }),
        ],
      },
      {
        title: "Судебный приказ",
        fields: [
          text("case_number", "Номер приказа или дела", { hint: "номер" }),
          date("order_date", "Дата приказа", { hint: "дата приказа" }),
          date("received_date", "Когда получена копия приказа", { hint: "дата получения" }),
          area("reason", "Почему не согласны", { hint: "причина", optional: true }),
          area("late_reason", "Почему срок пропущен", { hint: "причина пропуска", optional: true, help: "Заполните, если десять дней уже прошли. Приложите доказательства." }),
          date("objection_date", "Дата возражений", { hint: "дата возражений" }),
        ],
      },
    ],
    example: {
      court: "Мировому судье судебного участка № 1 г. Энска", debtor_name: "Петров Пётр Петрович", debtor_address: "г. Энск, ул. Образцовая, д. 5", creditor_name: "Иванов Иван Иванович", case_number: "2-000/2026",
      order_date: "2026-10-20", received_date: "2026-11-02", reason: "не согласен с суммой долга", objection_date: "2026-11-07",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.received_date, values.objection_date);
      if (days !== null && days > OBJECTION_DAYS && !filled("late_reason")(values)) {
        return [{ level: "warning", text: `С получения приказа прошло ${days} дн. Возражения после десяти дней возвращаются, если не обоснована невозможность подать их вовремя. Заполните причину пропуска.`, basis: { lawId: "GPK", number: "129" } }];
      }
      return [];
    },
    body: [
      address("{{court}}"),
      address("Должник: {{debtor_name}}"),
      address("Адрес: {{debtor_address}}"),
      address("Взыскатель: {{creditor_name}}"),
      title("ВОЗРАЖЕНИЯ"),
      subtitle("относительно исполнения судебного приказа"),
      paragraph("{{order_date}} вынесен судебный приказ № {{case_number}} о взыскании с меня в пользу взыскателя. Копия приказа получена мной {{received_date}}."),
      paragraph("Возражаю относительно исполнения судебного приказа. Причина: {{reason}}.", filled("reason")),
      paragraph("Возражаю относительно исполнения судебного приказа.", (values) => !filled("reason")(values)),
      paragraph("Срок подачи возражений пропущен по независящим от меня причинам: {{late_reason}}.", filled("late_reason")),
      paragraph("На основании статей 128 и 129 Гражданского процессуального кодекса Российской Федерации прошу отменить судебный приказ."),
      signatureLine("{{debtor_name}}", "{{objection_date}}"),
    ],
  };

  /* ---------- Расторжение брака ---------- */

  const hasChildren = (values) => Boolean(values.has_children);
  const hasConsent = (values) => (values.consent || "yes") === "yes";

  const divorce = {
    id: "divorce",
    title: "Исковое заявление о расторжении брака",
    category: "Суд",
    summary: "Для развода через суд без спора о детях. Пошлина 5 000 рублей.",
    reviewed: false,
    basis: [
      { lawId: "SK", number: "21" }, { lawId: "SK", number: "22" }, { lawId: "SK", number: "23" }, { lawId: "SK", number: "24" },
      { lawId: "GPK", number: "23" }, { lawId: "GPK", number: "28" }, { lawId: "GPK", number: "29" }, { lawId: "NK", number: "333.19" },
    ],
    notes: [
      "Через суд брак расторгается при общих несовершеннолетних детях, при отсутствии согласия одного из супругов или если супруг уклоняется от расторжения в ЗАГСе.",
      "При спорах о детях дело подсудно районному суду. Этот шаблон такие споры не охватывает.",
      "Иск подается по месту жительства ответчика, а по месту жительства истца, если с ним живет несовершеннолетний или выезд затруднен по здоровью.",
      "При взаимном согласии суд расторгает брак не ранее чем через месяц после подачи заявления.",
    ],
    sections: [
      { title: "Суд", fields: [text("court", "Кому подаётся", { hint: "мировому судье судебного участка", help: "Например, Мировому судье судебного участка № 1 г. Энска" })] },
      { title: "Истец", fields: courtPerson("plaintiff") },
      { title: "Ответчик", fields: courtPerson("defendant", { other: true }) },
      {
        title: "Брак",
        fields: [
          date("marriage_date", "Дата регистрации брака", { hint: "дата регистрации брака" }),
          text("registry", "Запись акта и орган ЗАГС", { hint: "запись акта о заключении брака", help: "Например, запись № 000, отдел ЗАГС г. Энска" }),
          select("consent", "Согласие ответчика", [
            { value: "yes", label: "Ответчик согласен" },
            { value: "no", label: "Ответчик не согласен" },
          ], { default: "yes" }),
          area("reason", "Почему сохранить семью невозможно", { hint: "причины", when: (values) => !hasConsent(values) }),
          { id: "has_children", label: "Есть общие несовершеннолетние дети", type: "checkbox" },
          area("children", "Дети", { hint: "ФИО и даты рождения детей", when: hasChildren }),
          { id: "children_agreement", label: "Есть соглашение о детях", type: "checkbox", when: hasChildren },
        ],
      },
      {
        title: "Подача",
        fields: [
          area("attachments", "Приложения", { hint: "приложения", default: "квитанция об уплате государственной пошлины; свидетельство о заключении брака; документы о направлении ответчику копии заявления" }),
          date("suit_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    computed: {
      fee: { hint: "государственная пошлина", field: "suit_date", value: (_values, helpers) => helpers.kopecksText(helpers.DIVORCE_FEE) },
    },
    example: {
      court: "Мировому судье судебного участка № 1 г. Энска", plaintiff_name: "Иванова Анна Петровна", plaintiff_birth: "01.02.1990, г. Энск", plaintiff_address: "г. Энск, ул. Примерная, д. 1, кв. 1", plaintiff_id: "паспорт 0000 000006",
      defendant_name: "Иванов Иван Иванович", defendant_birth: "15.03.1985, г. Энск", defendant_address: "г. Энск, ул. Образцовая, д. 5", defendant_id: "паспорт 0000 000000",
      marriage_date: "2015-06-20", registry: "запись № 000, отдел ЗАГС г. Энска", consent: "yes", has_children: true, children: "Иванова Мария Ивановна, 12.12.2015", children_agreement: true,
      attachments: "квитанция об уплате государственной пошлины; свидетельство о заключении брака; свидетельство о рождении ребенка; соглашение о детях; документы о направлении ответчику копии заявления", suit_date: "2026-11-07",
    },
    checks(values) {
      if (hasConsent(values) && !hasChildren(values)) {
        return [{ level: "warning", text: "Детей нет, и ответчик согласен: брак обычно расторгается в ЗАГСе. Суд нужен, если супруг уклоняется от этого.", basis: { lawId: "SK", number: "21" } }];
      }
      return [];
    },
    body: [
      address("{{court}}"),
      ...courtPersonLines("Истец", "plaintiff"),
      ...courtPersonLines("Ответчик", "defendant"),
      address("Государственная пошлина: {{fee}}"),
      title("ИСКОВОЕ ЗАЯВЛЕНИЕ"),
      subtitle("о расторжении брака"),
      paragraph("{{marriage_date}} между истцом и ответчиком зарегистрирован брак: {{registry}}."),
      paragraph("От брака есть общие несовершеннолетние дети: {{children}}. Спора о детях между супругами нет.", hasChildren),
      paragraph("Соглашение о детях, предусмотренное пунктом 1 статьи 24 Семейного кодекса Российской Федерации, прилагается.", (values) => hasChildren(values) && values.children_agreement),
      paragraph("Ответчик согласен на расторжение брака.", hasConsent),
      paragraph("Ответчик не согласен на расторжение брака. Дальнейшая совместная жизнь супругов и сохранение семьи невозможны: {{reason}}.", (values) => !hasConsent(values)),
      paragraph("На основании статей 21–23 Семейного кодекса Российской Федерации, руководствуясь статьями 131 и 132 Гражданского процессуального кодекса Российской Федерации, прошу суд расторгнуть брак между истцом и ответчиком."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{plaintiff_name}}", "{{suit_date}}"),
    ],
  };

  /* ---------- Восстановление срока ---------- */

  const restoreTerm = {
    id: "restore-term",
    title: "Заявление о восстановлении процессуального срока",
    category: "Суд",
    summary: "Для пропущенного срока по уважительной причине. Подается вместе с пропущенным действием.",
    reviewed: false,
    basis: [{ lawId: "GPK", number: "112" }],
    notes: [
      "Одновременно с заявлением нужно совершить пропущенное действие: подать жалобу или документы.",
      "Для апелляционных, кассационных и надзорных жалоб действует особый порядок: проверьте его по статье, указанной в части 6 статьи 112 ГПК РФ.",
      "Срок кассационной и надзорной жалобы восстанавливают только в исключительных случаях.",
    ],
    sections: [
      { title: "Суд", fields: [text("court", "Суд", { hint: "наименование суда", help: "Суд, в котором надлежало совершить действие" })] },
      {
        title: "Заявитель и дело",
        fields: [
          text("applicant", "Заявитель", { hint: "ФИО заявителя" }),
          text("applicant_address", "Адрес", { hint: "адрес заявителя" }),
          select("role", "Процессуальное положение", [
            { value: "plaintiff", label: "Истец", text: "истца" },
            { value: "defendant", label: "Ответчик", text: "ответчика" },
            { value: "other", label: "Другое лицо, участвующее в деле", text: "лица, участвующего в деле" },
          ], { default: "defendant" }),
          text("case_number", "Номер дела", { hint: "номер дела" }),
        ],
      },
      {
        title: "Пропущенный срок",
        fields: [
          text("action", "Что нужно было сделать", { hint: "процессуальное действие", help: "Например, подать частную жалобу на определение от 01.10.2026" }),
          date("term_end", "Когда истек срок", { hint: "дата истечения срока" }),
          area("cause", "Почему срок пропущен", { hint: "причины пропуска" }),
          area("evidence", "Чем подтверждается", { hint: "доказательства уважительности" }),
          text("done", "Что подается вместе с заявлением", { hint: "пропущенное действие", help: "Например, частная жалоба" }),
          date("application_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    example: {
      court: "Энский районный суд", applicant: "Петров Пётр Петрович", applicant_address: "г. Энск, ул. Образцовая, д. 5", role: "defendant", case_number: "2-000/2026",
      action: "подать частную жалобу на определение от 01.10.2026", term_end: "2026-10-22", cause: "копия определения получена только 30.10.2026", evidence: "конверт с почтовым штемпелем", done: "частная жалоба", application_date: "2026-11-07",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.term_end, values.application_date);
      return days !== null && days < 0 ? [{ level: "warning", text: "Срок еще не истек: восстановление не требуется, совершите действие вовремя." }] : [];
    },
    body: [
      address("В {{court}}"),
      address("Заявитель: {{applicant}}"),
      address("Адрес: {{applicant_address}}"),
      address("Дело № {{case_number}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("о восстановлении пропущенного процессуального срока"),
      paragraph("Судом рассматривается или рассмотрено дело № {{case_number}}, в котором я участвую в качестве {{role}}."),
      paragraph("Мне необходимо было совершить следующее действие: {{action}}. Срок истек {{term_end}}."),
      paragraph("Срок пропущен по уважительным причинам: {{cause}}."),
      paragraph("Эти причины подтверждаются: {{evidence}}."),
      paragraph("Одновременно с настоящим заявлением подается: {{done}}."),
      paragraph("На основании статьи 112 Гражданского процессуального кодекса Российской Федерации прошу восстановить пропущенный процессуальный срок."),
      signatureLine("{{applicant}}", "{{application_date}}"),
    ],
  };

  root.TemplateKit.court = { courtPerson, courtPersonLines, sumOf };
  root.TEMPLATES.push(loanSuit, courtOrder, orderObjection, divorce, restoreTerm);
})(typeof window !== "undefined" ? window : globalThis);
