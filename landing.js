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
})();
