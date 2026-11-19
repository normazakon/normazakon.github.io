/* Проверка контрагента по ИНН или ОГРН. Сведения из ЕГРЮЛ и ЕГРИП через сервис DaData. */
(function () {
  "use strict";

  const { h } = window.UI;
  const C = window.Counterparty;

  // где ещё стоит посмотреть: сведений об этом нет в выписке
  const MORE_SOURCES = [
    { href: "https://egrul.nalog.ru/", label: "Выписка из ЕГРЮЛ на сайте ФНС", note: "официальная выписка с подписью налоговой" },
    { href: "https://fedresurs.ru/", label: "Федресурс", note: "сообщения о банкротстве и существенные факты" },
    { href: "https://kad.arbitr.ru/", label: "Картотека арбитражных дел", note: "суды с участием компании" },
    { href: "https://fssp.gov.ru/iss/ip/", label: "Банк исполнительных производств ФССП", note: "долги по исполнительным листам" },
  ];

  /** Переключатель «Документ | Контрагент» в шапке раздела «Проверка». */
  function checkSwitch(active) {
    const item = (key, label, hash) => h("button", {
      type: "button", "aria-pressed": String(active === key),
      onClick: () => { if (active !== key) location.hash = hash; },
    }, label);
    return h("div", { class: "segmented check-switch", role: "group", "aria-label": "Что проверить" },
      item("document", "Документ", "#check"), item("company", "Контрагент", "#company"));
  }
  window.UI.checkSwitch = checkSwitch;

  window.Views = window.Views || {};
  window.Views.company = function (root) {
    const input = h("input", {
      id: "company-number", type: "text", inputMode: "numeric", autocomplete: "off", maxLength: 20,
      placeholder: "Например, 7707083893", "aria-describedby": "company-help",
    });
    const submit = h("button", { class: "button primary", type: "submit" }, "Проверить");
    const result = h("div", { class: "company-result", "aria-live": "polite" });
    let current = 0;

    async function check(event) {
      event.preventDefault();
      const parsed = C.parseNumber(input.value);
      if (parsed.error) {
        result.replaceChildren(h("p", { class: "calc-error", role: "alert" }, parsed.error));
        return;
      }
      const request = ++current;
      submit.disabled = true;
      result.replaceChildren(h("p", { class: "norm-loading" }, "Запрашиваем сведения из ЕГРЮЛ…"));
      try {
        const summary = C.summarize(await C.lookup(parsed.number, window.SITE.dadataKey));
        if (request !== current) return;
        result.replaceChildren(summary ? card(summary) : notFound(parsed));
      } catch (error) {
        if (request !== current) return;
        result.replaceChildren(h("p", { class: "calc-error", role: "alert" }, error.message));
      } finally {
        if (request === current) submit.disabled = false;
      }
    }

    function notFound(parsed) {
      return h("p", { class: "calc-error", role: "alert" },
        `По ${parsed.kind === "inn" ? "ИНН" : "ОГРН"} ${parsed.number} в ЕГРЮЛ и ЕГРИП ничего не нашлось. Проверьте номер. ` +
        "Если компания зарегистрирована в последние дни, сведения могут ещё не появиться.");
    }

    function card(summary) {
      const copied = h("p", { class: "company-copied", role: "status" });
      const copy = async () => {
        try {
          await navigator.clipboard.writeText(C.requisites(summary));
          copied.textContent = "Реквизиты скопированы, их можно вставить в договор.";
        } catch {
          copied.textContent = "Браузер не разрешил копирование.";
        }
      };
      const ids = summary.individual
        ? [["ИНН", summary.inn], ["ОГРНИП", summary.ogrn]]
        : [["ИНН", summary.inn], ["КПП", summary.kpp], ["ОГРН", summary.ogrn]];
      const rows = [
        ...ids,
        ["Дата регистрации", summary.registered && `${summary.registered}${summary.age !== null ? `, ${yearsText(summary.age)}` : ""}`],
        summary.liquidated && ["Дата прекращения", summary.liquidated],
        ["Адрес", summary.address],
        summary.manager && [summary.manager.post, summary.manager.name],
        ["Основной ОКВЭД", summary.okved],
        summary.branches > 0 && ["Филиалы", String(summary.branches)],
      ].filter((row) => row && row[1]);

      return h("article", { class: "company-card" },
        h("div", { class: "company-head" },
          h("h2", {}, summary.name),
          h("span", { class: `badge company-status ${summary.status.tone}` }, summary.status.label)),
        summary.fullName !== summary.name && h("p", { class: "company-full" }, summary.fullName),
        summary.warnings.length > 0
          ? h("ul", { class: "company-warnings" }, summary.warnings.map((text) => h("li", {}, text)))
          : h("p", { class: "company-clean" }, "Явных тревожных признаков в выписке нет."),
        h("dl", { class: "legal-details company-details" }, rows.flatMap(([term, value]) => [h("dt", {}, term), h("dd", {}, value)])),
        h("div", { class: "bar-actions" },
          h("button", { class: "button small", type: "button", onClick: copy }, window.UI.icon("copy"), "Скопировать реквизиты")),
        copied,
        summary.actual && h("p", { class: "company-source" }, `Сведения ЕГРЮЛ по данным DaData на ${summary.actual}.`));
    }

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Проверка контрагента"),
          h("p", {}, "Введите ИНН или ОГРН компании или предпринимателя. Покажем статус по ЕГРЮЛ, адрес, руководителя и признаки, на которые стоит обратить внимание перед договором.")),
        checkSwitch("company")),
      h("div", { class: "company-layout" },
        h("div", { class: "company-column" },
          h("form", { class: "company-form", onSubmit: check },
            h("div", { class: "field" },
              h("label", { htmlFor: "company-number" }, "ИНН или ОГРН"),
              h("div", { class: "company-input" }, input, submit),
              h("p", { class: "field-help", id: "company-help" }, "Номер отправляется в сервис DaData, больше ничего не передаётся."))),
          result),
        h("aside", { class: "company-more" },
          h("h2", {}, "Что ещё проверить"),
          h("ul", {}, MORE_SOURCES.map((source) => h("li", {},
            h("a", { href: source.href, target: "_blank", rel: "noopener noreferrer" }, source.label),
            h("span", {}, source.note)))))));
    input.focus();
  };

  function yearsText(age) {
    if (age < 1) return "меньше года";
    const tail = age % 100 >= 11 && age % 100 <= 14 ? "лет" : ({ 1: "год", 2: "года", 3: "года", 4: "года" })[age % 10] || "лет";
    return `${age} ${tail}`;
  }
})();
