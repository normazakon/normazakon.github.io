/* Установка на телефон или компьютер и работа без интернета.
   Сервис-воркер работает только на сайте (http/https), при открытии файла с диска он не нужен. */
(function () {
  "use strict";

  const { h } = window.UI;
  const supported = "serviceWorker" in navigator && /^https?:$/.test(location.protocol);
  let installPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  /** Строка в подвале: кнопка установки или подсказка для iPhone. */
  function renderInstall() {
    const line = document.getElementById("install-line");
    if (!line) return;
    if (isStandalone()) {
      line.hidden = true;
      return;
    }
    if (installPrompt) {
      line.replaceChildren(h("button", {
        class: "link-button",
        type: "button",
        onClick: async () => {
          const prompt = installPrompt;
          installPrompt = null;
          prompt.prompt();
          await prompt.userChoice;
          renderInstall();
        },
      }, "Установить «Норму» как приложение"), " — значок на экране и работа без интернета.");
      line.hidden = false;
    } else if (supported && isIos()) {
      line.replaceChildren("Чтобы установить «Норму» на iPhone, нажмите «Поделиться» в Safari и выберите «На экран „Домой“».");
      line.hidden = false;
    } else {
      line.hidden = true;
    }
  }

  function renderConnection() {
    document.body.classList.toggle("offline", !navigator.onLine);
    const note = document.getElementById("offline-note");
    if (note) note.hidden = navigator.onLine;
  }

  /** Работает ли сейчас сохранение для офлайна. */
  function offlineReady() {
    return supported && Boolean(navigator.serviceWorker.controller);
  }

  const LAW_FILES = ["texts", "editions"];

  /** Сохранены ли тексты и прежние редакции закона в копии для работы без интернета. */
  async function isSaved(lawId) {
    if (!supported || !("caches" in window)) return false;
    const found = await Promise.all(LAW_FILES.map((folder) =>
      caches.match(new URL(`data/${folder}/${encodeURIComponent(lawId)}.js`, location.href).href)));
    return found.every(Boolean);
  }

  /** Загружает тексты и редакции всех законов, чтобы они сохранились для работы без интернета. */
  async function saveAllTexts(onProgress) {
    const laws = window.LAW_BASE.laws;
    const ids = Object.keys(laws).filter((id) => Object.values(laws[id].articles).some((article) => article.hasText));
    for (const [index, id] of ids.entries()) {
      onProgress(index, ids.length, laws[id].short);
      // запрос идёт через сервис-воркер, и он кладёт файл в копию
      for (const folder of LAW_FILES) {
        const response = await fetch(`data/${folder}/${encodeURIComponent(id)}.js`);
        if (!response.ok) throw new Error(`Не удалось загрузить ${id}`);
        await response.arrayBuffer();
      }
    }
    onProgress(ids.length, ids.length, "");
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    renderInstall();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    renderInstall();
  });
  window.addEventListener("online", renderConnection);
  window.addEventListener("offline", renderConnection);

  if (supported) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* без сервис-воркера приложение просто работает онлайн */
    });
  }

  renderInstall();
  renderConnection();
  window.Pwa = { offlineReady, saveAllTexts, isSaved };
})();
