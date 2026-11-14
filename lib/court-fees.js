/* Государственная пошлина: суды общей юрисдикции по статье 333.19 НК РФ, арбитражные суды по статье 333.21.
   Суммы считаются в копейках. Шкалу нужно сверять с редакцией кодекса при обновлении базы. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CourtFees = api;
})(globalThis, function () {
  "use strict";

  const RUBLE = 100;
  const MAX_FEE = 900000 * RUBLE;
  const DIVORCE_FEE = 5000 * RUBLE;
  const COURT_ORDER_PRICE_LIMIT = 500000 * RUBLE;
  const MAGISTRATE_PRICE_LIMIT = 50000 * RUBLE;

  // Верхняя граница цены иска, базовая сумма, процент и порог, сверх которого он считается
  const SCALE = [
    { upTo: 100000, base: 4000, percent: 0, over: 0 },
    { upTo: 300000, base: 4000, percent: 3, over: 100000 },
    { upTo: 500000, base: 10000, percent: 2.5, over: 300000 },
    { upTo: 1000000, base: 15000, percent: 2, over: 500000 },
    { upTo: 3000000, base: 25000, percent: 1, over: 1000000 },
    { upTo: 8000000, base: 45000, percent: 0.7, over: 3000000 },
    { upTo: 24000000, base: 80000, percent: 0.35, over: 8000000 },
    { upTo: 50000000, base: 136000, percent: 0.3, over: 24000000 },
    { upTo: 100000000, base: 214000, percent: 0.2, over: 50000000 },
    { upTo: Infinity, base: 314000, percent: 0.15, over: 100000000 },
  ];

  const ARBITRATION_SCALE = [
    { upTo: 100000, base: 10000, percent: 0, over: 0 },
    { upTo: 1000000, base: 10000, percent: 5, over: 100000 },
    { upTo: 10000000, base: 55000, percent: 3, over: 1000000 },
    { upTo: 50000000, base: 325000, percent: 1, over: 10000000 },
    { upTo: Infinity, base: 725000, percent: 0.5, over: 50000000 },
  ];
  const ARBITRATION_MAX_FEE = 10000000 * RUBLE;
  const ARBITRATION_ORDER_MIN_FEE = 8000 * RUBLE;

  function byScale(scale, priceKopecks, maxFee) {
    const step = scale.find((item) => priceKopecks <= item.upTo * RUBLE);
    const excess = Math.max(0, priceKopecks - step.over * RUBLE);
    const fee = step.base * RUBLE + Math.round((excess * step.percent) / 100);
    return Math.min(fee, maxFee);
  }

  /** Пошлина за имущественный иск, подлежащий оценке (подпункт 1 пункта 1 статьи 333.19). */
  function claimFee(priceKopecks) {
    return byScale(SCALE, priceKopecks, MAX_FEE);
  }

  /** Арбитражный суд: имущественный иск (подпункт 1 пункта 1 статьи 333.21). */
  function arbitrationClaimFee(priceKopecks) {
    return byScale(ARBITRATION_SCALE, priceKopecks, ARBITRATION_MAX_FEE);
  }

  /** Арбитражный суд: судебный приказ, половина пошлины за иск, но не менее 8 000 рублей (подпункт 3). */
  function arbitrationOrderFee(priceKopecks) {
    return Math.max(Math.round(arbitrationClaimFee(priceKopecks) / 2), ARBITRATION_ORDER_MIN_FEE);
  }

  /** Заявление о вынесении судебного приказа: половина пошлины за иск (подпункт 2). */
  function courtOrderFee(priceKopecks) {
    return Math.round(claimFee(priceKopecks) / 2);
  }

  return { claimFee, courtOrderFee, arbitrationClaimFee, arbitrationOrderFee, DIVORCE_FEE, COURT_ORDER_PRICE_LIMIT, MAGISTRATE_PRICE_LIMIT };
});
