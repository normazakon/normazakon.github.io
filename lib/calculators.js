/* Расчёт процентов по статье 395 ГК РФ и договорной неустойки. Суммы в копейках. */
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
  function interest395(principal, from, to, keyRates) {
    if (!(principal > 0)) throw new CalculationError("Укажите сумму долга больше нуля.");
    if (!from || !to || from > to) throw new CalculationError("Дата окончания должна быть не раньше даты начала.");
    if (from < KEY_RATE_SINCE) throw new CalculationError("До 1 августа 2016 года проценты считались не по ключевой ставке. Начните расчет с этой даты или посчитайте ранний период отдельно.");
    if (to > keyRates.lastDate) throw new CalculationError(`В базе ставки известны по ${keyRates.lastDate}. Обновите историю ключевой ставки или сократите период.`);

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
    return { rows, total: rows.reduce((sum, row) => sum + row.amount, 0), days: daysInclusive(from, to), overlapsMoratorium };
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

  return { interest395, penalty, rateOn, daysInclusive, CalculationError, KEY_RATE_SINCE, MORATORIUM };
});
