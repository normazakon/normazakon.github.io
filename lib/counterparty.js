/* Проверка контрагента по ИНН или ОГРН через сервис DaData (сведения ЕГРЮЛ и ЕГРИП).
   Здесь только разбор номера и ответа, запрос делает страница.
   Подключается в браузере как window.Counterparty и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Counterparty = api;
})(globalThis, function () {
  "use strict";

  const ENDPOINT = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";

  const STATUS = {
    ACTIVE: { label: "Действует", tone: "ok" },
    LIQUIDATING: { label: "В процессе ликвидации", tone: "problem" },
    LIQUIDATED: { label: "Ликвидирована", tone: "problem" },
    BANKRUPT: { label: "Банкротство", tone: "problem" },
    REORGANIZING: { label: "В процессе реорганизации", tone: "check" },
  };

  function checksum(digits, weights) {
    return weights.reduce((sum, weight, index) => sum + weight * digits[index], 0) % 11 % 10;
  }

  /** Остаток от деления длинного числа, записанного строкой. */
  function modulo(text, divisor) {
    let rest = 0;
    for (const char of text) rest = (rest * 10 + Number(char)) % divisor;
    return rest;
  }

  /**
   * Разбирает введённый номер. Пробелы и дефисы убирает.
   * Возвращает { kind: "inn" | "ogrn", number } или { error: "текст для человека" }.
   */
  function parseNumber(input) {
    const number = String(input || "").replace(/[\s-]/g, "");
    if (!number) return { error: "Введите ИНН или ОГРН." };
    if (!/^\d+$/.test(number)) return { error: "В ИНН и ОГРН только цифры." };
    const digits = [...number].map(Number);
    if (number.length === 10) {
      if (checksum(digits, [2, 4, 10, 3, 5, 9, 4, 6, 8]) !== digits[9]) return { error: "Такого ИНН не бывает: не сходится контрольная цифра. Проверьте, нет ли опечатки." };
      return { kind: "inn", number };
    }
    if (number.length === 12) {
      const first = checksum(digits, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
      const second = checksum(digits, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]);
      if (first !== digits[10] || second !== digits[11]) return { error: "Такого ИНН не бывает: не сходится контрольная цифра. Проверьте, нет ли опечатки." };
      return { kind: "inn", number };
    }
    if (number.length === 13 || number.length === 15) {
      const divisor = number.length === 13 ? 11 : 13;
      if (modulo(number.slice(0, -1), divisor) % 10 !== digits[digits.length - 1]) return { error: "Такого ОГРН не бывает: не сходится контрольная цифра. Проверьте, нет ли опечатки." };
      return { kind: "ogrn", number };
    }
    return { error: "ИНН организации из 10 цифр, ИНН предпринимателя из 12, ОГРН из 13, ОГРНИП из 15." };
  }

  /** Тело запроса к DaData. */
  function requestBody(number) {
    return { query: number, count: 5 };
  }

  /** Дата из миллисекунд в виде «18.11.2026». */
  function formatDate(ms) {
    if (typeof ms !== "number") return null;
    const date = new Date(ms);
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
  }

  /** Полных лет с даты регистрации до сегодняшнего дня. */
  function yearsSince(ms, now) {
    if (typeof ms !== "number") return null;
    const from = new Date(ms);
    const to = new Date(now);
    let years = to.getUTCFullYear() - from.getUTCFullYear();
    if (to.getUTCMonth() < from.getUTCMonth() || (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate())) years -= 1;
    return years;
  }

  /** Главная запись: у организации с филиалами DaData отдаёт и головную, и филиалы. */
  function pickMain(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
    return suggestions.find((item) => item.data && item.data.branch_type === "MAIN") || suggestions[0];
  }

  /**
   * Сводка по контрагенту из ответа DaData.
   * Возвращает null, если ничего не найдено. Поле warnings: то, на что стоит обратить внимание.
   */
  function summarize(response, now = Date.now()) {
    const found = pickMain(response && response.suggestions);
    if (!found) return null;
    const data = found.data || {};
    const individual = data.type === "INDIVIDUAL";
    const state = data.state || {};
    const status = STATUS[state.status] || { label: "Статус не указан", tone: "check" };
    const address = data.address || {};
    const management = data.management || null;
    const name = data.name || {};
    const registered = state.registration_date;
    const age = yearsSince(registered, now);

    const warnings = [];
    if (status.tone === "problem") {
      const when = formatDate(state.liquidation_date);
      warnings.push(when ? `${status.label} с ${when}.` : `${status.label}.`);
    } else if (status.tone === "check" && STATUS[state.status]) {
      warnings.push(`${status.label}: договор может перейти к правопреемнику, уточните, к кому.`);
    }
    if (age !== null && age < 1 && status.tone === "ok") warnings.push("Зарегистрирована меньше года назад.");
    if (data.invalid === true) warnings.push("В ЕГРЮЛ есть отметка о недостоверности сведений.");
    if (address.invalidity) warnings.push("Адрес отмечен в ЕГРЮЛ как недостоверный.");
    if (management && management.disqualified) warnings.push("Руководитель дисквалифицирован.");

    const people = individual
      ? null
      : management && management.name ? { post: lowerFirst(management.post) || "руководитель", name: management.name } : null;

    return {
      individual,
      name: found.value || name.short_with_opf || name.full_with_opf,
      fullName: name.full_with_opf || found.unrestricted_value || found.value,
      status: { code: state.status || null, label: status.label, tone: status.tone },
      inn: data.inn || null,
      kpp: individual ? null : data.kpp || null,
      ogrn: data.ogrn || null,
      okved: data.okved || null,
      registered: formatDate(registered),
      age,
      liquidated: formatDate(state.liquidation_date),
      actual: formatDate(state.actuality_date),
      address: address.unrestricted_value || address.value || null,
      manager: people,
      branches: individual ? 0 : data.branch_count || 0,
      warnings,
    };
  }

  function lowerFirst(text) {
    if (!text) return "";
    const lower = text.toLowerCase();
    return lower[0].toUpperCase() + lower.slice(1);
  }

  /** Реквизиты одним текстом, чтобы вставить в договор. */
  function requisites(summary) {
    const ids = summary.individual
      ? [`ИНН ${summary.inn}`, summary.ogrn && `ОГРНИП ${summary.ogrn}`]
      : [`ИНН ${summary.inn}`, summary.kpp && `КПП ${summary.kpp}`, summary.ogrn && `ОГРН ${summary.ogrn}`];
    return [
      summary.fullName,
      ids.filter(Boolean).join(", "),
      summary.address && `Адрес: ${summary.address}`,
      summary.manager && `${summary.manager.post}: ${summary.manager.name}`,
    ].filter(Boolean).join("\n");
  }

  /** «Греф Герман Оскарович» → «Греф Г. О.» */
  function initials(fullName) {
    const [surname, ...rest] = String(fullName || "").trim().split(/\s+/);
    if (!surname) return "";
    return [surname, rest.map((part) => `${part[0].toUpperCase()}.`).join(" ")].filter(Boolean).join(" ");
  }

  /** Типографские кавычки вместо прямых: 'ТД "АБВ"' → 'ТД «АБВ»', внутри других кавычек → 'ТД „АБВ“'. */
  function fancyQuotes(text, [left, right] = ["«", "»"]) {
    let open = true;
    return String(text).replace(/"/g, () => {
      const mark = open ? left : right;
      open = !open;
      return mark;
    });
  }

  /**
   * Значения полей стороны шаблона (prefix_org_name, prefix_ogrn и так далее) по ответу DaData.
   * Возвращает null, если ничего не найдено. В note: что ещё заполнить руками.
   * Должность и ФИО «в лице кого» в родительном падеже не заполняем: склонять автоматически ненадёжно.
   */
  function partyValues(response, prefix) {
    const found = pickMain(response && response.suggestions);
    if (!found) return null;
    const data = found.data || {};
    const summary = summarize(response);
    const address = (data.address && (data.address.unrestricted_value || data.address.value)) || "";
    const p = (name) => `${prefix}_${name}`;
    if (data.type === "INDIVIDUAL") {
      const fio = data.fio && data.fio.surname
        ? [data.fio.surname, data.fio.name, data.fio.patronymic].filter(Boolean).join(" ")
        : String(found.value || "").replace(/^ИП\s+/, "");
      return {
        kind: "ip",
        values: { [p("kind")]: "ip", [p("ip_name")]: fio, [p("ogrnip")]: data.ogrn || "", [p("inn")]: data.inn || "", [p("business_address")]: address },
        summary,
        note: null,
      };
    }
    const name = data.name || {};
    const opf = data.opf && data.opf.full;
    const orgName = opf && name.full ? `${opf} «${fancyQuotes(name.full, ["„", "“"])}»` : fancyQuotes(name.full_with_opf || found.value || "");
    const manager = data.management && data.management.name ? data.management : null;
    const values = { [p("kind")]: "org", [p("org_name")]: orgName, [p("ogrn")]: data.ogrn || "", [p("inn")]: data.inn || "", [p("business_address")]: address };
    if (manager) values[p("short_signer")] = initials(manager.name);
    return {
      kind: "org",
      values,
      summary,
      note: manager
        ? `Руководитель по ЕГРЮЛ: ${lowerFirst(manager.post) || "руководитель"} ${manager.name}. Поля «В лице кого» и «Основание полномочий» заполните сами: должность и ФИО в родительном падеже, например «генерального директора Иванова И. И.».`
        : "Поля «В лице кого» и «Основание полномочий» заполните сами.",
    };
  }

  /** Запрос к DaData. Бросает Error с понятным текстом. */
  async function lookup(number, key, fetchImpl = globalThis.fetch) {
    let response;
    try {
      response = await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Token ${key}` },
        body: JSON.stringify(requestBody(number)),
      });
    } catch {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      throw new Error(offline ? "Нет подключения к интернету. Сведения по ИНН загружаются только онлайн." : errorMessage(0));
    }
    if (!response.ok) throw new Error(errorMessage(response.status));
    return response.json();
  }

  /** Понятный текст ошибки по коду ответа DaData. */
  function errorMessage(status) {
    if (status === 401 || status === 403) return "Сервис проверки не принял ключ доступа. Напишите нам, мы починим.";
    if (status === 429) return "Сегодня проверок было слишком много. Попробуйте завтра.";
    return "Сервис проверки сейчас не отвечает. Попробуйте через несколько минут.";
  }

  return { ENDPOINT, STATUS, parseNumber, requestBody, summarize, requisites, partyValues, initials, lookup, errorMessage, formatDate };
});
