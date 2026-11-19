/* Лендинг: вкладки «Для кого». Без них страница тоже работает: видна первая вкладка. */
(function () {
  "use strict";

  const tabs = [...document.querySelectorAll(".land-tabs [role=tab]")];
  function select(tab) {
    for (const other of tabs) {
      const active = other === tab;
      other.setAttribute("aria-selected", String(active));
      other.setAttribute("aria-pressed", String(active));
      other.tabIndex = active ? 0 : -1;
      document.getElementById(other.getAttribute("aria-controls")).hidden = !active;
    }
  }
  tabs.forEach((tab, index) => {
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.addEventListener("click", () => select(tab));
    // стрелки переключают вкладки, как в обычных вкладках операционной системы
    tab.addEventListener("keydown", (event) => {
      const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });

  /* Движение. При «уменьшить движение» в системе и в старых браузерах ничего не делаем: всё видно сразу. */
  const calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (calm || !("IntersectionObserver" in window)) return;

  // блоки появляются при прокрутке; в группе карточки идут друг за другом
  const groups = [
    // вкладки «Для кого» сюда не входят: скрытые не пересекают экран, у них своя анимация при переключении
    ".land-section h2", ".land-section-lead", ".land-soon", ".land-tabs",
    ".land-features > li", ".land-why > li", ".land-steps-list > li", ".land-faq details", ".land-final-box",
  ];
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      reveal.unobserve(entry.target);
    }
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  for (const selector of groups) {
    document.querySelectorAll(selector).forEach((element) => {
      // карточки в одном ряду: задержка по месту в сетке, а не по номеру в списке
      const siblings = element.parentElement.children;
      const index = selector.endsWith("> li") || selector.endsWith("details") ? [...siblings].indexOf(element) % 3 : 0;
      element.style.setProperty("--i", String(index));
      element.classList.add("reveal");
      reveal.observe(element);
    });
  }

  // цифры «Нормы» набегают от нуля, когда блок показался на экране
  const format = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  function count(element) {
    const original = element.textContent;
    const match = /^([\d\s ]+)(.*)$/.exec(original);
    if (!match) return;
    const target = Number(match[1].replace(/\D/g, ""));
    const suffix = match[2];
    const started = performance.now();
    const duration = 1400;
    element.style.minWidth = `${element.getBoundingClientRect().width}px`;
    function frame(now) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      element.textContent = progress < 1 ? format(Math.round(target * eased)) + suffix : original;
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  const stats = document.querySelector(".land-stats");
  if (stats) {
    const numbers = [...stats.querySelectorAll("strong")];
    numbers.forEach((element) => element.setAttribute("aria-label", element.textContent));
    const counter = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      counter.disconnect();
      numbers.forEach(count);
    }, { threshold: 0.4 });
    counter.observe(stats);
  }
})();
