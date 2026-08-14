import * as XLSX from "xlsx";
import {
  DEFAULT_PARAMS,
  DEFAULT_PROJECTION,
  MAX_FORECAST_MONTHS,
  normalizeForecastHorizon,
  normalizeProjectData,
} from "./calcEngine.js";
import {
  normalizeForecastStartMonth,
  normalizeTaxParams,
  resolveTaxRevenueRecognition,
} from "./taxModel.js";
import { getProductPlatformConfigs } from "./platformPricing.js";

export const PROJECT_EXCEL_SHEETS = [
  "项目参数",
  "商品明细",
  "销售排期",
  "价格排期",
  "补货排期",
  "提款分润",
];

export function isProjectExcelWorkbook(workbook) {
  return PROJECT_EXCEL_SHEETS.every((sheet) => Boolean(workbook?.Sheets?.[sheet]));
}

const PRODUCT_COLUMNS = [
  ["id", "SKU"],
  ["name", "商品名称"],
  ["priceCNY", "采购价 CNY"],
  ["bookCostCNY", "账面成本 CNY"],
  ["importTaxBaseCNY", "进口计税基础 CNY"],
  ["qty", "首批数量"],
  ["weight", "单件重量 kg"],
  ["weightKg", "计费重量 kg"],
  ["volL", "长 cm"],
  ["volW", "宽 cm"],
  ["volH", "高 cm"],
  ["list", "默认售价 RUB"],
  ["platformFee", "平台综合费 RUB"],
  ["warehouse", "仓储操作费 RUB"],
  ["mgmt", "管理费 RUB"],
  ["shippingMode", "物流方式"],
  ["ozonProductType", "Ozon 商品类型"],
  ["tariffCategory", "费率类别"],
  ["ozonModel", "Ozon 履约模式"],
  ["platformSettingsJson", "平台设置 JSON（系统保留，请勿修改）"],
  ["ozonAcceptanceRatePct", "Ozon 预计签收率 %"],
  ["wbAcceptanceRatePct", "WB 预计签收率 %"],
  ["yandexAcceptanceRatePct", "Yandex 预计签收率 %"],
];

const PLATFORM_SETTINGS_JSON_FIELD = "platformSettingsJson";
const PLATFORM_ACCEPTANCE_FIELDS = {
  ozonAcceptanceRatePct: "ozon",
  wbAcceptanceRatePct: "wb",
  yandexAcceptanceRatePct: "yandex",
};
const OPTIONAL_PRODUCT_FIELDS = new Set([
  "importTaxBaseCNY",
  PLATFORM_SETTINGS_JSON_FIELD,
  ...Object.keys(PLATFORM_ACCEPTANCE_FIELDS),
]);

const PARAMETER_ROWS = [
  ["projectName", "项目名称"],
  ["params.exchangeRate", "汇率（RUB/CNY）"],
  ["params.usdRate", "美元汇率（RUB/USD）"],
  ["params.damageRate", "损耗率"],
  ["params.shippingPerUnit", "单件头程 RUB"],
  ["params.labelingPerUnit", "单件贴标 RUB"],
  ["params.grayShipPrice", "灰关运费（CNY/kg）"],
  ["params.whiteShipPrice", "白关运费（CNY/m³）"],
  ["params.payoutLossRate", "回款损耗率"],
  ["params.payoutLossBasis", "回款损耗计提基数"],
  ["params.taxScheme", "税制"],
  ["params.vatRate", "增值税率"],
  ["params.profitTaxRate", "利润税率"],
  ["params.customTaxRate", "关税率"],
  ["params.incomeBasis", "收入税计税基数"],
  ["params.taxRevenueRecognition", "计税收入确认方式"],
  ["params.taxCostBasis", "可扣成本口径"],
  ["params.platformFeeDeductible", "平台综合费可扣除"],
  ["params.payoutLossDeductible", "回款损耗可扣除"],
  ["params.oneTimeCosts", "一次性费用 RUB"],
  ["params.ipInsuranceEnabled", "启用 ИП 附加保险"],
  ["params.ipInsuranceThreshold", "ИП 附加保险门槛 RUB"],
  ["params.ipInsuranceRate", "ИП 附加保险税率"],
  ["params.ipInsuranceCap", "ИП 附加保险封顶 RUB"],
  ["projection.monthsHorizon", "预测月份（1-36）"],
  ["projection.partnerSharePct", "合作方分润比例"],
  ["projection.monthlyFixedCost", "每月固定费用 RUB"],
  ["projection.autoVATEscalation", "自动增值税升级"],
  ["projection.priorYearRevenue", "预测开始前累计营收（VAT跨阈值用） RUB"],
  ["projection.forecastStartMonth", "预测起始月份（YYYY-MM）"],
  ["projection.openingTaxableIncome", "本税务年度已累计计税收入 RUB"],
  ["projection.openingDeductibleExpenses", "本税务年度已累计可扣费用 RUB"],
  ["projection.openingUsnAdvancePaid", "本税务年度已预缴 USN 15% RUB"],
];

const PARAMETER_DESCRIPTIONS = {
  projectName: "填写项目名称",
  "params.payoutLossBasis": "选择按标价销售额或按实际回款计提",
  "params.taxScheme": "从下拉选择；USN 6%+1% 中的 1% 是独立 ИП 超额保险缴费；USN 15% 与 ИП 超额保险缴费也是两项独立义务，不是 15%+1% 的单一税率",
  "params.incomeBasis": "旧版兼容字段；新项目请按下方「计税收入确认方式」填写，两项同时填写时必须一致",
  "params.taxRevenueRecognition": "选择计税收入按含税销售额确认，还是按平台结算单确认；平台结算口径不会再次扣除已包含在结算额内的费用",
  "params.taxCostBasis": "选择可税前扣除的成本口径；账面成本应以已取得凭证为准",
  "params.platformFeeDeductible": "仅在按含税销售额确认且已取得合规凭证时选择「是」；平台结算口径会自动避免重复扣除",
  "params.payoutLossDeductible": "仅在按含税销售额确认且已取得合规凭证时选择「是」；平台结算口径会自动避免重复扣除",
  "params.ipInsuranceEnabled": "选择 是 或 否；USN 6% 或 USN 15% 且主体为 ИП 时按需选择「是」，不会把 USN 15% 变成 16%",
  "projection.monthsHorizon": "销售、价格、补货、提款排期只读取这个月数内的值",
  "projection.partnerSharePct": "填写 50 代表 50%",
  "projection.autoVATEscalation": "选择 是 或 否",
  "projection.forecastStartMonth": "填写预测第一个销售月，格式必须为 YYYY-MM，例如 2026-01",
  "projection.priorYearRevenue": "本预测开始前累计营收，仅用于 VAT 跨阈值判断；不等同于本税年 USN 15% 期初计税收入",
  "projection.openingTaxableIncome": "本预测开始前、同一自然年内已确认的计税收入；不等同于预测开始前累计营收",
  "projection.openingDeductibleExpenses": "本预测开始前、同一自然年内已确认的可扣费用",
  "projection.openingUsnAdvancePaid": "本预测开始前、同一自然年内已经缴纳的 USN 15% 预缴税额",
};

const TAX_SCHEME_LABELS = {
  usn_6: "USN 6%（销售额税）",
  usn_15: "USN 15%（利润税）",
  usn_6_vat5: "USN 6% + 增值税 5%",
  usn_6_vat7: "USN 6% + 增值税 7%",
  usn_15_vat5: "USN 15% + 增值税 5%",
  usn_15_vat7: "USN 15% + 增值税 7%",
  ausn_8: "АУСН 8%（销售额税）",
  osn: "一般税制",
  custom: "自定义税率",
};

const INCOME_BASIS_LABELS = {
  list: "按销售额计税",
  payout: "按回款计税",
};

const TAX_REVENUE_RECOGNITION_LABELS = {
  gross_sales: "按含税销售额确认",
  marketplace_settlement: "按平台结算单确认",
};

const TAX_COST_BASIS_LABELS = {
  documented_book_cost: "按已取得凭证的账面成本",
  actual_landed_cost: "按实际到仓成本（内部测算）",
};

const DEFAULT_FORECAST_START_MONTH = "2026-01";
const FORECAST_START_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const PAYOUT_LOSS_BASIS_LABELS = {
  list: "按标价销售额计提",
  actual_payout: "按实际回款计提",
};

const NUMERIC_PRODUCT_FIELDS = new Set([
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
  ...Object.keys(PLATFORM_ACCEPTANCE_FIELDS),
]);

const BOOLEAN_PARAMETER_FIELDS = new Set([
  "params.ipInsuranceEnabled",
  "params.platformFeeDeductible",
  "params.payoutLossDeductible",
  "projection.autoVATEscalation",
]);

const TEXT_PARAMETER_FIELDS = new Set([
  "projectName",
  "params.taxScheme",
  "params.incomeBasis",
  "params.taxRevenueRecognition",
  "params.taxCostBasis",
  "params.payoutLossBasis",
  "projection.forecastStartMonth",
]);

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim();
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[\s_\-./\\:;,'"`|~+*=#&%()[\]{}<>]/g, "").toLowerCase();
}

function isEmpty(value) {
  return value === undefined || value === null || normalizeText(value) === "";
}

function excelError(sheet, row, field, reason) {
  return new Error(`Excel 导入错误：${sheet} 第 ${row} 行 ${field}：${reason}`);
}

function getSheetRows(workbook, sheetName) {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) throw new Error(`Excel 导入错误：缺少工作表「${sheetName}」`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false });
}

function buildHeaderIndex(sheetName, rows, expectedHeaders) {
  const header = rows[0] || [];
  const actual = new Map(header.map((value, index) => [normalizeHeader(value), index]));
  const missing = expectedHeaders.filter((field) => !actual.has(normalizeHeader(field)));
  if (missing.length) {
    throw excelError(sheetName, 1, "表头", `缺少列：${missing.join("、")}`);
  }
  return actual;
}

function getHeaderIndexByAliases(sheetName, rows, aliases, displayName) {
  const header = rows[0] || [];
  const actual = new Map(header.map((value, index) => [normalizeHeader(value), index]));
  const index = aliases
    .map((alias) => actual.get(normalizeHeader(alias)))
    .find((value) => Number.isInteger(value));
  if (!Number.isInteger(index)) {
    throw excelError(sheetName, 1, "表头", `缺少列：${displayName}`);
  }
  return index;
}

function numberValue(value, sheet, row, field, { required = false } = {}) {
  if (isEmpty(value)) {
    if (required) throw excelError(sheet, row, field, "不能为空");
    return 0;
  }
  const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw excelError(sheet, row, field, "必须为数字");
  if (number < 0) throw excelError(sheet, row, field, "不能为负数");
  return number;
}

function booleanValue(value, sheet, row, field) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeText(value).toLowerCase();
  if (["1", "true", "是", "启用", "y", "yes"].includes(normalized)) return true;
  if (["0", "false", "否", "停用", "n", "no", ""].includes(normalized)) return false;
  throw excelError(sheet, row, field, "请填写 是/否 或 TRUE/FALSE");
}

function setNested(target, field, value) {
  const [group, key] = field.split(".");
  if (!key) {
    target[group] = value;
    return;
  }
  target[group] ??= {};
  target[group][key] = value;
}

function getProductColumnValue(product, field) {
  if (field === PLATFORM_SETTINGS_JSON_FIELD) {
    const platforms = product?.platforms;
    return platforms && typeof platforms === "object" && !Array.isArray(platforms) && Object.keys(platforms).length
      ? JSON.stringify(platforms)
      : "";
  }

  const platformId = PLATFORM_ACCEPTANCE_FIELDS[field];
  if (platformId) {
    const platform = product?.platforms?.[platformId];
    if (!platform || typeof platform !== "object") return "";
    const value = Number(platform.acceptanceRatePct ?? 100);
    return Number.isFinite(value) ? value : 100;
  }

  return product?.[field] ?? "";
}

function parsePlatformSettingsJson(value, sheet, row, field) {
  if (isEmpty(value)) return null;
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("平台设置必须是对象");
    }
    return parsed;
  } catch (error) {
    throw excelError(sheet, row, field, `不是有效 JSON：${error?.message || "格式错误"}`);
  }
}

function setProductPlatformAcceptanceRate(product, platformId, value) {
  const currentPlatforms = product.platforms && typeof product.platforms === "object" && !Array.isArray(product.platforms)
    ? product.platforms
    : {};
  const hasExistingPlatforms = Object.keys(currentPlatforms).length > 0;
  const seedPlatforms = hasExistingPlatforms
    ? currentPlatforms
    : getProductPlatformConfigs({ ...product, platforms: undefined });
  const normalizedConfigs = getProductPlatformConfigs({ ...product, platforms: seedPlatforms });
  product.platforms = {
    ...seedPlatforms,
    [platformId]: {
      ...normalizedConfigs[platformId],
      ...(seedPlatforms[platformId] || {}),
      acceptanceRatePct: value,
    },
  };
}

function parseMonth(value, sheet, row, field, { allowZero = false, maxMonth = MAX_FORECAST_MONTHS } = {}) {
  const text = normalizeText(value).toUpperCase();
  const match = text.match(/^M?(\d{1,2})$/);
  if (!match) throw excelError(sheet, row, field, "请填写 M1、M2…格式的期数");
  const month = Number(match[1]);
  if (month < (allowZero ? 0 : 1) || month > maxMonth) {
    throw excelError(sheet, row, field, allowZero
      ? `必须在 M0 到 M${maxMonth} 之间`
      : `必须在 M1 到 M${maxMonth} 之间`);
  }
  return month;
}

function getMonthColumnIndex(sheet, header, month, row, field, allowZero = false, maxMonth = MAX_FORECAST_MONTHS) {
  const matches = [];
  header.forEach((value, index) => {
    const text = normalizeText(value).toUpperCase();
    if (!text) return;
    const match = text.match(/^M?(\d{1,2})$/);
    if (!match) return;
    if (Number(match[1]) === month) matches.push(index);
  });
  if (matches.length !== 1) {
    throw excelError(sheet, row, field, `需要且只能有一个 ${allowZero ? `M0…M${maxMonth}` : `M1…M${maxMonth}`} 月份列`);
  }
  return matches[0];
}

function getParameterValue(data, field) {
  const [group, key] = field.split(".");
  return key ? data[group]?.[key] : data[group];
}

function getParameterField(value) {
  const text = normalizeText(value);
  const comparable = normalizeHeader(text);
  // Accept labels emitted by older templates (for example
  // “预测月份（1-12）”) after widening the supported horizon.
  if (/^预测月份1\d{1,2}$/.test(comparable)) return "projection.monthsHorizon";
  if (["上一年度收入 RUB", "上一年度收入RUB"].some((alias) => normalizeHeader(alias) === comparable)) {
    return "projection.priorYearRevenue";
  }
  return PARAMETER_ROWS.find(([field, label]) => (
    normalizeHeader(field) === comparable || normalizeHeader(label) === comparable
  ))?.[0] || "";
}

function displayLabeledValue(labels, value) {
  return labels[value] || value || "";
}

function parseLabeledValue(labels, value) {
  const text = normalizeText(value);
  return Object.entries(labels).find(([code, label]) => (
    normalizeText(code) === text || normalizeText(label) === text
  ))?.[0] || text;
}

function legacyIncomeBasisForRecognition(recognition) {
  return recognition === "gross_sales" ? "list" : "payout";
}

function normalizedForecastStartMonth(value) {
  if (value instanceof Date) return normalizeForecastStartMonth(value) || "";
  if (typeof value === "string") {
    const text = normalizeText(value);
    return FORECAST_START_MONTH_PATTERN.test(text) ? normalizeForecastStartMonth(text) || "" : "";
  }

  // Excel may turn a YYYY-MM entry into a date serial even when the template
  // is styled as text. Accept that workbook representation during import.
  const serial = typeof value === "number" ? value : NaN;
  if (!Number.isFinite(serial) || !Number.isInteger(serial) || serial < 1) return "";
  const date = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  if (Number.isNaN(date.getTime())) return "";
  return normalizeForecastStartMonth(
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
  ) || "";
}

function displayParameterValue(field, value) {
  if (BOOLEAN_PARAMETER_FIELDS.has(field)) return value ? "是" : "否";
  if (field === "params.taxScheme") return displayLabeledValue(TAX_SCHEME_LABELS, value);
  if (field === "params.incomeBasis") return displayLabeledValue(INCOME_BASIS_LABELS, value);
  if (field === "params.taxRevenueRecognition") return displayLabeledValue(TAX_REVENUE_RECOGNITION_LABELS, value);
  if (field === "params.taxCostBasis") return displayLabeledValue(TAX_COST_BASIS_LABELS, value);
  if (field === "params.payoutLossBasis") return displayLabeledValue(PAYOUT_LOSS_BASIS_LABELS, value);
  if (field === "projection.forecastStartMonth") return normalizedForecastStartMonth(value) || value || "";
  return value ?? "";
}

function parseParameterTextValue(field, value) {
  if (field === "params.taxScheme") return parseLabeledValue(TAX_SCHEME_LABELS, value);
  if (field === "params.incomeBasis") return parseLabeledValue(INCOME_BASIS_LABELS, value);
  if (field === "params.taxRevenueRecognition") return parseLabeledValue(TAX_REVENUE_RECOGNITION_LABELS, value);
  if (field === "params.taxCostBasis") return parseLabeledValue(TAX_COST_BASIS_LABELS, value);
  if (field === "params.payoutLossBasis") return parseLabeledValue(PAYOUT_LOSS_BASIS_LABELS, value);
  return normalizeText(value);
}

function mapScheduleRows({ rows, sheet, skuSet, monthsHorizon, includeZeroMonth = false }) {
  const header = rows[0] || [];
  const skuIndex = buildHeaderIndex(sheet, rows, ["SKU"]).get(normalizeHeader("SKU"));
  const expectedStart = includeZeroMonth ? 0 : 1;
  const monthIndexes = new Map();
  for (let month = expectedStart; month <= monthsHorizon; month += 1) {
    const column = getMonthColumnIndex(
      sheet,
      header,
      month,
      1,
      `M${month}`,
      includeZeroMonth,
      monthsHorizon,
    );
    monthIndexes.set(month, column);
  }
  // Older templates may contain extra month columns. Keep accepting them as
  // long as they are blank/zero, while rejecting data outside the selected
  // project horizon instead of silently dropping it.
  const extraMonthIndexes = new Map();
  header.forEach((value) => {
    const text = normalizeText(value).toUpperCase();
    const match = text.match(/^M?(\d{1,2})$/);
    if (!match) return;
    const month = Number(match[1]);
    if (month > MAX_FORECAST_MONTHS) {
      throw excelError(sheet, 1, text, `月份不能超过 M${MAX_FORECAST_MONTHS}`);
    }
    if (month > monthsHorizon) {
      extraMonthIndexes.set(month, getMonthColumnIndex(
        sheet,
        header,
        month,
        1,
        `M${month}`,
        includeZeroMonth,
        MAX_FORECAST_MONTHS,
      ));
    }
  });

  const store = {};
  const seen = new Set();
  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const sku = normalizeText(row[skuIndex]);
    const hasValues = row.some((value) => !isEmpty(value));
    if (!hasValues) return;
    if (!sku) throw excelError(sheet, rowNumber, "SKU", "不能为空");
    if (!skuSet.has(sku)) throw excelError(sheet, rowNumber, "SKU", `未在商品明细中找到「${sku}」`);
    if (seen.has(sku)) throw excelError(sheet, rowNumber, "SKU", `重复的 SKU「${sku}」`);
    seen.add(sku);
    const values = Array.from({ length: monthsHorizon + (includeZeroMonth ? 1 : 0) }, () => 0);
    for (let month = expectedStart; month <= monthsHorizon; month += 1) {
      const value = row[monthIndexes.get(month)];
      values[includeZeroMonth ? month : month - 1] = numberValue(value, sheet, rowNumber, `M${month}`);
    }
    extraMonthIndexes.forEach((column, month) => {
      if (numberValue(row[column], sheet, rowNumber, `M${month}`) !== 0) {
        throw excelError(sheet, rowNumber, `M${month}`, `超出项目预测月份 M${monthsHorizon}`);
      }
    });
    store[sku] = values;
  });
  return store;
}

function parseParameters(rows) {
  const sheet = "项目参数";
  const fieldIndex = getHeaderIndexByAliases(sheet, rows, ["参数名称", "字段"], "参数名称");
  const valueIndex = getHeaderIndexByAliases(sheet, rows, ["填写内容", "数值"], "填写内容");
  const parsed = { projectName: "未命名项目", params: {}, projection: {} };
  const seen = new Set();
  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const rawField = normalizeText(row[fieldIndex]);
    const field = getParameterField(rawField);
    const rawValue = row[valueIndex];
    if (!rawField && isEmpty(rawValue)) return;
    if (!field) {
      throw excelError(sheet, rowNumber, "参数名称", `不支持的参数「${rawField || "空"}」`);
    }
    if (seen.has(field)) throw excelError(sheet, rowNumber, "参数名称", `重复参数「${rawField}」`);
    seen.add(field);
    if (TEXT_PARAMETER_FIELDS.has(field)) {
      if (field === "projection.forecastStartMonth") {
        const startMonth = normalizedForecastStartMonth(rawValue);
        if (!startMonth) throw excelError(sheet, rowNumber, "数值", "必须为 YYYY-MM 格式，例如 2026-01");
        setNested(parsed, field, startMonth);
        return;
      }
      const value = parseParameterTextValue(field, rawValue);
      if (!value) throw excelError(sheet, rowNumber, "数值", "不能为空");
      if (field === "params.taxRevenueRecognition" && !Object.hasOwn(TAX_REVENUE_RECOGNITION_LABELS, value)) {
        throw excelError(sheet, rowNumber, "数值", "请选择按含税销售额确认或按平台结算单确认");
      }
      if (field === "params.taxCostBasis" && !Object.hasOwn(TAX_COST_BASIS_LABELS, value)) {
        throw excelError(sheet, rowNumber, "数值", "请选择已取得凭证的账面成本或实际到仓成本");
      }
      setNested(parsed, field, value);
      return;
    }
    if (BOOLEAN_PARAMETER_FIELDS.has(field)) {
      setNested(parsed, field, booleanValue(rawValue, sheet, rowNumber, "数值"));
      return;
    }
    const value = numberValue(rawValue, sheet, rowNumber, "数值", { required: field === "projection.monthsHorizon" });
    if (field === "projection.monthsHorizon" && (!Number.isInteger(value) || value < 1 || value > MAX_FORECAST_MONTHS)) {
      throw excelError(sheet, rowNumber, "数值", `必须是 1 到 ${MAX_FORECAST_MONTHS} 的整数`);
    }
    setNested(parsed, field, value);
  });
  if (!seen.has("projectName")) throw excelError(sheet, 1, "projectName", "缺少项目名称字段");
  if (!seen.has("projection.monthsHorizon")) throw excelError(sheet, 1, "projection.monthsHorizon", "缺少预测月份字段");
  if (seen.has("params.incomeBasis") && seen.has("params.taxRevenueRecognition")) {
    const legacyRecognition = resolveTaxRevenueRecognition({ incomeBasis: parsed.params.incomeBasis });
    const taxRevenueRecognition = resolveTaxRevenueRecognition({
      taxRevenueRecognition: parsed.params.taxRevenueRecognition,
    });
    if (legacyRecognition !== taxRevenueRecognition) {
      throw excelError(sheet, 1, "计税收入确认方式", "与旧版「收入税计税基数」不一致");
    }
  }
  return parsed;
}

function parseProducts(rows) {
  const sheet = "商品明细";
  const header = rows[0] || [];
  const actual = new Map(header.map((value, index) => [normalizeHeader(value), index]));
  const indexByField = {};
  PRODUCT_COLUMNS.forEach(([field, label]) => {
    const aliases = field === "bookCostCNY"
      ? [label, "申报价 CNY", "申报成本 CNY"]
      : [label];
    const index = aliases
      .map((alias) => actual.get(normalizeHeader(alias)))
      .find((value) => Number.isInteger(value));
    if (!Number.isInteger(index) && !OPTIONAL_PRODUCT_FIELDS.has(field)) {
      throw excelError(sheet, 1, "表头", `缺少列：${label}`);
    }
    indexByField[field] = Number.isInteger(index) ? index : null;
  });
  const products = [];
  const skuSet = new Set();
  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const hasValues = row.some((value) => !isEmpty(value));
    if (!hasValues) return;
    const product = {};
    PRODUCT_COLUMNS.forEach(([field, label]) => {
      const value = Number.isInteger(indexByField[field]) ? row[indexByField[field]] : null;
      if (field === "id") {
        product.id = normalizeText(value);
      } else if (field === PLATFORM_SETTINGS_JSON_FIELD) {
        const platforms = parsePlatformSettingsJson(value, sheet, rowNumber, label);
        if (platforms) product.platforms = platforms;
      } else if (PLATFORM_ACCEPTANCE_FIELDS[field]) {
        if (isEmpty(value)) return;
        const acceptanceRatePct = numberValue(value, sheet, rowNumber, label, { required: true });
        if (acceptanceRatePct < 1 || acceptanceRatePct > 100) {
          throw excelError(sheet, rowNumber, label, "必须在 1% 到 100% 之间");
        }
        setProductPlatformAcceptanceRate(product, PLATFORM_ACCEPTANCE_FIELDS[field], acceptanceRatePct);
      } else if (NUMERIC_PRODUCT_FIELDS.has(field)) {
        product[field] = numberValue(value, sheet, rowNumber, label);
      } else {
        product[field] = normalizeText(value);
      }
    });
    if (!product.id) throw excelError(sheet, rowNumber, "SKU", "不能为空");
    if (skuSet.has(product.id)) throw excelError(sheet, rowNumber, "SKU", `重复的 SKU「${product.id}」`);
    skuSet.add(product.id);
    product.name ||= product.id;
    product.shippingMode ||= "manual";
    products.push(product);
  });
  return { products, skuSet };
}

function parsePriceSchedule(rows, skuSet, monthsHorizon) {
  const sheet = "价格排期";
  const headers = buildHeaderIndex(sheet, rows, ["SKU", "期数", "售价 RUB", "平台综合扣费 RUB"]);
  const indexes = Object.fromEntries(["SKU", "期数", "售价 RUB", "平台综合扣费 RUB"].map((header) => [header, headers.get(normalizeHeader(header))]));
  const store = {};
  const seen = new Set();
  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const hasValues = row.some((value) => !isEmpty(value));
    if (!hasValues) return;
    const sku = normalizeText(row[indexes.SKU]);
    if (!sku) throw excelError(sheet, rowNumber, "SKU", "不能为空");
    if (!skuSet.has(sku)) throw excelError(sheet, rowNumber, "SKU", `未在商品明细中找到「${sku}」`);
    const month = parseMonth(row[indexes.期数], sheet, rowNumber, "期数");
    if (month > monthsHorizon) {
      const list = numberValue(row[indexes["售价 RUB"]], sheet, rowNumber, "售价 RUB");
      const fee = numberValue(row[indexes["平台综合扣费 RUB"]], sheet, rowNumber, "平台综合扣费 RUB");
      if (list !== 0 || fee !== 0) throw excelError(sheet, rowNumber, "期数", `超出项目预测月份 M${monthsHorizon}`);
      return;
    }
    const unique = `${sku}::${month}`;
    if (seen.has(unique)) throw excelError(sheet, rowNumber, "SKU/期数", `重复的排期「${sku} M${month}」`);
    seen.add(unique);
    const list = numberValue(row[indexes["售价 RUB"]], sheet, rowNumber, "售价 RUB", { required: true });
    const fee = numberValue(row[indexes["平台综合扣费 RUB"]], sheet, rowNumber, "平台综合扣费 RUB", { required: true });
    store[sku] ??= { list: Array(monthsHorizon).fill(0), fee: Array(monthsHorizon).fill(0) };
    store[sku].list[month - 1] = list;
    store[sku].fee[month - 1] = fee;
  });
  return store;
}

function parseWithdrawals(rows, monthsHorizon) {
  const sheet = "提款分润";
  const headers = buildHeaderIndex(sheet, rows, ["期数", "提款金额 RUB"]);
  const periodIndex = headers.get(normalizeHeader("期数"));
  const amountIndex = headers.get(normalizeHeader("提款金额 RUB"));
  const amounts = Array(monthsHorizon).fill(0);
  const seen = new Set();
  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const hasValues = row.some((value) => !isEmpty(value));
    if (!hasValues) return;
    const month = parseMonth(row[periodIndex], sheet, rowNumber, "期数");
    if (month > monthsHorizon) {
      if (numberValue(row[amountIndex], sheet, rowNumber, "提款金额 RUB") !== 0) {
        throw excelError(sheet, rowNumber, "期数", `超出项目预测月份 M${monthsHorizon}`);
      }
      return;
    }
    if (seen.has(month)) throw excelError(sheet, rowNumber, "期数", `重复的排期 M${month}`);
    seen.add(month);
    amounts[month - 1] = numberValue(row[amountIndex], sheet, rowNumber, "提款金额 RUB");
  });
  return { amounts };
}

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeExcelTaxParams(rawParams = {}) {
  const normalized = normalizeTaxParams(rawParams);
  return {
    taxRevenueRecognition: normalized.taxRevenueRecognition,
    taxCostBasis: normalized.taxCostBasis,
    platformFeeDeductible: normalized.platformFeeDeductible,
    payoutLossDeductible: normalized.payoutLossDeductible,
  };
}

function applyWorkbookTaxDefaults(data, rawParams = {}) {
  const taxParams = normalizeExcelTaxParams(rawParams);
  const recognition = taxParams.taxRevenueRecognition;
  const projection = data.projection || {};
  return {
    ...data,
    params: {
      ...data.params,
      ...taxParams,
      // Keep the legacy row in new files as an unambiguous compatibility mirror.
      incomeBasis: legacyIncomeBasisForRecognition(recognition),
    },
    projection: {
      ...projection,
      forecastStartMonth: normalizedForecastStartMonth(projection.forecastStartMonth) || DEFAULT_FORECAST_START_MONTH,
      openingTaxableIncome: nonNegativeNumber(projection.openingTaxableIncome),
      openingDeductibleExpenses: nonNegativeNumber(projection.openingDeductibleExpenses),
      openingUsnAdvancePaid: nonNegativeNumber(projection.openingUsnAdvancePaid),
    },
  };
}

export function buildProjectWorkbook(rawData = {}, options = {}) {
  const rawParams = rawData?.p || rawData?.params || {};
  const data = applyWorkbookTaxDefaults(normalizeProjectData(rawData), rawParams);
  const horizon = normalizeForecastHorizon(data.projection.monthsHorizon, DEFAULT_PROJECTION.monthsHorizon);
  const reservedHorizon = Number(options?.reserveMonths) > 0
    ? normalizeForecastHorizon(options.reserveMonths, horizon)
    : horizon;
  const columnHorizon = Math.max(horizon, reservedHorizon);
  const workbook = XLSX.utils.book_new();
  const parameterRows = [
    ["参数名称", "填写内容", "填写说明"],
    ...PARAMETER_ROWS.map(([field, label]) => [label, displayParameterValue(field, getParameterValue(data, field)), PARAMETER_DESCRIPTIONS[field] || label]),
  ];
  const productRows = [
    PRODUCT_COLUMNS.map(([, label]) => label),
    ...data.products.map((product) => PRODUCT_COLUMNS.map(([field]) => getProductColumnValue(product, field))),
  ];
  const salesRows = [
    ["SKU", ...Array.from({ length: columnHorizon }, (_, index) => `M${index + 1}`)],
    ...data.products.map((product) => [product.id, ...Array.from({ length: columnHorizon }, (_, index) => (
      index < horizon ? (data.scheduleStore?.[product.id]?.[index] ?? "") : ""
    ))]),
  ];
  const priceRows = [["SKU", "期数", "售价 RUB", "平台综合扣费 RUB"]];
  data.products.forEach((product) => {
    for (let month = 1; month <= columnHorizon; month += 1) {
      const schedule = data.priceScheduleStore?.[product.id] || {};
      priceRows.push([
        product.id,
        `M${month}`,
        month <= horizon ? (schedule.list?.[month - 1] ?? product.list ?? "") : "",
        month <= horizon ? (schedule.fee?.[month - 1] ?? product.platformFee ?? "") : "",
      ]);
    }
  });
  const restockRows = [
    ["SKU", ...Array.from({ length: columnHorizon + 1 }, (_, index) => `M${index}`)],
    ...data.products.map((product) => [product.id, ...Array.from({ length: columnHorizon + 1 }, (_, index) => (
      index <= horizon ? (data.restockStore?.[product.id]?.[index] ?? "") : ""
    ))]),
  ];
  const withdrawalRows = [
    ["期数", "提款金额 RUB"],
    ...Array.from({ length: columnHorizon }, (_, index) => [
      `M${index + 1}`,
      index < horizon ? (data.withdrawalStore?.amounts?.[index] ?? 0) : 0,
    ]),
  ];
  const sheets = [
    ["项目参数", parameterRows],
    ["商品明细", productRows],
    ["销售排期", salesRows],
    ["价格排期", priceRows],
    ["补货排期", restockRows],
    ["提款分润", withdrawalRows],
  ];
  sheets.forEach(([name, rows]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    if (name === "商品明细") {
      const jsonColumnIndex = PRODUCT_COLUMNS.findIndex(([field]) => field === PLATFORM_SETTINGS_JSON_FIELD);
      sheet["!cols"] = PRODUCT_COLUMNS.map((_, index) => (index === jsonColumnIndex ? { hidden: true } : {}));
    }
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  });
  return workbook;
}

export function parseProjectWorkbook(workbook) {
  PROJECT_EXCEL_SHEETS.forEach((sheet) => getSheetRows(workbook, sheet));
  const parameters = parseParameters(getSheetRows(workbook, "项目参数"));
  const monthsHorizon = parameters.projection.monthsHorizon;
  const { products, skuSet } = parseProducts(getSheetRows(workbook, "商品明细"));
  const scheduleStore = mapScheduleRows({
    rows: getSheetRows(workbook, "销售排期"),
    sheet: "销售排期",
    skuSet,
    monthsHorizon,
  });
  const priceScheduleStore = parsePriceSchedule(getSheetRows(workbook, "价格排期"), skuSet, monthsHorizon);
  const restockStore = mapScheduleRows({
    rows: getSheetRows(workbook, "补货排期"),
    sheet: "补货排期",
    skuSet,
    monthsHorizon,
    includeZeroMonth: true,
  });
  const withdrawalStore = parseWithdrawals(getSheetRows(workbook, "提款分润"), monthsHorizon);
  const taxParams = normalizeExcelTaxParams(parameters.params);
  const projection = {
    ...DEFAULT_PROJECTION,
    ...parameters.projection,
    forecastStartMonth: normalizedForecastStartMonth(parameters.projection.forecastStartMonth) || DEFAULT_FORECAST_START_MONTH,
    openingTaxableIncome: nonNegativeNumber(parameters.projection.openingTaxableIncome),
    openingDeductibleExpenses: nonNegativeNumber(parameters.projection.openingDeductibleExpenses),
    openingUsnAdvancePaid: nonNegativeNumber(parameters.projection.openingUsnAdvancePaid),
  };
  return normalizeProjectData({
    projectName: parameters.projectName,
    params: {
      ...DEFAULT_PARAMS,
      ...parameters.params,
      ...taxParams,
      incomeBasis: legacyIncomeBasisForRecognition(taxParams.taxRevenueRecognition),
    },
    products,
    scheduleStore,
    priceScheduleStore,
    restockStore,
    withdrawalStore,
    projection,
    projectMeta: {},
  });
}
