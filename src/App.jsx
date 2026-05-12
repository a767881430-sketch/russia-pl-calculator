import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Plus, Trash2, Save, Info, ChevronDown, ChevronRight, RotateCcw, FileDown, AlertCircle, Sparkles, Globe } from "lucide-react";
import { createT, createCurrencyFormatter, useLiveRate, LANG_OPTIONS } from "./i18n.js";

// ============================================================
// 字体 & 主题
// ============================================================
const FontStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    .font-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
    .font-body { font-family: 'Geist', system-ui, sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; }
    .grain { background-image: radial-gradient(rgba(31,27,22,0.025) 1px, transparent 1px); background-size: 3px 3px; }
    .ledger-row:hover { background-color: rgba(184, 134, 11, 0.05); }
    .number-pill { font-variant-numeric: tabular-nums; }
    input:focus, select:focus { outline: none; box-shadow: 0 0 0 2px rgba(92,26,27,0.15); }
    input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input[type="number"] { -moz-appearance: textfield; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    .anim-in { animation: fadeUp 0.25s ease-out; }
    .schedule-cell input { width: 100%; text-align: right; padding: 4px 6px; background: transparent; border: 1px solid transparent; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #1F1B16; }
    .schedule-cell input:hover { border-color: rgba(184,134,11,0.3); background: rgba(255,255,255,0.5); }
    .schedule-cell input:focus { border-color: #5C1A1B; background: white; }
  `}</style>
);

const COLORS = {
  cream: "#FAF7F2", paper: "#F2EDE3", ink: "#1F1B16", inkSoft: "#5C544A",
  oxblood: "#5C1A1B", oxbloodSoft: "#7A2A2C", gold: "#B8860B", goldSoft: "#D4A93A",
  emerald: "#1F4F2E", emeraldSoft: "#2D7144", crimson: "#A4193D", line: "#D9CFB8",
};

// ============================================================
// 2026 俄罗斯税制
// ============================================================
const TAX_SCHEMES = {
  usn_6:        { labelKey: "taxUsn6Label", short: "USN 6%",     descKey: "taxUsn6Desc" },
  usn_15:       { labelKey: "taxUsn15Label", short: "USN 15%",    descKey: "taxUsn15Desc" },
  usn_6_vat5:   { labelKey: "taxUsn6v5Label", short: "USN 6%+VAT 5%", descKey: "taxUsn6v5Desc" },
  usn_6_vat7:   { labelKey: "taxUsn6v7Label", short: "USN 6%+VAT 7%", descKey: "taxUsn6v7Desc" },
  usn_15_vat5:  { labelKey: "taxUsn15v5Label", short: "USN 15%+VAT 5%", descKey: "taxUsn15v5Desc" },
  usn_15_vat7:  { labelKey: "taxUsn15v7Label", short: "USN 15%+VAT 7%", descKey: "taxUsn15v7Desc" },
  osn:          { labelKey: "taxOsnLabel", short: "OSN",        descKey: "taxOsnDesc" },
  custom:       { labelKey: "taxCustomLabel", short: "Custom",   descKey: "taxCustomDesc" },
};

const DEFAULT_PARAMS = {
  exchangeRate: 12.0, usdRate: 95, damageRate: 0.03, shippingPerUnit: 100, labelingPerUnit: 0,
  grayShipPrice: 0, whiteShipPrice: 0,  // ¥/kg 和 ¥/m³，用户自行输入
  taxScheme: "usn_15", vatRate: 0.22, profitTaxRate: 0.25, customTaxRate: 0.15,
  incomeBasis: "payout", oneTimeCosts: 0,
};

// 计算单件运费（₽），支持三种模式
const calcShipping = (product, params) => {
  const mode = product.shippingMode || "manual";
  if (mode === "gray" && (product.weightKg || 0) > 0 && params.grayShipPrice > 0) {
    return (product.weightKg || 0) * params.grayShipPrice * params.exchangeRate;
  } else if (mode === "white" && (product.volL || 0) > 0 && (product.volW || 0) > 0 && (product.volH || 0) > 0 && params.whiteShipPrice > 0) {
    const volM3 = (product.volL * product.volW * product.volH) / 1e6;
    return volM3 * params.whiteShipPrice * params.exchangeRate;
  }
  return params.shippingPerUnit; // 手动模式：用全局固定运费
};

// 灰关模式下商品是否有进项VAT发票
const hasImportVATInvoice = (product) => {
  return (product.shippingMode || "manual") !== "gray";
};

const DEFAULT_PROJECTION = {
  monthsHorizon: 8, partnerSharePct: 50, monthlyFixedCost: 0,
  autoVATEscalation: true,    // 自动按累计营收触发VAT
  priorYearRevenue: 0,        // 进入本预测期前的累计营收（如已经卖了一段时间）
};

// 38 SKU 样例
const SAMPLE_PRODUCTS = [
  { id: "A1300400", priceCNY: 17.65, declaredCNY: 17.65, qty: 30, weight: 0.38, list: 1249, platformFee: 652, warehouse: 99, mgmt: 36 },
  { id: "A1303300", priceCNY: 20.26, declaredCNY: 20.26, qty: 30, weight: 0.59, list: 1399, platformFee: 795, warehouse: 102, mgmt: 39 },
  { id: "A1310500", priceCNY: 9.00, declaredCNY: 9.00, qty: 60, weight: 0.30, list: 1099, platformFee: 636, warehouse: 99, mgmt: 28 },
  { id: "A1330900", priceCNY: 6.00, declaredCNY: 6.00, qty: 72, weight: 0.16, list: 849, platformFee: 424, warehouse: 102, mgmt: 21 },
  { id: "A1341400", priceCNY: 14.00, declaredCNY: 14.00, qty: 40, weight: 0.16, list: 1249, platformFee: 640, warehouse: 101, mgmt: 34 },
  { id: "A1341700", priceCNY: 24.00, declaredCNY: 24.00, qty: 46, weight: 0.52, list: 1599, platformFee: 886, warehouse: 98, mgmt: 45 },
  { id: "A1346800", priceCNY: 13.00, declaredCNY: 13.00, qty: 156, weight: 0.39, list: 1299, platformFee: 752, warehouse: 99, mgmt: 34 },
  { id: "A1347000", priceCNY: 6.00, declaredCNY: 6.00, qty: 180, weight: 0.29, list: 999, platformFee: 548, warehouse: 102, mgmt: 25 },
  { id: "A1347100", priceCNY: 7.00, declaredCNY: 7.00, qty: 80, weight: 0.37, list: 899, platformFee: 488, warehouse: 102, mgmt: 23 },
  { id: "A1347600", priceCNY: 18.00, declaredCNY: 18.00, qty: 312, weight: 0.44, list: 1399, platformFee: 812, warehouse: 100, mgmt: 39 },
  { id: "A1347800", priceCNY: 13.00, declaredCNY: 13.00, qty: 324, weight: 0.34, list: 1299, platformFee: 756, warehouse: 99, mgmt: 35 },
  { id: "A1348200", priceCNY: 12.00, declaredCNY: 12.00, qty: 144, weight: 0.34, list: 1249, platformFee: 756, warehouse: 102, mgmt: 35 },
  { id: "A1349300", priceCNY: 10.00, declaredCNY: 10.00, qty: 64, weight: 0.42, list: 1049, platformFee: 544, warehouse: 99, mgmt: 27 },
  { id: "A1349400", priceCNY: 11.00, declaredCNY: 11.00, qty: 60, weight: 0.45, list: 1049, platformFee: 596, warehouse: 100, mgmt: 28 },
  { id: "P10070122-DJ", priceCNY: 11.00, declaredCNY: 11.00, qty: 204, weight: 0.36, list: 1149, platformFee: 644, warehouse: 100, mgmt: 32 },
  { id: "P11050014-DJ", priceCNY: 12.00, declaredCNY: 12.00, qty: 72, weight: 0.30, list: 1099, platformFee: 608, warehouse: 99, mgmt: 32 },
  { id: "P11010059", priceCNY: 7.00, declaredCNY: 7.00, qty: 276, weight: 0.31, list: 1039, platformFee: 584, warehouse: 99, mgmt: 30 },
  { id: "A1311900", priceCNY: 8.00, declaredCNY: 8.00, qty: 120, weight: 0.38, list: 989, platformFee: 556, warehouse: 100, mgmt: 25 },
  { id: "A1312400", priceCNY: 10.00, declaredCNY: 10.00, qty: 144, weight: 0.31, list: 1049, platformFee: 580, warehouse: 100, mgmt: 27 },
  { id: "P11050175", priceCNY: 9.00, declaredCNY: 9.00, qty: 192, weight: 0.41, list: 999, platformFee: 520, warehouse: 99, mgmt: 25 },
  { id: "P11050176", priceCNY: 6.00, declaredCNY: 6.00, qty: 288, weight: 0.22, list: 849, platformFee: 424, warehouse: 98, mgmt: 21 },
  { id: "P11090149", priceCNY: 11.00, declaredCNY: 11.00, qty: 180, weight: 0.49, list: 1099, platformFee: 652, warehouse: 101, mgmt: 30 },
  { id: "A1337900-02", priceCNY: 25.00, declaredCNY: 25.00, qty: 90, weight: 0.21, list: 1499, platformFee: 772, warehouse: 99, mgmt: 42 },
  { id: "A1337900-03", priceCNY: 23.00, declaredCNY: 23.00, qty: 90, weight: 0.21, list: 1399, platformFee: 751, warehouse: 99, mgmt: 40 },
  { id: "A1337902-01-KD-B", priceCNY: 19.00, declaredCNY: 19.00, qty: 128, weight: 0.19, list: 1099, platformFee: 526, warehouse: 97, mgmt: 30 },
  { id: "A1338100", priceCNY: 30.00, declaredCNY: 30.00, qty: 40, weight: 0.22, list: 1629, platformFee: 862, warehouse: 100, mgmt: 46 },
  { id: "A1338301", priceCNY: 32.00, declaredCNY: 32.00, qty: 40, weight: 0.25, list: 1569, platformFee: 802, warehouse: 99, mgmt: 44 },
  { id: "A1338302", priceCNY: 31.00, declaredCNY: 31.00, qty: 48, weight: 0.24, list: 1599, platformFee: 814, warehouse: 99, mgmt: 45 },
  { id: "A1342200", priceCNY: 24.00, declaredCNY: 24.00, qty: 60, weight: 0.20, list: 1379, platformFee: 726, warehouse: 99, mgmt: 39 },
  { id: "P31234-01", priceCNY: 16.00, declaredCNY: 16.00, qty: 72, weight: 0.12, list: 1200, platformFee: 652, warehouse: 98, mgmt: 36 },
  { id: "A1331400", priceCNY: 5.00, declaredCNY: 5.00, qty: 280, weight: 0.90, list: 797, platformFee: 406, warehouse: 98, mgmt: 21 },
  { id: "A1347700", priceCNY: 9.00, declaredCNY: 9.00, qty: 216, weight: 0.17, list: 799, platformFee: 370, warehouse: 97, mgmt: 21 },
  { id: "A1348300", priceCNY: 6.00, declaredCNY: 6.00, qty: 364, weight: 0.11, list: 759, platformFee: 354, warehouse: 96, mgmt: 20 },
  { id: "A1331500", priceCNY: 6.00, declaredCNY: 6.00, qty: 48, weight: 0.06, list: 692, platformFee: 311, warehouse: 96, mgmt: 18 },
  { id: "A1350500", priceCNY: 10.00, declaredCNY: 10.00, qty: 182, weight: 0.17, list: 756, platformFee: 335, warehouse: 97, mgmt: 20 },
  { id: "A1352000", priceCNY: 36.00, declaredCNY: 36.00, qty: 12, weight: 1.61, list: 2299, platformFee: 1401, warehouse: 110, mgmt: 66 },
  { id: "A1352100", priceCNY: 47.00, declaredCNY: 47.00, qty: 9, weight: 2.09, list: 2499, platformFee: 1443, warehouse: 109, mgmt: 72 },
  { id: "A1338200", priceCNY: 20.00, declaredCNY: 20.00, qty: 24, weight: 0.76, list: 1890, platformFee: 1223, warehouse: 108, mgmt: 54 },
];

// ============================================================
// 格式化 — 现在从 i18n.js 的 createCurrencyFormatter 获取
// 保留兼容函数供内部计算用
// ============================================================
const fmtRub = (v, digits = 0) => "₽ " + (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const fmtRubShort = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return "₽" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return "₽" + (n / 1e3).toFixed(0) + "K";
  return "₽" + n.toFixed(0);
};
const fmtCny = (v) => "¥ " + (Number(v) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v) => ((Number(v) || 0) * 100).toFixed(1) + "%";
const fmtCnyShort = (v) => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return "¥" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e4) return "¥" + (n / 1e4).toFixed(1) + "万";
  return "¥" + n.toFixed(0);
};

// ============================================================
// 单品计算
// ============================================================
const calcProduct = (p, params) => {
  const declaredCNY = (p.declaredCNY ?? p.priceCNY) || 0;
  const priceRUB = (p.priceCNY || 0) * params.exchangeRate;
  const declaredRUB = declaredCNY * params.exchangeRate;
  const shipPerUnit = calcShipping(p, params);
  const unitCost = priceRUB + shipPerUnit + params.labelingPerUnit;
  const declaredUnitCost = declaredRUB + shipPerUnit + params.labelingPerUnit;
  const totalInvestment = unitCost * (p.qty || 0);
  const totalDeclaredCost = declaredUnitCost * (p.qty || 0);

  const unitPayout = (p.list || 0) - (p.platformFee || 0);
  const effectiveQty = (p.qty || 0) * (1 - params.damageRate);
  const totalRevenue = unitPayout * effectiveQty;
  const totalWarehouse = (p.warehouse || 0) * (p.qty || 0);
  const totalMgmt = (p.mgmt || 0) * (p.qty || 0);

  // 灰关无进项VAT发票，OSN下不可抵扣
  const canDeductVAT = params.taxScheme === "osn" && hasImportVATInvoice(p);
  const inputVATPerUnit = canDeductVAT ? declaredRUB * params.vatRate : 0;
  const totalInputVAT = inputVATPerUnit * (p.qty || 0);

  let outputVATRate = 0;
  if (params.taxScheme === "osn") outputVATRate = params.vatRate;
  else if (params.taxScheme === "usn_6_vat5" || params.taxScheme === "usn_15_vat5") outputVATRate = 0.05;
  else if (params.taxScheme === "usn_6_vat7" || params.taxScheme === "usn_15_vat7") outputVATRate = 0.07;
  const totalOutputVAT = (p.list || 0) * outputVATRate / (1 + outputVATRate) * effectiveQty;

  const incomeBase = params.incomeBasis === "list" ? (p.list || 0) * effectiveQty : totalRevenue;
  const expenses = totalInvestment + totalWarehouse + totalMgmt;
  const profitBeforeTax = totalRevenue - expenses;

  let tax = 0, vatPart = 0, usnPart = 0, profitTaxPart = 0;
  switch (params.taxScheme) {
    case "usn_6":
      tax = incomeBase * 0.06; usnPart = tax; break;
    case "usn_15": {
      const tProfit = Math.max(0, incomeBase - expenses);
      tax = Math.max(tProfit * 0.15, incomeBase * 0.01); usnPart = tax; break;
    }
    case "usn_6_vat5":
    case "usn_6_vat7": {
      vatPart = totalOutputVAT;
      const inv = incomeBase - vatPart;
      usnPart = inv * 0.06;
      tax = vatPart + usnPart; break;
    }
    case "usn_15_vat5":
    case "usn_15_vat7": {
      vatPart = totalOutputVAT;
      const inv = incomeBase - vatPart;
      const t = Math.max(0, inv - expenses);
      usnPart = Math.max(t * 0.15, inv * 0.01);
      tax = vatPart + usnPart; break;
    }
    case "osn": {
      vatPart = Math.max(0, totalOutputVAT - totalInputVAT);
      const inv = incomeBase - totalOutputVAT;
      const declaredExpenses = totalDeclaredCost + totalWarehouse + totalMgmt;
      profitTaxPart = Math.max(0, inv - declaredExpenses) * params.profitTaxRate;
      tax = vatPart + profitTaxPart; break;
    }
    case "custom":
      tax = Math.max(0, profitBeforeTax) * params.customTaxRate; break;
  }

  const netProfit = totalRevenue - expenses - tax;
  const bookNetProfit = totalRevenue - (totalDeclaredCost + totalWarehouse + totalMgmt) - tax;
  const totalGMV = (p.list || 0) * effectiveQty;
  const profitMargin = totalGMV > 0 ? netProfit / totalGMV : 0;
  const roi = totalInvestment > 0 ? netProfit / totalInvestment : 0;

  return {
    priceRUB, declaredRUB, unitCost, declaredUnitCost, totalInvestment, totalDeclaredCost,
    unitPayout, effectiveQty, totalRevenue, totalGMV, totalWarehouse, totalMgmt,
    totalInputVAT, totalOutputVAT, expenses, profitBeforeTax,
    tax, vatPart, usnPart, profitTaxPart,
    netProfit, bookNetProfit, profitMargin, roi,
    unitNetProfit: (p.qty || 0) > 0 ? netProfit / p.qty : 0,
    netProfitCNY: netProfit / params.exchangeRate,
  };
};

// ============================================================
// 排期与现金流
// ============================================================
const distributeEvenly = (total, n) => {
  if (n <= 0 || total <= 0) return Array(Math.max(0, n)).fill(0);
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
};

const getSchedule = (id, qty, n, store) => {
  const s = store[id];
  return Array.isArray(s) && s.length === n ? s : distributeEvenly(qty, n);
};

// 获取补货排期：长度 = n+1 (M0..Mn)，M0=首批采购，M1+=补货数
const getRestockSchedule = (id, qty, n, restockStore) => {
  const s = restockStore[id];
  if (Array.isArray(s) && s.length === n + 1) return s;
  return [qty, ...Array(n).fill(0)]; // 默认：M0=全量，后续无补货
};

// 阶梯VAT阈值（2026 联邦法 №425-FZ）
// 累计年营收 ≤ 20M ₽: USN无VAT
// 20M-250M ₽: 触发VAT，可选5%(无进项抵扣)
// 250M-450M ₽: 7%(无进项抵扣)
// 450M+ : 强制 OSN
const VAT_TIER = (cumRevenue) => {
  if (cumRevenue <= 20_000_000) return { rate: 0, labelKey: "vatLabelNoVat", tier: 0 };
  if (cumRevenue <= 250_000_000) return { rate: 0.05, labelKey: "vatLabelVat5", tier: 1 };
  if (cumRevenue <= 450_000_000) return { rate: 0.07, labelKey: "vatLabelVat7", tier: 2 };
  return { rate: 0.22, labelKey: "vatLabelOsn22", tier: 3 };
};

// 获取某月的售价/平台费，未设置则用默认值
const getPriceForMonth = (productId, monthIdx, defaultVal, priceStore) => {
  const entry = priceStore?.[productId];
  if (!entry?.list) return defaultVal;
  const v = entry.list[monthIdx];
  return (v && v > 0) ? v : defaultVal;
};
const getFeeForMonth = (productId, monthIdx, defaultVal, priceStore) => {
  const entry = priceStore?.[productId];
  if (!entry?.fee) return defaultVal;
  const v = entry.fee[monthIdx];
  return (v && v > 0) ? v : defaultVal;
};

const calcProjection = (products, params, projection, store, priceStore = {}, restockStore = {}, withdrawalStore = {}) => {
  const { monthsHorizon, partnerSharePct, monthlyFixedCost, autoVATEscalation, priorYearRevenue } = projection;
  const months = [];

  // 计算每个产品的单位成本（供补货成本计算用）
  const productUnitCosts = {};
  for (const p of products) {
    const shipPerUnit = calcShipping(p, params);
    productUnitCosts[p.id] = (p.priceCNY || 0) * params.exchangeRate + shipPerUnit + params.labelingPerUnit;
  }

  // M0 首批采购：用 restockStore 的 M0 数量
  let totalActual = 0, totalDeclared = 0, totalImportVAT = 0;
  for (const p of products) {
    const declaredCNY = (p.declaredCNY ?? p.priceCNY) || 0;
    const shipPerUnit = calcShipping(p, params);
    const actualUnit = productUnitCosts[p.id];
    const declaredUnit = declaredCNY * params.exchangeRate + shipPerUnit + params.labelingPerUnit;
    const rSched = getRestockSchedule(p.id, p.qty || 0, monthsHorizon, restockStore);
    const m0Qty = rSched[0]; // 首批采购数量
    totalActual += actualUnit * m0Qty;
    totalDeclared += declaredUnit * m0Qty;
    if (params.taxScheme === "osn" && hasImportVATInvoice(p)) {
      totalImportVAT += declaredCNY * params.exchangeRate * m0Qty * params.vatRate;
    }
  }
  const initialOutflow = totalActual + (params.oneTimeCosts || 0) + totalImportVAT;
  let cumCash = -initialOutflow;
  let inputVATCredit = totalImportVAT;

  // 初始化库存 = M0 采购数量
  const stockByProduct = {};
  let totalStockEnd = 0;
  for (const p of products) {
    const rSched = getRestockSchedule(p.id, p.qty || 0, monthsHorizon, restockStore);
    stockByProduct[p.id] = rSched[0];
    totalStockEnd += rSched[0];
  }

  months.push({
    monthIdx: 0, label: "M0", revenue: 0, cogs: 0, expenses: 0, fixedCost: 0,
    grossProfit: 0, tax: 0, vatRemit: 0, netProfit: -initialOutflow,
    partnerPayout: 0, cashFlow: -initialOutflow, cumCash,
    soldQty: 0, isInitial: true, importVAT: totalImportVAT,
    effectiveScheme: params.taxScheme, vatTierKey: null, cumRevenue: priorYearRevenue || 0,
    restockQty: totalStockEnd, restockCost: totalActual, stockEnd: totalStockEnd, stockWarning: false,
  });

  // 跨月累计营收（动态 VAT 触发用）
  let cumRevenue = priorYearRevenue || 0;
  let vatTriggered = false;
  let vatTriggerMonth = null;
  let triggeredRate = 0; // 一旦触发就锁定到该年度结束

  for (let m = 1; m <= monthsHorizon; m++) {
    let revenue = 0, cogs = 0, declaredCogs = 0, expenses = 0;
    let soldQty = 0, listSum = 0;
    let monthRestockQty = 0, monthRestockCost = 0;

    for (const p of products) {
      const declaredCNY = (p.declaredCNY ?? p.priceCNY) || 0;
      const sched = getSchedule(p.id, p.qty || 0, monthsHorizon, store);
      const q = sched[m - 1] || 0;
      soldQty += q;
      const unitCost = productUnitCosts[p.id];
      const shipPerUnit = calcShipping(p, params);
      const declaredUnit = declaredCNY * params.exchangeRate + shipPerUnit + params.labelingPerUnit;
      // 按月取售价/平台费
      const monthList = getPriceForMonth(p.id, m - 1, p.list || 0, priceStore);
      const monthFee = getFeeForMonth(p.id, m - 1, p.platformFee || 0, priceStore);
      revenue += q * (monthList - monthFee);
      cogs += q * unitCost;
      declaredCogs += q * declaredUnit;
      expenses += q * ((p.warehouse || 0) + (p.mgmt || 0));
      listSum += q * monthList;

      // 补货：读取该月补货数量，更新库存
      const rSched = getRestockSchedule(p.id, p.qty || 0, monthsHorizon, restockStore);
      const rQty = rSched[m] || 0; // rSched[0]=M0首批, rSched[m]=Mm补货
      monthRestockQty += rQty;
      monthRestockCost += rQty * unitCost;
      stockByProduct[p.id] = (stockByProduct[p.id] || 0) + rQty - q;
    }

    // 汇总期末库存
    let stockEnd = 0, stockWarning = false;
    for (const p of products) {
      stockEnd += stockByProduct[p.id] || 0;
      if ((stockByProduct[p.id] || 0) < 0) stockWarning = true;
    }

    cumRevenue += revenue;
    const fixedCost = monthlyFixedCost || 0;
    const grossProfit = revenue - cogs - expenses - fixedCost;
    const incomeBase = params.incomeBasis === "list" ? listSum : revenue;

    // 决定本月用什么税制
    let effectiveScheme = params.taxScheme;
    let vatTierKey = null;

    // 仅当用户选了USN且开启了"自动跨档"，才动态升级
    if (autoVATEscalation && (params.taxScheme === "usn_6" || params.taxScheme === "usn_15")) {
      const tier = VAT_TIER(cumRevenue);
      vatTierKey = tier.labelKey;
      if (tier.tier > 0) {
        if (!vatTriggered) {
          vatTriggered = true;
          vatTriggerMonth = m;
          triggeredRate = tier.rate;
        } else if (tier.rate > triggeredRate) {
          // 当年度内继续上跨 (e.g. 5% → 7%)
          triggeredRate = tier.rate;
        }
        // 选哪一档：根据原始USN类型匹配对应方案
        if (triggeredRate === 0.05) effectiveScheme = params.taxScheme === "usn_6" ? "usn_6_vat5" : "usn_15_vat5";
        else if (triggeredRate === 0.07) effectiveScheme = params.taxScheme === "usn_6" ? "usn_6_vat7" : "usn_15_vat7";
        else if (triggeredRate >= 0.22) effectiveScheme = "osn";
      }
    } else {
      // 用户手动选了带VAT的方案：显示该方案档位
      if (params.taxScheme === "usn_6_vat5" || params.taxScheme === "usn_15_vat5") vatTierKey = "vatLabelFixed5";
      else if (params.taxScheme === "usn_6_vat7" || params.taxScheme === "usn_15_vat7") vatTierKey = "vatLabelFixed7";
      else if (params.taxScheme === "osn") vatTierKey = "vatLabelFixedOsn";
      else vatTierKey = "vatLabelNoVat";
    }

    // 计算本月销项VAT率
    let outputVATRate = 0;
    if (effectiveScheme === "osn") outputVATRate = params.vatRate;
    else if (effectiveScheme === "usn_6_vat5" || effectiveScheme === "usn_15_vat5") outputVATRate = 0.05;
    else if (effectiveScheme === "usn_6_vat7" || effectiveScheme === "usn_15_vat7") outputVATRate = 0.07;
    const monthlyOutputVAT = listSum * outputVATRate / (1 + outputVATRate);

    let tax = 0, vatRemit = 0;
    switch (effectiveScheme) {
      case "usn_6": tax = incomeBase * 0.06; break;
      case "usn_15": {
        const t = Math.max(0, incomeBase - cogs - expenses - fixedCost);
        tax = Math.max(t * 0.15, incomeBase * 0.01); break;
      }
      case "usn_6_vat5":
      case "usn_6_vat7": {
        vatRemit = monthlyOutputVAT;
        const inv = incomeBase - vatRemit;
        tax = vatRemit + inv * 0.06; break;
      }
      case "usn_15_vat5":
      case "usn_15_vat7": {
        vatRemit = monthlyOutputVAT;
        const inv = incomeBase - vatRemit;
        const t = Math.max(0, inv - cogs - expenses - fixedCost);
        tax = vatRemit + Math.max(t * 0.15, inv * 0.01); break;
      }
      case "osn": {
        const used = Math.min(inputVATCredit, monthlyOutputVAT);
        vatRemit = monthlyOutputVAT - used;
        inputVATCredit -= used;
        const inv = incomeBase - monthlyOutputVAT;
        const t = Math.max(0, inv - declaredCogs - expenses - fixedCost);
        tax = vatRemit + t * params.profitTaxRate; break;
      }
      case "custom": tax = Math.max(0, grossProfit) * params.customTaxRate; break;
    }

    const netProfit = grossProfit - tax;
    // 利润分配：按用户指定的每月提取金额，再按分润比例分给合伙人
    const withdrawalAmount = (withdrawalStore?.amounts?.[m - 1]) || 0;
    const distributed = Math.min(withdrawalAmount, Math.max(0, netProfit)); // 不能超过当月净利
    const partnerPayout = distributed * (partnerSharePct / 100);
    // 现金流 = 营收 - 费用 - 税 - 合伙人 - 补货支出
    const cashFlow = revenue - expenses - fixedCost - tax - partnerPayout - monthRestockCost;
    cumCash += cashFlow;

    months.push({
      monthIdx: m, label: `M${m}`, revenue, cogs, expenses, fixedCost, grossProfit,
      tax, vatRemit, netProfit, partnerPayout, cashFlow, cumCash, soldQty, isInitial: false,
      effectiveScheme, vatTierKey, cumRevenue, vatRate: params.vatRate,
      restockQty: monthRestockQty, restockCost: monthRestockCost, stockEnd, stockWarning,
    });
  }

  const beIdx = months.findIndex((mm, i) => i > 0 && mm.cumCash >= 0);
  return {
    months, initialOutflow,
    breakEvenMonth: beIdx > 0 ? beIdx : null,
    maxDrawdown: Math.min(...months.map(mm => mm.cumCash)),
    finalCash: months[months.length - 1].cumCash,
    totalRevenue: months.reduce((a, b) => a + b.revenue, 0),
    totalNetProfit: months.filter(m => !m.isInitial).reduce((a, b) => a + b.netProfit, 0),
    totalTax: months.reduce((a, b) => a + b.tax, 0),
    totalVAT: months.reduce((a, b) => a + (b.vatRemit || 0), 0),
    totalPartnerPayout: months.reduce((a, b) => a + b.partnerPayout, 0),
    totalImportVAT, leftoverInputVAT: inputVATCredit,
    vatTriggerMonth, vatTriggered,
    finalCumRevenue: months[months.length - 1].cumRevenue,
  };
};

// ============================================================
// 通用 UI
// ============================================================
const NumInput = ({ value, onChange, suffix, prefix, step = 1, className = "", ...rest }) => (
  <div className={`flex items-stretch border bg-white/60 input-glow rounded-sm ${className}`} style={{ borderColor: COLORS.line }}>
    {prefix && <div className="px-2 flex items-center text-xs font-mono" style={{ color: COLORS.inkSoft, background: COLORS.paper }}>{prefix}</div>}
    <input type="number" step={step} value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className="flex-1 px-2 py-2.5 sm:py-1.5 bg-transparent font-mono text-sm w-full"
      style={{ color: COLORS.ink, minWidth: 0 }} {...rest} />
    {suffix && <div className="px-2 flex items-center text-xs font-mono" style={{ color: COLORS.inkSoft, background: COLORS.paper }}>{suffix}</div>}
  </div>
);

// 防抖文本输入：使用本地 state，仅在 blur / Enter 时提交，避免每次击键触发父级重渲染
const DebouncedTextInput = ({ value, onCommit, className = "", style = {}, ...rest }) => {
  const [local, setLocal] = useState(value || "");
  const committed = React.useRef(value);
  useEffect(() => { if (value !== committed.current) { setLocal(value || ""); committed.current = value; } }, [value]);
  const doCommit = () => { if (local !== committed.current) { committed.current = local; onCommit(local); } };
  return (
    <input type="text" value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={doCommit}
      onKeyDown={(e) => { if (e.key === "Enter") { doCommit(); e.target.blur(); } }}
      className={className} style={style} {...rest} />
  );
};

const Tag = ({ children, color = COLORS.gold, bg }) => (
  <span className="inline-block px-2 py-0.5 text-[10px] tracking-widest uppercase font-body font-semibold tag-pill rounded-sm"
    style={{ color, background: bg || color + "1A", border: `1px solid ${color}40` }}>
    {children}
  </span>
);

const Card = ({ title, kicker, children, className = "" }) => (
  <div className={`glass-card card-hover rounded-sm ${className}`}>
    {title && (
      <div className="px-4 py-3 border-b" style={{ borderColor: COLORS.line }}>
        {kicker && <div className="text-[10px] tracking-[0.2em] uppercase font-body" style={{ color: COLORS.gold }}>{kicker}</div>}
        <div className="font-display text-lg font-semibold" style={{ color: COLORS.ink }}>{title}</div>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

const Metric = ({ label, value, sub, color, big }) => (
  <div className="flex flex-col gap-1 count-in">
    <div className="text-[10px] tracking-[0.18em] uppercase" style={{ color: COLORS.inkSoft }}>{label}</div>
    <div className={`font-display ${big ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-bold number-pill metric-value`} style={{ color: color || COLORS.ink }}>{value}</div>
    {sub && <div className="text-[10px] sm:text-xs font-mono break-all" style={{ color: COLORS.inkSoft }}>{sub}</div>}
  </div>
);

// ============================================================
// 密码登录门
// ============================================================
const ACCESS_PASSWORD = "xhk2026";  // ← 修改此处设置你的密码

const LoginGate = ({ children, lang, setLang }) => {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem("ru_calc_auth") === "1");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const t = createT(lang);

  if (authed) return children;

  const handleLogin = (e) => {
    e.preventDefault();
    if (pwd === ACCESS_PASSWORD) {
      sessionStorage.setItem("ru_calc_auth", "1");
      setAuthed(true);
    } else {
      setError(t("loginError"));
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-body" style={{ background: COLORS.cream }}>
      <FontStyles />
      <div className={`glass-card p-8 sm:p-10 w-full max-w-sm mx-4 ${shake ? 'animate-shake' : ''}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 flex items-center justify-center rounded-sm" style={{ background: COLORS.oxblood, color: COLORS.cream }}>
            <span className="font-display text-xl font-bold">Р</span>
          </div>
          <div>
            <div className="text-[10px] tracking-[0.25em] uppercase" style={{ color: COLORS.gold }}>Cross-border P&L</div>
            <div className="font-display text-lg font-bold" style={{ color: COLORS.ink }}>{t("loginTitle")}</div>
          </div>
        </div>
        {/* Language switcher on login */}
        <div className="flex justify-center gap-1 mb-5">
          {LANG_OPTIONS.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); localStorage.setItem("ru_calc_lang", l.code); }}
              className="px-3 py-1.5 text-xs font-medium rounded-sm"
              style={{ background: lang === l.code ? COLORS.oxblood : "transparent", color: lang === l.code ? COLORS.cream : COLORS.inkSoft, border: `1px solid ${lang === l.code ? COLORS.oxblood : COLORS.line}` }}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
        <form onSubmit={handleLogin}>
          <label className="text-[10px] tracking-[0.18em] uppercase block mb-2" style={{ color: COLORS.inkSoft }}>{t("loginLabel")}</label>
          <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
            className="w-full px-3 py-3 border font-mono text-sm rounded-sm mb-1 input-glow"
            style={{ borderColor: COLORS.line, background: "white", color: COLORS.ink }}
            placeholder={t("loginPlaceholder")} autoFocus />
          {error && <div className="text-xs mt-1 mb-2" style={{ color: COLORS.crimson }}>{error}</div>}
          <button type="submit"
            className="btn-interact w-full mt-4 px-4 py-3 text-sm font-medium rounded-sm"
            style={{ background: COLORS.oxblood, color: COLORS.cream }}>
            {t("loginButton")}
          </button>
        </form>
        <div className="mt-4 text-center text-[10px]" style={{ color: COLORS.inkSoft }}>
          {t("loginFooter")}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 主组件
// ============================================================
export default function App() {
  const [lang, setLang] = useState(() => localStorage.getItem("ru_calc_lang") || "zh");
  return (
    <LoginGate lang={lang} setLang={setLang}>
      <AppContent lang={lang} setLang={setLang} />
    </LoginGate>
  );
}

function AppContent({ lang, setLang }) {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [scheduleStore, setScheduleStore] = useState({});
  const [priceScheduleStore, setPriceScheduleStore] = useState({});
  const [restockStore, setRestockStore] = useState({});
  const [withdrawalStore, setWithdrawalStore] = useState({ amounts: [] });
  const [projection, setProjection] = useState(DEFAULT_PROJECTION);
  const [tab, setTab] = useState("dashboard");
  const [expandedRow, setExpandedRow] = useState(null);
  const [storageStatus, setStorageStatus] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // --- i18n ---
  const t = useMemo(() => createT(lang), [lang]);
  const { liveRate, liveUsdRate, effectiveRate, effectiveUsdRate, rateSource, rateLoading, fetchRate, setRateSource } = useLiveRate(params.exchangeRate, params.usdRate);
  // --- locale-aware currency formatter (¥ for zh, $ for en, ₽ for ru) ---
  const fmt = useMemo(() => createCurrencyFormatter(lang, effectiveRate, effectiveUsdRate), [lang, effectiveRate, effectiveUsdRate]);

  // 实时汇率更新到 params
  useEffect(() => {
    if (rateSource === "live") {
      setParams(p => {
        const next = { ...p };
        if (liveRate && Math.abs(liveRate - p.exchangeRate) > 0.01) next.exchangeRate = liveRate;
        if (liveUsdRate && Math.abs(liveUsdRate - p.usdRate) > 0.01) next.usdRate = liveUsdRate;
        return next;
      });
    }
  }, [liveRate, liveUsdRate, rateSource]);

  // --- 启动时从 localStorage 加载 ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ru_calc_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.params) setParams({ ...DEFAULT_PARAMS, ...parsed.params });
        if (Array.isArray(parsed.products)) setProducts(parsed.products);
        if (parsed.scheduleStore) setScheduleStore(parsed.scheduleStore);
        if (parsed.priceScheduleStore) setPriceScheduleStore(parsed.priceScheduleStore);
        if (parsed.restockStore) setRestockStore(parsed.restockStore);
        if (parsed.withdrawalStore) setWithdrawalStore(parsed.withdrawalStore);
        if (parsed.projection) setProjection({ ...DEFAULT_PROJECTION, ...parsed.projection });
        setStorageStatus(t("loadedLocal"));
        setTimeout(() => setStorageStatus(""), 2200);
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  // --- 数据变化时自动保存到 localStorage ---
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem("ru_calc_v2", JSON.stringify({ params, products, scheduleStore, priceScheduleStore, restockStore, withdrawalStore, projection }));
    } catch (e) {}
  }, [params, products, scheduleStore, priceScheduleStore, restockStore, withdrawalStore, projection, loaded]);

  const saveToCloud = () => {
    setStorageBusy(true);
    try {
      localStorage.setItem("ru_calc_v2", JSON.stringify({ params, products, scheduleStore, priceScheduleStore, restockStore, withdrawalStore, projection }));
      setStorageStatus(t("saved"));
    } catch (e) { setStorageStatus(t("saveFail")); }
    finally { setStorageBusy(false); setTimeout(() => setStorageStatus(""), 2200); }
  };

  const calcs = useMemo(() => products.map(p => ({ ...p, c: calcProduct(p, params) })), [products, params]);

  const totals = useMemo(() => {
    const a = { qty: 0, totalInvestment: 0, totalDeclaredCost: 0, totalRevenue: 0, totalGMV: 0, totalWarehouse: 0, totalMgmt: 0,
      tax: 0, vatPart: 0, usnPart: 0, profitTaxPart: 0, totalInputVAT: 0, totalOutputVAT: 0,
      netProfit: 0, bookNetProfit: 0, profitBeforeTax: 0 };
    for (const r of calcs) {
      a.qty += r.qty || 0;
      a.totalInvestment += r.c.totalInvestment;
      a.totalDeclaredCost += r.c.totalDeclaredCost;
      a.totalRevenue += r.c.totalRevenue;
      a.totalGMV += r.c.totalGMV;
      a.totalWarehouse += r.c.totalWarehouse;
      a.totalMgmt += r.c.totalMgmt;
      a.tax += r.c.tax; a.vatPart += r.c.vatPart; a.usnPart += r.c.usnPart; a.profitTaxPart += r.c.profitTaxPart;
      a.totalInputVAT += r.c.totalInputVAT; a.totalOutputVAT += r.c.totalOutputVAT;
      a.netProfit += r.c.netProfit; a.bookNetProfit += r.c.bookNetProfit; a.profitBeforeTax += r.c.profitBeforeTax;
    }
    a.netProfit -= params.oneTimeCosts;
    a.bookNetProfit -= params.oneTimeCosts;
    a.totalCostBasis = a.totalInvestment + params.oneTimeCosts;
    a.profitMargin = a.totalGMV > 0 ? a.netProfit / a.totalGMV : 0;
    a.roi = a.totalCostBasis > 0 ? a.netProfit / a.totalCostBasis : 0;
    a.netProfitCNY = a.netProfit / params.exchangeRate;
    return a;
  }, [calcs, params.oneTimeCosts, params.exchangeRate]);

  const proj = useMemo(() => calcProjection(products, params, projection, scheduleStore, priceScheduleStore, restockStore, withdrawalStore),
    [products, params, projection, scheduleStore, priceScheduleStore, restockStore, withdrawalStore]);

  const updateProduct = (idx, field, val) => {
    const oldId = products[idx]?.id;
    setProducts(ps => ps.map((p, i) => i === idx ? { ...p, [field]: val } : p));
    if (field === "id" && oldId && oldId !== val) {
      if (scheduleStore[oldId]) setScheduleStore(s => { const n = { ...s }; n[val] = n[oldId]; delete n[oldId]; return n; });
      if (restockStore[oldId]) setRestockStore(s => { const n = { ...s }; n[val] = n[oldId]; delete n[oldId]; return n; });
    }
  };
  const addProduct = () => {
    let n = products.length + 1;
    let nextId = "NEW" + n.toString().padStart(3, "0");
    while (products.some(p => p.id === nextId)) { n++; nextId = "NEW" + n.toString().padStart(3, "0"); }
    setProducts(ps => [...ps, { id: nextId, priceCNY: 10, declaredCNY: 10, qty: 100, weight: 0.3, list: 1000, platformFee: 500, warehouse: 100, mgmt: 30 }]);
  };
  const deleteProduct = (idx) => {
    const id = products[idx]?.id;
    setProducts(ps => ps.filter((_, i) => i !== idx));
    if (id) {
      setScheduleStore(s => { const n = { ...s }; delete n[id]; return n; });
      setRestockStore(s => { const n = { ...s }; delete n[id]; return n; });
    }
    if (expandedRow === idx) setExpandedRow(null);
  };
  const clearAllProducts = () => {
    if (confirm(t("confirmClear"))) { setProducts([]); setScheduleStore({}); setRestockStore({}); setWithdrawalStore({ amounts: [] }); setExpandedRow(null); }
  };
  const resetSample = () => {
    if (confirm(t("confirmReset"))) {
      setProducts(SAMPLE_PRODUCTS); setParams(DEFAULT_PARAMS);
      setProjection(DEFAULT_PROJECTION); setScheduleStore({}); setRestockStore({}); setWithdrawalStore({ amounts: [] });
    }
  };

  const updateSchedule = (productId, monthIdx, val) => {
    setScheduleStore(s => {
      const arr = [...(s[productId] || distributeEvenly(products.find(p => p.id === productId)?.qty || 0, projection.monthsHorizon))];
      while (arr.length < projection.monthsHorizon) arr.push(0);
      arr[monthIdx] = Math.max(0, val);
      return { ...s, [productId]: arr };
    });
  };

  const updateRestock = (productId, monthIdx, val) => {
    setRestockStore(s => {
      const n = projection.monthsHorizon;
      const defaultQty = products.find(p => p.id === productId)?.qty || 0;
      const arr = [...(s[productId] || [defaultQty, ...Array(n).fill(0)])];
      while (arr.length < n + 1) arr.push(0);
      arr[monthIdx] = Math.max(0, val);
      return { ...s, [productId]: arr };
    });
  };

  const applyScheduleCurve = (curveType) => {
    if (curveType === "reset") { setScheduleStore({}); return; }
    const next = {};
    for (const p of products) {
      const total = p.qty || 0; const n = projection.monthsHorizon;
      let arr;
      if (curveType === "linear") arr = distributeEvenly(total, n);
      else if (curveType === "frontload") {
        const w = Array.from({ length: n }, (_, i) => Math.pow(0.78, i));
        const s = w.reduce((a, b) => a + b, 0);
        arr = w.map(x => Math.round(total * x / s));
        const diff = total - arr.reduce((a, b) => a + b, 0);
        arr[0] = Math.max(0, arr[0] + diff);
      } else if (curveType === "bell") {
        const mid = (n - 1) / 2; const sigma = n / 4;
        const w = Array.from({ length: n }, (_, i) => Math.exp(-Math.pow(i - mid, 2) / (2 * sigma * sigma)));
        const s = w.reduce((a, b) => a + b, 0);
        arr = w.map(x => Math.round(total * x / s));
        const diff = total - arr.reduce((a, b) => a + b, 0);
        arr[Math.floor(mid)] = Math.max(0, arr[Math.floor(mid)] + diff);
      }
      next[p.id] = arr;
    }
    setScheduleStore(next);
  };

  const exportCSV = () => {
    const headers = ["产品ID","实际¥","申报¥","数量","售价₽","平台费","仓费","管理费","总投资","总营收","进项VAT","销项VAT","税额","现金净利","账面净利","净利率","ROI"];
    const lines = [headers.join(",")];
    calcs.forEach(r => lines.push([
      r.id, r.priceCNY, r.declaredCNY ?? r.priceCNY, r.qty,
      r.list, r.platformFee, r.warehouse, r.mgmt,
      r.c.totalInvestment.toFixed(0), r.c.totalRevenue.toFixed(0),
      r.c.totalInputVAT.toFixed(0), r.c.totalOutputVAT.toFixed(0),
      r.c.tax.toFixed(0), r.c.netProfit.toFixed(0), r.c.bookNetProfit.toFixed(0),
      (r.c.profitMargin * 100).toFixed(1) + "%", (r.c.roi * 100).toFixed(1) + "%",
    ].join(",")));
    lines.push(["合计","","",totals.qty,"","","","",totals.totalInvestment.toFixed(0),
      totals.totalRevenue.toFixed(0), totals.totalInputVAT.toFixed(0), totals.totalOutputVAT.toFixed(0),
      totals.tax.toFixed(0), totals.netProfit.toFixed(0), totals.bookNetProfit.toFixed(0),
      (totals.profitMargin * 100).toFixed(1) + "%", (totals.roi * 100).toFixed(1) + "%"].join(","));
    lines.push(""); lines.push(["月度现金流"].join(","));
    lines.push(["月份","销售件数","营收","销货成本","其他费用","税","当月净利","合伙人","累计现金"].join(","));
    proj.months.forEach(m => lines.push([
      m.label, m.soldQty, m.revenue.toFixed(0), m.cogs.toFixed(0),
      (m.expenses + (m.fixedCost || 0)).toFixed(0), m.tax.toFixed(0),
      m.netProfit.toFixed(0), m.partnerPayout.toFixed(0), m.cumCash.toFixed(0),
    ].join(",")));

    const csvContent = "\ufeff" + lines.join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    a.download = `russia-pl-${new Date().toISOString().slice(0, 10)}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const exportHTML = async () => {
    const date = new Date().toISOString().slice(0, 10);
    const fR = (v, d = 0) => "₽ " + (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
    const fC = (v) => "¥ " + (Number(v) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fP = (v) => ((Number(v) || 0) * 100).toFixed(1) + "%";
    const scheme = TAX_SCHEMES[params.taxScheme]?.short || params.taxScheme;

    // Product rows
    const prodRows = calcs.map(r => {
      const c = r.c;
      return `<tr>
        <td class="mono">${r.id}</td>
        <td class="r mono">${(r.priceCNY || 0).toFixed(2)}</td>
        <td class="r mono">${r.qty || 0}</td>
        <td class="r mono">${(r.list || 0).toLocaleString("ru-RU")}</td>
        <td class="r mono">${(r.platformFee || 0).toLocaleString("ru-RU")}</td>
        <td class="r mono">${fR(c.totalInvestment)}</td>
        <td class="r mono">${fR(c.totalRevenue)}</td>
        <td class="r mono">${fR(c.tax)}</td>
        <td class="r mono ${c.netProfit >= 0 ? 'pos' : 'neg'}">${fR(c.netProfit)}</td>
        <td class="r mono ${c.roi >= 0.2 ? 'pos' : c.roi < 0 ? 'neg' : ''}">${fP(c.roi)}</td>
      </tr>`;
    }).join("\n");

    // Cash flow rows
    const cfRows = proj.months.map(m => {
      const cls = m.isInitial ? 'init-row' : '';
      const restockLabel = m.restockQty > 0 ? `+${m.restockQty}` : '—';
      const restockCostLabel = m.restockCost > 0 && !m.isInitial ? `<br><small style="color:#A4193D">-${fR(m.restockCost)}</small>` : '';
      const stockCls = m.stockWarning ? 'neg' : '';
      return `<tr class="${cls}">
        <td class="mono">${m.isInitial ? t("initialRow") : m.label}</td>
        <td class="r mono" style="color:${m.restockQty > 0 ? '#A4193D' : ''}">${restockLabel}${restockCostLabel}</td>
        <td class="r mono ${stockCls}">${m.stockEnd}${m.stockWarning ? ' ⚠' : ''}</td>
        <td class="r mono">${m.soldQty}</td>
        <td class="r mono">${m.isInitial ? '—' : fR(m.revenue)}</td>
        <td class="r mono">${m.isInitial ? fR(-proj.initialOutflow) : fR(m.cogs)}</td>
        <td class="r mono">${m.isInitial ? '—' : fR(m.expenses + (m.fixedCost || 0))}</td>
        <td class="r mono">${m.isInitial ? '—' : fR(m.tax)}</td>
        <td class="r mono ${m.netProfit >= 0 ? 'pos' : 'neg'}">${fR(m.netProfit)}</td>
        <td class="r mono ${m.cumCash >= 0 ? 'pos' : 'neg'}">${fR(m.cumCash)}</td>
        <td class="mono">${m.isInitial ? '—' : (m.vatTierKey ? t(m.vatTierKey, m.vatTierKey === "vatLabelFixedOsn" ? { rate: (m.vatRate*100).toFixed(0) } : {}) : '—')}</td>
      </tr>`;
    }).join("\n");

    // Simple SVG cash flow chart
    const cfData = proj.months.map(m => m.cumCash);
    const cfMin = Math.min(...cfData, 0);
    const cfMax = Math.max(...cfData, 1);
    const cfRange = cfMax - cfMin || 1;
    const svgW = 800, svgH = 280, pad = 50;
    const plotW = svgW - pad * 2, plotH = svgH - pad * 2;
    const zeroY = pad + plotH * (1 - (0 - cfMin) / cfRange);
    const points = cfData.map((v, i) => {
      const x = pad + (i / Math.max(cfData.length - 1, 1)) * plotW;
      const y = pad + plotH * (1 - (v - cfMin) / cfRange);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const dots = cfData.map((v, i) => {
      const x = pad + (i / Math.max(cfData.length - 1, 1)) * plotW;
      const y = pad + plotH * (1 - (v - cfMin) / cfRange);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#5C1A1B"/>`;
    }).join("\n");
    // Y-axis labels
    const yTicks = 5;
    const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
      const val = cfMin + (cfRange / yTicks) * i;
      const y = pad + plotH * (1 - i / yTicks);
      const label = Math.abs(val) >= 1e6 ? (val / 1e6).toFixed(1) + "M" : Math.abs(val) >= 1e3 ? (val / 1e3).toFixed(0) + "K" : val.toFixed(0);
      return `<text x="${pad - 8}" y="${y + 4}" text-anchor="end" fill="#5C544A" font-size="10" font-family="monospace">₽${label}</text>
              <line x1="${pad}" y1="${y}" x2="${svgW - pad}" y2="${y}" stroke="#D9CFB8" stroke-dasharray="3 3"/>`;
    }).join("\n");
    // X-axis labels
    const xLabels = cfData.map((_, i) => {
      const x = pad + (i / Math.max(cfData.length - 1, 1)) * plotW;
      return `<text x="${x}" y="${svgH - 10}" text-anchor="middle" fill="#5C544A" font-size="10" font-family="monospace">M${i}</text>`;
    }).join("\n");
    const beIdx = proj.breakEvenMonth;
    const beLine = beIdx ? (() => {
      const x = pad + (beIdx / Math.max(cfData.length - 1, 1)) * plotW;
      return `<line x1="${x}" y1="${pad}" x2="${x}" y2="${svgH - pad}" stroke="#2D7144" stroke-dasharray="5 3" stroke-width="1.5"/>
              <text x="${x}" y="${pad - 6}" text-anchor="middle" fill="#2D7144" font-size="10">${t("chartBreakEven")}</text>`;
    })() : '';

    const svgChart = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;max-width:${svgW}px;height:auto;">
      ${yLabels}
      ${xLabels}
      <line x1="${pad}" y1="${zeroY}" x2="${svgW - pad}" y2="${zeroY}" stroke="#1F1B16" stroke-width="1"/>
      ${beLine}
      <polyline points="${points}" fill="none" stroke="#5C1A1B" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}
    </svg>`;

    // Monthly net profit bar chart (SVG)
    const opMonths = proj.months.filter(m => !m.isInitial);
    const npData = opMonths.map(m => m.netProfit);
    const npMax = Math.max(...npData.map(Math.abs), 1);
    const bW = 800, bH = 220, bPad = 50;
    const bPlotW = bW - bPad * 2, bPlotH = bH - bPad * 2;
    const barW = Math.min(bPlotW / opMonths.length * 0.6, 60);
    const bZeroY = bPad + bPlotH / 2;
    const bars = opMonths.map((m, i) => {
      const x = bPad + (i + 0.5) / opMonths.length * bPlotW - barW / 2;
      const h = Math.abs(m.netProfit) / npMax * (bPlotH / 2);
      const y = m.netProfit >= 0 ? bZeroY - h : bZeroY;
      const clr = m.netProfit >= 0 ? '#1F4F2E' : '#A4193D';
      const lbl = Math.abs(m.netProfit) >= 1e3 ? (m.netProfit / 1e3).toFixed(0) + 'K' : m.netProfit.toFixed(0);
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${Math.max(h, 1)}" fill="${clr}" rx="2"/>
              <text x="${(x + barW / 2).toFixed(1)}" y="${(m.netProfit >= 0 ? y - 4 : y + h + 12).toFixed(1)}" text-anchor="middle" fill="${clr}" font-size="9" font-family="monospace">${lbl}</text>`;
    }).join('\n');
    const bXLabels = opMonths.map((m, i) => {
      const x = bPad + (i + 0.5) / opMonths.length * bPlotW;
      return `<text x="${x}" y="${bH - 8}" text-anchor="middle" fill="#5C544A" font-size="10" font-family="monospace">${m.label}</text>`;
    }).join('\n');
    const barChart = `<svg viewBox="0 0 ${bW} ${bH}" style="width:100%;max-width:${bW}px;height:auto;">
      <line x1="${bPad}" y1="${bZeroY}" x2="${bW - bPad}" y2="${bZeroY}" stroke="#1F1B16" stroke-width="1"/>
      ${bars}
      ${bXLabels}
    </svg>`;

    // TOP / BOTTOM SKU
    const sorted = [...calcs].sort((a, b) => b.c.netProfit - a.c.netProfit);
    const topN = Math.min(10, sorted.length);
    const topSKUs = sorted.slice(0, topN);
    const bottomSKUs = sorted.slice(-Math.min(5, sorted.length)).reverse();
    const topRows = topSKUs.map((r, i) => {
      const tagCls = i < 3 ? 'gold-tag' : 'gray-tag';
      return `<tr><td><span class="rank-tag ${tagCls}">${i + 1}</span></td><td class="mono">${r.id}</td><td class="r mono pos">${fR(r.c.netProfit)}</td><td class="r mono">${fP(r.c.roi)}</td></tr>`;
    }).join('\n');
    const bottomRows = bottomSKUs.map((r, i) => {
      return `<tr><td><span class="rank-tag red-tag">${i + 1}</span></td><td class="mono">${r.id}</td><td class="r mono neg">${fR(r.c.netProfit)}</td><td class="r mono">${fP(r.c.roi)}</td></tr>`;
    }).join('\n');

    // Cost structure bar
    const costParts = [
      { label: lang === 'zh' ? '采购成本' : 'COGS', val: totals.totalCostBasis, clr: '#5C1A1B' },
      { label: lang === 'zh' ? '平台费' : 'Platform', val: calcs.reduce((s, r) => s + (r.platformFee || 0) * (r.qty || 0), 0), clr: '#7A2A2C' },
      { label: lang === 'zh' ? '仓储' : 'Warehouse', val: calcs.reduce((s, r) => s + (r.warehouse || 0) * (r.qty || 0), 0), clr: '#B8860B' },
      { label: lang === 'zh' ? '管理费' : 'Mgmt', val: calcs.reduce((s, r) => s + (r.mgmt || 0) * (r.qty || 0), 0), clr: '#D4A93A' },
      { label: lang === 'zh' ? '税' : 'Tax', val: totals.tax, clr: '#A4193D' },
    ];
    const costTotal = costParts.reduce((s, p) => s + p.val, 0) || 1;
    const costBarHtml = `<div class="cost-bar-container">
      <div class="cost-bar">${costParts.map(p => {
        const pct = (p.val / costTotal * 100);
        return pct > 2 ? `<div style="width:${pct.toFixed(1)}%;background:${p.clr}">${pct.toFixed(0)}%</div>` : `<div style="width:${Math.max(pct, 2).toFixed(1)}%;background:${p.clr}"></div>`;
      }).join('')}</div>
      <div class="cost-legend">${costParts.map(p => `<span><span class="dot" style="background:${p.clr}"></span>${p.label}: ${fR(p.val)} (${(p.val / costTotal * 100).toFixed(1)}%)</span>`).join('')}</div>
    </div>`;

    // Executive summary text
    const beText = proj.breakEvenMonth
      ? (lang === 'zh' ? `预计<span class="highlight">第${proj.breakEvenMonth}个月回本</span>` : lang === 'ru' ? `Окупаемость за <span class="highlight">${proj.breakEvenMonth} мес.</span>` : `Expected break-even at <span class="highlight">month ${proj.breakEvenMonth}</span>`)
      : (lang === 'zh' ? '预测期内未能回本' : lang === 'ru' ? 'Не окупается в прогнозе' : 'No break-even in forecast period');
    const summaryText = lang === 'zh'
      ? `本批次共 <strong>${calcs.length} 个 SKU</strong>，总备货 <strong>${totals.qty} 件</strong>。采用 <strong>${scheme}</strong> 税制方案，总投资 <strong>${fR(totals.totalCostBasis)}</strong>（${fC(totals.totalCostBasis / params.exchangeRate)}），预计 ${projection.monthsHorizon} 个月内可产生总营收 <strong>${fR(totals.totalRevenue)}</strong>，扣除所有成本和税费后，现金净利润 <strong>${fR(totals.netProfit)}</strong>，投资回报率 <strong>${fP(totals.roi)}</strong>。${beText}。`
      : lang === 'ru'
      ? `В партии <strong>${calcs.length} SKU</strong>, всего <strong>${totals.qty} шт.</strong> Режим <strong>${scheme}</strong>, инвестиции <strong>${fR(totals.totalCostBasis)}</strong>, выручка за ${projection.monthsHorizon} мес. — <strong>${fR(totals.totalRevenue)}</strong>, чистая прибыль <strong>${fR(totals.netProfit)}</strong>, ROI <strong>${fP(totals.roi)}</strong>. ${beText}.`
      : `This batch contains <strong>${calcs.length} SKUs</strong> totaling <strong>${totals.qty} units</strong>. Using <strong>${scheme}</strong> tax scheme, total investment <strong>${fR(totals.totalCostBasis)}</strong> (${fC(totals.totalCostBasis / params.exchangeRate)}), projected ${projection.monthsHorizon}-month revenue <strong>${fR(totals.totalRevenue)}</strong>, net profit <strong>${fR(totals.netProfit)}</strong>, ROI <strong>${fP(totals.roi)}</strong>. ${beText}.`;

    // Glossary tips
    const glossaryItems = lang === 'zh' ? [
      { t: '总营收', d: '所有商品卖出后平台打给你的总金额（已扣平台佣金）' },
      { t: '现金净利', d: '按单品逐个算税后汇总的利润' },
      { t: '期末现金', d: '按月累计计算的实际账上余额（税按月合算，通常略高于净利）' },
      { t: 'ROI', d: '投资回报率 = 净利 ÷ 投资 × 100%' },
      { t: '回本月份', d: '累计现金从负变正的月份' },
      { t: '最大回撤', d: '预测期内账上最缺钱的时刻（通常在M0）' },
    ] : lang === 'ru' ? [
      { t: 'Выручка', d: 'Выплаты площадки за все товары (после комиссии)' },
      { t: 'Чист. прибыль', d: 'Прибыль после налога, по каждому SKU' },
      { t: 'Итоговый кэш', d: 'Баланс помесячно (налог в совокупности, обычно чуть выше прибыли)' },
      { t: 'ROI', d: 'Возврат инвестиций = Прибыль ÷ Инвестиции × 100%' },
      { t: 'Окупаемость', d: 'Месяц, когда накопленный кэш становится положительным' },
    ] : [
      { t: 'Revenue', d: 'Total platform payouts for all products sold (after fees)' },
      { t: 'Net Profit', d: 'Per-SKU tax-adjusted profit, summed up' },
      { t: 'Final Cash', d: 'Monthly cumulative cash balance (tax calculated monthly, usually slightly higher)' },
      { t: 'ROI', d: 'Return on Investment = Profit ÷ Investment × 100%' },
      { t: 'Break-even', d: 'Month when cumulative cash turns positive' },
    ];
    const glossaryHtml = glossaryItems.map(g => `<div class="glossary-item"><strong>${g.t}</strong> — ${g.d}</div>`).join('\n');

    // Build the HTML
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t("htmlReportTitle")} — ${date}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Geist:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Geist',system-ui,sans-serif;background:#FAF7F2;color:#1F1B16;padding:0;line-height:1.5}
  .page{max-width:1100px;margin:0 auto;padding:40px 32px}
  h1,h2,h3{font-family:'Fraunces',serif}
  .mono{font-family:'JetBrains Mono',monospace;font-feature-settings:"tnum"}

  /* Header */
  .header{background:linear-gradient(135deg,#5C1A1B 0%,#7A2A2C 50%,#5C1A1B 100%);color:#FAF7F2;padding:40px 32px;position:relative;overflow:hidden}
  .header::after{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at 80% 20%,rgba(184,134,11,0.15),transparent 60%)}
  .header *{position:relative;z-index:1}
  .header h1{font-size:28px;font-weight:700;margin-bottom:6px}
  .header .sub{font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#D4A93A;margin-bottom:4px}
  .header .date{font-size:12px;opacity:0.7;margin-top:8px}

  /* Summary Cards */
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:32px 0}
  .card{background:rgba(255,255,255,0.75);border:1px solid #D9CFB8;padding:20px;position:relative}
  .card.accent{border:2px solid #1F4F2E;background:rgba(255,255,255,0.85)}
  .card .label{font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#5C544A;margin-bottom:6px}
  .card .value{font-family:'Fraunces',serif;font-size:26px;font-weight:700;line-height:1.2}
  .card .sub{font-size:11px;color:#5C544A;margin-top:4px;font-family:'JetBrains Mono',monospace}
  .pos{color:#1F4F2E} .neg{color:#A4193D}

  /* Section */
  .section{margin:36px 0}
  .section h2{font-size:20px;font-weight:600;margin-bottom:4px}
  .section .kicker{font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#B8860B;margin-bottom:2px}

  /* Info Bar */
  .info-bar{display:flex;gap:24px;padding:14px 20px;background:#F2EDE3;border:1px solid #D9CFB8;margin-bottom:24px;flex-wrap:wrap}
  .info-bar .item{font-size:12px}
  .info-bar .item strong{color:#5C1A1B}

  /* Table */
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#F2EDE3;text-align:left;padding:8px 10px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#5C544A;border-bottom:2px solid #D9CFB8;white-space:nowrap}
  td{padding:7px 10px;border-bottom:1px solid #D9CFB8}
  .r{text-align:right}
  tbody tr:hover{background:rgba(184,134,11,0.04)}
  .total-row{background:#F2EDE3;font-weight:600}
  .init-row{background:rgba(164,25,61,0.04)}

  /* Chart */
  .chart-box{background:white;border:1px solid #D9CFB8;padding:24px;margin:24px 0;text-align:center}
  .chart-box svg{display:inline-block}
  .chart-title{font-family:'Fraunces',serif;font-size:16px;font-weight:600;margin-bottom:16px}

  /* Footer */
  .footer{margin-top:48px;padding:20px 0;border-top:1px solid #D9CFB8;font-size:11px;color:#5C544A;text-align:center}
  .footer .brand{font-family:'Fraunces',serif;font-weight:600;color:#5C1A1B;font-size:13px;margin-bottom:4px}

  /* Summary Text */
  .summary-text{background:white;border:1px solid #D9CFB8;padding:20px 24px;margin:24px 0;font-size:13px;line-height:1.8;color:#1F1B16}
  .summary-text strong{color:#5C1A1B}
  .summary-text .highlight{display:inline-block;padding:1px 6px;background:rgba(31,79,46,0.08);color:#1F4F2E;font-weight:600;border-radius:2px}

  /* Rank table */
  .rank-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0}
  .rank-box{background:white;border:1px solid #D9CFB8;padding:16px}
  .rank-box h3{font-family:'Fraunces',serif;font-size:14px;font-weight:600;margin-bottom:10px}
  .rank-box .rank-tag{display:inline-block;width:20px;height:20px;text-align:center;line-height:20px;font-size:10px;font-weight:700;border-radius:50%;margin-right:6px}
  .gold-tag{background:#D4A93A;color:white}
  .red-tag{background:#A4193D;color:white}
  .gray-tag{background:#D9CFB8;color:#5C544A}

  /* Cost bar */
  .cost-bar-container{margin:16px 0}
  .cost-bar{display:flex;height:28px;border-radius:3px;overflow:hidden;margin:8px 0}
  .cost-bar div{display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:600;color:white;min-width:30px}
  .cost-legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:8px}
  .cost-legend span{font-size:11px;display:flex;align-items:center;gap:4px}
  .cost-legend .dot{width:10px;height:10px;border-radius:2px;display:inline-block}

  /* Glossary */
  .glossary-box{background:#F2EDE3;border:1px solid #D9CFB8;padding:16px 20px;margin-top:24px}
  .glossary-box h3{font-family:'Fraunces',serif;font-size:14px;font-weight:600;margin-bottom:8px;color:#5C1A1B}
  .glossary-item{font-size:11px;margin-bottom:4px;color:#5C544A}
  .glossary-item strong{color:#1F1B16}

  /* Print */
  @media print{
    body{background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{padding:20px}
    .header{padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .cards{grid-template-columns:repeat(4,1fr)}
    table{font-size:10px}
    .page-break{page-break-before:always}
    .rank-grid{grid-template-columns:1fr 1fr}
  }
  @media(max-width:768px){
    .cards{grid-template-columns:repeat(2,1fr)}
    .page{padding:20px 16px}
    .header{padding:24px 16px}
    table{font-size:10px}
    .card .value{font-size:20px}
    .rank-grid{grid-template-columns:1fr}
  }
</style>
</head>
<body>
<div class="header">
  <div class="sub">Cross-border P&L · ${t("brandSub")}</div>
  <h1>${t("htmlReportTitle")}</h1>
  <div class="date">${t("htmlGenDate")}: ${date} · ${t("htmlExchangeRate")}: 1¥ = ${params.exchangeRate.toFixed(2)}₽</div>
</div>

<div class="page">
  <!-- Info Bar -->
  <div class="info-bar">
    <div class="item">${t("htmlTaxScheme")}: <strong>${scheme}</strong></div>
    <div class="item">${t("htmlForecastPeriod")}: <strong>${projection.monthsHorizon} ${t("months")}</strong></div>
    <div class="item">${t("htmlBreakEven")}: <strong>${proj.breakEvenMonth ? `M${proj.breakEvenMonth}` : t("htmlNoBreakEven")}</strong></div>
    <div class="item">${t("htmlExchangeRate")}: <strong>1¥ = ${params.exchangeRate.toFixed(2)}₽</strong></div>
  </div>

  <!-- Executive Summary -->
  <div class="summary-text">
    ${summaryText}
  </div>

  <!-- Summary Cards -->
  <div class="section">
    <div class="kicker">${t("htmlSummary")}</div>
    <h2>${t("tabDashboard")}</h2>
  </div>
  <div class="cards">
    <div class="card">
      <div class="label">${t("totalRevenue")}</div>
      <div class="value">${fR(totals.totalRevenue)}</div>
      <div class="sub">${fC(totals.totalRevenue / params.exchangeRate)}</div>
    </div>
    <div class="card">
      <div class="label">${t("totalInvestment")}</div>
      <div class="value">${fR(totals.totalCostBasis)}</div>
      <div class="sub">${fC(totals.totalCostBasis / params.exchangeRate)}</div>
    </div>
    <div class="card accent">
      <div class="label">${t("cashNetProfit")}</div>
      <div class="value ${totals.netProfit >= 0 ? 'pos' : 'neg'}">${fR(totals.netProfit)}</div>
      <div class="sub">${fC(totals.netProfitCNY)}</div>
    </div>
    <div class="card">
      <div class="label">ROI</div>
      <div class="value" style="color:#B8860B">${fP(totals.roi)}</div>
      <div class="sub">${t("netMargin")} ${fP(totals.profitMargin)}</div>
    </div>
  </div>

  <!-- Investor Metrics -->
  <div class="cards" style="grid-template-columns:repeat(4,1fr)">
    <div class="card">
      <div class="label">${t("initialOutflow")}</div>
      <div class="value neg">${fR(-proj.initialOutflow)}</div>
    </div>
    <div class="card">
      <div class="label">${t("maxDrawdown")}</div>
      <div class="value neg">${fR(proj.maxDrawdown)}</div>
    </div>
    <div class="card">
      <div class="label">${t("finalCash")}</div>
      <div class="value ${proj.finalCash >= 0 ? 'pos' : 'neg'}">${fR(proj.finalCash)}</div>
    </div>
    <div class="card">
      <div class="label">${t("totalTax")}</div>
      <div class="value" style="color:#A4193D">${fR(totals.tax)}</div>
    </div>
  </div>

  <!-- Cost Structure Bar -->
  <div class="section">
    <div class="kicker">COST BREAKDOWN</div>
    <h2>${lang === 'zh' ? '成本结构分析' : lang === 'ru' ? 'Структура затрат' : 'Cost Structure Analysis'}</h2>
  </div>
  ${costBarHtml}

  <!-- Charts Side by Side -->
  <div class="section page-break">
    <div class="kicker">TRENDS</div>
    <h2>${lang === 'zh' ? '趋势图表' : lang === 'ru' ? 'Графики' : 'Trend Charts'}</h2>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div class="chart-box">
      <div class="chart-title">${t("cumCashTitle")}</div>
      ${svgChart}
    </div>
    <div class="chart-box">
      <div class="chart-title">${lang === 'zh' ? '月度净利润' : lang === 'ru' ? 'Ежемесячная прибыль' : 'Monthly Net Profit'}</div>
      ${barChart}
    </div>
  </div>

  <!-- TOP / BOTTOM SKU -->
  <div class="section">
    <div class="kicker">SKU RANKING</div>
    <h2>${lang === 'zh' ? '商品排名' : lang === 'ru' ? 'Рейтинг товаров' : 'Product Ranking'}</h2>
  </div>
  <div class="rank-grid">
    <div class="rank-box">
      <h3 style="color:#1F4F2E">🏆 TOP ${topN} ${lang === 'zh' ? '最赚钱' : lang === 'ru' ? 'Лучшие' : 'Best Performers'}</h3>
      <table>
        <thead><tr><th>#</th><th>SKU</th><th class="r">${lang === 'zh' ? '净利' : 'Profit'}</th><th class="r">ROI</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>
    <div class="rank-box">
      <h3 style="color:#A4193D">⚠️ ${lang === 'zh' ? '需关注（低利润/亏损）' : lang === 'ru' ? 'Требуют внимания' : 'Needs Attention'}</h3>
      <table>
        <thead><tr><th>#</th><th>SKU</th><th class="r">${lang === 'zh' ? '净利' : 'Profit'}</th><th class="r">ROI</th></tr></thead>
        <tbody>${bottomRows}</tbody>
      </table>
    </div>
  </div>

  <!-- Full Product Table -->
  <div class="section page-break">
    <div class="kicker">${t("htmlProductDetail")}</div>
    <h2>${t("productsTitle")} · ${calcs.length} SKUs</h2>
  </div>
  <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th>${t("productId")}</th>
        <th class="r">${t("costCny")}</th>
        <th class="r">${t("qty")}</th>
        <th class="r">${t("listPrice")}</th>
        <th class="r">${t("platformFee")}</th>
        <th class="r">${t("investment")}</th>
        <th class="r">${t("revenue")}</th>
        <th class="r">${t("tax")}</th>
        <th class="r">${t("netProfitCol")}</th>
        <th class="r">ROI</th>
      </tr></thead>
      <tbody>
        ${prodRows}
        <tr class="total-row">
          <td>${t("totalRow")}</td>
          <td class="r">—</td>
          <td class="r mono">${totals.qty}</td>
          <td class="r">—</td>
          <td class="r">—</td>
          <td class="r mono">${fR(totals.totalInvestment)}</td>
          <td class="r mono">${fR(totals.totalRevenue)}</td>
          <td class="r mono">${fR(totals.tax)}</td>
          <td class="r mono ${totals.netProfit >= 0 ? 'pos' : 'neg'}">${fR(totals.netProfit)}</td>
          <td class="r mono">${fP(totals.roi)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Cash Flow Table -->
  <div class="section page-break">
    <div class="kicker">${t("htmlCashFlow")}</div>
    <h2>${t("projTitle")}</h2>
  </div>
  <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th>${t("thMonth")}</th>
        <th class="r">${t("colRestock")}</th>
        <th class="r">${t("colStock")}</th>
        <th class="r">${t("thSoldQty")}</th>
        <th class="r">${t("thRevenue")}</th>
        <th class="r">${t("thCogs")}</th>
        <th class="r">${t("thExpenses")}</th>
        <th class="r">${t("thTax")}</th>
        <th class="r">${t("thNetProfit")}</th>
        <th class="r">${t("thCumCash")}</th>
        <th>${t("thTaxTier")}</th>
      </tr></thead>
      <tbody>
        ${cfRows}
      </tbody>
    </table>
  </div>

  <!-- Glossary Tips -->
  <div class="glossary-box">
    <h3>${lang === 'zh' ? '📖 术语小贴士' : lang === 'ru' ? '📖 Глоссарий' : '📖 Quick Glossary'}</h3>
    ${glossaryHtml}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="brand">星哈酷 · XingHaKu Investment Analytics</div>
    <div>${t("htmlDisclaimer")}</div>
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const filename = `PL-Report-${date}.html`;

    // 现代浏览器：弹出"另存为"对话框
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: "HTML Report", accept: { "text/html": [".html"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (e) {
        if (e.name === "AbortError") return; // 用户取消
      }
    }

    // 回退方案
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const tabs = [
    { id: "dashboard", label: t("tabDashboard") },
    { id: "products", label: t("tabProducts") },
    { id: "schedule", label: t("tabSchedule") },
    { id: "projection", label: t("tabProjection") },
    { id: "settings", label: t("tabSettings") },
    { id: "help", label: t("tabHelp") },
    { id: "glossary", label: t("tabGlossary") },
  ];

  return (
    <div className="min-h-screen font-body grain" style={{ background: COLORS.cream, color: COLORS.ink }}>
      <FontStyles />
      <header className="border-b sticky top-0 z-50" style={{ borderColor: COLORS.line, background: "rgba(250,247,242,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 sm:py-5">
          <div className="flex items-center justify-between flex-wrap gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-sm" style={{ background: COLORS.oxblood, color: COLORS.cream }}>
                <span className="font-display text-lg sm:text-xl font-bold">Р</span>
              </div>
              <div>
                <div className="text-[9px] sm:text-[10px] tracking-[0.25em] uppercase hidden sm:block" style={{ color: COLORS.gold }}>{t("brandSub")}</div>
                <h1 className="font-display text-lg sm:text-2xl font-bold">{t("brandTitle")}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Live rate indicator */}
              <span className="text-[10px] font-mono hidden sm:inline" style={{ color: rateSource === 'live' ? COLORS.emerald : COLORS.inkSoft }}>
                {rateSource === 'live' ? '● ' : '○ '}1¥={effectiveRate.toFixed(2)}₽ · 1$={effectiveUsdRate.toFixed(1)}₽
              </span>
              {/* Language switcher */}
              <div className="flex gap-0 border rounded-sm overflow-hidden" style={{ borderColor: COLORS.line }}>
                {LANG_OPTIONS.map(l => (
                  <button key={l.code} onClick={() => { setLang(l.code); localStorage.setItem("ru_calc_lang", l.code); }}
                    className="px-2 py-1.5 text-[10px] font-medium"
                    style={{ background: lang === l.code ? COLORS.oxblood : "transparent", color: lang === l.code ? COLORS.cream : COLORS.inkSoft }}>
                    {l.flag}
                  </button>
                ))}
              </div>
              {storageStatus && <span className="text-xs font-mono" style={{ color: COLORS.gold }}>{storageStatus}</span>}
              <button onClick={saveToCloud} disabled={storageBusy}
                className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border disabled:opacity-50 rounded-sm"
                style={{ borderColor: COLORS.oxblood, color: COLORS.oxblood }}>
                <Save size={14} /> <span className="hidden sm:inline">{storageBusy ? t("saving") : t("saveCloud")}</span>
              </button>
              <button onClick={exportCSV}
                className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-sm"
                style={{ background: COLORS.oxblood, color: COLORS.cream }}>
                <FileDown size={14} /> <span className="hidden sm:inline">{t("exportCSV")}</span>
              </button>
              <button onClick={exportHTML}
                className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-sm"
                style={{ background: COLORS.emerald, color: COLORS.cream }}>
                <FileDown size={14} /> <span className="hidden sm:inline">{t("exportHTML")}</span>
              </button>
              <button onClick={resetSample}
                className="btn-interact flex items-center gap-1.5 px-2 py-2 text-xs rounded-sm"
                style={{ color: COLORS.inkSoft }} title={t("resetSample")}>
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
          <div className="mt-3 sm:mt-5 flex gap-0 border-b -mb-[1px] overflow-x-auto" style={{ borderColor: COLORS.line }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`tab-btn px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium whitespace-nowrap ${tab === t.id ? 'active' : ''}`}
                style={{
                  color: tab === t.id ? COLORS.oxblood : COLORS.inkSoft,
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div key={tab} className="page-enter">
        {tab === "dashboard" && <Dashboard totals={totals} params={params} calcs={calcs} proj={proj} projection={projection} t={t} lang={lang} fmt={fmt} />}
        {tab === "products" && <ProductsTab calcs={calcs} expandedRow={expandedRow} setExpandedRow={setExpandedRow}
          onUpdate={updateProduct} onDelete={deleteProduct} onAdd={addProduct} onClear={clearAllProducts} params={params} t={t} lang={lang} fmt={fmt} />}
        {tab === "schedule" && <ScheduleTab products={products} projection={projection} setProjection={setProjection}
          scheduleStore={scheduleStore} updateSchedule={updateSchedule} applyCurve={applyScheduleCurve}
          priceScheduleStore={priceScheduleStore} setPriceScheduleStore={setPriceScheduleStore}
          restockStore={restockStore} updateRestock={updateRestock} setRestockStore={setRestockStore}
          withdrawalStore={withdrawalStore} setWithdrawalStore={setWithdrawalStore}
          t={t} lang={lang} />}
        {tab === "projection" && <ProjectionTab proj={proj} projection={projection} setProjection={setProjection}
          params={params} totals={totals} t={t} lang={lang} fmt={fmt} />}
        {tab === "settings" && <SettingsTab params={params} setParams={setParams} t={t} lang={lang}
          rateSource={rateSource} setRateSource={setRateSource} liveRate={liveRate} effectiveRate={effectiveRate} fetchRate={fetchRate} />}
        {tab === "help" && <HelpPanel t={t} lang={lang} />}
        {tab === "glossary" && <GlossaryPanel t={t} lang={lang} />}
        </div>
      </main>

      <footer className="border-t mt-8" style={{ borderColor: COLORS.line }}>
        <div className="max-w-[1500px] mx-auto px-6 py-4 text-xs" style={{ color: COLORS.inkSoft }}>
          {t("footerText")}
          <span className="mx-2">·</span>{t("footerDisclaimer")}
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// 仪表盘
// ============================================================
const Dashboard = ({ totals, params, calcs, proj, projection, t, lang, fmt }) => {
  const showBookDiff = params.taxScheme === "osn" && Math.abs(totals.netProfit - totals.bookNetProfit) > 1;
  const F = fmt.fmtPrimary, Fs = fmt.fmtSecondary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 glass-card card-hover rounded-sm">
          <Metric label={t("totalRevenue")} value={F(totals.totalRevenue)} sub={Fs(totals.totalRevenue)} big />
        </div>
        <div className="p-4 sm:p-5 glass-card card-hover rounded-sm">
          <Metric label={t("totalInvestment")} value={F(totals.totalCostBasis)} sub={Fs(totals.totalCostBasis)} big />
        </div>
        <div className="p-4 sm:p-5 card-hover rounded-sm border-2" style={{ borderColor: totals.netProfit >= 0 ? COLORS.emerald : COLORS.crimson, background: "rgba(255,255,255,0.7)" }}>
          <Metric label={t("cashNetProfit")}
            value={F(totals.netProfit)}
            sub={showBookDiff ? `${t("bookNetProfit")} ${F(totals.bookNetProfit)}` : Fs(totals.netProfit)}
            color={totals.netProfit >= 0 ? COLORS.emerald : COLORS.crimson} big />
        </div>
        <div className="p-4 sm:p-5 glass-card card-hover rounded-sm">
          <Metric label={t("roiLabel")} value={fmtPct(totals.roi)} sub={`${t("netMargin")} ${fmtPct(totals.profitMargin)}`} color={COLORS.gold} big />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card kicker={t("cumCashKicker")} title={t("cumCashTitle")} className="lg:col-span-2">
          <CashFlowChart proj={proj} t={t} fmt={fmt} />
          {proj.breakEvenMonth ? (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full" style={{ background: COLORS.emerald }}></span>
              <span style={{ color: COLORS.emeraldSoft }}>{t("breakEvenMsg", { n: proj.breakEvenMonth })}</span>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <AlertCircle size={14} style={{ color: COLORS.crimson }} />
              <span style={{ color: COLORS.crimson }}>{t("noBreakEven")}</span>
            </div>
          )}
        </Card>
        <Card kicker={t("investorKicker")} title={t("investorTitle")}>
          <div className="space-y-4">
            <Metric label={t("initialOutflow")} value={F(-proj.initialOutflow)}
              sub={Fs(-proj.initialOutflow)} color={COLORS.crimson} />
            <Metric label={t("maxDrawdown")} value={F(proj.maxDrawdown)}
              sub={Fs(proj.maxDrawdown)} color={COLORS.crimson} />
            <Metric label={t("finalCash")} value={F(proj.finalCash)}
              sub={Fs(proj.finalCash)}
              color={proj.finalCash >= 0 ? COLORS.emerald : COLORS.crimson} />
            <Metric label={t("avgMonthly")} value={F(proj.totalRevenue / projection.monthsHorizon)}
              sub={Fs(proj.totalRevenue / projection.monthsHorizon)} color={COLORS.gold} />
          </div>
        </Card>
      </div>

      <Card kicker={t("monthlyPnLKicker")} title={t("monthlyPnL")}>
        <MonthlyPnLChart proj={proj} t={t} fmt={fmt} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card kicker={t("costKicker")} title={t("costStructure")}>
          <CostBar totals={totals} params={params} t={t} fmt={fmt} />
        </Card>
        <Card kicker={`Tax · ${TAX_SCHEMES[params.taxScheme].short}`} title={t("taxStructure")}>
          <TaxBreakdown totals={totals} params={params} t={t} fmt={fmt} />
        </Card>
      </div>

      <Card kicker={t("rankingKicker")} title={t("rankingTitle")}>
        <ProductRanking calcs={calcs} t={t} fmt={fmt} />
      </Card>
    </div>
  );
};

// ============================================================
// 图表
// ============================================================
const TooltipContent = ({ active, payload, label, fmt: fmtProp }) => {
  if (!active || !payload || !payload.length) return null;
  const _fmt = fmtProp || { fmtPrimaryFull: fmtRub };
  return (
    <div style={{ background: COLORS.ink, color: COLORS.cream, padding: "8px 12px", border: "none", fontSize: 11 }}>
      <div style={{ color: COLORS.goldSoft, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4, fontFamily: "Geist, sans-serif" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily: "JetBrains Mono, monospace" }}>{p.name}: {_fmt.fmtPrimaryFull(p.value)}</div>
      ))}
    </div>
  );
};

const CashFlowChart = ({ proj, t, fmt }) => {
  const _t = t || ((k) => k);
  const _F = fmt ? fmt.fmtPrimary : fmtRubShort;
  const data = proj.months.map(m => ({ label: m.label, cumCash: m.cumCash, monthly: m.cashFlow }));
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={COLORS.inkSoft} fontSize={11} />
          <YAxis stroke={COLORS.inkSoft} fontSize={11} tickFormatter={(v) => _F(v)} />
          <Tooltip content={<TooltipContent fmt={fmt} />} />
          <ReferenceLine y={0} stroke={COLORS.ink} strokeWidth={1} />
          {proj.breakEvenMonth && (
            <ReferenceLine x={`M${proj.breakEvenMonth}`} stroke={COLORS.emerald} strokeDasharray="5 3"
              label={{ value: _t("chartBreakEven"), fill: COLORS.emerald, fontSize: 11, position: "top" }} />
          )}
          <Line type="monotone" dataKey="cumCash" stroke={COLORS.oxblood} strokeWidth={2.5}
            dot={{ fill: COLORS.oxblood, r: 3 }} activeDot={{ r: 5 }} name={_t("chartCumCash")} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const MonthlyPnLChart = ({ proj, t, fmt }) => {
  const _t = t || ((k) => k);
  const _F = fmt ? fmt.fmtPrimary : fmtRubShort;
  const data = proj.months.slice(1);
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={COLORS.inkSoft} fontSize={11} />
          <YAxis stroke={COLORS.inkSoft} fontSize={11} tickFormatter={(v) => _F(v)} />
          <Tooltip content={<TooltipContent fmt={fmt} />} />
          <ReferenceLine y={0} stroke={COLORS.ink} />
          <Bar dataKey="netProfit" name={_t("chartMonthlyNet")}>
            {data.map((m, i) => (
              <Cell key={i} fill={m.netProfit >= 0 ? COLORS.emeraldSoft : COLORS.crimson} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================
// 成本/税务结构
// ============================================================
const CostBar = ({ totals, params, t, fmt }) => {
  const F = fmt.fmtPrimary, Ff = fmt.fmtPrimaryFull;
  const items = [
    { label: t("costProcure"), value: totals.totalInvestment, color: COLORS.oxblood },
    { label: t("costWarehouse"), value: totals.totalWarehouse, color: COLORS.gold },
    { label: t("costMgmt"), value: totals.totalMgmt, color: COLORS.goldSoft },
    { label: t("costTax"), value: totals.tax, color: COLORS.crimson },
    { label: t("costOneTime"), value: params.oneTimeCosts, color: COLORS.inkSoft },
    { label: t("costNetProfit"), value: Math.max(0, totals.netProfit), color: COLORS.emerald },
  ].filter(x => x.value > 0);
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-8 w-full overflow-hidden border" style={{ borderColor: COLORS.line }}>
        {items.map((it, i) => <div key={i} title={`${it.label}: ${Ff(it.value)}`} style={{ width: `${(it.value / total) * 100}%`, background: it.color }} />)}
      </div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2"><div className="w-3 h-3" style={{ background: it.color }} /><span>{it.label}</span></div>
            <div className="flex items-center gap-3">
              <span className="font-mono" style={{ color: COLORS.inkSoft }}>{((it.value / total) * 100).toFixed(1)}%</span>
              <span className="font-mono font-semibold w-32 text-right">{F(it.value)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TaxBreakdown = ({ totals, params, t, fmt }) => {
  const F = fmt.fmtPrimary, Ff = fmt.fmtPrimaryFull;
  const rows = [];
  if (totals.vatPart > 0) rows.push({ label: "VAT", value: totals.vatPart });
  if (totals.usnPart > 0) rows.push({ label: "USN", value: totals.usnPart });
  if (totals.profitTaxPart > 0) rows.push({ label: t("costTax"), value: totals.profitTaxPart });
  if (rows.length === 0 && totals.tax > 0) rows.push({ label: t("costTax"), value: totals.tax });
  const taxRate = totals.totalRevenue > 0 ? totals.tax / totals.totalRevenue : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 border" style={{ borderColor: COLORS.line }}>
          <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.inkSoft }}>{t("preTaxProfit")}</div>
          <div className="font-display font-semibold text-lg mt-1 number-pill" style={{ color: totals.profitBeforeTax >= 0 ? COLORS.ink : COLORS.crimson }}>{F(totals.profitBeforeTax)}</div>
        </div>
        <div className="p-3 border" style={{ borderColor: COLORS.line, background: "rgba(164,25,61,0.05)" }}>
          <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.crimson }}>{t("totalTax")}</div>
          <div className="font-display font-semibold text-lg mt-1 number-pill" style={{ color: COLORS.crimson }}>{F(totals.tax)}</div>
          <div className="text-xs font-mono mt-1" style={{ color: COLORS.inkSoft }}>{fmtPct(taxRate)} {t("effectiveRate")}</div>
        </div>
        <div className="p-3 border" style={{ borderColor: COLORS.line, background: "rgba(31,79,46,0.05)" }}>
          <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.emerald }}>{t("cashNetProfit")}</div>
          <div className="font-display font-semibold text-lg mt-1 number-pill" style={{ color: COLORS.emerald }}>{F(totals.netProfit)}</div>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: COLORS.line }}>
          {rows.map((it, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>{it.label}</span><span className="font-mono">{Ff(it.value)}</span>
            </div>
          ))}
          {params.taxScheme === "osn" && totals.totalInputVAT > 0 && (
            <>
              <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t" style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}>
                <span>{t("inputVATLabel")}</span><span className="font-mono">{Ff(totals.totalInputVAT)}</span>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: COLORS.inkSoft }}>
                <span>{t("outputVATLabel")}</span><span className="font-mono">{Ff(totals.totalOutputVAT)}</span>
              </div>
            </>
          )}
        </div>
      )}
      <div className="text-xs p-3" style={{ background: COLORS.paper, color: COLORS.inkSoft }}>
        {t("currentScheme")}<strong style={{ color: COLORS.oxblood }}>{t(TAX_SCHEMES[params.taxScheme].labelKey)}</strong>
        <br />{t(TAX_SCHEMES[params.taxScheme].descKey)}
      </div>
    </div>
  );
};

const ProductRanking = ({ calcs, t, fmt }) => {
  const sorted = [...calcs].sort((a, b) => b.c.roi - a.c.roi);
  if (!sorted.length) return <div className="text-sm" style={{ color: COLORS.inkSoft }}>{t("noProducts")}</div>;
  const F = fmt.fmtPrimary;
  const maxROI = Math.max(...sorted.map(r => r.c.roi), 0.01);
  const minROI = Math.min(...sorted.map(r => r.c.roi), 0);
  return (
    <div className="space-y-1">
      {sorted.map((r, i) => {
        const w = ((r.c.roi - Math.min(0, minROI)) / (maxROI - Math.min(0, minROI))) * 100;
        const color = r.c.roi > 0.3 ? COLORS.emerald : r.c.roi > 0.1 ? COLORS.gold : COLORS.crimson;
        return (
          <div key={r.id + i} className="flex items-center gap-2 sm:gap-3 py-2 row-glow rounded-sm px-1">
            <div className="w-6 sm:w-8 text-xs font-mono" style={{ color: COLORS.inkSoft }}>#{i + 1}</div>
            <div className="w-24 sm:w-32 font-mono text-[10px] sm:text-xs truncate" title={r.id}>{r.id}</div>
            <div className="flex-1 h-5 rounded-sm overflow-hidden" style={{ background: COLORS.paper }}>
              <div className="h-full bar-shimmer rounded-sm" style={{ width: `${Math.max(2, w)}%`, background: color, transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
            <div className="w-16 sm:w-20 text-right font-mono text-xs sm:text-sm font-semibold" style={{ color }}>{fmtPct(r.c.roi)}</div>
            <div className="w-20 sm:w-32 text-right font-mono text-[10px] sm:text-xs hidden sm:block" style={{ color: COLORS.inkSoft }}>{F(r.c.netProfit)}</div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// 商品 Tab
// ============================================================
const ProductsTab = ({ calcs, expandedRow, setExpandedRow, onUpdate, onDelete, onAdd, onClear, params, t, lang, fmt }) => (
  <div className="space-y-4 anim-in">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("productsTitle")} · {t("productCount", { n: calcs.length })}</h2>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
          {t("productsHint")}
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={onClear} disabled={!calcs.length}
          className="flex items-center gap-1.5 px-3 py-2 text-xs border disabled:opacity-30"
          style={{ borderColor: COLORS.crimson, color: COLORS.crimson }}>
          <Trash2 size={14} /> {t("clearAll")}
        </button>
        <button onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
          style={{ background: COLORS.oxblood, color: COLORS.cream }}>
          <Plus size={14} /> {t("addProduct")}
        </button>
      </div>
    </div>
    <ProductTable calcs={calcs} expandedRow={expandedRow} setExpandedRow={setExpandedRow}
      onUpdate={onUpdate} onDelete={onDelete} params={params} t={t} fmt={fmt} />
  </div>
);

const ProductTable = ({ calcs, expandedRow, setExpandedRow, onUpdate, onDelete, params, t, fmt }) => {
  const F = fmt.fmtPrimary;
  const showDeclared = params.taxScheme === "osn";
  return (
    <div className="border overflow-x-auto" style={{ borderColor: COLORS.line, background: "white" }}>
      <table className="w-full text-sm" style={{ minWidth: showDeclared ? "1280px" : "1200px" }}>
        <thead style={{ background: COLORS.paper }}>
          <tr className="text-[11px] tracking-wider uppercase" style={{ color: COLORS.inkSoft }}>
            <th className="text-left p-2 font-medium w-8"></th>
            <th className="text-left p-2 font-medium">{t("productId")}</th>
            <th className="text-right p-2 font-medium">{t("costCny")}</th>
            {showDeclared && <th className="text-right p-2 font-medium" style={{ color: COLORS.oxblood }}>Decl.¥</th>}
            <th className="text-right p-2 font-medium">{t("qty")}</th>
            <th className="text-right p-2 font-medium">{t("listPrice")}</th>
            <th className="text-right p-2 font-medium">{t("platformFee")}</th>
            <th className="text-right p-2 font-medium">{t("warehouseFee")}</th>
            <th className="text-right p-2 font-medium">{t("mgmtFee")}</th>
            <th className="text-right p-2 font-medium border-l" style={{ borderColor: COLORS.line }}>{t("investment")}</th>
            <th className="text-right p-2 font-medium">{t("revenue")}</th>
            <th className="text-right p-2 font-medium">{t("tax")}</th>
            <th className="text-right p-2 font-medium">{t("netProfitCol")}</th>
            <th className="text-right p-2 font-medium">{t("roi")}</th>
            <th className="text-center p-2 font-medium" style={{ width: "70px" }}>{t("action")}</th>
          </tr>
        </thead>
        <tbody>
          {calcs.map((r, idx) => {
            const isOpen = expandedRow === idx;
            const profitable = r.c.netProfit > 0;
            const declaredDiffers = (r.declaredCNY ?? r.priceCNY) !== r.priceCNY;
            return (
              <React.Fragment key={idx}>
                <tr className="border-t row-glow cursor-pointer" style={{ borderColor: COLORS.line }}
                  onClick={() => setExpandedRow(isOpen ? null : idx)}>
                  <td className="p-2">{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                  <td className="p-2 font-mono text-xs">{r.id}</td>
                  <td className="p-2 text-right font-mono text-xs">{fmtCny(r.priceCNY)}</td>
                  {showDeclared && (
                    <td className="p-2 text-right font-mono text-xs" style={{ color: declaredDiffers ? COLORS.oxblood : COLORS.inkSoft }}>
                      {fmtCny(r.declaredCNY ?? r.priceCNY)}
                    </td>
                  )}
                  <td className="p-2 text-right font-mono text-xs">{r.qty}</td>
                  <td className="p-2 text-right font-mono text-xs">{r.list?.toLocaleString("ru-RU")}</td>
                  <td className="p-2 text-right font-mono text-xs">{r.platformFee?.toLocaleString("ru-RU")}</td>
                  <td className="p-2 text-right font-mono text-xs">{r.warehouse}</td>
                  <td className="p-2 text-right font-mono text-xs">{r.mgmt}</td>
                  <td className="p-2 text-right font-mono text-xs border-l" style={{ borderColor: COLORS.line }}>{F(r.c.totalInvestment)}</td>
                  <td className="p-2 text-right font-mono text-xs">{F(r.c.totalRevenue)}</td>
                  <td className="p-2 text-right font-mono text-xs" style={{ color: COLORS.crimson }}>{F(r.c.tax)}</td>
                  <td className="p-2 text-right font-mono text-xs font-semibold" style={{ color: profitable ? COLORS.emerald : COLORS.crimson }}>{F(r.c.netProfit)}</td>
                  <td className="p-2 text-right font-mono text-xs font-semibold" style={{ color: r.c.roi > 0.3 ? COLORS.emerald : r.c.roi > 0.1 ? COLORS.gold : COLORS.crimson }}>{fmtPct(r.c.roi)}</td>
                  <td className="p-2 text-center">
                    <button onClick={(e) => { e.stopPropagation(); if (confirm(t("confirmDeleteProd", { id: r.id }))) onDelete(idx); }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border"
                      style={{ borderColor: COLORS.crimson, color: COLORS.crimson, background: "rgba(164,25,61,0.05)" }}>
                      <Trash2 size={11} /> {t("deleteBtn")}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr style={{ background: "rgba(184,134,11,0.04)" }}>
                    <td colSpan={showDeclared ? 15 : 14} className="p-4">
                      <ProductEditor product={r} idx={idx} onUpdate={onUpdate} calc={r.c} params={params} t={t} fmt={fmt} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
        {calcs.length > 0 && (
          <tfoot style={{ background: COLORS.paper }}>
            <tr className="font-semibold">
              <td className="p-2"></td>
              <td className="p-2 font-mono text-xs">{t("totalRow")}</td>
              <td className="p-2"></td>
              {showDeclared && <td className="p-2"></td>}
              <td className="p-2 text-right font-mono text-xs">{calcs.reduce((a, b) => a + (b.qty || 0), 0)}</td>
              <td colSpan={4}></td>
              <td className="p-2 text-right font-mono text-xs border-l" style={{ borderColor: COLORS.line }}>
                {F(calcs.reduce((a, b) => a + b.c.totalInvestment, 0))}
              </td>
              <td className="p-2 text-right font-mono text-xs">{F(calcs.reduce((a, b) => a + b.c.totalRevenue, 0))}</td>
              <td className="p-2 text-right font-mono text-xs" style={{ color: COLORS.crimson }}>{F(calcs.reduce((a, b) => a + b.c.tax, 0))}</td>
              <td className="p-2 text-right font-mono text-xs" style={{ color: COLORS.emerald }}>{F(calcs.reduce((a, b) => a + b.c.netProfit, 0))}</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

const ProductEditor = ({ product, idx, onUpdate, calc, params, t, fmt }) => {
  const Ff = (v, d = 0) => fmtRub(v, d);  // 计算明细面板统一用₽显示（这些值都是卢布单位）
  const fields = [
    { label: t("fieldProductId"), k: "id", type: "text" },
    { label: t("fieldActualCost"), k: "priceCNY", suffix: "¥", step: 0.01 },
    { label: t("fieldDeclaredCost"), k: "declaredCNY", suffix: "¥", step: 0.01, highlight: true },
    { label: t("fieldQty"), k: "qty", suffix: "pcs" },
    { label: t("fieldWeight"), k: "weight", suffix: "kg", step: 0.01 },
    { label: t("fieldListPrice"), k: "list", suffix: "₽" },
    { label: t("fieldPlatformFee"), k: "platformFee", suffix: "₽" },
    { label: t("fieldWarehouse"), k: "warehouse", suffix: "₽" },
    { label: t("fieldMgmt"), k: "mgmt", suffix: "₽" },
  ];
  const declaredDiffers = (product.declaredCNY ?? product.priceCNY) !== product.priceCNY;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-2 space-y-3">
        <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.gold }}>{t("editorFields")}</div>
        <div className="grid grid-cols-2 gap-2">
          {fields.map(f => (
            <div key={f.k} className="flex flex-col gap-1">
              <label className="text-[11px] flex items-center gap-1" style={{ color: COLORS.inkSoft }}>
                {f.label}
                {f.highlight && <Tag color={COLORS.oxblood}>{t("vatBasisTag")}</Tag>}
              </label>
              {f.type === "text" ? (
                <DebouncedTextInput value={product[f.k] || ""} onCommit={(v) => onUpdate(idx, f.k, v)}
                  className="px-2 py-1.5 bg-white border font-mono text-sm"
                  style={{ borderColor: COLORS.line, color: COLORS.ink }} />
              ) : (
                <NumInput value={product[f.k] ?? (f.k === "declaredCNY" ? product.priceCNY : 0)}
                  onChange={(v) => onUpdate(idx, f.k, v)} suffix={f.suffix} step={f.step || 1} />
              )}
            </div>
          ))}
        </div>
        {/* Shipping mode per product */}
        <div className="mt-2 p-2.5 border" style={{ borderColor: COLORS.line, background: COLORS.paper }}>
          <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: COLORS.gold }}>{t("shippingMode")}</div>
          <div className="flex gap-1 mb-2">
            {["manual", "gray", "white"].map(m => (
              <button key={m} onClick={() => onUpdate(idx, "shippingMode", m)}
                className="px-2.5 py-1.5 text-[11px] font-medium rounded-sm border"
                style={{
                  borderColor: (product.shippingMode || "manual") === m ? COLORS.oxblood : COLORS.line,
                  background: (product.shippingMode || "manual") === m ? COLORS.oxblood : "white",
                  color: (product.shippingMode || "manual") === m ? COLORS.cream : COLORS.inkSoft,
                }}>
                {m === "manual" ? t("shippingManual") : m === "gray" ? t("shippingGray") : t("shippingWhite")}
              </button>
            ))}
          </div>
          {(product.shippingMode || "manual") === "gray" && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] whitespace-nowrap" style={{ color: COLORS.inkSoft }}>{t("weightKg")}:</label>
              <NumInput value={product.weightKg || 0} onChange={(v) => onUpdate(idx, "weightKg", v)} suffix="kg" step={0.01} className="flex-1" />
              <span className="text-[10px] font-mono" style={{ color: COLORS.gold }}>→ {fmtRub(calcShipping(product, params))}/件</span>
            </div>
          )}
          {(product.shippingMode || "manual") === "white" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[11px] whitespace-nowrap" style={{ color: COLORS.inkSoft }}>{t("volumeLWH")}:</label>
              </div>
              <div className="flex gap-1.5 items-center">
                <NumInput value={product.volL || 0} onChange={(v) => onUpdate(idx, "volL", v)} suffix="cm" step={0.1} className="flex-1" />
                <span className="text-xs">×</span>
                <NumInput value={product.volW || 0} onChange={(v) => onUpdate(idx, "volW", v)} suffix="cm" step={0.1} className="flex-1" />
                <span className="text-xs">×</span>
                <NumInput value={product.volH || 0} onChange={(v) => onUpdate(idx, "volH", v)} suffix="cm" step={0.1} className="flex-1" />
              </div>
              <span className="text-[10px] font-mono" style={{ color: COLORS.gold }}>→ {((product.volL || 0) * (product.volW || 0) * (product.volH || 0) / 1e6).toFixed(4)} m³ · {fmtRub(calcShipping(product, params))}/件</span>
            </div>
          )}
          {(product.shippingMode || "manual") === "gray" && params.taxScheme === "osn" && (
            <div className="mt-1 text-[10px]" style={{ color: COLORS.crimson }}>{t("grayNoVatNote")}</div>
          )}
        </div>
      </div>
      <div className="lg:col-span-2 space-y-3">
        <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.gold }}>{t("editorCalcDetail")}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono p-3" style={{ background: "white", border: `1px solid ${COLORS.line}` }}>
          <div style={{ color: COLORS.inkSoft }}>{t("calcActualRub")}</div><div className="text-right">{Ff(calc.priceRUB, 2)}</div>
          {declaredDiffers && (
            <>
              <div style={{ color: COLORS.oxblood }}>{t("calcDeclaredRub")}</div>
              <div className="text-right" style={{ color: COLORS.oxblood }}>{Ff(calc.declaredRUB, 2)}</div>
            </>
          )}
          <div style={{ color: COLORS.inkSoft }}>{t("calcShipping")}</div><div className="text-right">{Ff(calcShipping(product, params))}</div>
          <div style={{ color: COLORS.inkSoft }}>{t("calcLabeling")}</div><div className="text-right">{Ff(params.labelingPerUnit)}</div>
          <div className="border-t pt-1" style={{ borderColor: COLORS.line }}>{t("calcUnitCost")}</div>
          <div className="text-right border-t pt-1" style={{ borderColor: COLORS.line }}>{Ff(calc.unitCost, 2)}</div>
          <div style={{ color: COLORS.inkSoft }}>{t("calcUnitPayout")}</div><div className="text-right">{Ff(calc.unitPayout)}</div>
          <div style={{ color: COLORS.inkSoft }}>{t("calcUnitGross")}</div><div className="text-right">{Ff(calc.unitPayout - calc.unitCost)}</div>
          <div className="border-t pt-1" style={{ borderColor: COLORS.line }}>{t("calcUnitNet")}</div>
          <div className="text-right border-t pt-1" style={{ borderColor: COLORS.line, color: calc.unitNetProfit > 0 ? COLORS.emerald : COLORS.crimson }}>
            {Ff(calc.unitNetProfit, 2)} ({fmt.fmtPrimaryFull(calc.unitNetProfit)})
          </div>
          {params.taxScheme === "osn" && (
            <>
              <div className="pt-2 mt-1 border-t" style={{ borderColor: COLORS.line, color: COLORS.oxblood }}>{t("calcInputVAT")}</div>
              <div className="text-right pt-2 mt-1 border-t" style={{ borderColor: COLORS.line, color: COLORS.oxblood }}>{Ff(calc.totalInputVAT / Math.max(1, product.qty), 2)}</div>
              <div style={{ color: COLORS.oxblood }}>{t("calcOutputVAT")}</div>
              <div className="text-right" style={{ color: COLORS.oxblood }}>{Ff(calc.totalOutputVAT / Math.max(1, calc.effectiveQty), 2)}</div>
            </>
          )}
        </div>
        <div className="text-[11px] flex flex-wrap gap-2">
          <Tag color={COLORS.emerald}>{t("tagMargin")} {fmtPct(calc.profitMargin)}</Tag>
          <Tag color={COLORS.gold}>ROI {fmtPct(calc.roi)}</Tag>
          <Tag>{t("tagEffQty")} {calc.effectiveQty.toFixed(1)}</Tag>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 销售排期 Tab（含售价/平台费排期）
// ============================================================
const ScheduleTab = ({ products, projection, setProjection, scheduleStore, updateSchedule, applyCurve,
  priceScheduleStore, setPriceScheduleStore, restockStore, updateRestock, setRestockStore,
  withdrawalStore, setWithdrawalStore, t, lang }) => {
  const months = projection.monthsHorizon;
  const totalAllProducts = products.reduce((a, b) => a + (b.qty || 0), 0);

  // 更新某SKU某月的售价
  const updatePrice = (productId, monthIdx, val) => {
    setPriceScheduleStore(s => {
      const entry = { ...(s[productId] || {}) };
      const arr = [...(entry.list || Array(months).fill(0))];
      while (arr.length < months) arr.push(0);
      arr[monthIdx] = Math.max(0, val);
      entry.list = arr;
      return { ...s, [productId]: entry };
    });
  };

  // 更新某SKU某月的平台费
  const updateFee = (productId, monthIdx, val) => {
    setPriceScheduleStore(s => {
      const entry = { ...(s[productId] || {}) };
      const arr = [...(entry.fee || Array(months).fill(0))];
      while (arr.length < months) arr.push(0);
      arr[monthIdx] = Math.max(0, val);
      entry.fee = arr;
      return { ...s, [productId]: entry };
    });
  };

  // 重置所有售价排期
  const resetPrices = () => {
    setPriceScheduleStore(s => {
      const next = { ...s };
      for (const id of Object.keys(next)) {
        if (next[id]) next[id] = { ...next[id], list: undefined };
      }
      return next;
    });
  };

  // 重置所有平台费排期
  const resetFees = () => {
    setPriceScheduleStore(s => {
      const next = { ...s };
      for (const id of Object.keys(next)) {
        if (next[id]) next[id] = { ...next[id], fee: undefined };
      }
      return next;
    });
  };

  // 折叠状态
  const [showPriceSchedule, setShowPriceSchedule] = useState(false);
  const [showFeeSchedule, setShowFeeSchedule] = useState(false);
  const [showRestockSchedule, setShowRestockSchedule] = useState(false);
  const [showWithdrawalSchedule, setShowWithdrawalSchedule] = useState(false);

  const updateWithdrawal = (monthIdx, val) => {
    setWithdrawalStore(s => {
      const arr = [...(s.amounts || Array(months).fill(0))];
      while (arr.length < months) arr.push(0);
      arr[monthIdx] = Math.max(0, val);
      return { ...s, amounts: arr };
    });
  };

  return (
    <div className="space-y-6 anim-in">
      {/* 销量排期标题 + 预测月数选择 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t("scheduleTitle")}</h2>
          <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{t("scheduleHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs" style={{ color: COLORS.inkSoft }}>{t("forecastMonths")}:</span>
          <select value={months} onChange={(e) => setProjection(p => ({ ...p, monthsHorizon: parseInt(e.target.value) }))}
            className="px-2 py-1.5 border bg-white text-xs font-mono"
            style={{ borderColor: COLORS.line, color: COLORS.ink }}>
            {[6, 8, 10, 12, 18, 24].map(n => <option key={n} value={n}>{n} {t("months")}</option>)}
          </select>
        </div>
      </div>

      {/* 销量分配快捷按钮 */}
      <div className="flex flex-wrap gap-2 items-center text-xs" style={{ color: COLORS.inkSoft }}>
        <Sparkles size={12} />
        <button onClick={() => applyCurve("linear")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white" }}>{t("linearDist")}</button>
        <button onClick={() => applyCurve("frontload")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white" }}>{t("frontload")}</button>
        <button onClick={() => applyCurve("bell")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white" }}>{t("bellCurve")}</button>
        <button onClick={() => applyCurve("reset")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white", color: COLORS.crimson }}>{t("resetDist")}</button>
      </div>

      {/* ===== 销量排期表格 ===== */}
      <div className="border overflow-x-auto" style={{ borderColor: COLORS.line, background: "white" }}>
        <table className="w-full text-xs">
          <thead style={{ background: COLORS.paper }}>
            <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
              <th className="text-left p-2 sticky left-0 z-10" style={{ background: COLORS.paper, minWidth: "120px" }}>{t("sku")}</th>
              <th className="text-right p-2" style={{ minWidth: "60px" }}>{t("total")}</th>
              {Array.from({ length: months }, (_, i) => (
                <th key={i} className="text-center p-2 font-mono" style={{ minWidth: "60px" }}>{t("monthLabel")}{i + 1}</th>
              ))}
              <th className="text-right p-2" style={{ minWidth: "70px" }}>{t("allocated")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const stored = scheduleStore[p.id];
              const sched = (Array.isArray(stored) && stored.length === months) ? stored : distributeEvenly(p.qty || 0, months);
              const allocated = sched.reduce((a, b) => a + (b || 0), 0);
              const matches = allocated === (p.qty || 0);
              return (
                <tr key={p.id} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                  <td className="p-2 font-mono sticky left-0 z-10" style={{ background: "white" }}>{p.id}</td>
                  <td className="p-2 text-right font-mono" style={{ color: COLORS.inkSoft }}>{p.qty}</td>
                  {sched.map((q, i) => (
                    <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                      <input type="number" value={q || 0} min="0"
                        onChange={(e) => updateSchedule(p.id, i, parseInt(e.target.value) || 0)} />
                    </td>
                  ))}
                  <td className="p-2 text-right font-mono font-semibold" style={{ color: matches ? COLORS.emerald : COLORS.crimson }}>
                    {allocated}/{p.qty}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot style={{ background: COLORS.paper }}>
            <tr className="font-semibold">
              <td className="p-2 sticky left-0" style={{ background: COLORS.paper }}>{t("total")}</td>
              <td className="p-2 text-right font-mono">{totalAllProducts}</td>
              {Array.from({ length: months }, (_, i) => {
                const sum = products.reduce((acc, p) => {
                  const stored = scheduleStore[p.id];
                  const sched = (Array.isArray(stored) && stored.length === months) ? stored : distributeEvenly(p.qty || 0, months);
                  return acc + (sched[i] || 0);
                }, 0);
                return <td key={i} className="p-2 text-center font-mono">{sum}</td>;
              })}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ===== 售价排期表格（可折叠） ===== */}
      <div className="border" style={{ borderColor: COLORS.line, background: "white" }}>
        <button
          onClick={() => setShowPriceSchedule(!showPriceSchedule)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          style={{ background: COLORS.paper }}
        >
          <div className="flex items-center gap-2">
            {showPriceSchedule ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <div>
              <span className="font-display font-semibold text-sm">{t("priceScheduleTitle")}</span>
              <span className="text-[10px] ml-2" style={{ color: COLORS.inkSoft }}>{t("priceScheduleHint")}</span>
            </div>
          </div>
          {showPriceSchedule && (
            <button onClick={(e) => { e.stopPropagation(); resetPrices(); }}
              className="px-2 py-1 text-[11px] border" style={{ borderColor: COLORS.crimson, color: COLORS.crimson }}>
              {t("resetPrices")}
            </button>
          )}
        </button>
        {showPriceSchedule && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: COLORS.paper }}>
                <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
                  <th className="text-left p-2 sticky left-0 z-10" style={{ background: COLORS.paper, minWidth: "120px" }}>{t("sku")}</th>
                  <th className="text-right p-2" style={{ minWidth: "60px" }}>{t("defaultPrice")}</th>
                  {Array.from({ length: months }, (_, i) => (
                    <th key={i} className="text-center p-2 font-mono" style={{ minWidth: "70px" }}>{t("monthLabel")}{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const entry = priceScheduleStore[p.id];
                  const listArr = entry?.list || [];
                  return (
                    <tr key={p.id} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                      <td className="p-2 font-mono sticky left-0 z-10" style={{ background: "white" }}>{p.id}</td>
                      <td className="p-2 text-right font-mono" style={{ color: COLORS.inkSoft }}>{(p.list || 0).toLocaleString("ru-RU")}</td>
                      {Array.from({ length: months }, (_, i) => {
                        const v = listArr[i] || 0;
                        const isCustom = v > 0 && v !== (p.list || 0);
                        return (
                          <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                            <input type="number" value={v || ""} min="0"
                              placeholder={String(p.list || 0)}
                              onChange={(e) => updatePrice(p.id, i, parseInt(e.target.value) || 0)}
                              style={{ color: isCustom ? COLORS.oxblood : undefined, fontWeight: isCustom ? 600 : undefined }} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== 平台费排期表格（可折叠） ===== */}
      <div className="border" style={{ borderColor: COLORS.line, background: "white" }}>
        <button
          onClick={() => setShowFeeSchedule(!showFeeSchedule)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          style={{ background: COLORS.paper }}
        >
          <div className="flex items-center gap-2">
            {showFeeSchedule ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <div>
              <span className="font-display font-semibold text-sm">{t("feeScheduleTitle")}</span>
              <span className="text-[10px] ml-2" style={{ color: COLORS.inkSoft }}>{t("feeScheduleHint")}</span>
            </div>
          </div>
          {showFeeSchedule && (
            <button onClick={(e) => { e.stopPropagation(); resetFees(); }}
              className="px-2 py-1 text-[11px] border" style={{ borderColor: COLORS.crimson, color: COLORS.crimson }}>
              {t("resetFees")}
            </button>
          )}
        </button>
        {showFeeSchedule && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: COLORS.paper }}>
                <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
                  <th className="text-left p-2 sticky left-0 z-10" style={{ background: COLORS.paper, minWidth: "120px" }}>{t("sku")}</th>
                  <th className="text-right p-2" style={{ minWidth: "60px" }}>{t("defaultPrice")}</th>
                  {Array.from({ length: months }, (_, i) => (
                    <th key={i} className="text-center p-2 font-mono" style={{ minWidth: "70px" }}>{t("monthLabel")}{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const entry = priceScheduleStore[p.id];
                  const feeArr = entry?.fee || [];
                  return (
                    <tr key={p.id} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                      <td className="p-2 font-mono sticky left-0 z-10" style={{ background: "white" }}>{p.id}</td>
                      <td className="p-2 text-right font-mono" style={{ color: COLORS.inkSoft }}>{(p.platformFee || 0).toLocaleString("ru-RU")}</td>
                      {Array.from({ length: months }, (_, i) => {
                        const v = feeArr[i] || 0;
                        const isCustom = v > 0 && v !== (p.platformFee || 0);
                        return (
                          <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                            <input type="number" value={v || ""} min="0"
                              placeholder={String(p.platformFee || 0)}
                              onChange={(e) => updateFee(p.id, i, parseInt(e.target.value) || 0)}
                              style={{ color: isCustom ? COLORS.gold : undefined, fontWeight: isCustom ? 600 : undefined }} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===== 补货排期 ===== */}
      <div className="border" style={{ borderColor: COLORS.line, background: 'white' }}>
        <button className="w-full text-left p-3 flex items-center justify-between text-sm font-semibold"
          onClick={() => setShowRestockSchedule(v => !v)} style={{ color: COLORS.ink }}>
          <span>{t("restockTitle")}</span>
          <span className="text-[10px] font-mono" style={{ color: COLORS.inkSoft }}>{showRestockSchedule ? '▲' : '▼'}</span>
        </button>
        {showRestockSchedule && (
          <div className="border-t overflow-x-auto" style={{ borderColor: COLORS.line }}>
            <div className="px-3 py-2 text-xs" style={{ color: COLORS.inkSoft, background: COLORS.paper }}>
              {t("restockHint")}
              <button onClick={() => setRestockStore({})} className="ml-3 px-2 py-0.5 border text-[10px]"
                style={{ borderColor: COLORS.line, color: COLORS.crimson }}>{t("resetRestock")}</button>
            </div>
            <table className="w-full text-xs">
              <thead style={{ background: COLORS.paper }}>
                <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
                  <th className="text-left p-2 sticky left-0 z-10" style={{ background: COLORS.paper, minWidth: '120px' }}>{t("sku")}</th>
                  <th className="text-center p-2" style={{ minWidth: '60px', color: COLORS.oxblood }}>{t("initialBatch")}</th>
                  {Array.from({ length: months }, (_, i) => (
                    <th key={i} className="text-center p-2 font-mono" style={{ minWidth: '60px' }}>{t("monthLabel")}{i + 1}</th>
                  ))}
                  <th className="text-right p-2" style={{ minWidth: '70px' }}>{t("totalPurchased")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const rSched = restockStore[p.id] || [p.qty || 0, ...Array(months).fill(0)];
                  const totalPurchased = rSched.reduce((a, b) => a + (b || 0), 0);
                  return (
                    <tr key={p.id} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                      <td className="p-2 font-mono sticky left-0 z-10" style={{ background: 'white' }}>{p.id}</td>
                      <td className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line, background: 'rgba(164,25,61,0.04)' }}>
                        <input type="number" value={rSched[0] || 0} min="0"
                          onChange={(e) => updateRestock(p.id, 0, parseInt(e.target.value) || 0)}
                          style={{ color: COLORS.oxblood, fontWeight: 600 }} />
                      </td>
                      {Array.from({ length: months }, (_, i) => {
                        const v = rSched[i + 1] || 0;
                        return (
                          <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                            <input type="number" value={v || 0} min="0"
                              onChange={(e) => updateRestock(p.id, i + 1, parseInt(e.target.value) || 0)}
                              style={{ color: v > 0 ? COLORS.emerald : undefined, fontWeight: v > 0 ? 600 : undefined }} />
                          </td>
                        );
                      })}
                      <td className="p-2 text-right font-mono font-semibold" style={{ color: COLORS.ink }}>
                        {totalPurchased}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: COLORS.paper }}>
                <tr className="font-semibold">
                  <td className="p-2 sticky left-0" style={{ background: COLORS.paper }}>{t("total")}</td>
                  <td className="p-2 text-center font-mono" style={{ color: COLORS.oxblood }}>
                    {products.reduce((acc, p) => acc + ((restockStore[p.id] || [p.qty || 0])[0] || 0), 0)}
                  </td>
                  {Array.from({ length: months }, (_, i) => {
                    const sum = products.reduce((acc, p) => {
                      const rSched = restockStore[p.id] || [p.qty || 0, ...Array(months).fill(0)];
                      return acc + (rSched[i + 1] || 0);
                    }, 0);
                    return <td key={i} className="p-2 text-center font-mono" style={{ color: sum > 0 ? COLORS.emerald : undefined }}>{sum}</td>;
                  })}
                  <td className="p-2 text-right font-mono">
                    {products.reduce((acc, p) => {
                      const rSched = restockStore[p.id] || [p.qty || 0, ...Array(months).fill(0)];
                      return acc + rSched.reduce((a, b) => a + (b || 0), 0);
                    }, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ===== 分润排期 ===== */}
      <div className="border" style={{ borderColor: COLORS.line, background: 'white' }}>
        <button className="w-full text-left p-3 flex items-center justify-between text-sm font-semibold"
          onClick={() => setShowWithdrawalSchedule(v => !v)} style={{ color: COLORS.ink }}>
          <span>{t("withdrawalTitle")}</span>
          <span className="text-[10px] font-mono" style={{ color: COLORS.inkSoft }}>{showWithdrawalSchedule ? '▲' : '▼'}</span>
        </button>
        {showWithdrawalSchedule && (
          <div className="border-t overflow-x-auto" style={{ borderColor: COLORS.line }}>
            <div className="px-3 py-2 text-xs" style={{ color: COLORS.inkSoft, background: COLORS.paper }}>
              {t("withdrawalHint")}
              <button onClick={() => setWithdrawalStore({ amounts: [] })} className="ml-3 px-2 py-0.5 border text-[10px]"
                style={{ borderColor: COLORS.line, color: COLORS.crimson }}>{t("resetWithdrawal")}</button>
            </div>
            <table className="w-full text-xs">
              <thead style={{ background: COLORS.paper }}>
                <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
                  <th className="text-left p-2 sticky left-0 z-10" style={{ background: COLORS.paper, minWidth: '120px' }}>{t("withdrawalLabel")}</th>
                  {Array.from({ length: months }, (_, i) => (
                    <th key={i} className="text-center p-2 font-mono" style={{ minWidth: '80px' }}>{t("monthLabel")}{i + 1}</th>
                  ))}
                  <th className="text-right p-2" style={{ minWidth: '80px' }}>{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                  <td className="p-2 font-mono sticky left-0 z-10" style={{ background: 'white' }}>{t("withdrawalAmount")}</td>
                  {Array.from({ length: months }, (_, i) => {
                    const v = (withdrawalStore?.amounts?.[i]) || 0;
                    return (
                      <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                        <input type="number" value={v || 0} min="0" step="1000"
                          onChange={(e) => updateWithdrawal(i, parseInt(e.target.value) || 0)}
                          style={{ color: v > 0 ? COLORS.emerald : undefined, fontWeight: v > 0 ? 600 : undefined }} />
                      </td>
                    );
                  })}
                  <td className="p-2 text-right font-mono font-semibold" style={{ color: COLORS.emerald }}>
                    {((withdrawalStore?.amounts || []).reduce((a, b) => a + (b || 0), 0)).toLocaleString('ru-RU')}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="px-3 py-2 text-[10px]" style={{ color: COLORS.inkSoft, background: COLORS.paper }}>
              {t("withdrawalSplitNote", { pct: projection.partnerSharePct || 0 })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// ============================================================
// VAT 阈值监控（动态税档）
// ============================================================
const VATThresholdMonitor = ({ proj, projection, updateProj, params, t }) => {
  const final = proj.finalCumRevenue || 0;
  const T1 = 20_000_000, T2 = 250_000_000, T3 = 450_000_000;
  const condEnd = Math.max(final * 1.1, 30_000_000);
  const pctOf = (v) => (Math.min(v, condEnd) / condEnd * 100);
  const isUSN = params.taxScheme === "usn_6" || params.taxScheme === "usn_15";

  return (
    <div className="space-y-4">
      {isUSN ? (
        <div className="flex items-start gap-3 p-3 border" style={{ borderColor: COLORS.line, background: "white" }}>
          <input
            type="checkbox"
            checked={!!projection.autoVATEscalation}
            onChange={(e) => updateProj("autoVATEscalation", e.target.checked)}
            className="mt-1 cursor-pointer"
            style={{ accentColor: COLORS.oxblood, width: 16, height: 16 }}
          />
          <div className="flex-1">
            <div className="font-semibold text-sm">{t("vatAutoTrigger")}</div>
            <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
              {t("vatAutoDesc")}
              <strong> 0–20M</strong>{t("vatTier0Desc")};
              <strong style={{ color: COLORS.gold }}> 20M–250M</strong>{t("vatTier1Desc")};
              <strong style={{ color: COLORS.oxbloodSoft }}> 250M–450M</strong>{t("vatTier2Desc")};
              <strong style={{ color: COLORS.crimson }}> 450M+</strong>{t("vatTier3Desc")}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs p-3 border" style={{ borderColor: COLORS.line, background: COLORS.paper, color: COLORS.inkSoft }}>
          <Info size={12} className="inline mr-1" />
          {t("vatFixedNote")} <strong style={{ color: COLORS.oxblood }}>{TAX_SCHEMES[params.taxScheme].short}</strong>.
          {" "}{t("vatSwitchHint")}
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.inkSoft }}>{t("vatCumRevenue")}</div>
          <div className="font-display text-xl font-semibold number-pill" style={{ color: COLORS.ink }}>
            {fmtRubShort(final)}
          </div>
        </div>
        <div className="relative h-7 w-full" style={{ background: COLORS.paper, border: `1px solid ${COLORS.line}` }}>
          <div className="absolute h-full" style={{ left: 0, width: `${pctOf(T1)}%`, background: "rgba(31,79,46,0.10)" }} />
          <div className="absolute h-full" style={{ left: `${pctOf(T1)}%`, width: `${pctOf(T2) - pctOf(T1)}%`, background: "rgba(184,134,11,0.10)" }} />
          <div className="absolute h-full" style={{ left: `${pctOf(T2)}%`, width: `${pctOf(T3) - pctOf(T2)}%`, background: "rgba(122,42,44,0.12)" }} />
          <div className="absolute h-full" style={{ left: `${pctOf(T3)}%`, right: 0, background: "rgba(164,25,61,0.18)" }} />
          <div className="absolute h-full" style={{ left: 0, width: `${pctOf(final)}%`, background: COLORS.oxblood, opacity: 0.7 }} />
          {[T1, T2, T3].map((th, i) => (
            <div key={i} className="absolute h-full" style={{ left: `${pctOf(th)}%`, width: 2, background: COLORS.ink }} />
          ))}
        </div>
        <div className="flex text-[10px] mt-1.5 font-mono" style={{ color: COLORS.inkSoft }}>
          <div style={{ width: `${pctOf(T1)}%` }}>0</div>
          <div style={{ width: `${pctOf(T2) - pctOf(T1)}%`, textAlign: "left" }}>20M</div>
          <div style={{ width: `${pctOf(T3) - pctOf(T2)}%`, textAlign: "left" }}>250M</div>
          <div style={{ flex: 1, textAlign: "left" }}>450M</div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
          <Tag color={COLORS.emerald}>{t("vatTagNoVat")}</Tag>
          <Tag color={COLORS.gold}>{t("vatTag5")}</Tag>
          <Tag color={COLORS.oxbloodSoft}>{t("vatTag7")}</Tag>
          <Tag color={COLORS.crimson}>{t("vatTagOsn")}</Tag>
        </div>
      </div>

      {projection.autoVATEscalation && isUSN && proj.vatTriggered && (
        <div className="p-3 border-l-2" style={{ borderColor: COLORS.crimson, background: "rgba(164,25,61,0.05)" }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={16} style={{ color: COLORS.crimson, flexShrink: 0, marginTop: 2 }} />
            <div className="flex-1 text-sm">
              <div className="font-semibold" style={{ color: COLORS.crimson }}>
                {t("vatTriggeredTitle", { n: proj.vatTriggerMonth })}
              </div>
              <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
                {t("vatTriggeredDesc1", { n: proj.vatTriggerMonth })}
                {" "}{t("vatTriggeredDesc2")}
                {" "}{t("vatTriggeredTotal")}<strong style={{ color: COLORS.crimson }}>{fmtRubShort(proj.totalVAT)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
      {projection.autoVATEscalation && isUSN && !proj.vatTriggered && final > 0 && (
        <div className="p-3 border-l-2" style={{ borderColor: COLORS.emerald, background: "rgba(31,79,46,0.05)" }}>
          <div className="flex items-start gap-2">
            <Sparkles size={16} style={{ color: COLORS.emerald, flexShrink: 0, marginTop: 2 }} />
            <div className="flex-1 text-sm">
              <div className="font-semibold" style={{ color: COLORS.emerald }}>{t("vatNotTriggered")}</div>
              <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
                {t("vatDistanceHint", { amount: fmtRubShort(T1 - final) })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// 现金流 Tab
// ============================================================
const ProjectionTab = ({ proj, projection, setProjection, params, t, lang, fmt }) => {
  const updateProj = (k, v) => setProjection(p => ({ ...p, [k]: v }));
  const F = fmt.fmtPrimary, Fs = fmt.fmtSecondary;
  return (
    <div className="space-y-6 anim-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 border" style={{ borderColor: COLORS.line, background: "white" }}>
          <Metric label={t("currentMonth")}
            value={proj.breakEvenMonth ? t("monthN", { n: proj.breakEvenMonth }) : "—"}
            sub={proj.breakEvenMonth ? t("breakEvenMsg", { n: proj.breakEvenMonth }) : t("noBreakEven")}
            color={proj.breakEvenMonth ? COLORS.emerald : COLORS.crimson} big />
        </div>
        <div className="p-5 border" style={{ borderColor: COLORS.line, background: "white" }}>
          <Metric label={t("maxInvestment")} value={F(proj.maxDrawdown)}
            sub={Fs(proj.maxDrawdown)} color={COLORS.crimson} big />
        </div>
        <div className="p-5 border-2" style={{ borderColor: proj.finalCash >= 0 ? COLORS.emerald : COLORS.crimson, background: "white" }}>
          <Metric label={t("cashBalance")} value={F(proj.finalCash)}
            sub={Fs(proj.finalCash)}
            color={proj.finalCash >= 0 ? COLORS.emerald : COLORS.crimson} big />
        </div>
        <div className="p-5 border" style={{ borderColor: COLORS.line, background: "white" }}>
          <Metric label={t("totalTax")} value={F(proj.totalTax)}
            sub={`${t("effectiveRate")} ${fmtPct(proj.totalRevenue > 0 ? proj.totalTax / proj.totalRevenue : 0)}`}
            color={COLORS.gold} big />
        </div>
      </div>

      <Card kicker="VAT Threshold · 2026" title={t("vatThreshold")}>
        <VATThresholdMonitor proj={proj} projection={projection} updateProj={updateProj} params={params} t={t} />
      </Card>

      <Card kicker="Cumulative Cash" title={t("cumCashChart")}>
        <CashFlowChart proj={proj} t={t} fmt={fmt} />
      </Card>

      <Card kicker="Monthly P&L" title={t("monthlyNetProfit")}>
        <MonthlyPnLChart proj={proj} t={t} fmt={fmt} />
      </Card>

      <Card kicker="Projection" title={t("projParams")}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("projMonths")}</label>
            <NumInput value={projection.monthsHorizon} onChange={(v) => updateProj("monthsHorizon", Math.max(1, Math.min(36, v)))} suffix={t("months")} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("partnerShare")}</label>
            <NumInput value={projection.partnerSharePct} onChange={(v) => updateProj("partnerSharePct", Math.max(0, Math.min(100, v)))} suffix="%" step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("fixedCost")}</label>
            <NumInput value={projection.monthlyFixedCost} onChange={(v) => updateProj("monthlyFixedCost", Math.max(0, v))} suffix="₽" step={1000} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("priorRevenue")}</label>
            <NumInput value={projection.priorYearRevenue} onChange={(v) => updateProj("priorYearRevenue", Math.max(0, v))} suffix="₽" step={100000} className="mt-1" />
          </div>
        </div>
        <div className="mt-3 text-xs" style={{ color: COLORS.inkSoft }}>
          <Info size={12} className="inline mr-1" />
          {t("projTaxNote")}
          {params.taxScheme === "osn" && (
            <span style={{ color: COLORS.oxblood }}>
              {" "}{t("projInputVATNote")}
              {proj.leftoverInputVAT > 0 ? t("projInputVATLeft", { amount: F(proj.leftoverInputVAT) }) : t("projInputVATUsed")}.
            </span>
          )}
        </div>
      </Card>

      <Card kicker="Monthly P&L" title={t("cashFlowDetail")}>
        <div className="text-xs mb-3 p-2 border-l-2" style={{ borderColor: COLORS.gold, background: COLORS.paper, color: COLORS.inkSoft }}>
          <Info size={12} className="inline mr-1" />
          <strong style={{ color: COLORS.ink }}>{t("projCashVsPnl")}</strong>
          <br />· <strong>{t("projNetLabel")}</strong> {t("projNetDesc")}
          <br />· <strong>{t("projCashLabel")}</strong> {t("projCashDesc")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: "1350px" }}>
            <thead style={{ background: COLORS.paper }}>
              <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
                <th className="text-left p-2">{t("thMonth")}</th>
                <th className="text-left p-2">{t("thTaxTier")}</th>
                <th className="text-right p-2">{t("colRestock")}</th>
                <th className="text-right p-2">{t("colStock")}</th>
                <th className="text-right p-2">{t("thSoldQtyD")}</th>
                <th className="text-right p-2">{t("thRevenueD")}</th>
                <th className="text-right p-2">{t("thCogsD")}</th>
                <th className="text-right p-2">{t("thWhMgmt")}</th>
                <th className="text-right p-2">{t("thFixedCost")}</th>
                <th className="text-right p-2">{t("thTax")}</th>
                <th className="text-right p-2 border-l" style={{ borderColor: COLORS.line }}>{t("thMonthlyNet")}</th>
                <th className="text-right p-2">{t("thPartner")}</th>
                <th className="text-right p-2">{t("thCashFlowD")}</th>
                <th className="text-right p-2 border-l" style={{ borderColor: COLORS.line }}>{t("thCumCashD")}</th>
              </tr>
            </thead>
            <tbody>
              {proj.months.map(m => (
                <tr key={m.label} className="border-t ledger-row" style={{ borderColor: COLORS.line, background: m.isInitial ? "rgba(164,25,61,0.04)" : "transparent" }}>
                  <td className="p-2 font-mono font-semibold">
                    {m.label}{m.isInitial && <span className="ml-1 text-[10px]" style={{ color: COLORS.crimson }}>{t("investLabel")}</span>}
                  </td>
                  <td className="p-2 text-[10px]" style={{ color: m.vatTierKey && (m.vatTierKey === "vatLabelVat5" || m.vatTierKey === "vatLabelVat7" || m.vatTierKey === "vatLabelOsn22") ? COLORS.crimson : COLORS.inkSoft }}>
                    {m.isInitial ? "—" : (m.vatTierKey ? t(m.vatTierKey, m.vatTierKey === "vatLabelFixedOsn" ? { rate: (m.vatRate*100).toFixed(0) } : {}) : "—")}
                  </td>
                  <td className="p-2 text-right font-mono text-[10px]" style={{ color: m.restockQty > 0 ? COLORS.crimson : COLORS.inkSoft }}>
                    {m.restockQty > 0 ? `+${m.restockQty}` : "—"}
                    {m.restockCost > 0 && !m.isInitial && <div className="text-[9px]" style={{ color: COLORS.crimson }}>-{F(m.restockCost)}</div>}
                  </td>
                  <td className="p-2 text-right font-mono" style={{ color: m.stockWarning ? COLORS.crimson : COLORS.inkSoft }}>
                    {m.stockEnd}{m.stockWarning && <span className="ml-1 text-[9px]">⚠</span>}
                  </td>
                  <td className="p-2 text-right font-mono">{m.soldQty || "—"}</td>
                  <td className="p-2 text-right font-mono">{m.revenue ? F(m.revenue) : "—"}</td>
                  <td className="p-2 text-right font-mono">{m.cogs ? F(m.cogs) : (m.isInitial ? F(-(proj.initialOutflow - (m.importVAT || 0))) : "—")}</td>
                  <td className="p-2 text-right font-mono">{m.expenses ? F(m.expenses) : "—"}</td>
                  <td className="p-2 text-right font-mono">{m.fixedCost ? F(m.fixedCost) : "—"}</td>
                  <td className="p-2 text-right font-mono" style={{ color: m.tax > 0 ? COLORS.crimson : COLORS.inkSoft }}>{m.tax ? F(m.tax) : "—"}</td>
                  <td className="p-2 text-right font-mono font-semibold border-l" style={{ borderColor: COLORS.line, color: m.netProfit >= 0 ? COLORS.emerald : COLORS.crimson }}>
                    {F(m.netProfit)}
                  </td>
                  <td className="p-2 text-right font-mono">{m.partnerPayout ? F(m.partnerPayout) : "—"}</td>
                  <td className="p-2 text-right font-mono" style={{ color: m.cashFlow >= 0 ? COLORS.emerald : COLORS.crimson }}>{F(m.cashFlow)}</td>
                  <td className="p-2 text-right font-mono font-semibold border-l" style={{ borderColor: COLORS.line, color: m.cumCash >= 0 ? COLORS.emerald : COLORS.crimson }}>
                    {F(m.cumCash)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot style={{ background: COLORS.paper }}>
              <tr className="font-semibold">
                <td className="p-2">{t("totalRow")}</td>
                <td className="p-2"></td>
                <td className="p-2 text-right font-mono" style={{ color: COLORS.crimson }}>
                  {proj.months.reduce((a, b) => a + (b.restockQty || 0), 0)}
                </td>
                <td className="p-2 text-right font-mono">
                  {proj.months.length > 0 ? proj.months[proj.months.length - 1].stockEnd : 0}
                </td>
                <td className="p-2 text-right font-mono">{proj.months.reduce((a, b) => a + b.soldQty, 0)}</td>
                <td className="p-2 text-right font-mono">{F(proj.totalRevenue)}</td>
                <td colSpan={3}></td>
                <td className="p-2 text-right font-mono" style={{ color: COLORS.crimson }}>{F(proj.totalTax)}</td>
                <td className="p-2 text-right font-mono border-l" style={{ borderColor: COLORS.line, color: proj.totalNetProfit >= 0 ? COLORS.emerald : COLORS.crimson }}>
                  {F(proj.totalNetProfit)}
                </td>
                <td className="p-2 text-right font-mono">{F(proj.totalPartnerPayout)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ============================================================
// 设置 Tab
// ============================================================
const SettingsTab = ({ params, setParams, t, lang, rateSource, setRateSource, liveRate, effectiveRate, fetchRate }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 anim-in">
    <Card kicker={t("taxRegimeKicker")} title={t("taxRegime")}>
      <TaxSchemePicker params={params} setParams={setParams} t={t} />
    </Card>
    <Card kicker={t("globalParamsKicker")} title={t("globalParams")}>
      <ParamsPanel params={params} setParams={setParams} t={t} rateSource={rateSource} setRateSource={setRateSource} liveRate={liveRate} effectiveRate={effectiveRate} fetchRate={fetchRate} />
    </Card>
    <Card kicker={t("incomeBasisKicker")} title={t("incomeBasis")} className="lg:col-span-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { id: "payout", label: t("basisPayout"), desc: t("basisPayoutDesc") },
          { id: "list", label: t("basisList"), desc: t("basisListDesc") },
        ].map(opt => (
          <button key={opt.id} onClick={() => setParams(p => ({ ...p, incomeBasis: opt.id }))}
            className="text-left p-3 border-2"
            style={{
              borderColor: params.incomeBasis === opt.id ? COLORS.oxblood : COLORS.line,
              background: params.incomeBasis === opt.id ? "rgba(92,26,27,0.04)" : "white",
            }}>
            <div className="font-semibold text-sm">{opt.label}</div>
            <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{opt.desc}</div>
          </button>
        ))}
      </div>
    </Card>
  </div>
);

const TaxSchemePicker = ({ params, setParams, t }) => (
  <div className="space-y-3">
    {Object.entries(TAX_SCHEMES).map(([k, v]) => (
      <button key={k} onClick={() => setParams(p => ({ ...p, taxScheme: k }))}
        className="w-full text-left p-3 border-2"
        style={{
          borderColor: params.taxScheme === k ? COLORS.oxblood : COLORS.line,
          background: params.taxScheme === k ? "rgba(92,26,27,0.04)" : "white",
        }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="font-semibold text-sm">{t(v.labelKey)}</div>
            <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{t(v.descKey)}</div>
          </div>
          <Tag color={params.taxScheme === k ? COLORS.oxblood : COLORS.inkSoft}>{v.short}</Tag>
        </div>
      </button>
    ))}
    {params.taxScheme === "custom" && (
      <div className="pt-3 border-t" style={{ borderColor: COLORS.line }}>
        <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("customTaxRateLabel")}</label>
        <NumInput value={params.customTaxRate * 100} onChange={(v) => setParams(p => ({ ...p, customTaxRate: v / 100 }))} suffix="%" step={0.1} className="mt-1" />
      </div>
    )}
    {params.taxScheme === "osn" && (
      <div className="pt-3 border-t space-y-2" style={{ borderColor: COLORS.line }}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("vatRateLabel")}</label>
            <NumInput value={params.vatRate * 100} onChange={(v) => setParams(p => ({ ...p, vatRate: v / 100 }))} suffix="%" step={0.5} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("profitTaxLabel")}</label>
            <NumInput value={params.profitTaxRate * 100} onChange={(v) => setParams(p => ({ ...p, profitTaxRate: v / 100 }))} suffix="%" step={0.5} className="mt-1" />
          </div>
        </div>
        <div className="text-xs p-2" style={{ background: "rgba(184,134,11,0.08)", color: COLORS.ink }}>
          <Info size={11} className="inline mr-1" />
          {t("osnNote")}
        </div>
      </div>
    )}
  </div>
);

const ParamsPanel = ({ params, setParams, t }) => {
  const items = [
    { label: t("paramExchangeRate"), k: "exchangeRate", suffix: "₽/¥", step: 0.1 },
    { label: t("paramUsdRate"), k: "usdRate", suffix: "₽/$", step: 0.5 },
    { label: t("paramDamageRate"), k: "damageRate", suffix: "%", step: 0.5, multiplier: 100 },
    { label: t("paramLabeling"), k: "labelingPerUnit", suffix: "₽" },
    { label: t("paramOneTime"), k: "oneTimeCosts", suffix: "₽", step: 100 },
  ];
  return (
    <div className="space-y-3">
      {items.map(it => (
        <div key={it.k}>
          <label className="text-xs" style={{ color: COLORS.inkSoft }}>{it.label}</label>
          <NumInput value={it.multiplier ? params[it.k] * it.multiplier : params[it.k]}
            onChange={(v) => setParams(p => ({ ...p, [it.k]: it.multiplier ? v / it.multiplier : v }))}
            suffix={it.suffix} step={it.step || 1} className="mt-1" />
        </div>
      ))}
      {/* Shipping section */}
      <div className="pt-3 mt-2 border-t" style={{ borderColor: COLORS.line }}>
        <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: COLORS.gold }}>{t("shippingMode")}</div>
        <div className="space-y-2">
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("paramShipping")} ({t("shippingManual")})</label>
            <NumInput value={params.shippingPerUnit} onChange={(v) => setParams(p => ({ ...p, shippingPerUnit: v }))} suffix="₽/件" step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("grayShipPrice")}</label>
            <NumInput value={params.grayShipPrice} onChange={(v) => setParams(p => ({ ...p, grayShipPrice: v }))} suffix="¥/kg" step={0.5} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("whiteShipPrice")}</label>
            <NumInput value={params.whiteShipPrice} onChange={(v) => setParams(p => ({ ...p, whiteShipPrice: v }))} suffix="¥/m³" step={10} className="mt-1" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 帮助
// ============================================================
const HelpPanel = ({ t }) => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 anim-in">
    <Card kicker="2026 Reform" title={t("helpTitle")} className="lg:col-span-2">
      <div className="space-y-4 text-sm">
        <div>
          <div className="font-display font-semibold text-base mb-1">{t("helpVatTitle")}</div>
          <p style={{ color: COLORS.inkSoft }}>{t("helpVatDesc")}</p>
        </div>
        <div>
          <div className="font-display font-semibold text-base mb-1">{t("helpUsnTitle")}</div>
          <ul className="list-disc list-inside space-y-1" style={{ color: COLORS.inkSoft }}>
            <li>2025: 60M ₽</li>
            <li className="font-semibold" style={{ color: COLORS.oxblood }}>2026: 20M ₽</li>
            <li>2027: 15M ₽</li>
            <li>2028: 10M ₽</li>
          </ul>
          <p className="mt-2" style={{ color: COLORS.inkSoft }}>{t("helpUsnDesc")}</p>
        </div>
        <div>
          <div className="font-display font-semibold text-base mb-1">{t("helpUsnBaseTitle")}</div>
          <p style={{ color: COLORS.inkSoft }}>{t("helpUsnBaseDesc")}</p>
        </div>
        <div>
          <div className="font-display font-semibold text-base mb-1">{t("helpProfitTitle")}</div>
          <p style={{ color: COLORS.inkSoft }}>{t("helpProfitDesc")}</p>
        </div>
        <div>
          <div className="font-display font-semibold text-base mb-1">{t("helpVat22Title")}</div>
          <p style={{ color: COLORS.inkSoft }}>{t("helpVat22Desc")}</p>
        </div>
      </div>
    </Card>

    <Card kicker="Practical Tips" title={t("helpPractical")}>
      <div className="space-y-3 text-sm">
        <div className="p-3 border-l-2" style={{ borderColor: COLORS.gold, background: COLORS.paper }}>
          <div className="font-semibold mb-1">{t("helpDeclaredTitle")}</div>
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>{t("helpDeclaredDesc")}</p>
        </div>
        <div className="p-3 border-l-2" style={{ borderColor: COLORS.crimson, background: COLORS.paper }}>
          <div className="font-semibold mb-1">{t("helpThresholdTitle")}</div>
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>{t("helpThresholdDesc")}</p>
        </div>
        <div className="p-3 border-l-2" style={{ borderColor: COLORS.emerald, background: COLORS.paper }}>
          <div className="font-semibold mb-1">{t("helpUsn6v15Title")}</div>
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>{t("helpUsn6v15Desc")}</p>
        </div>
        <div className="p-3 border-l-2" style={{ borderColor: COLORS.oxblood, background: COLORS.paper }}>
          <div className="font-semibold mb-1">{t("helpDamageTitle")}</div>
          <p className="text-xs" style={{ color: COLORS.inkSoft }}>{t("helpDamageDesc")}</p>
        </div>
      </div>
    </Card>
  </div>
);

// ============================================================
// 术语词典
// ============================================================
const GLOSSARY = {
  zh: [
    { section: "📊 总览仪表盘", items: [
      { term: "总营收", desc: "所有商品卖出后，平台打给你的总金额（售价 − 平台佣金）。", example: "商品售价 1249₽，平台费 652₽ → 单件回款 597₽。30件 → 总营收 = 597 × 30 × 97%（扣货损）= 17,373₽" },
      { term: "总投资", desc: "你实际掏出去的所有钱：采购成本 + 到俄运费 + 一次性费用。", example: "采购价 17.65¥ × 汇率12 = 211.8₽，运费 100₽ → 单件成本 311.8₽。30件 → 投资 = 9,354₽" },
      { term: "现金净利", desc: "按每个SKU单独算税后汇总的利润。= 总营收 − 总投资 − 仓储 − 管理费 − 税。", example: "营收 17,373₽ − 投资 9,354₽ − 仓 2,970₽ − 管理 1,080₽ − 税 580₽ = 净利 3,389₽" },
      { term: "期末现金", desc: "经过N个月销售排期后，你账上实际还剩多少钱。按月度累计计算。", example: "M0投入 -108万₽ → M1回款+15万 → M2回款+20万 → ... → M8累计 = +57.5万₽" },
      { term: "⚠️ 现金净利 vs 期末现金", desc: "两个数不一样是正常的！现金净利是按每个SKU单独算税再汇总；期末现金是按月合算税。月合算时税额可能更低，所以期末现金通常略高。", example: "38个SKU单独算税各交一点最低税 → 总税高；按月合在一起算 → 利润合并后不触发最低税 → 总税低 → 到手多" },
      { term: "ROI（投资回报率）", desc: "每投入1块钱能赚回多少。= 净利润 ÷ 总投资 × 100%", example: "投资10万₽，净赚4.7万₽ → ROI = 47%。意思是每投1卢布赚回0.47卢布" },
      { term: "净利率", desc: "每赚100块营收里有多少是纯利润。= 净利润 ÷ 总营收 × 100%", example: "营收21万₽，净利4.7万₽ → 净利率 = 22.3%。每100₽营收中22.3₽是纯利" },
    ]},
    { section: "📈 投资人关注", items: [
      { term: "初始投入", desc: "M0（第零个月）你要一次性掏出的全部钱：所有商品的采购+运费+一次性费用+进项VAT（如果是OSN）。", example: "38个SKU总采购运费108万₽ → 初始投入 = -108万₽" },
      { term: "最大资金压力（回撤）", desc: "整个预测期内，你账上最缺钱的那一刻。通常就是M0刚付完货款的时候。", example: "M0付完108万₽，账上 -108万₽ → 这就是最大回撤" },
      { term: "回本月份", desc: "累计现金从负变正的那个月。之前都是亏的，从这个月开始你把本钱赚回来了。", example: "M5累计 -5万₽，M6累计 +2万₽ → 第6个月回本" },
      { term: "平均月回款", desc: "总营收 ÷ 预测月数。代表平均每个月能收回多少钱。", example: "总营收230万₽ ÷ 8个月 = 平均每月28.7万₽" },
    ]},
    { section: "🏷️ 商品明细", items: [
      { term: "实际采购价 vs 申报价", desc: "实际采购价 = 你真正付给工厂的钱。申报价 = 报关时写的价格（可能低于实际价）。OSN税制下，进项VAT按申报价算。", example: "实际买20¥，报关写15¥ → 进项VAT按15¥算，差额5¥不能抵税" },
      { term: "平台费", desc: "Ozon/WB等平台从每笔订单中扣取的佣金（含物流费、广告费等）。", example: "售价1249₽，平台费652₽ → 你实际到手 597₽" },
      { term: "仓费 + 管理费", desc: "仓费 = 海外仓存储费/件。管理费 = 代运营/标签/客服等费用/件。", example: "仓费99₽/件 + 管理费36₽/件 = 每件额外成本135₽" },
      { term: "有效件数", desc: "考虑货损率后的实际可售数量。默认货损3%。", example: "备货100件 × (1-3%) = 有效97件。3件在运输中损坏不能卖" },
      { term: "单位回款", desc: "每卖出1件，平台实际打给你的钱。= 售价 − 平台费", example: "售价1249₽ − 平台费652₽ = 单位回款597₽" },
    ]},
    { section: "💰 现金流预测", items: [
      { term: "当月净利 vs 现金流", desc: "净利 = 营收 − 成本 − 仓管 − 税（会计视角，含销货成本）。现金流 = 营收 − 仓管 − 税 − 合伙人分成（现金视角，M0已付全部货款，月度不重复扣）。", example: "M3营收30万₽，货物成本15万₽，仓管5万₽，税2万₽\n→ 净利 = 30-15-5-2 = 8万₽\n→ 现金流 = 30-5-2 = 23万₽（因为15万货款M0就付了）" },
      { term: "累计现金", desc: "从M0到当月，所有现金流加起来的总和。负数=还没回本，正数=已回本。", example: "M0: -100万 → M1: -100+20=-80万 → M2: -80+25=-55万 → ... → M6: +5万（回本了）" },
      { term: "税档", desc: "当月适用的税制。如果开了\"自动VAT\"，累计营收过20M₽会自动从USN切换到USN+VAT 5%。", example: "M1~M4累计营收18M₽ → 免VAT。M5突破20M₽ → 自动加VAT 5%" },
    ]},
    { section: "🏛️ 税制简述", items: [
      { term: "USN 6%", desc: "按总收入的6%交税，最简单。不管你赚不赚钱都要交。", example: "月营收100万₽ → 税 = 6万₽，跟利润无关" },
      { term: "USN 15%", desc: "按（收入−支出）× 15%交税。有个保底：最少交收入的1%。", example: "营收100万₽，支出80万₽ → 利润20万₽ × 15% = 3万₽。但保底 = 100万×1% = 1万₽。取高的 → 交3万₽" },
      { term: "USN + VAT 5%/7%", desc: "累计营收超过20M₽后触发。在USN基础上额外交5%或7%的增值税，且不能抵扣进项。", example: "售价含税1249₽ → VAT 5% = 1249×5%÷105% ≈ 59.5₽/件" },
      { term: "OSN", desc: "一般纳税制：VAT 22%（可抵扣进项）+ 利润税 25%。最复杂但大企业必选。", example: "进口报关VAT按申报价算，卖出时收销项VAT，两者相抵后交差额" },
      { term: "进项VAT vs 销项VAT", desc: "进项VAT = 进口货物时你付的增值税（按申报价计算）。销项VAT = 卖出商品时向消费者收的增值税。OSN下可以用进项抵销项。", example: "进口100件，申报价15¥×12=180₽/件 → 进项VAT = 180×22% = 39.6₽/件\n卖出时售价1249₽ → 销项VAT = 1249×22%÷122% ≈ 225₽/件\n实缴 = 225-39.6 = 185.4₽/件" },
    ]},
  ],
  en: [
    { section: "📊 Dashboard Overview", items: [
      { term: "Total Revenue", desc: "Total platform payout for all products sold (List Price − Platform Fees).", example: "List 1249₽, Fee 652₽ → Payout 597₽/pc. 30pcs → Revenue = 597×30×97% = 17,373₽" },
      { term: "Total Investment", desc: "All money you put in: procurement + shipping + one-time costs.", example: "Cost 17.65¥ × rate 12 = 211.8₽, shipping 100₽ → Unit 311.8₽. 30pcs → 9,354₽" },
      { term: "Net Profit (Cash)", desc: "Profit after tax, calculated per-SKU then summed. = Revenue − Investment − Warehouse − Mgmt − Tax.", example: "Revenue 17,373₽ − Invest 9,354₽ − WH 2,970₽ − Mgmt 1,080₽ − Tax 580₽ = 3,389₽" },
      { term: "Final Cash", desc: "Actual cash balance after N months of sales. Calculated monthly.", example: "M0: −1.08M₽ → M1: +150K → ... → M8: +575K₽" },
      { term: "⚠️ Net Profit vs Final Cash", desc: "They differ because tax is calculated differently: per-SKU vs per-month aggregation. Monthly aggregation usually results in lower tax.", example: "Per-SKU: each triggers minimum 1% tax. Monthly: combined profit avoids minimum → less tax → more cash" },
      { term: "ROI", desc: "Return on Investment. = Net Profit ÷ Total Investment × 100%", example: "Invest 100K₽, profit 47K₽ → ROI = 47%" },
      { term: "Net Margin", desc: "Profit per 100₽ of revenue. = Net Profit ÷ Revenue × 100%", example: "Revenue 210K₽, profit 47K₽ → Margin = 22.3%" },
    ]},
    { section: "📈 Investor Metrics", items: [
      { term: "Initial Outflow", desc: "Total upfront payment at M0: all procurement + shipping + one-time + import VAT (if OSN).", example: "38 SKUs total cost 1.08M₽ → Initial = −1.08M₽" },
      { term: "Max Drawdown", desc: "Deepest negative cash point during the forecast. Usually at M0 right after paying.", example: "M0 paid 1.08M₽, balance −1.08M₽ → max drawdown" },
      { term: "Break-even Month", desc: "Month when cumulative cash turns positive. Before this you're still in the red.", example: "M5: −50K₽, M6: +20K₽ → Break-even at month 6" },
      { term: "Avg Monthly Revenue", desc: "Total Revenue ÷ forecast months.", example: "2.3M₽ ÷ 8 months = 287K₽/month" },
    ]},
    { section: "🏷️ Product Details", items: [
      { term: "Actual vs Declared Cost", desc: "Actual = real factory price. Declared = customs declaration price (may be lower). Under OSN, input VAT uses declared price.", example: "Actual 20¥, declared 15¥ → input VAT on 15¥ only, 5¥ gap is non-deductible" },
      { term: "Platform Fee", desc: "Commission deducted by Ozon/WB per order (includes logistics, ads, etc.).", example: "List 1249₽, fee 652₽ → You get 597₽" },
      { term: "Warehouse + Mgmt Fee", desc: "Per-unit storage and operations costs.", example: "Storage 99₽/pc + Mgmt 36₽/pc = 135₽/pc extra cost" },
      { term: "Effective Qty", desc: "Sellable units after damage rate (default 3%).", example: "100 units × 97% = 97 sellable" },
      { term: "Unit Payout", desc: "Cash received per unit sold. = List Price − Platform Fee", example: "1249₽ − 652₽ = 597₽" },
    ]},
    { section: "💰 Cash Flow", items: [
      { term: "Net Profit vs Cash Flow", desc: "Net Profit = Revenue − COGS − WH/Mgmt − Tax (accounting view). Cash Flow = Revenue − WH/Mgmt − Tax − Partner (cash view, COGS paid at M0).", example: "M3: Rev 300K₽, COGS 150K₽, WH 50K₽, Tax 20K₽\nNet = 300−150−50−20 = 80K₽\nCash = 300−50−20 = 230K₽" },
      { term: "Cumulative Cash", desc: "Running total of all cash flows from M0. Negative = not yet recovered, positive = profitable.", example: "M0: −1M → M1: −800K → M2: −550K → ... → M6: +50K" },
      { term: "Tax Tier", desc: "Active tax regime for the month. With auto-VAT, crossing 20M₽ triggers VAT 5%.", example: "M1-M4: <20M₽ → no VAT. M5: >20M₽ → auto VAT 5%" },
    ]},
    { section: "🏛️ Tax Regimes", items: [
      { term: "STS 6% (USN)", desc: "6% on total revenue. Simple. Pay regardless of profit.", example: "Revenue 1M₽ → Tax = 60K₽" },
      { term: "STS 15% (USN)", desc: "(Revenue − Expenses) × 15%. Minimum: 1% of revenue.", example: "Rev 1M₽, Exp 800K₽ → Profit 200K × 15% = 30K₽. Min = 1M×1% = 10K₽. Pay 30K₽" },
      { term: "STS + VAT 5%/7%", desc: "Triggered when annual revenue exceeds 20M₽. Extra VAT on top of STS, no input credit.", example: "List 1249₽ → VAT 5% = 1249×5%/105% ≈ 59.5₽/pc" },
      { term: "GTS (OSN)", desc: "General: VAT 22% (with input credit) + Profit Tax 25%. Complex but required for large businesses.", example: "Import VAT on declared cost, output VAT on sales, net difference remitted" },
      { term: "Input vs Output VAT", desc: "Input = VAT paid on imported goods. Output = VAT charged to buyer. Under OSN, input offsets output.", example: "Import: 180₽×22% = 39.6₽. Sales: 1249×22%/122% ≈ 225₽. Remit = 225−39.6 = 185.4₽" },
    ]},
  ],
  ru: [
    { section: "📊 Обзор", items: [
      { term: "Общая выручка", desc: "Сумма выплат площадки за все товары (Цена − Комиссия).", example: "Цена 1249₽, комиссия 652₽ → Выплата 597₽/шт. 30шт → 597×30×97% = 17 373₽" },
      { term: "Инвестиции", desc: "Все вложенные деньги: закупка + доставка + разовые расходы.", example: "Закупка 17.65¥ × 12 = 211.8₽ + доставка 100₽ → 311.8₽/шт × 30 = 9 354₽" },
      { term: "Чистая прибыль", desc: "Прибыль после налога, по каждому SKU. = Выручка − Инвестиция − Склад − Управление − Налог.", example: "17 373 − 9 354 − 2 970 − 1 080 − 580 = 3 389₽" },
      { term: "Итоговый кэш", desc: "Остаток на счету после N месяцев продаж. Рассчитывается помесячно.", example: "М0: −1.08М₽ → М1: +150К → ... → М8: +575К₽" },
      { term: "⚠️ Прибыль vs Кэш", desc: "Разница из-за расчёта налога: по-SKU vs помесячно. Помесячный расчёт обычно даёт меньше налога.", example: "По-SKU: каждый платит мин. 1%. Помесячно: объединённая прибыль избегает минимума → меньше налога" },
      { term: "ROI", desc: "Возврат на инвестиции. = Прибыль ÷ Инвестиции × 100%", example: "Вложили 100К₽, заработали 47К₽ → ROI = 47%" },
    ]},
    { section: "📈 Метрики инвестора", items: [
      { term: "Начальные вложения", desc: "Вся сумма в М0: закупка + доставка + разовые + вх. НДС (при ОСН).", example: "38 SKU → 1.08М₽" },
      { term: "Макс. просадка", desc: "Самая глубокая отрицательная точка. Обычно в М0.", example: "М0: оплата 1.08М₽ → баланс −1.08М₽" },
      { term: "Месяц окупаемости", desc: "Когда накопленный кэш становится положительным.", example: "М5: −50К₽, М6: +20К₽ → Окупаемость за 6 мес." },
    ]},
    { section: "🏷️ Товары", items: [
      { term: "Факт. vs Деклар. цена", desc: "Факт. = реальная цена. Деклар. = таможенная декларация. При ОСН вх. НДС по деклар.", example: "Факт. 20¥, деклар. 15¥ → вх. НДС только с 15¥" },
      { term: "Комиссия площадки", desc: "Удержание Ozon/WB за каждый заказ.", example: "Цена 1249₽, комиссия 652₽ → вы получаете 597₽" },
      { term: "Эфф. количество", desc: "Продаваемые единицы после потерь (3%).", example: "100 шт × 97% = 97 шт" },
    ]},
    { section: "💰 Денежный поток", items: [
      { term: "Прибыль vs Кэш", desc: "Прибыль = бух. ракурс (с себестоимостью). Кэш = денежный ракурс (себестоимость оплачена в М0).", example: "М3: Выр. 300К, Себест. 150К, Склад 50К, Налог 20К\nПрибыль = 80К. Кэш = 230К" },
      { term: "Накопленный кэш", desc: "Сумма всех потоков от М0. Минус = не окупилось.", example: "М0: −1М → М1: −800К → М6: +50К" },
    ]},
    { section: "🏛️ Налоговые режимы", items: [
      { term: "УСН 6%", desc: "6% от дохода. Просто. Платите независимо от прибыли.", example: "Доход 1М₽ → Налог = 60К₽" },
      { term: "УСН 15%", desc: "(Доход − Расход) × 15%. Минимум: 1% от дохода.", example: "Доход 1М₽, Расход 800К₽ → 200К × 15% = 30К₽" },
      { term: "ОСН", desc: "НДС 22% (с вычетом) + Налог на прибыль 25%.", example: "Вх. НДС при импорте, исх. НДС при продаже, разница уплачивается" },
    ]},
  ],
};

const GlossaryPanel = ({ t, lang }) => {
  const data = GLOSSARY[lang] || GLOSSARY.zh;
  const titles = { zh: "术语词典 · 指标解释与举例", en: "Glossary · Metrics Explained with Examples", ru: "Глоссарий · Метрики с примерами" };
  const hints = { zh: "每个术语都附带真实数字举例，帮助你直观理解。", en: "Each term includes a real-number example for intuitive understanding.", ru: "Каждый термин с примером для наглядности." };

  return (
    <div className="space-y-6 anim-in">
      <div>
        <h2 className="font-display text-2xl font-semibold">{titles[lang] || titles.zh}</h2>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{hints[lang] || hints.zh}</p>
      </div>
      {data.map((sec, si) => (
        <Card key={si} title={sec.section}>
          <div className="space-y-0">
            {sec.items.map((item, ii) => (
              <div key={ii} className="py-3 border-b last:border-b-0 row-glow" style={{ borderColor: COLORS.line }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-display font-semibold text-sm" style={{ color: item.term.startsWith("⚠️") ? COLORS.crimson : COLORS.ink }}>{item.term}</div>
                    <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{item.desc}</div>
                  </div>
                </div>
                {item.example && (
                  <div className="mt-2 p-2.5 text-xs font-mono whitespace-pre-line" style={{ background: COLORS.paper, color: COLORS.ink, borderLeft: `3px solid ${COLORS.gold}` }}>
                    💡 {item.example}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
};
