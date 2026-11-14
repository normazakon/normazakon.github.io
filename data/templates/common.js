/* Общие строительные блоки шаблонов. Тексты написаны для этого проекта и сверены с нормами из базы,
   но практикующий юрист их ещё не проверял: reviewed: false показывается в интерфейсе.

   Поле: { id, label, type, hint, help, optional, when, options }
   Блок: { type, text, right, when }. В тексте {{id}} подставляет значение поля.
   Разделы и пункты нумеруются автоматически только среди видимых блоков. */
(function (root) {
  "use strict";

  const text = (id, label, extra = {}) => ({ id, label, type: "text", ...extra });
  const area = (id, label, extra = {}) => ({ id, label, type: "textarea", ...extra });
  const money = (id, label, extra = {}) => ({ id, label, type: "money", ...extra });
  const date = (id, label, extra = {}) => ({ id, label, type: "date", ...extra });
  const select = (id, label, options, extra = {}) => ({ id, label, type: "select", options, ...extra });

  const title = (value) => ({ type: "title", text: value });
  const subtitle = (value) => ({ type: "subtitle", text: value });
  const meta = (left, right) => ({ type: "meta", text: left, right });
  const heading = (value, when) => ({ type: "heading", text: value, when });
  const clause = (value, when) => ({ type: "clause", text: value, when });
  const paragraph = (value, when) => ({ type: "paragraph", text: value, when });
  const item = (value, when) => ({ type: "item", text: value, when });
  const address = (value, when) => ({ type: "address", text: value, when });
  const signatureLine = (value, right) => ({ type: "signatureLine", text: value, right });
  const number = (id, label, extra = {}) => ({ id, label, type: "number", ...extra });
  const filled = (id) => (values) => String(values[id] || "").trim() !== "";

  const KINDS = [
    { value: "person", label: "Физическое лицо" },
    { value: "ip", label: "Индивидуальный предприниматель" },
    { value: "org", label: "Организация" },
  ];

  /** Поля физического лица. */
  function personFields(prefix, when) {
    return [
      text(`${prefix}_name`, "ФИО", { hint: "ФИО", when }),
      text(`${prefix}_birth`, "Дата рождения", { hint: "дата рождения", help: "Например, 15.03.1985", when }),
      text(`${prefix}_passport`, "Паспорт: серия и номер", { hint: "серия и номер паспорта", when }),
      text(`${prefix}_issued`, "Кем и когда выдан", { hint: "кем и когда выдан паспорт", when }),
      text(`${prefix}_address`, "Адрес регистрации", { hint: "адрес регистрации", when }),
    ];
  }

  /** Поля стороны, которая может быть гражданином, ИП или организацией. */
  function partyFields(prefix, role) {
    const is = (kind) => (values) => (values[`${prefix}_kind`] || "person") === kind;
    return [
      select(`${prefix}_kind`, `${role}: кто это`, KINDS, { default: "person" }),
      ...personFields(prefix, is("person")),
      text(`${prefix}_ip_name`, "ФИО предпринимателя", { hint: "ФИО предпринимателя", when: is("ip") }),
      { id: `${prefix}_ogrnip`, label: "ОГРНИП", type: "ogrnip", hint: "ОГРНИП", when: is("ip") },
      text(`${prefix}_org_name`, "Полное наименование", { hint: "наименование организации", help: "Например, Общество с ограниченной ответственностью «Пример»", when: is("org") }),
      { id: `${prefix}_ogrn`, label: "ОГРН", type: "ogrn", hint: "ОГРН", when: is("org") },
      { id: `${prefix}_inn`, label: "ИНН", type: "inn", hint: "ИНН", when: (values) => !is("person")(values) },
      text(`${prefix}_business_address`, "Адрес", { hint: "адрес", when: (values) => !is("person")(values) }),
      text(`${prefix}_signer`, "В лице кого подписывает", { hint: "должность и ФИО в родительном падеже", help: "Например, генерального директора Иванова И. И.", when: is("org") }),
      text(`${prefix}_authority`, "Основание полномочий", { hint: "основание полномочий", help: "Например, устав или доверенность от 01.02.2026 № 5", when: is("org") }),
      text(`${prefix}_short_signer`, "Подпись: фамилия и инициалы", { hint: "фамилия и инициалы", when: is("org") }),
      area(`${prefix}_bank`, "Банковские реквизиты", { hint: "банковские реквизиты", optional: true, help: "Получатель, счёт, банк, БИК, корреспондентский счёт" }),
    ];
  }

  function personIntro(prefix) {
    return `{{${prefix}_name}}, дата рождения: {{${prefix}_birth}}, паспорт {{${prefix}_passport}}, выдан {{${prefix}_issued}}, адрес регистрации: {{${prefix}_address}}`;
  }

  function partyIntro(prefix, values) {
    const kind = values[`${prefix}_kind`] || "person";
    if (kind === "ip") {
      return `индивидуальный предприниматель {{${prefix}_ip_name}}, ОГРНИП {{${prefix}_ogrnip}}, ИНН {{${prefix}_inn}}, адрес: {{${prefix}_business_address}}`;
    }
    if (kind === "org") {
      return `{{${prefix}_org_name}}, ОГРН {{${prefix}_ogrn}}, ИНН {{${prefix}_inn}}, адрес: {{${prefix}_business_address}}, в лице {{${prefix}_signer}} (основание полномочий: {{${prefix}_authority}})`;
    }
    return personIntro(prefix);
  }

  function partyLines(prefix, values) {
    const kind = values[`${prefix}_kind`] || "person";
    const bank = String(values[`${prefix}_bank`] || "").trim() ? [`{{${prefix}_bank}}`] : [];
    if (kind === "ip") {
      return [`ИП {{${prefix}_ip_name}}`, `ОГРНИП {{${prefix}_ogrnip}}`, `ИНН {{${prefix}_inn}}`, `{{${prefix}_business_address}}`, ...bank];
    }
    if (kind === "org") {
      return [`{{${prefix}_org_name}}`, `ОГРН {{${prefix}_ogrn}}`, `ИНН {{${prefix}_inn}}`, `{{${prefix}_business_address}}`, ...bank];
    }
    return [`{{${prefix}_name}}`, `Паспорт {{${prefix}_passport}}`, `{{${prefix}_address}}`, ...bank];
  }

  function partySigner(prefix, values) {
    const kind = values[`${prefix}_kind`] || "person";
    if (kind === "ip") return `{{${prefix}_ip_name}}`;
    if (kind === "org") return `{{${prefix}_short_signer}}`;
    return `{{${prefix}_name}}`;
  }

  function signatures(...parties) {
    return {
      type: "signatures",
      parties: parties.map(({ prefix, role }) => ({
        role,
        lines: (values) => partyLines(prefix, values),
        signer: (values) => partySigner(prefix, values),
      })),
    };
  }

  function personSignatures(...parties) {
    return {
      type: "signatures",
      parties: parties.map(({ prefix, role }) => ({
        role,
        lines: () => [`{{${prefix}_name}}`, `Паспорт {{${prefix}_passport}}`, `{{${prefix}_address}}`],
        signer: () => `{{${prefix}_name}}`,
      })),
    };
  }

  const placeAndDate = [text("city", "Город", { hint: "город" }), date("date", "Дата договора", { hint: "дата" })];
  const closingClauses = [
    clause("Договор составлен в двух экземплярах, имеющих одинаковую юридическую силу, по одному для каждой из Сторон."),
  ];

  root.TEMPLATES = [];
  root.TemplateKit = {
    text, area, money, date, select, number, title, subtitle, meta, heading, clause, paragraph, item, address,
    signatureLine, KINDS, personFields, partyFields, personIntro, partyIntro, partyLines, partySigner,
    signatures, personSignatures, placeAndDate, closingClauses, filled,
  };
})(typeof window !== "undefined" ? window : globalThis);
