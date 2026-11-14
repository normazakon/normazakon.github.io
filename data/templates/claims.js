/* Претензии и уведомления. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, number, title, subtitle, meta, heading, clause, paragraph, item, address,
    signatureLine, personFields, partyFields, personIntro, partyIntro, signatures, personSignatures,
    placeAndDate, closingClauses, filled,
  } = root.TemplateKit;

  /* ---------- Претензия покупателя ---------- */

  const isRefund = (values) => (values.demand || "refund") === "refund";
  const isTechnical = (values) => Boolean(values.technical);

  const claim = {
    id: "claim",
    title: "Претензия о недостатках товара",
    category: "Претензии и уведомления",
    summary: "Требование покупателя вернуть деньги или снизить цену. Учитывает технически сложные товары.",
    reviewed: false,
    basis: [
      { lawId: "ZOZPP", number: "13" }, { lawId: "ZOZPP", number: "15" }, { lawId: "ZOZPP", number: "18" },
      { lawId: "ZOZPP", number: "22" }, { lawId: "ZOZPP", number: "23" },
    ],
    notes: [
      "Шаблон подходит для товара с недостатками. Возврат исправного товара регулируется другими статьями.",
      "Перечень технически сложных товаров утверждён Правительством. Проверьте, входит ли в него товар.",
      "Сохраните доказательство вручения претензии: отметку продавца или почтовую квитанцию с описью.",
    ],
    sections: [
      {
        title: "Продавец",
        fields: [
          text("seller_name", "Наименование продавца", { hint: "наименование продавца" }),
          text("seller_address", "Адрес продавца", { hint: "адрес продавца" }),
        ],
      },
      {
        title: "Покупатель",
        fields: [
          text("buyer_name", "ФИО", { hint: "ФИО покупателя" }),
          text("buyer_address", "Адрес", { hint: "адрес покупателя" }),
          text("buyer_phone", "Телефон или e-mail", { hint: "контакт", optional: true }),
        ],
      },
      {
        title: "Покупка и недостаток",
        fields: [
          area("product", "Товар", { hint: "товар", help: "Название, модель, серийный номер" }),
          date("purchase_date", "Дата покупки", { hint: "дата покупки" }),
          date("delivery_date", "Дата получения товара", { hint: "дата передачи товара" }),
          money("price", "Цена товара, ₽", { hint: "цена" }),
          text("proof", "Чем подтверждена покупка", { hint: "подтверждение покупки", help: "Например, кассовый чек № 123. Отсутствие чека не лишает права предъявить требования." }),
          area("defect", "Какой недостаток обнаружен", { hint: "описание недостатка" }),
          date("defect_date", "Когда обнаружен недостаток", { hint: "дата обнаружения" }),
          { id: "technical", label: "Товар технически сложный", type: "checkbox" },
          select("ground", "Основание после 15 дней", [
            { value: "within", label: "Прошло не более 15 дней", text: "с момента передачи товара прошло не более пятнадцати дней" },
            { value: "substantial", label: "Существенный недостаток", text: "обнаружен существенный недостаток товара" },
            { value: "terms", label: "Нарушен срок устранения", text: "нарушены установленные законом сроки устранения недостатков товара" },
            { value: "repairs", label: "Более 30 дней ремонта за год", text: "товар невозможно было использовать в течение года гарантийного срока в совокупности более тридцати дней вследствие неоднократного устранения различных недостатков" },
          ], { default: "within", when: isTechnical }),
        ],
      },
      {
        title: "Требование",
        fields: [
          select("demand", "Что требуете", [
            { value: "refund", label: "Вернуть деньги" },
            { value: "reduce", label: "Уменьшить цену" },
          ], { default: "refund" }),
          money("reduction", "На сколько уменьшить цену, ₽", { hint: "сумма уменьшения", when: (values) => !isRefund(values) }),
          area("payment_details", "Куда перечислить деньги", { hint: "реквизиты для возврата", optional: true }),
          area("attachments", "Приложения", { hint: "приложения", default: "копия кассового чека" }),
          date("claim_date", "Дата претензии", { hint: "дата претензии" }),
        ],
      },
    ],
    example: {
      seller_name: "ООО «Вымышленный магазин»", seller_address: "г. Энск, ул. Торговая, д. 10", buyer_name: "Петров Пётр Петрович",
      buyer_address: "г. Энск, ул. Образцовая, д. 5", product: "ноутбук «Пример», серийный номер 000000", purchase_date: "2026-10-30", delivery_date: "2026-10-30",
      price: "80 000", proof: "кассовый чек № 000", defect: "не включается после обновления", defect_date: "2026-11-05", technical: true, ground: "within",
      demand: "refund", attachments: "копия кассового чека", claim_date: "2026-11-07",
    },
    checks(values, helpers) {
      const result = [];
      const days = helpers.daysBetween(values.delivery_date, values.claim_date);
      if (isTechnical(values) && (values.ground || "within") === "within" && days !== null && days > 15) {
        result.push({ level: "warning", text: `С передачи товара прошло ${days} дн. Для технически сложного товара выберите основание после пятнадцати дней или измените требование.`, basis: { lawId: "ZOZPP", number: "18" } });
      }
      return result;
    },
    body: [
      address("Продавцу: {{seller_name}}"),
      address("Адрес: {{seller_address}}"),
      address("От покупателя: {{buyer_name}}"),
      address("Адрес: {{buyer_address}}"),
      address("Контакт: {{buyer_phone}}", (values) => String(values.buyer_phone || "").trim()),
      title("ПРЕТЕНЗИЯ"),
      subtitle("о недостатках товара"),
      paragraph("{{purchase_date}} мной приобретен у Вас товар: {{product}} по цене {{price}}. Товар передан мне {{delivery_date}}. Покупка подтверждается: {{proof}}."),
      paragraph("{{defect_date}} в товаре обнаружен недостаток: {{defect}}. При продаже этот недостаток не был оговорен."),
      paragraph("Товар является технически сложным. Требование предъявлено, поскольку {{ground}}.", isTechnical),
      paragraph("На основании пункта 1 статьи 18 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» отказываюсь от исполнения договора купли-продажи и требую вернуть уплаченную за товар сумму {{price}}.", isRefund),
      paragraph("На основании пункта 1 статьи 18 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» требую соразмерно уменьшить покупную цену на {{reduction}} и вернуть эту сумму.", (values) => !isRefund(values)),
      paragraph("Деньги прошу перечислить по реквизитам: {{payment_details}}.", (values) => String(values.payment_details || "").trim()),
      paragraph("Товар с недостатками будет возвращен по Вашему требованию и за Ваш счет.", isRefund),
      paragraph("Согласно статье 22 указанного Закона требование подлежит удовлетворению в течение десяти дней со дня его предъявления."),
      paragraph("При нарушении этого срока я буду вправе требовать неустойку в размере одного процента цены товара за каждый день просрочки (пункт 1 статьи 23 Закона). Если требование не будет удовлетворено добровольно, я обращусь в суд и заявлю также о компенсации морального вреда (статья 15 Закона) и штрафе в размере пятидесяти процентов от присужденной суммы (пункт 6 статьи 13 Закона)."),
      paragraph("Приложения: {{attachments}}."),
      { type: "signatureLine", text: "{{buyer_name}}", right: "{{claim_date}}" },
    ],
  };

  root.TEMPLATES.push(claim);
})(typeof window !== "undefined" ? window : globalThis);
