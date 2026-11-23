/* «Изменилось в ваших статьях»: какие из статей, за которыми человек следит, недавно изменились или скоро изменятся.
   Следит человек за статьями в избранном, за основаниями шаблонов в избранном и за основаниями шаблонов своих черновиков.
   Изменения берутся из ленты LAW_CHANGES (собирается tools/build_changes.py из дат официальных редакций).
   Подключается в браузере как window.Watch и в Node как модуль для тестов. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Watch = api;
})(globalThis, function () {
  "use strict";

  const keyOf = (lawId, number) => `${lawId}:${number}`;

  /**
   * favorites — избранное ({ kind: "article", lawId, number } или { kind: "template", templateId });
   * drafts — черновики ({ id, templateId, title }); templates — индекс шаблонов ({ id, title, basis: [{ lawId, number }] });
   * changes — LAW_CHANGES ({ recent, upcoming }: группы { lawId, date, articles: [[номер, вид]] }).
   * Отдаёт { watched, items }: watched — сколько статей под наблюдением, items — изменения по ним:
   * сначала то, что вступит в силу (ближайшее первым), затем недавнее (свежее первым).
   */
  function watchedChanges({ favorites = [], drafts = [], templates = [], changes = null } = {}) {
    const byId = new Map(templates.map((template) => [template.id, template]));
    const reasons = new Map();
    const watch = (lawId, number, reason) => {
      const key = keyOf(lawId, number);
      const list = reasons.get(key) || [];
      // одна и та же причина дважды не нужна (два черновика по одному шаблону — две причины, это разные документы)
      if (!list.some((item) => item.kind === reason.kind && item.id === reason.id)) list.push(reason);
      reasons.set(key, list);
    };

    for (const item of favorites) {
      if (item.kind === "article") watch(item.lawId, item.number, { kind: "favorite", id: keyOf(item.lawId, item.number) });
      else if (item.kind === "template" && byId.has(item.templateId)) {
        const template = byId.get(item.templateId);
        for (const basis of template.basis || []) watch(basis.lawId, basis.number, { kind: "template", id: template.id, title: template.title });
      }
    }
    for (const draft of drafts) {
      const template = byId.get(draft.templateId);
      if (!template) continue;
      for (const basis of template.basis || []) watch(basis.lawId, basis.number, { kind: "draft", id: draft.id, title: draft.title || template.title });
    }

    const items = [];
    const collect = (groups, upcoming) => {
      for (const group of groups || []) {
        for (const [number, kind] of group.articles) {
          const found = reasons.get(keyOf(group.lawId, number));
          if (found) items.push({ lawId: group.lawId, number, date: group.date, upcoming, kind, reasons: found });
        }
      }
    };
    if (changes) {
      collect(changes.upcoming, true);
      collect(changes.recent, false);
    }
    items.sort((a, b) => (a.upcoming !== b.upcoming ? (a.upcoming ? -1 : 1)
      : a.upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));
    return { watched: reasons.size, items };
  }

  /** Короткая подпись, почему статья под наблюдением: «В избранном · Черновик «Договор займа»». */
  function reasonText(reasons, limit = 2) {
    const labels = [];
    if (reasons.some((reason) => reason.kind === "favorite")) labels.push("В избранном");
    for (const reason of reasons) {
      if (reason.kind === "draft") labels.push(`Черновик «${reason.title}»`);
      else if (reason.kind === "template") labels.push(`Шаблон «${reason.title}»`);
    }
    const unique = [...new Set(labels)];
    const shown = unique.slice(0, limit);
    return unique.length > limit ? `${shown.join(" · ")} и ещё ${unique.length - limit}` : shown.join(" · ");
  }

  return { watchedChanges, reasonText };
});
