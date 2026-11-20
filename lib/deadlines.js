/* Процессуальные и гражданские сроки: когда истекает срок по правилам кодекса и производственному календарю.
   Подключается в браузере как window.Deadlines и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Deadlines = api;
})(globalThis, function () {
  "use strict";

  const DAY_MS = 86400000;

  /**
   * Правила исчисления. В каждом:
   *   workdays   сроки в днях считаются только по рабочим дням;
   *   shift      какие сроки переносятся с нерабочего последнего дня на следующий рабочий;
   *   units      в чём можно задать срок;
   *   basis      статьи, по которым считаем.
   */
  const REGIMES = {
    GPK: {
      name: "Гражданский процесс (ГПК РФ)", workdays: true, shift: ["days", "months", "years"], units: ["days", "months", "years"],
      basis: [["GPK", "107"], ["GPK", "108"]],
    },
    APK: {
      name: "Арбитражный процесс (АПК РФ)", workdays: true, shift: ["days", "months", "years"], units: ["days", "months", "years"],
      basis: [["APK", "113"], ["APK", "114"]],
    },
    GK: {
      name: "Гражданские сроки (ГК РФ)", workdays: false, shift: ["days", "weeks", "months", "years"], units: ["days", "weeks", "months", "years"],
      basis: [["GK", "191"], ["GK", "192"], ["GK", "193"]],
    },
    TK: {
      name: "Трудовые сроки (ТК РФ)", workdays: false, shift: ["days", "weeks", "months", "years"], units: ["days", "weeks", "months", "years"],
      basis: [["TK", "14"]],
    },
    KOAP: {
      // по КоАП переносятся только сроки в днях, сроки в сутках и месяцах не переносятся
      name: "Административные дела (КоАП РФ)", workdays: false, shift: ["days"], units: ["days", "sutki", "months", "years"],
      basis: [["KOAP", "4.8"]],
    },
  };

  const UNIT_WORDS = {
    days: ["день", "дня", "дней"],
    sutki: ["сутки", "суток", "суток"],
    weeks: ["неделя", "недели", "недель"],
    months: ["месяц", "месяца", "месяцев"],
    years: ["год", "года", "лет"],
  };

  /** Типовые сроки. from: от какого события считается. */
  const PRESETS = [
    { id: "gpk-appeal", name: "Апелляционная жалоба", regime: "GPK", amount: 1, unit: "months", from: "Дата принятия решения в окончательной форме", basis: ["GPK", "321"] },
    { id: "gpk-private", name: "Частная жалоба", regime: "GPK", amount: 15, unit: "days", from: "Дата вынесения определения", basis: ["GPK", "332"] },
    { id: "gpk-order", name: "Возражения на судебный приказ", regime: "GPK", amount: 10, unit: "days", from: "Дата получения копии приказа", basis: ["GPK", "128"] },
    { id: "gpk-default", name: "Отмена заочного решения", regime: "GPK", amount: 7, unit: "days", from: "Дата вручения копии заочного решения", basis: ["GPK", "237"] },
    { id: "gpk-cassation", name: "Кассационная жалоба", regime: "GPK", amount: 3, unit: "months", from: "Дата вступления в силу или изготовления мотивированного апелляционного определения", basis: ["GPK", "376.1"] },
    { id: "apk-appeal", name: "Апелляционная жалоба в арбитраже", regime: "APK", amount: 1, unit: "months", from: "Дата принятия решения", basis: ["APK", "259"] },
    { id: "apk-cassation", name: "Кассационная жалоба в арбитраже", regime: "APK", amount: 2, unit: "months", from: "Дата вступления акта в законную силу", basis: ["APK", "276"] },
    { id: "koap-appeal", name: "Жалоба на постановление по КоАП", regime: "KOAP", amount: 10, unit: "days", from: "Дата вручения или получения копии постановления", basis: ["KOAP", "30.3"] },
    { id: "tk-dismissal", name: "Иск о восстановлении на работе", regime: "TK", amount: 1, unit: "months", from: "Дата вручения копии приказа об увольнении", basis: ["TK", "392"] },
    { id: "tk-dispute", name: "Иск по трудовому спору", regime: "TK", amount: 3, unit: "months", from: "Дата, когда работник узнал о нарушении", basis: ["TK", "392"] },
  ];

  class DeadlineError extends Error {}

  const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
  const toIso = (date) => date.toISOString().slice(0, 10);
  const addDays = (iso, days) => toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
  const weekday = (iso) => toDate(iso).getUTCDay(); // 0 воскресенье, 6 суббота
  const format = (iso) => iso.split("-").reverse().join(".");
  const WEEKDAY_NAMES = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

  function counted(count, words) {
    const tens = count % 100;
    const units = count % 10;
    const word = tens >= 11 && tens <= 14 ? words[2] : units === 1 ? words[0] : units >= 2 && units <= 4 ? words[1] : words[2];
    return `${count} ${word}`;
  }

  /** Рабочий ли день. known = false, если календаря на этот год нет и учтены только выходные. */
  function dayInfo(iso, calendar) {
    const year = calendar && calendar.years[iso.slice(0, 4)];
    const weekend = weekday(iso) === 0 || weekday(iso) === 6;
    if (!year) {
      const holiday = calendar && calendar.holidays.includes(iso.slice(5));
      return { working: !weekend && !holiday, known: false };
    }
    if (year.work.includes(iso)) return { working: true, known: true };
    return { working: !weekend && !year.off.includes(iso), known: true };
  }

  /** Прибавляет месяцы: то же число, а если его нет в месяце, последний день месяца. */
  function addMonths(iso, months) {
    const [year, month, day] = iso.split("-").map(Number);
    const total = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(total / 12);
    const targetMonth = total % 12;
    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    return toIso(new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))));
  }

  /**
   * Когда истекает срок.
   * start: дата события, от которого считается срок (сам этот день в срок не входит).
   * Возвращает { end, plainEnd, shifted, steps, unknownYears, regime }:
   *   plainEnd   последний день срока до переноса с нерабочего дня;
   *   end        последний день с учётом переноса;
   *   steps      пояснения к расчёту по шагам;
   *   unknownYears годы без календаря, где учтены только выходные и праздники без переносов.
   */
  function compute({ regime: regimeId, amount, unit, start }, calendar) {
    const regime = REGIMES[regimeId];
    if (!regime) throw new DeadlineError("Неизвестный порядок исчисления");
    if (!regime.units.includes(unit)) throw new DeadlineError("Так срок в этом кодексе не исчисляется");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "")) throw new DeadlineError("Укажите дату события");
    if (!Number.isInteger(amount) || amount < 1 || amount > 3650) throw new DeadlineError("Срок должен быть целым числом от 1");

    const unknown = new Set();
    const info = (iso) => {
      const result = dayInfo(iso, calendar);
      if (!result.known) unknown.add(iso.slice(0, 4));
      return result;
    };
    const steps = [`Срок начинает течь со следующего дня после события: с ${format(addDays(start, 1))}.`];
    let plainEnd;
    const workdaysOnly = unit === "days" && regime.workdays;

    if (workdaysOnly) {
      let day = start;
      let left = amount;
      let skipped = 0;
      while (left > 0) {
        day = addDays(day, 1);
        if (info(day).working) left--;
        else skipped++;
      }
      plainEnd = day;
      steps.push(`Срок в днях считается только по рабочим дням: ${counted(amount, ["рабочий день", "рабочих дня", "рабочих дней"])}, нерабочих дней пропущено ${skipped}.`);
    } else if (unit === "days" || unit === "sutki") {
      plainEnd = addDays(start, amount);
      steps.push(`Считаются все календарные дни подряд: ${counted(amount, UNIT_WORDS[unit])}.`);
    } else if (unit === "weeks") {
      plainEnd = addDays(start, amount * 7);
      steps.push(`Срок в неделях истекает в тот же день недели последней недели срока.`);
    } else {
      const months = unit === "years" ? amount * 12 : amount;
      plainEnd = addMonths(start, months);
      steps.push(unit === "years"
        ? "Срок в годах истекает в те же месяц и число последнего года срока."
        : "Срок в месяцах истекает в то же число последнего месяца, а если такого числа нет, в последний день месяца.");
    }

    let end = plainEnd;
    const endInfo = info(plainEnd);
    if (!endInfo.working) {
      if (regime.shift.includes(unit)) {
        while (!info(end).working) end = addDays(end, 1);
        steps.push(`${format(plainEnd)} (${WEEKDAY_NAMES[weekday(plainEnd)]}) нерабочий день, поэтому срок истекает в следующий рабочий день: ${format(end)}.`);
      } else {
        steps.push(`${format(plainEnd)} нерабочий день, но для этого срока перенос на рабочий день не предусмотрен.`);
      }
    }
    steps.push("Действие можно совершить до 24 часов последнего дня, в том числе сдать документы на почту. Если действие совершается в самом суде, срок истекает с окончанием его рабочего дня.");
    return { end, plainEnd, shifted: end !== plainEnd, steps, unknownYears: [...unknown].sort(), regime };
  }

  function describeAmount(amount, unit) {
    return counted(amount, UNIT_WORDS[unit]);
  }

  /** Перенос с нерабочего последнего дня на ближайший рабочий (статья 193 ГК РФ). */
  function shiftToWorkday(iso, calendar, unknown) {
    let day = iso;
    for (;;) {
      const result = dayInfo(day, calendar);
      if (!result.known) unknown.add(day.slice(0, 4));
      if (result.working) return day;
      day = addDays(day, 1);
    }
  }

  /**
   * Срок в календарных днях без нерабочих праздничных дней (статья 112 ТК РФ): так считается,
   * например, срок страховой выплаты по ОСАГО. Выходные считаются, праздники пропускаются.
   * Возвращает { end, plainEnd, unknownYears }.
   */
  function addDaysWithoutHolidays(start, amount, calendar) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !Number.isInteger(amount) || amount < 1) return null;
    const holidays = (calendar && calendar.holidays) || [];
    let day = start;
    let left = amount;
    while (left > 0) {
      day = addDays(day, 1);
      if (!holidays.includes(day.slice(5))) left--;
    }
    const unknown = new Set();
    const end = shiftToWorkday(day, calendar, unknown);
    return { end, plainEnd: day, unknownYears: [...unknown].sort() };
  }

  /** Срок в рабочих днях по производственному календарю. Возвращает { end, unknownYears }. */
  function addWorkdays(start, amount, calendar) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start || "") || !Number.isInteger(amount) || amount < 1) return null;
    const unknown = new Set();
    let day = start;
    let left = amount;
    while (left > 0) {
      day = addDays(day, 1);
      const result = dayInfo(day, calendar);
      if (!result.known) unknown.add(day.slice(0, 4));
      if (result.working) left--;
    }
    return { end: day, unknownYears: [...unknown].sort() };
  }

  return {
    compute, dayInfo, addMonths, describeAmount, format, addDaysWithoutHolidays, addWorkdays,
    REGIMES, PRESETS, UNIT_WORDS, WEEKDAY_NAMES, DeadlineError,
  };
});
