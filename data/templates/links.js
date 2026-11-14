/* Связи между шаблонами: из какого документа какой можно создать и как переносятся поля.
   Переносятся только уже известные данные. Остальное пользователь заполнит сам. */
(function (root) {
  "use strict";

  const PARTY_SUFFIXES = [
    "kind", "name", "birth", "passport", "issued", "address", "ip_name", "ogrnip", "org_name", "ogrn", "inn",
    "business_address", "signer", "authority", "short_signer", "bank",
  ];

  const isoToDots = (iso) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
  };

  /** Переносит сторону договора под новым префиксом. Если вид стороны не указан, шаблоны считают её гражданином. */
  function party(values, from, to) {
    const result = {};
    for (const suffix of PARTY_SUFFIXES) {
      const value = values[`${from}_${suffix}`];
      if (value !== undefined && value !== "") result[`${to}_${suffix}`] = value;
    }
    return result;
  }

  /** Гражданин из договора в виде сведений для суда. Место рождения в договорах не указывается,
      поэтому поле даты и места рождения остается пустым и заметным. */
  function courtPerson(values, from, to) {
    const passport = values[`${from}_passport`];
    return {
      [`${to}_name`]: values[`${from}_name`] || "",
      [`${to}_address`]: values[`${from}_address`] || "",
      [`${to}_id`]: passport ? `паспорт ${passport}` : "",
    };
  }

  function displayName(values, prefix) {
    const kind = values[`${prefix}_kind`] || "person";
    if (kind === "org") return values[`${prefix}_org_name`] || "";
    if (kind === "ip") return values[`${prefix}_ip_name`] ? `ИП ${values[`${prefix}_ip_name`]}` : "";
    return values[`${prefix}_name`] || "";
  }

  function displayAddress(values, prefix) {
    return (values[`${prefix}_kind`] || "person") === "person" ? values[`${prefix}_address`] || "" : values[`${prefix}_business_address`] || "";
  }

  const contractLabel = (name, values) => (values.date ? `${name} от ${isoToDots(values.date)}` : name);
  const isConsumer = (values, customer, contractor) => (values[`${customer}_kind`] || "person") === "person" && (values[`${contractor}_kind`] || "person") !== "person";

  const completionFrom = (name, workField) => (values) => ({
    city: values.city, contract_name: name, contract_date: values.date,
    ...party(values, "customer", "customer"), ...party(values, "contractor", "contractor"),
    work: values[workField], price: values.price, vat: values.vat, vat_rate: values.vat_rate,
  });

  const refusalFrom = (name, ground) => (values) => ({
    ...party(values, "customer", "sender"), ...party(values, "contractor", "receiver"),
    contract: contractLabel(name, values),
    ground: isConsumer(values, "customer", "contractor") ? "consumer" : ground,
  });

  const debtFrom = (name, creditor, debtor, debtFor, amountField) => (values) => ({
    ...party(values, creditor, "creditor"), ...party(values, debtor, "debtor"),
    contract: contractLabel(name, values), debt_for: debtFor, debt: values[amountField],
  });

  const serviceClaimFrom = (name, workField) => (values) => ({
    contractor: displayName(values, "contractor"), contractor_address: displayAddress(values, "contractor"),
    customer: values.customer_name, customer_address: values.customer_address,
    contract: contractLabel(name, values), service: values[workField], price: values.price,
  });

  const terminationFrom = (name, first, second) => (values) => ({
    city: values.city, contract_name: name, contract_date: values.date,
    ...party(values, first, "first"), ...party(values, second, "second"),
  });

  const transferFrom = (name, sender, receiver, property) => (values) => ({
    city: values.city, contract_name: name, contract_date: values.date,
    ...party(values, sender, "sender"), ...party(values, receiver, "receiver"), property: property(values),
  });

  const loanSuitFrom = (lender, borrower, evidence) => (values) => ({
    ...courtPerson(values, lender, "plaintiff"), ...courtPerson(values, borrower, "defendant"),
    loan_date: values.date, loan_sum: values.amount, return_date: values.return_date,
    evidence: evidence(values), debt: values.amount,
  });

  const courtOrderFrom = (lender, borrower, deal) => (values) => ({
    ...courtPerson(values, lender, "creditor"), ...courtPerson(values, borrower, "debtor"),
    deal: deal(values), debt: values.amount,
  });

  const loanDeal = (values) => contractLabel("договор займа", values);
  const receiptDeal = (values) => (values.date ? `расписка от ${isoToDots(values.date)}` : "расписка");

  const consumerOnly = (customer, contractor) => (values) => isConsumer(values, customer, contractor);

  root.TEMPLATE_LINKS = {
    services: [
      { target: "completion", label: "Акт оказанных услуг", map: completionFrom("договор оказания услуг", "subject") },
      { target: "refusal", label: "Отказ от договора", map: refusalFrom("договор оказания услуг", "services") },
      { target: "debt-claim", label: "Претензия о неоплате", map: debtFrom("договор оказания услуг", "contractor", "customer", "за оказанные услуги", "price") },
      { target: "service-claim", label: "Претензия к исполнителю", when: consumerOnly("customer", "contractor"), map: serviceClaimFrom("договор оказания услуг", "subject") },
      { target: "termination", label: "Соглашение о расторжении", map: terminationFrom("договор оказания услуг", "customer", "contractor") },
    ],
    work: [
      { target: "completion", label: "Акт выполненных работ", map: completionFrom("договор подряда", "job") },
      { target: "refusal", label: "Отказ от договора", map: refusalFrom("договор подряда", "work") },
      { target: "debt-claim", label: "Претензия о неоплате", map: debtFrom("договор подряда", "contractor", "customer", "за выполненные работы", "price") },
      { target: "service-claim", label: "Претензия к подрядчику", when: consumerOnly("customer", "contractor"), map: serviceClaimFrom("договор подряда", "job") },
      { target: "termination", label: "Соглашение о расторжении", map: terminationFrom("договор подряда", "customer", "contractor") },
    ],
    loan: [
      { target: "receipt", label: "Расписка заемщика", map: (values) => ({
        city: values.city, date: values.date, ...party(values, "borrower", "borrower"), ...party(values, "lender", "lender"),
        amount: values.amount, return_date: values.return_date, interest_mode: values.interest_mode, rate: values.rate,
      }) },
      { target: "loan-suit", label: "Иск о взыскании долга", map: loanSuitFrom("lender", "borrower", loanDeal) },
      { target: "court-order", label: "Заявление о судебном приказе", map: courtOrderFrom("lender", "borrower", loanDeal) },
    ],
    receipt: [
      { target: "loan-suit", label: "Иск о взыскании долга", map: loanSuitFrom("lender", "borrower", receiptDeal) },
      { target: "court-order", label: "Заявление о судебном приказе", map: courtOrderFrom("lender", "borrower", receiptDeal) },
    ],
    sale: [
      { target: "transfer", label: "Акт приема-передачи", map: transferFrom("договор купли-продажи", "seller", "buyer", (values) => values.goods) },
      { target: "debt-claim", label: "Претензия о неоплате", map: debtFrom("договор купли-продажи", "seller", "buyer", "за переданный товар", "price") },
      { target: "termination", label: "Соглашение о расторжении", map: terminationFrom("договор купли-продажи", "seller", "buyer") },
    ],
    vehicle: [
      { target: "transfer", label: "Акт приема-передачи", map: transferFrom("договор купли-продажи транспортного средства", "seller", "buyer",
        (values) => [values.car, values.vin && `VIN ${values.vin}`, values.plate && `государственный номер ${values.plate}`].filter(Boolean).join(", ")) },
    ],
    rent: [
      { target: "transfer", label: "Акт приема-передачи помещения", map: transferFrom("договор аренды нежилого помещения", "landlord", "tenant",
        (values) => [values.address && `нежилое помещение по адресу: ${values.address}`, values.area && `площадь ${values.area} кв. м`].filter(Boolean).join(", ")) },
      { target: "debt-claim", label: "Претензия о долге по аренде", map: debtFrom("договор аренды нежилого помещения", "landlord", "tenant", "по арендной плате", "rent") },
      { target: "termination", label: "Соглашение о расторжении", map: terminationFrom("договор аренды нежилого помещения", "landlord", "tenant") },
    ],
    lease: [
      { target: "transfer", label: "Акт приема-передачи квартиры", map: transferFrom("договор найма жилого помещения", "landlord", "tenant",
        (values) => [values.flat_type, values.flat_address && `по адресу: ${values.flat_address}`].filter(Boolean).join(" ")) },
      { target: "termination", label: "Соглашение о расторжении", map: terminationFrom("договор найма жилого помещения", "landlord", "tenant") },
    ],
  };

  root.TemplateLinks = { party, courtPerson, isoToDots };
})(typeof window !== "undefined" ? window : globalThis);
