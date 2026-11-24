/* Расчёты: проценты по статье 395 ГК РФ, неустойка, компенсация за задержку зарплаты (ст. 236 ТК),
   пени за ЖКУ (ст. 155 ЖК), средний заработок для отпуска (ст. 139 ТК), алименты (ст. 81, 115 СК),
   налоговые вычеты (ст. 219, 220 НК). Суммы в копейках. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Calculators = api;
})(globalThis, function () {
  "use strict";

  const DAY_MS = 86400000;
  // До этой даты статья 395 ГК РФ отсылала к другим ставкам, а не к ключевой
  const KEY_RATE_SINCE = "2016-08-01";
  const MORATORIUM = { from: "2022-04-01", to: "2022-10-01" };

  const toDate = (iso) => new Date(`${iso}T00:00:00Z`);
  const toIso = (date) => date.toISOString().slice(0, 10);
  const addDays = (iso, days) => toIso(new Date(toDate(iso).getTime() + days * DAY_MS));
  const daysInclusive = (from, to) => Math.round((toDate(to) - toDate(from)) / DAY_MS) + 1;
  const yearLength = (year) => (new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365);

  class CalculationError extends Error {}

  /** Ставка, действующая в указанный день. */
  function rateOn(iso, changes) {
    let current = null;
    for (const [day, rate] of changes) {
      if (day <= iso) current = rate;
      else break;
    }
    return current;
  }

  /**
   * Проценты за пользование чужими денежными средствами за дни просрочки с from по to включительно.
   * Период делится по датам изменения ключевой ставки и по границе календарного года.
   */
  /**
   * Проверка, что ставки известны на весь период. С extend: true период после последней известной даты
   * считается по последней известной ставке, а в результате появляется extendedFrom — с какого дня ставка предполагаемая.
   */
  function checkRatesKnown(to, keyRates, options) {
    if (to <= keyRates.lastDate) return null;
    if (!options || !options.extend) throw new CalculationError(`В базе ставки известны по ${keyRates.lastDate}. Обновите историю ключевой ставки или сократите период.`);
    return addDays(keyRates.lastDate, 1);
  }

  function interest395(principal, from, to, keyRates, options) {
    if (!(principal > 0)) throw new CalculationError("Укажите сумму долга больше нуля.");
    if (!from || !to || from > to) throw new CalculationError("Дата окончания должна быть не раньше даты начала.");
    if (from < KEY_RATE_SINCE) throw new CalculationError("До 1 августа 2016 года проценты считались не по ключевой ставке. Начните расчет с этой даты или посчитайте ранний период отдельно.");
    const extendedFrom = checkRatesKnown(to, keyRates, options);

    const boundaries = new Set();
    for (const [day] of keyRates.changes) if (day > from && day <= to) boundaries.add(day);
    for (let year = Number(from.slice(0, 4)) + 1; year <= Number(to.slice(0, 4)); year++) boundaries.add(`${year}-01-01`);
    const starts = [from, ...[...boundaries].sort()];

    const rows = starts.map((start, index) => {
      const end = index + 1 < starts.length ? addDays(starts[index + 1], -1) : to;
      const days = daysInclusive(start, end);
      const rate = rateOn(start, keyRates.changes);
      const basis = yearLength(Number(start.slice(0, 4)));
      const amount = Math.round((principal * rate * days) / (100 * basis));
      return { from: start, to: end, days, rate, basis, amount };
    });

    const overlapsMoratorium = from <= MORATORIUM.to && to >= MORATORIUM.from;
    return { rows, total: rows.reduce((sum, row) => sum + row.amount, 0), days: daysInclusive(from, to), overlapsMoratorium, extendedFrom };
  }

  /**
   * Компенсация за задержку зарплаты по статье 236 ТК: 1/150 ключевой ставки, действовавшей в каждый день задержки,
   * от невыплаченной суммы. Считается со дня, следующего за днем выплаты (dueDate), по день расчета (paidDate) включительно.
   */
  function salaryCompensation(principal, dueDate, paidDate, keyRates, options) {
    if (!(principal > 0)) throw new CalculationError("Укажите невыплаченную сумму больше нуля.");
    if (!dueDate || !paidDate || paidDate <= dueDate) throw new CalculationError("День расчета должен быть позже дня, когда зарплату должны были выплатить.");
    const from = addDays(dueDate, 1);
    const extendedFrom = checkRatesKnown(paidDate, keyRates, options);
    const starts = [from, ...keyRates.changes.map(([day]) => day).filter((day) => day > from && day <= paidDate)];
    const rows = starts.map((start, index) => {
      const end = index + 1 < starts.length ? addDays(starts[index + 1], -1) : paidDate;
      const days = daysInclusive(start, end);
      const rate = rateOn(start, keyRates.changes);
      const amount = Math.round((principal * rate * days) / (100 * 150));
      return { from: start, to: end, days, rate, amount };
    });
    return { rows, total: rows.reduce((sum, row) => sum + row.amount, 0), days: daysInclusive(from, paidDate), extendedFrom };
  }

  /**
   * Пени за несвоевременную оплату жилья и коммунальных услуг (часть 14 статьи 155 ЖК): с 31-го по 90-й день просрочки —
   * 1/300 ставки, с 91-го дня — 1/130, ставка — на день фактической оплаты. dueDate — последний день срока оплаты.
   */
  function utilityPenalty(debt, dueDate, paidDate, ratePercent) {
    if (!(debt > 0)) throw new CalculationError("Укажите сумму долга больше нуля.");
    if (!(ratePercent > 0)) throw new CalculationError("Укажите ставку больше нуля.");
    if (!dueDate || !paidDate || paidDate <= dueDate) throw new CalculationError("День оплаты должен быть позже последнего дня срока оплаты.");
    const overdue = daysInclusive(addDays(dueDate, 1), paidDate);
    const first = Math.max(0, Math.min(overdue, 90) - 30);
    const second = Math.max(0, overdue - 90);
    const firstAmount = Math.round((debt * ratePercent * first) / (100 * 300));
    const secondAmount = Math.round((debt * ratePercent * second) / (100 * 130));
    return {
      overdue, free: Math.min(overdue, 30), first, second, firstAmount, secondAmount, total: firstAmount + secondAmount,
      firstFrom: first ? addDays(dueDate, 31) : null, secondFrom: second ? addDays(dueDate, 91) : null,
    };
  }

  const AVERAGE_MONTH_DAYS = 29.3;

  /**
   * Средний дневной заработок для отпуска и компенсации за неиспользованный отпуск (статья 139 ТК):
   * начисленная зарплата за расчетный период, деленная на число полностью отработанных месяцев и на 29,3.
   * days — дни отпуска или неиспользованного отпуска. Результат в копейках.
   */
  function vacationPay(earnings, months, days) {
    if (!(earnings > 0)) throw new CalculationError("Укажите начисленную зарплату за расчетный период.");
    if (!Number.isInteger(months) || months < 1 || months > 12) throw new CalculationError("Число месяцев — от 1 до 12.");
    if (!(days > 0)) throw new CalculationError("Укажите число дней отпуска.");
    const daily = Math.round(earnings / months / AVERAGE_MONTH_DAYS);
    return { daily, days, total: Math.round(daily * days) };
  }

  /** Неустойка в процентах в день с необязательным пределом. */
  function penalty(base, percentPerDay, from, to, cap) {
    if (!(base > 0)) throw new CalculationError("Укажите сумму, на которую начисляется неустойка.");
    if (!(percentPerDay > 0)) throw new CalculationError("Укажите процент неустойки больше нуля.");
    if (!from || !to || from > to) throw new CalculationError("Дата окончания должна быть не раньше даты начала.");
    const days = daysInclusive(from, to);
    const full = Math.round((base * percentPerDay * days) / 100);
    const limited = cap > 0 && full > cap;
    return { days, full, total: limited ? cap : full, limited };
  }

  /* ---------- Алименты (статьи 81 и 115 СК) ---------- */

  /** Доля заработка на несовершеннолетних детей: на одного — 1/4, на двух — 1/3, на трех и более — 1/2. */
  function alimonyShare(children) {
    if (!Number.isInteger(children) || children < 1) throw new CalculationError("Укажите число детей.");
    return children === 1 ? [1, 4] : children === 2 ? [1, 3] : [1, 2];
  }

  /** Алименты в месяц с дохода (в копейках): доход × доля. */
  function alimonyAmount(income, children) {
    if (!(income > 0)) throw new CalculationError("Укажите доход больше нуля.");
    const [top, bottom] = alimonyShare(children);
    return { share: `${top}/${bottom}`, monthly: Math.round(income * top / bottom) };
  }

  /** Неустойка за просрочку алиментов, взысканных судом: 0,1 % невыплаченной суммы за каждый день (ст. 115 СК). */
  function alimonyPenalty(debt, from, to) {
    return penalty(debt, 0.1, from, to, 0);
  }

  /* ---------- Налоговые вычеты по НДФЛ (статьи 219, 220 НК) ---------- */

  const DEDUCTIONS = {
    property: { limit: 200000000, carry: true },   // покупка или строительство жилья — 2 млн ₽, остаток переносится
    mortgage: { limit: 300000000, carry: false },  // проценты по ипотеке — 3 млн ₽, по одному объекту
    social: { limit: 15000000, carry: false },     // лечение, свое обучение, спорт и др. — 150 тыс. ₽ в совокупности за год
    childEducation: { limit: 11000000, carry: false }, // обучение ребенка — 110 тыс. ₽ на каждого ребенка
    expensiveTreatment: { limit: 0, carry: false },   // дорогостоящее лечение — без предела
  };

  /**
   * Сколько НДФЛ вернут по вычету. expenses — расходы, kind — вид вычета, children — для обучения детей,
   * rate — ставка НДФЛ в процентах (13 или 15), taxPaid — удержанный за год налог (необязательно, ограничивает возврат за год).
   */
  function deductionRefund(kind, expenses, { children = 1, rate = 13, taxPaid = 0 } = {}) {
    const rule = DEDUCTIONS[kind];
    if (!rule) throw new CalculationError("Выберите вид вычета.");
    if (!(expenses > 0)) throw new CalculationError("Укажите сумму расходов.");
    const limit = kind === "childEducation" ? rule.limit * Math.max(1, children) : rule.limit;
    const deduction = limit ? Math.min(expenses, limit) : expenses;
    const refund = Math.round(deduction * rate / 100);
    const thisYear = taxPaid > 0 ? Math.min(refund, taxPaid) : refund;
    return { deduction, limited: Boolean(limit) && expenses > limit, refund, thisYear, rest: refund - thisYear, carry: rule.carry };
  }

  return { interest395, penalty, salaryCompensation, utilityPenalty, vacationPay, alimonyShare, alimonyAmount, alimonyPenalty, deductionRefund, rateOn, daysInclusive, CalculationError, KEY_RATE_SINCE, MORATORIUM, AVERAGE_MONTH_DAYS, DEDUCTIONS };
});
