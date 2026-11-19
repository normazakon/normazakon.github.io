/* Поставка, трудовой договор, иск потребителя, апелляционная жалоба. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, number, title, subtitle, meta, heading, clause, paragraph, item, address,
    signatureLine, partyFields, partyIntro, signatures, placeAndDate, closingClauses, filled,
    kindOf,
  } = root.TemplateKit;
  const { courtPerson, courtPersonLines, sumOf } = root.TemplateKit.court;


  /* ---------- Поставка ---------- */

  const isPickup = (values) => (values.delivery || "supplier") === "pickup";
  const payIs = (kind) => (values) => (values.pay_mode || "after") === kind;

  const supply = {
    id: "supply",
    title: "Договор поставки",
    category: "Договоры",
    summary: "Поставка товара между предпринимателями. Приемка, качество, оплата и претензионный порядок.",
    reviewed: false,
    basis: [
      { lawId: "GK", number: "506" }, { lawId: "GK", number: "508" }, { lawId: "GK", number: "509" }, { lawId: "GK", number: "510" },
      { lawId: "GK", number: "513" }, { lawId: "GK", number: "516" }, { lawId: "GK", number: "518" }, { lawId: "GK", number: "521" },
      { lawId: "GK", number: "523" }, { lawId: "APK", number: "4" },
    ],
    notes: [
      "Поставщиком может быть только предприниматель, а товар покупается не для личных нужд.",
      "Наименование и количество товара являются существенными условиями. Для нескольких позиций составьте спецификацию.",
      "При неоднократном нарушении сроков поставки или оплаты нарушение предполагается существенным, и договор можно расторгнуть в одностороннем порядке.",
    ],
    sections: [
      { title: "Место и дата", fields: placeAndDate },
      { title: "Поставщик", fields: partyFields("supplier", "Поставщик") },
      { title: "Покупатель", fields: partyFields("buyer", "Покупатель") },
      {
        title: "Товар и поставка",
        fields: [
          area("goods", "Товар, количество и цена за единицу", { hint: "товар и количество", help: "Например, бумага офисная А4, 200 пачек по 400 рублей" }),
          money("total", "Общая стоимость, ₽", { hint: "общая стоимость" }),
          select("vat", "НДС", [
            { value: "none", label: "НДС не облагается" },
            { value: "included", label: "Стоимость включает НДС" },
          ], { default: "none" }),
          text("vat_rate", "Ставка НДС, %", { hint: "ставка", when: (values) => values.vat === "included" }),
          date("delivery_date", "Срок поставки", { hint: "срок поставки" }),
          select("delivery", "Как передаётся товар", [
            { value: "supplier", label: "Поставщик доставляет покупателю" },
            { value: "pickup", label: "Покупатель забирает со склада" },
          ], { default: "supplier" }),
          text("delivery_address", "Адрес доставки или склада", { hint: "адрес" }),
          number("inspection_days", "Срок проверки товара, рабочих дней", { hint: "число", default: "3" }),
        ],
      },
      {
        title: "Оплата и ответственность",
        fields: [
          select("pay_mode", "Оплата", [
            { value: "after", label: "После поставки" },
            { value: "prepay", label: "Предоплата" },
          ], { default: "after" }),
          number("pay_days", "Срок оплаты, рабочих дней", { hint: "число", default: "10" }),
          text("penalty", "Неустойка, % в день", { hint: "процент", default: "0,1" }),
          text("penalty_cap", "Предел неустойки, %", { hint: "предел", default: "10" }),
          number("claim_days", "Срок ответа на претензию, календарных дней", { hint: "число", default: "30" }),
          text("venue", "Суд для споров", { hint: "суд", optional: true, help: "Например, Арбитражный суд города Энска. Иначе по правилам подсудности" }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20", supplier_kind: "org", supplier_org_name: "Общество с ограниченной ответственностью «Пример»", supplier_ogrn: "0000000000000", supplier_inn: "0000000000",
      supplier_business_address: "г. Энск, ул. Промышленная, д. 1", supplier_signer: "генерального директора Иванова И. И.", supplier_authority: "устав", supplier_short_signer: "Иванов И. И.",
      buyer_kind: "ip", buyer_ip_name: "Петров Пётр Петрович", buyer_ogrnip: "000000000000000", buyer_inn: "000000000000", buyer_business_address: "г. Энск, ул. Торговая, д. 10",
      goods: "бумага офисная А4, 200 пачек по 400 рублей", total: "80 000", vat: "none", delivery_date: "2026-12-01", delivery: "supplier", delivery_address: "г. Энск, ул. Торговая, д. 10",
      inspection_days: "3", pay_mode: "after", pay_days: "10", penalty: "0,1", penalty_cap: "10", claim_days: "30", venue: "Арбитражный суд г. Энска",
    },
    checks(values) {
      const result = [];
      if (kindOf(values, "supplier") === "person") {
        result.push({ level: "warning", text: "Поставщик по договору поставки должен быть предпринимателем. Для продажи между гражданами подойдет договор купли-продажи.", basis: { lawId: "GK", number: "506" } });
      }
      if (kindOf(values, "buyer") === "person") {
        result.push({ level: "warning", text: "Покупатель-гражданин: если товар нужен для личных нужд, это розничная купля-продажа с правилами о защите прав потребителей, а не поставка.", basis: { lawId: "GK", number: "506" } });
      }
      return result;
    },
    body: [
      title("ДОГОВОР ПОСТАВКИ"),
      meta("г. {{city}}", "{{date}}"),
      paragraph((values) => `${partyIntro("supplier", values)} (далее — «Поставщик»), с одной стороны, и ${partyIntro("buyer", values)} (далее — «Покупатель»), с другой стороны, вместе именуемые «Стороны», заключили настоящий договор о следующем.`),
      heading("Предмет договора"),
      clause("Поставщик обязуется передать Покупателю для использования в предпринимательской деятельности, а Покупатель обязуется принять и оплатить следующий товар: {{goods}} (далее — «Товар»)."),
      clause((values) => `Общая стоимость Товара составляет {{total}}, ${values.vat === "included" ? "в том числе НДС по ставке {{vat_rate}}%" : "НДС не облагается"}.`),
      heading("Поставка"),
      clause("Поставщик доставляет Товар по адресу: {{delivery_address}} в срок до {{delivery_date}} включительно.", (values) => !isPickup(values)),
      clause("Покупатель получает Товар на складе Поставщика по адресу: {{delivery_address}} в срок до {{delivery_date}} включительно после уведомления Поставщика о готовности Товара.", isPickup),
      clause("Досрочная поставка допускается с согласия Покупателя."),
      clause("Передача Товара оформляется товарной накладной или универсальным передаточным документом."),
      heading("Приемка и качество"),
      clause("Покупатель в течение {{inspection_days}} рабочих дней после получения проверяет количество и качество Товара и о выявленных несоответствиях незамедлительно письменно уведомляет Поставщика."),
      clause("Качество Товара должно соответствовать обязательным требованиям и сопроводительным документам."),
      clause("При поставке Товара ненадлежащего качества Покупатель вправе предъявить требования, предусмотренные статьей 475 Гражданского кодекса Российской Федерации, если Поставщик без промедления не заменит Товар."),
      heading("Оплата"),
      clause("Покупатель оплачивает Товар в течение {{pay_days}} рабочих дней со дня его получения.", payIs("after")),
      clause("Покупатель вносит предоплату в размере полной стоимости Товара в течение {{pay_days}} рабочих дней со дня подписания договора.", payIs("prepay")),
      clause("Оплата производится платежным поручением на счет Поставщика."),
      heading("Ответственность Сторон"),
      clause("За просрочку поставки или оплаты виновная Сторона уплачивает другой Стороне неустойку {{penalty}}% от стоимости просроченного обязательства за каждый день просрочки, но не более {{penalty_cap}}% от этой стоимости."),
      clause("Сторона вправе отказаться от исполнения договора в случаях существенного нарушения договора другой Стороной, предусмотренных статьей 523 Гражданского кодекса Российской Федерации."),
      heading("Разрешение споров"),
      clause("До обращения в суд Сторона направляет другой Стороне письменную претензию. Срок ответа на претензию составляет {{claim_days}} календарных дней со дня ее направления."),
      clause("Спор передается на рассмотрение в {{venue}}.", filled("venue")),
      clause("Спор передается в суд по правилам подсудности, установленным законодательством Российской Федерации.", (values) => !filled("venue")(values)),
      heading("Заключительные положения"),
      clause("Договор вступает в силу с момента подписания Сторонами и действует до полного исполнения ими обязательств."),
      clause("Изменения договора действительны, если они совершены в письменной форме и подписаны обеими Сторонами."),
      ...closingClauses,
      heading("Реквизиты и подписи Сторон"),
      signatures({ prefix: "supplier", role: "Поставщик" }, { prefix: "buyer", role: "Покупатель" }),
    ],
  };

  /* ---------- Трудовой договор ---------- */

  const isFixed = (values) => (values.term || "unlimited") === "fixed";
  const hasProbation = filled("probation");
  const PROBATION_LIMIT = 3;
  const PROBATION_LIMIT_MANAGERS = 6;
  const PAY_PERIOD_LIMIT_DAYS = 15;

  const employment = {
    id: "employment",
    title: "Трудовой договор",
    category: "Трудовые отношения",
    summary: "Прием работника: обязательные условия статьи 57 ТК РФ, испытание, срочный договор.",
    reviewed: false,
    basis: [
      { lawId: "TK", number: "56" }, { lawId: "TK", number: "57" }, { lawId: "TK", number: "58" }, { lawId: "TK", number: "59" },
      { lawId: "TK", number: "67" }, { lawId: "TK", number: "68" }, { lawId: "TK", number: "70" }, { lawId: "TK", number: "91" },
      { lawId: "TK", number: "115" }, { lawId: "TK", number: "133" }, { lawId: "TK", number: "136" },
    ],
    notes: [
      "До подписания договора работника нужно ознакомить под роспись с правилами внутреннего трудового распорядка и другими локальными актами.",
      "Месячная зарплата при полной норме времени не может быть ниже МРОТ. Его размер устанавливается федеральным законом: проверьте актуальное значение.",
      "Условия труда на рабочем месте указываются по результатам специальной оценки условий труда.",
    ],
    sections: [
      { title: "Место и дата", fields: placeAndDate },
      { title: "Работодатель", fields: partyFields("employer", "Работодатель") },
      {
        title: "Работник",
        fields: [
          text("employee_name", "ФИО", { hint: "ФИО работника" }),
          text("employee_passport", "Паспорт: серия, номер, кем и когда выдан", { hint: "паспортные данные" }),
          text("employee_address", "Адрес регистрации", { hint: "адрес регистрации" }),
        ],
      },
      {
        title: "Работа",
        fields: [
          text("position", "Должность или профессия", { hint: "должность", help: "По штатному расписанию, с квалификацией" }),
          text("workplace", "Место работы", { hint: "место работы", help: "Организация и адрес, при работе в филиале также филиал" }),
          date("start", "Дата начала работы", { hint: "дата начала работы" }),
          select("term", "Срок договора", [
            { value: "unlimited", label: "На неопределенный срок" },
            { value: "fixed", label: "Срочный" },
          ], { default: "unlimited" }),
          date("end", "Окончание срочного договора", { hint: "дата окончания", when: isFixed }),
          text("fixed_reason", "Основание срочного договора", { hint: "основание по статье 59 ТК РФ", when: isFixed, help: "Например, на время отсутствия основного работника Сидоровой С. С." }),
          number("probation", "Испытание, месяцев", { hint: "срок испытания", optional: true }),
          { id: "manager", label: "Руководитель, заместитель или главный бухгалтер", type: "checkbox", when: hasProbation },
          text("conditions", "Условия труда на рабочем месте", { hint: "условия труда", default: "допустимые (класс 2) по результатам специальной оценки условий труда" }),
        ],
      },
      {
        title: "Оплата и время",
        fields: [
          money("salary", "Оклад в месяц, ₽", { hint: "оклад" }),
          number("pay_first", "Зарплата за первую половину месяца, число", { hint: "число месяца", default: "25" }),
          number("pay_second", "Зарплата за вторую половину, число следующего месяца", { hint: "число месяца", default: "10" }),
          text("schedule", "Режим работы", { hint: "режим работы", default: "пятидневная рабочая неделя продолжительностью 40 часов с выходными в субботу и воскресенье" }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20", employer_kind: "org", employer_org_name: "Общество с ограниченной ответственностью «Пример»", employer_ogrn: "0000000000000", employer_inn: "0000000000",
      employer_business_address: "г. Энск, ул. Промышленная, д. 1", employer_signer: "генерального директора Иванова И. И.", employer_authority: "устав", employer_short_signer: "Иванов И. И.",
      employee_name: "Петров Пётр Петрович", employee_passport: "0000 000002, выдан вымышленным отделом 11.11.2016", employee_address: "г. Энск, ул. Образцовая, д. 5",
      position: "менеджер по продажам", workplace: "ООО «Пример», г. Энск, ул. Промышленная, д. 1", start: "2026-12-01", term: "unlimited", probation: "3", salary: "90 000",
    },
    checks(values) {
      const result = [];
      const months = Number(values.probation);
      const limit = values.manager ? PROBATION_LIMIT_MANAGERS : PROBATION_LIMIT;
      if (hasProbation(values) && months > limit) {
        result.push({ level: "warning", text: `Срок испытания не может превышать ${limit === PROBATION_LIMIT ? "трех" : "шести"} месяцев, если иное не установлено федеральным законом.`, basis: { lawId: "TK", number: "70" } });
      }
      if (isFixed(values) && hasProbation(values)) {
        result.push({ level: "info", text: "При срочном договоре на два–шесть месяцев испытание не может превышать двух недель, а при договоре до двух месяцев не устанавливается.", basis: { lawId: "TK", number: "70" } });
      }
      if (Number(values.pay_second) > PAY_PERIOD_LIMIT_DAYS) {
        result.push({ level: "warning", text: "Зарплату нужно выплатить не позднее 15 календарных дней со дня окончания периода, за который она начислена.", basis: { lawId: "TK", number: "136" } });
      }
      if (kindOf(values, "employer") === "person") {
        result.push({ level: "info", text: "Шаблон рассчитан на работодателя-организацию или предпринимателя. У работодателя-гражданина есть особенности оформления." });
      }
      return result;
    },
    body: [
      title("ТРУДОВОЙ ДОГОВОР"),
      meta("г. {{city}}", "{{date}}"),
      paragraph((values) => `${partyIntro("employer", values)} (далее — «Работодатель»), с одной стороны, и {{employee_name}}, паспорт {{employee_passport}}, адрес регистрации: {{employee_address}} (далее — «Работник»), с другой стороны, заключили настоящий трудовой договор о следующем.`),
      heading("Предмет договора"),
      clause("Работодатель предоставляет Работнику работу по должности (профессии): {{position}}, а Работник обязуется лично выполнять эту трудовую функцию и соблюдать правила внутреннего трудового распорядка."),
      clause("Место работы: {{workplace}}."),
      clause("Дата начала работы: {{start}}."),
      clause("Договор заключен на неопределенный срок.", (values) => !isFixed(values)),
      clause("Договор заключен на срок до {{end}}. Основание заключения срочного трудового договора: {{fixed_reason}}.", isFixed),
      clause("Работнику устанавливается испытание. Срок испытания: {{probation}} мес.", hasProbation),
      clause("Работник принимается без испытания.", (values) => !hasProbation(values)),
      clause("Условия труда на рабочем месте: {{conditions}}."),
      heading("Оплата труда"),
      clause("Работнику устанавливается должностной оклад {{salary}} в месяц."),
      clause("Заработная плата выплачивается не реже чем каждые полмесяца: {{pay_first}} числа текущего месяца за первую половину месяца и {{pay_second}} числа следующего месяца за вторую половину месяца."),
      clause("При совпадении дня выплаты с выходным или нерабочим праздничным днем заработная плата выплачивается накануне этого дня."),
      heading("Рабочее время и время отдыха"),
      clause("Работнику устанавливается режим: {{schedule}}."),
      clause("Работнику предоставляется ежегодный основной оплачиваемый отпуск продолжительностью 28 календарных дней."),
      heading("Права и обязанности Сторон"),
      clause("Работник обязан добросовестно исполнять трудовые обязанности, соблюдать правила внутреннего трудового распорядка, трудовую дисциплину и требования охраны труда."),
      clause("Работодатель обязан предоставить Работнику работу, обусловленную договором, обеспечить безопасные условия труда и своевременно выплачивать заработную плату в полном размере."),
      clause("Работник подлежит обязательному социальному страхованию в соответствии с федеральными законами."),
      heading("Заключительные положения"),
      clause("Работник ознакомлен под роспись с правилами внутреннего трудового распорядка и иными локальными нормативными актами до подписания договора."),
      clause("Договор составлен в двух экземплярах, по одному для каждой из Сторон. Работник получил свой экземпляр, что подтверждает его подпись на экземпляре Работодателя."),
      heading("Подписи Сторон"),
      paragraph((values) => `Работодатель: ____________ / ${(values.employer_kind || "person") === "org" ? "{{employer_short_signer}}" : (values.employer_kind === "ip" ? "{{employer_ip_name}}" : "{{employer_name}}")}`),
      paragraph("Работник: ____________ / {{employee_name}}"),
      paragraph("Экземпляр договора получил: ____________ / {{employee_name}}"),
    ],
  };

  /* ---------- Иск потребителя ---------- */

  const PENALTY_PERCENT = 1;
  const RESPONSE_DAYS = 10;
  const FEE_FREE_LIMIT = 1000000 * 100;

  /** Неустойка 1% в день с одиннадцатого дня после претензии по дату расчета, но не более цены. */
  function consumerPenalty(values, helpers) {
    const price = helpers.parseMoney(values.price);
    const days = helpers.daysBetween(values.claim_date, values.calc_date);
    if (price === null || days === null) return null;
    const late = Math.max(0, days - RESPONSE_DAYS);
    return Math.min(Math.round((price * PENALTY_PERCENT * late) / 100), price);
  }

  const consumerPrice = (values, helpers) => {
    const penalty = consumerPenalty(values, helpers);
    const price = helpers.parseMoney(values.price);
    return penalty === null || price === null ? null : price + penalty;
  };

  const consumerSuit = {
    id: "consumer-suit",
    title: "Исковое заявление о защите прав потребителя",
    category: "Суд",
    summary: "Возврат денег за товар с недостатками, неустойка, моральный вред и штраф. Считает неустойку и цену иска.",
    reviewed: false,
    basis: [
      { lawId: "ZOZPP", number: "13" }, { lawId: "ZOZPP", number: "15" }, { lawId: "ZOZPP", number: "17" }, { lawId: "ZOZPP", number: "18" },
      { lawId: "ZOZPP", number: "22" }, { lawId: "ZOZPP", number: "23" }, { lawId: "GPK", number: "23" }, { lawId: "GPK", number: "29" },
      { lawId: "GPK", number: "131" }, { lawId: "GPK", number: "132" }, { lawId: "NK", number: "333.36" },
    ],
    notes: [
      "Иск можно подать по месту жительства или пребывания истца, по месту заключения или исполнения договора либо по адресу ответчика.",
      "Истцы по искам о защите прав потребителей освобождены от пошлины при цене иска до 1 000 000 рублей.",
      "Неустойка считается со дня, следующего за последним днем десятидневного срока на ответ. Сверьте даты с почтовыми документами.",
      "Суд может уменьшить неустойку по статье 333 ГК РФ.",
    ],
    sections: [
      { title: "Суд", fields: [text("court", "Суд", { hint: "наименование суда", help: "По цене иска до 100 000 рублей дело рассматривает мировой судья" })] },
      { title: "Истец", fields: courtPerson("plaintiff") },
      {
        title: "Ответчик",
        fields: [
          text("defendant_name", "Наименование продавца", { hint: "наименование ответчика" }),
          text("defendant_address", "Адрес", { hint: "адрес ответчика" }),
          text("defendant_ids", "ИНН и ОГРН", { hint: "ИНН и ОГРН ответчика" }),
        ],
      },
      {
        title: "Покупка и претензия",
        fields: [
          area("product", "Товар", { hint: "товар" }),
          date("purchase_date", "Дата покупки", { hint: "дата покупки" }),
          money("price", "Цена товара, ₽", { hint: "цена" }),
          area("defect", "Недостаток", { hint: "недостаток" }),
          date("claim_date", "Дата получения претензии продавцом", { hint: "дата получения претензии" }),
          text("answer", "Ответ на претензию", { hint: "ответ продавца", default: "ответа не последовало" }),
          date("calc_date", "Дата расчета неустойки", { hint: "дата расчета" }),
          money("moral", "Компенсация морального вреда, ₽", { hint: "компенсация морального вреда" }),
          area("attachments", "Приложения", { hint: "приложения", default: "копия кассового чека; копия претензии и доказательства ее вручения; расчет неустойки; документы о направлении ответчику копии иска" }),
          date("suit_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    computed: {
      penalty: { hint: "неустойка", field: "calc_date", value: (values, helpers) => { const value = consumerPenalty(values, helpers); return value === null ? null : helpers.kopecksText(value); } },
      price_total: { hint: "цена иска", field: "price", value: (values, helpers) => { const value = consumerPrice(values, helpers); return value === null ? null : helpers.kopecksText(value); } },
      fee: { hint: "государственная пошлина", field: "price", value: (values, helpers) => {
        const value = consumerPrice(values, helpers);
        if (value === null) return null;
        return value <= FEE_FREE_LIMIT ? "не уплачивается (подпункт 4 пункта 2 и пункт 3 статьи 333.36 НК РФ)" : helpers.kopecksText(helpers.claimFee(value) - helpers.claimFee(FEE_FREE_LIMIT));
      } },
    },
    example: {
      court: "Мировому судье судебного участка № 1 г. Энска", plaintiff_name: "Петров Пётр Петрович", plaintiff_birth: "20.06.1988, г. Энск", plaintiff_address: "г. Энск, ул. Образцовая, д. 5", plaintiff_id: "паспорт 0000 000002",
      defendant_name: "ООО «Вымышленный магазин»", defendant_address: "г. Энск, ул. Торговая, д. 10", defendant_ids: "ИНН 0000000000, ОГРН 0000000000000",
      product: "ноутбук «Пример», серийный номер 000000", purchase_date: "2026-10-30", price: "80 000", defect: "не включается после обновления", claim_date: "2026-11-09",
      calc_date: "2026-11-30", moral: "10 000", suit_date: "2026-11-30",
    },
    checks(values, helpers) {
      const result = [];
      const total = consumerPrice(values, helpers);
      if (total !== null && total > 100000 * 100) {
        result.push({ level: "info", text: "Цена иска больше 100 000 рублей: дело подсудно районному суду.", basis: { lawId: "GPK", number: "23" } });
      }
      const days = helpers.daysBetween(values.claim_date, values.calc_date);
      if (days !== null && days <= RESPONSE_DAYS) {
        result.push({ level: "warning", text: "Десятидневный срок на ответ еще не истек, неустойки пока нет.", basis: { lawId: "ZOZPP", number: "22" } });
      }
      return result;
    },
    body: [
      address("{{court}}"),
      ...courtPersonLines("Истец", "plaintiff"),
      address("Ответчик: {{defendant_name}}"),
      address("Адрес: {{defendant_address}}"),
      address("{{defendant_ids}}"),
      address("Цена иска: {{price_total}}"),
      address("Государственная пошлина: {{fee}}"),
      title("ИСКОВОЕ ЗАЯВЛЕНИЕ"),
      subtitle("о защите прав потребителя"),
      paragraph("{{purchase_date}} истец купил у ответчика товар: {{product}} по цене {{price}}."),
      paragraph("В товаре обнаружен недостаток: {{defect}}. При продаже он не был оговорен."),
      paragraph("Истец отказался от исполнения договора купли-продажи и потребовал вернуть уплаченную сумму. Претензия получена ответчиком {{claim_date}}, {{answer}}."),
      paragraph("Согласно пункту 1 статьи 18 Закона Российской Федерации от 07.02.1992 № 2300-1 «О защите прав потребителей» потребитель вправе отказаться от исполнения договора и потребовать возврата уплаченной суммы. Требование подлежало удовлетворению в течение десяти дней (статья 22 Закона)."),
      paragraph("За просрочку ответчик уплачивает неустойку в размере одного процента цены товара за каждый день (пункт 1 статьи 23 Закона). На {{calc_date}} неустойка составляет {{penalty}}, расчет приложен."),
      paragraph("Нарушением прав истцу причинен моральный вред, который он оценивает в {{moral}} (статья 15 Закона)."),
      paragraph("Иск предъявлен в соответствии с частью 7 статьи 29 Гражданского процессуального кодекса Российской Федерации."),
      paragraph("На основании изложенного, руководствуясь статьями 131 и 132 Гражданского процессуального кодекса Российской Федерации, прошу суд взыскать с ответчика в пользу истца:"),
      item("уплаченную за товар сумму {{price}};"),
      item("неустойку {{penalty}} по состоянию на {{calc_date}} и далее по день фактического исполнения обязательства;"),
      item("компенсацию морального вреда {{moral}};"),
      item("штраф в размере пятидесяти процентов от присужденной суммы (пункт 6 статьи 13 Закона)."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{plaintiff_name}}", "{{suit_date}}"),
    ],
  };

  /* ---------- Апелляционная жалоба ---------- */

  const APPEAL_FEE = { person: 3000 * 100, org: 15000 * 100 };

  const appeal = {
    id: "appeal",
    title: "Апелляционная жалоба",
    category: "Суд",
    summary: "На решение суда общей юрисдикции. Проверяет месячный срок и считает пошлину.",
    reviewed: false,
    basis: [
      { lawId: "GPK", number: "320" }, { lawId: "GPK", number: "321" }, { lawId: "GPK", number: "322" }, { lawId: "GPK", number: "323" },
      { lawId: "NK", number: "333.19" },
    ],
    notes: [
      "Жалоба подается через суд, принявший решение, в течение месяца со дня принятия решения в окончательной форме.",
      "Нельзя заявлять требования, которые не заявлялись в первой инстанции. Новые доказательства допускаются, только если обосновано, почему их нельзя было представить раньше.",
      "К жалобе прилагаются документ об уплате пошлины и доказательства направления копий другим лицам, участвующим в деле.",
      "Если срок пропущен, заявление о его восстановлении подается в суд апелляционной инстанции вместе с жалобой.",
    ],
    sections: [
      {
        title: "Суды и дело",
        fields: [
          text("appeal_court", "Суд апелляционной инстанции", { hint: "суд апелляционной инстанции", help: "Например, Энский областной суд" }),
          text("first_court", "Суд, принявший решение", { hint: "суд первой инстанции", help: "Как после слова «через»: Энский районный суд" }),
          text("case_number", "Номер дела", { hint: "номер дела" }),
          date("decision_date", "Дата решения", { hint: "дата решения" }),
          date("final_date", "Дата решения в окончательной форме", { hint: "дата изготовления решения" }),
          area("decision", "Что решил суд", { hint: "содержание решения" }),
        ],
      },
      {
        title: "Заявитель",
        fields: [
          text("appellant", "Кто подает жалобу", { hint: "ФИО или наименование" }),
          text("appellant_address", "Место жительства или адрес", { hint: "адрес заявителя" }),
          select("appellant_kind", "Заявитель", [
            { value: "person", label: "Физическое лицо" },
            { value: "org", label: "Организация" },
          ], { default: "person" }),
          select("role", "Положение в деле", [
            { value: "plaintiff", label: "Истец", text: "истец" },
            { value: "defendant", label: "Ответчик", text: "ответчик" },
            { value: "third", label: "Третье лицо", text: "третье лицо" },
          ], { default: "defendant" }),
        ],
      },
      {
        title: "Доводы и требования",
        fields: [
          area("grounds", "Почему решение неправильное", { hint: "основания жалобы", help: "Какие обстоятельства суд установил неверно, какие нормы применил неправильно" }),
          select("request", "О чем просите", [
            { value: "cancel", label: "Отменить решение и принять новое", text: "отменить решение суда и принять по делу новое решение" },
            { value: "change", label: "Изменить решение", text: "изменить решение суда" },
          ], { default: "cancel" }),
          area("new_decision", "Какое решение принять", { hint: "требование" }),
          area("attachments", "Приложения", { hint: "приложения", default: "документ об уплате государственной пошлины; документы о направлении копий жалобы лицам, участвующим в деле" }),
          date("appeal_date", "Дата жалобы", { hint: "дата жалобы" }),
        ],
      },
    ],
    computed: {
      fee: { hint: "государственная пошлина", field: "appellant_kind", value: (values, helpers) => helpers.kopecksText(APPEAL_FEE[values.appellant_kind || "person"]) },
    },
    example: {
      appeal_court: "Энский областной суд", first_court: "Энский районный суд", case_number: "2-000/2026", decision_date: "2026-10-20", final_date: "2026-10-27",
      decision: "взыскать с ответчика 300 000 рублей долга по договору займа", appellant: "Петров Пётр Петрович", appellant_address: "г. Энск, ул. Образцовая, д. 5",
      appellant_kind: "person", role: "defendant", grounds: "суд не учел расписку истца о частичном возврате 100 000 рублей, представленную в судебном заседании",
      request: "change", new_decision: "уменьшить взысканную сумму до 200 000 рублей", appeal_date: "2026-11-20",
    },
    checks(values, helpers) {
      const deadline = helpers.parseDate(values.final_date);
      const filed = helpers.parseDate(values.appeal_date);
      if (!deadline || !filed) return [];
      const last = new Date(deadline);
      last.setUTCMonth(last.getUTCMonth() + 1);
      if (filed > last) {
        return [{ level: "warning", text: "Месячный срок на апелляцию, по-видимому, истек. Приложите заявление о восстановлении срока, оно подается в суд апелляционной инстанции.", basis: { lawId: "GPK", number: "321" } }];
      }
      return [];
    },
    body: [
      address("В {{appeal_court}}"),
      address("через {{first_court}}"),
      address("Заявитель: {{appellant}}"),
      address("Адрес: {{appellant_address}}"),
      address("Дело № {{case_number}}"),
      address("Государственная пошлина: {{fee}}"),
      title("АПЕЛЛЯЦИОННАЯ ЖАЛОБА"),
      subtitle("на решение суда"),
      paragraph("Решением суда от {{decision_date}} по делу № {{case_number}} постановлено: {{decision}}. Решение в окончательной форме изготовлено {{final_date}}. Заявитель участвует в деле как {{role}}."),
      paragraph("С решением заявитель не согласен, поскольку {{grounds}}."),
      paragraph("На основании изложенного, руководствуясь статьями 320–322 Гражданского процессуального кодекса Российской Федерации, прошу {{request}}: {{new_decision}}."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{appellant}}", "{{appeal_date}}"),
    ],
  };

  root.TEMPLATES.push(supply, employment, consumerSuit, appeal);
})(typeof window !== "undefined" ? window : globalThis);
