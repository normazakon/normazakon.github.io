/* Заполнение шаблона: форма слева, живая страница документа справа. */
(function () {
  "use strict";

  const { h, showArticle, citation, downloadFile } = window.UI;
  const Engine = window.TemplateEngine;
  const SAVE_DELAY_MS = 400;

  function renderRuns(runs) {
    return runs.map((run) => {
      if (run.missing) {
        return h("button", { class: "gap", type: "button", dataset: { field: run.field }, title: "Перейти к полю" }, run.text);
      }
      return run.field ? h("span", { class: "value", dataset: { field: run.field } }, run.text) : run.text;
    });
  }

  function renderSignatures(block) {
    return h("div", { class: "doc-signatures" }, block.parties.map((party) => h("div", {},
      h("p", { class: "role" }, party.role),
      party.lines.map((line) => h("p", {}, renderRuns(line))),
      h("p", { class: "doc-sign" }, "____________ / ", renderRuns(party.signer)))));
  }

  function renderBlock(block) {
    const number = block.number ? `${block.number} ` : "";
    switch (block.type) {
      case "title": return h("p", { class: "doc-title" }, renderRuns(block.runs));
      case "subtitle": return h("p", { class: "doc-subtitle" }, renderRuns(block.runs));
      case "meta": return h("div", { class: "doc-meta" }, h("span", {}, renderRuns(block.runs)), h("span", {}, renderRuns(block.right || [])));
      case "heading": return h("p", { class: "doc-heading" }, number, renderRuns(block.runs));
      case "clause": return h("p", { class: "doc-clause" }, number, renderRuns(block.runs));
      case "item": return h("p", { class: "doc-item" }, renderRuns(block.runs));
      case "address": return h("p", { class: "doc-address" }, renderRuns(block.runs));
      case "signatures": return renderSignatures(block);
      case "signatureLine": return h("div", { class: "doc-signature-line" },
        h("span", {}, "____________ / ", renderRuns(block.runs)), h("span", {}, renderRuns(block.right || [])));
      default: return h("p", { class: "doc-paragraph" }, renderRuns(block.runs));
    }
  }

  function fieldInputId(fieldId) {
    return `field-${fieldId}`;
  }

  function fileName(template, values) {
    const date = values.date || values.claim_date || new Date().toISOString().slice(0, 10);
    return `${template.title} ${date}.docx`.replace(/[\\/:*?"<>|]/g, "");
  }

  window.Views = window.Views || {};

  /** params: { templateId } для нового документа или { documentId } для сохранённого. */
  window.Views.editor = function (root, params, app) {
    const saved = params.documentId ? app.store.get(params.documentId) : null;
    const templateId = saved ? saved.templateId : params.templateId;
    const template = window.TEMPLATES.find((item) => item.id === templateId);
    if (!template) {
      root.append(h("p", { class: "empty" }, "Документ не найден. Возможно, он удалён или сохранён в другом браузере. "), h("a", { href: "#templates" }, "К шаблонам"));
      return;
    }

    window.UI.bookmarks.touch({ kind: "template", templateId: template.id });
    const state = {
      id: saved ? saved.id : null,
      values: Engine.withDefaults(template, saved ? saved.values : {}),
      activeField: null,
    };
    let saveTimer = null;

    const progress = h("span", { id: "progress" });
    const saveStatus = h("span", { id: "save-status" });
    const actionNote = h("p", { class: "action-note", role: "status" });
    const notices = h("div", { class: "notices" });
    const paper = h("article", { class: "paper", id: "paper", "aria-label": "Текст документа" });
    const form = h("form", { class: "form-column", id: "document-form", onSubmit: (event) => event.preventDefault() });
    const body = h("div", { class: "editor-body", dataset: { pane: "form" } }, form, h("div", { class: "paper-column" }, notices, paper));
    const exampleButton = h("button", { class: "button quiet", type: "button", id: "example-button", onClick: fillExample }, "Заполнить примером");

    function isEmptyDocument() {
      return Engine.allFields(template).every((field) => {
        const value = state.values[field.id];
        return !value || value === field.default;
      });
    }

    function saveNow() {
      if (!state.id) {
        state.id = `doc-${Date.now().toString(36)}`;
        history.replaceState(null, "", `#document/${state.id}`);
      }
      const ok = app.store.save({ id: state.id, templateId: template.id, title: template.title, values: state.values });
      saveStatus.textContent = ok ? "Сохранено в этом браузере" : "Браузер запрещает сохранение, скачайте документ в Word";
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
    }

    function renderNotices() {
      const checks = template.checks(state.values, Engine.helpers);
      notices.replaceChildren(...checks.map((check) => h("div", { class: `notice ${check.level}` },
        check.text,
        check.basis && h("button", {
          class: "link-button", type: "button",
          onClick: () => showArticle(check.basis.lawId, check.basis.number),
        }, citation(check.basis.lawId, check.basis.number)))));
    }

    function markActiveField() {
      paper.querySelectorAll(".active").forEach((node) => node.classList.remove("active"));
      if (!state.activeField) return;
      const marks = paper.querySelectorAll(`[data-field="${state.activeField}"]`);
      marks.forEach((node) => node.classList.add("active"));
      marks[0]?.scrollIntoView({ block: "nearest" });
    }

    function renderDocument() {
      const result = Engine.render(template, state.values);
      paper.replaceChildren(...result.blocks.map(renderBlock));
      progress.textContent = `Заполнено ${result.progress.filled} из ${result.progress.total}`;
      exampleButton.hidden = !isEmptyDocument();
      renderNotices();
      markActiveField();
      return result;
    }

    function renderInput(field) {
      const id = fieldInputId(field.id);
      const value = state.values[field.id] ?? "";
      const warning = h("span", { class: "field-warning", id: `${id}-warning` });
      const validate = () => { warning.textContent = Engine.validateField(field, state.values[field.id]) || ""; };
      const update = (next) => {
        state.values[field.id] = next;
        renderDocument();
        syncVisibleFields();
        scheduleSave();
      };
      const common = {
        id, "aria-describedby": `${id}-warning`,
        onFocus: () => { state.activeField = field.id; markActiveField(); },
        onBlur: validate,
      };

      let control;
      if (field.type === "textarea") {
        control = h("textarea", { ...common, value, onInput: (event) => update(event.target.value) });
      } else if (field.type === "select") {
        control = h("select", { ...common, onChange: (event) => update(event.target.value) },
          field.options.map((option) => h("option", { value: option.value }, option.label)));
        control.value = value;
      } else if (field.type === "checkbox") {
        return h("div", { class: "field check" },
          h("input", { ...common, type: "checkbox", checked: Boolean(value), onChange: (event) => update(event.target.checked) }),
          h("label", { htmlFor: id }, field.label));
      } else {
        const inputType = field.type === "date" ? "date" : "text";
        const numeric = ["money", "number", "inn", "ogrn", "ogrnip"].includes(field.type);
        control = h("input", { ...common, type: inputType, value, inputMode: numeric ? "decimal" : undefined, autocomplete: "off", onInput: (event) => update(event.target.value) });
      }
      validate();
      return h("div", { class: "field" },
        h("label", { htmlFor: id }, field.label, field.optional && h("span", { class: "optional" }, " (необязательно)")),
        control,
        field.help && h("span", { class: "field-help" }, field.help),
        warning);
    }

    let visibleSignature = "";

    function renderForm() {
      const focused = document.activeElement?.id;
      const openSections = new Map([...form.querySelectorAll("details")].map((details) => [details.dataset.title, details.open]));
      form.replaceChildren(...template.sections.map((section, index) => {
        const fields = section.fields.filter((field) => Engine.isVisible(field, state.values));
        return h("details", {
          class: "form-section", open: openSections.get(section.title) ?? index < 2, dataset: { title: section.title },
        }, h("summary", {}, section.title), h("div", { class: "form-fields" }, fields.map(renderInput)));
      }));
      visibleSignature = Engine.visibleFields(template, state.values).map((field) => field.id).join();
      if (focused) document.getElementById(focused)?.focus();
    }

    function syncVisibleFields() {
      const signature = Engine.visibleFields(template, state.values).map((field) => field.id).join();
      if (signature !== visibleSignature) renderForm();
    }

    function setPane(pane) {
      body.dataset.pane = pane;
      switcher.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.pane === pane)));
    }

    function focusField(fieldId) {
      setPane("form");
      const input = document.getElementById(fieldInputId(fieldId));
      if (!input) return;
      const section = input.closest("details");
      if (section) section.open = true;
      input.focus();
      input.scrollIntoView({ block: "center" });
    }

    function fillExample() {
      state.values = Engine.withDefaults(template, { ...template.example });
      renderForm();
      renderDocument();
      form.querySelectorAll("details").forEach((details) => { details.open = true; });
      saveNow();
    }

    function warnAboutGaps(result, done) {
      actionNote.textContent = result.missing.length
        ? `${done} Незаполненные места (${result.missing.length}) отмечены жёлтым.`
        : done;
    }

    function downloadWord() {
      const result = Engine.render(template, state.values);
      downloadFile(window.Docx.build(result.blocks), fileName(template, state.values), window.Docx.MIME);
      warnAboutGaps(result, "Файл Word скачан.");
    }

    async function copyText() {
      const result = Engine.render(template, state.values);
      try {
        await navigator.clipboard.writeText(Engine.toPlainText(result.blocks));
        warnAboutGaps(result, "Текст скопирован.");
      } catch {
        actionNote.textContent = "Браузер не разрешил копирование. Скачайте документ в Word.";
      }
    }

    paper.addEventListener("click", (event) => {
      const gap = event.target.closest(".gap");
      if (gap) focusField(gap.dataset.field);
    });

    const switcher = h("div", { class: "segmented editor-switch", role: "group", "aria-label": "Что показать" },
      h("button", { type: "button", dataset: { pane: "form" }, "aria-pressed": "true", onClick: () => setPane("form") }, "Заполнение"),
      h("button", { type: "button", dataset: { pane: "paper" }, "aria-pressed": "false", onClick: () => setPane("paper") }, "Документ"));

    root.append(
      h("div", { class: "editor-head" },
        h("div", {},
          h("a", { class: "back-link", href: "#templates" }, "Все шаблоны"),
          h("h1", {}, template.title),
          h("div", { class: "editor-status" },
            !template.reviewed && h("span", { class: "badge draft" }, "Черновик: юрист ещё не проверял"),
            progress, saveStatus,
            window.UI.starButton({ kind: "template", templateId: template.id }, "small"))),
        h("div", { class: "editor-actions" },
          exampleButton,
          h("button", { class: "button", type: "button", id: "copy-button", onClick: copyText }, window.UI.icon("copy"), "Скопировать текст"),
          h("button", { class: "button", type: "button", id: "print-button", onClick: () => window.print() }, window.UI.icon("print"), "Печать"),
          h("button", { class: "button primary", type: "button", id: "word-button", onClick: downloadWord }, window.UI.icon("download"), "Скачать в Word"),
          actionNote)),
      switcher,
      body,
      h("section", { class: "about" },
        h("div", {}, h("h2", {}, "Перед подписанием"), h("ul", {}, template.notes.map((note) => h("li", {}, note)))),
        h("div", {}, h("h2", {}, "Нормы"), h("ul", { class: "basis-list" }, template.basis.map(({ lawId, number }) => h("li", {},
          h("button", { class: "link-button", type: "button", onClick: () => showArticle(lawId, number) },
            `${citation(lawId, number)}: ${window.LAW_BASE.laws[lawId].articles[number].title}`)))))));

    renderForm();
    renderDocument();
    if (saved) saveStatus.textContent = "Сохранено в этом браузере";
    renderLinks();

    /** Кнопки документов, которые можно создать из этого, с уже перенесёнными данными. */
    function renderLinks() {
      const links = (window.TEMPLATE_LINKS[template.id] || []).filter((link) => !link.when || link.when(state.values));
      if (!links.length) return;
      const about = root.querySelector(".about");
      about.classList.add("with-links");
      about.append(h("div", { class: "links" },
        h("h2", {}, "Следующий документ"),
        h("p", { class: "links-note" }, "Стороны, суммы и даты перенесутся из этого документа."),
        h("ul", { class: "link-list" }, links.map((link) => h("li", {},
          h("button", { class: "button", type: "button", onClick: () => createLinked(link) }, link.label))))));
    }

    function createLinked(link) {
      const target = window.TEMPLATES.find((item) => item.id === link.target);
      const fieldIds = new Set(Engine.allFields(target).map((field) => field.id));
      const values = {};
      for (const [key, value] of Object.entries(link.map(state.values))) {
        if (fieldIds.has(key) && value !== undefined && value !== "") values[key] = value;
      }
      const id = `doc-${Date.now().toString(36)}`;
      const ok = app.store.save({ id, templateId: target.id, title: target.title, values: Engine.withDefaults(target, values) });
      location.hash = ok ? `#document/${id}` : `#template/${target.id}`;
    }
  };
})();
