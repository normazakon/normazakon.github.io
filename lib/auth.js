/* Аккаунты «Нормы». Экраны входа, регистрации и кабинета работают только через этот модуль.
   Сервера пока нет, поэтому здесь тестовый режим (mode: "local"): аккаунты живут в этом браузере,
   пароль не сохраняется и не проверяется, письма не отправляются. Когда появится сервер, вместо
   createLocalAuth подключается адаптер с теми же методами, и экраны менять не придётся.
   Все методы асинхронные и отдают { ok, error, user }, как будет отдавать сервер.
   Подключается в браузере как window.Auth и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Auth = api;
})(globalThis, function () {
  "use strict";

  const KEY = "norma.accounts.v1";
  // всё, что «Норма» хранит в браузере: удаляется вместе с аккаунтом
  // norma.profile.v1 — профиль из первой версии кабинета, до аккаунтов
  const DATA_KEYS = ["norma.documents.v1", "norma.bookmarks.v1", KEY, "norma.profile.v1"];
  const MIN_PASSWORD = 8;
  // демо-аккаунт тестового режима: вход с пустыми полями или кнопкой «Посмотреть без регистрации»
  const DEMO = { email: "demo@norma.test", name: "Гость", role: "lawyer" };

  const ROLES = [
    { value: "", label: "Не указано" },
    { value: "lawyer", label: "Юрист" },
    { value: "advocate", label: "Адвокат" },
    { value: "notary", label: "Нотариус" },
    { value: "company", label: "Сотрудник компании" },
    { value: "entrepreneur", label: "Предприниматель" },
    { value: "official", label: "Госслужащий" },
    { value: "student", label: "Студент" },
    { value: "person", label: "Частное лицо" },
  ];

  const PLAN = { id: "early", title: "Ранний доступ", price: "Бесплатно", note: "О тарифах расскажем заранее, до того как они начнут действовать." };

  const text = (value, limit) => (typeof value === "string" ? value.trim().slice(0, limit) : "");
  const normalEmail = (value) => text(value, 254).toLowerCase();
  const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  /** Буквы для кружка в шапке: «Иван Петров» → «ИП», «Анна» → «А». */
  function initials(name) {
    return text(name, 80).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("");
  }

  function roleLabel(value) {
    const found = ROLES.find((item) => item.value === value);
    return found && found.value ? found.label : "";
  }

  /** Поля профиля, которые пользователь может менять сам. */
  function profileFields(data) {
    const source = data && typeof data === "object" ? data : {};
    return {
      name: text(source.name, 80),
      role: ROLES.some((item) => item.value === source.role) ? source.role : "",
      organization: text(source.organization, 120),
    };
  }

  /** Проверка формы регистрации. Отдаёт текст ошибки или null; одинаково для тестового режима и будущего сервера. */
  function validateRegistration(form) {
    if (!text(form.name, 80)) return "Укажите, как к вам обращаться.";
    if (!isEmail(normalEmail(form.email))) return "Проверьте адрес почты.";
    if (String(form.password || "").length < MIN_PASSWORD) return `Пароль — не короче ${MIN_PASSWORD} символов.`;
    if (!form.accept) return "Нужно согласиться с условиями использования и политикой конфиденциальности.";
    return null;
  }

  /** backend: объект с getItem, setItem и removeItem, как localStorage. */
  function createLocalAuth(backend, clock = () => new Date()) {
    function read() {
      try {
        const parsed = JSON.parse(backend.getItem(KEY) || "{}");
        return { users: Array.isArray(parsed.users) ? parsed.users : [], session: typeof parsed.session === "string" ? parsed.session : null };
      } catch {
        return { users: [], session: null };
      }
    }

    function write(data) {
      try {
        backend.setItem(KEY, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    }

    const fail = (error) => Promise.resolve({ ok: false, error, user: null });
    const done = (user) => Promise.resolve({ ok: true, error: null, user: user ? { ...user, plan: PLAN } : null });
    const storageError = "Браузер не дал сохранить данные: возможно, включён приватный режим.";

    function current() {
      const data = read();
      const user = data.users.find((item) => item.email === data.session);
      return user ? { ...user, plan: PLAN } : null;
    }

    return {
      mode: "local",
      current,

      register(form) {
        const error = validateRegistration(form);
        if (error) return fail(error);
        const data = read();
        const email = normalEmail(form.email);
        if (data.users.some((item) => item.email === email)) return fail("Аккаунт с этой почтой уже есть. Войдите в него.");
        // пароль в тестовом режиме никуда не записывается
        const user = { email, ...profileFields(form), createdAt: clock().toISOString() };
        data.users.push(user);
        data.session = email;
        return write(data) ? done(user) : fail(storageError);
      },

      /**
       * Вход. В тестовом режиме пускает всех, чтобы интерфейс мог посмотреть любой:
       * пустые поля — демо-аккаунт, неизвестная почта — аккаунт создаётся сам. Пароль не проверяется.
       */
      signIn({ email } = {}) {
        const address = normalEmail(email) || DEMO.email;
        if (!isEmail(address)) return fail("Проверьте адрес почты.");
        const data = read();
        let user = data.users.find((item) => item.email === address);
        if (!user) {
          const name = address === DEMO.email ? DEMO.name : address.split("@")[0];
          user = { email: address, ...profileFields({ name, role: address === DEMO.email ? DEMO.role : "" }), createdAt: clock().toISOString() };
          data.users.push(user);
        }
        data.session = address;
        return write(data) ? done(user) : fail(storageError);
      },

      signOut() {
        const data = read();
        data.session = null;
        write(data);
        return done(null);
      },

      /** Ссылка для нового пароля. В тестовом режиме письмо не отправляется; ответ одинаковый, есть аккаунт или нет. */
      requestPasswordReset({ email } = {}) {
        if (!isEmail(normalEmail(email))) return fail("Проверьте адрес почты.");
        return done(null);
      },

      updateProfile(fields) {
        const data = read();
        const index = data.users.findIndex((item) => item.email === data.session);
        if (index < 0) return fail("Сначала войдите в аккаунт.");
        const next = { ...data.users[index], ...profileFields(fields) };
        if (!next.name) return fail("Укажите, как к вам обращаться.");
        data.users[index] = next;
        return write(data) ? done(next) : fail(storageError);
      },

      changePassword({ current: old, next } = {}) {
        if (!current()) return fail("Сначала войдите в аккаунт.");
        if (!String(old || "")) return fail("Введите текущий пароль.");
        if (String(next || "").length < MIN_PASSWORD) return fail(`Новый пароль — не короче ${MIN_PASSWORD} символов.`);
        return done(current());
      },

      /** Удаляет аккаунт и все данные «Нормы» из этого браузера. */
      deleteAccount() {
        if (!current()) return fail("Сначала войдите в аккаунт.");
        try {
          for (const key of DATA_KEYS) backend.removeItem(key);
        } catch {
          return fail("Браузер не дал удалить данные.");
        }
        return done(null);
      },
    };
  }

  return { createLocalAuth, validateRegistration, initials, roleLabel, ROLES, PLAN, KEY, DATA_KEYS, MIN_PASSWORD, DEMO };
});
