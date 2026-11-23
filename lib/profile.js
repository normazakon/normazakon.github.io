/* Личный кабинет без сервера: профиль пользователя и резервная копия всех данных «Нормы» из этого браузера.
   Подключается в браузере как window.Profile и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Profile = api;
})(globalThis, function () {
  "use strict";

  const KEY = "norma.profile.v1";
  // всё, что «Норма» хранит в браузере: черновики, избранное и недавние, профиль
  const BACKUP_KEYS = ["norma.documents.v1", "norma.bookmarks.v1", KEY];
  const BACKUP_FORMAT = "norma-backup";

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

  const text = (value, limit) => (typeof value === "string" ? value.trim().slice(0, limit) : "");

  /** Профиль только из известных полей, с ограничением длины. */
  function clean(data) {
    const source = data && typeof data === "object" ? data : {};
    const role = ROLES.some((item) => item.value === source.role) ? source.role : "";
    return { name: text(source.name, 80), role, organization: text(source.organization, 120) };
  }

  /** Буквы для кружка в шапке: «Иван Петров» → «ИП», «Анна» → «А». Без имени — пустая строка. */
  function initials(name) {
    return text(name, 80).split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("");
  }

  function roleLabel(value) {
    const found = ROLES.find((item) => item.value === value);
    return found && found.value ? found.label : "";
  }

  /** backend: объект с getItem, setItem и removeItem, как localStorage. Ошибки хранилища не мешают работе. */
  function createProfile(backend) {
    function read() {
      try {
        return clean(JSON.parse(backend.getItem(KEY) || "{}"));
      } catch {
        return clean({});
      }
    }

    function write(data) {
      try {
        backend.setItem(KEY, JSON.stringify(clean(data)));
        return true;
      } catch {
        return false;
      }
    }

    /** Резервная копия: всё, что лежит в браузере под ключами «Нормы», как есть. */
    function backup(now = new Date()) {
      const data = {};
      for (const key of BACKUP_KEYS) {
        try {
          const value = backend.getItem(key);
          if (value !== null && value !== undefined) data[key] = JSON.parse(value);
        } catch {
          // повреждённую запись в копию не кладём
        }
      }
      return { format: BACKUP_FORMAT, version: 1, createdAt: now.toISOString(), data };
    }

    /**
     * Восстановление из копии. Записи заменяются целиком, ключи, которых нет в копии, не трогаются.
     * Отдаёт { ok, error, restored } — restored: сколько ключей записано.
     */
    function restore(copy) {
      if (!copy || copy.format !== BACKUP_FORMAT || !copy.data || typeof copy.data !== "object") {
        return { ok: false, error: "Это не резервная копия «Нормы».", restored: 0 };
      }
      const documents = copy.data["norma.documents.v1"];
      if (documents !== undefined && !Array.isArray(documents)) return { ok: false, error: "В копии повреждены черновики.", restored: 0 };
      let restored = 0;
      try {
        for (const key of BACKUP_KEYS) {
          if (!(key in copy.data)) continue;
          const value = key === KEY ? clean(copy.data[key]) : copy.data[key];
          backend.setItem(key, JSON.stringify(value));
          restored += 1;
        }
      } catch {
        return { ok: false, error: "Браузер не дал сохранить данные: возможно, включён приватный режим.", restored };
      }
      return { ok: true, error: null, restored };
    }

    /** Удаляет всё, что «Норма» хранит в этом браузере. */
    function eraseAll() {
      try {
        for (const key of BACKUP_KEYS) backend.removeItem(key);
        return true;
      } catch {
        return false;
      }
    }

    return { read, write, backup, restore, eraseAll };
  }

  return { createProfile, initials, roleLabel, ROLES, KEY, BACKUP_KEYS };
});
