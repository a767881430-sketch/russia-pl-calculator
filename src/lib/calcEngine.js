import {
  SALES_PLATFORMS,
  getProductPlatformConfigs,
  calcPlatformDetailFee,
  calcPlatformUnitEconomics,
  getEnabledPlatformEconomics,
  getProductPlatformAverages,
} from "./platformPricing.js";

export {
  SALES_PLATFORMS,
  getProductPlatformConfigs,
  calcPlatformDetailFee,
  calcPlatformUnitEconomics,
  getEnabledPlatformEconomics,
  getProductPlatformAverages,
};

export const DEFAULT_PARAMS = {
  exchangeRate: 12.0,
  usdRate: 95,
  damageRate: 0.03,
  shippingPerUnit: 0,
  labelingPerUnit: 0,
  grayShipPrice: 0,
  whiteShipPrice: 0,
  taxScheme: "usn_15",
  vatRate: 0.22,
  profitTaxRate: 0.25,
  customTaxRate: 0.15,
  incomeBasis: "payout",
  oneTimeCosts: 0,
};

export const DEFAULT_PROJECTION = {
  monthsHorizon: 8,
  partnerSharePct: 50,
  monthlyFixedCost: 0,
  autoVATEscalation: true,
  priorYearRevenue: 0,
};

export const BLANK_PROJECT_DATA = {
  params: { ...DEFAULT_PARAMS },
  products: [],
  scheduleStore: {},
  priceScheduleStore: {},
  restockStore: {},
  withdrawalStore: { amounts: [] },
  projection: { ...DEFAULT_PROJECTION },
  projectMeta: {},
};

export const SAMPLE_PRODUCTS = [
  { id: "A1300400", priceCNY: 17.65, declaredCNY: 17.65, qty: 30, weight: 0.38, list: 1249, platformFee: 652, warehouse: 99, mgmt: 36 },
  { id: "A1303300", priceCNY: 20.26, declaredCNY: 20.26, qty: 30, weight: 0.59, list: 1399, platformFee: 795, warehouse: 102, mgmt: 39 },
  { id: "A1310500", priceCNY: 9.0, declaredCNY: 9.0, qty: 60, weight: 0.3, list: 1099, platformFee: 636, warehouse: 99, mgmt: 28 },
  { id: "A1330900", priceCNY: 6.0, declaredCNY: 6.0, qty: 72, weight: 0.16, list: 849, platformFee: 424, warehouse: 102, mgmt: 21 },
  { id: "A1341400", priceCNY: 14.0, declaredCNY: 14.0, qty: 40, weight: 0.16, list: 1249, platformFee: 640, warehouse: 101, mgmt: 34 },
  { id: "A1341700", priceCNY: 24.0, declaredCNY: 24.0, qty: 46, weight: 0.52, list: 1599, platformFee: 886, warehouse: 98, mgmt: 45 },
  { id: "A1346800", priceCNY: 13.0, declaredCNY: 13.0, qty: 156, weight: 0.39, list: 1299, platformFee: 752, warehouse: 99, mgmt: 34 },
  { id: "A1347000", priceCNY: 6.0, declaredCNY: 6.0, qty: 180, weight: 0.29, list: 999, platformFee: 548, warehouse: 102, mgmt: 25 },
  { id: "A1347100", priceCNY: 7.0, declaredCNY: 7.0, qty: 80, weight: 0.37, list: 899, platformFee: 488, warehouse: 102, mgmt: 23 },
  { id: "A1347600", priceCNY: 18.0, declaredCNY: 18.0, qty: 312, weight: 0.44, list: 1399, platformFee: 812, warehouse: 100, mgmt: 39 },
  { id: "A1347800", priceCNY: 13.0, declaredCNY: 13.0, qty: 324, weight: 0.34, list: 1299, platformFee: 756, warehouse: 99, mgmt: 35 },
  { id: "A1348200", priceCNY: 12.0, declaredCNY: 12.0, qty: 144, weight: 0.34, list: 1249, platformFee: 756, warehouse: 102, mgmt: 35 },
  { id: "A1349300", priceCNY: 10.0, declaredCNY: 10.0, qty: 64, weight: 0.42, list: 1049, platformFee: 544, warehouse: 99, mgmt: 27 },
  { id: "A1349400", priceCNY: 11.0, declaredCNY: 11.0, qty: 60, weight: 0.45, list: 1049, platformFee: 596, warehouse: 100, mgmt: 28 },
  { id: "P10070122-DJ", priceCNY: 11.0, declaredCNY: 11.0, qty: 204, weight: 0.36, list: 1149, platformFee: 644, warehouse: 100, mgmt: 32 },
  { id: "P11050014-DJ", priceCNY: 12.0, declaredCNY: 12.0, qty: 72, weight: 0.3, list: 1099, platformFee: 608, warehouse: 99, mgmt: 32 },
  { id: "P11010059", priceCNY: 7.0, declaredCNY: 7.0, qty: 276, weight: 0.31, list: 1039, platformFee: 584, warehouse: 99, mgmt: 30 },
  { id: "A1311900", priceCNY: 8.0, declaredCNY: 8.0, qty: 120, weight: 0.38, list: 989, platformFee: 556, warehouse: 100, mgmt: 25 },
  { id: "A1312400", priceCNY: 10.0, declaredCNY: 10.0, qty: 144, weight: 0.31, list: 1049, platformFee: 580, warehouse: 100, mgmt: 27 },
  { id: "P11050175", priceCNY: 9.0, declaredCNY: 9.0, qty: 192, weight: 0.41, list: 999, platformFee: 520, warehouse: 99, mgmt: 25 },
  { id: "P11050176", priceCNY: 6.0, declaredCNY: 6.0, qty: 288, weight: 0.22, list: 849, platformFee: 424, warehouse: 98, mgmt: 21 },
  { id: "P11090149", priceCNY: 11.0, declaredCNY: 11.0, qty: 180, weight: 0.49, list: 1099, platformFee: 652, warehouse: 101, mgmt: 30 },
  { id: "A1337900-02", priceCNY: 25.0, declaredCNY: 25.0, qty: 90, weight: 0.21, list: 1499, platformFee: 772, warehouse: 99, mgmt: 42 },
  { id: "A1337900-03", priceCNY: 23.0, declaredCNY: 23.0, qty: 90, weight: 0.21, list: 1399, platformFee: 751, warehouse: 99, mgmt: 40 },
  { id: "A1337902-01-KD-B", priceCNY: 19.0, declaredCNY: 19.0, qty: 128, weight: 0.19, list: 1099, platformFee: 526, warehouse: 97, mgmt: 30 },
  { id: "A1338100", priceCNY: 30.0, declaredCNY: 30.0, qty: 40, weight: 0.22, list: 1629, platformFee: 862, warehouse: 100, mgmt: 46 },
  { id: "A1338301", priceCNY: 32.0, declaredCNY: 32.0, qty: 40, weight: 0.25, list: 1569, platformFee: 802, warehouse: 99, mgmt: 44 },
  { id: "A1338302", priceCNY: 31.0, declaredCNY: 31.0, qty: 48, weight: 0.24, list: 1599, platformFee: 814, warehouse: 99, mgmt: 45 },
  { id: "A1342200", priceCNY: 24.0, declaredCNY: 24.0, qty: 60, weight: 0.2, list: 1379, platformFee: 726, warehouse: 99, mgmt: 39 },
  { id: "P31234-01", priceCNY: 16.0, declaredCNY: 16.0, qty: 72, weight: 0.12, list: 1200, platformFee: 652, warehouse: 98, mgmt: 36 },
  { id: "A1331400", priceCNY: 5.0, declaredCNY: 5.0, qty: 280, weight: 0.9, list: 797, platformFee: 406, warehouse: 98, mgmt: 21 },
  { id: "A1347700", priceCNY: 9.0, declaredCNY: 9.0, qty: 216, weight: 0.17, list: 799, platformFee: 370, warehouse: 97, mgmt: 21 },
  { id: "A1348300", priceCNY: 6.0, declaredCNY: 6.0, qty: 364, weight: 0.11, list: 759, platformFee: 354, warehouse: 96, mgmt: 20 },
  { id: "A1331500", priceCNY: 6.0, declaredCNY: 6.0, qty: 48, weight: 0.06, list: 692, platformFee: 311, warehouse: 96, mgmt: 18 },
  { id: "A1350500", priceCNY: 10.0, declaredCNY: 10.0, qty: 182, weight: 0.17, list: 756, platformFee: 335, warehouse: 97, mgmt: 20 },
  { id: "A1352000", priceCNY: 36.0, declaredCNY: 36.0, qty: 12, weight: 1.61, list: 2299, platformFee: 1401, warehouse: 110, mgmt: 66 },
  { id: "A1352100", priceCNY: 47.0, declaredCNY: 47.0, qty: 9, weight: 2.09, list: 2499, platformFee: 1443, warehouse: 109, mgmt: 72 },
  { id: "A1338200", priceCNY: 20.0, declaredCNY: 20.0, qty: 24, weight: 0.76, list: 1890, platformFee: 1223, warehouse: 108, mgmt: 54 },
];

export function buildBlankProjectData(name = "未命名项目") {
  return {
    ...BLANK_PROJECT_DATA,
    params: { ...DEFAULT_PARAMS },
    projection: { ...DEFAULT_PROJECTION },
    withdrawalStore: { amounts: [] },
    projectName: name,
  };
}

export function calcShipping(product, params) {
  const mode = product.shippingMode || "manual";
  if (mode === "gray" && (product.weightKg || 0) > 0 && params.grayShipPrice > 0) {
    return (product.weightKg || 0) * params.grayShipPrice * params.exchangeRate;
  }
  if (
    mode === "white" &&
    (product.volL || 0) > 0 &&
    (product.volW || 0) > 0 &&
    (product.volH || 0) > 0 &&
    params.whiteShipPrice > 0
  ) {
    const volM3 = (product.volL * product.volW * product.volH) / 1e6;
    return volM3 * params.whiteShipPrice * params.exchangeRate;
  }
  return params.shippingPerUnit;
}

export function hasImportVATInvoice(product) {
  return (product.shippingMode || "manual") !== "gray";
}

export function calcProduct(product, params) {
  const platformAvg = getProductPlatformAverages(product);
  const declaredCNY = (product.declaredCNY ?? product.priceCNY) || 0;
  const priceRUB = (product.priceCNY || 0) * params.exchangeRate;
  const declaredRUB = declaredCNY * params.exchangeRate;
  const shipPerUnit = calcShipping(product, params);
  const unitCost = priceRUB + shipPerUnit + params.labelingPerUnit;
  const declaredUnitCost = declaredRUB + shipPerUnit + params.labelingPerUnit;
  const totalInvestment = unitCost * (product.qty || 0);
  const totalDeclaredCost = declaredUnitCost * (product.qty || 0);

  const listPrice = platformAvg.list;
  const platformFee = platformAvg.platformFee;
  const warehouse = platformAvg.warehouse;
  const mgmt = platformAvg.mgmt;
  const unitPayout = listPrice - platformFee;
  const effectiveQty = (product.qty || 0) * (1 - params.damageRate);
  const totalRevenue = unitPayout * effectiveQty;
  const totalWarehouse = warehouse * (product.qty || 0);
  const totalMgmt = mgmt * (product.qty || 0);

  const canDeductVAT = params.taxScheme === "osn" && hasImportVATInvoice(product);
  const inputVATPerUnit = canDeductVAT ? declaredRUB * params.vatRate : 0;
  const totalInputVAT = inputVATPerUnit * (product.qty || 0);

  let outputVATRate = 0;
  if (params.taxScheme === "osn") outputVATRate = params.vatRate;
  else if (params.taxScheme === "usn_6_vat5" || params.taxScheme === "usn_15_vat5") outputVATRate = 0.05;
  else if (params.taxScheme === "usn_6_vat7" || params.taxScheme === "usn_15_vat7") outputVATRate = 0.07;
  const totalOutputVAT = (listPrice * outputVATRate) / (1 + outputVATRate) * effectiveQty;

  const incomeBase = params.incomeBasis === "list" ? listPrice * effectiveQty : totalRevenue;
  const expenses = totalInvestment + totalWarehouse + totalMgmt;
  const profitBeforeTax = totalRevenue - expenses;

  let tax = 0;
  let vatPart = 0;
  let usnPart = 0;
  let profitTaxPart = 0;
  switch (params.taxScheme) {
    case "usn_6":
      tax = incomeBase * 0.06;
      usnPart = tax;
      break;
    case "usn_15": {
      const taxedProfit = Math.max(0, incomeBase - expenses);
      tax = Math.max(taxedProfit * 0.15, incomeBase * 0.01);
      usnPart = tax;
      break;
    }
    case "usn_6_vat5":
    case "usn_6_vat7": {
      vatPart = totalOutputVAT;
      const invoicedBase = incomeBase - vatPart;
      usnPart = invoicedBase * 0.06;
      tax = vatPart + usnPart;
      break;
    }
    case "usn_15_vat5":
    case "usn_15_vat7": {
      vatPart = totalOutputVAT;
      const invoicedBase = incomeBase - vatPart;
      const taxedProfit = Math.max(0, invoicedBase - expenses);
      usnPart = Math.max(taxedProfit * 0.15, invoicedBase * 0.01);
      tax = vatPart + usnPart;
      break;
    }
    case "osn": {
      vatPart = Math.max(0, totalOutputVAT - totalInputVAT);
      const invoicedBase = incomeBase - totalOutputVAT;
      const declaredExpenses = totalDeclaredCost + totalWarehouse + totalMgmt;
      profitTaxPart = Math.max(0, invoicedBase - declaredExpenses) * params.profitTaxRate;
      tax = vatPart + profitTaxPart;
      break;
    }
    case "custom":
      tax = Math.max(0, profitBeforeTax) * params.customTaxRate;
      break;
    default:
      break;
  }

  const netProfit = totalRevenue - expenses - tax;
  const bookNetProfit = totalRevenue - (totalDeclaredCost + totalWarehouse + totalMgmt) - tax;
  const totalGMV = listPrice * effectiveQty;
  const profitMargin = totalGMV > 0 ? netProfit / totalGMV : 0;
  const roi = totalInvestment > 0 ? netProfit / totalInvestment : 0;

  return {
    priceRUB,
    declaredRUB,
    unitCost,
    declaredUnitCost,
    totalInvestment,
    totalDeclaredCost,
    listPrice,
    platformFee,
    warehouse,
    mgmt,
    unitPayout,
    effectiveQty,
    totalRevenue,
    totalGMV,
    totalWarehouse,
    totalMgmt,
    platformAvg,
    platformDetails: platformAvg.active,
    totalInputVAT,
    totalOutputVAT,
    expenses,
    profitBeforeTax,
    tax,
    vatPart,
    usnPart,
    profitTaxPart,
    netProfit,
    bookNetProfit,
    profitMargin,
    roi,
    unitNetProfit: (product.qty || 0) > 0 ? netProfit / product.qty : 0,
    netProfitCNY: netProfit / params.exchangeRate,
  };
}

export function distributeEvenly(total, months) {
  if (months <= 0 || total <= 0) return Array(Math.max(0, months)).fill(0);
  const base = Math.floor(total / months);
  const rem = total - base * months;
  return Array.from({ length: months }, (_, i) => base + (i < rem ? 1 : 0));
}

export function seasonalWeightsFor(months) {
  const annual = [0.03, 0.04, 0.05, 0.06, 0.06, 0.07, 0.08, 0.08, 0.1, 0.13, 0.16, 0.14];
  if (months <= 0) return [];
  if (months === annual.length) return annual;
  if (months < annual.length) return annual.slice(annual.length - months);
  return Array.from({ length: months }, (_, index) => annual[index % annual.length]);
}

export function distributeSeasonally(total, months) {
  if (months <= 0 || total <= 0) return Array(Math.max(0, months)).fill(0);
  const weights = seasonalWeightsFor(months);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((weight) => (total * weight) / sum);
  const arr = raw.map((value) => Math.floor(value));
  let diff = total - arr.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (let i = 0; i < diff; i += 1) {
    arr[order[i % order.length].index] += 1;
  }
  return arr;
}

export function getSchedule(id, qty, months, store) {
  const sched = store[id];
  if (!Array.isArray(sched)) return distributeSeasonally(qty, months);
  if (sched.length === months) return sched;
  if (sched.length > months) return sched.slice(0, months);
  return [...sched, ...Array(months - sched.length).fill(0)];
}

export function getRestockSchedule(id, qty, months, restockStore) {
  const sched = restockStore[id];
  if (!Array.isArray(sched)) return [qty, ...Array(months).fill(0)];
  if (sched.length === months + 1) return sched;
  if (sched.length > months + 1) return sched.slice(0, months + 1);
  return [...sched, ...Array(months + 1 - sched.length).fill(0)];
}

export function VAT_TIER(cumRevenue) {
  if (cumRevenue <= 20_000_000) return { rate: 0, labelKey: "vatLabelNoVat", tier: 0 };
  if (cumRevenue <= 250_000_000) return { rate: 0.05, labelKey: "vatLabelVat5", tier: 1 };
  if (cumRevenue <= 450_000_000) return { rate: 0.07, labelKey: "vatLabelVat7", tier: 2 };
  return { rate: 0.22, labelKey: "vatLabelOsn22", tier: 3 };
}

export function getPriceForMonth(productId, monthIndex, defaultVal, priceStore) {
  const entry = priceStore?.[productId];
  if (!entry?.list) return defaultVal;
  const value = entry.list[monthIndex];
  return value && value > 0 ? value : defaultVal;
}

export function getFeeForMonth(productId, monthIndex, defaultVal, priceStore) {
  const entry = priceStore?.[productId];
  if (!entry?.fee) return defaultVal;
  const value = entry.fee[monthIndex];
  return value && value > 0 ? value : defaultVal;
}

export function calcProjection(
  products,
  params,
  projection,
  store,
  priceStore = {},
  restockStore = {},
  withdrawalStore = {},
) {
  const { monthsHorizon, partnerSharePct, monthlyFixedCost, autoVATEscalation, priorYearRevenue } = projection;
  const months = [];

  const productUnitCosts = {};
  const productPlatformAverages = {};
  for (const product of products) {
    const shipPerUnit = calcShipping(product, params);
    productUnitCosts[product.id] = (product.priceCNY || 0) * params.exchangeRate + shipPerUnit + params.labelingPerUnit;
    productPlatformAverages[product.id] = getProductPlatformAverages(product);
  }

  let totalActual = 0;
  let totalDeclared = 0;
  let totalImportVAT = 0;
  for (const product of products) {
    const declaredCNY = (product.declaredCNY ?? product.priceCNY) || 0;
    const shipPerUnit = calcShipping(product, params);
    const actualUnit = productUnitCosts[product.id];
    const declaredUnit = declaredCNY * params.exchangeRate + shipPerUnit + params.labelingPerUnit;
    const rSched = getRestockSchedule(product.id, product.qty || 0, monthsHorizon, restockStore);
    const m0Qty = rSched[0];
    totalActual += actualUnit * m0Qty;
    totalDeclared += declaredUnit * m0Qty;
    if (params.taxScheme === "osn" && hasImportVATInvoice(product)) {
      totalImportVAT += declaredCNY * params.exchangeRate * m0Qty * params.vatRate;
    }
  }

  const initialOutflow = totalActual + (params.oneTimeCosts || 0) + totalImportVAT;
  let cumCash = -initialOutflow;
  let inputVATCredit = totalImportVAT;

  const stockByProduct = {};
  let totalStockEnd = 0;
  for (const product of products) {
    const rSched = getRestockSchedule(product.id, product.qty || 0, monthsHorizon, restockStore);
    stockByProduct[product.id] = rSched[0];
    totalStockEnd += rSched[0];
  }

  months.push({
    monthIdx: 0,
    label: "M0",
    revenue: 0,
    cogs: 0,
    expenses: 0,
    fixedCost: 0,
    grossProfit: 0,
    tax: 0,
    vatRemit: 0,
    netProfit: -initialOutflow,
    partnerPayout: 0,
    cashFlow: -initialOutflow,
    cumCash,
    soldQty: 0,
    isInitial: true,
    importVAT: totalImportVAT,
    effectiveScheme: params.taxScheme,
    vatTierKey: null,
    cumRevenue: priorYearRevenue || 0,
    restockQty: totalStockEnd,
    restockCost: totalActual,
    stockEnd: totalStockEnd,
    stockWarning: false,
  });

  let cumRevenue = priorYearRevenue || 0;
  let vatTriggered = false;
  let vatTriggerMonth = null;
  let triggeredRate = 0;

  for (let month = 1; month <= monthsHorizon; month += 1) {
    let revenue = 0;
    let cogs = 0;
    let declaredCogs = 0;
    let expenses = 0;
    let damageLoss = 0;
    let soldQty = 0;
    let listSum = 0;
    let monthRestockQty = 0;
    let monthRestockCost = 0;

    for (const product of products) {
      const declaredCNY = (product.declaredCNY ?? product.priceCNY) || 0;
      const sched = getSchedule(product.id, product.qty || 0, monthsHorizon, store);
      const qty = sched[month - 1] || 0;
      soldQty += qty;
      const unitCost = productUnitCosts[product.id];
      const shipPerUnit = calcShipping(product, params);
      const declaredUnit = declaredCNY * params.exchangeRate + shipPerUnit + params.labelingPerUnit;
      const platformAvg = productPlatformAverages[product.id] || getProductPlatformAverages(product);
      const monthList = getPriceForMonth(product.id, month - 1, platformAvg.list, priceStore);
      const monthFee = getFeeForMonth(product.id, month - 1, platformAvg.platformFee, priceStore);
      const unitPayout = monthList - monthFee;
      revenue += qty * unitPayout;
      damageLoss += qty * params.damageRate * unitPayout;
      cogs += qty * unitCost;
      declaredCogs += qty * declaredUnit;
      expenses += qty * (1 - params.damageRate) * ((platformAvg.warehouse || 0) + (platformAvg.mgmt || 0));
      listSum += qty * (1 - params.damageRate) * monthList;

      const rSched = getRestockSchedule(product.id, product.qty || 0, monthsHorizon, restockStore);
      const restockQty = rSched[month] || 0;
      monthRestockQty += restockQty;
      monthRestockCost += restockQty * unitCost;
      stockByProduct[product.id] = (stockByProduct[product.id] || 0) + restockQty - qty;
    }

    let stockEnd = 0;
    let stockWarning = false;
    for (const product of products) {
      stockEnd += stockByProduct[product.id] || 0;
      if ((stockByProduct[product.id] || 0) < 0) stockWarning = true;
    }

    cumRevenue += revenue - damageLoss;
    const fixedCost = monthlyFixedCost || 0;
    const grossProfit = revenue - damageLoss - cogs - expenses - fixedCost;
    const incomeBase = params.incomeBasis === "list" ? listSum : revenue - damageLoss;

    let effectiveScheme = params.taxScheme;
    let vatTierKey = null;

    if (autoVATEscalation && (params.taxScheme === "usn_6" || params.taxScheme === "usn_15")) {
      const tier = VAT_TIER(cumRevenue);
      vatTierKey = tier.labelKey;
      if (tier.tier > 0) {
        if (!vatTriggered) {
          vatTriggered = true;
          vatTriggerMonth = month;
          triggeredRate = tier.rate;
        } else if (tier.rate > triggeredRate) {
          triggeredRate = tier.rate;
        }

        if (triggeredRate === 0.05) effectiveScheme = params.taxScheme === "usn_6" ? "usn_6_vat5" : "usn_15_vat5";
        else if (triggeredRate === 0.07) effectiveScheme = params.taxScheme === "usn_6" ? "usn_6_vat7" : "usn_15_vat7";
        else if (triggeredRate >= 0.22) effectiveScheme = "osn";
      }
    } else {
      if (params.taxScheme === "usn_6_vat5" || params.taxScheme === "usn_15_vat5") vatTierKey = "vatLabelFixed5";
      else if (params.taxScheme === "usn_6_vat7" || params.taxScheme === "usn_15_vat7") vatTierKey = "vatLabelFixed7";
      else if (params.taxScheme === "osn") vatTierKey = "vatLabelFixedOsn";
      else vatTierKey = "vatLabelNoVat";
    }

    let outputVATRate = 0;
    if (effectiveScheme === "osn") outputVATRate = params.vatRate;
    else if (effectiveScheme === "usn_6_vat5" || effectiveScheme === "usn_15_vat5") outputVATRate = 0.05;
    else if (effectiveScheme === "usn_6_vat7" || effectiveScheme === "usn_15_vat7") outputVATRate = 0.07;
    const monthlyOutputVAT = (listSum * outputVATRate) / (1 + outputVATRate);

    let tax = 0;
    let vatRemit = 0;
    switch (effectiveScheme) {
      case "usn_6":
        tax = incomeBase * 0.06;
        break;
      case "usn_15": {
        const taxedProfit = Math.max(0, incomeBase - cogs - expenses - fixedCost);
        tax = Math.max(taxedProfit * 0.15, incomeBase * 0.01);
        break;
      }
      case "usn_6_vat5":
      case "usn_6_vat7": {
        vatRemit = monthlyOutputVAT;
        const invoicedBase = incomeBase - vatRemit;
        tax = vatRemit + invoicedBase * 0.06;
        break;
      }
      case "usn_15_vat5":
      case "usn_15_vat7": {
        vatRemit = monthlyOutputVAT;
        const invoicedBase = incomeBase - vatRemit;
        const taxedProfit = Math.max(0, invoicedBase - cogs - expenses - fixedCost);
        tax = vatRemit + Math.max(taxedProfit * 0.15, invoicedBase * 0.01);
        break;
      }
      case "osn": {
        const used = Math.min(inputVATCredit, monthlyOutputVAT);
        vatRemit = monthlyOutputVAT - used;
        inputVATCredit -= used;
        const invoicedBase = incomeBase - monthlyOutputVAT;
        const taxedProfit = Math.max(0, invoicedBase - declaredCogs - expenses - fixedCost);
        tax = vatRemit + taxedProfit * params.profitTaxRate;
        break;
      }
      case "custom":
        tax = Math.max(0, grossProfit) * params.customTaxRate;
        break;
      default:
        break;
    }

    const netProfit = grossProfit - tax;
    const withdrawalAmount = withdrawalStore?.amounts?.[month - 1] || 0;
    const distributed = Math.min(withdrawalAmount, Math.max(0, netProfit));
    const partnerPayout = distributed * (partnerSharePct / 100);
    const ownerPayout = distributed - partnerPayout;
    const cashFlow = revenue - damageLoss - expenses - fixedCost - tax - partnerPayout - monthRestockCost;
    cumCash += cashFlow;

    months.push({
      monthIdx: month,
      label: `M${month}`,
      revenue,
      cogs,
      expenses,
      fixedCost,
      grossProfit,
      damageLoss,
      tax,
      vatRemit,
      netProfit,
      distributed,
      partnerPayout,
      ownerPayout,
      cashFlow,
      cumCash,
      soldQty,
      isInitial: false,
      effectiveScheme,
      vatTierKey,
      cumRevenue,
      vatRate: params.vatRate,
      restockQty: monthRestockQty,
      restockCost: monthRestockCost,
      stockEnd,
      stockWarning,
    });
  }

  const breakEvenIndex = months.findIndex((item, index) => index > 0 && item.cumCash >= 0);
  return {
    months,
    initialOutflow,
    breakEvenMonth: breakEvenIndex > 0 ? breakEvenIndex : null,
    maxDrawdown: Math.min(...months.map((item) => item.cumCash)),
    finalCash: months[months.length - 1].cumCash,
    totalRevenue: months.reduce((a, b) => a + b.revenue, 0),
    totalNetProfit: months.filter((item) => !item.isInitial).reduce((a, b) => a + b.netProfit, 0),
    totalTax: months.reduce((a, b) => a + b.tax, 0),
    totalVAT: months.reduce((a, b) => a + (b.vatRemit || 0), 0),
    totalPartnerPayout: months.reduce((a, b) => a + b.partnerPayout, 0),
    totalImportVAT,
    leftoverInputVAT: inputVATCredit,
    vatTriggerMonth,
    vatTriggered,
    finalCumRevenue: months[months.length - 1].cumRevenue,
    totalDeclared,
  };
}

export function normalizeProjectData(raw = {}) {
  return {
    params: { ...DEFAULT_PARAMS, ...(raw.p || raw.params || {}) },
    products: Array.isArray(raw.pr || raw.products) ? (raw.pr || raw.products) : [],
    scheduleStore: raw.ss || raw.scheduleStore || {},
    priceScheduleStore: raw.ps || raw.priceScheduleStore || {},
    restockStore: raw.rs || raw.restockStore || {},
    withdrawalStore: raw.ws || raw.withdrawalStore || { amounts: [] },
    projection: { ...DEFAULT_PROJECTION, ...(raw.pj || raw.projection || {}) },
    projectMeta: raw.pm || raw.projectMeta || {},
    projectName: raw.projectName || "未命名项目",
  };
}

export function calculateTotals(calcs, params) {
  const totals = {
    qty: 0,
    totalInvestment: 0,
    totalDeclaredCost: 0,
    totalRevenue: 0,
    totalGMV: 0,
    totalWarehouse: 0,
    totalMgmt: 0,
    tax: 0,
    vatPart: 0,
    usnPart: 0,
    profitTaxPart: 0,
    totalInputVAT: 0,
    totalOutputVAT: 0,
    netProfit: 0,
    bookNetProfit: 0,
    profitBeforeTax: 0,
  };

  for (const row of calcs) {
    totals.qty += row.qty || 0;
    totals.totalInvestment += row.c.totalInvestment;
    totals.totalDeclaredCost += row.c.totalDeclaredCost;
    totals.totalRevenue += row.c.totalRevenue;
    totals.totalGMV += row.c.totalGMV;
    totals.totalWarehouse += row.c.totalWarehouse;
    totals.totalMgmt += row.c.totalMgmt;
    totals.tax += row.c.tax;
    totals.vatPart += row.c.vatPart;
    totals.usnPart += row.c.usnPart;
    totals.profitTaxPart += row.c.profitTaxPart;
    totals.totalInputVAT += row.c.totalInputVAT;
    totals.totalOutputVAT += row.c.totalOutputVAT;
    totals.netProfit += row.c.netProfit;
    totals.bookNetProfit += row.c.bookNetProfit;
    totals.profitBeforeTax += row.c.profitBeforeTax;
  }

  totals.operatingNetProfit = totals.netProfit;
  totals.operatingBookNetProfit = totals.bookNetProfit;
  totals.operatingCostBasis = totals.totalInvestment;
  totals.operatingProfitMargin = totals.totalGMV > 0 ? totals.operatingNetProfit / totals.totalGMV : 0;
  totals.operatingRoi = totals.totalInvestment > 0 ? totals.operatingNetProfit / totals.totalInvestment : 0;
  totals.netProfit -= params.oneTimeCosts;
  totals.bookNetProfit -= params.oneTimeCosts;
  totals.totalCostBasis = totals.totalInvestment + params.oneTimeCosts;
  totals.profitMargin = totals.totalGMV > 0 ? totals.netProfit / totals.totalGMV : 0;
  totals.roi = totals.totalCostBasis > 0 ? totals.netProfit / totals.totalCostBasis : 0;
  totals.netProfitCNY = totals.netProfit / params.exchangeRate;
  totals.operatingNetProfitCNY = totals.operatingNetProfit / params.exchangeRate;
  return totals;
}

export function calculateProjectInsights(data) {
  const normalized = normalizeProjectData(data);
  const calcs = normalized.products.map((product) => ({ ...product, c: calcProduct(product, normalized.params) }));
  const totals = calculateTotals(calcs, normalized.params);
  const projection = calcProjection(
    normalized.products,
    normalized.params,
    normalized.projection,
    normalized.scheduleStore,
    normalized.priceScheduleStore,
    normalized.restockStore,
    normalized.withdrawalStore,
  );

  return {
    ...normalized,
    calcs,
    totals,
    projectionResult: projection,
  };
}
