export const PRODUCT_IMPORT_ACCEPT = ".xlsx,.xls,.xlsm,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,text/plain";

const cp = (...codes) => String.fromCodePoint(...codes);

const FIELD_ALIASES = {
  id: [
    "id", "sku", "skuid", "productid", "productcode", "itemcode",
    cp(0x5546, 0x54c1, 0x69, 0x64),
    cp(0x4ea7, 0x54c1, 0x69, 0x64),
    cp(0x4ea7, 0x54c1, 0x7f16, 0x53f7),
    cp(0x5546, 0x54c1, 0x7f16, 0x53f7),
    cp(0x8d27, 0x53f7),
    cp(0x7f16, 0x7801),
    cp(0x578b, 0x53f7),
    cp(0x6b3e, 0x53f7),
  ],
  priceCNY: [
    "pricecny", "costcny", "purchaseprice", "cost", "unitcost",
    cp(0x91c7, 0x8d2d, 0x4ef7),
    cp(0x91c7, 0x8d2d, 0x4ef7, 0x63),
    cp(0x91c7, 0x8d2d, 0x4ef7, 0x63, 0x6e, 0x79),
    cp(0x4f9b, 0x5e94, 0x5546, 0x62a5, 0x4ef7),
    cp(0x4f9b, 0x8d27, 0x4ef7),
    cp(0x62a5, 0x4ef7),
    cp(0x8fdb, 0x4ef7),
    cp(0x6210, 0x672c, 0x4ef7),
    cp(0x5b9e, 0x9645, 0x6210, 0x672c),
    cp(0x91c7, 0x8d2d, 0x6210, 0x672c),
  ],
  bookCostCNY: [
    "bookcostcny", "bookcost", "documentedcost", "declaredcny", "declaredcost", "declaredprice",
    cp(0x8d26, 0x9762, 0x6210, 0x672c),
    cp(0x8d26, 0x9762, 0x6210, 0x672c, 0x63, 0x6e, 0x79),
    cp(0x7533, 0x62a5, 0x4ef7),
    cp(0x62a5, 0x5173, 0x4ef7),
    cp(0x62a5, 0x5173, 0x7533, 0x62a5, 0x4ef7),
    cp(0x7533, 0x62a5, 0x4ef7, 0x683c),
    cp(0x62a5, 0x5173, 0x6210, 0x672c),
    cp(0x7533, 0x62a5, 0x6210, 0x672c),
  ],
  importTaxBaseCNY: [
    "importtaxbasecny", "importtaxbase", "customstaxbase", "customsvalue",
    cp(0x8fdb, 0x53e3, 0x8ba1, 0x7a0e, 0x57fa, 0x7840),
    cp(0x8fdb, 0x53e3, 0x5b8c, 0x7a0e, 0x4ef7, 0x683c),
    cp(0x6d77, 0x5173, 0x5b8c, 0x7a0e, 0x4ef7, 0x683c),
  ],
  qty: [
    "qty", "quantity", "count", "pcs",
    cp(0x6570, 0x91cf),
    cp(0x4ef6, 0x6570),
    cp(0x91c7, 0x8d2d, 0x6570, 0x91cf),
    cp(0x5907, 0x8d27, 0x6570, 0x91cf),
    cp(0x9500, 0x552e, 0x5355, 0x4f4d, 0x6570, 0x91cf),
    cp(0x9500, 0x552e, 0x5355, 0x4f4d, 0x6570),
    cp(0x9996, 0x6279, 0x6570, 0x91cf),
  ],
  weight: [
    "weight", "grossweight", "netweight", "unitweight",
    cp(0x91cd, 0x91cf),
    cp(0x6bdb, 0x91cd),
    cp(0x51c0, 0x91cd),
    cp(0x5355, 0x91cd),
    cp(0x91cd, 0x91cf, 0x6b, 0x67),
    cp(0x91cd, 0x91cf, 0x516c, 0x65a4),
  ],
  weightKg: [
    "weightkg", "shippingweight", "chargeableweight",
    cp(0x7269, 0x6d41, 0x91cd, 0x91cf),
    cp(0x8ba1, 0x8d39, 0x91cd, 0x91cf),
    cp(0x53d1, 0x8d27, 0x91cd, 0x91cf),
    cp(0x7070, 0x5173, 0x91cd, 0x91cf),
  ],
  volL: [
    "voll", "length", "l",
    cp(0x957f),
    cp(0x957f, 0x5ea6),
    cp(0x957f, 0x63, 0x6d),
    cp(0x957f, 0x5ea6, 0x63, 0x6d),
  ],
  volW: [
    "volw", "width", "w",
    cp(0x5bbd),
    cp(0x5bbd, 0x5ea6),
    cp(0x5bbd, 0x63, 0x6d),
    cp(0x5bbd, 0x5ea6, 0x63, 0x6d),
  ],
  volH: [
    "volh", "height", "h",
    cp(0x9ad8),
    cp(0x9ad8, 0x5ea6),
    cp(0x9ad8, 0x63, 0x6d),
    cp(0x9ad8, 0x5ea6, 0x63, 0x6d),
  ],
  list: [
    "list", "listprice", "saleprice", "sellingprice", "ozonprice",
    cp(0x552e, 0x4ef7),
    cp(0x9500, 0x552e, 0x4ef7),
    cp(0x4e0a, 0x67b6, 0x4ef7),
    cp(0x5e73, 0x53f0, 0x552e, 0x4ef7),
    cp(0x6f, 0x7a, 0x6f, 0x6e, 0x552e, 0x4ef7),
    cp(0x9500, 0x552e, 0x4ef7, 0x683c),
    cp(0x524d, 0x53f0, 0x4ef7),
    cp(0x6302, 0x724c, 0x4ef7),
  ],
  platformFee: [
    "platformfee", "fee", "burden", "commissionlogistics",
    cp(0x5e73, 0x53f0, 0x6263, 0x8d39),
    cp(0x6263, 0x8d39),
    cp(0x7efc, 0x5408, 0x6263, 0x8d39),
    cp(0x5e73, 0x53f0, 0x8d39, 0x7528),
    cp(0x5e73, 0x53f0, 0x8d39),
    cp(0x4f63, 0x91d1, 0x7269, 0x6d41),
    cp(0x4f63, 0x91d1, 0x2b, 0x7269, 0x6d41),
    cp(0x56de, 0x6b3e, 0x6263, 0x8d39),
  ],
  warehouse: [
    "warehouse", "warehousefee", "storage", "storagefee",
    cp(0x4ed3, 0x50a8),
    cp(0x4ed3, 0x50a8, 0x8d39),
    cp(0x6d77, 0x5916, 0x4ed3),
    cp(0x6d77, 0x5916, 0x4ed3, 0x8d39),
    cp(0x4ed3, 0x5e93, 0x8d39),
  ],
  mgmt: [
    "mgmt", "management", "managementfee", "servicefee",
    cp(0x7ba1, 0x7406, 0x8d39),
    cp(0x8fd0, 0x8425, 0x8d39),
    cp(0x670d, 0x52a1, 0x8d39),
    cp(0x5176, 0x4ed6, 0x7ba1, 0x7406, 0x8d39),
  ],
  shippingMode: [
    "shippingmode", "transportmode", "clearancemode",
    cp(0x7269, 0x6d41, 0x6a21, 0x5f0f),
    cp(0x6e05, 0x5173, 0x6a21, 0x5f0f),
    cp(0x8fd0, 0x8f93, 0x6a21, 0x5f0f),
    cp(0x53d1, 0x8d27, 0x6a21, 0x5f0f),
  ],
  ozonProductType: [
    "ozonproducttype", "ozoncategory", "category",
    cp(0x6f, 0x7a, 0x6f, 0x6e, 0x7c7b, 0x76ee),
    cp(0x6f, 0x7a, 0x6f, 0x6e, 0x54c1, 0x7c7b),
    cp(0x5e73, 0x53f0, 0x7c7b, 0x76ee),
    cp(0x7c7b, 0x76ee),
    cp(0x5546, 0x54c1, 0x7c7b, 0x76ee),
    cp(0x4f63, 0x91d1, 0x7c7b, 0x76ee),
  ],
  tariffCategory: [
    "tariffcategory", "feecategory",
    cp(0x8d39, 0x7387, 0x7c7b, 0x76ee),
    cp(0x6263, 0x8d39, 0x7c7b, 0x76ee),
    cp(0x8ba1, 0x8d39, 0x7c7b, 0x76ee),
  ],
  ozonModel: [
    "ozonmodel", "fulfillmentmodel", "model",
    cp(0x5c65, 0x7ea6, 0x6a21, 0x5f0f),
    cp(0x6f, 0x7a, 0x6f, 0x6e, 0x6a21, 0x5f0f),
    cp(0x5e73, 0x53f0, 0x6a21, 0x5f0f),
    cp(0x6a21, 0x5f0f),
  ],
  ozonAcceptanceRatePct: [
    "ozonacceptanceratepct", "ozonacceptancerate", "ozonbuyoutrate", "ozonbuyout",
    "ozon" + cp(0x9884, 0x8ba1, 0x7b7e, 0x6536, 0x7387),
    "ozon" + cp(0x7b7e, 0x6536, 0x7387),
  ],
  wbAcceptanceRatePct: [
    "wbacceptanceratepct", "wbacceptancerate", "wbbuyoutrate", "wbbuyout",
    "wb" + cp(0x9884, 0x8ba1, 0x7b7e, 0x6536, 0x7387),
    "wb" + cp(0x7b7e, 0x6536, 0x7387),
  ],
  yandexAcceptanceRatePct: [
    "yandexacceptanceratepct", "yandexacceptancerate", "yandexbuyoutrate", "yandexbuyout",
    "yandex" + cp(0x9884, 0x8ba1, 0x7b7e, 0x6536, 0x7387),
    "yandex" + cp(0x7b7e, 0x6536, 0x7387),
  ],
};

const NUMERIC_FIELDS = new Set([
  "priceCNY",
  "bookCostCNY",
  "importTaxBaseCNY",
  "qty",
  "weight",
  "weightKg",
  "volL",
  "volW",
  "volH",
  "list",
  "platformFee",
  "warehouse",
  "mgmt",
  "ozonAcceptanceRatePct",
  "wbAcceptanceRatePct",
  "yandexAcceptanceRatePct",
]);

const PLATFORM_ACCEPTANCE_FIELDS = Object.freeze({
  ozonAcceptanceRatePct: "ozon",
  wbAcceptanceRatePct: "wb",
  yandexAcceptanceRatePct: "yandex",
});

const ACCEPTANCE_RATE_FIELDS = new Set(Object.keys(PLATFORM_ACCEPTANCE_FIELDS));

const DEFAULT_COLUMN_ORDER = [
  "id",
  "priceCNY",
  "bookCostCNY",
  "qty",
  "weight",
  "list",
  "platformFee",
  "warehouse",
  "mgmt",
];

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/[\uFF08(].*?[\uFF09)]/g, "")
    .replace(/[\u3010\[].*?[\u3011\]]/g, "")
    .replace(/[\u3000\s_\-./\\:;,'"`|~+*=#&%()[\]{}<>]/g, "")
    .replace(/[\uFF0C\u3002\u3001\uFF1A\uFF1B\u201C\u201D\u2018\u2019\uFF01!\uFF1F?]/g, "")
    .replace(/[\uFFE5\u00A5\u20BD$€]/g, "");
}

const NORMALIZED_ALIASES = Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([field, aliases]) => [
    field,
    aliases.map(normalizeHeader).filter(Boolean),
  ]),
);

function normalizeMode(value) {
  const raw = String(value ?? "").normalize("NFKC").trim();
  const lower = raw.toLowerCase();
  if (!lower) return "";
  if (lower.includes(cp(0x7070)) || lower.includes("gray") || lower.includes("grey")) return "gray";
  if (lower.includes(cp(0x767d)) || lower.includes("white")) return "white";
  if (lower.includes(cp(0x624b)) || lower.includes("manual")) return "manual";
  return raw;
}

function normalizeModel(value) {
  const raw = String(value ?? "").normalize("NFKC").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (["FBO", "FBS", "RFBS", "REALFBS"].includes(upper)) return upper === "REALFBS" ? "realFBS" : upper;
  return raw;
}

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value == null) return undefined;

  let text = String(value)
    .normalize("NFKC")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[％%]/g, "")
    .replace(/(?:rub|cny|rmb|usd|pcs|pc|kg|cm|\u0440\u0443\u0431|\u20BD|\uFFE5|\u00A5|\$)/gi, "")
    .replace(/\s+/g, "");

  if (!text) return undefined;

  text = text.replace(/[^\d,.-]/g, "");
  if (!text || text === "-" || text === "." || text === "," || text === "-." || text === "-,") return undefined;

  const lastDot = text.lastIndexOf(".");
  const lastComma = text.lastIndexOf(",");

  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const group = decimal === "." ? "," : ".";
    text = text.replace(new RegExp(`\\${group}`, "g"), "");
    if (decimal === ",") text = text.replace(",", ".");
  } else if (lastComma >= 0) {
    const parts = text.split(",");
    const tail = parts.at(-1) || "";
    text = parts.length === 2 && tail.length <= 2
      ? text.replace(",", ".")
      : text.replace(/,/g, "");
  } else if (lastDot >= 0) {
    const parts = text.split(".");
    const head = parts[0] || "";
    const tail = parts.at(-1) || "";
    const looksLikeThousands = parts.length === 2 && head.length > 1 && tail.length === 3;
    if (looksLikeThousands) text = text.replace(/\./g, "");
  }

  text = text.replace(/[^\d.-]/g, "");
  if (!text || text === "-" || text === "." || text === "-.") return undefined;

  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function detectDelimiter(text) {
  const sample = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const delimiters = ["\t", ",", ";"];
  return delimiters
    .map((delimiter) => ({ delimiter, count: sample.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
}

function parseDelimitedRows(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  return rows;
}

function findHeaderField(header) {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  for (const [field, aliases] of Object.entries(NORMALIZED_ALIASES)) {
    if (aliases.includes(normalized)) return field;
  }

  let best = null;
  Object.entries(NORMALIZED_ALIASES).forEach(([field, aliases]) => {
    aliases.forEach((alias) => {
      if (!alias || alias.length < 2) return;
      if (!normalized.includes(alias) && !alias.includes(normalized)) return;
      if (!best || alias.length > best.alias.length) best = { field, alias };
    });
  });

  return best?.field || null;
}

function mapHeaders(headers) {
  const mapped = {};

  headers.forEach((header, index) => {
    const field = findHeaderField(header);
    if (field && mapped[field] == null) mapped[field] = index;
  });

  if (mapped.id == null && headers.length) mapped.id = 0;
  return mapped;
}

function rowIsProbablyHeader(row) {
  return row.some((cell) => !!findHeaderField(cell));
}

export function findProductImportSheet(sheets = []) {
  const nonEmptySheets = sheets.filter(({ rows }) => (
    Array.isArray(rows) && rows.some((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== ""))
  ));
  const productDetailSheet = nonEmptySheets.find(({ name }) => normalizeHeader(name) === normalizeHeader("商品明细"));
  if (productDetailSheet) return productDetailSheet;

  const compatibleSheet = nonEmptySheets.find(({ rows }) => {
    const headerIndex = rows.findIndex((row, index) => index < 10 && rowIsProbablyHeader(row));
    if (headerIndex < 0) return false;
    const headers = rows[headerIndex];
    const headerMap = mapHeaders(headers);
    const hasExplicitId = headers.some((header) => findHeaderField(header) === "id");
    const hasProductField = Object.keys(headerMap).some((field) => NUMERIC_FIELDS.has(field));
    return hasExplicitId && hasProductField;
  });

  return compatibleSheet || nonEmptySheets[0] || null;
}

function fieldValueFromRow(row, headerMap, field) {
  const columnIndex = headerMap[field];
  if (columnIndex == null) return undefined;
  return row[columnIndex];
}

function setOzonPatch(product, patch) {
  product.platforms = {
    ...(product.platforms || {}),
    ozon: {
      enabled: true,
      salesShare: 100,
      model: "FBO",
      ...(product.platforms?.ozon || {}),
      ...patch,
    },
  };
}

function setPlatformPatch(product, platformId, patch) {
  product.platforms = {
    ...(product.platforms || {}),
    [platformId]: {
      ...(product.platforms?.[platformId] || {}),
      ...patch,
    },
  };
}

function productFromRow(row, headerMap, rowIndex) {
  const product = {};
  const touchedFields = new Set();

  Object.entries(headerMap).forEach(([field, columnIndex]) => {
    const raw = row[columnIndex];
    if (raw == null || String(raw).trim() === "") return;

    if (NUMERIC_FIELDS.has(field)) {
      const number = parseNumber(raw);
      if (number == null) return;
      if (ACCEPTANCE_RATE_FIELDS.has(field)) {
        if (number < 1 || number > 100) return;
        const platformId = PLATFORM_ACCEPTANCE_FIELDS[field];
        if (platformId === "ozon") setOzonPatch(product, { acceptanceRatePct: number });
        else setPlatformPatch(product, platformId, { acceptanceRatePct: number });
      } else {
        product[field] = number;
      }
    } else if (field === "shippingMode") {
      const mode = normalizeMode(raw);
      if (!mode) return;
      product[field] = mode;
    } else if (field === "ozonModel") {
      const model = normalizeModel(raw);
      if (!model) return;
      setOzonPatch(product, { model });
    } else if (field === "ozonProductType" || field === "tariffCategory") {
      product[field] = String(raw).normalize("NFKC").trim();
    } else {
      product[field] = String(raw).normalize("NFKC").trim();
    }

    touchedFields.add(field);
  });

  if (!product.id) product.id = `IMPORT${String(rowIndex + 1).padStart(3, "0")}`;

  const ozonPatch = {};
  ["list", "platformFee", "warehouse", "mgmt"].forEach((field) => {
    if (touchedFields.has(field)) ozonPatch[field] = product[field];
  });

  if (touchedFields.has("platformFee")) {
    ozonPatch.useFeeDetails = false;
    ozonPatch.useTariffLookup = false;
  }

  const ozonProductType = product.ozonProductType;
  const tariffCategory = product.tariffCategory;
  if (ozonProductType) {
    ozonPatch.ozonProductType = ozonProductType;
    ozonPatch.tariffCategory = tariffCategory || ozonProductType;
  } else if (tariffCategory) {
    ozonPatch.tariffCategory = tariffCategory;
    ozonPatch.ozonProductType = tariffCategory;
  }

  if (Object.keys(ozonPatch).length) setOzonPatch(product, ozonPatch);

  delete product.ozonProductType;
  delete product.tariffCategory;

  return product;
}

function hasUsefulImportedValue(product) {
  return Object.entries(product).some(([key, value]) => {
    if (key === "id") return false;
    if (key !== "platforms") return value !== "" && value != null;
    return Object.values(value || {}).some((platformConfig) => (
      Object.entries(platformConfig || {}).some(([platformKey, platformValue]) => {
        if (["enabled", "salesShare", "model"].includes(platformKey)) return false;
        return platformValue !== "" && platformValue != null;
      })
    ));
  });
}

export function parseProductImportText(text) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "");
  return parseProductImportRows(parseDelimitedRows(cleanText));
}

export function parseProductImportRows(rows = []) {
  if (!Array.isArray(rows) || rows.length < 1) return { products: [], skipped: 0 };

  const cleanRows = rows
    .map((row) => Array.isArray(row) ? row : [row])
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));

  if (!cleanRows.length) return { products: [], skipped: 0 };

  const headerIndex = cleanRows.findIndex((row, index) => index < 10 && rowIsProbablyHeader(row));
  const hasHeader = headerIndex >= 0;
  const headers = hasHeader ? cleanRows[headerIndex] : DEFAULT_COLUMN_ORDER;
  const startIndex = hasHeader ? headerIndex + 1 : 0;
  const headerMap = mapHeaders(headers);
  const products = [];
  let skipped = 0;

  cleanRows.slice(startIndex).forEach((row, index) => {
    const product = productFromRow(row, headerMap, startIndex + index);
    if (!product.id || !hasUsefulImportedValue(product)) {
      skipped += 1;
      return;
    }
    products.push(product);
  });

  return { products, skipped };
}

export function mergeImportedProducts(currentProducts = [], importedProducts = []) {
  const output = [...currentProducts];
  const byId = new Map(output.map((product, index) => [String(product.id || "").trim(), index]));
  let updated = 0;
  let added = 0;

  importedProducts.forEach((imported) => {
    const id = String(imported.id || "").trim();
    if (!id) return;

    if (byId.has(id)) {
      const index = byId.get(id);
      const current = output[index] || {};
      const currentPlatforms = current.platforms || {};
      const importedPlatforms = imported.platforms || {};
      const mergedPlatforms = {};
      new Set([...Object.keys(currentPlatforms), ...Object.keys(importedPlatforms)]).forEach((platformId) => {
        mergedPlatforms[platformId] = {
          ...(currentPlatforms[platformId] || {}),
          ...(importedPlatforms[platformId] || {}),
        };
      });
      if (!Object.keys(currentPlatforms).length && Object.keys(importedPlatforms).length && !mergedPlatforms.ozon) {
        mergedPlatforms.ozon = { enabled: true, salesShare: 100, model: "FBO" };
      }
      output[index] = {
        ...current,
        ...imported,
        id,
        platforms: mergedPlatforms,
      };
      updated += 1;
    } else {
      const importedPlatforms = imported.platforms || {};
      const platforms = Object.keys(importedPlatforms).length && !importedPlatforms.ozon
        ? {
          ozon: { enabled: true, salesShare: 100, model: "FBO" },
          ...importedPlatforms,
        }
        : importedPlatforms;
      output.push({ ...imported, id, ...(Object.keys(platforms).length ? { platforms } : {}) });
      byId.set(id, output.length - 1);
      added += 1;
    }
  });

  return { products: output, added, updated };
}
