/* Вход, регистрация и восстановление пароля. Работают через app.auth (lib/auth.js):
   сейчас это тестовый режим в браузере, позже — сервер с теми же методами. */
(function () {
  "use strict";

  const { h } = window.UI;
  const RETURN_KEY = "norma.return";

  /** Куда вернуть человека после входа: туда, откуда он пришёл, иначе на главную. */
  function goBack() {
    let target = "#home";
    try {
      target = sessionStorage.getItem(RETURN_KEY) || target;
      sessionStorage.removeItem(RETURN_KEY);
    } catch { /* хранилище недоступно */ }
    if (/^#(login|register|reset)\b/.test(target)) target = "#home";
    location.hash = target;
  }

  function announce() {
    window.dispatchEvent(new CustomEvent("norma:auth"));
  }

  function field(id, label, control, help) {
    return h("div", { class: "field" }, h("label", { htmlFor: id }, label), control, help && h("span", { class: "field-help" }, help));
  }

  /** Поле пароля с кнопкой «Показать». */
  function passwordInput(id, autocomplete) {
    const input = h("input", { id, type: "password", autocomplete, required: true, minLength: 1 });
    const toggle = h("button", { class: "password-toggle", type: "button", "aria-controls": id, onClick: () => {
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      toggle.textContent = hidden ? "Скрыть" : "Показать";
    } }, "Показать");
    return h("div", { class: "password-field" }, input, toggle);
  }

  /** Каркас страницы: карточка по центру и пометка о тестовом режиме под ней. */
  function page(root, app, title, lead, ...content) {
    root.append(h("div", { class: "auth-page" },
      h("div", { class: "auth-card" },
        h("a", { class: "auth-brand", href: "#home", "aria-label": "Норма, на главную" }, h("span", { class: "brand-mark", "aria-hidden": "true" }, "§"), "Норма"),
        h("h1", {}, title),
        lead && h("p", { class: "auth-lead" }, lead),
        ...content),
      app.auth.mode === "local" && h("p", { class: "auth-test-note" },
        "Тестовый режим: войти можно без почты и пароля. Аккаунт хранится только в этом браузере, письма не отправляются.")));
  }

  function tabs(active) {
    const tab = (key, text) => h("a", { href: `#${key}`, role: "tab", "aria-selected": String(active === key), class: active === key ? "is-active" : "" }, text);
    return h("div", { class: "auth-tabs", role: "tablist" }, tab("login", "Вход"), tab("register", "Регистрация"));
  }

  /** Отправка формы: кнопка блокируется, ошибка показывается над кнопкой. */
  function submitting(form, button, error, action) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      button.disabled = true;
      error.textContent = "";
      try {
        const result = await action();
        if (!result.ok) error.textContent = result.error;
      } finally {
        button.disabled = false;
      }
    });
  }

  window.Views = window.Views || {};

  window.Views.login = function (root, _params, app) {
    if (app.auth.current()) { location.replace("#account"); return; }
    const email = h("input", { id: "login-email", type: "email", autocomplete: "email", required: true, placeholder: "you@example.com" });
    const password = passwordInput("login-password", "current-password");
    const error = h("p", { class: "auth-error", role: "alert" });
    const button = h("button", { class: "button primary large wide", type: "submit" }, "Войти");
    const form = h("form", { class: "auth-form", novalidate: true },
      field("login-email", "Почта", email),
      h("div", { class: "field" },
        h("div", { class: "field-row" }, h("label", { htmlFor: "login-password" }, "Пароль"), h("a", { href: "#reset" }, "Забыли пароль?")),
        password),
      error, button);
    submitting(form, button, error, async () => {
      const result = await app.auth.signIn({ email: email.value, password: password.querySelector("input").value });
      if (result.ok) { announce(); goBack(); }
      return result;
    });
    // в тестовом режиме посмотреть кабинет можно без почты и пароля
    const demo = app.auth.mode === "local" && h("button", { class: "button large wide", type: "button", onClick: async () => {
      const result = await app.auth.signIn({});
      if (result.ok) { announce(); goBack(); } else error.textContent = result.error;
    } }, "Посмотреть без регистрации");
    page(root, app, "Вход в «Норму»", "Шаблоны, законы и расчёты — в вашем аккаунте.", tabs("login"), form,
      demo && h("div", { class: "auth-or" }, h("span", {}, "или")), demo,
      h("p", { class: "auth-switch" }, "Ещё нет аккаунта? ", h("a", { href: "#register" }, "Зарегистрируйтесь")));
    setTimeout(() => email.focus(), 0);
  };

  window.Views.register = function (root, _params, app) {
    if (app.auth.current()) { location.replace("#account"); return; }
    const name = h("input", { id: "register-name", type: "text", autocomplete: "name", required: true, maxLength: 80, placeholder: "Например, Анна" });
    const email = h("input", { id: "register-email", type: "email", autocomplete: "email", required: true, placeholder: "you@example.com" });
    const password = passwordInput("register-password", "new-password");
    const role = h("select", { id: "register-role" }, window.Auth.ROLES.map((item) => h("option", { value: item.value }, item.label)));
    const organization = h("input", { id: "register-org", type: "text", autocomplete: "organization", maxLength: 120, placeholder: "Компания, коллегия или вуз" });
    const accept = h("input", { id: "register-accept", type: "checkbox" });
    const error = h("p", { class: "auth-error", role: "alert" });
    const button = h("button", { class: "button primary large wide", type: "submit" }, "Создать аккаунт");
    const form = h("form", { class: "auth-form", novalidate: true },
      field("register-name", "Как к вам обращаться", name),
      field("register-email", "Почта", email),
      field("register-password", "Пароль", password, `Не короче ${window.Auth.MIN_PASSWORD} символов.`),
      h("div", { class: "auth-pair" },
        field("register-role", "Чем вы занимаетесь", role),
        field("register-org", "Организация", organization)),
      h("div", { class: "field check auth-accept" }, accept,
        h("label", { htmlFor: "register-accept" }, "Согласен с ", h("a", { href: "#terms" }, "условиями использования"),
          " и ", h("a", { href: "#privacy" }, "политикой конфиденциальности"))),
      error, button);
    submitting(form, button, error, async () => {
      const result = await app.auth.register({
        name: name.value, email: email.value, password: password.querySelector("input").value,
        role: role.value, organization: organization.value, accept: accept.checked,
      });
      if (result.ok) { announce(); goBack(); }
      return result;
    });
    page(root, app, "Регистрация", "Аккаунт нужен, чтобы черновики, избранное и настройки были под рукой.", tabs("register"), form,
      h("p", { class: "auth-switch" }, "Уже есть аккаунт? ", h("a", { href: "#login" }, "Войдите")));
    setTimeout(() => name.focus(), 0);
  };

  window.Views.reset = function (root, _params, app) {
    const email = h("input", { id: "reset-email", type: "email", autocomplete: "email", required: true, placeholder: "you@example.com" });
    const error = h("p", { class: "auth-error", role: "alert" });
    const button = h("button", { class: "button primary large wide", type: "submit" }, "Получить ссылку");
    const form = h("form", { class: "auth-form", novalidate: true }, field("reset-email", "Почта", email), error, button);
    const body = h("div", {}, form, h("p", { class: "auth-switch" }, h("a", { href: "#login" }, "← Вернуться ко входу")));
    submitting(form, button, error, async () => {
      const address = email.value.trim();
      const result = await app.auth.requestPasswordReset({ email: address });
      if (result.ok) {
        body.replaceChildren(
          h("div", { class: "auth-sent" },
            h("p", {}, "Если аккаунт с адресом ", h("strong", {}, address), " есть, мы отправили на него ссылку для нового пароля. Она действует 30 минут."),
            h("p", { class: "field-help" }, "Письма нет? Проверьте папку «Спам» или напишите нам в поддержку.")),
          h("a", { class: "button large wide", href: "#login" }, "Вернуться ко входу"));
      }
      return result;
    });
    page(root, app, "Восстановление пароля", "Пришлём на почту ссылку, по которой можно задать новый пароль.", body);
    setTimeout(() => email.focus(), 0);
  };

  /** Запоминает, куда вернуться после входа. Вызывается шапкой перед переходом на #login. */
  window.AuthPages = {
    rememberReturn(hash) {
      try { sessionStorage.setItem(RETURN_KEY, hash || "#home"); } catch { /* хранилище недоступно */ }
    },
  };
})();
