/* Иск о неустойке по договору долевого участия, мировое соглашение, заявление о выдаче копии решения,
   расписка о возврате долга, договор хранения. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, number, title, subtitle, meta, heading, clause, paragraph, address, signatureLine,
    personFields, personIntro, personSignatures, placeAndDate, closingClauses, filled,
  } = root.TemplateKit;
  const { courtPerson, courtPersonLines } = root.TemplateKit.court;

  const ROLES = [
    { value: "plaintiff", label: "Истец", text: "истцом" },
    { value: "defendant", label: "Ответчик", text: "ответчиком" },
    { value: "third", label: "Третье лицо", text: "третьим лицом" },
  ];

  /** Процент из строки: «7,5» и «7.5 %» → 7.5. */
  function parsePercent(value) {
    const match = /^(\d+(?:[.,]\d+)?)\s*%?$/.exec(String(value || "").trim());
    return match ? Number(match[1].replace(",", ".")) : null;
  }

  /* ---------- Иск о взыскании неустойки по договору долевого участия ---------- */

  // истцы-потребители не платят пошлину при цене иска до миллиона рублей, в копейках
  const FEE_FREE_LIMIT = 1000000 * 100;

  /** Дни просрочки: со дня после срока передачи по дату передачи или расчета, без исключаемых дней. */
  function overdueDays(values, helpers) {
    const days = helpers.daysBetween(values.due_date, values.end_date);
    if (days === null) return null;
    const excluded = Number(String(values.excluded_days || "0").trim() || 0);
    if (!Number.isInteger(excluded) || excluded < 0) return null;
    return Math.max(0, days - excluded);
  }

  /** Неустойка по части 2 статьи 6 214-ФЗ в копейках: 1/300 ставки от цены договора за день, гражданину в двойном размере. */
  function dduPenalty(values, helpers) {
    const price = helpers.parseMoney(values.price);
    const rate = parsePercent(values.rate);
    const days = overdueDays(values, helpers);
    if (price === null || rate === null || days === null) return null;
    return Math.round((price * rate) / 100 / 300 * 2 * days);
  }

  const dduSuit = {
    id: "ddu-penalty-suit",
    title: "Исковое заявление о взыскании неустойки по договору долевого участия",
    category: "Суд",
    summary: "Если застройщик опоздал с передачей квартиры. Считает неустойку и пошлину, просит штраф и моральный вред.",
    reviewed: false,
    basis: [
      { lawId: "FZ214", number: "6" }, { lawId: "FZ214", number: "10" }, { lawId: "FZ214", number: "8" },
      { lawId: "GPK", number: "29" }, { lawId: "GPK", number: "23" }, { lawId: "NK", number: "333.36" },
    ],
    notes: [
      "Неустойка — одна трехсотая ставки рефинансирования (ключевой ставки) Банка России, действовавшей на день, когда квартиру должны были передать, от цены договора за каждый день просрочки. Гражданину она уплачивается в двойном размере.",
      "В отдельные периоды начисление неустойки по договорам долевого участия приостанавливалось постановлениями Правительства. Проверьте, не попадает ли просрочка на такие периоды, и укажите эти дни в поле «Дни, за которые неустойка не начисляется».",
      "Штраф 5 % от присужденной суммы суд взыскивает, если застройщик не удовлетворил требования добровольно, поэтому сначала направьте ему претензию.",
      "Иск можно подать по своему месту жительства. При цене иска до 100 000 рублей он подается мировому судье, выше — в районный суд.",
    ],
    sections: [
      { title: "Суд", fields: [text("court", "Суд", { hint: "наименование суда", help: "Например, Энский районный суд" })] },
      { title: "Истец", fields: courtPerson("plaintiff") },
      {
        title: "Застройщик",
        fields: [
          text("developer", "Наименование", { hint: "наименование застройщика" }),
          text("developer_address", "Адрес", { hint: "адрес застройщика" }),
          text("developer_ids", "ИНН и ОГРН", { hint: "ИНН и ОГРН" }),
        ],
      },
      {
        title: "Договор и просрочка",
        fields: [
          text("contract", "Договор", { hint: "номер и дата договора", help: "Например, № 00-ДДУ от 15.03.2024" }),
          area("object", "Объект", { hint: "объект долевого строительства", help: "Например, квартира № 15 в жилом доме по адресу г. Энск, ул. Новая, д. 1" }),
          money("price", "Цена договора, ₽", { hint: "цена договора" }),
          date("due_date", "Срок передачи по договору", { hint: "срок передачи" }),
          select("transferred", "Квартира передана?", [
            { value: "yes", label: "Передана" },
            { value: "no", label: "Еще не передана" },
          ], { default: "yes" }),
          date("end_date", "Дата передачи или дата расчета", { hint: "дата окончания расчета", help: "Если квартира передана — дата передаточного акта, если нет — дата, на которую считаете неустойку" }),
          text("rate", "Ставка Банка России на день передачи по договору, %", { hint: "ставка", help: "Например, 7,5" }),
          number("excluded_days", "Дни, за которые неустойка не начисляется", { hint: "число дней", default: "0", optional: true, help: "Периоды, когда начисление неустойки было приостановлено" }),
          date("claim_date", "Когда застройщик получил претензию", { hint: "дата получения претензии" }),
          text("answer", "Ответ на претензию", { hint: "ответ застройщика", default: "ответа не последовало" }),
          money("moral", "Компенсация морального вреда, ₽", { hint: "компенсация морального вреда" }),
        ],
      },
      {
        title: "Подача",
        fields: [
          area("attachments", "Приложения", { hint: "приложения", default: "копия договора участия в долевом строительстве; документы об оплате цены договора; копия передаточного акта; копия претензии и доказательства ее получения; расчет неустойки; документы о направлении ответчику копии иска" }),
          date("suit_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    computed: {
      days: { hint: "дни просрочки", field: "end_date", value: (values, helpers) => {
        const days = overdueDays(values, helpers);
        return days === null ? null : String(days);
      } },
      penalty: { hint: "неустойка", field: "rate", value: (values, helpers) => {
        const value = dduPenalty(values, helpers);
        return value === null ? null : helpers.kopecksText(value);
      } },
      fee: { hint: "государственная пошлина", field: "rate", value: (values, helpers) => {
        const value = dduPenalty(values, helpers);
        if (value === null) return null;
        return value <= FEE_FREE_LIMIT
          ? "не уплачивается (подпункт 4 пункта 2 и пункт 3 статьи 333.36 НК РФ)"
          : helpers.kopecksText(helpers.claimFee(value) - helpers.claimFee(FEE_FREE_LIMIT));
      } },
    },
    example: {
      court: "Энский районный суд", plaintiff_name: "Иванова Анна Петровна", plaintiff_birth: "01.02.1990, г. Энск", plaintiff_address: "г. Энск, ул. Примерная, д. 1, кв. 1", plaintiff_id: "паспорт 0000 000006",
      developer: "ООО «Вымышленный застройщик»", developer_address: "г. Энск, ул. Строителей, д. 3", developer_ids: "ИНН 0000000000, ОГРН 0000000000000",
      contract: "№ 00-ДДУ от 15.03.2024", object: "квартира № 15 в жилом доме по адресу г. Энск, ул. Новая, д. 1", price: "5 000 000",
      due_date: "2025-09-30", transferred: "yes", end_date: "2025-12-29", rate: "7,5", excluded_days: "0", claim_date: "2026-01-20", answer: "ответа не последовало", moral: "20 000",
      attachments: "копия договора участия в долевом строительстве; документы об оплате цены договора; копия передаточного акта; копия претензии и доказательства ее получения; расчет неустойки; документы о направлении ответчику копии иска",
      suit_date: "2026-03-02",
    },
    checks(values, helpers) {
      const result = [];
      const penalty = dduPenalty(values, helpers);
      if (penalty !== null && penalty > 0 && penalty <= 100000 * 100) {
        result.push({ level: "info", text: "Цена иска не больше 100 000 рублей: дело подсудно мировому судье.", basis: { lawId: "GPK", number: "23" } });
      }
      if (String(values.rate || "").trim() && parsePercent(values.rate) === null) result.push({ level: "warning", text: "Запишите ставку числом, например 7,5." });
      const days = helpers.daysBetween(values.due_date, values.end_date);
      if (days !== null && days <= 0) result.push({ level: "warning", text: "Дата передачи или расчета не позже срока по договору: просрочки нет." });
      return result;
    },
    body: [
      address("{{court}}"),
      ...courtPersonLines("Истец", "plaintiff"),
      address("Ответчик: {{developer}}"),
      address("Адрес: {{developer_address}}"),
      address("{{developer_ids}}"),
      address("Цена иска: {{penalty}}"),
      address("Государственная пошлина: {{fee}}"),
      title("ИСКОВОЕ ЗАЯВЛЕНИЕ"),
      subtitle("о взыскании неустойки за нарушение срока передачи объекта долевого строительства"),
      paragraph("Между истцом и ответчиком заключен договор участия в долевом строительстве {{contract}}. Объект долевого строительства: {{object}}. Цена договора составляет {{price}} и оплачена истцом полностью."),
      paragraph("Ответчик обязался передать объект не позднее {{due_date}}. Объект передан истцу только {{end_date}}.", (values) => (values.transferred || "yes") === "yes"),
      paragraph("Ответчик обязался передать объект не позднее {{due_date}}. На {{end_date}} объект истцу не передан.", (values) => values.transferred === "no"),
      paragraph("Согласно части 2 статьи 6 Федерального закона от 30.12.2004 № 214-ФЗ за нарушение срока передачи объекта застройщик уплачивает участнику-гражданину неустойку в размере одной трехсотой ставки рефинансирования Центрального банка Российской Федерации, действующей на день исполнения обязательства, от цены договора за каждый день просрочки в двойном размере."),
      paragraph("Ставка на день исполнения обязательства составляла {{rate}} % годовых. Просрочка составила {{days}} дн. Размер неустойки: {{price}} × {{rate}} % / 300 × 2 × {{days}} = {{penalty}}."),
      paragraph("Претензия истца получена ответчиком {{claim_date}}, {{answer}}. Требование в добровольном порядке не удовлетворено."),
      paragraph("Нарушением срока истцу причинен моральный вред, который он оценивает в {{moral}}. В силу части 2 статьи 10 Федерального закона № 214-ФЗ моральный вред подлежит компенсации застройщиком."),
      paragraph("На основании статей 6 и 10 Федерального закона от 30.12.2004 № 214-ФЗ «Об участии в долевом строительстве многоквартирных домов и иных объектов недвижимости», руководствуясь статьями 29, 131 и 132 Гражданского процессуального кодекса Российской Федерации, прошу суд взыскать с ответчика в пользу истца:"),
      paragraph("1) неустойку за нарушение срока передачи объекта долевого строительства в размере {{penalty}};"),
      paragraph("2) компенсацию морального вреда в размере {{moral}};"),
      paragraph("3) штраф в размере пяти процентов от присужденной суммы за неудовлетворение требований в добровольном порядке (часть 3 статьи 10 Федерального закона № 214-ФЗ)."),
      paragraph("Приложения: {{attachments}}."),
      signatureLine("{{plaintiff_name}}", "{{suit_date}}"),
    ],
  };

  /* ---------- Мировое соглашение ---------- */

  const costsIs = (kind) => (values) => (values.costs || "own") === kind;

  const settlement = {
    id: "settlement",
    title: "Мировое соглашение",
    category: "Суд",
    summary: "Чтобы закончить спор миром: сумма, срок, отказ от остальных требований и судебные расходы.",
    reviewed: false,
    basis: [
      { lawId: "GPK", number: "39" }, { lawId: "GPK", number: "101" }, { lawId: "GPK", number: "153.8" }, { lawId: "GPK", number: "153.9" },
      { lawId: "GPK", number: "153.10" }, { lawId: "GPK", number: "153.11" }, { lawId: "GPK", number: "173" }, { lawId: "GPK", number: "221" },
    ],
    notes: [
      "Мировое соглашение утверждает суд. После утверждения производство по делу прекращается, и повторно обратиться в суд с тем же спором нельзя.",
      "Соглашение подписывают сами стороны или представители, у которых в доверенности специально оговорено право заключить мировое соглашение.",
      "Экземпляров нужно на один больше, чем сторон: один остается в деле.",
      "Если соглашение не исполнят добровольно, суд выдаст исполнительный лист.",
    ],
    sections: [
      {
        title: "Суд и дело",
        fields: [
          text("court", "Суд", { hint: "наименование суда" }),
          text("case_number", "Номер дела", { hint: "номер дела" }),
          text("city", "Город", { hint: "город" }),
          date("date", "Дата соглашения", { hint: "дата" }),
        ],
      },
      {
        title: "Стороны",
        fields: [
          text("plaintiff", "Истец", { hint: "ФИО или наименование истца" }),
          text("defendant", "Ответчик", { hint: "ФИО или наименование ответчика" }),
          area("claim", "Что требовал истец", { hint: "исковые требования", help: "Например, взыскать задолженность по договору займа 300 000 рублей и проценты 25 000 рублей" }),
        ],
      },
      {
        title: "Условия",
        fields: [
          money("amount", "Ответчик выплачивает, ₽", { hint: "сумма" }),
          select("schedule", "Как платит", [
            { value: "once", label: "Одним платежом" },
            { value: "parts", label: "По графику" },
          ], { default: "once" }),
          date("pay_date", "Срок выплаты", { hint: "срок выплаты", when: (values) => (values.schedule || "once") === "once" }),
          area("plan", "График платежей", { hint: "график платежей", help: "Например, 100 000 рублей до 01.12.2026; 100 000 рублей до 01.01.2027", when: (values) => values.schedule === "parts" }),
          area("account", "Куда платить", { hint: "реквизиты истца" }),
          select("costs", "Судебные расходы", [
            { value: "own", label: "Каждая сторона несет свои" },
            { value: "defendant", label: "Ответчик возмещает истцу" },
          ], { default: "own" }),
          money("costs_amount", "Сколько ответчик возмещает, ₽", { hint: "сумма расходов", when: costsIs("defendant") }),
        ],
      },
    ],
    example: {
      court: "Энский районный суд", case_number: "2-000/2026", city: "Энск", date: "2026-11-20",
      plaintiff: "Иванов Иван Иванович", defendant: "Петров Пётр Петрович",
      claim: "взыскать задолженность по договору займа 300 000 рублей и проценты за пользование займом 25 000 рублей",
      amount: "300 000", schedule: "once", pay_date: "2026-12-20", plan: "150 000 рублей до 20.12.2026; 150 000 рублей до 20.01.2027",
      account: "Получатель Иванов Иван Иванович, счёт 40817810000000000000, ПАО «Банк», БИК 040000000", costs: "own", costs_amount: "6 500",
    },
    checks: () => [],
    body: [
      address("В {{court}}"),
      address("Дело № {{case_number}}"),
      title("МИРОВОЕ СОГЛАШЕНИЕ"),
      meta("г. {{city}}", "{{date}}"),
      paragraph("{{plaintiff}} (далее — «Истец») и {{defendant}} (далее — «Ответчик»), являющиеся сторонами по делу № {{case_number}}, в целях урегулирования спора, возникшего в связи с требованиями Истца {{claim}}, на основании статей 39, 153.8–153.10 и 173 Гражданского процессуального кодекса Российской Федерации заключили настоящее мировое соглашение о следующем."),
      clause("Ответчик выплачивает Истцу {{amount}} в срок не позднее {{pay_date}}.", (values) => (values.schedule || "once") === "once"),
      clause("Ответчик выплачивает Истцу {{amount}} по следующему графику: {{plan}}.", (values) => values.schedule === "parts"),
      clause("Денежные средства перечисляются по реквизитам Истца: {{account}}."),
      clause("Истец отказывается от исковых требований к Ответчику в остальной части."),
      clause("Судебные расходы, связанные прямо или косвенно с делом, Стороны друг другу не возмещают, и они лежат исключительно на той Стороне, которая их понесла.", costsIs("own")),
      clause("Ответчик возмещает Истцу судебные расходы в размере {{costs_amount}} в срок, установленный для выплаты по пункту 1 настоящего соглашения.", costsIs("defendant")),
      clause("Мировое соглашение не нарушает права и законные интересы других лиц и не противоречит закону."),
      clause("Последствия утверждения мирового соглашения и прекращения производства по делу, предусмотренные статьей 221 Гражданского процессуального кодекса Российской Федерации, Сторонам известны и понятны: повторное обращение в суд по спору между теми же сторонами, о том же предмете и по тем же основаниям не допускается."),
      clause("Мировое соглашение, не исполненное добровольно, подлежит принудительному исполнению на основании исполнительного листа, выдаваемого судом по ходатайству Стороны."),
      clause("Соглашение составлено в трех экземплярах: по одному для каждой из Сторон и один для суда. Стороны просят суд утвердить мировое соглашение и прекратить производство по делу."),
      signatureLine("Истец: {{plaintiff}}"),
      signatureLine("Ответчик: {{defendant}}"),
    ],
  };

  /* ---------- Заявление о выдаче копии решения ---------- */

  const isPostal = (values) => (values.receive || "self") === "mail";

  const decisionCopy = {
    id: "decision-copy",
    title: "Заявление о выдаче копии решения суда",
    category: "Суд",
    summary: "Копия решения, определения или приговора: получить лично или по почте, в том числе с отметкой о вступлении в силу.",
    reviewed: false,
    basis: [{ lawId: "GPK", number: "214" }, { lawId: "GPK", number: "35" }],
    notes: [
      "Лицам, участвующим в деле, копии решения вручаются или направляются в течение пяти дней после его составления. Если копию не получили, ее можно запросить.",
      "Копия с отметкой о вступлении в законную силу нужна, например, для регистрации права, ЗАГСа или банка.",
      "Многие суды принимают такие заявления через электронную приемную или ГАС «Правосудие».",
    ],
    sections: [
      {
        title: "Суд и дело",
        fields: [
          text("court", "Суд", { hint: "наименование суда" }),
          text("case_number", "Номер дела", { hint: "номер дела" }),
          text("parties", "Стороны", { hint: "стороны", help: "Например, по иску Иванова И. И. к Петрову П. П. о взыскании долга" }),
          select("act", "Какой документ", [
            { value: "decision", label: "Решение", text: "решения" },
            { value: "ruling", label: "Определение", text: "определения" },
            { value: "appeal", label: "Апелляционное определение", text: "апелляционного определения" },
          ], { default: "decision" }),
          date("act_date", "Дата документа", { hint: "дата документа" }),
          { id: "with_mark", label: "С отметкой о вступлении в законную силу", type: "checkbox", default: true },
          number("copies", "Сколько копий", { hint: "число копий", default: "1" }),
        ],
      },
      {
        title: "Заявитель",
        fields: [
          text("applicant", "ФИО или наименование", { hint: "заявитель" }),
          text("applicant_address", "Адрес", { hint: "адрес заявителя" }),
          select("role", "Кем вы являетесь в деле", ROLES, { default: "plaintiff" }),
          select("receive", "Как получить", [
            { value: "self", label: "Лично в суде" },
            { value: "mail", label: "По почте" },
          ], { default: "self" }),
          date("request_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    example: {
      court: "Энский районный суд", case_number: "2-000/2026", parties: "по иску Иванова И. И. к Петрову П. П. о взыскании долга",
      act: "decision", act_date: "2026-09-28", with_mark: true, copies: "1",
      applicant: "Иванов Иван Иванович", applicant_address: "г. Энск, ул. Примерная, д. 1, кв. 1", role: "plaintiff", receive: "self", request_date: "2026-11-16",
    },
    checks(values) {
      const copies = Number(values.copies);
      if (String(values.copies || "").trim() && (!Number.isInteger(copies) || copies < 1)) return [{ level: "warning", text: "Укажите число копий целым числом." }];
      return [];
    },
    body: [
      address("В {{court}}"),
      address("Дело № {{case_number}}"),
      address("От: {{applicant}}"),
      address("Адрес: {{applicant_address}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("о выдаче копии судебного акта"),
      paragraph("В производстве суда находилось гражданское дело № {{case_number}} {{parties}}. Я являюсь {{role}} по делу."),
      paragraph("Прошу выдать заверенную копию {{act}} суда от {{act_date}} в количестве {{copies}} экз. с отметкой о вступлении в законную силу.", (values) => values.with_mark !== false),
      paragraph("Прошу выдать заверенную копию {{act}} суда от {{act_date}} в количестве {{copies}} экз.", (values) => values.with_mark === false),
      paragraph("Копию получу лично.", (values) => !isPostal(values)),
      paragraph("Копию прошу направить по почте по адресу: {{applicant_address}}.", isPostal),
      signatureLine("{{applicant}}", "{{request_date}}"),
    ],
  };

  /* ---------- Расписка о возврате долга ---------- */

  const isFull = (values) => (values.repaid || "full") === "full";

  const repaymentReceipt = {
    id: "repayment-receipt",
    title: "Расписка в получении возврата долга",
    category: "Соглашения и расписки",
    summary: "Кредитор подтверждает, что долг возвращен полностью или частично. Защищает должника от повторного требования.",
    reviewed: false,
    basis: [{ lawId: "GK", number: "408" }, { lawId: "GK", number: "810" }],
    notes: [
      "Кредитор обязан выдать расписку по требованию должника. Если он отказывается, должник вправе задержать исполнение.",
      "При полном возврате кредитор возвращает долговой документ, например расписку о займе. Если вернуть его нельзя, это указывается в расписке.",
      "Расписку пишет и подписывает кредитор. Лучше, чтобы он написал ее от руки.",
    ],
    sections: [
      { title: "Место и дата", fields: placeAndDate },
      { title: "Кредитор", fields: personFields("creditor") },
      { title: "Должник", fields: personFields("debtor") },
      {
        title: "Долг",
        fields: [
          text("debt_document", "На чем основан долг", { hint: "долговой документ", help: "Например, расписка в получении займа от 01.02.2026 или договор займа от 01.02.2026" }),
          money("debt", "Сумма долга, ₽", { hint: "сумма долга" }),
          select("repaid", "Как возвращен", [
            { value: "full", label: "Полностью" },
            { value: "part", label: "Частично" },
          ], { default: "full" }),
          money("received", "Получено сейчас, ₽", { hint: "полученная сумма" }),
          money("rest", "Остаток долга, ₽", { hint: "остаток долга", when: (values) => !isFull(values) }),
          select("document_back", "Долговой документ", [
            { value: "returned", label: "Возвращен должнику" },
            { value: "lost", label: "Вернуть невозможно" },
          ], { default: "returned", when: isFull }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20",
      creditor_name: "Иванов Иван Иванович", creditor_birth: "15.03.1985", creditor_passport: "0000 000000", creditor_issued: "вымышленным отделом 01.01.2015", creditor_address: "г. Энск, ул. Примерная, д. 1, кв. 1",
      debtor_name: "Петров Пётр Петрович", debtor_birth: "20.05.1988", debtor_passport: "0000 000007", debtor_issued: "вымышленным отделом 10.06.2018", debtor_address: "г. Энск, ул. Образцовая, д. 5",
      debt_document: "расписка в получении займа от 01.02.2026", debt: "150 000", repaid: "full", received: "150 000", rest: "50 000", document_back: "returned",
    },
    checks(values, helpers) {
      const debt = helpers.parseMoney(values.debt);
      const received = helpers.parseMoney(values.received);
      if (debt !== null && received !== null && isFull(values) && received < debt) {
        return [{ level: "warning", text: "Получено меньше суммы долга. Если долг погашен не полностью, выберите частичный возврат." }];
      }
      return [];
    },
    body: [
      title("РАСПИСКА"),
      subtitle("в получении денежных средств в счет возврата долга"),
      meta("г. {{city}}", "{{date}}"),
      paragraph(() => `Кредитор: ${personIntro("creditor")}.`),
      paragraph(() => `Должник: ${personIntro("debtor")}.`),
      paragraph("Я, кредитор, подтверждаю получение от должника денежных средств в размере {{received}} в счет возврата долга по документу: {{debt_document}}. Сумма долга составляла {{debt}}."),
      paragraph("Долг возвращен полностью. Претензий к должнику по этому обязательству не имею. Долговой документ возвращен должнику.", (values) => isFull(values) && (values.document_back || "returned") === "returned"),
      paragraph("Долг возвращен полностью. Претензий к должнику по этому обязательству не имею. Долговой документ вернуть невозможно, обязательство по нему прекращено исполнением.", (values) => isFull(values) && values.document_back === "lost"),
      paragraph("Долг возвращен частично. Остаток долга составляет {{rest}}.", (values) => !isFull(values)),
      signatureLine("{{creditor_name}}", "{{date}}"),
    ],
  };

  /* ---------- Договор хранения ---------- */

  const isPaid = (values) => (values.paid || "free") === "paid";
  const storageTerm = (values) => (values.term_mode || "term") === "term";

  const storage = {
    id: "storage",
    title: "Договор хранения вещи между гражданами",
    category: "Договоры",
    summary: "Оставить вещь на хранение знакомому или соседу: бесплатно или за плату, на срок или до востребования.",
    reviewed: false,
    basis: [
      { lawId: "GK", number: "886" }, { lawId: "GK", number: "887" }, { lawId: "GK", number: "889" }, { lawId: "GK", number: "891" },
      { lawId: "GK", number: "896" }, { lawId: "GK", number: "899" }, { lawId: "GK", number: "900" }, { lawId: "GK", number: "901" }, { lawId: "GK", number: "904" },
    ],
    notes: [
      "Между гражданами договор хранения заключается письменно, если стоимость вещи больше 10 000 рублей.",
      "Поклажедатель может забрать вещь в любой момент, даже до окончания срока хранения.",
      "Хранитель отвечает за утрату, недостачу и повреждение вещи по общим правилам статьи 401 ГК РФ. Если срок хранения кончился, а поклажедатель вещь не забрал, хранитель отвечает только за умысел и грубую неосторожность.",
    ],
    sections: [
      { title: "Место и дата", fields: placeAndDate },
      { title: "Поклажедатель", fields: personFields("owner") },
      { title: "Хранитель", fields: personFields("keeper") },
      {
        title: "Вещь и условия",
        fields: [
          area("thing", "Что передаётся на хранение", { hint: "описание вещи", help: "Признаки, по которым вещь можно определить, и состояние" }),
          money("value", "Оценка вещи, ₽", { hint: "оценка" }),
          text("place", "Где хранится", { hint: "место хранения", help: "Например, гараж по адресу г. Энск, ул. Гаражная, бокс 7" }),
          select("term_mode", "Срок", [
            { value: "term", label: "До определенной даты" },
            { value: "demand", label: "До востребования" },
          ], { default: "term" }),
          date("until", "Хранить до", { hint: "срок хранения", when: storageTerm }),
          select("paid", "Оплата", [
            { value: "free", label: "Бесплатно" },
            { value: "paid", label: "За вознаграждение" },
          ], { default: "free" }),
          money("fee", "Вознаграждение в месяц, ₽", { hint: "вознаграждение", when: isPaid }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20",
      owner_name: "Иванов Иван Иванович", owner_birth: "15.03.1985", owner_passport: "0000 000000", owner_issued: "вымышленным отделом 01.01.2015", owner_address: "г. Энск, ул. Примерная, д. 1, кв. 1",
      keeper_name: "Петров Пётр Петрович", keeper_birth: "20.05.1988", keeper_passport: "0000 000007", keeper_issued: "вымышленным отделом 10.06.2018", keeper_address: "г. Энск, ул. Образцовая, д. 5",
      thing: "велосипед «Пример», рама № 000000, в исправном состоянии, без повреждений", value: "40 000", place: "гараж по адресу г. Энск, ул. Гаражная, бокс 7",
      term_mode: "term", until: "2027-04-01", paid: "free", fee: "1 000",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.date, values.until);
      if (storageTerm(values) && days !== null && days <= 0) return [{ level: "warning", text: "Срок хранения не позже даты договора." }];
      return [];
    },
    body: [
      title("ДОГОВОР ХРАНЕНИЯ"),
      meta("г. {{city}}", "{{date}}"),
      paragraph(() => `${personIntro("owner")} (далее — «Поклажедатель»), с одной стороны, и ${personIntro("keeper")} (далее — «Хранитель»), с другой стороны, вместе именуемые «Стороны», заключили настоящий договор о следующем.`),
      heading("Предмет договора"),
      clause("Хранитель обязуется хранить вещь, переданную ему Поклажедателем, и возвратить эту вещь в сохранности (далее — «Вещь»): {{thing}}."),
      clause("Стороны оценивают Вещь в {{value}}."),
      clause("Вещь хранится по адресу: {{place}}."),
      clause("Вещь передана Хранителю при подписании договора. Договор имеет силу акта приема-передачи."),
      heading("Срок хранения"),
      clause("Хранитель хранит Вещь до {{until}}.", storageTerm),
      clause("Хранитель хранит Вещь до востребования ее Поклажедателем.", (values) => !storageTerm(values)),
      clause("Поклажедатель вправе забрать Вещь в любой момент, в том числе до окончания срока хранения. По окончании срока хранения Поклажедатель обязан забрать Вещь."),
      heading("Вознаграждение"),
      clause("Хранение осуществляется безвозмездно.", (values) => !isPaid(values)),
      clause("Поклажедатель уплачивает Хранителю вознаграждение {{fee}} за каждый месяц хранения по окончании каждого месяца.", isPaid),
      heading("Ответственность"),
      clause("Хранитель принимает все меры для сохранности Вещи и не вправе пользоваться ею или передавать ее третьим лицам без согласия Поклажедателя."),
      clause("Хранитель отвечает за утрату, недостачу или повреждение Вещи в случаях и в размере, предусмотренных статьями 901 и 902 Гражданского кодекса Российской Федерации."),
      heading("Заключительные положения"),
      clause("Договор вступает в силу с момента подписания Сторонами."),
      ...closingClauses,
      heading("Подписи Сторон"),
      personSignatures({ prefix: "owner", role: "Поклажедатель" }, { prefix: "keeper", role: "Хранитель" }),
    ],
  };

  root.TEMPLATES.push(dduSuit, settlement, decisionCopy, repaymentReceipt, storage);
})(typeof window !== "undefined" ? window : globalThis);
