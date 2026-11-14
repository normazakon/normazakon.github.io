/* Претензия о долге, претензия к исполнителю услуг, уведомление об отказе от договора. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, number, title, subtitle, paragraph, address, signatureLine, partyFields, filled,
  } = root.TemplateKit;

  const nameOf = (prefix, values) => {
    const kind = values[`${prefix}_kind`] || "person";
    if (kind === "org") return `{{${prefix}_org_name}}`;
    if (kind === "ip") return `ИП {{${prefix}_ip_name}}`;
    return `{{${prefix}_name}}`;
  };

  const addressOf = (prefix, values) => ((values[`${prefix}_kind`] || "person") === "person"
    ? `{{${prefix}_address}}`
    : `{{${prefix}_business_address}}`);

  const signerOf = (prefix, values) => {
    const kind = values[`${prefix}_kind`] || "person";
    if (kind === "org") return `{{${prefix}_short_signer}}`;
    return kind === "ip" ? `{{${prefix}_ip_name}}` : `{{${prefix}_name}}`;
  };

  /* ---------- Претензия о долге ---------- */

  const debtClaim = {
    id: "debt-claim",
    title: "Претензия об оплате долга",
    category: "Претензии и уведомления",
    summary: "Требование погасить денежный долг по договору до обращения в суд.",
    reviewed: false,
    basis: [
      { lawId: "GK", number: "309" }, { lawId: "GK", number: "310" }, { lawId: "GK", number: "314" }, { lawId: "GK", number: "395" }, { lawId: "APK", number: "4" },
    ],
    notes: [
      "В спорах, подсудных арбитражному суду, взысканию долга обычно предшествует претензия: обращение возможно через тридцать календарных дней после ее направления, если договор или закон не устанавливают другое.",
      "Сохраните доказательство отправки: опись вложения и квитанцию либо отметку о вручении.",
      "Проценты по статье 395 ГК РФ рассчитываются по ключевой ставке за соответствующие периоды. Если договором предусмотрена неустойка, такие проценты по общему правилу не взыскиваются.",
    ],
    sections: [
      { title: "Кредитор", fields: partyFields("creditor", "Кредитор") },
      { title: "Должник", fields: partyFields("debtor", "Должник") },
      {
        title: "Долг",
        fields: [
          text("contract", "Основание долга", { hint: "договор", help: "Например, договор поставки № 12 от 01.03.2026" }),
          text("debt_for", "За что долг", { hint: "за что долг", help: "Например, за поставленный товар" }),
          money("debt", "Сумма долга, ₽", { hint: "сумма долга" }),
          date("due_date", "Когда нужно было оплатить", { hint: "срок оплаты" }),
          number("pay_days", "Срок оплаты по претензии, дней", { hint: "число", default: "10" }),
          area("payment_details", "Реквизиты для оплаты", { hint: "реквизиты для оплаты" }),
          area("attachments", "Приложения", { hint: "приложения", default: "копия договора; документы, подтверждающие долг" }),
          date("claim_date", "Дата претензии", { hint: "дата претензии" }),
        ],
      },
    ],
    example: {
      creditor_kind: "ip", creditor_ip_name: "Петров Пётр Петрович", creditor_ogrnip: "000000000000000", creditor_inn: "000000000000", creditor_business_address: "г. Энск, ул. Образцовая, д. 2",
      debtor_kind: "org", debtor_org_name: "ООО «Пример»", debtor_ogrn: "0000000000000", debtor_inn: "0000000000", debtor_business_address: "г. Энск, ул. Примерная, д. 1", debtor_signer: "генерального директора Иванова И. И.",
      debtor_authority: "устав", debtor_short_signer: "Иванов И. И.", contract: "договор поставки № 12 от 01.03.2026", debt_for: "за поставленный товар", debt: "210 000", due_date: "2026-09-30", pay_days: "10",
      payment_details: "счет № 00000000000000000000 в вымышленном банке", attachments: "копия договора; копия накладной", claim_date: "2026-11-07",
    },
    checks(values) {
      const business = (prefix) => (values[`${prefix}_kind`] || "person") !== "person";
      if (business("creditor") && business("debtor") && Number(values.pay_days) < 30) {
        return [{ level: "info", text: "Если спор будет рассматривать арбитражный суд, иск можно подать через тридцать календарных дней после направления претензии, даже при более коротком сроке оплаты, если договор не устанавливает иное.", basis: { lawId: "APK", number: "4" } }];
      }
      return [];
    },
    body: [
      address((values) => `Кому: ${nameOf("debtor", values)}`),
      address((values) => `Адрес: ${addressOf("debtor", values)}`),
      address((values) => `От кого: ${nameOf("creditor", values)}`),
      address((values) => `Адрес: ${addressOf("creditor", values)}`),
      title("ПРЕТЕНЗИЯ"),
      subtitle("об оплате долга"),
      paragraph("Основание долга: {{contract}}."),
      paragraph("Задолженность {{debt_for}} составляет {{debt}}. Срок оплаты наступил {{due_date}}, однако оплата не произведена."),
      paragraph("Согласно статье 309 Гражданского кодекса Российской Федерации обязательства должны исполняться надлежащим образом, а односторонний отказ от исполнения обязательства по статье 310 этого Кодекса не допускается, кроме случаев, предусмотренных законом."),
      paragraph("Прошу в течение {{pay_days}} дней со дня получения претензии оплатить задолженность по реквизитам: {{payment_details}}."),
      paragraph("Если требование не будет исполнено, кредитор обратится в суд с иском о взыскании долга, процентов за просрочку и судебных расходов."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine((values) => signerOf("creditor", values), "{{claim_date}}"),
    ],
  };

  /* ---------- Претензия к исполнителю ---------- */

  const isLate = (values) => (values.problem || "late") === "late";
  const demandIs = (kind) => (values) => (values.demand || "refund") === kind;

  const serviceClaim = {
    id: "service-claim",
    title: "Претензия к исполнителю работ или услуг",
    category: "Претензии и уведомления",
    summary: "Потребитель заявляет о просрочке или недостатках. Считает сроки по закону.",
    reviewed: false,
    basis: [
      { lawId: "ZOZPP", number: "27" }, { lawId: "ZOZPP", number: "28" }, { lawId: "ZOZPP", number: "29" }, { lawId: "ZOZPP", number: "30" },
      { lawId: "ZOZPP", number: "31" }, { lawId: "ZOZPP", number: "13" }, { lawId: "ZOZPP", number: "15" },
    ],
    notes: [
      "Шаблон подходит гражданину, который заказал работу или услугу для личных нужд у предпринимателя или организации.",
      "При недостатках отказ от договора возможен, если они существенные или не устранены в установленный срок.",
      "Сохраните доказательство вручения претензии.",
    ],
    sections: [
      {
        title: "Исполнитель",
        fields: [
          text("contractor", "Наименование исполнителя", { hint: "наименование исполнителя" }),
          text("contractor_address", "Адрес исполнителя", { hint: "адрес исполнителя" }),
        ],
      },
      {
        title: "Потребитель",
        fields: [
          text("customer", "ФИО", { hint: "ФИО" }),
          text("customer_address", "Адрес", { hint: "адрес" }),
          text("customer_contact", "Телефон или e-mail", { hint: "контакт", optional: true }),
        ],
      },
      {
        title: "Договор и нарушение",
        fields: [
          text("contract", "Договор", { hint: "договор", help: "Например, договор № 5 от 01.09.2026" }),
          area("service", "Какие работы или услуги заказаны", { hint: "работы или услуги" }),
          money("price", "Цена, ₽", { hint: "цена" }),
          money("paid", "Сколько оплачено, ₽", { hint: "оплаченная сумма" }),
          select("problem", "Что произошло", [
            { value: "late", label: "Нарушен срок" },
            { value: "defect", label: "Есть недостатки" },
          ], { default: "late" }),
          date("deadline", "Срок выполнения по договору", { hint: "срок по договору", when: isLate }),
          area("defect", "Какие недостатки обнаружены", { hint: "описание недостатков", when: (values) => !isLate(values) }),
          { id: "substantial", label: "Недостатки существенные или не устранены в срок", type: "checkbox", when: (values) => !isLate(values) },
        ],
      },
      {
        title: "Требование",
        fields: [
          select("demand", "Что требуете", [
            { value: "refund", label: "Отказаться от договора и вернуть деньги" },
            { value: "reduce", label: "Уменьшить цену" },
            { value: "fix", label: "Выполнить работу или устранить недостатки" },
          ], { default: "refund" }),
          money("reduction", "На сколько уменьшить цену, ₽", { hint: "сумма уменьшения", when: demandIs("reduce") }),
          date("new_date", "Новый срок", { hint: "новый срок", when: demandIs("fix") }),
          area("payment_details", "Куда перечислить деньги", { hint: "реквизиты для возврата", optional: true, when: (values) => !demandIs("fix")(values) }),
          area("attachments", "Приложения", { hint: "приложения", default: "копия договора; копия документа об оплате" }),
          date("claim_date", "Дата претензии", { hint: "дата претензии" }),
        ],
      },
    ],
    example: {
      contractor: "ООО «Вымышленный ремонт»", contractor_address: "г. Энск, ул. Рабочая, д. 3", customer: "Иванов Иван Иванович", customer_address: "г. Энск, ул. Примерная, д. 1, кв. 1",
      contract: "договор № 5 от 01.09.2026", service: "ремонт ванной комнаты", price: "150 000", paid: "100 000", problem: "late", deadline: "2026-10-15", demand: "refund",
      attachments: "копия договора; копия квитанции об оплате", claim_date: "2026-11-07",
    },
    checks(values) {
      if (!isLate(values) && demandIs("refund")(values) && !values.substantial) {
        return [{ level: "warning", text: "При недостатках отказаться от договора можно, если они существенные либо не устранены в установленный срок. Отметьте это условие или измените требование.", basis: { lawId: "ZOZPP", number: "29" } }];
      }
      return [];
    },
    body: [
      address("Исполнителю: {{contractor}}"),
      address("Адрес: {{contractor_address}}"),
      address("От: {{customer}}"),
      address("Адрес: {{customer_address}}"),
      address("Контакт: {{customer_contact}}", filled("customer_contact")),
      title("ПРЕТЕНЗИЯ"),
      subtitle("потребителя"),
      paragraph("Между мной и Вами заключен договор: {{contract}}, предмет: {{service}}. Цена составляет {{price}}, оплачено {{paid}}."),
      paragraph("Срок выполнения, установленный договором, истек {{deadline}}, однако обязательство не исполнено.", isLate),
      paragraph("В результате работ (услуг) обнаружены следующие недостатки: {{defect}}.", (values) => !isLate(values)),
      paragraph("На основании пункта 1 статьи 28 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» отказываюсь от исполнения договора и требую вернуть уплаченную сумму {{paid}}.", (values) => isLate(values) && demandIs("refund")(values)),
      paragraph("На основании пункта 1 статьи 29 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» отказываюсь от исполнения договора и требую вернуть уплаченную сумму {{paid}}.", (values) => !isLate(values) && demandIs("refund")(values)),
      paragraph("На основании пункта 1 статьи 28 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» требую уменьшить цену на {{reduction}}.", (values) => isLate(values) && demandIs("reduce")(values)),
      paragraph("На основании пункта 1 статьи 29 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» требую уменьшить цену на {{reduction}}.", (values) => !isLate(values) && demandIs("reduce")(values)),
      paragraph("На основании пункта 1 статьи 28 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» назначаю новый срок выполнения: {{new_date}}.", (values) => isLate(values) && demandIs("fix")(values)),
      paragraph("На основании пункта 1 статьи 29 и статьи 30 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» требую безвозмездно устранить недостатки в срок до {{new_date}}.", (values) => !isLate(values) && demandIs("fix")(values)),
      paragraph("Деньги прошу перечислить по реквизитам: {{payment_details}}.", (values) => !demandIs("fix")(values) && filled("payment_details")(values)),
      paragraph("Согласно пункту 1 статьи 31 указанного Закона требование подлежит удовлетворению в десятидневный срок со дня его предъявления.", (values) => !demandIs("fix")(values)),
      paragraph("За просрочку установленных сроков закон предусматривает неустойку в размере трех процентов цены работы (услуги) за каждый день, сумма которой не может превышать эту цену (пункт 5 статьи 28 Закона). Если требование не будет удовлетворено добровольно, я обращусь в суд и заявлю также о компенсации морального вреда (статья 15 Закона) и штрафе в размере пятидесяти процентов от присужденной суммы (пункт 6 статьи 13 Закона)."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{customer}}", "{{claim_date}}"),
    ],
  };

  /* ---------- Уведомление об отказе от договора ---------- */

  const GROUNDS = [
    { value: "services", label: "Договор услуг: заказчик отказывается", text: "пункта 1 статьи 782 Гражданского кодекса Российской Федерации" },
    { value: "work", label: "Договор подряда: заказчик отказывается", text: "статьи 717 Гражданского кодекса Российской Федерации" },
    { value: "consumer", label: "Потребитель отказывается от работ или услуг", text: "статьи 32 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей»" },
  ];

  const refusal = {
    id: "refusal",
    title: "Уведомление об отказе от договора",
    category: "Претензии и уведомления",
    summary: "Односторонний отказ заказчика от договора услуг или подряда.",
    reviewed: false,
    basis: [
      { lawId: "GK", number: "450.1" }, { lawId: "GK", number: "782" }, { lawId: "GK", number: "717" }, { lawId: "ZOZPP", number: "32" },
    ],
    notes: [
      "Договор прекращается с момента получения уведомления другой стороной, если иное не предусмотрено законом или договором. Сохраните доказательство вручения.",
      "Заказчик услуг оплачивает фактически понесенные расходы исполнителя. Заказчик по подряду оплачивает выполненную часть и возмещает убытки в пределах статьи 717 ГК РФ.",
      "Проверьте, нет ли в договоре особого порядка отказа.",
    ],
    sections: [
      { title: "Кто отказывается", fields: partyFields("sender", "Заказчик") },
      { title: "Кому направляется", fields: partyFields("receiver", "Исполнитель") },
      {
        title: "Договор и отказ",
        fields: [
          text("contract", "Договор", { hint: "договор", help: "Например, договор оказания услуг № 12 от 01.03.2026" }),
          select("ground", "Основание отказа", GROUNDS, { default: "services" }),
          money("refund", "Вернуть предоплату, ₽", { hint: "сумма возврата", optional: true }),
          number("refund_days", "Срок возврата, дней", { hint: "число", default: "10", when: filled("refund") }),
          area("payment_details", "Реквизиты для возврата", { hint: "реквизиты для возврата", when: filled("refund") }),
          date("notice_date", "Дата уведомления", { hint: "дата уведомления" }),
        ],
      },
    ],
    example: {
      sender_kind: "person", sender_name: "Иванов Иван Иванович", sender_birth: "15.03.1985", sender_passport: "0000 000000", sender_issued: "вымышленным отделом 01.01.2015", sender_address: "г. Энск, ул. Примерная, д. 1, кв. 1",
      receiver_kind: "ip", receiver_ip_name: "Петров Пётр Петрович", receiver_ogrnip: "000000000000000", receiver_inn: "000000000000", receiver_business_address: "г. Энск, ул. Образцовая, д. 2",
      contract: "договор оказания услуг № 12 от 01.03.2026", ground: "consumer", refund: "20 000", refund_days: "10", payment_details: "счет № 00000000000000000000 в вымышленном банке", notice_date: "2026-11-07",
    },
    checks(values) {
      const consumer = (values.sender_kind || "person") === "person" && (values.receiver_kind || "person") !== "person";
      if (consumer && (values.ground || "services") === "services") {
        return [{ level: "info", text: "Заказчик-гражданин отказывается от услуг предпринимателя: если услуга заказана для личных нужд, подходит основание для потребителя.", basis: { lawId: "ZOZPP", number: "32" } }];
      }
      return [];
    },
    body: [
      address((values) => `Кому: ${nameOf("receiver", values)}`),
      address((values) => `Адрес: ${addressOf("receiver", values)}`),
      address((values) => `От кого: ${nameOf("sender", values)}`),
      address((values) => `Адрес: ${addressOf("sender", values)}`),
      title("УВЕДОМЛЕНИЕ"),
      subtitle("об отказе от исполнения договора"),
      paragraph("Настоящим уведомляю об отказе от исполнения договора: {{contract}}."),
      paragraph("Отказ заявлен на основании {{ground}} и пункта 1 статьи 450.1 Гражданского кодекса Российской Федерации. Договор прекращается с момента получения настоящего уведомления."),
      paragraph("Прошу представить документы, подтверждающие фактически понесенные расходы, если они были.", (values) => (values.ground || "services") !== "work"),
      paragraph("Прошу в течение {{refund_days}} дней со дня получения уведомления вернуть предоплату {{refund}} за вычетом обоснованных сумм по реквизитам: {{payment_details}}.", filled("refund")),
      signatureLine((values) => signerOf("sender", values), "{{notice_date}}"),
    ],
  };

  root.TEMPLATES.push(debtClaim, serviceClaim, refusal);
})(typeof window !== "undefined" ? window : globalThis);
