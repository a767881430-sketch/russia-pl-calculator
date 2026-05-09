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
  usn_15_vat5:  { labelKey: "taxUsn15v5Label", short: "USN+VAT 5%", descKey: "taxUsn15v5Desc" },
  usn_15_vat7:  { labelKey: "taxUsn15v7Label", short: "USN+VAT 7%", descKey: "taxUsn15v7Desc" },
  osn:          { labelKey: "taxOsnLabel", short: "OSN",        descKey: "taxOsnDesc" },
  custom:       { labelKey: "taxCustomLabel", short: "Custom",   descKey: "taxCustomDesc" },
};

const DEFAULT_PARAMS = {
  exchangeRate: 12.0, usdRate: 95, damageRate: 0.03, shippingPerUnit: 100, labelingPerUnit: 0,
  taxScheme: "usn_15", vatRate: 0.22, profitTaxRate: 0.25, customTaxRate: 0.15,
  incomeBasis: "payout", oneTimeCosts: 0,
};

const DEFAULT_PROJECTION = {
  monthsHorizon: 8, partnerSharePct: 0, monthlyFixedCost: 0,
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
  const unitCost = priceRUB + params.shippingPerUnit + params.labelingPerUnit;
  const declaredUnitCost = declaredRUB + params.shippingPerUnit + params.labelingPerUnit;
  const totalInvestment = unitCost * (p.qty || 0);
  const totalDeclaredCost = declaredUnitCost * (p.qty || 0);

  const unitPayout = (p.list || 0) - (p.platformFee || 0);
  const effectiveQty = (p.qty || 0) * (1 - params.damageRate);
  const totalRevenue = unitPayout * effectiveQty;
  const totalWarehouse = (p.warehouse || 0) * (p.qty || 0);
  const totalMgmt = (p.mgmt || 0) * (p.qty || 0);

  const inputVATPerUnit = params.taxScheme === "osn" ? declaredRUB * params.vatRate : 0;
  const totalInputVAT = inputVATPerUnit * (p.qty || 0);

  let outputVATRate = 0;
  if (params.taxScheme === "osn") outputVATRate = params.vatRate;
  else if (params.taxScheme === "usn_15_vat5") outputVATRate = 0.05;
  else if (params.taxScheme === "usn_15_vat7") outputVATRate = 0.07;
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
  const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;
  const roi = totalInvestment > 0 ? netProfit / totalInvestment : 0;

  return {
    priceRUB, declaredRUB, unitCost, declaredUnitCost, totalInvestment, totalDeclaredCost,
    unitPayout, effectiveQty, totalRevenue, totalWarehouse, totalMgmt,
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

// 阶梯VAT阈值（2026 联邦法 №425-FZ）
// 累计年营收 ≤ 20M ₽: USN无VAT
// 20M-250M ₽: 触发VAT，可选5%(无进项抵扣)
// 250M-450M ₽: 7%(无进项抵扣)
// 450M+ : 强制 OSN
const VAT_TIER = (cumRevenue) => {
  if (cumRevenue <= 20_000_000) return { rate: 0, label: "免VAT", tier: 0 };
  if (cumRevenue <= 250_000_000) return { rate: 0.05, label: "VAT 5%", tier: 1 };
  if (cumRevenue <= 450_000_000) return { rate: 0.07, label: "VAT 7%", tier: 2 };
  return { rate: 0.22, label: "VAT 22% (OSN)", tier: 3 };
};

const calcProjection = (products, params, projection, store) => {
  const { monthsHorizon, partnerSharePct, monthlyFixedCost, autoVATEscalation, priorYearRevenue } = projection;
  const months = [];

  let totalActual = 0, totalDeclared = 0, totalImportVAT = 0;
  for (const p of products) {
    const declaredCNY = (p.declaredCNY ?? p.priceCNY) || 0;
    const actualUnit = (p.priceCNY || 0) * params.exchangeRate + params.shippingPerUnit + params.labelingPerUnit;
    const declaredUnit = declaredCNY * params.exchangeRate + params.shippingPerUnit + params.labelingPerUnit;
    totalActual += actualUnit * (p.qty || 0);
    totalDeclared += declaredUnit * (p.qty || 0);
    if (params.taxScheme === "osn") {
      totalImportVAT += declaredCNY * params.exchangeRate * (p.qty || 0) * params.vatRate;
    }
  }
  const initialOutflow = totalActual + (params.oneTimeCosts || 0) + totalImportVAT;
  let cumCash = -initialOutflow;
  let inputVATCredit = totalImportVAT;

  months.push({
    monthIdx: 0, label: "M0", revenue: 0, cogs: 0, expenses: 0, fixedCost: 0,
    grossProfit: 0, tax: 0, vatRemit: 0, netProfit: -initialOutflow,
    partnerPayout: 0, cashFlow: -initialOutflow, cumCash,
    soldQty: 0, isInitial: true, importVAT: totalImportVAT,
    effectiveScheme: params.taxScheme, vatTierLabel: "—", cumRevenue: priorYearRevenue || 0,
  });

  // 跨月累计营收（动态 VAT 触发用）
  let cumRevenue = priorYearRevenue || 0;
  let vatTriggered = false;
  let vatTriggerMonth = null;
  let triggeredRate = 0; // 一旦触发就锁定到该年度结束

  for (let m = 1; m <= monthsHorizon; m++) {
    let revenue = 0, cogs = 0, declaredCogs = 0, expenses = 0;
    let soldQty = 0, listSum = 0;

    for (const p of products) {
      const declaredCNY = (p.declaredCNY ?? p.priceCNY) || 0;
      const sched = getSchedule(p.id, p.qty || 0, monthsHorizon, store);
      const q = sched[m - 1] || 0;
      soldQty += q;
      const unitCost = (p.priceCNY || 0) * params.exchangeRate + params.shippingPerUnit + params.labelingPerUnit;
      const declaredUnit = declaredCNY * params.exchangeRate + params.shippingPerUnit + params.labelingPerUnit;
      revenue += q * ((p.list || 0) - (p.platformFee || 0));
      cogs += q * unitCost;
      declaredCogs += q * declaredUnit;
      expenses += q * ((p.warehouse || 0) + (p.mgmt || 0));
      listSum += q * (p.list || 0);
    }

    cumRevenue += revenue;
    const fixedCost = monthlyFixedCost || 0;
    const grossProfit = revenue - cogs - expenses - fixedCost;
    const incomeBase = params.incomeBasis === "list" ? listSum : revenue;

    // 决定本月用什么税制
    let effectiveScheme = params.taxScheme;
    let vatTierLabel = "—";

    // 仅当用户选了USN且开启了"自动跨档"，才动态升级
    if (autoVATEscalation && (params.taxScheme === "usn_6" || params.taxScheme === "usn_15")) {
      const tier = VAT_TIER(cumRevenue);
      vatTierLabel = tier.label;
      if (tier.tier > 0) {
        if (!vatTriggered) {
          vatTriggered = true;
          vatTriggerMonth = m;
          triggeredRate = tier.rate;
        } else if (tier.rate > triggeredRate) {
          // 当年度内继续上跨 (e.g. 5% → 7%)
          triggeredRate = tier.rate;
        }
        // 选哪一档：5% 或 7%
        if (triggeredRate === 0.05) effectiveScheme = "usn_15_vat5";
        else if (triggeredRate === 0.07) effectiveScheme = "usn_15_vat7";
        else if (triggeredRate >= 0.22) effectiveScheme = "osn";
      }
    } else {
      // 用户手动选了带VAT的方案：显示该方案档位
      if (params.taxScheme === "usn_15_vat5") vatTierLabel = "VAT 5% (固定)";
      else if (params.taxScheme === "usn_15_vat7") vatTierLabel = "VAT 7% (固定)";
      else if (params.taxScheme === "osn") vatTierLabel = `VAT ${(params.vatRate*100).toFixed(0)}% (固定)`;
      else vatTierLabel = "免VAT";
    }

    // 计算本月销项VAT率
    let outputVATRate = 0;
    if (effectiveScheme === "osn") outputVATRate = params.vatRate;
    else if (effectiveScheme === "usn_15_vat5") outputVATRate = 0.05;
    else if (effectiveScheme === "usn_15_vat7") outputVATRate = 0.07;
    const monthlyOutputVAT = listSum * outputVATRate / (1 + outputVATRate);

    let tax = 0, vatRemit = 0;
    switch (effectiveScheme) {
      case "usn_6": tax = incomeBase * 0.06; break;
      case "usn_15": {
        const t = Math.max(0, incomeBase - cogs - expenses - fixedCost);
        tax = Math.max(t * 0.15, incomeBase * 0.01); break;
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
    const partnerPayout = Math.max(0, netProfit) * (partnerSharePct / 100);
    const cashFlow = revenue - expenses - fixedCost - tax - partnerPayout;
    cumCash += cashFlow;

    months.push({
      monthIdx: m, label: `M${m}`, revenue, cogs, expenses, fixedCost, grossProfit,
      tax, vatRemit, netProfit, partnerPayout, cashFlow, cumCash, soldQty, isInitial: false,
      effectiveScheme, vatTierLabel, cumRevenue,
    });
  }

  const beIdx = months.findIndex((mm, i) => i > 0 && mm.cumCash >= 0);
  return {
    months, initialOutflow,
    breakEvenMonth: beIdx > 0 ? beIdx : null,
    maxDrawdown: Math.min(...months.map(mm => mm.cumCash)),
    finalCash: months[months.length - 1].cumCash,
    totalRevenue: months.reduce((a, b) => a + b.revenue, 0),
    totalNetProfit: months.reduce((a, b) => a + b.netProfit, 0),
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
  const [projection, setProjection] = useState(DEFAULT_PROJECTION);
  const [tab, setTab] = useState("dashboard");
  const [expandedRow, setExpandedRow] = useState(null);
  const [storageStatus, setStorageStatus] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // --- i18n ---
  const t = useMemo(() => createT(lang), [lang]);
  const { liveRate, effectiveRate, rateSource, rateLoading, fetchRate, setRateSource } = useLiveRate(params.exchangeRate);
  // --- locale-aware currency formatter (¥ for zh, $ for en, ₽ for ru) ---
  const fmt = useMemo(() => createCurrencyFormatter(lang, effectiveRate, params.usdRate), [lang, effectiveRate, params.usdRate]);

  // 实时汇率更新到 params
  useEffect(() => {
    if (rateSource === "live" && liveRate && Math.abs(liveRate - params.exchangeRate) > 0.01) {
      setParams(p => ({ ...p, exchangeRate: liveRate }));
    }
  }, [liveRate, rateSource]);

  // --- 启动时从 localStorage 加载 ---
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ru_calc_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.params) setParams({ ...DEFAULT_PARAMS, ...parsed.params });
        if (Array.isArray(parsed.products)) setProducts(parsed.products);
        if (parsed.scheduleStore) setScheduleStore(parsed.scheduleStore);
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
      localStorage.setItem("ru_calc_v2", JSON.stringify({ params, products, scheduleStore, projection }));
    } catch (e) {}
  }, [params, products, scheduleStore, projection, loaded]);

  const saveToCloud = () => {
    setStorageBusy(true);
    try {
      localStorage.setItem("ru_calc_v2", JSON.stringify({ params, products, scheduleStore, projection }));
      setStorageStatus(t("saved"));
    } catch (e) { setStorageStatus(t("saveFail")); }
    finally { setStorageBusy(false); setTimeout(() => setStorageStatus(""), 2200); }
  };

  const calcs = useMemo(() => products.map(p => ({ ...p, c: calcProduct(p, params) })), [products, params]);

  const totals = useMemo(() => {
    const a = { qty: 0, totalInvestment: 0, totalDeclaredCost: 0, totalRevenue: 0, totalWarehouse: 0, totalMgmt: 0,
      tax: 0, vatPart: 0, usnPart: 0, profitTaxPart: 0, totalInputVAT: 0, totalOutputVAT: 0,
      netProfit: 0, bookNetProfit: 0, profitBeforeTax: 0 };
    for (const r of calcs) {
      a.qty += r.qty || 0;
      a.totalInvestment += r.c.totalInvestment;
      a.totalDeclaredCost += r.c.totalDeclaredCost;
      a.totalRevenue += r.c.totalRevenue;
      a.totalWarehouse += r.c.totalWarehouse;
      a.totalMgmt += r.c.totalMgmt;
      a.tax += r.c.tax; a.vatPart += r.c.vatPart; a.usnPart += r.c.usnPart; a.profitTaxPart += r.c.profitTaxPart;
      a.totalInputVAT += r.c.totalInputVAT; a.totalOutputVAT += r.c.totalOutputVAT;
      a.netProfit += r.c.netProfit; a.bookNetProfit += r.c.bookNetProfit; a.profitBeforeTax += r.c.profitBeforeTax;
    }
    a.netProfit -= params.oneTimeCosts;
    a.bookNetProfit -= params.oneTimeCosts;
    a.totalCostBasis = a.totalInvestment + params.oneTimeCosts;
    a.profitMargin = a.totalRevenue > 0 ? a.netProfit / a.totalRevenue : 0;
    a.roi = a.totalCostBasis > 0 ? a.netProfit / a.totalCostBasis : 0;
    a.netProfitCNY = a.netProfit / params.exchangeRate;
    return a;
  }, [calcs, params.oneTimeCosts, params.exchangeRate]);

  const proj = useMemo(() => calcProjection(products, params, projection, scheduleStore),
    [products, params, projection, scheduleStore]);

  const updateProduct = (idx, field, val) => {
    const oldId = products[idx]?.id;
    setProducts(ps => ps.map((p, i) => i === idx ? { ...p, [field]: val } : p));
    if (field === "id" && oldId && oldId !== val && scheduleStore[oldId]) {
      setScheduleStore(s => { const n = { ...s }; n[val] = n[oldId]; delete n[oldId]; return n; });
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
    if (id) setScheduleStore(s => { const n = { ...s }; delete n[id]; return n; });
    if (expandedRow === idx) setExpandedRow(null);
  };
  const clearAllProducts = () => {
    if (confirm(t("confirmClear"))) { setProducts([]); setScheduleStore({}); setExpandedRow(null); }
  };
  const resetSample = () => {
    if (confirm(t("confirmReset"))) {
      setProducts(SAMPLE_PRODUCTS); setParams(DEFAULT_PARAMS);
      setProjection(DEFAULT_PROJECTION); setScheduleStore({});
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

    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `russia-pl-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const tabs = [
    { id: "dashboard", label: t("tabDashboard") },
    { id: "products", label: t("tabProducts") },
    { id: "schedule", label: t("tabSchedule") },
    { id: "projection", label: t("tabProjection") },
    { id: "settings", label: t("tabSettings") },
    { id: "help", label: t("tabHelp") },
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
                {rateSource === 'live' ? '● ' : '○ '}1¥={effectiveRate.toFixed(2)}₽
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
          scheduleStore={scheduleStore} updateSchedule={updateSchedule} applyCurve={applyScheduleCurve} t={t} lang={lang} />}
        {tab === "projection" && <ProjectionTab proj={proj} projection={projection} setProjection={setProjection}
          params={params} totals={totals} t={t} lang={lang} fmt={fmt} />}
        {tab === "settings" && <SettingsTab params={params} setParams={setParams} t={t} lang={lang}
          rateSource={rateSource} setRateSource={setRateSource} liveRate={liveRate} effectiveRate={effectiveRate} fetchRate={fetchRate} />}
        {tab === "help" && <HelpPanel t={t} lang={lang} />}
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
              <React.Fragment key={r.id + idx}>
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
  const Ff = fmt ? fmt.fmtPrimaryFull : fmtRub;
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
                <input type="text" value={product[f.k] || ""} onChange={(e) => onUpdate(idx, f.k, e.target.value)}
                  className="px-2 py-1.5 bg-white border font-mono text-sm"
                  style={{ borderColor: COLORS.line, color: COLORS.ink }} />
              ) : (
                <NumInput value={product[f.k] ?? (f.k === "declaredCNY" ? product.priceCNY : 0)}
                  onChange={(v) => onUpdate(idx, f.k, v)} suffix={f.suffix} step={f.step || 1} />
              )}
            </div>
          ))}
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
          <div style={{ color: COLORS.inkSoft }}>{t("calcShipping")}</div><div className="text-right">{Ff(params.shippingPerUnit)}</div>
          <div style={{ color: COLORS.inkSoft }}>{t("calcLabeling")}</div><div className="text-right">{Ff(params.labelingPerUnit)}</div>
          <div className="border-t pt-1" style={{ borderColor: COLORS.line }}>{t("calcUnitCost")}</div>
          <div className="text-right border-t pt-1" style={{ borderColor: COLORS.line }}>{Ff(calc.unitCost, 2)}</div>
          <div style={{ color: COLORS.inkSoft }}>{t("calcUnitPayout")}</div><div className="text-right">{Ff(calc.unitPayout)}</div>
          <div style={{ color: COLORS.inkSoft }}>{t("calcUnitGross")}</div><div className="text-right">{Ff(calc.unitPayout - calc.unitCost)}</div>
          <div className="border-t pt-1" style={{ borderColor: COLORS.line }}>{t("calcUnitNet")}</div>
          <div className="text-right border-t pt-1" style={{ borderColor: COLORS.line, color: calc.unitNetProfit > 0 ? COLORS.emerald : COLORS.crimson }}>
            {Ff(calc.unitNetProfit, 2)} ({fmt.fmtSecondary(calc.unitNetProfit)})
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
// 销售排期 Tab
// ============================================================
const ScheduleTab = ({ products, projection, setProjection, scheduleStore, updateSchedule, applyCurve, t, lang }) => {
  const months = projection.monthsHorizon;
  const totalAllProducts = products.reduce((a, b) => a + (b.qty || 0), 0);
  return (
    <div className="space-y-4 anim-in">
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

      <div className="flex flex-wrap gap-2 items-center text-xs" style={{ color: COLORS.inkSoft }}>
        <Sparkles size={12} />
        <button onClick={() => applyCurve("linear")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white" }}>{t("linearDist")}</button>
        <button onClick={() => applyCurve("frontload")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white" }}>{t("frontload")}</button>
        <button onClick={() => applyCurve("bell")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white" }}>{t("bellCurve")}</button>
        <button onClick={() => applyCurve("reset")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white", color: COLORS.crimson }}>{t("resetDist")}</button>
      </div>

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
          <table className="w-full text-xs" style={{ minWidth: "1100px" }}>
            <thead style={{ background: COLORS.paper }}>
              <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
                <th className="text-left p-2">{t("thMonth")}</th>
                <th className="text-left p-2">{t("thTaxTier")}</th>
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
                  <td className="p-2 text-[10px]" style={{ color: m.vatTierLabel && m.vatTierLabel.startsWith("VAT") && !m.vatTierLabel.includes("固定") ? COLORS.crimson : COLORS.inkSoft }}>
                    {m.isInitial ? "—" : (m.vatTierLabel || "—")}
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
    { label: t("paramShipping"), k: "shippingPerUnit", suffix: "₽" },
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
