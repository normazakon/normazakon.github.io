/* Личный кабинет. Сервера пока нет, поэтому кабинет живёт в этом браузере:
   профиль, сводка по своей работе, резервная копия данных и восстановление из неё. */
(function () {
  "use strict";

  const { h, icon } = window.UI;

  /** Сообщает шапке и главной, что профиль изменился (кружок с инициалами, приветствие). */
  function announce() {
    window.dispatchEvent(new CustomEvent("norma:profile"));
  }

  /** Слово в нужном падеже к числу: 1 черновик, 3 черновика, 5 черновиков. */
  function plural(count, one, few, many) {
    const tens = count % 100;
    const units = count % 10;
    return tens >= 11 && tens <= 14 ? many : units === 1 ? one : units >= 2 && units <= 4 ? few : many;
  }

  function card(title, ...children) {
    return h("section", { class: "account-card" }, h("h2", {}, title), ...children);
  }

  function profileCard(profile, onSaved) {
    const data = profile.read();
    const name = h("input", { id: "profile-name", type: "text", value: data.name, maxLength: 80, autocomplete: "name", placeholder: "Например, Анна" });
    const role = h("select", { id: "profile-role" }, window.Profile.ROLES.map((item) =>
      h("option", { value: item.value, selected: item.value === data.role }, item.label)));
    const organization = h("input", { id: "profile-org", type: "text", value: data.organization, maxLength: 120, autocomplete: "organization", placeholder: "Компания, коллегия или вуз" });
    const status = h("p", { class: "account-status", role: "status" });
    const form = h("form", { class: "account-form", onSubmit: (event) => {
      event.preventDefault();
      const ok = profile.write({ name: name.value, role: role.value, organization: organization.value });
      status.textContent = ok ? "Сохранено." : "Браузер не дал сохранить: возможно, включён приватный режим.";
      if (ok) { announce(); onSaved(); }
    } },
    h("div", { class: "field" }, h("label", { htmlFor: "profile-name" }, "Как к вам обращаться"), name),
    h("div", { class: "field" }, h("label", { htmlFor: "profile-role" }, "Чем вы занимаетесь"), role),
    h("div", { class: "field" }, h("label", { htmlFor: "profile-org" }, "Организация", h("span", { class: "optional" }, " (необязательно)")), organization),
    h("div", { class: "account-actions" }, h("button", { class: "button primary", type: "submit" }, "Сохранить"), status));
    return card("Профиль", h("p", { class: "account-note" }, "Имя видно только вам: оно хранится в этом браузере и нужно, чтобы «Норма» обращалась к вам по имени."), form);
  }

  function workCard(app) {
    const drafts = app.store.list();
    const { bookmarks } = window.UI;
    const tile = (href, value, label, iconName, tone) => h("a", { class: `account-stat tone-${tone}`, href },
      h("span", { class: "tone-plate small" }, icon(iconName)),
      h("strong", {}, String(value)), h("span", {}, label));
    return card("Моя работа",
      h("div", { class: "account-stats" },
        tile("#documents", drafts.length, plural(drafts.length, "черновик", "черновика", "черновиков"), "contract", "blue"),
        tile("#documents", bookmarks.favorites().length, "в избранном", "star", "amber"),
        tile("#documents", bookmarks.recent().length, "недавно открыто", "clock", "teal")),
      drafts.length > 0 && h("ul", { class: "account-drafts" }, drafts.slice(0, 4).map((draft) => h("li", {},
        h("a", { href: `#document/${draft.id}` }, draft.title),
        h("span", {}, window.UI.shortDateTime(draft.updatedAt))))));
  }

  function dataCard(profile, rerender) {
    const status = h("p", { class: "account-status", role: "status" });
    const fileInput = h("input", { type: "file", accept: "application/json,.json", hidden: true, onChange: async () => {
      const file = fileInput.files[0];
      fileInput.value = "";
      if (!file) return;
      let copy;
      try {
        copy = JSON.parse(await file.text());
      } catch {
        status.textContent = "Файл не читается: выберите копию, которую сохранила «Норма».";
        return;
      }
      const result = profile.restore(copy);
      status.textContent = result.ok ? "Данные восстановлены из копии." : result.error;
      if (result.ok) { announce(); rerender("Данные восстановлены из копии."); }
    } });

    const save = () => {
      const copy = profile.backup();
      const day = copy.createdAt.slice(0, 10);
      window.UI.downloadFile(new TextEncoder().encode(JSON.stringify(copy, null, 2)), `norma-backup-${day}.json`, "application/json");
      status.textContent = "Копия сохранена в загрузки. Храните её как обычный файл.";
    };

    const erase = () => {
      if (!window.confirm("Удалить все черновики, избранное, историю и профиль из этого браузера? Вернуть их можно только из резервной копии.")) return;
      const ok = profile.eraseAll();
      announce();
      rerender(ok ? "Все данные «Нормы» удалены из этого браузера." : "Браузер не дал удалить данные.");
    };

    return card("Данные и устройства",
      h("p", { class: "account-note" }, "Черновики, избранное и профиль хранятся только в этом браузере и никуда не отправляются. Чтобы перенести их на другой компьютер или телефон, сохраните резервную копию и восстановите её там."),
      h("div", { class: "account-buttons" },
        h("button", { class: "button", type: "button", onClick: save }, icon("download"), "Скачать резервную копию"),
        h("button", { class: "button", type: "button", onClick: () => fileInput.click() }, icon("upload"), "Восстановить из копии"),
        h("button", { class: "button quiet danger", type: "button", onClick: erase }, "Удалить все данные")),
      fileInput, status,
      h("p", { class: "account-soon" }, h("span", { class: "badge plain" }, "Скоро"), "Вход по почте и синхронизация между устройствами без резервных копий."));
  }

  function helpCard() {
    const telegram = window.SITE && window.SITE.telegram;
    const link = (href, text, external) => h("li", {}, h("a", external ? { href, target: "_blank", rel: "noopener noreferrer" } : { href }, text));
    return card("Помощь",
      h("ul", { class: "account-links" },
        telegram && link(telegram, "Написать в поддержку в Telegram", true),
        link("./", "О сервисе «Норма»"),
        link("#terms", "Условия использования"),
        link("#privacy", "Конфиденциальность"),
        link("#contacts", "Контакты")));
  }

  window.Views = window.Views || {};
  window.Views.account = function render(root, _params, app, message) {
    const profile = window.Profile.createProfile(window.Storage2.browserBackend());
    const rerender = (text) => {
      root.replaceChildren();
      render(root, _params, app, text);
    };
    const data = profile.read();
    const initials = window.Profile.initials(data.name);
    const subtitle = [window.Profile.roleLabel(data.role), data.organization].filter(Boolean).join(" · ");
    root.append(
      h("div", { class: "account-head" },
        h("span", { class: "avatar large", "aria-hidden": "true" }, initials || icon("user")),
        h("div", {},
          h("h1", {}, data.name || "Личный кабинет"),
          h("p", {}, subtitle || "Ранний доступ"))),
      message && h("p", { class: "account-banner", role: "status" }, message),
      h("div", { class: "account-grid" },
        profileCard(profile, () => rerender("Профиль сохранён.")),
        workCard(app),
        dataCard(profile, rerender),
        helpCard()));
  };
})();
