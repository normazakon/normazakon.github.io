/* Проверка ссылок на нормы в чужом документе. */
(function () {
  "use strict";

  const { h, showArticle } = window.UI;
  const { analyze, paragraphsOfPart, SEVERITY } = window.Checker;
  const MAX_FILE_BYTES = 10 * 1024 * 1024;
  const TILES = [
    { key: "problem", label: "Ошибки" },
    { key: "check", label: "Проверить вручную" },
    { key: "ok", label: "Найдено в базе" },
  ];

  /** Объединяет находки одного участка текста. Пересечения отдаёт более раннему участку. */
  function buildSegments(findings) {
    const segments = [];
    for (const finding of findings) {
      const last = segments[segments.length - 1];
      if (last && finding.start < last.end) {
        last.ids.push(finding.id);
        last.end = Math.max(last.end, finding.end);
        if (SEVERITY[finding.severity] > SEVERITY[last.severity]) last.severity = finding.severity;
      } else {
        segments.push({ start: finding.start, end: finding.end, severity: finding.severity, ids: [finding.id] });
      }
    }
    return segments;
  }

  window.Views = window.Views || {};
  window.Views.check = function (root) {
    const base = window.LAW_BASE;
    const state = { text: "", result: null, filter: null, selected: null };

    const docView = h("article", { class: "doc-view", tabIndex: 0, id: "doc-view", "aria-label": "Документ с отмеченными ссылками" });
    const docInput = h("textarea", { class: "doc-input", id: "doc-input", spellcheck: false, hidden: true, "aria-label": "Текст документа", placeholder: "Вставьте текст документа" });
    const tally = h("div", { class: "tally", role: "group", "aria-label": "Фильтр результатов" });
    const dateInput = h("input", { type: "date", id: "doc-date", min: "1990-01-01", onChange: () => rerun() });
    const dateHint = h("p", { class: "doc-date-hint", id: "doc-date-hint", role: "status" });
    const dateBox = h("div", { class: "doc-date" },
      h("label", { htmlFor: "doc-date" }, "Дата документа"),
      dateInput,
      h("button", { class: "button quiet small", type: "button", onClick: () => { dateInput.value = ""; rerun(); } }, "Сбросить"),
      dateHint);
    const list = h("ol", { class: "findings", id: "findings" });
    const empty = h("p", { class: "empty", hidden: true }, "Ссылок на нормы не найдено. Проверьте, что в тексте есть указания вроде «ст. 10 ГК РФ».");
    const fileError = h("p", { class: "file-error", role: "alert", hidden: true });
    const editButton = h("button", { class: "button quiet", type: "button", id: "edit-button", onClick: startEditing }, "Изменить текст");
    const checkButton = h("button", { class: "button primary", type: "button", id: "check-button", hidden: true, onClick: () => { markSample(null); showResult(docInput.value); } }, "Проверить");
    const chips = h("div", { class: "chips", role: "group", "aria-label": "Примеры с вымышленными данными" },
      h("span", { class: "chips-label" }, "Примеры:"),
      window.SAMPLES.map((sample) => h("button", {
        class: "chip", type: "button", dataset: { id: sample.id },
        onClick: () => { markSample(sample.id); showResult(sample.text); },
      }, sample.name)));

    function renderDocument() {
      docView.replaceChildren();
      docView.classList.toggle("filtered", Boolean(state.filter));
      let position = 0;
      for (const segment of buildSegments(state.result.findings)) {
        docView.append(state.text.slice(position, segment.start));
        const open = () => select(segment.ids[0], { scrollList: true });
        const visible = segment.ids.some((id) => !state.filter || state.result.findings[id].severity === state.filter);
        const classes = ["mark", segment.severity, visible ? "" : "dim", segment.ids.includes(state.selected) ? "selected" : ""];
        docView.append(h("span", {
          class: classes.filter(Boolean).join(" "), tabIndex: 0, role: "button", dataset: { ids: segment.ids.join(",") },
          onClick: open,
          onKeydown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            open();
          },
        }, state.text.slice(segment.start, segment.end)));
        position = segment.end;
      }
      docView.append(state.text.slice(position));
    }

    function renderTally() {
      tally.replaceChildren(...TILES.map(({ key, label }) => h("button", {
        class: `tile ${key}`, type: "button", "aria-pressed": String(state.filter === key),
        onClick: () => { state.filter = state.filter === key ? null : key; render(); },
      }, h("b", {}, String(state.result.counts[key])), h("span", {}, label))));
    }

    /** Абзацы статьи в той редакции, с которой её сверяли. */
    function findingText(finding) {
      const current = window.LawTexts.get(finding.lawId, finding.number);
      if (!finding.date || !window.Editions.isLoaded(finding.lawId)) return current;
      const found = window.Editions.at(base, window.LAW_EDITIONS, window.LAW_TEXTS, finding.lawId, finding.number, finding.date);
      return found.version && !found.version.current ? found.version.text : current;
    }

    /** Текст нормы под находкой. Если тексты закона ещё не загружены, загружает их и перерисовывает список. */
    function normText(finding) {
      if (!finding.hasText || finding.id !== state.selected) return null;
      const paragraphs = findingText(finding);
      if (paragraphs) {
        return h("div", { class: "norm", tabIndex: 0 }, paragraphsOfPart(paragraphs, finding.part).map((line) => h("p", {}, line)));
      }
      window.LawTexts.load(finding.lawId)
        .then(() => { if (state.selected === finding.id) renderList(); })
        .catch(() => {});
      return h("p", { class: "norm-loading" }, "Загружаем текст статьи…");
    }

    function renderDetails(finding) {
      return h("div", { class: "finding-body", hidden: finding.id !== state.selected },
        h("p", {}, finding.message),
        finding.suggestions?.length > 0 && h("ul", { class: "suggestions" }, finding.suggestions.map((item) => h("li", {}, `Ближайшая: ст. ${item}`))),
        normText(finding),
        finding.url && h("button", {
          class: "link-button", type: "button", onClick: () => showArticle(finding.lawId, finding.number, { date: finding.date }),
        }, "Открыть статью целиком"));
    }

    function renderList() {
      const visible = state.result.findings
        .filter((finding) => !state.filter || finding.severity === state.filter)
        .sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity] || a.start - b.start);
      list.replaceChildren(...visible.map((finding) => h("li", { class: `finding ${finding.severity}`, dataset: { id: finding.id } },
        h("button", {
          class: "finding-head", type: "button", "aria-expanded": String(finding.id === state.selected),
          onClick: () => select(finding.id, { scrollDocument: true }),
        },
        h("span", { class: "finding-label" }, finding.label),
        h("span", { class: "finding-status" }, finding.status),
        finding.title && !/^Утратил/.test(finding.title) && h("span", { class: "finding-title" }, finding.title)),
        renderDetails(finding))));
      empty.hidden = state.result.findings.length > 0;
      list.hidden = state.result.findings.length === 0;
    }

    function render() {
      renderTally();
      renderList();
      renderDocument();
    }

    function select(id, { scrollList = false, scrollDocument = false } = {}) {
      state.selected = state.selected === id ? null : id;
      render();
      if (state.selected === null) return;
      if (scrollList) {
        if (state.filter && state.result.findings[id].severity !== state.filter) {
          state.filter = null;
          render();
        }
        list.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" });
      }
      if (scrollDocument) {
        [...docView.querySelectorAll(".mark")]
          .find((mark) => mark.dataset.ids.split(",").includes(String(id)))
          ?.scrollIntoView({ block: "center" });
      }
    }

    /**
     * Проверяет текст. С датой документа сначала загружает редакции законов, на которые есть ссылки,
     * а пока они грузятся, показывает проверку по действующим редакциям.
     */
    function runAnalysis() {
      const date = dateInput.value || null;
      const plain = analyze(state.text, base);
      if (!date) {
        dateHint.textContent = "Без даты ссылки сверяются с действующими редакциями.";
        return plain;
      }
      const ids = [...new Set(plain.findings.map((finding) => finding.lawId).filter(Boolean))];
      // прежние редакции записаны разницей с действующим текстом, поэтому нужны и тексты
      const missing = ids.filter((id) => !window.Editions.isLoaded(id) || !window.LawTexts.isLoaded(id));
      const day = window.Editions.formatDate(date);
      if (missing.length) {
        const text = state.text;
        dateHint.textContent = "Загружаем редакции законов…";
        Promise.all(missing.flatMap((id) => [window.Editions.load(id), window.LawTexts.load(id)]))
          .then(() => { if (state.text === text && dateInput.value === date) rerun(); })
          .catch(() => { dateHint.textContent = "Не удалось загрузить редакции. Ссылки сверены с действующими редакциями."; });
        return plain;
      }
      dateHint.textContent = `Ссылки сверены с редакциями, которые действовали ${day}.`;
      return analyze(state.text, base, { date, editions: window.LAW_EDITIONS, texts: window.LAW_TEXTS });
    }

    function rerun() {
      if (!state.result) return;
      const selected = state.selected;
      state.result = runAnalysis();
      state.selected = state.result.findings[selected] ? selected : null;
      render();
    }

    function showResult(text) {
      state.text = text;
      state.result = runAnalysis();
      state.filter = null;
      state.selected = null;
      docInput.hidden = true;
      docView.hidden = false;
      checkButton.hidden = true;
      editButton.hidden = false;
      render();
    }

    function markSample(id) {
      chips.querySelectorAll(".chip").forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.id === id)));
    }

    function startEditing() {
      docInput.value = state.text;
      docInput.hidden = false;
      docView.hidden = true;
      checkButton.hidden = false;
      editButton.hidden = true;
      docInput.focus();
    }

    function loadFile(file) {
      fileError.hidden = true;
      const showError = (message) => {
        fileError.textContent = message;
        fileError.hidden = false;
      };
      if (file.size > MAX_FILE_BYTES) {
        showError("Файл больше 10 МБ. Загрузите файл поменьше или вставьте нужный фрагмент.");
        return;
      }
      const name = file.name.toLowerCase();
      if (name.endsWith(".doc")) {
        showError("Старый формат .doc не поддерживается. Сохраните документ в Word как .docx и загрузите снова.");
        return;
      }
      const reading = name.endsWith(".docx")
        ? file.arrayBuffer().then(window.DocxReader.readDocx)
        : file.text();
      reading
        .then((text) => {
          if (!text.trim()) throw new window.DocxReader.DocxError("В файле нет текста.");
          markSample(null);
          showResult(text);
        })
        .catch((error) => {
          showError(error instanceof window.DocxReader.DocxError
            ? error.message
            : "Не удалось прочитать файл. Сохраните его как .docx или текст в UTF-8 и попробуйте снова.");
        });
    }

    const fileInput = h("input", {
      id: "file-input", type: "file", accept: ".docx,.txt,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document", hidden: true,
      onChange: (event) => {
        const [file] = event.target.files;
        if (file) loadFile(file);
        event.target.value = "";
      },
    });

    root.append(
      h("div", { class: "page-head" },
        h("div", {},
          h("h1", {}, "Проверка документа"),
          h("p", {}, "Вставьте текст договора, претензии или иска либо загрузите файл Word. Мы найдём ссылки на законы и покажем, какие статьи не существуют, утратили силу или указаны с ошибкой."))),
      h("div", { class: "check-layout" },
        h("div", { class: "check-column" },
          h("div", { class: "panel-bar" }, chips,
            h("div", { class: "bar-actions" },
              h("label", { class: "button", htmlFor: "file-input" }, window.UI.icon("upload"), "Загрузить Word или .txt"), fileInput, editButton, checkButton)),
          fileError, docInput, docView),
        h("div", { class: "check-column check-report" }, dateBox, tally, list, empty)));

    markSample(window.SAMPLES[0].id);
    showResult(window.SAMPLES[0].text);
  };
})();
