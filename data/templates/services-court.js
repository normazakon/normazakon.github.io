/* Иск потребителя к исполнителю работ или услуг, заявление об отмене заочного решения,
   заявление о взыскании судебных расходов, заявление о выдаче дубликата исполнительного листа,
   заявление о переносе отпуска. */
(function (root) {
  "use strict";

  const { text, area, money, date, select, title, subtitle, paragraph, address, signatureLine, filled } = root.TemplateKit;
  const { courtPerson, courtPersonLines } = root.TemplateKit.court;

  /* ---------- Иск потребителя к исполнителю работ или услуг ---------- */

  const FEE_FREE_LIMIT = 1000000 * 100;
  const isDelay = (values) => (values.problem || "delay") === "delay";
  // требование о возврате денег исполнитель обязан удовлетворить за десять дней (пункт 1 статьи 31 ЗоЗПП)
  const ANSWER_DAYS = 10;

  /** Дни просрочки: при нарушении срока — со дня после срока, при недостатках — после десяти дней на ответ. */
  function serviceDays(values, helpers) {
    const days = isDelay(values)
      ? helpers.daysBetween(values.due_date, values.calc_date)
      : helpers.daysBetween(values.claim_date, values.calc_date);
    if (days === null) return null;
    return Math.max(0, isDelay(values) ? days : days - ANSWER_DAYS);
  }

  /** Неустойка 3 % цены услуги за день по пункту 5 статьи 28 ЗоЗПП в копейках, не больше цены услуги. */
  function servicePenalty(values, helpers) {
    const price = helpers.parseMoney(values.price);
    const days = serviceDays(values, helpers);
    if (price === null || days === null) return null;
    return Math.min(price, Math.round(price * 0.03 * days));
  }

  function servicePrice(values, helpers) {
    const refund = helpers.parseMoney(values.refund);
    const penalty = servicePenalty(values, helpers);
    if (refund === null || penalty === null) return null;
    return refund + penalty;
  }

  const servicesSuit = {
    id: "services-suit",
    title: "Исковое заявление к исполнителю работ или услуг",
    category: "Суд",
    summary: "Ремонт, пошив, химчистка, туристические и другие услуги: возврат денег, неустойка 3 % в день, моральный вред и штраф 50 %.",
    reviewed: false,
    basis: [
      { lawId: "ZOZPP", number: "28" }, { lawId: "ZOZPP", number: "29" }, { lawId: "ZOZPP", number: "31" }, { lawId: "ZOZPP", number: "13" },
      { lawId: "ZOZPP", number: "15" }, { lawId: "ZOZPP", number: "17" }, { lawId: "GPK", number: "29" }, { lawId: "NK", number: "333.36" },
    ],
    notes: [
      "Перед иском направьте исполнителю претензию: без нее суд не взыщет штраф 50 % за неудовлетворение требований добровольно.",
      "Неустойка — 3 % цены работы или услуги за каждый день просрочки, но не больше самой цены. Если цена в договоре не определена, — от общей цены заказа.",
      "Иск можно подать по своему месту жительства. При цене иска до 100 000 рублей он подается мировому судье. Пошлину при цене до 1 000 000 рублей платить не нужно.",
    ],
    sections: [
      { title: "Суд", fields: [text("court", "Суд", { hint: "наименование суда", help: "Например, Мировому судье судебного участка № 1 г. Энска" })] },
      { title: "Истец", fields: courtPerson("plaintiff") },
      {
        title: "Исполнитель",
        fields: [
          text("contractor", "Наименование", { hint: "исполнитель" }),
          text("contractor_address", "Адрес", { hint: "адрес исполнителя" }),
          text("contractor_ids", "ИНН и ОГРН", { hint: "ИНН и ОГРН" }),
        ],
      },
      {
        title: "Договор и нарушение",
        fields: [
          text("contract", "Договор", { hint: "номер и дата договора", help: "Например, договор № 00 от 01.08.2026 или квитанция-договор № 000" }),
          area("service", "Какая работа или услуга", { hint: "работа или услуга" }),
          money("price", "Цена работы или услуги, ₽", { hint: "цена" }),
          select("problem", "Что произошло", [
            { value: "delay", label: "Нарушен срок" },
            { value: "defect", label: "Работа выполнена с недостатками" },
          ], { default: "delay" }),
          date("due_date", "Срок выполнения по договору", { hint: "срок выполнения", when: isDelay }),
          area("defect", "Недостатки", { hint: "недостатки", when: (values) => !isDelay(values) }),
          date("claim_date", "Когда исполнитель получил претензию", { hint: "дата получения претензии" }),
          text("answer", "Ответ на претензию", { hint: "ответ исполнителя", default: "ответа не последовало" }),
          money("refund", "Сколько вернуть, ₽", { hint: "сумма к возврату", help: "Уплаченная сумма или расходы на устранение недостатков" }),
          date("calc_date", "Дата расчета неустойки", { hint: "дата расчета" }),
          money("moral", "Компенсация морального вреда, ₽", { hint: "компенсация морального вреда" }),
        ],
      },
      {
        title: "Подача",
        fields: [
          area("attachments", "Приложения", { hint: "приложения", default: "копия договора; документы об оплате; копия претензии и доказательства ее получения; расчет неустойки; документы о направлении ответчику копии иска" }),
          date("suit_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    computed: {
      days: { hint: "дни просрочки", field: "calc_date", value: (values, helpers) => {
        const days = serviceDays(values, helpers);
        return days === null ? null : String(days);
      } },
      penalty: { hint: "неустойка", field: "calc_date", value: (values, helpers) => {
        const value = servicePenalty(values, helpers);
        return value === null ? null : helpers.kopecksText(value);
      } },
      price_total: { hint: "цена иска", field: "refund", value: (values, helpers) => {
        const value = servicePrice(values, helpers);
        return value === null ? null : helpers.kopecksText(value);
      } },
      fee: { hint: "государственная пошлина", field: "refund", value: (values, helpers) => {
        const value = servicePrice(values, helpers);
        if (value === null) return null;
        return value <= FEE_FREE_LIMIT
          ? "не уплачивается (подпункт 4 пункта 2 и пункт 3 статьи 333.36 НК РФ)"
          : helpers.kopecksText(helpers.claimFee(value) - helpers.claimFee(FEE_FREE_LIMIT));
      } },
    },
    example: {
      court: "Мировому судье судебного участка № 1 г. Энска", plaintiff_name: "Петров Пётр Петрович", plaintiff_birth: "20.06.1988, г. Энск", plaintiff_address: "г. Энск, ул. Образцовая, д. 5", plaintiff_id: "паспорт 0000 000002",
      contractor: "ООО «Вымышленный ремонт»", contractor_address: "г. Энск, ул. Мастеровая, д. 4", contractor_ids: "ИНН 0000000000, ОГРН 0000000000000",
      contract: "договор № 00 от 01.08.2026", service: "ремонт ванной комнаты: замена плитки и сантехники", price: "60 000", problem: "delay", due_date: "2026-10-01",
      defect: "плитка отходит от стены, швы негерметичны", claim_date: "2026-10-20", answer: "ответа не последовало", refund: "60 000", calc_date: "2026-10-21", moral: "10 000",
      attachments: "копия договора; документы об оплате; копия претензии и доказательства ее получения; расчет неустойки; документы о направлении ответчику копии иска", suit_date: "2026-11-16",
    },
    checks(values, helpers) {
      const result = [];
      const total = servicePrice(values, helpers);
      if (total !== null && total <= 100000 * 100) result.push({ level: "info", text: "Цена иска не больше 100 000 рублей: дело подсудно мировому судье.", basis: { lawId: "GPK", number: "23" } });
      if (total !== null && total > 100000 * 100) result.push({ level: "info", text: "Цена иска больше 100 000 рублей: дело подсудно районному суду.", basis: { lawId: "GPK", number: "23" } });
      return result;
    },
    body: [
      address("{{court}}"),
      ...courtPersonLines("Истец", "plaintiff"),
      address("Ответчик: {{contractor}}"),
      address("Адрес: {{contractor_address}}"),
      address("{{contractor_ids}}"),
      address("Цена иска: {{price_total}}"),
      address("Государственная пошлина: {{fee}}"),
      title("ИСКОВОЕ ЗАЯВЛЕНИЕ"),
      subtitle("о защите прав потребителя"),
      paragraph("Между истцом и ответчиком заключен {{contract}}, по которому ответчик обязался выполнить работу (оказать услугу): {{service}}. Цена составляет {{price}} и оплачена истцом."),
      paragraph("Работа должна была быть выполнена не позднее {{due_date}}, однако в установленный срок не выполнена.", isDelay),
      paragraph("Работа выполнена с недостатками: {{defect}}.", (values) => !isDelay(values)),
      paragraph("Претензия истца получена ответчиком {{claim_date}}, {{answer}}. Требования в добровольном порядке не удовлетворены."),
      paragraph("Согласно пункту 1 статьи 28 Закона Российской Федерации «О защите прав потребителей» при нарушении сроков выполнения работы потребитель вправе отказаться от исполнения договора и потребовать возврата уплаченной суммы. Истец от исполнения договора отказался.", isDelay),
      paragraph("Согласно пункту 1 статьи 29 Закона Российской Федерации «О защите прав потребителей» при обнаружении недостатков выполненной работы потребитель вправе потребовать возмещения расходов на их устранение или отказаться от исполнения договора и потребовать возврата уплаченной суммы. Требование подлежало удовлетворению в десятидневный срок (пункт 1 статьи 31 Закона).", (values) => !isDelay(values)),
      paragraph("За нарушение сроков ответчик уплачивает неустойку в размере трех процентов цены работы за каждый день просрочки, но не более цены работы (пункт 5 статьи 28 Закона). На {{calc_date}} просрочка составляет {{days}} дн., неустойка — {{penalty}}."),
      paragraph("Нарушением прав потребителя истцу причинен моральный вред, который он оценивает в {{moral}} (статья 15 Закона)."),
      paragraph("На основании статей 13, 15, 28, 29 и 31 Закона Российской Федерации «О защите прав потребителей», руководствуясь статьями 29, 131 и 132 Гражданского процессуального кодекса Российской Федерации, прошу суд взыскать с ответчика в пользу истца:"),
      paragraph("1) уплаченную сумму (расходы на устранение недостатков) в размере {{refund}};"),
      paragraph("2) неустойку в размере {{penalty}};"),
      paragraph("3) компенсацию морального вреда в размере {{moral}};"),
      paragraph("4) штраф в размере пятидесяти процентов от присужденной суммы за несоблюдение в добровольном порядке требований потребителя (пункт 6 статьи 13 Закона)."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{plaintiff_name}}", "{{suit_date}}"),
    ],
  };

  /* ---------- Заявление об отмене заочного решения ---------- */

  const DEFAULT_TERM = 7;

  const defaultJudgment = {
    id: "default-judgment",
    title: "Заявление об отмене заочного решения",
    category: "Суд",
    summary: "Если суд решил дело без вас: уважительная причина неявки и доводы, которые могут изменить решение. Срок — семь дней.",
    reviewed: false,
    basis: [{ lawId: "GPK", number: "237" }, { lawId: "GPK", number: "238" }, { lawId: "GPK", number: "242" }, { lawId: "GPK", number: "112" }],
    notes: [
      "Заявление подается в суд, принявший заочное решение, в течение семи дней со дня, когда вам вручили его копию.",
      "Нужно показать сразу две вещи: что вы не пришли по уважительной причине и не могли сообщить об этом суду, и что у вас есть доводы и доказательства, которые могут изменить решение.",
      "Если суд откажет в отмене, решение можно обжаловать в апелляцию в течение месяца после такого отказа.",
      "Приложите копии заявления по числу лиц, участвующих в деле.",
    ],
    sections: [
      {
        title: "Суд и дело",
        fields: [
          text("court", "Суд", { hint: "наименование суда" }),
          text("case_number", "Номер дела", { hint: "номер дела" }),
          date("decision_date", "Дата заочного решения", { hint: "дата решения" }),
          date("received_date", "Когда вручили копию", { hint: "дата получения копии" }),
          area("decision", "Что решил суд", { hint: "содержание решения", help: "Например, взыскать с ответчика задолженность 150 000 рублей" }),
        ],
      },
      {
        title: "Заявитель",
        fields: [
          text("defendant", "Ответчик", { hint: "ФИО или наименование ответчика" }),
          text("defendant_address", "Адрес", { hint: "адрес ответчика" }),
          text("plaintiff", "Истец", { hint: "ФИО или наименование истца" }),
        ],
      },
      {
        title: "Доводы",
        fields: [
          area("reason", "Почему не пришли в заседание", { hint: "уважительная причина неявки", help: "Например, не получал извещений, так как с июня 2026 года проживаю по другому адресу; находился в больнице" }),
          area("reason_evidence", "Чем подтверждается причина", { hint: "доказательства уважительности" }),
          area("arguments", "Почему решение может быть другим", { hint: "доводы по существу", help: "Например, долг погашен 01.06.2026, что подтверждается распиской истца" }),
          area("arguments_evidence", "Доказательства по существу", { hint: "доказательства" }),
          date("application_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    example: {
      court: "Энский районный суд", case_number: "2-000/2026", decision_date: "2026-10-28", received_date: "2026-11-12",
      decision: "взыскать с Петрова П. П. в пользу Иванова И. И. задолженность по договору займа 150 000 рублей",
      defendant: "Петров Пётр Петрович", defendant_address: "г. Энск, ул. Образцовая, д. 5", plaintiff: "Иванов Иван Иванович",
      reason: "извещений о судебном заседании не получал: с июня 2026 года проживаю по адресу г. Энск, ул. Образцовая, д. 5, а повестки направлялись по прежнему адресу",
      reason_evidence: "договор найма жилого помещения от 01.06.2026", arguments: "долг возвращен истцу 01.09.2026 в полном объеме",
      arguments_evidence: "расписка истца в получении денежных средств от 01.09.2026", application_date: "2026-11-16",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.received_date, values.application_date);
      if (days !== null && days > DEFAULT_TERM) {
        return [{ level: "warning", text: "С вручения копии прошло больше семи дней. Попросите восстановить срок и объясните причину пропуска, — для этого есть шаблон заявления о восстановлении срока.", basis: { lawId: "GPK", number: "237" } }];
      }
      return [];
    },
    body: [
      address("В {{court}}"),
      address("Дело № {{case_number}}"),
      address("Ответчик: {{defendant}}"),
      address("Адрес: {{defendant_address}}"),
      address("Истец: {{plaintiff}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("об отмене заочного решения"),
      paragraph("{{decision_date}} судом вынесено заочное решение по делу № {{case_number}} по иску {{plaintiff}} к {{defendant}}: {{decision}}. Копия заочного решения получена ответчиком {{received_date}}."),
      paragraph("Ответчик не явился в судебное заседание по уважительной причине и не имел возможности своевременно сообщить о ней суду: {{reason}}. Это подтверждается: {{reason_evidence}}."),
      paragraph("Ответчик ссылается на обстоятельства, которые могут повлиять на содержание решения суда: {{arguments}}. Это подтверждается: {{arguments_evidence}}."),
      paragraph("На основании статей 237, 238 и 242 Гражданского процессуального кодекса Российской Федерации прошу отменить заочное решение от {{decision_date}} по делу № {{case_number}} и возобновить рассмотрение дела по существу."),
      paragraph("Приложения: копии документов, подтверждающих изложенные обстоятельства; копии заявления по числу лиц, участвующих в деле."),
      signatureLine("{{defendant}}", "{{application_date}}"),
    ],
  };

  /* ---------- Заявление о взыскании судебных расходов ---------- */

  const COSTS_MONTHS_DAYS = 92;

  const courtCosts = {
    id: "court-costs",
    title: "Заявление о взыскании судебных расходов",
    category: "Суд",
    summary: "После выигранного дела: расходы на представителя, экспертизу, почту и проезд. Подается в течение трех месяцев.",
    reviewed: false,
    basis: [{ lawId: "GPK", number: "88" }, { lawId: "GPK", number: "94" }, { lawId: "GPK", number: "98" }, { lawId: "GPK", number: "100" }, { lawId: "GPK", number: "103.1" }],
    notes: [
      "Заявление подается в суд первой инстанции в течение трех месяцев со дня вступления в силу последнего судебного акта по делу.",
      "Расходы на представителя суд взыскивает в разумных пределах. Приложите договор, акт об оказанных услугах и документы об оплате.",
      "Если иск удовлетворен частично, расходы возмещаются пропорционально удовлетворенной части требований.",
    ],
    sections: [
      {
        title: "Суд и дело",
        fields: [
          text("court", "Суд", { hint: "наименование суда" }),
          text("case_number", "Номер дела", { hint: "номер дела" }),
          date("decision_date", "Дата решения", { hint: "дата решения" }),
          date("final_date", "Дата вступления последнего акта в силу", { hint: "дата вступления в силу" }),
          area("outcome", "Чем закончилось дело", { hint: "результат", help: "Например, иск Иванова И. И. удовлетворен полностью" }),
        ],
      },
      {
        title: "Стороны",
        fields: [
          text("applicant", "Заявитель", { hint: "заявитель" }),
          text("applicant_address", "Адрес", { hint: "адрес заявителя" }),
          text("other", "С кого взыскать", { hint: "другая сторона" }),
          text("other_address", "Адрес", { hint: "адрес другой стороны" }),
        ],
      },
      {
        title: "Расходы",
        fields: [
          money("lawyer", "На представителя, ₽", { hint: "расходы на представителя", optional: true }),
          text("lawyer_docs", "Документы об оплате представителя", { hint: "документы", optional: true, help: "Например, договор от 01.06.2026, акт от 30.10.2026, квитанция" }),
          money("expert", "На экспертизу, ₽", { hint: "расходы на экспертизу", optional: true }),
          money("postal", "Почтовые расходы, ₽", { hint: "почтовые расходы", optional: true }),
          money("travel", "Проезд и проживание, ₽", { hint: "расходы на проезд", optional: true }),
          date("application_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    computed: {
      total: { hint: "итого расходов", field: "lawyer", value: (values, helpers) => {
        let total = 0;
        for (const id of ["lawyer", "expert", "postal", "travel"]) {
          if (!String(values[id] || "").trim()) continue;
          const kopecks = helpers.parseMoney(values[id]);
          if (kopecks === null) return null;
          total += kopecks;
        }
        return total ? helpers.kopecksText(total) : null;
      } },
    },
    example: {
      court: "Энский районный суд", case_number: "2-000/2026", decision_date: "2026-09-28", final_date: "2026-10-30", outcome: "иск Иванова И. И. удовлетворен полностью",
      applicant: "Иванов Иван Иванович", applicant_address: "г. Энск, ул. Примерная, д. 1, кв. 1", other: "Петров Пётр Петрович", other_address: "г. Энск, ул. Образцовая, д. 5",
      lawyer: "30 000", lawyer_docs: "договор об оказании юридических услуг от 01.06.2026, акт от 30.10.2026, квитанция об оплате", expert: "", postal: "580", travel: "", application_date: "2026-11-16",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.final_date, values.application_date);
      if (days !== null && days > COSTS_MONTHS_DAYS) {
        return [{ level: "warning", text: "С вступления последнего акта в силу прошло больше трех месяцев. Срок можно восстановить только по уважительной причине.", basis: { lawId: "GPK", number: "103.1" } }];
      }
      return [];
    },
    body: [
      address("В {{court}}"),
      address("Дело № {{case_number}}"),
      address("Заявитель: {{applicant}}"),
      address("Адрес: {{applicant_address}}"),
      address("Заинтересованное лицо: {{other}}"),
      address("Адрес: {{other_address}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("о взыскании судебных расходов"),
      paragraph("Решением суда от {{decision_date}} по делу № {{case_number}}: {{outcome}}. Решение вступило в законную силу {{final_date}}. Вопрос о судебных расходах при рассмотрении дела не разрешался."),
      paragraph("В связи с рассмотрением дела заявитель понес следующие расходы:"),
      paragraph("— на оплату услуг представителя: {{lawyer}} ({{lawyer_docs}});", filled("lawyer")),
      paragraph("— на оплату экспертизы: {{expert}};", filled("expert")),
      paragraph("— почтовые расходы: {{postal}};", filled("postal")),
      paragraph("— расходы на проезд и проживание: {{travel}}.", filled("travel")),
      paragraph("Всего: {{total}}."),
      paragraph("Согласно статьям 98 и 100 Гражданского процессуального кодекса Российской Федерации стороне, в пользу которой состоялось решение, суд присуждает возместить с другой стороны понесенные судебные расходы, а расходы на представителя — в разумных пределах."),
      paragraph("На основании статей 88, 94, 98, 100 и 103.1 Гражданского процессуального кодекса Российской Федерации прошу взыскать с {{other}} в пользу заявителя судебные расходы в размере {{total}}."),
      paragraph("Приложения: документы, подтверждающие расходы; документы о направлении копии заявления другой стороне."),
      signatureLine("{{applicant}}", "{{application_date}}"),
    ],
  };

  /* ---------- Заявление о выдаче дубликата исполнительного листа ---------- */

  const lostByBailiff = (values) => values.lost_by === "bailiff";

  const writDuplicate = {
    id: "writ-duplicate",
    title: "Заявление о выдаче дубликата исполнительного листа",
    category: "Суд",
    summary: "Если исполнительный лист или судебный приказ потерялся: у вас, на почте или у приставов.",
    reviewed: false,
    basis: [{ lawId: "GPK", number: "430" }, { lawId: "FZ229", number: "21" }],
    notes: [
      "Заявление подается в суд, принявший решение, до истечения срока предъявления листа к исполнению. Если лист потеряли приставы или другой исполнитель, — в течение месяца со дня, когда вы узнали об утрате.",
      "Подтвердите утрату: справкой приставов, ответом почты, актом об утрате.",
      "Суд рассматривает заявление в заседании в течение десяти дней.",
    ],
    sections: [
      {
        title: "Суд и дело",
        fields: [
          text("court", "Суд", { hint: "наименование суда" }),
          text("case_number", "Номер дела", { hint: "номер дела" }),
          date("decision_date", "Дата решения", { hint: "дата решения" }),
          area("decision", "Что взыскано", { hint: "что взыскано" }),
          text("writ", "Утраченный документ", { hint: "исполнительный документ", help: "Например, исполнительный лист ФС № 000000000 от 30.10.2026" }),
        ],
      },
      {
        title: "Заявитель и утрата",
        fields: [
          text("creditor", "Взыскатель", { hint: "взыскатель" }),
          text("creditor_address", "Адрес", { hint: "адрес взыскателя" }),
          text("debtor", "Должник", { hint: "должник" }),
          select("lost_by", "Кто потерял", [
            { value: "creditor", label: "Взыскатель" },
            { value: "bailiff", label: "Приставы или другой исполнитель" },
            { value: "post", label: "Почта" },
          ], { default: "bailiff" }),
          date("learned_date", "Когда узнали об утрате", { hint: "дата" }),
          area("circumstances", "Обстоятельства утраты", { hint: "обстоятельства" }),
          area("evidence", "Чем подтверждается", { hint: "доказательства" }),
          date("application_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    example: {
      court: "Энский районный суд", case_number: "2-000/2026", decision_date: "2026-03-28",
      decision: "взыскать с Петрова П. П. в пользу Иванова И. И. задолженность 150 000 рублей", writ: "исполнительный лист ФС № 000000000 от 30.04.2026",
      creditor: "Иванов Иван Иванович", creditor_address: "г. Энск, ул. Примерная, д. 1, кв. 1", debtor: "Петров Пётр Петрович",
      lost_by: "bailiff", learned_date: "2026-11-05", circumstances: "исполнительное производство окончено, однако исполнительный лист взыскателю не возвращен; по ответу отдела судебных приставов лист утрачен",
      evidence: "ответ Энского РОСП от 05.11.2026", application_date: "2026-11-16",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.learned_date, values.application_date);
      if (lostByBailiff(values) && days !== null && days > 31) {
        return [{ level: "warning", text: "Со дня, когда вы узнали об утрате листа приставами, прошло больше месяца. Попросите восстановить срок.", basis: { lawId: "GPK", number: "430" } }];
      }
      return [];
    },
    body: [
      address("В {{court}}"),
      address("Дело № {{case_number}}"),
      address("Взыскатель: {{creditor}}"),
      address("Адрес: {{creditor_address}}"),
      address("Должник: {{debtor}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("о выдаче дубликата исполнительного листа"),
      paragraph("Решением суда от {{decision_date}} по делу № {{case_number}} постановлено: {{decision}}. Взыскателю выдан {{writ}}."),
      paragraph("Исполнительный документ утрачен: {{circumstances}}. Об утрате взыскателю стало известно {{learned_date}}. Это подтверждается: {{evidence}}."),
      paragraph("Решение суда до настоящего времени не исполнено. Срок предъявления исполнительного документа к исполнению не истек.", (values) => !lostByBailiff(values)),
      paragraph("Решение суда до настоящего времени не исполнено. Исполнительный документ утрачен судебным приставом-исполнителем, заявление подается в течение месяца со дня, когда взыскателю стало известно об утрате.", lostByBailiff),
      paragraph("На основании статьи 430 Гражданского процессуального кодекса Российской Федерации прошу выдать дубликат исполнительного листа по делу № {{case_number}}."),
      paragraph("Приложения: документы, подтверждающие утрату исполнительного документа."),
      signatureLine("{{creditor}}", "{{application_date}}"),
    ],
  };

  /* ---------- Заявление о переносе отпуска ---------- */

  const POSTPONE_REASONS = [
    { value: "sick", label: "Заболел во время отпуска", text: "в связи с временной нетрудоспособностью в период отпуска" },
    { value: "late_pay", label: "Отпускные выплачены не вовремя", text: "в связи с тем, что оплата за время отпуска не была произведена не позднее чем за три дня до его начала" },
    { value: "late_notice", label: "Предупредили позже чем за две недели", text: "в связи с тем, что о времени начала отпуска мне сообщили позднее чем за две недели до его начала" },
    { value: "other", label: "По другой причине, по договоренности", text: "по семейным обстоятельствам" },
  ];

  const vacationPostpone = {
    id: "vacation-postpone",
    title: "Заявление о переносе или продлении отпуска",
    category: "Трудовые отношения",
    summary: "Если заболели в отпуске, отпускные пришли поздно или о начале отпуска предупредили меньше чем за две недели.",
    reviewed: false,
    basis: [{ lawId: "TK", number: "124" }, { lawId: "TK", number: "123" }, { lawId: "TK", number: "136" }],
    notes: [
      "При болезни во время отпуска работодатель обязан продлить отпуск или перенести его на другой срок с учетом пожеланий работника.",
      "Если отпускные не выплатили за три дня до начала отпуска или о его начале предупредили позже чем за две недели, работодатель по заявлению работника обязан перенести отпуск на согласованный срок.",
      "В остальных случаях перенос возможен только по договоренности с работодателем.",
    ],
    sections: [
      {
        title: "Работодатель и работник",
        fields: [
          text("employer", "Работодатель", { hint: "наименование работодателя" }),
          text("head", "Кому адресовано", { hint: "должность и ФИО руководителя", help: "В дательном падеже, например генеральному директору Петрову П. П." }),
          text("employee", "Работник", { hint: "ФИО работника", help: "В родительном падеже, например Иванова Ивана Ивановича" }),
          text("position", "Должность", { hint: "должность", help: "В родительном падеже, например менеджера" }),
          text("employee_short", "Подпись: фамилия и инициалы", { hint: "фамилия и инициалы" }),
        ],
      },
      {
        title: "Отпуск",
        fields: [
          select("reason", "Причина", POSTPONE_REASONS, { default: "sick" }),
          date("planned_start", "Отпуск по графику с", { hint: "дата начала по графику" }),
          select("mode", "Как поступить", [
            { value: "postpone", label: "Перенести на другие даты" },
            { value: "extend", label: "Продлить на дни болезни" },
          ], { default: "postpone", when: (values) => (values.reason || "sick") === "sick" }),
          date("new_start", "Новые даты: с", { hint: "новая дата начала", when: (values) => !((values.reason || "sick") === "sick" && values.mode === "extend") }),
          text("sick_days", "Дни болезни", { hint: "период болезни", help: "Например, с 02.12.2026 по 08.12.2026, листок нетрудоспособности № 000", when: (values) => (values.reason || "sick") === "sick" }),
          date("application_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    example: {
      employer: "ООО «Пример»", head: "генеральному директору Петрову П. П.", employee: "Иванова Ивана Ивановича", position: "менеджера", employee_short: "Иванов И. И.",
      reason: "sick", planned_start: "2026-12-01", mode: "postpone", new_start: "2027-02-01", sick_days: "с 02.12.2026 по 08.12.2026, листок нетрудоспособности № 000", application_date: "2026-12-09",
    },
    checks: () => [],
    body: [
      address("{{head}}"),
      address("{{employer}}"),
      address("от {{employee}}"),
      address("{{position}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("о переносе ежегодного оплачиваемого отпуска", (values) => !((values.reason || "sick") === "sick" && values.mode === "extend")),
      subtitle("о продлении ежегодного оплачиваемого отпуска", (values) => (values.reason || "sick") === "sick" && values.mode === "extend"),
      paragraph("Ежегодный оплачиваемый отпуск был предоставлен мне с {{planned_start}}. В период отпуска наступила моя временная нетрудоспособность: {{sick_days}}.", (values) => (values.reason || "sick") === "sick"),
      paragraph("На основании статьи 124 Трудового кодекса Российской Федерации прошу продлить ежегодный оплачиваемый отпуск на количество дней нетрудоспособности.", (values) => (values.reason || "sick") === "sick" && values.mode === "extend"),
      paragraph("На основании статьи 124 Трудового кодекса Российской Федерации прошу перенести неиспользованную часть ежегодного оплачиваемого отпуска на период с {{new_start}}.", (values) => (values.reason || "sick") === "sick" && values.mode !== "extend"),
      paragraph("На основании статьи 124 Трудового кодекса Российской Федерации прошу перенести ежегодный оплачиваемый отпуск, запланированный с {{planned_start}}, на период с {{new_start}} {{reason}}.", (values) => values.reason === "late_pay" || values.reason === "late_notice"),
      paragraph("Прошу перенести ежегодный оплачиваемый отпуск, запланированный с {{planned_start}}, на период с {{new_start}} {{reason}}.", (values) => values.reason === "other"),
      signatureLine("{{employee_short}}", "{{application_date}}"),
    ],
  };

  root.TEMPLATES.push(servicesSuit, defaultJudgment, courtCosts, writDuplicate, vacationPostpone);
})(typeof window !== "undefined" ? window : globalThis);
