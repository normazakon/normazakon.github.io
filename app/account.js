/* Личный кабинет вошедшего пользователя: профиль, тариф, своя работа, безопасность и помощь.
   Данные аккаунта приходят из app.auth (lib/auth.js); без входа кабинет отправляет на страницу входа. */
(function () {
  "use strict";

  const { h, icon } = window.UI;

  function announce() {
    window.dispatchEvent(new CustomEvent("norma:auth"));
  }

  /** Слово в нужном падеже к числу: 1 черновик, 3 черновика, 5 черновиков. */
  function plural(count, one, few, many) {
    const tens = count % 100;
    const units = count % 10;
    return tens >= 11 && tens <= 14 ? many : units === 1 ? one : units >= 2 && units <= 4 ? few : many;
  }

  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const longDate = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  };

  function card(title, className, ...children) {
    return h("section", { class: `account-card ${className || ""}`.trim() }, h("h2", {}, title), ...children);
  }

  /** Форма в карточке: сообщение об успехе или ошибке под кнопкой. */
  function formWith(className, fields, buttonText, action) {
    const status = h("p", { class: "account-status", role: "status" });
    const button = h("button", { class: "button primary", type: "submit" }, buttonText);
    const form = h("form", { class: `account-form ${className}`, novalidate: true }, ...fields,
      h("div", { class: "account-actions" }, button, status));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      const result = await action();
      button.disabled = false;
      status.className = `account-status ${result.ok ? "ok" : "problem"}`;
      status.textContent = result.ok ? result.message : result.error;
    });
    return form;
  }

  function profileCard(app, user, rerender) {
    const name = h("input", { id: "profile-name", type: "text", value: user.name, maxLength: 80, autocomplete: "name" });
    const role = h("select", { id: "profile-role" }, window.Auth.ROLES.map((item) =>
      h("option", { value: item.value, selected: item.value === user.role }, item.label)));
    const organization = h("input", { id: "profile-org", type: "text", value: user.organization, maxLength: 120, autocomplete: "organization", placeholder: "Компания, коллегия или вуз" });
    const email = h("input", { id: "profile-email", type: "email", value: user.email, readOnly: true });
    return card("Профиль", "", formWith("", [
      h("div", { class: "field" }, h("label", { htmlFor: "profile-name" }, "Как к вам обращаться"), name),
      h("div", { class: "field" }, h("label", { htmlFor: "profile-email" }, "Почта"), email,
        h("span", { class: "field-help" }, "Сменить почту можно через поддержку.")),
      h("div", { class: "auth-pair" },
        h("div", { class: "field" }, h("label", { htmlFor: "profile-role" }, "Чем вы занимаетесь"), role),
        h("div", { class: "field" }, h("label", { htmlFor: "profile-org" }, "Организация"), organization)),
    ], "Сохранить", async () => {
      const result = await app.auth.updateProfile({ name: name.value, role: role.value, organization: organization.value });
      if (result.ok) { announce(); rerender("Профиль сохранён."); }
      return result;
    }));
  }

  function planCard(user) {
    const { plan } = user;
    const telegram = window.SITE && window.SITE.telegram;
    const included = ["Все шаблоны и официальные бланки", "Законы с редакциями и лентой изменений", "Проверка документов и контрагентов", "Расчёты сроков, пошлин и процентов"];
    return card("Тариф", "plan-card",
      h("div", { class: "plan-head" }, h("span", { class: "badge" }, plan.title), h("strong", { class: "plan-price" }, plan.price)),
      h("ul", { class: "plan-list" }, included.map((item) => h("li", {}, item))),
      h("p", { class: "account-note" }, plan.note),
      telegram && h("a", { href: telegram, target: "_blank", rel: "noopener noreferrer" }, "Вопрос по доступу — напишите нам"));
  }

  function workCard(app) {
    const drafts = app.store.list();
    const { bookmarks } = window.UI;
    const tile = (value, label, iconName, tone) => h("a", { class: `account-stat tone-${tone}`, href: "#documents" },
      h("span", { class: "tone-plate small" }, icon(iconName)),
      h("strong", {}, String(value)), h("span", {}, label));
    return card("Моя работа", "",
      h("div", { class: "account-stats" },
        tile(drafts.length, plural(drafts.length, "черновик", "черновика", "черновиков"), "contract", "blue"),
        tile(bookmarks.favorites().length, "в избранном", "star", "amber"),
        tile(bookmarks.recent().length, "недавно открыто", "clock", "teal")),
      drafts.length > 0
        ? h("ul", { class: "account-drafts" }, drafts.slice(0, 4).map((draft) => h("li", {},
          h("a", { href: `#document/${draft.id}` }, draft.title),
          h("span", {}, window.UI.shortDateTime(draft.updatedAt)))))
        : h("p", { class: "account-note" }, "Черновиков пока нет. ", h("a", { href: "#templates" }, "Выбрать шаблон")));
  }

  function securityCard(app) {
    const current = h("input", { id: "password-current", type: "password", autocomplete: "current-password" });
    const next = h("input", { id: "password-next", type: "password", autocomplete: "new-password" });
    const form = formWith("", [
      h("div", { class: "auth-pair" },
        h("div", { class: "field" }, h("label", { htmlFor: "password-current" }, "Текущий пароль"), current),
        h("div", { class: "field" }, h("label", { htmlFor: "password-next" }, "Новый пароль"), next)),
    ], "Сменить пароль", async () => {
      const result = await app.auth.changePassword({ current: current.value, next: next.value });
      if (result.ok) { current.value = ""; next.value = ""; }
      return { ...result, message: "Пароль изменён." };
    });
    const signOut = async () => {
      await app.auth.signOut();
      announce();
      location.hash = "#home";
    };
    const remove = async () => {
      if (!window.confirm("Удалить аккаунт? Вместе с ним удалятся черновики, избранное и история. Отменить это нельзя.")) return;
      const result = await app.auth.deleteAccount();
      if (!result.ok) { window.alert(result.error); return; }
      announce();
      location.hash = "#home";
    };
    return card("Безопасность", "",
      form,
      h("div", { class: "account-danger" },
        h("button", { class: "button", type: "button", onClick: signOut }, "Выйти из аккаунта"),
        h("button", { class: "button quiet danger", type: "button", onClick: remove }, "Удалить аккаунт")));
  }

  /** Настройки сохраняются сразу при изменении, без кнопки. */
  function settingsCard() {
    const settings = window.Settings.createSettings(window.Storage2.browserBackend());
    const current = settings.read();
    const status = h("p", { class: "account-status ok", role: "status" });
    const save = (fields) => {
      const ok = settings.update(fields);
      status.className = `account-status ${ok ? "ok" : "problem"}`;
      status.textContent = ok ? "Сохранено." : "Браузер не дал сохранить: возможно, включён приватный режим.";
      window.dispatchEvent(new CustomEvent("norma:settings"));
    };
    const scale = h("div", { class: "segmented settings-scale", role: "radiogroup", "aria-label": "Размер шрифта документов" },
      window.Settings.DOC_SCALES.map((item) => {
        const button = h("button", { type: "button", role: "radio", "aria-checked": String(item.value === current.docScale), "aria-pressed": String(item.value === current.docScale) }, item.label);
        button.addEventListener("click", () => {
          scale.querySelectorAll("button").forEach((other) => {
            other.setAttribute("aria-checked", String(other === button));
            other.setAttribute("aria-pressed", String(other === button));
          });
          save({ docScale: item.value });
        });
        return button;
      }));
    const toggle = (id, key, title, note) => {
      const input = h("input", { id, type: "checkbox", checked: current[key], onChange: () => save({ [key]: input.checked }) });
      return h("div", { class: "settings-row" }, input,
        h("label", { htmlFor: id }, h("strong", {}, title), h("span", {}, note)));
    };
    return card("Настройки", "",
      h("div", { class: "field" }, h("span", { class: "settings-label" }, "Размер шрифта документов и статей"), scale,
        h("p", { class: "settings-sample" }, "Статья 395. Ответственность за неисполнение денежного обязательства")),
      toggle("setting-changes", "showChanges", "Показывать правки в тексте статей", "Добавленное и удалённое по сравнению с прежней редакцией подсвечивается"),
      toggle("setting-watch", "homeWatch", "«Изменилось в ваших статьях» на главной", "Изменения в статьях из избранного и в основаниях ваших черновиков"),
      toggle("setting-feed", "homeChanges", "Лента изменений законов на главной", "Что недавно изменилось и что вступит в силу во всех законах базы"),
      status);
  }

  function helpCard() {
    const telegram = window.SITE && window.SITE.telegram;
    const link = (href, text, external) => h("li", {}, h("a", external ? { href, target: "_blank", rel: "noopener noreferrer" } : { href }, text));
    return card("Помощь", "",
      h("p", { class: "account-note" }, window.UI.baseDescription()),
      h("ul", { class: "account-links" },
        telegram && link(telegram, "Написать в поддержку в Telegram", true),
        link("./", "О сервисе «Норма»"),
        link("#terms", "Условия использования"),
        link("#privacy", "Конфиденциальность"),
        link("#contacts", "Контакты")));
  }

  window.Views = window.Views || {};
  window.Views.account = function render(root, params, app, message) {
    const user = app.auth.current();
    if (!user) {
      window.AuthPages.rememberReturn("#account");
      location.replace("#login");
      return;
    }
    const rerender = (text) => { root.replaceChildren(); render(root, params, app, text); };
    const subtitle = [user.email, window.Auth.roleLabel(user.role), user.organization].filter(Boolean).join(" · ");
    // root — обычный элемент: пустые блоки отфильтровываем сами, иначе append напишет «undefined»
    root.append(...[
      h("div", { class: "account-head" },
        h("span", { class: "avatar large", "aria-hidden": "true" }, window.Auth.initials(user.name) || icon("user")),
        h("div", {},
          h("h1", {}, user.name),
          h("p", {}, subtitle),
          user.createdAt && h("p", { class: "account-since" }, `В «Норме» с ${longDate(user.createdAt)}`))),
      message && h("p", { class: "account-banner", role: "status" }, message),
      h("div", { class: "account-grid" },
        profileCard(app, user, rerender),
        planCard(user),
        workCard(app),
        settingsCard(),
        securityCard(app),
        helpCard()),
    ].filter(Boolean));
  };
})();
