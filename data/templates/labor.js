/* Трудовые отношения. */
(function (root) {
  "use strict";

  const {
    text, area, money, date, select, title, subtitle, meta, heading, clause, paragraph, address, signatureLine, filled,
  } = root.TemplateKit;

  /* ---------- Заявление об увольнении ---------- */

  const NOTICE_DAYS = 14;
  const isAgreedEarly = (values) => (values.quit_mode || "standard") === "early";
  const isForcedReason = (values) => (values.quit_mode || "standard") === "reason";

  const resignation = {
    id: "resignation",
    title: "Заявление об увольнении по собственному желанию",
    category: "Трудовые отношения",
    summary: "Считает срок предупреждения и учитывает увольнение с указанной работником даты.",
    reviewed: false,
    basis: [{ lawId: "TK", number: "80" }, { lawId: "TK", number: "84.1" }, { lawId: "TK", number: "140" }],
    notes: [
      "Срок предупреждения начинается на следующий день после получения заявления работодателем. Сохраните доказательство подачи.",
      "До истечения срока заявление можно отозвать, если на место работника не приглашен в письменной форме другой работник, которому нельзя отказать в договоре.",
      "Для отдельных категорий работников федеральным законом может быть установлен другой срок предупреждения.",
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
        title: "Увольнение",
        fields: [
          select("quit_mode", "Как увольняетесь", [
            { value: "standard", label: "С отработкой двух недель" },
            { value: "early", label: "Раньше, по договоренности" },
            { value: "reason", label: "В указанный срок по особой причине" },
          ], { default: "standard" }),
          date("last_day", "Последний рабочий день", { hint: "дата увольнения" }),
          area("reason", "Причина", { hint: "причина", help: "Например, зачисление в образовательную организацию, выход на пенсию или установленное нарушение работодателя", when: isForcedReason }),
          date("application_date", "Дата заявления", { hint: "дата заявления" }),
        ],
      },
    ],
    example: {
      employer: "ООО «Пример»", head: "генеральному директору Петрову П. П.", employee: "Иванова Ивана Ивановича", position: "менеджера", employee_short: "Иванов И. И.",
      quit_mode: "standard", last_day: "2026-11-27", application_date: "2026-11-13",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.application_date, values.last_day);
      if (days !== null && days < 0) return [{ level: "warning", text: "Дата увольнения раньше даты заявления." }];
      if ((values.quit_mode || "standard") === "standard" && days !== null && days < NOTICE_DAYS) {
        return [{
          level: "warning",
          text: "До увольнения меньше двух недель. Выберите увольнение раньше срока, если есть договоренность, или особую причину.",
          basis: { lawId: "TK", number: "80" },
        }];
      }
      return [];
    },
    body: [
      address("{{head}}"),
      address("{{employer}}"),
      address("от {{employee}}"),
      address("{{position}}"),
      title("ЗАЯВЛЕНИЕ"),
      subtitle("об увольнении по собственному желанию"),
      paragraph("Прошу уволить меня по собственному желанию {{last_day}}.", (values) => !isAgreedEarly(values) && !isForcedReason(values)),
      paragraph("Прошу уволить меня по собственному желанию {{last_day}}, до истечения срока предупреждения, по соглашению с работодателем.", isAgreedEarly),
      paragraph("Прошу уволить меня по собственному желанию {{last_day}}. На основании части третьей статьи 80 Трудового кодекса Российской Федерации работодатель обязан расторгнуть трудовой договор в указанный срок. Причина: {{reason}}.", isForcedReason),
      signatureLine("{{employee_short}}", "{{application_date}}"),
    ],
  };

  /* ---------- Соглашение о расторжении трудового договора ---------- */

  const hasCompensation = filled("compensation");
  const employmentContract = (values) => (filled("contract_number")(values)
    ? "трудовой договор № {{contract_number}} от {{contract_date}}"
    : "трудовой договор от {{contract_date}}");

  const employmentTermination = {
    id: "employment-termination",
    title: "Соглашение о расторжении трудового договора",
    category: "Трудовые отношения",
    summary: "Увольнение по соглашению сторон, с компенсацией или без нее.",
    reviewed: false,
    basis: [{ lawId: "TK", number: "77" }, { lawId: "TK", number: "78" }, { lawId: "TK", number: "84.1" }, { lawId: "TK", number: "140" }],
    notes: [
      "Прекращение договора оформляется приказом, с которым работника знакомят под роспись.",
      "Для отдельных категорий выплата компенсации ограничена законом. Проверьте это, если работник является руководителем или работает в государственной организации.",
    ],
    sections: [
      {
        title: "Место и дата",
        fields: [text("city", "Город", { hint: "город" }), date("date", "Дата соглашения", { hint: "дата" })],
      },
      {
        title: "Стороны",
        fields: [
          text("employer", "Работодатель", { hint: "наименование работодателя" }),
          text("employer_signer", "В лице кого подписывает", { hint: "должность и ФИО в родительном падеже", help: "Например, генерального директора Петрова П. П." }),
          text("employer_authority", "Основание полномочий", { hint: "основание полномочий", default: "устав" }),
          text("employer_short", "Подпись работодателя", { hint: "фамилия и инициалы" }),
          text("employee", "Работник", { hint: "ФИО работника" }),
          text("employee_short", "Подпись работника", { hint: "фамилия и инициалы" }),
        ],
      },
      {
        title: "Условия",
        fields: [
          text("contract_number", "Номер трудового договора", { hint: "номер", optional: true }),
          date("contract_date", "Дата трудового договора", { hint: "дата договора" }),
          date("last_day", "Последний рабочий день", { hint: "дата увольнения" }),
          money("compensation", "Компенсация, ₽", { hint: "компенсация", optional: true }),
        ],
      },
    ],
    example: {
      city: "Энск", date: "2026-11-20", employer: "ООО «Пример»", employer_signer: "генерального директора Петрова П. П.", employer_authority: "устав", employer_short: "Петров П. П.",
      employee: "Иванов Иван Иванович", employee_short: "Иванов И. И.", contract_number: "45", contract_date: "2024-03-01", last_day: "2026-11-30",
    },
    checks(values, helpers) {
      const days = helpers.daysBetween(values.date, values.last_day);
      return days !== null && days < 0 ? [{ level: "warning", text: "Последний рабочий день раньше даты соглашения." }] : [];
    },
    body: [
      title("СОГЛАШЕНИЕ"),
      subtitle("о расторжении трудового договора"),
      meta("г. {{city}}", "{{date}}"),
      paragraph("{{employer}} в лице {{employer_signer}} (основание полномочий: {{employer_authority}}), далее — «Работодатель», и {{employee}}, далее — «Работник», заключили настоящее соглашение о следующем."),
      heading("Расторжение договора"),
      clause((values) => `Стороны на основании пункта 1 части первой статьи 77 и статьи 78 Трудового кодекса Российской Федерации расторгают ${employmentContract(values)}.`),
      clause("Последний рабочий день Работника: {{last_day}}."),
      heading("Расчет"),
      clause("В день прекращения трудового договора Работодатель выплачивает Работнику все причитающиеся суммы и выдает трудовую книжку или предоставляет сведения о трудовой деятельности."),
      clause("Кроме того, Работодатель выплачивает Работнику компенсацию {{compensation}} в день прекращения трудового договора.", hasCompensation),
      heading("Заключительные положения"),
      clause("Соглашение составлено в двух экземплярах, по одному для каждой из сторон."),
      heading("Подписи сторон"),
      { type: "paragraph", text: "Работодатель: ____________ / {{employer_short}}" },
      { type: "paragraph", text: "Работник: ____________ / {{employee_short}}" },
    ],
  };

  root.TEMPLATES.push(resignation, employmentTermination);
})(typeof window !== "undefined" ? window : globalThis);
