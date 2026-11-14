/* Суммы прописью, даты и контрольные числа российских реквизитов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Russian = api;
})(globalThis, function () {
  "use strict";

  const UNITS = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const UNITS_FEMININE = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const TEENS = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const TENS = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const HUNDREDS = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];
  const SCALES = [
    { feminine: false, forms: ["", "", ""] },
    { feminine: true, forms: ["тысяча", "тысячи", "тысяч"] },
    { feminine: false, forms: ["миллион", "миллиона", "миллионов"] },
    { feminine: false, forms: ["миллиард", "миллиарда", "миллиардов"] },
    { feminine: false, forms: ["триллион", "триллиона", "триллионов"] },
  ];
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  function plural(number, [one, few, many]) {
    const lastTwo = number % 100;
    const last = number % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return many;
    if (last === 1) return one;
    if (last >= 2 && last <= 4) return few;
    return many;
  }

  function tripletWords(number, feminine) {
    const words = [HUNDREDS[Math.floor(number / 100)]];
    const rest = number % 100;
    if (rest >= 10 && rest <= 19) {
      words.push(TEENS[rest - 10]);
    } else {
      words.push(TENS[Math.floor(rest / 10)], (feminine ? UNITS_FEMININE : UNITS)[rest % 10]);
    }
    return words.filter(Boolean);
  }

  function numberToWords(number) {
    if (number === 0) return "ноль";
    const words = [];
    let rest = number;
    const triplets = [];
    while (rest > 0) {
      triplets.push(rest % 1000);
      rest = Math.floor(rest / 1000);
    }
    if (triplets.length > SCALES.length) throw new RangeError("Сумма слишком большая");
    for (let index = triplets.length - 1; index >= 0; index--) {
      const triplet = triplets[index];
      if (triplet === 0) continue;
      const scale = SCALES[index];
      words.push(...tripletWords(triplet, scale.feminine));
      const name = plural(triplet, scale.forms);
      if (name) words.push(name);
    }
    return words.join(" ");
  }

  /** Читает сумму вроде «150 000,50». Возвращает копейки или null. */
  function parseMoney(value) {
    if (value === undefined || value === null) return null;
    const clean = String(value).replace(/[\s ]/g, "").replace(",", ".").replace(/(руб\.?|р\.|₽)$/i, "");
    if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
    const [rubles, fraction = ""] = clean.split(".");
    const kopecks = Number(rubles) * 100 + Number(fraction.padEnd(2, "0"));
    return Number.isSafeInteger(kopecks) ? kopecks : null;
  }

  function groupDigits(number) {
    return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /** «150 000 (сто пятьдесят тысяч) рублей 00 копеек» */
  function moneyText(value) {
    const total = parseMoney(value);
    return total === null ? null : kopecksText(total);
  }

  function kopecksText(total) {
    const rubles = Math.floor(total / 100);
    const kopecks = total % 100;
    const rublesName = plural(rubles, ["рубль", "рубля", "рублей"]);
    const kopecksName = plural(kopecks, ["копейка", "копейки", "копеек"]);
    return `${groupDigits(rubles)} (${numberToWords(rubles)}) ${rublesName} ${String(kopecks).padStart(2, "0")} ${kopecksName}`;
  }

  function parseDate(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }

  /** «12 ноября 2026 г.» */
  function dateText(iso) {
    const date = parseDate(iso);
    if (!date) return null;
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} г.`;
  }

  function daysBetween(fromIso, toIso) {
    const from = parseDate(fromIso);
    const to = parseDate(toIso);
    if (!from || !to) return null;
    return Math.round((to - from) / 86400000);
  }

  /** Последний день срока длиной в указанное число месяцев. */
  function lastDayOfTerm(from, months) {
    const target = new Date(from);
    target.setUTCMonth(target.getUTCMonth() + months);
    target.setUTCDate(target.getUTCDate() - 1);
    return target;
  }

  function lastsAtLeastMonths(fromIso, toIso, months) {
    const from = parseDate(fromIso);
    const to = parseDate(toIso);
    return from && to ? to >= lastDayOfTerm(from, months) : null;
  }

  function exceedsMonths(fromIso, toIso, months) {
    const from = parseDate(fromIso);
    const to = parseDate(toIso);
    return from && to ? to > lastDayOfTerm(from, months) : null;
  }

  function weightedSum(digits, weights) {
    return weights.reduce((sum, weight, index) => sum + weight * digits[index], 0);
  }

  function isValidInn(value) {
    const text = String(value || "").trim();
    if (!/^(\d{10}|\d{12})$/.test(text)) return false;
    const digits = [...text].map(Number);
    if (digits.length === 10) {
      return weightedSum(digits, [2, 4, 10, 3, 5, 9, 4, 6, 8]) % 11 % 10 === digits[9];
    }
    const first = weightedSum(digits, [7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) % 11 % 10;
    const second = weightedSum(digits, [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8]) % 11 % 10;
    return first === digits[10] && second === digits[11];
  }

  function hasRegistrationChecksum(text, length, divisor) {
    if (!new RegExp(`^\\d{${length}}$`).test(text)) return false;
    const body = BigInt(text.slice(0, -1));
    return Number(body % BigInt(divisor) % 10n) === Number(text.at(-1));
  }

  const isValidOgrn = (value) => hasRegistrationChecksum(String(value || "").trim(), 13, 11);
  const isValidOgrnip = (value) => hasRegistrationChecksum(String(value || "").trim(), 15, 13);
  const isValidVin = (value) => /^[A-HJ-NPR-Z0-9]{17}$/i.test(String(value || "").trim());

  return {
    numberToWords, parseMoney, moneyText, kopecksText, parseDate, dateText, daysBetween, lastsAtLeastMonths, exceedsMonths,
    isValidInn, isValidOgrn, isValidOgrnip, isValidVin,
  };
});
