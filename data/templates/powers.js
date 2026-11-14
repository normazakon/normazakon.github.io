/* Доверенности. */
(function (root) {
  "use strict";

  const {
    text, area, date, select, title, meta, paragraph, item, signatureLine, personFields, personIntro, filled,
  } = root.TemplateKit;

  const isCourt = (values) => (values.scope || "other") === "court";

  // Полномочия, которые по статье 54 ГПК РФ должны быть оговорены в доверенности отдельно
  const SPECIAL_POWERS = [
    ["power_sign", "подписание искового заявления и предъявление его в суд"],
    ["power_counter", "предъявление встречного иска"],
    ["power_waive", "полный или частичный отказ от исковых требований и уменьшение их размера"],
    ["power_admit", "признание иска"],
    ["power_change", "изменение предмета или основания иска"],
    ["power_settle", "заключение мирового соглашения"],
    ["power_appeal", "обжалование судебного постановления"],
    ["power_enforce", "предъявление исполнительного документа к взысканию"],
    ["power_receive", "получение присужденного имущества или денег"],
    ["power_arbitration", "передачу спора на рассмотрение третейского суда"],
  ];

  const power = {
    id: "power",
    title: "Доверенность от гражданина",
    category: "Доверенности",
    summary: "На представительство в суде или другие действия. Для суда перечисляет особые полномочия.",
    reviewed: false,
    basis: [
      { lawId: "GK", number: "185" }, { lawId: "GK", number: "185.1" }, { lawId: "GK", number: "186" }, { lawId: "GK", number: "187" },
      { lawId: "GK", number: "188" }, { lawId: "GPK", number: "53" }, { lawId: "GPK", number: "54" },
    ],
    notes: [
      "Доверенность без даты ничтожна. Если срок не указан, она действует один год.",
      "Сделки, требующие нотариальной формы, подача заявлений о регистрации прав и распоряжение зарегистрированными правами требуют нотариальной доверенности. Этот шаблон для них не подходит.",
      "Для суда проверьте удостоверение доверенности: варианты перечислены в части 2 статьи 53 ГПК РФ.",
    ],
    sections: [
      { title: "Место и дата", fields: [text("city", "Город", { hint: "город" }), date("date", "Дата доверенности", { hint: "дата" })] },
      { title: "Доверитель", fields: personFields("principal") },
      { title: "Представитель", fields: personFields("agent") },
      {
        title: "Полномочия",
        fields: [
          select("scope", "Для чего выдаётся", [
            { value: "other", label: "Для указанных действий" },
            { value: "court", label: "Для представительства в суде" },
          ], { default: "other" }),
          area("actions", "Какие действия поручаются", { hint: "поручаемые действия", when: (values) => !isCourt(values) }),
          text("case", "Какое дело или спор", { hint: "описание дела", optional: true, help: "Не заполняйте, если доверенность на ведение любых гражданских дел.", when: isCourt }),
          ...SPECIAL_POWERS.map(([id, label]) => ({ id, label: label[0].toUpperCase() + label.slice(1), type: "checkbox", when: isCourt })),
          { id: "substitution", label: "Разрешить передоверие", type: "checkbox" },
          date("valid_until", "Действует до", { hint: "срок действия", optional: true, help: "Если не указать, доверенность действует один год." }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20", principal_name: "Иванов Иван Иванович", principal_birth: "15.03.1985", principal_passport: "0000 000000",
      principal_issued: "вымышленным отделом 01.01.2015", principal_address: "г. Энск, ул. Примерная, д. 1, кв. 1", agent_name: "Петров Пётр Петрович",
      agent_birth: "20.06.1988", agent_passport: "0000 000002", agent_issued: "вымышленным отделом 11.11.2016", agent_address: "г. Энск, ул. Образцовая, д. 5",
      scope: "other", actions: "получать в отделении связи адресованные Доверителю заказные письма", valid_until: "2027-11-20",
    },
    checks(values, helpers) {
      const result = [];
      if (isCourt(values)) {
        result.push({ level: "warning", text: "Проверьте удостоверение доверенности: часть 2 статьи 53 ГПК РФ называет нотариуса и ряд организаций. Полномочия можно также заявить в суде устно или письменно по части 6 этой статьи.", basis: { lawId: "GPK", number: "53" } });
      }
      const days = helpers.daysBetween(values.date, values.valid_until);
      if (days !== null && days <= 0) {
        result.push({ level: "warning", text: "Срок действия истекает не позже даты доверенности." });
      }
      return result;
    },
    body: [
      title("ДОВЕРЕННОСТЬ"),
      meta("г. {{city}}", "{{date}}"),
      paragraph(() => `Доверитель: ${personIntro("principal")}.`),
      paragraph(() => `Представитель: ${personIntro("agent")}.`),
      paragraph("Настоящей доверенностью Доверитель уполномочивает Представителя:"),
      paragraph("совершать от имени Доверителя следующие действия: {{actions}}.", (values) => !isCourt(values)),
      paragraph("представлять интересы Доверителя в судах общей юрисдикции по делу: {{case}}, со всеми правами, предоставленными законом стороне и другим лицам, участвующим в деле.", (values) => isCourt(values) && filled("case")(values)),
      paragraph("представлять интересы Доверителя в судах общей юрисдикции по гражданским делам со всеми правами, предоставленными законом стороне и другим лицам, участвующим в деле.", (values) => isCourt(values) && !filled("case")(values)),
      paragraph("В том числе представитель вправе совершать следующие действия:", (values) => isCourt(values) && SPECIAL_POWERS.some(([id]) => values[id])),
      ...SPECIAL_POWERS.map(([id, label]) => item(`${label};`, (values) => isCourt(values) && values[id])),
      paragraph("Доверенность выдана с правом передоверия.", (values) => values.substitution),
      paragraph("Доверенность выдана без права передоверия.", (values) => !values.substitution),
      paragraph("Доверенность действует до {{valid_until}} включительно.", filled("valid_until")),
      paragraph("Доверенность действует один год со дня ее совершения.", (values) => !filled("valid_until")(values)),
      signatureLine("{{principal_name}}"),
    ],
  };

  root.TEMPLATES.push(power);
})(typeof window !== "undefined" ? window : globalThis);
