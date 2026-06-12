import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { Plus, Trash2, Save, Info, ChevronDown, ChevronRight, RotateCcw, FileDown, AlertCircle, Sparkles, Globe, Share2, FolderOpen, FilePlus, Upload, Copy, X, Edit3, BookOpen, Send, Link as LinkIcon, MoreHorizontal, Search } from "lucide-react";
import { createT, createCurrencyFormatter, useLiveRate, LANG_OPTIONS } from "./i18n.js";
import {
  SALES_PLATFORMS,
  getProductPlatformConfigs,
  calcPlatformUnitEconomics,
  getProductPlatformAverages,
  getPlatformTariffMeta,
} from "./lib/platformPricing.js";
import { PLATFORM_TARIFFS } from "./lib/platformTariffs.js";

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

const TARIFF_META = getPlatformTariffMeta();

// ============================================================
// 2026 俄罗斯税制
// ============================================================
const TAX_SCHEMES = {
  usn_6:        { labelKey: "taxUsn6Label", shortZh: "俄罗斯简化税制 6%", short: "USN 6%",     descKey: "taxUsn6Desc" },
  usn_15:       { labelKey: "taxUsn15Label", shortZh: "俄罗斯简化税制 15%", short: "USN 15%",    descKey: "taxUsn15Desc" },
  usn_6_vat5:   { labelKey: "taxUsn6v5Label", shortZh: "简化税制 + 增值税 5%", short: "USN 6%+VAT 5%", descKey: "taxUsn6v5Desc" },
  usn_6_vat7:   { labelKey: "taxUsn6v7Label", shortZh: "简化税制 + 增值税 7%", short: "USN 6%+VAT 7%", descKey: "taxUsn6v7Desc" },
  usn_15_vat5:  { labelKey: "taxUsn15v5Label", shortZh: "简化税制 + 增值税 5%", short: "USN 15%+VAT 5%", descKey: "taxUsn15v5Desc" },
  usn_15_vat7:  { labelKey: "taxUsn15v7Label", shortZh: "简化税制 + 增值税 7%", short: "USN 15%+VAT 7%", descKey: "taxUsn15v7Desc" },
  osn:          { labelKey: "taxOsnLabel", shortZh: "俄罗斯一般税制", short: "OSN",        descKey: "taxOsnDesc" },
  custom:       { labelKey: "taxCustomLabel", shortZh: "自定义税制", short: "Custom",   descKey: "taxCustomDesc" },
};

const taxSchemeShortLabel = (scheme, lang = "zh") => {
  if (!scheme) return "";
  return lang === "zh" ? (scheme.shortZh || scheme.short) : scheme.short;
};

const DEFAULT_PARAMS = {
  exchangeRate: 12.0, usdRate: 95, damageRate: 0.03, shippingPerUnit: 0, labelingPerUnit: 0,
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
  autoVATEscalation: true,    // 自动按累计营收触发 VAT
  priorYearRevenue: 0,        // 进入本预测期前的累计营收（如已经卖了一段时间）
};

const PUBLIC_PROJECTS = [
  { name: "雄伟传奇", file: "xiongwei-chuanqi-project.json", desc: "新增线上项目，适合直接发给别人看。" },
  { name: "德力 22SKU · 保守试水", file: "deli-glass-russia-22sku-conservative-project.json", desc: "先小批试卖、控制现金占用。" },
  { name: "德力 22SKU · 标准启动", file: "deli-glass-russia-22sku-standard-project.json", desc: "默认讲解版本，适合老板/供应商一起看。" },
  { name: "德力 22SKU · 进取放量", file: "deli-glass-russia-22sku-aggressive-project.json", desc: "讨论多平台和更高备货规模。" },
  { name: "Ozon 90 天 · 保守试销", file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-conservative-project.json", desc: "低预算验证上架、客服和履约链路。" },
  { name: "Ozon 90 天 · 标准启动", file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-standard-project.json", desc: "本地现货供货合作的默认测算。" },
  { name: "Ozon 90 天 · 放量验证", file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-scale-project.json", desc: "需要供货价、库存、补货和售后机制更稳定。" },
];

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
  const platformAvg = getProductPlatformAverages(p);
  const declaredCNY = (p.declaredCNY ?? p.priceCNY) || 0;
  const priceRUB = (p.priceCNY || 0) * params.exchangeRate;
  const declaredRUB = declaredCNY * params.exchangeRate;
  const shipPerUnit = calcShipping(p, params);
  const unitCost = priceRUB + shipPerUnit + params.labelingPerUnit;
  const declaredUnitCost = declaredRUB + shipPerUnit + params.labelingPerUnit;
  const totalInvestment = unitCost * (p.qty || 0);
  const totalDeclaredCost = declaredUnitCost * (p.qty || 0);

  const listPrice = platformAvg.list;
  const platformFee = platformAvg.platformFee;
  const warehouse = platformAvg.warehouse;
  const mgmt = platformAvg.mgmt;
  const unitPayout = listPrice - platformFee;
  const effectiveQty = (p.qty || 0) * (1 - params.damageRate);
  const totalRevenue = unitPayout * effectiveQty;
  const totalWarehouse = warehouse * (p.qty || 0);
  const totalMgmt = mgmt * (p.qty || 0);

  // 灰关无进项 VAT 发票，OSN 下不可抵扣
  const canDeductVAT = params.taxScheme === "osn" && hasImportVATInvoice(p);
  const inputVATPerUnit = canDeductVAT ? declaredRUB * params.vatRate : 0;
  const totalInputVAT = inputVATPerUnit * (p.qty || 0);

  let outputVATRate = 0;
  if (params.taxScheme === "osn") outputVATRate = params.vatRate;
  else if (params.taxScheme === "usn_6_vat5" || params.taxScheme === "usn_15_vat5") outputVATRate = 0.05;
  else if (params.taxScheme === "usn_6_vat7" || params.taxScheme === "usn_15_vat7") outputVATRate = 0.07;
  const totalOutputVAT = listPrice * outputVATRate / (1 + outputVATRate) * effectiveQty;

  const incomeBase = params.incomeBasis === "list" ? listPrice * effectiveQty : totalRevenue;
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
  const totalGMV = listPrice * effectiveQty;
  const profitMargin = totalGMV > 0 ? netProfit / totalGMV : 0;
  const roi = totalInvestment > 0 ? netProfit / totalInvestment : 0;

  return {
    priceRUB, declaredRUB, unitCost, declaredUnitCost, totalInvestment, totalDeclaredCost,
    listPrice, platformFee, warehouse, mgmt, unitPayout, effectiveQty, totalRevenue, totalGMV, totalWarehouse, totalMgmt,
    platformAvg, platformDetails: platformAvg.active,
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

const seasonalWeightsFor = (n) => {
  const annual = [0.03, 0.04, 0.05, 0.06, 0.06, 0.07, 0.08, 0.08, 0.10, 0.13, 0.16, 0.14];
  if (n <= 0) return [];
  if (n === annual.length) return annual;
  if (n < annual.length) return annual.slice(annual.length - n);
  return Array.from({ length: n }, (_, i) => annual[i % annual.length]);
};

const distributeSeasonally = (total, n) => {
  if (n <= 0 || total <= 0) return Array(Math.max(0, n)).fill(0);
  const weights = seasonalWeightsFor(n);
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map(w => total * w / sum);
  const arr = raw.map(v => Math.floor(v));
  let diff = total - arr.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, rest: v - Math.floor(v) }))
    .sort((a, b) => b.rest - a.rest);
  for (let k = 0; k < diff; k++) arr[order[k % order.length].i] += 1;
  return arr;
};

const getSchedule = (id, qty, n, store) => {
  const s = store[id];
  if (!Array.isArray(s)) return distributeSeasonally(qty, n);
  if (s.length === n) return s;
  if (s.length > n) return s.slice(0, n); // 截断多余月份
  return [...s, ...Array(n - s.length).fill(0)]; // 补零
};

// 获取补货排期：长度 = n+1 (M0..Mn)，M0=首批采购，M1+=补货数
const getRestockSchedule = (id, qty, n, restockStore) => {
  const s = restockStore[id];
  if (!Array.isArray(s)) return [qty, ...Array(n).fill(0)]; // 默认：M0=全量，后续无补货
  // 长度匹配直接返回；否则截断或补零
  if (s.length === n + 1) return s;
  if (s.length > n + 1) return s.slice(0, n + 1); // 从长周期切回短周期：截断多余月份
  return [...s, ...Array(n + 1 - s.length).fill(0)]; // 从短周期切到长周期：补零
};

// 阶梯 VAT 阈值（2026 联邦法 №425-FZ）
// 累计年营收 <= 20M ₽: USN 无 VAT
// 20M-250M ₽: 触发 VAT，可选 5%（无进项抵扣）
// 250M-450M ₽: 7%（无进项抵扣）
// 450M+ : 强制俄罗斯一般税制
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

  // 计算每个商品的单位成本（供补货成本计算用）
  const productUnitCosts = {};
  const productPlatformAverages = {};
  for (const p of products) {
    const shipPerUnit = calcShipping(p, params);
    productUnitCosts[p.id] = (p.priceCNY || 0) * params.exchangeRate + shipPerUnit + params.labelingPerUnit;
    productPlatformAverages[p.id] = getProductPlatformAverages(p);
  }

  // M0 首批采购：使用 restockStore 的 M0 数量
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

  // 跨月累计营收（用于动态增值税触发）
  let cumRevenue = priorYearRevenue || 0;
  let vatTriggered = false;
  let vatTriggerMonth = null;
  let triggeredRate = 0; // 一旦触发就锁定到该年度结束

  for (let m = 1; m <= monthsHorizon; m++) {
    let revenue = 0, cogs = 0, declaredCogs = 0, expenses = 0, damageLoss = 0;
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
      const platformAvg = productPlatformAverages[p.id] || getProductPlatformAverages(p);
      const monthList = getPriceForMonth(p.id, m - 1, platformAvg.list, priceStore);
      const monthFee = getFeeForMonth(p.id, m - 1, platformAvg.platformFee, priceStore);
      const unitPayout = monthList - monthFee;
      revenue += q * unitPayout; // 100% 营收（假设全卖出）
      damageLoss += q * params.damageRate * unitPayout; // 货损 = 损坏数量 * 单位回款（丢失的收入）
      cogs += q * unitCost;
      declaredCogs += q * declaredUnit;
      expenses += q * (1 - params.damageRate) * ((platformAvg.warehouse || 0) + (platformAvg.mgmt || 0));
      listSum += q * (1 - params.damageRate) * monthList;

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

    cumRevenue += (revenue - damageLoss); // 实际收入 = 营收 - 货损
    const fixedCost = monthlyFixedCost || 0;
    const grossProfit = revenue - damageLoss - cogs - expenses - fixedCost; // 明确扣除货损
    const incomeBase = params.incomeBasis === "list" ? listSum : (revenue - damageLoss);

    // 决定本月使用什么税制
    let effectiveScheme = params.taxScheme;
    let vatTierKey = null;

    // 仅当用户选择 USN 且开启“自动跨档”时才动态升级
    if (autoVATEscalation && (params.taxScheme === "usn_6" || params.taxScheme === "usn_15")) {
      const tier = VAT_TIER(cumRevenue);
      vatTierKey = tier.labelKey;
      if (tier.tier > 0) {
        if (!vatTriggered) {
          vatTriggered = true;
          vatTriggerMonth = m;
          triggeredRate = tier.rate;
        } else if (tier.rate > triggeredRate) {
          // 当年度内继续上跨 (e.g. 5% -> 7%)
          triggeredRate = tier.rate;
        }
        // 选择方案：根据原始 USN 类型匹配对应方案
        if (triggeredRate === 0.05) effectiveScheme = params.taxScheme === "usn_6" ? "usn_6_vat5" : "usn_15_vat5";
        else if (triggeredRate === 0.07) effectiveScheme = params.taxScheme === "usn_6" ? "usn_6_vat7" : "usn_15_vat7";
        else if (triggeredRate >= 0.22) effectiveScheme = "osn";
      }
    } else {
      // 用户手动选择了带 VAT 的方案：显示该方案档位
      if (params.taxScheme === "usn_6_vat5" || params.taxScheme === "usn_15_vat5") vatTierKey = "vatLabelFixed5";
      else if (params.taxScheme === "usn_6_vat7" || params.taxScheme === "usn_15_vat7") vatTierKey = "vatLabelFixed7";
      else if (params.taxScheme === "osn") vatTierKey = "vatLabelFixedOsn";
      else vatTierKey = "vatLabelNoVat";
    }

    // 计算本月销项 VAT 率
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
    const distributed = Math.min(withdrawalAmount, Math.max(0, netProfit));
    const partnerPayout = distributed * (partnerSharePct / 100);
    const ownerPayout = distributed - partnerPayout;
    // 现金流 = 营收 - 货损 - 费用 - 税 - 合伙人分成 - 补货支出
    const cashFlow = revenue - damageLoss - expenses - fixedCost - tax - partnerPayout - monthRestockCost;
    cumCash += cashFlow;

    months.push({
      monthIdx: m, label: `M${m}`, revenue, cogs, expenses, fixedCost, grossProfit, damageLoss,
      tax, vatRemit, netProfit, distributed, partnerPayout, ownerPayout, cashFlow, cumCash, soldQty, isInitial: false,
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
const formatNumberForInput = (value, emptyWhenZero = true) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (emptyWhenZero && n === 0) return "";
  return String(n);
};

const normalizeNumberDraft = (raw, allowNegative = false) => {
  let next = String(raw ?? "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  if (!allowNegative) next = next.replace(/-/g, "");
  else next = next.replace(/(?!^)-/g, "");
  const sign = next.startsWith("-") ? "-" : "";
  const body = sign ? next.slice(1) : next;
  const [integer = "", ...decimalParts] = body.split(".");
  const decimal = decimalParts.length ? `.${decimalParts.join("")}` : "";
  const normalizedInteger = integer.replace(/^0+(?=\d)/, "");
  return `${sign}${normalizedInteger}${decimal}`;
};

const isIncompleteNumberDraft = (draft) => ["", "-", ".", "-.", "0.", "-0."].includes(draft);

const useNumericInputDraft = ({ value, onChange, emptyWhenZero = true, allowNegative = false, readOnly, onFocus, onBlur, onKeyDown }) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => formatNumberForInput(value, emptyWhenZero));

  useEffect(() => {
    if (!focused) setDraft(formatNumberForInput(value, emptyWhenZero));
  }, [value, emptyWhenZero, focused]);

  const commit = useCallback((rawDraft = draft) => {
    const next = normalizeNumberDraft(rawDraft, allowNegative);
    if (isIncompleteNumberDraft(next)) {
      onChange(0);
      setDraft(formatNumberForInput(0, emptyWhenZero));
      return;
    }
    const parsed = Number(next);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
      setDraft(formatNumberForInput(parsed, emptyWhenZero));
    } else {
      setDraft(formatNumberForInput(value, emptyWhenZero));
    }
  }, [allowNegative, draft, emptyWhenZero, onChange, value]);

  const inputProps = {
    type: "text",
    inputMode: "decimal",
    value: draft,
    onFocus: (event) => {
      setFocused(true);
      if (!readOnly && emptyWhenZero && Number(value) === 0) setDraft("");
      onFocus?.(event);
    },
    onChange: (event) => {
      const next = normalizeNumberDraft(event.target.value, allowNegative);
      setDraft(next);
      if (!isIncompleteNumberDraft(next)) {
        const parsed = Number(next);
        if (Number.isFinite(parsed)) onChange(parsed);
      }
    },
    onBlur: (event) => {
      setFocused(false);
      commit(event.currentTarget.value);
      onBlur?.(event);
    },
    onKeyDown: (event) => {
      if (event.key === "Enter") {
        commit(event.currentTarget.value);
        event.currentTarget.blur();
      } else if (event.key === "Escape") {
        setDraft(formatNumberForInput(value, emptyWhenZero));
        event.currentTarget.blur();
      }
      onKeyDown?.(event);
    },
  };

  return inputProps;
};

const NumInput = ({
  value,
  onChange,
  suffix,
  prefix,
  step = 1,
  className = "",
  emptyWhenZero = true,
  allowNegative = false,
  onFocus,
  onBlur,
  onKeyDown,
  readOnly,
  ...rest
}) => {
  const inputProps = useNumericInputDraft({ value, onChange, emptyWhenZero, allowNegative, readOnly, onFocus, onBlur, onKeyDown });
  return (
    <div className={`flex items-stretch border bg-white/60 input-glow rounded-sm ${className}`} style={{ borderColor: COLORS.line }}>
      {prefix && <div className="px-2 flex items-center text-xs font-mono" style={{ color: COLORS.inkSoft, background: COLORS.paper }}>{prefix}</div>}
      <input
        {...inputProps}
        step={step}
        readOnly={readOnly}
        className="flex-1 px-2 py-2.5 sm:py-1.5 bg-transparent font-mono text-sm w-full"
        style={{ color: COLORS.ink, minWidth: 0 }}
        {...rest}
      />
      {suffix && <div className="px-2 flex items-center text-xs font-mono" style={{ color: COLORS.inkSoft, background: COLORS.paper }}>{suffix}</div>}
    </div>
  );
};

const InlineNumInput = ({
  value,
  onChange,
  min,
  step = 1,
  style = {},
  emptyWhenZero = true,
  allowNegative = false,
  readOnly,
  ...rest
}) => {
  const inputProps = useNumericInputDraft({ value, onChange, emptyWhenZero, allowNegative, readOnly });
  return (
    <input
      {...inputProps}
      min={min}
      step={step}
      readOnly={readOnly}
      style={style}
      {...rest}
    />
  );
};

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
    <div className="text-[10px] leading-snug break-words uppercase" style={{ color: COLORS.inkSoft, letterSpacing: 0 }}>{label}</div>
    <div className={`font-display ${big ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-bold number-pill metric-value`} style={{ color: color || COLORS.ink }}>{value}</div>
    {sub && <div className="text-[10px] sm:text-xs font-mono break-all" style={{ color: COLORS.inkSoft }}>{sub}</div>}
  </div>
);

const MiniMetric = ({ label, value, sub, color }) => (
  <div className="min-w-0">
    <div className="text-[10px] leading-snug" style={{ color: COLORS.inkSoft }}>{label}</div>
    <div className="font-mono text-xs sm:text-sm font-semibold leading-tight break-words" style={{ color: color || COLORS.ink }}>{value}</div>
    {sub && <div className="text-[10px] leading-snug break-words" style={{ color: COLORS.inkSoft }}>{sub}</div>}
  </div>
);

const MetricHelpCard = ({ label, value, sub, helper, action, color }) => (
  <div className="p-4 border rounded-sm min-w-0" style={{ borderColor: COLORS.line, background: "white" }}>
    <Metric label={label} value={value} sub={sub} color={color} />
    <div className="mt-3 space-y-2 text-[11px] leading-5" style={{ color: COLORS.inkSoft }}>
      <div className="flex gap-1.5">
        <span className="font-semibold whitespace-nowrap" style={{ color: COLORS.ink }}>怎么看：</span>
        <span className="min-w-0">{helper}</span>
      </div>
      {action && (
        <div className="flex gap-1.5 border-t pt-2" style={{ borderColor: COLORS.line }}>
          <span className="font-semibold whitespace-nowrap" style={{ color: COLORS.oxblood }}>下一步：</span>
          <span className="min-w-0">{action}</span>
        </div>
      )}
    </div>
  </div>
);

const AudienceQuickGuide = ({ compact = false }) => {
  const items = [
    { role: "新老板", text: "先看最后账上还剩现金、回本月份、回报率、最缺钱的时候。" },
    { role: "供应商", text: "先看销售单位、供应商报价、报关申报价、装箱/重量待补。" },
    { role: "运营新人", text: "先看销售排期、补货排期、平台综合扣费、本月实际现金进出。" },
  ];
  return (
    <div className="border rounded-sm" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.72)" }}>
      <div className={`p-3 grid ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"} gap-2 text-xs`}>
        {items.map(item => (
          <div key={item.role} className="leading-5">
            <span className="font-semibold" style={{ color: COLORS.oxblood }}>{item.role}：</span>
            <span style={{ color: COLORS.inkSoft }}>{item.text}</span>
          </div>
        ))}
      </div>
      <div className="px-3 pb-3 text-[11px] leading-5" style={{ color: COLORS.inkSoft }}>
        M0 = 还没开始卖之前先付出去的钱；M1 = 第 1 个月销售。当前 SKU 利润模型不含头程、清关、保险、尾程、平台仓入仓费，这些仍是单独预算项。
      </div>
    </div>
  );
};

const AudienceViewPanel = ({ activeView, setActiveView, totals, calcs, proj, projection, fmt }) => {
  const F = fmt.fmtPrimary;
  const Fs = fmt.fmtSecondary;
  const views = [
    { id: "boss", label: "老板", title: "老板视角", desc: "这一屏回答：这件事值不值得继续推进、钱够不够撑到回本。" },
    { id: "supplier", label: "供应商", title: "供应商视角", desc: "这一屏回答：报价单位、报关口径、重量尺寸有没有对齐。" },
    { id: "ops", label: "运营", title: "运营视角", desc: "这一屏回答：销量排期、补货、平台扣费和现金流有没有卡点。" },
  ];
  const active = views.find((item) => item.id === activeView) || views[0];
  const missingWeightCount = calcs.filter((item) => !(Number(item.weight || item.weightKg || 0) > 0)).length;
  const missingSizeCount = calcs.filter((item) => !(Number(item.volL || 0) > 0 && Number(item.volW || 0) > 0 && Number(item.volH || 0) > 0)).length;
  const missingSpecCount = calcs.filter((item) => (
    !(Number(item.weight || item.weightKg || 0) > 0) ||
    !(Number(item.volL || 0) > 0 && Number(item.volW || 0) > 0 && Number(item.volH || 0) > 0)
  )).length;
  const totalSupplierCostCny = calcs.reduce((sum, item) => sum + Number(item.priceCNY || 0) * Number(item.qty || 0), 0);
  const totalDeclaredCostCny = calcs.reduce((sum, item) => sum + Number((item.declaredCNY ?? item.priceCNY) || 0) * Number(item.qty || 0), 0);
  const avgSupplierCostCny = totals.qty > 0 ? totalSupplierCostCny / totals.qty : 0;
  const avgDeclaredCostCny = totals.qty > 0 ? totalDeclaredCostCny / totals.qty : 0;
  const avgPlatformFee = totals.qty > 0
    ? calcs.reduce((sum, item) => sum + Number(item.c.platformFee || 0) * Number(item.qty || 0), 0) / totals.qty
    : 0;
  const salesMonths = (proj.months || []).filter((month) => !month.isInitial);
  const totalSoldQty = salesMonths.reduce((sum, month) => sum + Number(month.soldQty || 0), 0);
  const totalRestockQty = salesMonths.reduce((sum, month) => sum + Number(month.restockQty || 0), 0);
  const totalRestockCost = salesMonths.reduce((sum, month) => sum + Number(month.restockCost || 0), 0);
  const firstSalesMonth = salesMonths[0] || {};
  const cardsByView = {
    boss: [
      {
        label: "最后账上现金",
        value: F(proj.finalCash),
        sub: proj.finalCash >= 0 ? "现金为正" : "现金为负",
        helper: proj.finalCash >= 0 ? "预测结束时项目账上还有钱，老板先看这个判断资金是否撑得住。" : "预测结束时账上为负，需要补资金、调销量或减少支出。",
        action: proj.finalCash >= 0 ? "再确认补货节奏、合伙人提现和税费是否都已计入。" : "先降低首批量、推迟补货，或准备额外周转资金。",
        color: proj.finalCash >= 0 ? COLORS.emerald : COLORS.crimson,
      },
      {
        label: "回本月份",
        value: proj.breakEvenMonth ? "M" + proj.breakEvenMonth : "未回本",
        sub: `${projection.monthsHorizon} 个月预测期`,
        helper: proj.breakEvenMonth ? `第 ${proj.breakEvenMonth} 个月账上累计现金第一次转正。` : "预测期内累计现金没有转正，说明回款节奏或利润还不够。",
        action: proj.breakEvenMonth ? "看回本前最低现金点，确认这段时间现金能扛住。" : "优先复核售价、平台扣费、销售排期和首批库存量。",
        color: proj.breakEvenMonth ? COLORS.emerald : COLORS.crimson,
      },
      {
        label: "回报率",
        value: fmtPct(totals.roi),
        sub: "扣启动费后利润 " + F(totals.netProfit),
        helper: "看每投入 1 块钱大概能赚回多少；它不是现金流，不能单独替代回本判断。",
        action: "老板看它判断值不值得做，但还要和回本月份、账上现金一起看。",
        color: totals.roi >= 0 ? COLORS.emerald : COLORS.crimson,
      },
      {
        label: "最缺钱的时候",
        value: F(proj.maxDrawdown),
        sub: Fs(proj.maxDrawdown),
        helper: "这是整个预测里资金压力最大的点，用来判断至少要准备多少周转资金。",
        action: "如果这个数太大，先把首批采购和补货计划拆小。",
        color: COLORS.crimson,
      },
    ],
    supplier: [
      {
        label: "销售单位",
        value: String(totals.qty || 0),
        sub: `${calcs.length} 个商品`,
        helper: "这里按上架销售单位算：套装、组合装都按整套，不按单只零件。",
        action: "供应商报价时先确认一箱、一套、一组到底对应几个销售单位。",
        color: COLORS.ink,
      },
      {
        label: "供应商报价",
        value: fmtCnyShort(totalSupplierCostCny),
        sub: `平均 ${fmtCny(avgSupplierCostCny)}/销售单位`,
        helper: "这是实际采购报价口径，供应商主要核对这个价格和销售单位是否一致。",
        action: "如果正式报价变了，先改这里，再重新看利润和现金流。",
        color: COLORS.oxblood,
      },
      {
        label: "报关申报价",
        value: fmtCnyShort(totalDeclaredCostCny),
        sub: `平均 ${fmtCny(avgDeclaredCostCny)}/销售单位`,
        helper: "这是清关和税务测算口径，不一定等于供应商报价，但要能解释差异。",
        action: "报关价和采购价差太大时，需要财务或清关方确认口径。",
        color: COLORS.gold,
      },
      {
        label: "规格待补",
        value: String(missingSpecCount),
        sub: `缺重量 ${missingWeightCount} / 缺尺寸 ${missingSizeCount}`,
        helper: "重量、长宽高会影响平台物流费和头程测算；缺了就先不要定最终报价。",
        action: missingSpecCount ? "让供应商补重量、长宽高、装箱数，再回来刷新测算。" : "规格已齐，可以继续核对平台类目和费用。",
        color: missingSpecCount ? COLORS.crimson : COLORS.emerald,
      },
    ],
    ops: [
      {
        label: "销售排期总量",
        value: String(totalSoldQty),
        sub: `${projection.monthsHorizon} 个月计划销量`,
        helper: "运营先看销量是否已经分到月份里，不能只看总库存。",
        action: totalSoldQty > 0 ? "去销售排期里检查每个月是否符合真实上架节奏。" : "先把预计每月销量填进销售排期。",
        color: totalSoldQty > 0 ? COLORS.emerald : COLORS.crimson,
      },
      {
        label: "补货排期",
        value: String(totalRestockQty),
        sub: totalRestockCost > 0 ? `补货支出 ${F(totalRestockCost)}` : "暂无补货支出",
        helper: "补货会影响账上现金，尤其是回款还没到但先要付货款的时候。",
        action: totalRestockQty > 0 ? "检查补货月份是否早于断货，同时不要把现金压垮。" : "如果首批不够卖，在补货排期里加数量。",
        color: totalRestockQty > 0 ? COLORS.gold : COLORS.inkSoft,
      },
      {
        label: "平均平台扣费",
        value: F(avgPlatformFee),
        sub: "每销售单位",
        helper: "平台佣金、物流、支付和广告预留都会压缩利润，运营调价要先看它。",
        action: "如果扣费偏高，优先检查佣金类目、尺寸体积、签收率和广告预留。",
        color: COLORS.oxblood,
      },
      {
        label: "M1 实际现金进出",
        value: F(firstSalesMonth.cashFlow || 0),
        sub: firstSalesMonth.label || "第 1 个月",
        helper: "这是按实际收付款节奏看的现金，不等同于本月经营利润。",
        action: "如果 M1 为负，看是不是首月销量少、补货早、固定支出或税费过高。",
        color: (firstSalesMonth.cashFlow || 0) >= 0 ? COLORS.emerald : COLORS.crimson,
      },
    ],
  };
  const cards = cardsByView[active.id] || cardsByView.boss;

  return (
    <section className="border rounded-sm overflow-hidden" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.78)" }}>
      <div className="p-4 sm:p-5 border-b" style={{ borderColor: COLORS.line }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] uppercase" style={{ color: COLORS.gold, letterSpacing: 0 }}>查看视角</div>
            <h2 className="font-display text-xl sm:text-2xl font-bold mt-1" style={{ color: COLORS.ink }}>{active.title}</h2>
            <p className="text-xs sm:text-sm leading-6 mt-1 max-w-3xl" style={{ color: COLORS.inkSoft }}>{active.desc}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-sm border p-1" style={{ borderColor: COLORS.line, background: COLORS.paper }}>
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id)}
                className="px-3 py-2 text-xs font-medium rounded-sm"
                style={{
                  background: active.id === view.id ? COLORS.oxblood : "transparent",
                  color: active.id === view.id ? COLORS.cream : COLORS.inkSoft,
                }}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((card) => (
          <MetricHelpCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  );
};

const DecisionSummaryPanel = ({ totals, params, calcs, proj, projection, fmt, readOnly = false }) => {
  const F = fmt.fmtPrimary;
  const totalSupplierCostCny = calcs.reduce((sum, item) => sum + Number(item.priceCNY || 0) * Number(item.qty || 0), 0);
  const totalDeclaredCostCny = calcs.reduce((sum, item) => sum + Number((item.declaredCNY ?? item.priceCNY) || 0) * Number(item.qty || 0), 0);
  const avgPlatformFee = totals.qty > 0
    ? calcs.reduce((sum, item) => sum + Number(item.c.platformFee || 0) * Number(item.qty || 0), 0) / totals.qty
    : 0;
  const finalCashOk = (proj.finalCash || 0) >= 0;
  const profitOk = (totals.netProfit || 0) >= 0;
  const paybackOk = Boolean(proj.breakEvenMonth);
  const missingWeightCount = calcs.filter((item) => !(Number(item.weight || item.weightKg || 0) > 0)).length;
  const missingSizeCount = calcs.filter((item) => !(Number(item.volL || 0) > 0 && Number(item.volW || 0) > 0 && Number(item.volH || 0) > 0)).length;
  const missingSpecCount = missingWeightCount + missingSizeCount;
  const taxLabel = TAX_SCHEMES[params.taxScheme]?.shortZh || params.taxScheme || "未选择";
  const statusItems = [
    {
      label: "账上现金",
      ok: finalCashOk,
      text: F(proj.finalCash),
      note: finalCashOk ? "预测结束后账上仍为正，资金暂时撑得住。" : "预测结束后账上为负，需要补资金或调排期。",
      action: finalCashOk ? "下一步看最缺钱月份，确认中间现金不断。" : "先减少首批量、延后补货，或补周转资金。",
    },
    {
      label: "回本",
      ok: paybackOk,
      text: paybackOk ? "M" + proj.breakEvenMonth : projection.monthsHorizon + " 个月内未回本",
      note: paybackOk ? `第 ${proj.breakEvenMonth} 个月累计现金转正。` : "预测期内现金没有转正，老板要谨慎。",
      action: paybackOk ? "继续检查回本前现金压力。" : "优先复核售价、平台扣费和销量排期。",
    },
    {
      label: "利润",
      ok: profitOk,
      text: F(totals.netProfit),
      note: profitOk ? "扣掉启动费后仍有利润。" : "扣掉启动费后亏损，需要复核售价、扣费和成本。",
      action: profitOk ? "再用敏感性分析看售价和汇率变化。" : "先不要发布给外部，先调售价或成本。",
    },
    {
      label: "规格",
      ok: missingWeightCount === 0 && missingSizeCount === 0,
      text: (missingWeightCount || missingSizeCount) ? `缺重量 ${missingWeightCount} / 缺尺寸 ${missingSizeCount}` : "重量和尺寸已填写",
      note: (missingWeightCount || missingSizeCount) ? "规格缺失会影响平台物流费和头程测算。" : "规格齐全后，费用匹配会更可靠。",
      action: (missingWeightCount || missingSizeCount) ? "让供应商补重量、长宽高、装箱数。" : "可以继续核对平台佣金类目。",
    },
  ];
  const confirmItems = [
    {
      label: "商品数",
      value: String(calcs.length),
      sub: "销售单位 " + (totals.qty || 0),
      helper: "确认这里不是单只数量，而是平台上架卖给客户的单位数量。",
      action: "套装、组合装先统一销售单位。",
      color: COLORS.ink,
    },
    {
      label: "供应商报价",
      value: fmtCnyShort(totalSupplierCostCny),
      sub: "按销售单位",
      helper: "这是和供应商谈采购价的底数，会直接影响商品利润。",
      action: "正式报价变动后先改这里。",
      color: COLORS.oxblood,
    },
    {
      label: "报关申报价",
      value: fmtCnyShort(totalDeclaredCostCny),
      sub: "税务口径",
      helper: "这是清关和税务测算用的口径，和采购价不一致时要能解释。",
      action: "让清关/财务确认后再发布。",
      color: COLORS.gold,
    },
    {
      label: "平均平台扣费",
      value: F(avgPlatformFee),
      sub: "每销售单位",
      helper: "这是平台佣金、物流、支付、广告预留等合计后的平均扣费。",
      action: "扣费偏高时先查类目、尺寸、签收率。",
      color: COLORS.emerald,
    },
  ];
  const roleNotes = [
    {
      role: "老板先看",
      text: finalCashOk && paybackOk ? "账上现金和回本月份都能接受，再看回报率是否值得投入。" : "先别只看利润，现金和回本还没完全过关。",
    },
    {
      role: "供应商先看",
      text: missingSpecCount ? "报价之外还要补重量、长宽高，否则平台物流费会偏。" : "供应商报价、报关申报价和规格都可以继续核对。",
    },
    {
      role: "运营先看",
      text: "销售排期、补货排期和平台扣费决定现金什么时候进出，后面在对应页签细调。",
    },
  ];
  const decisionText = finalCashOk && profitOk && paybackOk
    ? "这版在确认最终报价、报关价、重量和包装规格后，可以进入报价和供货讨论。"
    : "这版在做决策前还需要继续调整。";

  return (
    <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
      <div className="border rounded-sm p-4 sm:p-5" style={{ borderColor: COLORS.oxblood + "66", background: "rgba(92,26,27,0.05)" }}>
        <div className="text-[10px] uppercase" style={{ color: COLORS.oxblood, letterSpacing: 0 }}>决策摘要</div>
        <h2 className="font-display text-xl sm:text-2xl font-bold mt-1" style={{ color: COLORS.ink }}>决策摘要</h2>
        <p className="mt-2 text-sm sm:text-base leading-7" style={{ color: COLORS.ink }}>{decisionText}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {statusItems.map((item) => (
            <div key={item.label} className="flex items-start gap-2 border rounded-sm p-3" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.76)" }}>
              <span className="mt-1 h-2 w-2 rounded-full flex-shrink-0" style={{ background: item.ok ? COLORS.emerald : COLORS.crimson }} />
              <div>
                <div className="text-[10px] font-semibold" style={{ color: item.ok ? COLORS.emerald : COLORS.crimson }}>{item.label}</div>
                <div className="text-xs leading-5" style={{ color: COLORS.inkSoft }}>{item.text}</div>
                <div className="text-[11px] leading-5 mt-1" style={{ color: COLORS.inkSoft }}>{item.note}</div>
                <div className="text-[11px] leading-5 mt-1 font-medium" style={{ color: COLORS.ink }}>{item.action}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
          {roleNotes.map((item) => (
            <div key={item.role} className="border rounded-sm p-3 text-[11px] leading-5" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.62)", color: COLORS.inkSoft }}>
              <span className="font-semibold" style={{ color: COLORS.oxblood }}>{item.role}：</span>{item.text}
            </div>
          ))}
        </div>
      </div>
      <div className="border rounded-sm p-4 sm:p-5" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.78)" }}>
        <div className="text-[10px] uppercase" style={{ color: COLORS.gold, letterSpacing: 0 }}>报价确认</div>
        <h2 className="font-display text-xl sm:text-2xl font-bold mt-1" style={{ color: COLORS.ink }}>报价前要对齐的数字</h2>
        <p className="mt-2 text-xs leading-6" style={{ color: COLORS.inkSoft }}>
          这块不是最终结论，而是发给老板、供应商或新人前必须确认的输入口径。
        </p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {confirmItems.map((item) => (
            <MetricHelpCard key={item.label} {...item} />
          ))}
        </div>
        <div className="mt-4 text-xs leading-6" style={{ color: COLORS.inkSoft }}>
          当前税制：<strong style={{ color: COLORS.ink }}>{taxLabel}</strong>。
          {readOnly
            ? "最终报价、报关申报价、重量和包装规格如有变化，请联系内部人员更新并重新发布。"
            : "最终报价、报关申报价、重量和包装规格确认后，请重新保存并发布。"}
        </div>
      </div>
    </section>
  );
};

const MetricBasisNote = ({ totals, params, proj, projection, fmt, compact = false }) => {
  if (!totals || !proj || !fmt) return null;
  const F = fmt.fmtPrimary;
  const Fs = fmt.fmtSecondary;
  const operatingNet = Number(totals.operatingNetProfit || 0);
  const setupCost = Number(params?.oneTimeCosts ?? totals.setupCost ?? 0);
  const projectNet = Number(totals.netProfit || 0);
  const scheduleNet = Number(proj.totalNetProfit || 0);
  const finalCash = Number(proj.finalCash || 0);
  const initialOutflow = Number(proj.initialOutflow || 0);
  const laterCashFlow = (proj.months || []).filter(m => !m.isInitial).reduce((a, b) => a + (b.cashFlow || 0), 0);
  const scheduleGap = scheduleNet - operatingNet;
  const cashGap = finalCash - scheduleNet;
  const partnerPayout = Number(proj.totalPartnerPayout || 0);
  const totalDistributed = (proj.months || []).reduce((a, b) => a + (b.distributed || 0), 0);
  const totalRestockAfterM0 = (proj.months || []).filter(m => !m.isInitial).reduce((a, b) => a + (b.restockCost || 0), 0);
  const totalFixedCost = (proj.months || []).filter(m => !m.isInitial).reduce((a, b) => a + (b.fixedCost || 0), 0);
  const horizon = projection?.monthsHorizon || ((proj.months || []).length ? (proj.months.length - 1) : 0);
  const isNearZero = (v) => Math.abs(v) < 0.01;
  const absMoney = (v) => `${F(Math.abs(v))} / ${Fs(Math.abs(v))}`;
  const diffText = (v, base) => isNearZero(v) ? `和${base}基本一致` : `比${base}${v >= 0 ? "多了" : "少了"} ${absMoney(v)}`;
  const rowClass = compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2";

  return (
    <div className="border rounded-sm" style={{ borderColor: COLORS.gold + "66", background: "rgba(242,237,227,0.55)" }}>
      <div className="px-4 py-3 border-b flex items-start gap-2" style={{ borderColor: COLORS.line }}>
        <Info size={15} style={{ color: COLORS.gold, flexShrink: 0, marginTop: 2 }} />
        <div>
          <div className="text-[10px] tracking-[0.2em] uppercase font-body" style={{ color: COLORS.gold }}>数值口径说明</div>
          <div className="font-display text-lg font-semibold" style={{ color: COLORS.ink }}>当前数值口径对照</div>
          <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
            先记一句：商品利润看“赚不赚”，月度排期看“什么时候赚到”，账上现金看“钱包最后剩多少”。所以红框里的数字本来就不一定相等。
          </div>
        </div>
      </div>
      <div className={`p-4 grid ${rowClass} gap-3 text-xs`}>
        <div className="p-3 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
          <div className="font-semibold mb-2" style={{ color: COLORS.ink }}>1. 商品利润：这批货本身赚不赚</div>
          <div className="leading-6" style={{ color: COLORS.inkSoft }}>
            <div>当前结果：<strong style={{ color: COLORS.emerald }}>{F(operatingNet)}</strong><span className="font-mono ml-1">({Fs(operatingNet)})</span></div>
            <div>怎么算：把每个商品按当前售价、供应商报价、平台扣费和税算一遍再相加。</div>
            <div>注意：它不看几月卖完，也还没扣一次性启动费。</div>
          </div>
        </div>
        <div className="p-3 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
          <div className="font-semibold mb-2" style={{ color: COLORS.ink }}>2. 项目利润：扣掉前期费用后还剩多少</div>
          <div className="leading-6" style={{ color: COLORS.inkSoft }}>
            <div>当前结果：<strong style={{ color: projectNet >= 0 ? COLORS.emerald : COLORS.crimson }}>{F(projectNet)}</strong><span className="font-mono ml-1">({Fs(projectNet)})</span></div>
            <div>怎么算：第 1 项商品利润 {F(operatingNet)} - 启动费 {F(setupCost)}。</div>
            <div>适合看：这批货把前期费用也扣掉后，项目整体还赚不赚。</div>
          </div>
        </div>
        <div className="p-3 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
          <div className="font-semibold mb-2" style={{ color: COLORS.ink }}>3. 月度排期利润：按每个月卖货节奏重算</div>
          <div className="leading-6" style={{ color: COLORS.inkSoft }}>
            <div>当前结果：<strong style={{ color: scheduleNet >= 0 ? COLORS.emerald : COLORS.crimson }}>{F(scheduleNet)}</strong><span className="font-mono ml-1">({Fs(scheduleNet)})</span></div>
            <div>怎么算：把 M1-M{horizon} 每个月“本月经营利润”加起来。</div>
            <div>为什么会变：它按月份重新算销量、当月售价/扣费和固定月费，<span style={{ color: scheduleGap >= 0 ? COLORS.emerald : COLORS.crimson }}>所以{diffText(scheduleGap, "第 1 项商品利润")}</span>。</div>
          </div>
        </div>
        <div className="p-3 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
          <div className="font-semibold mb-2" style={{ color: COLORS.ink }}>4. 账上现金：最后钱包里还剩多少</div>
          <div className="leading-6" style={{ color: COLORS.inkSoft }}>
            <div>当前结果：<strong style={{ color: finalCash >= 0 ? COLORS.emerald : COLORS.crimson }}>{F(finalCash)}</strong><span className="font-mono ml-1">({Fs(finalCash)})</span></div>
            <div>怎么算：M0 先付出去的钱 {F(-initialOutflow)} + 后续每月实际现金进出 {F(laterCashFlow)}。</div>
            <div>为什么会变：这不是利润表，是现金余额；补货、固定支出、分给合伙人的钱都会影响它，<span style={{ color: cashGap >= 0 ? COLORS.emerald : COLORS.crimson }}>所以{diffText(cashGap, "第 3 项月度利润合计")}</span>。</div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 text-[11px] leading-5" style={{ color: COLORS.inkSoft }}>
        看表顺序：老板先看第 4 项，运营复盘看第 3 项，供应商报价沟通看第 1 项。第 3 项和第 4 项最容易不同，因为利润表按成本归属算，现金余额按真钱收付时间算。额外参考：后续补货支出 {F(totalRestockAfterM0)}，固定支出合计 {F(totalFixedCost)}，本月拿出来分的钱 {F(totalDistributed)}，分给合伙人的钱 {F(partnerPayout)}。
      </div>
    </div>
  );
};

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
  const guideHref = `${import.meta.env.BASE_URL || "/"}usage-guide.html`;

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
          <a href={guideHref} target="_blank" rel="noopener noreferrer"
            className="btn-interact w-full mt-3 px-4 py-2.5 text-sm font-medium rounded-sm flex items-center justify-center gap-2 border"
            style={{ borderColor: COLORS.line, color: COLORS.oxblood, background: "rgba(255,255,255,0.65)" }}>
            <BookOpen size={15} /> {t("usageGuide")}
          </a>
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
export default function App({
  initialData = null,
  initialProjectName = "",
  initialDataVersion = "",
  readOnly = false,
  sourceLabel = "",
  editCopyHref = "",
  cloudEditHref = "",
  cloudMode = false,
  cloudProjects = [],
  currentCloudProjectId = "",
  onCloudProjectChange = null,
  onCloudSave = null,
  onCloudShare = null,
  onCloudOpenLibrary = null,
}) {
  const [lang, setLang] = useState(() => localStorage.getItem("ru_calc_lang") || "zh");
  if (readOnly || initialData) {
    return (
      <AppContent
        lang={lang}
        setLang={setLang}
        initialData={initialData}
        initialProjectName={initialProjectName}
        initialDataVersion={initialDataVersion}
        readOnly={readOnly}
        sourceLabel={sourceLabel}
        editCopyHref={editCopyHref}
        cloudEditHref={cloudEditHref}
        cloudMode={cloudMode}
        cloudProjects={cloudProjects}
        currentCloudProjectId={currentCloudProjectId}
        onCloudProjectChange={onCloudProjectChange}
        onCloudSave={onCloudSave}
        onCloudShare={onCloudShare}
        onCloudOpenLibrary={onCloudOpenLibrary}
      />
    );
  }

  return (
    <LoginGate lang={lang} setLang={setLang}>
      <AppContent lang={lang} setLang={setLang} />
    </LoginGate>
  );
}

function AppContent({
  lang,
  setLang,
  initialData = null,
  initialProjectName = "",
  initialDataVersion = "",
  readOnly = false,
  sourceLabel = "",
  editCopyHref = "",
  cloudEditHref = "",
  cloudMode = false,
  cloudProjects = [],
  currentCloudProjectId = "",
  onCloudProjectChange = null,
  onCloudSave = null,
  onCloudShare = null,
  onCloudOpenLibrary = null,
}) {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [products, setProducts] = useState(SAMPLE_PRODUCTS);
  const [scheduleStore, setScheduleStore] = useState({});
  const [priceScheduleStore, setPriceScheduleStore] = useState({});
  const [restockStore, setRestockStore] = useState({});
  const [withdrawalStore, setWithdrawalStore] = useState({ amounts: [] });
  const [projection, setProjection] = useState(DEFAULT_PROJECTION);
  const [projectMeta, setProjectMeta] = useState({});
  const [tab, setTab] = useState("dashboard");
  const [expandedRow, setExpandedRow] = useState(null);
  const [storageStatus, setStorageStatus] = useState("");
  const [storageBusy, setStorageBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // --- 多项目管理状态 ---
  const [projectName, setProjectName] = useState("");  // 启动时从 localStorage 读取
  const [currentProjectFile, setCurrentProjectFile] = useState(null);
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const baseHref = import.meta.env.BASE_URL || "/";
  const guideHref = `${baseHref}usage-guide.html`;

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

  // ============================================================
  // 多项目存储辅助函数
  // ============================================================
  const PROJECTS_KEY = "ru_calc_projects";  // { [name]: { data, savedAt, skuCount } }

  const getProjectIndex = () => {
    try { return JSON.parse(localStorage.getItem(PROJECTS_KEY) || "{}"); } catch { return {}; }
  };

  const getCurrentData = () => ({
    params, products, scheduleStore, priceScheduleStore, restockStore, withdrawalStore, projection, projectMeta,
  });

  const applyData = (data) => {
    if (data.params) setParams({ ...DEFAULT_PARAMS, ...data.params });
    if (Array.isArray(data.products)) setProducts(data.products);
    if (data.scheduleStore) setScheduleStore(data.scheduleStore); else setScheduleStore({});
    if (data.priceScheduleStore) setPriceScheduleStore(data.priceScheduleStore); else setPriceScheduleStore({});
    if (data.restockStore) setRestockStore(data.restockStore); else setRestockStore({});
    if (data.withdrawalStore) setWithdrawalStore(data.withdrawalStore); else setWithdrawalStore({ amounts: [] });
    if (data.projection) setProjection({ ...DEFAULT_PROJECTION, ...data.projection });
    setProjectMeta(data.projectMeta || {});
  };

  useEffect(() => {
    if (!initialData) return;
    applyData(initialData);
    setCurrentProjectFile(null);
    setProjectName(initialProjectName || initialData.projectName || t("projectUntitled"));
    setLoaded(true);
    if (sourceLabel && !readOnly) {
      setStorageStatus(sourceLabel);
      setTimeout(() => setStorageStatus(""), 3000);
    }
  }, [initialData, initialProjectName, initialDataVersion, readOnly, sourceLabel]);

  // --- 启动时加载数据：优先从分享链接 hash，其次 localStorage ---
  useEffect(() => {
    if (initialData) return;

    const loadProjectFile = async (projectFile) => {
      try {
        const safeFile = decodeURIComponent(projectFile || "").trim().replace(/^\.\/+/, "");
        if (
          !safeFile ||
          !safeFile.endsWith(".json") ||
          safeFile.includes("..") ||
          safeFile.includes("\\") ||
          safeFile.startsWith("/") ||
          /^[a-z][a-z0-9+.-]*:/i.test(safeFile)
        ) {
          throw new Error("Invalid project file");
        }
        const basePath = import.meta.env.BASE_URL || "/";
        const response = await fetch(`${basePath}${safeFile}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`Project file not found: ${safeFile}`);
        const parsed = await response.json();
        const data = {
          params: parsed.p || parsed.params || DEFAULT_PARAMS,
          products: parsed.pr || parsed.products || [],
          scheduleStore: parsed.ss || parsed.scheduleStore || {},
          priceScheduleStore: parsed.ps || parsed.priceScheduleStore || {},
          restockStore: parsed.rs || parsed.restockStore || {},
          withdrawalStore: parsed.ws || parsed.withdrawalStore || { amounts: [] },
          projection: parsed.pj || parsed.projection || DEFAULT_PROJECTION,
          projectMeta: parsed.pm || parsed.projectMeta || {},
        };
        applyData(data);
        const loadedName = parsed.projectName || safeFile.replace(/\.json$/i, "");
        setCurrentProjectFile(safeFile);
        setProjectName(loadedName);
        setStorageStatus(t("projectLoaded", { name: loadedName }));
        setTimeout(() => setStorageStatus(""), 3000);
        setLoaded(true);
      } catch (e) {
        console.error("Failed to load project file:", e);
        setStorageStatus(t("projectImportFail"));
        setTimeout(() => setStorageStatus(""), 3000);
        setLoaded(true);
      }
    };

    const loadShared = async (b64) => {
      try {
        const token = decodeURIComponent(b64 || "");
        if (!token) throw new Error("Empty share token");

        let json = "";
        if (token.startsWith("plain:")) {
          const bytes = decodeBase64ToBytes(token.slice(6));
          json = textDecoder.decode(bytes);
        } else {
          const compressed = token.startsWith("gz:") ? token.slice(3) : token;
          if (typeof DecompressionStream !== "function") {
            throw new Error("Compressed share links are not supported in this browser");
          }
          const bytes = decodeBase64ToBytes(compressed);
          const ds = new DecompressionStream('gzip');
          const decompressed = new Response(new Blob([bytes]).stream().pipeThrough(ds));
          json = await decompressed.text();
        }
        const parsed = JSON.parse(json);
        // 支持精简格式(p/pr/pj)和完整格式(params/products)
        const pp = parsed.p || parsed.params;
        const pr = parsed.pr || parsed.products;
        if (pp) setParams({ ...DEFAULT_PARAMS, ...pp });
        if (Array.isArray(pr)) setProducts(pr);
        if (parsed.ss || parsed.scheduleStore) setScheduleStore(parsed.ss || parsed.scheduleStore);
        if (parsed.ps || parsed.priceScheduleStore) setPriceScheduleStore(parsed.ps || parsed.priceScheduleStore);
        if (parsed.rs || parsed.restockStore) setRestockStore(parsed.rs || parsed.restockStore);
        if (parsed.ws || parsed.withdrawalStore) setWithdrawalStore(parsed.ws || parsed.withdrawalStore);
        const pj = parsed.pj || parsed.projection;
        if (pj) setProjection({ ...DEFAULT_PROJECTION, ...pj });
        setProjectMeta(parsed.pm || parsed.projectMeta || {});
        setCurrentProjectFile(null);
        setProjectName(parsed.projectName || t("projectUntitled"));
        setStorageStatus(t("loadedShare"));
        setTimeout(() => setStorageStatus(""), 3000);
        window.history.replaceState(null, '', window.location.pathname);
      } catch (e) {
        console.error('Failed to load shared data:', e);
        setStorageStatus(t("shareLoadFail"));
        setTimeout(() => setStorageStatus(""), 3000);
      }
      setLoaded(true);
    };

    const hash = window.location.hash;
    if (hash.startsWith('#share=')) { loadShared(hash.slice(7)); return; }
    const projectFile = new URLSearchParams(window.location.search).get("project");
    if (projectFile) { loadProjectFile(projectFile); return; }

    // 尝试从多项目索引加载上次打开的项目
    try {
      const index = getProjectIndex();
      const lastProject = localStorage.getItem("ru_calc_last_project");

      if (lastProject && index[lastProject]) {
        // 加载上次打开的项目
        applyData(index[lastProject].data);
        setCurrentProjectFile(null);
        setProjectName(lastProject);
        setStorageStatus(t("projectLoaded", { name: lastProject }));
        setTimeout(() => setStorageStatus(""), 2200);
      } else if (Object.keys(index).length > 0) {
        // 有项目但没有 last_project，加载第一个
        const firstName = Object.keys(index)[0];
        applyData(index[firstName].data);
        setCurrentProjectFile(null);
        setProjectName(firstName);
        setStorageStatus(t("projectLoaded", { name: firstName }));
        setTimeout(() => setStorageStatus(""), 2200);
      } else {
        // 兼容旧版：迁移 ru_calc_v2 数据
        const oldSaved = localStorage.getItem("ru_calc_v2");
        if (oldSaved) {
          const parsed = JSON.parse(oldSaved);
          applyData(parsed);
          const migrateName = t("projectUntitled");
          setCurrentProjectFile(null);
          setProjectName(migrateName);
          // 自动保存到新格式
          const newIndex = {};
          newIndex[migrateName] = {
            data: parsed,
            savedAt: new Date().toISOString(),
            skuCount: Array.isArray(parsed.products) ? parsed.products.length : 0,
          };
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(newIndex));
          localStorage.setItem("ru_calc_last_project", migrateName);
          setStorageStatus(t("loadedLocal"));
          setTimeout(() => setStorageStatus(""), 2200);
        } else {
          setCurrentProjectFile(null);
          setProjectName(t("projectUntitled"));
        }
      }
    } catch (e) {
      console.error("Failed to load projects:", e);
      setCurrentProjectFile(null);
      setProjectName(t("projectUntitled"));
    }
    setLoaded(true);
  }, []);

  // --- 数据变化时自动保存到 localStorage（保持自动保存到当前项目）---
  useEffect(() => {
    if (readOnly || initialData) return;
    if (!loaded || !projectName) return;
    try {
      const index = getProjectIndex();
      index[projectName] = {
        data: getCurrentData(),
        savedAt: new Date().toISOString(),
        skuCount: products.length,
      };
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(index));
      localStorage.setItem("ru_calc_last_project", projectName);
      // 同时保留旧 key 兼容
      localStorage.setItem("ru_calc_v2", JSON.stringify(getCurrentData()));
    } catch (e) {}
  }, [params, products, scheduleStore, priceScheduleStore, restockStore, withdrawalStore, projection, projectMeta, loaded, projectName]);

  // ============================================================
  // 项目管理函数
  // ============================================================
  const saveProject = (name) => {
    if (!name) return;
    setStorageBusy(true);
    try {
      const index = getProjectIndex();
      index[name] = {
        data: getCurrentData(),
        savedAt: new Date().toISOString(),
        skuCount: products.length,
      };
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(index));
      localStorage.setItem("ru_calc_last_project", name);
      setProjectName(name);
      setStorageStatus(t("projectSaved", { name }));
    } catch (e) { setStorageStatus(t("saveFail")); }
    finally { setStorageBusy(false); setTimeout(() => setStorageStatus(""), 2200); }
  };

  const buildNamedProjectData = () => ({ projectName, ...getCurrentData() });

  const saveToCloud = async () => {
    if (cloudMode && onCloudSave) {
      setStorageBusy(true);
      try {
        const result = await onCloudSave({
          name: projectName,
          data: buildNamedProjectData(),
        });
        if (result?.name) setProjectName(result.name);
        setStorageStatus(result?.message || "Cloud saved");
      } catch (e) {
        console.error("Cloud save failed:", e);
        setStorageStatus(e?.message || "Cloud save failed");
      } finally {
        setStorageBusy(false);
        setTimeout(() => setStorageStatus(""), 2600);
      }
      return;
    }

    saveProject(projectName);
  };
  const publicProjectHref = (file) => `${baseHref}?project=${encodeURIComponent(file)}`;
  const currentPublicProject = PUBLIC_PROJECTS.find(item => item.file === currentProjectFile)
    || PUBLIC_PROJECTS.find(item => item.name === projectName)
    || null;
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const encodeBytesToBase64 = (bytes) => {
    let binStr = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binStr += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binStr);
  };

  const decodeBase64ToBytes = (input) => {
    const bin = atob(input);
    return Uint8Array.from(bin, (char) => char.charCodeAt(0));
  };

  const copyText = async (text, successKey = "shareCopied") => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (!copied) throw new Error("execCommand copy failed");
      }
      setStorageStatus(t(successKey));
      setTimeout(() => setStorageStatus(""), 3000);
      return true;
    } catch (e) {
      console.error("Copy failed:", e);
      setStorageStatus(t("shareFail"));
      setTimeout(() => setStorageStatus(""), 3000);
      return false;
    }
  };

  const copyPublicProjectLink = async (file) => {
    const url = `${window.location.origin}${publicProjectHref(file)}`;
    return copyText(url, "publicLinkCopied");
  };

  const saveAsProject = () => {
    const newName = prompt(t("projectSaveAsPrompt"), projectName + " " + t("projectDuplicate"));
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    const index = getProjectIndex();
    if (index[trimmed] && !confirm(t("projectNameExists"))) return;
    saveProject(trimmed);
  };

  const loadProject = (name) => {
    const index = getProjectIndex();
    if (!index[name]) return;
    if (!confirm(t("projectOpenConfirm", { name }))) return;
    applyData(index[name].data);
    setCurrentProjectFile(null);
    setProjectName(name);
    localStorage.setItem("ru_calc_last_project", name);
    setStorageStatus(t("projectLoaded", { name }));
    setTimeout(() => setStorageStatus(""), 2200);
    window.history.replaceState(null, "", window.location.pathname);
    setShowProjectPanel(false);
    setExpandedRow(null);
  };

  const deleteProject = (name) => {
    if (!confirm(t("projectDeleteConfirm", { name }))) return;
    const index = getProjectIndex();
    delete index[name];
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(index));
    // 如果删的是当前项目，不改变界面数据，只更新标题
    if (name === projectName) {
      const remaining = Object.keys(index);
      if (remaining.length > 0) {
        loadProject(remaining[0]); // 这里不弹 confirm
      }
    }
    setStorageStatus(t("projectSaved", { name: "OK" }));
    setTimeout(() => setStorageStatus(""), 2200);
  };

  const renameProject = (oldName, newName) => {
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    const index = getProjectIndex();
    if (index[trimmed] && !confirm(t("projectNameExists"))) return;
    index[trimmed] = index[oldName];
    delete index[oldName];
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(index));
    if (oldName === projectName) {
      setProjectName(trimmed);
      localStorage.setItem("ru_calc_last_project", trimmed);
    }
  };

  const newProject = () => {
    const name = prompt(t("projectNewNamePrompt"));
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    // 先保存当前项目
    saveProject(projectName);
    // 清空所有数据
    setParams(DEFAULT_PARAMS);
    setProducts([]);
    setScheduleStore({});
    setPriceScheduleStore({});
    setRestockStore({});
    setWithdrawalStore({ amounts: [] });
    setProjection(DEFAULT_PROJECTION);
    setProjectMeta({});
    setExpandedRow(null);
    setCurrentProjectFile(null);
    setProjectName(trimmed);
    // 立即保存空项目
    const index = getProjectIndex();
    index[trimmed] = {
      data: { params: DEFAULT_PARAMS, products: [], scheduleStore: {}, priceScheduleStore: {}, restockStore: {}, withdrawalStore: { amounts: [] }, projection: DEFAULT_PROJECTION, projectMeta: {} },
      savedAt: new Date().toISOString(),
      skuCount: 0,
    };
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(index));
    localStorage.setItem("ru_calc_last_project", trimmed);
    window.history.replaceState(null, "", window.location.pathname);
    setShowProjectPanel(false);
    setStorageStatus(t("projectSaved", { name: trimmed }));
    setTimeout(() => setStorageStatus(""), 2200);
  };

  const exportProjectJSON = () => {
    const data = { projectName, ...getCurrentData() };
    const json = JSON.stringify(data, null, 2);
    // 使用 data URI 方式确保文件名正确（避免 blob URL 产生 UUID 文件名）
    const safeName = (projectName || "project").replace(/[<>:"/\\|?*]/g, "_");
    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(json);
    const a = document.createElement("a");
    a.href = dataUri;
    a.download = `${safeName}.json`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setStorageStatus("已导出 JSON：" + t("projectExportJson"));
    setTimeout(() => setStorageStatus(""), 2200);
  };

  const importProjectJSON = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          // 楠岃瘉鍩烘湰缁撴瀯
          if (!parsed.params && !parsed.products && !parsed.p && !parsed.pr) {
            setStorageStatus(t("projectImportFail"));
            setTimeout(() => setStorageStatus(""), 3000);
            return;
          }
          // 支持两种格式：完整格式和分享精简格式
          const data = {};
          data.params = parsed.p || parsed.params || DEFAULT_PARAMS;
          data.products = parsed.pr || parsed.products || [];
          data.scheduleStore = parsed.ss || parsed.scheduleStore || {};
          data.priceScheduleStore = parsed.ps || parsed.priceScheduleStore || {};
          data.restockStore = parsed.rs || parsed.restockStore || {};
          data.withdrawalStore = parsed.ws || parsed.withdrawalStore || { amounts: [] };
          data.projection = parsed.pj || parsed.projection || DEFAULT_PROJECTION;
          data.projectMeta = parsed.pm || parsed.projectMeta || {};

          applyData(data);
          const importName = parsed.projectName || file.name.replace(/\.json$/i, "");
          setCurrentProjectFile(null);
          setProjectName(importName);

          // 保存到项目索引
          const index = getProjectIndex();
          index[importName] = {
            data,
            savedAt: new Date().toISOString(),
            skuCount: Array.isArray(data.products) ? data.products.length : 0,
          };
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(index));
          localStorage.setItem("ru_calc_last_project", importName);
          window.history.replaceState(null, "", window.location.pathname);
          setStorageStatus(t("projectImportSuccess", { name: importName }));
          setTimeout(() => setStorageStatus(""), 3000);
          setShowProjectPanel(false);
          setExpandedRow(null);
        } catch (err) {
          console.error("Import failed:", err);
          setStorageStatus(t("projectImportFail"));
          setTimeout(() => setStorageStatus(""), 3000);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const buildShareUrl = async (data, name) => {
    const shareParams = data?.params || DEFAULT_PARAMS;
    const shareProducts = Array.isArray(data?.products) ? data.products : [];
    const shareScheduleStore = data?.scheduleStore || {};
    const sharePriceScheduleStore = data?.priceScheduleStore || {};
    const shareRestockStore = data?.restockStore || {};
    const shareWithdrawalStore = data?.withdrawalStore || { amounts: [] };
    const shareProjection = data?.projection || DEFAULT_PROJECTION;
    const shareProjectMeta = data?.projectMeta || {};

    const minParams = {};
    for (const [k, v] of Object.entries(shareParams)) {
      if (v !== DEFAULT_PARAMS[k]) minParams[k] = v;
    }
    const minProducts = shareProducts.map((p) => {
      const mp = {};
      for (const [k, v] of Object.entries(p)) {
        if (v !== 0 && v !== "" && v != null) mp[k] = v;
      }
      return mp;
    });

    const compact = { p: minParams, pr: minProducts, pj: shareProjection };
    if (Object.keys(shareScheduleStore).length) compact.ss = shareScheduleStore;
    if (Object.keys(sharePriceScheduleStore).length) compact.ps = sharePriceScheduleStore;
    if (Object.keys(shareRestockStore).length) compact.rs = shareRestockStore;
    if (shareWithdrawalStore?.amounts?.some(v => v > 0)) compact.ws = shareWithdrawalStore;
    if (shareProjectMeta && Object.keys(shareProjectMeta).length) compact.pm = shareProjectMeta;
    if (name) compact.projectName = name;

    const json = JSON.stringify(compact);
    const plainBase64 = encodeBytesToBase64(textEncoder.encode(json));
    let sharePayload = `plain:${plainBase64}`;

    if (plainBase64.length > 6000 && typeof CompressionStream === "function") {
      const blob = new Blob([json]);
      const cs = new CompressionStream("gzip");
      const compressedBlob = await new Response(blob.stream().pipeThrough(cs)).blob();
      const buf = await compressedBlob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      sharePayload = `gz:${encodeBytesToBase64(bytes)}`;
    }
    return `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(sharePayload)}`;
  };

  const copyStoredProjectShareLink = async (name, data) => {
    try {
      const url = await buildShareUrl(data, name);
      await copyText(url, "shareCopied");
    } catch (e) {
      console.error("Share failed:", e);
      setStorageStatus(t("shareFail"));
      setTimeout(() => setStorageStatus(""), 3000);
    }
  };

  // === 分享链接：压缩精简后的状态到 URL hash ===
  const shareLink = async () => {
    try {
      const url = await buildShareUrl(getCurrentData(), projectName);
      await copyText(url, "shareCopied");
    } catch (e) {
      console.error('Share failed:', e);
      setStorageStatus(t("shareFail"));
      setTimeout(() => setStorageStatus(""), 3000);
    }
  };

  const shareProjectToViewer = async () => {
    if (cloudMode && onCloudShare) {
      setStorageBusy(true);
      try {
        const result = await onCloudShare({
          name: projectName,
          data: buildNamedProjectData(),
        });
        if (result?.name) setProjectName(result.name);
        setStorageStatus(result?.message || "Public link copied");
      } catch (e) {
        console.error("Cloud share failed:", e);
        setStorageStatus(e?.message || "Public link failed");
      } finally {
        setStorageBusy(false);
        setTimeout(() => setStorageStatus(""), 3000);
      }
      return;
    }

    setShowSharePanel(true);
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
    a.operatingNetProfit = a.netProfit;
    a.operatingBookNetProfit = a.bookNetProfit;
    a.operatingCostBasis = a.totalInvestment;
    a.operatingProfitMargin = a.totalGMV > 0 ? a.operatingNetProfit / a.totalGMV : 0;
    a.operatingRoi = a.totalInvestment > 0 ? a.operatingNetProfit / a.totalInvestment : 0;
    a.netProfit -= params.oneTimeCosts;
    a.bookNetProfit -= params.oneTimeCosts;
    a.totalCostBasis = a.totalInvestment + params.oneTimeCosts;
    a.profitMargin = a.totalGMV > 0 ? a.netProfit / a.totalGMV : 0;
    a.roi = a.totalCostBasis > 0 ? a.netProfit / a.totalCostBasis : 0;
    a.netProfitCNY = a.netProfit / params.exchangeRate;
    a.operatingNetProfitCNY = a.operatingNetProfit / params.exchangeRate;
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
    setProducts(ps => [...ps, {
      id: nextId,
      priceCNY: 10,
      declaredCNY: 10,
      qty: 100,
      weight: 0.3,
      volL: 24,
      volW: 18,
      volH: 0.2,
      list: 1000,
      platformFee: 500,
      warehouse: 100,
      mgmt: 30,
      platforms: {
        ozon: { enabled: true, salesShare: 100, model: "FBO", list: 1000, platformFee: 500, warehouse: 100, mgmt: 30, useFeeDetails: true, useTariffLookup: true, ozonProductType: "Раскраска", tariffCategory: "Раскраска" },
        wb: { enabled: false, salesShare: 0, model: "FBW", list: 1000, platformFee: 500, warehouse: 100, mgmt: 30, useFeeDetails: true, useTariffLookup: true, wbSubcategory: "Куртки", tariffCategory: "Куртки", localizationBand: "50.00-54.99", warehouseMultiplier: 1.95, acceptanceRatePct: 40 },
        yandex: { enabled: false, salesShare: 0, model: "FBY", list: 1000, platformFee: 500, warehouse: 100, mgmt: 30, useFeeDetails: true, useTariffLookup: true, yandexCategory: "All goods", tariffCategory: "All goods", paymentFrequency: "monthly", acceptanceRatePct: 69 },
      },
    }]);
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
      setProjectMeta({});
    }
  };

  const updateSchedule = (productId, monthIdx, val) => {
    setScheduleStore(s => {
      const arr = [...(s[productId] || distributeSeasonally(products.find(p => p.id === productId)?.qty || 0, projection.monthsHorizon))];
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
    if (curveType === "reset") {
      const n = projection.monthsHorizon;
      setScheduleStore(Object.fromEntries(products.map(p => [p.id, Array(n).fill(0)])));
      return;
    }
    const next = {};
    for (const p of products) {
      const rSched = getRestockSchedule(p.id, p.qty || 0, projection.monthsHorizon, restockStore);
      const total = rSched.reduce((a, b) => a + (b || 0), 0) || (p.qty || 0);
      const n = projection.monthsHorizon;
      let arr;
      if (curveType === "seasonal") arr = distributeSeasonally(total, n);
      else if (curveType === "linear") arr = distributeEvenly(total, n);
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
    const headers = ["产品ID","销售平台","供应商报价/预估采购价（¥/销售单位）","报关申报价（¥/销售单位）","销售单位数量（件）","加权平台计费价（₽/销售单位）","加权平台综合扣费（₽/销售单位）","加权海外仓费（₽/销售单位）","加权管理费（₽/销售单位）","总投资（₽）","总营收（₽）","进口时付的增值税（进项VAT）（₽）","卖出时产生的增值税（销项VAT）（₽）","税额（₽）","商品经营利润（₽）","税务账面利润（₽）","利润率（净利率）%","回报率（ROI/投入产出）%"];
    const lines = [headers.join(",")];
    calcs.forEach(r => lines.push([
      r.id, `"${(r.c.platformDetails || []).map((item) => `${item.short}${(item.weight * 100).toFixed(0)}%`).join(" / ")}"`,
      r.priceCNY, r.declaredCNY ?? r.priceCNY, r.qty,
      r.c.listPrice.toFixed(0), r.c.platformFee.toFixed(0), r.c.warehouse.toFixed(0), r.c.mgmt.toFixed(0),
      r.c.totalInvestment.toFixed(0), r.c.totalRevenue.toFixed(0),
      r.c.totalInputVAT.toFixed(0), r.c.totalOutputVAT.toFixed(0),
      r.c.tax.toFixed(0), r.c.netProfit.toFixed(0), r.c.bookNetProfit.toFixed(0),
      (r.c.profitMargin * 100).toFixed(1) + "%", (r.c.roi * 100).toFixed(1) + "%",
    ].join(",")));
    lines.push(["合计","","","",totals.qty,"","","","",totals.totalInvestment.toFixed(0),
      totals.totalRevenue.toFixed(0), totals.totalInputVAT.toFixed(0), totals.totalOutputVAT.toFixed(0),
      totals.tax.toFixed(0), totals.netProfit.toFixed(0), totals.bookNetProfit.toFixed(0),
      (totals.profitMargin * 100).toFixed(1) + "%", (totals.roi * 100).toFixed(1) + "%"].join(","));
    lines.push(""); lines.push(["月度现金流"].join(","));
    lines.push(["M0=还没开始卖之前先付出去的钱；M1=第1个月销售；当前SKU利润模型不含头程、清关、保险、尾程、平台仓入仓费，除非你已单独填写。"].join(","));
    lines.push(["月份","销售件数（件）","营收金额₽","销货成本金额₽","其他费用金额₽","税额₽","本月经营利润金额₽","分给合伙人的钱₽","账上累计现金₽"].join(","));
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
    const scheme = t(TAX_SCHEMES[params.taxScheme]?.labelKey) || params.taxScheme;
    const setupCost = params.oneTimeCosts || 0;
    const inventoryInvestment = totals.totalInvestment;
    const projectNetAfterSetup = totals.netProfit;
    const operatingNet = totals.operatingNetProfit || 0;
    const scheduleNet = proj.totalNetProfit || 0;
    const finalCash = proj.finalCash || 0;
    const initialOutflow = proj.initialOutflow || 0;
    const laterCashFlow = proj.months.filter(m => !m.isInitial).reduce((a, b) => a + (b.cashFlow || 0), 0);
    const scheduleGap = scheduleNet - operatingNet;
    const cashGap = finalCash - scheduleNet;
    const totalRestockAfterM0 = proj.months.filter(m => !m.isInitial).reduce((a, b) => a + (b.restockCost || 0), 0);
    const totalFixedCost = proj.months.filter(m => !m.isInitial).reduce((a, b) => a + (b.fixedCost || 0), 0);
    const totalDistributed = proj.months.reduce((a, b) => a + (b.distributed || 0), 0);
    const htmlAbsR = (v) => fR(Math.abs(v));
    const htmlCompare = (v, base) =>
      Math.abs(v) < 0.01
        ? `和${base}基本一致`
        : `比${base}${v >= 0 ? "多了" : "少了"} ${htmlAbsR(v)}`;

    // Product rows
    const prodRows = calcs.map(r => {
      const c = r.c;
      const platformLabel = (c.platformDetails || []).map((item) => `${item.short} ${(item.weight * 100).toFixed(0)}%`).join(" / ");
      return `<tr>
        <td class="mono">${r.id}</td>
        <td class="mono">${platformLabel || "Ozon 100%"}</td>
        <td class="r mono">${(r.priceCNY || 0).toFixed(2)}</td>
        <td class="r mono">${r.qty || 0} ${t("unitPieces")}</td>
        <td class="r mono">${(c.listPrice || 0).toLocaleString("ru-RU")} ₽</td>
        <td class="r mono">${(c.platformFee || 0).toLocaleString("ru-RU")} ₽</td>
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
      const restockLabel = m.restockQty > 0 ? `+${m.restockQty} ${t("unitPieces")}` : "-";
      const restockCostLabel = m.restockCost > 0 && !m.isInitial ? `<br><small style="color:#A4193D">-${fR(m.restockCost)}</small>` : '';
      const stockCls = m.stockWarning ? 'neg' : '';
      return `<tr class="${cls}">
        <td class="mono">${m.isInitial ? t("initialRow") : m.label}</td>
        <td class="r mono" style="color:${m.restockQty > 0 ? '#A4193D' : ''}">${restockLabel}${restockCostLabel}</td>
        <td class="r mono ${stockCls}">${m.stockEnd} ${t("unitPieces")}${m.stockWarning ? " !" : ""}</td>
        <td class="r mono">${m.soldQty ? `${m.soldQty} ${t("unitPieces")}` : "-"}</td>
        <td class="r mono">${m.isInitial ? "-" : fR(m.revenue)}</td>
        <td class="r mono">${m.isInitial ? fR(-proj.initialOutflow) : fR(m.cogs)}</td>
        <td class="r mono">${m.isInitial ? "-" : fR(m.expenses + (m.fixedCost || 0))}</td>
        <td class="r mono">${m.isInitial ? "-" : fR(m.tax)}</td>
        <td class="r mono ${m.netProfit >= 0 ? 'pos' : 'neg'}">${fR(m.netProfit)}</td>
        <td class="r mono" style="color:#B8860B">${m.distributed ? fR(m.distributed) : "-"}</td>
        <td class="r mono">${m.partnerPayout ? fR(m.partnerPayout) : "-"}</td>
        <td class="r mono">${m.ownerPayout ? fR(m.ownerPayout) : "-"}</td>
        <td class="r mono ${m.cumCash >= 0 ? 'pos' : 'neg'}">${fR(m.cumCash)}</td>
        <td class="mono">${m.isInitial ? "-" : (m.vatTierKey ? t(m.vatTierKey, m.vatTierKey === "vatLabelFixedOsn" ? { rate: (m.vatRate*100).toFixed(0) } : {}) : "-")}</td>
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
      { label: "COGS", val: totals.totalInvestment, clr: '#5C1A1B' },
      { label: "Setup", val: setupCost, clr: '#5C544A' },
      { label: "Platform", val: calcs.reduce((s, r) => s + (r.c.platformFee || 0) * (r.qty || 0), 0), clr: '#7A2A2C' },
      { label: "Warehouse", val: calcs.reduce((s, r) => s + (r.c.warehouse || 0) * (r.qty || 0), 0), clr: '#B8860B' },
      { label: "Mgmt", val: calcs.reduce((s, r) => s + (r.c.mgmt || 0) * (r.qty || 0), 0), clr: '#D4A93A' },
      { label: "Tax", val: totals.tax, clr: '#A4193D' },
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
      ? `预计<span class="highlight">第${proj.breakEvenMonth}个月回本</span>`
      : "预测期内未能回本";
    const summaryText = `本批次共 <strong>${calcs.length} 个产品</strong>，总备货 <strong>${totals.qty} 个上架销售单位</strong>。平台计费价/折扣前售价、平台综合扣费、海外仓费和管理费都按同一个上架销售单位填写，例如 6 只装按整套，L12 按整套 12 件，壶杯套装按整套。当前供应商报价与报关申报价为 <strong>测算假设</strong>，不是正式报价；到俄运费与贴标/本地化如果仍为 0，则需要拿到工厂和货代报价后再替换。只看商品经营的算法口径下，预计 ${projection.monthsHorizon} 个月产生营收 <strong>${fR(totals.totalRevenue)}</strong>，商品经营利润（不含启动费） <strong>${fR(totals.operatingNetProfit)}</strong>，经营回报率 <strong>${fP(totals.operatingRoi)}</strong>。再扣除一次性启动费 <strong>${fR(setupCost)}</strong> 后，扣启动费后利润为 <strong>${fR(projectNetAfterSetup)}</strong>。现金流口径包含首批备货与补货支出，${beText}。`;
    const dynamicBasisHtml = `
      <div class="logic-note metric-basis-note">
        <strong>当前数值口径对照：</strong>
        <div class="basis-extra">先记一句：商品利润看“赚不赚”，月度排期看“什么时候赚到”，账上现金看“钱包最后剩多少”。所以红框里的数字本来就不一定相等。</div>
        <div class="basis-grid">
          <div><b>1. 商品利润：这批货本身赚不赚</b><br/>当前结果：<strong>${fR(operatingNet)}</strong><br/>怎么算：把每个商品按当前售价、供应商报价、平台扣费和税算一遍再相加。<br/>注意：它不看几月卖完，也还没扣一次性启动费。</div>
          <div><b>2. 项目利润：扣掉前期费用后还剩多少</b><br/>当前结果：<strong>${fR(projectNetAfterSetup)}</strong><br/>怎么算：第 1 项商品利润 ${fR(operatingNet)} - 启动费 ${fR(setupCost)}。<br/>适合看：这批货把前期费用也扣掉后，项目整体还赚不赚。</div>
          <div><b>3. 月度排期利润：按每个月卖货节奏重算</b><br/>当前结果：<strong>${fR(scheduleNet)}</strong><br/>怎么算：把 M1-M${projection.monthsHorizon} 每个月“本月经营利润”加起来。<br/>为什么会变：它按月份重新算销量、当月售价/扣费和固定月费，所以${htmlCompare(scheduleGap, "第 1 项商品利润")}。</div>
          <div><b>4. 账上现金：最后钱包里还剩多少</b><br/>当前结果：<strong>${fR(finalCash)}</strong><br/>怎么算：M0 先付出去的钱 ${fR(-initialOutflow)} + 后续每月实际现金进出 ${fR(laterCashFlow)}。<br/>为什么会变：这不是利润表，是现金余额；补货、固定支出、分给合伙人的钱都会影响它，所以${htmlCompare(cashGap, "第 3 项月度利润合计")}。</div>
        </div>
        <div class="basis-extra">看表顺序：老板先看第 4 项，运营复盘看第 3 项，供应商报价沟通看第 1 项。第 3 项和第 4 项最容易不同，因为利润表按成本归属算，现金余额按真钱收付时间算。额外参考：后续补货支出 ${fR(totalRestockAfterM0)}，固定支出合计 ${fR(totalFixedCost)}，本月拿出来分的钱 ${fR(totalDistributed)}，分给合伙人的钱 ${fR(proj.totalPartnerPayout || 0)}。</div>
        <div class="basis-extra"><strong>不同人先看什么：</strong>新老板看最后账上还剩现金、回本月份、回报率、最缺钱的时候；供应商看销售单位、供应商报价、报关申报价、装箱/重量待补；运营新人看销售排期、补货排期、平台综合扣费、本月实际现金进出。M0 = 还没开始卖之前先付出去的钱，M1 = 第 1 个月销售。</div>
      </div>`;

    // Glossary tips
    const glossaryItems = [
      { t: '总营收', d: '所有商品卖出后平台打给你的总金额（已扣平台综合扣费）' },
      { t: '商品经营利润', d: '按单品逐个算税后汇总的经营利润，未扣一次性启动费' },
      { t: '最后账上还剩现金', d: '按月累计计算的实际账上余额，已扣除月固定费用、补货支出和分给合伙人的钱/提现' },
      { t: '回报率（ROI/投入产出）', d: '每投入 1 元预计能赚回多少钱，内部公式为利润 ÷ 投资 × 100%' },
      { t: '回本月份', d: '账上累计现金从负变正的月份' },
    ];
    const glossaryHtml = glossaryItems.map(g => `<div class="glossary-item"><strong>${g.t}</strong> - ${g.d}</div>`).join('\n');

    // Build the HTML
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t("htmlReportTitle")} -${date}</title>
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
  .logic-note{background:#F2EDE3;border-left:3px solid #B8860B;padding:14px 18px;margin:18px 0;font-size:12px;color:#1F1B16;line-height:1.7}
  .logic-note strong{color:#5C1A1B}
  .metric-basis-note{border-left-color:#1F4F2E;background:rgba(242,237,227,0.65)}
  .basis-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:10px}
  .basis-grid div{background:white;border:1px solid #D9CFB8;padding:10px 12px}
  .basis-grid b{color:#1F1B16}
  .basis-extra{margin-top:10px;color:#5C544A;font-size:11px}

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
    .basis-grid{grid-template-columns:1fr}
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
  <div class="sub">${t("brandSub")}</div>
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
  ${dynamicBasisHtml}
  <div class="logic-note">
    <strong>计算口径说明：</strong>当前供应商报价/预估采购价和报关申报价为测算假设，且均按“上架销售单位”计算：6 只装、12 件套、壶杯套装都按整套计，不按单只杯子计。若到俄运费留空为 0，则当前结果不包含中国至俄罗斯头程、清关、保险、尾程派送和平台仓入仓费用；贴标/本地化当前也认为 0，不进入利润测算。需待工厂 EXW/FOB 正式报价、装箱尺寸、毛重和货代报价确认后替换。商品经营利润（不含启动费） = 商品销售回款 - 已填写的采购/物流成本 - 海外仓费用 - 管理费 - 破损 - 税；
    扣启动费后利润 = 商品经营利润 - 一次性启动费；
    最后账上还剩现金 = 扣启动费后利润再叠加首批备货、补货节奏、现金回收时间，并扣除分给合伙人的钱/提现后的账上余额。三者口径不同，不能混读。
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
      <div class="label">商品经营利润（未扣启动费）</div>
      <div class="value ${totals.operatingNetProfit >= 0 ? 'pos' : 'neg'}">${fR(totals.operatingNetProfit)}</div>
      <div class="sub">未扣启动费 - ${fC(totals.operatingNetProfitCNY)}</div>
    </div>
    <div class="card">
      <div class="label">扣启动费后利润</div>
      <div class="value ${totals.netProfit >= 0 ? 'pos' : 'neg'}">${fR(totals.netProfit)}</div>
      <div class="sub">已扣启动费 - 回报率 ${fP(totals.roi)}</div>
    </div>
  </div>

  <!-- 投资人关注 -->
  <div class="cards" style="grid-template-columns:repeat(4,1fr)">
    <div class="card">
      <div class="label">一次性启动费</div>
      <div class="value neg">${fR(-setupCost)}</div>
    </div>
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

  <!-- 成本结构 -->
  <div class="section">
    <div class="kicker">成本结构</div>
    <h2>成本结构分析</h2>
  </div>
  ${costBarHtml}

  <!-- 趋势图 -->
  <div class="section page-break">
    <div class="kicker">趋势图</div>
    <h2>现金流和利润趋势</h2>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
    <div class="chart-box">
      <div class="chart-title">${t("cumCashTitle")}</div>
      ${svgChart}
    </div>
    <div class="chart-box">
      <div class="chart-title">本月经营利润</div>
      ${barChart}
    </div>
  </div>

  <!-- TOP / BOTTOM SKU -->
  <div class="section">
    <div class="kicker">SKU RANKING</div>
    <h2>Product Ranking</h2>
  </div>
  <div class="rank-grid">
    <div class="rank-box">
      <h3 style="color:#1F4F2E">TOP ${topN} Best Performers</h3>
      <table>
        <thead><tr><th>#</th><th>SKU</th><th class="r">Profit</th><th class="r">ROI</th></tr></thead>
        <tbody>${topRows}</tbody>
      </table>
    </div>
    <div class="rank-box">
      <h3 style="color:#A4193D">Needs Attention</h3>
      <table>
        <thead><tr><th>#</th><th>SKU</th><th class="r">Profit</th><th class="r">ROI</th></tr></thead>
        <tbody>${bottomRows}</tbody>
      </table>
    </div>
  </div>

  <!-- Full Product Table -->
  <div class="section page-break">
    <div class="kicker">${t("htmlProductDetail")}</div>
    <h2>${t("productsTitle")} - ${calcs.length} SKUs</h2>
  </div>
  <div style="overflow-x:auto">
    <table>
      <thead><tr>
        <th>${t("productId")}</th>
        <th>Sales Platform</th>
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
          <td class="r">-</td>
          <td class="r">-</td>
          <td class="r mono">${totals.qty} ${t("unitPieces")}</td>
          <td class="r">-</td>
          <td class="r">-/td>
          <td class="r mono">${fR(totals.totalInvestment)}</td>
          <td class="r mono">${fR(totals.totalRevenue)}</td>
          <td class="r mono">${fR(totals.tax)}</td>
          <td class="r mono ${totals.operatingNetProfit >= 0 ? 'pos' : 'neg'}">${fR(totals.operatingNetProfit)}</td>
          <td class="r mono">${fP(totals.operatingRoi)}</td>
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
        <th class="r">${t("thSoldQtyD")}</th>
        <th class="r">${t("thRevenue")}</th>
        <th class="r">${t("thCogs")}</th>
        <th class="r">${t("thExpenses")}</th>
        <th class="r">${t("thTax")}</th>
        <th class="r">${t("thNetProfit")}</th>
        <th class="r">${t("thDistributed")}</th>
        <th class="r">${t("thPartner")}</th>
        <th class="r">${t("thOwner")}</th>
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
    <h3>Quick Glossary</h3>
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

    // 现代浏览器：弹出“另存为”对话框
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
    { id: "tariffs", label: t("tabTariffs") },
    { id: "schedule", label: t("tabSchedule") },
    { id: "projection", label: t("tabProjection") },
    { id: "settings", label: t("tabSettings") },
    { id: "help", label: t("tabHelp") },
    { id: "glossary", label: t("tabGlossary") },
  ];
  const cloudProjectOptions = Array.isArray(cloudProjects) ? cloudProjects : [];
  const cloudSelectedProject = cloudProjectOptions.find(item => item.id === currentCloudProjectId) || null;
  const cloudSaveLabel = cloudMode && cloudSelectedProject?.visibility === "public" ? "\u4fdd\u5b58\u5e76\u53d1\u5e03" : "\u4fdd\u5b58";
  const handleProjectNameCommit = (v) => {
    const trimmed = (v || "").trim();
    if (!trimmed || trimmed === projectName) return;
    if (cloudMode) {
      setProjectName(trimmed);
      return;
    }
    renameProject(projectName, trimmed);
  };

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
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-lg sm:text-2xl font-bold">{t("brandTitle")}</h1>
                  <span className="text-[10px] sm:text-xs" style={{ color: COLORS.inkSoft }}>·</span>
                  {readOnly ? (
                    <span
                      className="font-display text-sm sm:text-base font-semibold px-1 py-0.5 max-w-[240px] sm:max-w-[360px] truncate"
                      style={{ color: COLORS.oxblood }}
                      title={projectName}
                    >
                      {projectName}
                    </span>
                  ) : (
                    <DebouncedTextInput
                      value={projectName}
                      onCommit={handleProjectNameCommit}
                      className="font-display text-sm sm:text-base font-semibold bg-transparent border-b border-dashed px-1 py-0.5 max-w-[200px] sm:max-w-[300px]"
                      style={{ color: COLORS.oxblood, borderColor: COLORS.gold + "80" }}
                      title={t("projectCurrentLabel")}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* Live rate indicator */}
              <span className="text-[10px] font-mono hidden sm:inline" style={{ color: rateSource === 'live' ? COLORS.emerald : COLORS.inkSoft }}>
                {rateSource === 'live' ? '●' : '○'} 1¥={effectiveRate.toFixed(2)}₽ · 1$={effectiveUsdRate.toFixed(1)}₽
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
              {readOnly && (
                <span
                  className="px-2.5 py-1.5 text-[11px] font-medium rounded-sm border"
                  style={{ borderColor: COLORS.emerald, color: COLORS.emerald, background: "rgba(31,79,46,0.08)" }}
                >
                  {sourceLabel || "只读查看"}
                </span>
              )}
              {readOnly && (cloudEditHref || editCopyHref) && (
                <a
                  href={cloudEditHref || editCopyHref}
                  className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm"
                  style={{ borderColor: COLORS.oxblood, color: COLORS.oxblood, background: "rgba(92,26,27,0.04)" }}
                  title={cloudEditHref ? "打开后台编辑器" : "打开可编辑副本"}
                >
                  <Edit3 size={14} />
                  <span className="hidden sm:inline">{cloudEditHref ? "在线编辑" : "编辑副本"}</span>
                </a>
              )}
              {cloudMode && !readOnly && (
                <div
                  className="flex items-center gap-1.5 px-2 py-1.5 border rounded-sm"
                  style={{ borderColor: COLORS.gold, color: COLORS.ink }}
                   title="切换后台项目"
                >
                  <FolderOpen size={14} style={{ color: COLORS.gold }} />
                  <select
                    value={currentCloudProjectId || ""}
                    onChange={(event) => onCloudProjectChange?.(event.target.value)}
                    disabled={storageBusy || cloudProjectOptions.length === 0}
                    className="bg-transparent text-xs font-medium max-w-[190px] sm:max-w-[280px]"
                    style={{ color: COLORS.ink }}
                  >
                    {cloudProjectOptions.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name}{item.visibility === "public" ? " - 已公开" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {/* 项目列表 */}
              {!readOnly && !cloudMode && (
                <button onClick={() => setShowProjectPanel(true)}
                  className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm"
                  style={{ borderColor: COLORS.gold, color: COLORS.gold }} title={t("projectList")}>
                  <FolderOpen size={14} /> <span className="hidden sm:inline">{t("projectList")}</span>
                </button>
              )}
              {cloudMode && !readOnly && onCloudOpenLibrary && (
                <button onClick={onCloudOpenLibrary}
                  className="btn-interact hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm"
                    style={{ borderColor: COLORS.inkSoft, color: COLORS.inkSoft }} title="项目库">
                  <FolderOpen size={14} /> <span className="hidden lg:inline">项目库</span>
                </button>
              )}
              {/* 保存 */}
              {!readOnly && (
                <button onClick={saveToCloud} disabled={storageBusy}
                  className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border disabled:opacity-50 rounded-sm"
                  style={{ borderColor: COLORS.oxblood, color: COLORS.oxblood }}>
                  <Save size={14} /> <span className={cloudMode ? "inline" : "hidden sm:inline"}>{storageBusy ? t("saving") : (cloudMode ? cloudSaveLabel : t("projectSave"))}</span>
                </button>
              )}
              {/* 另存为 */}
              {!readOnly && !cloudMode && (
                <button onClick={saveAsProject}
                  className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm"
                  style={{ borderColor: COLORS.inkSoft, color: COLORS.inkSoft }} title={t("projectSaveAs")}>
                  <Copy size={14} /> <span className="hidden lg:inline">{t("projectSaveAs")}</span>
                </button>
              )}
              {/* 导入 JSON */}
              {!readOnly && !cloudMode && (
                <button onClick={importProjectJSON}
                  className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm"
                  style={{ borderColor: COLORS.inkSoft, color: COLORS.inkSoft }} title={t("projectImportJson")}>
                  <Upload size={14} /> <span className="hidden lg:inline">{t("projectImportJson")}</span>
                </button>
              )}
              {/* 导出 JSON */}
              <button onClick={exportProjectJSON}
                className={`btn-interact ${cloudMode ? "hidden sm:flex" : "flex"} items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm`}
                style={{ borderColor: COLORS.inkSoft, color: COLORS.inkSoft }} title={t("projectExportJson")}>
                <FileDown size={14} /> <span className="hidden lg:inline">JSON</span>
              </button>
              {/* 导出 CSV */}
              <button onClick={exportCSV}
                className={`btn-interact ${cloudMode ? "hidden sm:flex" : "flex"} items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-sm`}
                style={{ background: COLORS.oxblood, color: COLORS.cream }}>
                <FileDown size={14} /> <span className="hidden sm:inline">{t("exportCSV")}</span>
              </button>
              {/* 导出 HTML */}
              <button onClick={exportHTML}
                className={`btn-interact ${cloudMode ? "hidden sm:flex" : "flex"} items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-sm`}
                style={{ background: COLORS.emerald, color: COLORS.cream }}>
                <FileDown size={14} /> <span className="hidden sm:inline">{t("exportHTML")}</span>
              </button>
              {/* 给别人看 */}
              {!readOnly && (
                <button onClick={shareProjectToViewer}
                  disabled={storageBusy}
                  className="btn-interact flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm"
                  style={{ borderColor: COLORS.gold, color: COLORS.gold }}>
                  <Send size={14} /> <span className={cloudMode ? "inline" : "hidden sm:inline"}>{cloudMode ? "分享" : t("shareProject")}</span>
                </button>
              )}
              {/* 使用说明 */}
              <a href={guideHref} target="_blank" rel="noopener noreferrer"
                className={`btn-interact ${cloudMode ? "hidden sm:flex" : "flex"} items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium border rounded-sm`}
                style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}>
                <BookOpen size={14} /> <span className="hidden sm:inline">{t("usageGuide")}</span>
              </a>
              {cloudMode && (
                <div className="relative sm:hidden">
                  <button
                    type="button"
                    onClick={() => setShowMobileMore(v => !v)}
                    className="btn-interact flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border rounded-sm"
                    style={{ borderColor: COLORS.inkSoft, color: COLORS.inkSoft }}
                    title="更多"
                  >
                    <MoreHorizontal size={14} />
                    <span>更多</span>
                  </button>
                  {showMobileMore && (
                    <div
                      className="absolute right-0 mt-2 w-44 border rounded-sm shadow-lg overflow-hidden"
                      style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.98)", zIndex: 60 }}
                    >
                      {onCloudOpenLibrary && (
                        <button
                          type="button"
                          onClick={() => { setShowMobileMore(false); onCloudOpenLibrary(); }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left"
                          style={{ color: COLORS.ink }}
                        >
                          <FolderOpen size={14} /> 项目库
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setShowMobileMore(false); exportProjectJSON(); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left"
                        style={{ color: COLORS.ink }}
                      >
                        <FileDown size={14} /> 导出 JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowMobileMore(false); exportCSV(); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left"
                        style={{ color: COLORS.ink }}
                      >
                        <FileDown size={14} /> 导出 CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowMobileMore(false); exportHTML(); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left"
                        style={{ color: COLORS.ink }}
                      >
                        <FileDown size={14} /> 导出报告
                      </button>
                      <a
                        href={guideHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowMobileMore(false)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left"
                        style={{ color: COLORS.ink, textDecoration: "none" }}
                      >
                        <BookOpen size={14} /> 使用说明
                      </a>
                    </div>
                  )}
                </div>
              )}
              {/* 重置 */}
              {!readOnly && !cloudMode && (
                <button onClick={resetSample}
                  className="btn-interact flex items-center gap-1.5 px-2 py-2 text-xs rounded-sm"
                  style={{ color: COLORS.inkSoft }} title={t("resetSample")}>
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>
          {cloudMode && !readOnly && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: COLORS.inkSoft }}>
              <span className="hidden sm:inline-flex px-2 py-1 rounded-sm border" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.5)" }}>
                后台工作台：切换项目、保存到服务器、复制公开链接都在这一排。
              </span>
              {cloudSelectedProject?.visibility === "public" && (
                <span className="px-2 py-1 rounded-sm" style={{ background: "rgba(31,79,46,0.08)", color: COLORS.emerald }}>
                  当前项目已公开，复制公开链接会先保存并发布最新版本。
                </span>
              )}
            </div>
          )}
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
        {tab === "dashboard" && <Dashboard totals={totals} params={params} calcs={calcs} proj={proj} projection={projection} projectMeta={projectMeta} t={t} lang={lang} fmt={fmt} readOnly={readOnly} />}
        {tab === "products" && <ProductsTab calcs={calcs} expandedRow={expandedRow} setExpandedRow={setExpandedRow}
          onUpdate={updateProduct} onDelete={deleteProduct} onAdd={addProduct} onClear={clearAllProducts} params={params} t={t} lang={lang} fmt={fmt} readOnly={readOnly} />}
        {tab === "tariffs" && <TariffTablesPanel />}
        {tab === "schedule" && <ScheduleTab products={products} projection={projection} setProjection={setProjection}
          scheduleStore={scheduleStore} updateSchedule={updateSchedule} applyCurve={applyScheduleCurve}
          priceScheduleStore={priceScheduleStore} setPriceScheduleStore={setPriceScheduleStore}
          restockStore={restockStore} updateRestock={updateRestock} setRestockStore={setRestockStore}
          withdrawalStore={withdrawalStore} setWithdrawalStore={setWithdrawalStore}
          t={t} lang={lang} readOnly={readOnly} />}
        {tab === "projection" && <ProjectionTab proj={proj} projection={projection} setProjection={setProjection}
          params={params} totals={totals} withdrawalStore={withdrawalStore} setWithdrawalStore={setWithdrawalStore} t={t} lang={lang} fmt={fmt} readOnly={readOnly} />}
        {tab === "settings" && <SettingsTab params={params} setParams={setParams} t={t} lang={lang}
          rateSource={rateSource} setRateSource={setRateSource} liveRate={liveRate} effectiveRate={effectiveRate} fetchRate={fetchRate} readOnly={readOnly} />}
        {tab === "help" && <HelpPanel t={t} lang={lang} />}
        {tab === "glossary" && <GlossaryPanel totals={totals} params={params} proj={proj} projection={projection} fmt={fmt} t={t} lang={lang} />}
        </div>
      </main>

      <footer className="border-t mt-8" style={{ borderColor: COLORS.line }}>
        <div className="max-w-[1500px] mx-auto px-6 py-4 text-xs" style={{ color: COLORS.inkSoft }}>
          {t("footerText")}
          <span className="mx-2">·</span>{t("footerDisclaimer")}
        </div>
      </footer>

      {/* ============ 项目管理面板（Modal）============ */}
      {showProjectPanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(31,27,22,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowProjectPanel(false); }}>
          <div className="glass-card anim-in" style={{ width: "90%", maxWidth: 640, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 4 }}>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center gap-2">
                <FolderOpen size={20} style={{ color: COLORS.oxblood }} />
                <span className="font-display text-lg font-bold" style={{ color: COLORS.ink }}>{t("projectList")}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={newProject}
                  className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-sm"
                  style={{ background: COLORS.oxblood, color: COLORS.cream }}>
                  <FilePlus size={14} /> {t("projectNew")}
                </button>
                <button onClick={importProjectJSON}
                  className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-sm"
                  style={{ borderColor: COLORS.gold, color: COLORS.gold }}>
                  <Upload size={14} /> {t("projectImportJson")}
                </button>
                <button onClick={() => setShowProjectPanel(false)}
                  className="btn-interact p-2 rounded-sm" style={{ color: COLORS.inkSoft }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Panel Body -scrollable project list */}
            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
              <section className="mb-5">
                <div className="flex items-start gap-2 mb-2">
                  <Globe size={16} style={{ color: COLORS.emerald, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: COLORS.ink }}>{t("publicProjects")}</div>
                    <div className="text-[11px] leading-5" style={{ color: COLORS.inkSoft }}>{t("publicProjectsHint")}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PUBLIC_PROJECTS.map(item => (
                    <div key={item.file}
                      className="ledger-row rounded-sm border px-3 py-3 flex items-start justify-between gap-3"
                      style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.72)" }}>
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-semibold text-sm truncate" style={{ color: COLORS.ink }}>{item.name}</div>
                        <div className="text-[11px] leading-5 mt-1" style={{ color: COLORS.inkSoft }}>{item.desc}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => copyPublicProjectLink(item.file)}
                          className="btn-interact px-2 py-1.5 text-[11px] rounded-sm"
                          style={{ color: COLORS.gold }} title={t("publicProjectCopyLink")}>
                          <Copy size={13} />
                        </button>
                        <a href={publicProjectHref(item.file)}
                          className="btn-interact px-2.5 py-1.5 text-[11px] font-medium rounded-sm"
                          style={{ background: COLORS.emerald, color: COLORS.cream, textDecoration: "none" }}
                          onClick={() => setShowProjectPanel(false)}>
                          {t("projectOpen")}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-start gap-2 mb-2">
                  <Save size={16} style={{ color: COLORS.gold, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="font-semibold text-sm" style={{ color: COLORS.ink }}>{t("localProjects")}</div>
                    <div className="text-[11px] leading-5" style={{ color: COLORS.inkSoft }}>{t("localProjectsHint")}</div>
                    <div className="text-[11px] leading-5 mt-1" style={{ color: COLORS.inkSoft }}>{t("localProjectsMissingHint")}</div>
                  </div>
                </div>
                {(() => {
                  const index = getProjectIndex();
                  const names = Object.keys(index);
                  if (names.length === 0) {
                    return (
                      <div className="text-center py-8 rounded-sm border" style={{ color: COLORS.inkSoft, borderColor: COLORS.line, background: "rgba(255,255,255,0.45)" }}>
                        <FolderOpen size={32} style={{ opacity: 0.3, margin: "0 auto 10px" }} />
                        <div className="text-sm">{t("noProducts")}</div>
                      </div>
                    );
                  }
                  names.sort((a, b) => (index[b].savedAt || "").localeCompare(index[a].savedAt || ""));
                  return names.map((name) => {
                    const proj = index[name];
                    const isCurrent = name === projectName;
                    const savedDate = proj.savedAt ? new Date(proj.savedAt) : null;
                    const timeStr = savedDate ? savedDate.toLocaleString() : "-";
                    return (
                      <div key={name} className="flex items-center justify-between gap-3 py-3 px-3 rounded-sm mb-2 ledger-row"
                        style={{
                          background: isCurrent ? "rgba(92,26,27,0.06)" : "rgba(255,255,255,0.6)",
                          border: `1px solid ${isCurrent ? COLORS.oxblood + "40" : COLORS.line}`,
                        }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display font-semibold text-sm truncate" style={{ color: isCurrent ? COLORS.oxblood : COLORS.ink }}>
                              {name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-sm font-medium"
                                style={{ background: COLORS.oxblood, color: COLORS.cream }}>
                                {t("projectCurrent")}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] mt-1 font-mono" style={{ color: COLORS.inkSoft }}>
                            {t("projectSkuCount", { n: proj.skuCount || 0 })} · {t("projectLastSaved", { time: timeStr })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!isCurrent && (
                            <button onClick={() => loadProject(name)}
                              className="btn-interact px-2.5 py-1.5 text-[11px] font-medium rounded-sm"
                              style={{ background: COLORS.emerald, color: COLORS.cream }}>
                              {t("projectOpen")}
                            </button>
                          )}
                          <button onClick={() => {
                              const newName = prompt(t("projectRenamePrompt"), name);
                              if (newName) renameProject(name, newName);
                            }}
                            className="btn-interact px-2 py-1.5 text-[11px] rounded-sm"
                            style={{ color: COLORS.inkSoft }} title={t("projectRename")}>
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => {
                              const data = { projectName: name, ...proj.data };
                              const json = JSON.stringify(data, null, 2);
                              const safeName = (name || "project").replace(/[<>:"/\\|?*]/g, "_");
                              const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(json);
                              const a = document.createElement("a");
                              a.href = dataUri; a.download = `${safeName}.json`; a.style.display = "none";
                              document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            }}
                            className="btn-interact px-2 py-1.5 text-[11px] rounded-sm"
                            style={{ color: COLORS.gold }} title={t("projectExportJson")}>
                            <FileDown size={13} />
                          </button>
                          <button onClick={() => copyStoredProjectShareLink(name, proj.data)}
                            className="btn-interact px-2 py-1.5 text-[11px] rounded-sm"
                            style={{ color: COLORS.emerald }} title={t("shareStoredProject")}>
                            <Share2 size={13} />
                          </button>
                          <button onClick={() => deleteProject(name)}
                            className="btn-interact px-2 py-1.5 text-[11px] rounded-sm"
                            style={{ color: COLORS.crimson }} title={t("projectDelete")}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </section>
            </div>
          </div>
        </div>
      )}

      {showSharePanel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(31,27,22,0.5)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSharePanel(false); }}>
          <div className="glass-card anim-in" style={{ width: "90%", maxWidth: 720, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", borderRadius: 4 }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: COLORS.line }}>
              <div className="flex items-center gap-2">
                <Send size={20} style={{ color: COLORS.gold }} />
                <div>
                  <div className="font-display text-lg font-bold" style={{ color: COLORS.ink }}>{t("sharePanelTitle")}</div>
                  <div className="text-[11px] leading-5" style={{ color: COLORS.inkSoft }}>{t("sharePanelHint")}</div>
                </div>
              </div>
              <button onClick={() => setShowSharePanel(false)}
                className="btn-interact p-2 rounded-sm" style={{ color: COLORS.inkSoft }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px" }}>
              <section className="mb-4 rounded-sm border p-4" style={{ borderColor: COLORS.gold + "55", background: "rgba(184,134,11,0.06)" }}>
                <div className="flex items-start gap-3">
                  <LinkIcon size={18} style={{ color: COLORS.gold, flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm" style={{ color: COLORS.ink }}>{t("sharePanelCurrentTitle")}</div>
                    <div className="text-[11px] leading-5 mt-1" style={{ color: COLORS.inkSoft }}>{t("sharePanelCurrentDesc")}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={shareLink}
                        className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-sm"
                        style={{ background: COLORS.gold, color: COLORS.cream }}>
                        <LinkIcon size={14} /> {t("shareCurrentVersion")}
                      </button>
                      <button onClick={exportProjectJSON}
                        className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-sm"
                        style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}>
                        <FileDown size={14} /> {t("sharePanelExportJson")}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-4 rounded-sm border p-4" style={{ borderColor: COLORS.emerald + "55", background: "rgba(31,79,46,0.05)" }}>
                <div className="flex items-start gap-3">
                  <Globe size={18} style={{ color: COLORS.emerald, flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm" style={{ color: COLORS.ink }}>{t("sharePanelPublicTitle")}</div>
                    <div className="text-[11px] leading-5 mt-1" style={{ color: COLORS.inkSoft }}>{t("sharePanelPublicDesc")}</div>
                    {currentPublicProject ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="text-xs font-medium" style={{ color: COLORS.emeraldSoft }}>{currentPublicProject.name}</div>
                        <button onClick={() => copyPublicProjectLink(currentPublicProject.file)}
                          className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-sm"
                          style={{ background: COLORS.emerald, color: COLORS.cream }}>
                          <Copy size={14} /> {t("publicProjectCopyLink")}
                        </button>
                        <a href={publicProjectHref(currentPublicProject.file)}
                          className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-sm"
                          style={{ borderColor: COLORS.emerald, color: COLORS.emerald, textDecoration: "none" }}
                          onClick={() => setShowSharePanel(false)}>
                          <Globe size={14} /> {t("projectOpen")}
                        </a>
                      </div>
                    ) : (
                      <div className="mt-3 text-[11px] leading-5" style={{ color: COLORS.inkSoft }}>
                        {t("sharePanelPublishDesc")}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-sm border p-4" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.55)" }}>
                <div className="flex items-start gap-3">
                  <Info size={18} style={{ color: COLORS.oxblood, flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm" style={{ color: COLORS.ink }}>{t("sharePanelPublishTitle")}</div>
                    <div className="text-[11px] leading-5 mt-1" style={{ color: COLORS.inkSoft }}>{t("sharePanelPublishDesc")}</div>
                    <div className="text-[11px] leading-5 mt-2" style={{ color: COLORS.inkSoft }}>{t("sharePanelMissingHint")}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => {
                          setShowSharePanel(false);
                          setShowProjectPanel(true);
                        }}
                        className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-sm"
                        style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}>
                        <FolderOpen size={14} /> {t("sharePanelOpenProjects")}
                      </button>
                      <a href={guideHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-interact flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-sm"
                        style={{ borderColor: COLORS.line, color: COLORS.inkSoft, textDecoration: "none" }}>
                        <BookOpen size={14} /> {t("sharePanelOpenGuide")}
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 仪表盘
// ============================================================
const Dashboard = ({ totals, params, calcs, proj, projection, projectMeta = {}, t, lang, fmt, readOnly = false }) => {
  const [audienceView, setAudienceView] = useState("boss");
  const [showOpsDetail, setShowOpsDetail] = useState(false);
  const showBookDiff = params.taxScheme === "osn" && Math.abs(totals.netProfit - totals.bookNetProfit) > 1;
  const F = fmt.fmtPrimary, Fs = fmt.fmtSecondary;
  const peakMonth = proj.months
    .filter(m => !m.isInitial)
    .reduce((best, m) => (m.revenue || 0) > (best.revenue || 0) ? m : best, { month: 0, revenue: 0 });
  const operatingInput = Number(projectMeta.operatingInputRUB || 0);
  const metaMonthlyFixedCost = Number(projectMeta.monthlyFixedCostRUB || projection.monthlyFixedCost || 0);
  const sharePct = Number(projectMeta.sharePct || projection.partnerSharePct || 0);
  const projectedShare = proj.totalPartnerPayout || (proj.totalNetProfit * (sharePct / 100));
  const inputGap = operatingInput > 0 ? projectedShare - operatingInput : 0;
  const paybackPct = operatingInput > 0 ? projectedShare / operatingInput : 0;
  return (
    <div className="space-y-6">
      <DecisionSummaryPanel
        totals={totals}
        params={params}
        calcs={calcs}
        proj={proj}
        projection={projection}
        fmt={fmt}
        readOnly={readOnly}
      />

      <AudienceViewPanel
        activeView={audienceView}
        setActiveView={setAudienceView}
        totals={totals}
        params={params}
        calcs={calcs}
        proj={proj}
        projection={projection}
        fmt={fmt}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 glass-card card-hover rounded-sm">
          <Metric label={t("totalInvestment")} value={F(totals.totalCostBasis)} sub={Fs(totals.totalCostBasis)} big />
        </div>
        <div className="p-4 sm:p-5 glass-card card-hover rounded-sm">
          <Metric label={t("totalRevenue")} value={F(totals.totalRevenue)} sub={fmtRubShort(totals.totalRevenue)} big />
        </div>
        <div className="p-4 sm:p-5 card-hover rounded-sm border-2" style={{ borderColor: totals.operatingNetProfit >= 0 ? COLORS.emerald : COLORS.crimson, background: "rgba(255,255,255,0.7)" }}>
          <Metric
            label="商品经营利润（未扣启动费）"
            value={F(totals.operatingNetProfit)}
            sub={`未扣启动费 · 回报率 ${fmtPct(totals.operatingRoi)}`}
            color={totals.operatingNetProfit >= 0 ? COLORS.emerald : COLORS.crimson}
            big
          />
        </div>
        <div className="p-4 sm:p-5 glass-card card-hover rounded-sm">
          <Metric
            label="扣启动费后利润"
            value={F(totals.netProfit)}
            sub={`已扣启动费 · 回报率 ${fmtPct(totals.roi)}`}
            color={totals.netProfit >= 0 ? COLORS.emerald : COLORS.gold}
            big
          />
        </div>
      </div>

      <MetricBasisNote totals={totals} params={params} proj={proj} projection={projection} fmt={fmt} />

      {operatingInput > 0 && (
        <Card kicker="合作决策" title="合作运营回本">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-4 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
              <Metric label="合作运营投入" value={F(operatingInput)} sub={Fs(operatingInput)} color={COLORS.oxblood} />
            </div>
            <div className="p-4 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
              <Metric label={`${projection.monthsHorizon} 个月预计分成利润`} value={F(projectedShare)} sub={`${sharePct}% 分润`} color={COLORS.gold} />
            </div>
            <div className="p-4 border rounded-sm" style={{ borderColor: inputGap >= 0 ? COLORS.emerald : COLORS.crimson, background: "white" }}>
              <Metric label="距回本差额" value={F(inputGap)} sub={`回本进度 ${fmtPct(paybackPct)}`} color={inputGap >= 0 ? COLORS.emerald : COLORS.crimson} />
            </div>
            <div className="p-4 border rounded-sm" style={{ borderColor: COLORS.line, background: "rgba(31,79,46,0.06)" }}>
              <Metric label="建议结构" value="服务费 + 流量成本共担" sub="商品经营利润为正，运营投入建议单独合同约定" color={COLORS.emerald} />
            </div>
          </div>
          <div className="mt-3 text-xs leading-6" style={{ color: COLORS.inkSoft }}>
            {projectMeta.basis || "商品经营视角会把运营投入和扣启动费后利润分开看。"} {projectMeta.recommendation || ""}
          </div>
        </Card>
      )}

      {operatingInput <= 0 && metaMonthlyFixedCost > 0 && (
        <Card kicker="固定月费口径" title="店铺月租口径">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
              <Metric label="每月店铺月租" value={F(metaMonthlyFixedCost)} sub={Fs(metaMonthlyFixedCost)} color={COLORS.oxblood} />
            </div>
            <div className="p-4 border rounded-sm" style={{ borderColor: COLORS.line, background: "white" }}>
              <Metric label={`${projection.monthsHorizon} 个月店铺月租`} value={F(metaMonthlyFixedCost * projection.monthsHorizon)} sub="单店 3000 元/月" color={COLORS.gold} />
            </div>
            <div className="p-4 border rounded-sm" style={{ borderColor: COLORS.line, background: "rgba(31,79,46,0.06)" }}>
              <Metric label="广告费口径" value="已在平台扣费里预留" sub="不再作为启动投入重复扣除" color={COLORS.emerald} />
            </div>
          </div>
          <div className="mt-3 text-xs leading-6" style={{ color: COLORS.inkSoft }}>
            {projectMeta.basis || "当前没有设置大额一次性启动费，店铺月租进入月度现金流预测。"} {projectMeta.recommendation || ""}
          </div>
        </Card>
      )}

      <section className="border rounded-sm overflow-hidden" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.72)" }}>
        <button
          type="button"
          onClick={() => setShowOpsDetail(v => !v)}
          className="w-full flex items-center justify-between gap-4 px-4 sm:px-5 py-4 text-left"
          style={{ color: COLORS.ink }}
        >
          <div>
            <div className="text-[10px] uppercase" style={{ color: COLORS.emerald, letterSpacing: 0 }}>经营明细</div>
            <div className="font-display text-lg sm:text-xl font-bold">完整经营明细</div>
            <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>这里查看现金流图、月度利润、成本结构、税务结构和商品盈利排行。</div>
          </div>
          {showOpsDetail ? <ChevronDown size={18} style={{ color: COLORS.gold }} /> : <ChevronRight size={18} style={{ color: COLORS.gold }} />}
        </button>
        {showOpsDetail && (
          <div className="px-4 sm:px-5 pb-5 space-y-6">
            <AudienceQuickGuide />

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
                  <Metric label={t("peakMonthly")} value={F(peakMonth.revenue)}
                    sub={`${peakMonth.label || `${t("monthLabel")}${peakMonth.monthIdx || 0}`} · ${Fs(peakMonth.revenue)}`} color={COLORS.gold} />
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
              <Card kicker={`税制 · ${t(TAX_SCHEMES[params.taxScheme].labelKey)}`} title={t("taxStructure")}>
                <TaxBreakdown totals={totals} params={params} t={t} fmt={fmt} />
              </Card>
            </div>

            <Card kicker={t("rankingKicker")} title={t("rankingTitle")}>
              <ProductRanking calcs={calcs} t={t} fmt={fmt} />
            </Card>
          </div>
        )}
      </section>
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
  const BreakEvenLabel = ({ viewBox }) => {
    if (!viewBox) return null;
    const x = Number(viewBox.x || 0);
    const y = Number(viewBox.y || 0);
    return (
      <text
        x={x}
        y={y + 18}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={COLORS.emerald}
        fontSize={11}
        fontFamily="Geist, system-ui, sans-serif"
      >
        {_t("chartBreakEven")}
      </text>
    );
  };
  return (
    <div style={{ width: "100%", minWidth: 0, height: 280 }}>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 30, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid stroke={COLORS.line} strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke={COLORS.inkSoft} fontSize={11} />
          <YAxis stroke={COLORS.inkSoft} fontSize={11} tickFormatter={(v) => _F(v)} />
          <Tooltip content={<TooltipContent fmt={fmt} />} />
          <ReferenceLine y={0} stroke={COLORS.ink} strokeWidth={1} />
          {proj.breakEvenMonth && (
            <ReferenceLine x={`M${proj.breakEvenMonth}`} stroke={COLORS.emerald} strokeDasharray="5 3"
              label={<BreakEvenLabel />} />
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
    <div style={{ width: "100%", minWidth: 0, height: 240 }}>
      <ResponsiveContainer width="100%" height={240}>
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
  const platformFeeTotal = totals.totalGMV - totals.totalRevenue;
  const items = [
    { label: t("costProcure"), value: totals.totalInvestment, color: COLORS.oxblood },
    { label: t("costPlatformFee"), value: platformFeeTotal, color: "#8B5E3C" },
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
  if (totals.vatPart > 0) rows.push({ label: t("taxVatPartLabel"), value: totals.vatPart });
  if (totals.usnPart > 0) rows.push({ label: t("taxUsnPartLabel"), value: totals.usnPart });
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
const ProductsTab = ({ calcs, expandedRow, setExpandedRow, onUpdate, onDelete, onAdd, onClear, params, t, lang, fmt, readOnly = false }) => (
  <div className="space-y-4 anim-in">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 className="font-display text-2xl font-semibold">{t("productsTitle")} · {t("productCount", { n: calcs.length })}</h2>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>
          {t("productsHint")}
        </p>
      </div>
      {!readOnly && (
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
      )}
    </div>
    <ProductTable calcs={calcs} expandedRow={expandedRow} setExpandedRow={setExpandedRow}
      onUpdate={onUpdate} onDelete={onDelete} params={params} t={t} fmt={fmt} lang={lang} readOnly={readOnly} />
  </div>
);

const PlatformChips = ({ details = [] }) => (
  <div className="flex flex-wrap gap-1 mt-1">
    {(details || []).map((detail) => (
      <span
        key={detail.platformId}
        className="px-1.5 py-0.5 text-[10px] rounded-sm border"
        style={{ borderColor: COLORS.line, color: COLORS.inkSoft, background: COLORS.paper }}
      >
        {detail.short}{detail.weight ? ` ${(detail.weight * 100).toFixed(0)}%` : ""}
      </span>
    ))}
  </div>
);

const ProductTable = ({ calcs, expandedRow, setExpandedRow, onUpdate, onDelete, params, t, fmt, lang, readOnly = false }) => {
  const F = fmt.fmtPrimary;
  const showDeclared = params.taxScheme === "osn";
  return (
    <>
    <div className="md:hidden space-y-3">
      {calcs.map((r, idx) => {
        const isOpen = expandedRow === idx;
        const profitable = r.c.netProfit > 0;
        const declaredDiffers = (r.declaredCNY ?? r.priceCNY) !== r.priceCNY;
        return (
          <div key={idx} className="border bg-white" style={{ borderColor: COLORS.line }}>
            <button
              type="button"
              onClick={() => setExpandedRow(isOpen ? null : idx)}
              className="w-full p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <div className="font-mono text-xs font-semibold break-all" style={{ color: COLORS.ink }}>{r.id}</div>
                  </div>
                  <PlatformChips details={r.c.platformDetails} />
                </div>
                <div className="text-right font-mono text-sm font-semibold" style={{ color: profitable ? COLORS.emerald : COLORS.crimson }}>
                  {fmtPct(r.c.roi)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <MiniMetric label={t("costCny")} value={fmtCny(r.priceCNY)} />
                {showDeclared && <MiniMetric label="Declared value" value={fmtCny(r.declaredCNY ?? r.priceCNY)} color={declaredDiffers ? COLORS.oxblood : COLORS.ink} />}
                <MiniMetric label={t("qty")} value={`${r.qty} ${t("unitPieces")}`} />
                <MiniMetric label={t("listPrice")} value={`${(r.c.listPrice || 0).toLocaleString("ru-RU")} RUB`} />
                <MiniMetric label={t("platformFee")} value={`${(r.c.platformFee || 0).toLocaleString("ru-RU")} RUB`} />
                <MiniMetric label={t("netProfitCol")} value={F(r.c.netProfit)} color={profitable ? COLORS.emerald : COLORS.crimson} />
              </div>
            </button>
            {isOpen && (
              <div className="border-t p-3" style={{ borderColor: COLORS.line, background: "rgba(184,134,11,0.04)" }}>
                <ProductEditor product={r} idx={idx} onUpdate={onUpdate} calc={r.c} params={params} t={t} fmt={fmt} lang={lang} readOnly={readOnly} />
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => { if (confirm(t("confirmDeleteProd", { id: r.id }))) onDelete(idx); }}
                    className="mt-3 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border"
                    style={{ borderColor: COLORS.crimson, color: COLORS.crimson, background: "rgba(164,25,61,0.05)" }}
                  >
                    <Trash2 size={11} /> {t("deleteBtn")}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
      {calcs.length > 0 && (
        <div className="border bg-white p-3 grid grid-cols-2 gap-2 text-xs font-semibold" style={{ borderColor: COLORS.line }}>
          <MiniMetric label={t("totalRow")} value={`${calcs.reduce((a, b) => a + (b.qty || 0), 0)} ${t("unitPieces")}`} />
          <MiniMetric label={t("investment")} value={F(calcs.reduce((a, b) => a + b.c.totalInvestment, 0))} />
          <MiniMetric label={t("revenue")} value={F(calcs.reduce((a, b) => a + b.c.totalRevenue, 0))} />
          <MiniMetric label={t("netProfitCol")} value={F(calcs.reduce((a, b) => a + b.c.netProfit, 0))} color={COLORS.emerald} />
        </div>
      )}
    </div>

    <div className="hidden md:block border overflow-x-auto" style={{ borderColor: COLORS.line, background: "white" }}>
      <table className="w-full text-sm" style={{ minWidth: showDeclared ? "1280px" : "1200px" }}>
        <thead style={{ background: COLORS.paper }}>
          <tr className="text-[11px] tracking-wider uppercase" style={{ color: COLORS.inkSoft }}>
            <th className="text-left p-2 font-medium w-8"></th>
            <th className="text-left p-2 font-medium">{t("productId")}</th>
            <th className="text-right p-2 font-medium">{t("costCny")}</th>
            {showDeclared && <th className="text-right p-2 font-medium" style={{ color: COLORS.oxblood }}>报关申报价（¥/销售单位）</th>}
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
            {!readOnly && <th className="text-center p-2 font-medium" style={{ width: "70px" }}>{t("action")}</th>}
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
                  <td className="p-2 font-mono text-xs">
                    <div>{r.id}</div>
                    <PlatformChips details={r.c.platformDetails} />
                  </td>
                  <td className="p-2 text-right font-mono text-xs">{fmtCny(r.priceCNY)}</td>
                  {showDeclared && (
                    <td className="p-2 text-right font-mono text-xs" style={{ color: declaredDiffers ? COLORS.oxblood : COLORS.inkSoft }}>
                      {fmtCny(r.declaredCNY ?? r.priceCNY)}
                    </td>
                  )}
                  <td className="p-2 text-right font-mono text-xs">{r.qty} {t("unitPieces")}</td>
                  <td className="p-2 text-right font-mono text-xs">{(r.c.listPrice || 0).toLocaleString("ru-RU")} RUB</td>
                  <td className="p-2 text-right font-mono text-xs">{(r.c.platformFee || 0).toLocaleString("ru-RU")} RUB</td>
                  <td className="p-2 text-right font-mono text-xs">{(r.c.warehouse || 0).toLocaleString("ru-RU")} RUB</td>
                  <td className="p-2 text-right font-mono text-xs">{(r.c.mgmt || 0).toLocaleString("ru-RU")} RUB</td>
                  <td className="p-2 text-right font-mono text-xs border-l" style={{ borderColor: COLORS.line }}>{F(r.c.totalInvestment)}</td>
                  <td className="p-2 text-right font-mono text-xs">{F(r.c.totalRevenue)}</td>
                  <td className="p-2 text-right font-mono text-xs" style={{ color: COLORS.crimson }}>{F(r.c.tax)}</td>
                  <td className="p-2 text-right font-mono text-xs font-semibold" style={{ color: profitable ? COLORS.emerald : COLORS.crimson }}>{F(r.c.netProfit)}</td>
                  <td className="p-2 text-right font-mono text-xs font-semibold" style={{ color: r.c.roi > 0.3 ? COLORS.emerald : r.c.roi > 0.1 ? COLORS.gold : COLORS.crimson }}>{fmtPct(r.c.roi)}</td>
                  {!readOnly && (
                    <td className="p-2 text-center">
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(t("confirmDeleteProd", { id: r.id }))) onDelete(idx); }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium border"
                        style={{ borderColor: COLORS.crimson, color: COLORS.crimson, background: "rgba(164,25,61,0.05)" }}>
                        <Trash2 size={11} /> {t("deleteBtn")}
                      </button>
                    </td>
                  )}
                </tr>
                {isOpen && (
                  <tr style={{ background: "rgba(184,134,11,0.04)" }}>
                    <td colSpan={(showDeclared ? 14 : 13) + (readOnly ? 0 : 1)} className="p-4">
                      <ProductEditor product={r} idx={idx} onUpdate={onUpdate} calc={r.c} params={params} t={t} fmt={fmt} lang={lang} readOnly={readOnly} />
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
              <td className="p-2 text-right font-mono text-xs">{calcs.reduce((a, b) => a + (b.qty || 0), 0)} {t("unitPieces")}</td>
              <td colSpan={4}></td>
              <td className="p-2 text-right font-mono text-xs border-l" style={{ borderColor: COLORS.line }}>
                {F(calcs.reduce((a, b) => a + b.c.totalInvestment, 0))}
              </td>
              <td className="p-2 text-right font-mono text-xs">{F(calcs.reduce((a, b) => a + b.c.totalRevenue, 0))}</td>
              <td className="p-2 text-right font-mono text-xs" style={{ color: COLORS.crimson }}>{F(calcs.reduce((a, b) => a + b.c.tax, 0))}</td>
              <td className="p-2 text-right font-mono text-xs" style={{ color: COLORS.emerald }}>{F(calcs.reduce((a, b) => a + b.c.netProfit, 0))}</td>
              <td colSpan={readOnly ? 1 : 2}></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
    </>
  );
};

const PlatformSettingsPanel = ({ product, idx, onUpdate, calc, params, fmt, readOnly = false }) => {
  const [openDetails, setOpenDetails] = useState({});
  const [openAdvanced, setOpenAdvanced] = useState({});
  const productVolumeLiters = ((Number(product.volL) || 0) * (Number(product.volW) || 0) * (Number(product.volH) || 0)) / 1000;
  const hasProductDimensions = productVolumeLiters > 0;
  const platformConfigs = getProductPlatformConfigs(product);
  const platformRows = SALES_PLATFORMS.map((platform) => {
    const config = calcPlatformUnitEconomics(platformConfigs[platform.id]);
    const activeDetail = (calc.platformDetails || []).find((detail) => detail.platformId === platform.id);
    const effectiveQty = (product.qty || 0) * (1 - params.damageRate);
    const taxPerUnit = calc.effectiveQty > 0 ? calc.tax / calc.effectiveQty : 0;
    const unitNet = config.unitPayout - calc.unitCost - (config.warehouse || 0) - (config.mgmt || 0) - taxPerUnit;
    const totalNet = unitNet * effectiveQty * (activeDetail?.weight ?? 0);
    return {
      platform,
      config,
      activeDetail,
      effectiveQty,
      unitNet,
      totalNet,
      roi: calc.unitCost > 0 ? unitNet / calc.unitCost : 0,
    };
  });

  const updatePlatformFields = (platformId, patch) => {
    const configs = getProductPlatformConfigs(product);
    const next = {
      ...(product.platforms || {}),
      [platformId]: {
        ...configs[platformId],
        ...patch,
      },
    };
    onUpdate(idx, "platforms", next);

    if (platformId === "ozon") {
      ["list", "platformFee", "warehouse", "mgmt"].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(patch, field)) onUpdate(idx, field, patch[field]);
      });
    }
  };

  const updatePlatform = (platformId, field, value) => updatePlatformFields(platformId, { [field]: value });

  const togglePlatform = (platformId, enabled) => {
    updatePlatformFields(platformId, {
      enabled,
      salesShare: enabled && !platformConfigs[platformId]?.salesShare ? (platformId === "ozon" ? 100 : 10) : platformConfigs[platformId]?.salesShare,
    });
  };

  const rub = (value, digits = 0) => fmtRub(value, digits);
  const pct = (value, digits = 2) => `${(((value || 0) * 100)).toFixed(digits)}%`;
  const feeSourceText = (config) => {
    if (!config.useFeeDetails) return "手动填写平台扣费";
    if (config.feeSource === "tariff") return "按平台费率表计算";
    if (config.feeSource === "manualRateDetails") return "按手动费率明细计算";
    if (config.feeSource === "manualFallback") return "缺少参数，暂用手动平台扣费";
    return "手动填写平台扣费";
  };
  const feeSourceColor = (config) => (config.feeSource === "tariff" ? COLORS.emerald : (config.feeSource === "manualRateDetails" ? COLORS.gold : COLORS.crimson));
  const primaryFeeFields = [
    ["acceptanceRatePct", "入库/承接率调整", "%pt"],
    ["adRate", "广告促销预留比例", "%"],
  ];
  const advancedFeeFields = {
    ozon: [
      ["commissionRate", "佣金兜底比例", "%"],
      ["paymentRate", "支付手续费比例", "%"],
      ["baseFreight", "基础物流费", "RUB"],
      ["nonLocalRate", "跨区销售费率", "%"],
      ["fbsParcelHandling", "FBS 包裹处理费", "RUB"],
      ["returnHandling", "退货处理费", "RUB"],
      ["otherFee", "其他费用", "RUB"],
    ],
    wb: [
      ["commissionRate", "佣金兜底比例", "%"],
      ["paymentRate", "支付手续费比例", "%"],
      ["baseRate", "基础物流费", "RUB"],
      ["overLiterRate", "超过 1L 每升费率", "RUB"],
      ["warehouseMultiplier", "FBW 仓库系数", "x"],
      ["fwbStoragePerLiterDay", "FBW 每升每天仓储费", "RUB"],
      ["penaltyRate", "WB 罚款预留比例", "%"],
      ["otherFee", "其他费用", "RUB"],
    ],
    yandex: [
      ["commissionRate", "佣金兜底比例", "%"],
      ["acquiringFee", "收单费", "RUB"],
      ["paymentTransferRate", "回款转账费率", "%"],
      ["orderProcessing", "FBS 订单处理费", "RUB"],
      ["returnHandling", "退货处理费", "RUB"],
      ["returnDelivery", "退货配送费", "RUB"],
      ["fbyStorage", "FBY 仓储费", "RUB"],
      ["otherFee", "其他费用", "RUB"],
    ],
  };
  const formatFieldValue = (field, suffix, config) => {
    if (suffix === "%") return (config[field] || 0) * 100;
    return config[field] ?? 0;
  };
  const parseFieldValue = (value, suffix) => (suffix === "%" ? value / 100 : value);
  const inputSuffix = (suffix) => (suffix === "%pt" ? "%" : suffix);
  const categoryOptionsFor = (platformId) => {
    if (platformId === "ozon") return TARIFF_META.ozonCommissionCategories || [];
    if (platformId === "wb") return TARIFF_META.wbCommissionCategories || [];
    return TARIFF_META.yandexCommissionCategories || [];
  };
  const categoryInput = (platform, value, onCommit, placeholder = "") => {
    const options = categoryOptionsFor(platform.id);
    const listId = `platform-category-${idx}-${platform.id}`;
    return (
      <>
        <DebouncedTextInput
          value={value || ""}
          onCommit={onCommit}
          placeholder={placeholder}
          list={listId}
          className="w-full px-2 py-2 bg-white border text-[11px]"
          style={{ borderColor: COLORS.line, color: COLORS.ink }}
          readOnly={readOnly}
        />
        <datalist id={listId}>
          {options.map((option, optionIndex) => (
            <option key={`${platform.id}-${optionIndex}-${option}`} value={option} />
          ))}
        </datalist>
        <div className="mt-1 text-[10px] leading-4" style={{ color: COLORS.inkSoft }}>
          可直接输入关键词；下拉建议来自平台费率品类表（{options.length.toLocaleString("zh-CN")} 个选项）。
        </div>
      </>
    );
  };
  const selectInput = (value, onChange, options) => (
    <select
      value={value || ""}
      disabled={readOnly}
      onChange={(event) => onChange(event.target.value)}
      className="w-full px-2 py-2 border bg-white text-[11px]"
      style={{ borderColor: COLORS.line, color: COLORS.ink }}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
  const tariffFields = (platform, config) => {
    if (platform.id === "ozon") {
      return (
        <>
          <div className="col-span-2">
            <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>Ozon 佣金品类</div>
            {categoryInput(platform, config.ozonProductType, (value) => updatePlatformFields(platform.id, { ozonProductType: value, tariffCategory: value }), "例如：mask")}
          </div>
          <div>
            <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>发货集群</div>
            {selectInput(config.supplyCluster, (value) => updatePlatform(platform.id, "supplyCluster", value), TARIFF_META.ozonClusters)}
          </div>
          <div>
            <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>配送集群</div>
            {selectInput(config.deliveryCluster, (value) => updatePlatform(platform.id, "deliveryCluster", value), TARIFF_META.ozonClusters)}
          </div>
        </>
      );
    }
    if (platform.id === "wb") {
      return (
        <>
          <div className="col-span-2">
            <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>WB 佣金子品类</div>
            {categoryInput(platform, config.wbSubcategory, (value) => updatePlatformFields(platform.id, { wbSubcategory: value, tariffCategory: value }), "例如：brush")}
          </div>
          <div className="col-span-2">
            <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>本地化指数档位</div>
            {selectInput(config.localizationBand, (value) => updatePlatform(platform.id, "localizationBand", value), TARIFF_META.wbLocalizationBands)}
          </div>
        </>
      );
    }
    return (
      <>
        <div className="col-span-2">
          <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>Yandex 品类路径</div>
          {categoryInput(platform, config.yandexCategory, (value) => updatePlatformFields(platform.id, { yandexCategory: value, tariffCategory: value }), "例如：household goods")}
        </div>
        <div className="col-span-2">
          <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>回款频率</div>
          {selectInput(config.paymentFrequency, (value) => updatePlatform(platform.id, "paymentFrequency", value), TARIFF_META.yandexPaymentFrequencies)}
        </div>
      </>
    );
  };
  return (
    <div className="lg:col-span-4 border p-3 space-y-3" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.68)" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.gold }}>销售平台</div>
          <div className="text-[11px] leading-5 mt-1" style={{ color: COLORS.inkSoft }}>
            按客户方案启用 Ozon、WB 或 Yandex。利润会按已启用平台的销售占比加权；展开平台可调整费率明细。
          </div>
        </div>
        <Tag color={COLORS.emerald}>当前 {calc.platformDetails?.map((item) => item.short).join(" / ") || "Ozon"}</Tag>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
        {platformRows.map(({ platform, config, unitNet, totalNet, roi }) => {
          const isOpen = !!openDetails[platform.id];
          const enabled = !!config.enabled;
          const effectiveShare = enabled ? ((calc.platformDetails || []).find((detail) => detail.platformId === platform.id)?.weight || 0) : 0;
          const missingInputs = config.detailBreakdown?.missingInputs || [];
          const isAdvancedOpen = !!openAdvanced[platform.id];
          return (
            <div
              key={platform.id}
              className="border bg-white"
              style={{
                borderColor: enabled ? COLORS.oxblood + "66" : COLORS.line,
                opacity: enabled ? 1 : 0.72,
              }}
            >
              <div className="p-3 border-b" style={{ borderColor: COLORS.line, background: enabled ? "rgba(92,26,27,0.035)" : COLORS.paper }}>
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={readOnly}
                      onChange={(event) => togglePlatform(platform.id, event.target.checked)}
                    />
                    {platform.label}
                  </label>
                  <select
                    value={config.model}
                    disabled={readOnly}
                    onChange={(event) => updatePlatform(platform.id, "model", event.target.value)}
                    className="px-2 py-1 border bg-white text-[11px]"
                    style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}
                  >
                    {(platform.id === "ozon" ? ["FBO", "FBS", "RFBS"] : platform.id === "wb" ? ["FBW", "FBS", "DBW", "DBS"] : ["FBY", "FBS", "DBS", "Express"]).map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                  <div>
                    <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>平台计费价/折扣前售价</div>
                    <NumInput value={config.list} onChange={(value) => updatePlatform(platform.id, "list", value)} suffix="RUB" readOnly={readOnly} />
                    <div className="mt-1 text-[10px] leading-4" style={{ color: COLORS.inkSoft }}>佣金、支付手续费和广告预留按这个价格计算。</div>
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>销售占比</div>
                    <NumInput value={config.salesShare} onChange={(value) => updatePlatform(platform.id, "salesShare", value)} suffix="%" readOnly={readOnly} />
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>平台综合扣费</div>
                    <NumInput value={config.platformFee} onChange={(value) => updatePlatform(platform.id, "platformFee", value)} suffix="RUB" readOnly={readOnly || (config.useFeeDetails && config.canUseTariffFee)} />
                    <div className="mt-1 text-[10px] leading-4" style={{ color: feeSourceColor(config) }}>
                      {feeSourceText(config)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <MiniMetric label="单位回款" value={rub(config.unitPayout)} sub={`${rub(config.platformFee)} 扣费`} color={COLORS.gold} />
                  <MiniMetric label="单位利润" value={rub(unitNet)} sub={fmtPct(roi)} color={unitNet >= 0 ? COLORS.emerald : COLORS.crimson} />
                  <MiniMetric label="平台利润" value={rub(totalNet)} sub={enabled ? `实际占比 ${(effectiveShare * 100).toFixed(0)}%` : "未启用"} color={totalNet >= 0 ? COLORS.emerald : COLORS.crimson} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>海外仓费</div>
                    <NumInput value={config.warehouse} onChange={(value) => updatePlatform(platform.id, "warehouse", value)} suffix="RUB" readOnly={readOnly} />
                  </div>
                  <div>
                    <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>管理费</div>
                    <NumInput value={config.mgmt} onChange={(value) => updatePlatform(platform.id, "mgmt", value)} suffix="RUB" readOnly={readOnly} />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpenDetails((current) => ({ ...current, [platform.id]: !current[platform.id] }))}
                  className="w-full flex items-center justify-between px-2 py-2 border text-[11px]"
                  style={{ borderColor: COLORS.line, color: COLORS.inkSoft, background: COLORS.paper }}
                >
                  <span>扣费明细</span>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {isOpen && (
                  <div className="grid grid-cols-2 gap-2 p-2 border" style={{ borderColor: COLORS.line, background: COLORS.cream }}>
                    <label className="col-span-2 inline-flex items-center gap-2 text-[11px]" style={{ color: COLORS.inkSoft }}>
                      <input
                        type="checkbox"
                        checked={config.useFeeDetails}
                        disabled={readOnly}
                        onChange={(event) => updatePlatform(platform.id, "useFeeDetails", event.target.checked)}
                      />
                      按费率参数自动计算平台扣费
                    </label>
                    <label className="col-span-2 inline-flex items-center gap-2 text-[11px]" style={{ color: COLORS.inkSoft }}>
                      <input
                        type="checkbox"
                        checked={config.useTariffLookup !== false}
                        disabled={readOnly}
                        onChange={(event) => updatePlatform(platform.id, "useTariffLookup", event.target.checked)}
                      />
                      优先使用 Excel 费率表匹配佣金和物流费
                    </label>
                    {tariffFields(platform, config)}
                    {primaryFeeFields.map(([field, label, suffix]) => (
                      <div key={field}>
                        <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>{label}</div>
                        <NumInput
                          value={formatFieldValue(field, suffix, config)}
                          onChange={(value) => updatePlatform(platform.id, field, parseFieldValue(value, suffix))}
                          suffix={inputSuffix(suffix)}
                          step={suffix === "%" ? 0.1 : 1}
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                    <div className="col-span-2 border px-2 py-2 text-[11px] leading-5" style={{ borderColor: COLORS.line, background: "white", color: COLORS.inkSoft }}>
                      <div>
                        自动体积：<span className="font-mono" style={{ color: hasProductDimensions ? COLORS.emerald : COLORS.crimson }}>
                          {hasProductDimensions ? `${productVolumeLiters.toFixed(3)} L / ${(productVolumeLiters / 1000).toFixed(4)} m3` : "请先填写长、宽、高"}
                        </span>
                      </div>
                      <div>
                        当前扣费来源：<span className="font-semibold" style={{ color: feeSourceColor(config) }}>{feeSourceText(config)}</span>
                      </div>
                      {config.detailBreakdown?.tariffSource && (
                        <div>匹配依据：{config.detailBreakdown.tariffSource}</div>
                      )}
                      {config.detailBreakdown?.commissionMatchSource && (
                        <div>
                          佣金类目匹配：{config.detailBreakdown.commissionMatched
                            ? `${config.detailBreakdown.commissionMatchSource}: ${config.detailBreakdown.commissionMatchValue}`
                            : `${config.detailBreakdown.commissionMatchSource} 未找到：${config.detailBreakdown.commissionMatchInput || "空白"}`}
                        </div>
                      )}
                      {missingInputs.length > 0 && (
                        <div style={{ color: COLORS.crimson }}>缺少参数：{missingInputs.join(", ")}</div>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-between text-[11px] font-mono border-t pt-2" style={{ borderColor: COLORS.line }}>
                      <span style={{ color: COLORS.inkSoft }}>费率表计算扣费</span>
                      <span style={{ color: COLORS.oxblood }}>{rub(config.detailFee, 2)}</span>
                    </div>
                    <div className="col-span-2 flex justify-between text-[11px] font-mono">
                      <span style={{ color: COLORS.inkSoft }}>当前实际使用扣费</span>
                      <span style={{ color: feeSourceColor(config) }}>{rub(config.platformFee, 2)}</span>
                    </div>
                    <div className="col-span-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono border-t pt-2" style={{ borderColor: COLORS.line, color: COLORS.inkSoft }}>
                      <span>类目佣金率</span><span className="text-right">{pct(config.detailBreakdown?.commissionRate)}</span>
                      <span>类目是否匹配</span><span className="text-right">{config.detailBreakdown?.commissionMatched ? "已匹配" : "未匹配"}</span>
                      {platform.id === "ozon" && (
                        <>
                          <span>基础物流费</span><span className="text-right">{rub(config.detailBreakdown?.baseFreight, 2)}</span>
                          <span>物流费是否匹配</span><span className="text-right">{config.detailBreakdown?.freightMatched ? "已匹配" : "未匹配"}</span>
                        </>
                      )}
                      {platform.id === "wb" && (
                        <>
                          <span>本地化指数</span><span className="text-right">{config.detailBreakdown?.localizationMatched ? "已匹配" : "未匹配"}</span>
                          <span>销售分布系数</span><span className="text-right">{pct(config.detailBreakdown?.salesDistributionRate, 3)}</span>
                          <span>物流费用合计</span><span className="text-right">{rub(config.detailBreakdown?.logisticsTotal, 2)}</span>
                        </>
                      )}
                      {platform.id === "yandex" && (
                        <>
                          <span>付款频率</span><span className="text-right">{config.detailBreakdown?.paymentFrequencyMatched ? "已匹配" : "未匹配"}</span>
                          <span>尾程费用</span><span className="text-right">{rub(config.detailBreakdown?.lastMile, 2)}</span>
                          <span>平均配送费</span><span className="text-right">{rub(config.detailBreakdown?.avgDelivery, 2)}</span>
                        </>
                      )}
                    </div>
                    {config.detailBreakdown?.note && (
                      <div className="col-span-2 text-[10px] leading-4" style={{ color: COLORS.crimson }}>
                        {config.detailBreakdown.note}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenAdvanced((current) => ({ ...current, [platform.id]: !current[platform.id] }))}
                      className="col-span-2 flex items-center justify-between px-2 py-2 border text-[11px]"
                      style={{ borderColor: COLORS.line, color: COLORS.inkSoft, background: "white" }}
                    >
                      <span>高级兜底参数</span>
                      {isAdvancedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    {isAdvancedOpen && (advancedFeeFields[platform.id] || []).map(([field, label, suffix]) => (
                      <div key={field}>
                        <div className="text-[10px]" style={{ color: COLORS.inkSoft }}>{label}</div>
                        <NumInput
                          value={formatFieldValue(field, suffix, config)}
                          onChange={(value) => updatePlatform(platform.id, field, parseFieldValue(value, suffix))}
                          suffix={inputSuffix(suffix)}
                          step={suffix === "%" ? 0.1 : 1}
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProductEditor = ({ product, idx, onUpdate, calc, params, t, fmt, lang, readOnly = false }) => {
  const Ff = (v, d = 0) => fmtRub(v, d);
  const fields = [
    { label: t("fieldProductId"), k: "id", type: "text" },
    { label: t("fieldActualCost"), k: "priceCNY", suffix: "CNY", step: 0.01 },
    { label: t("fieldDeclaredCost"), k: "declaredCNY", suffix: "CNY", step: 0.01, highlight: true },
    { label: t("fieldQty"), k: "qty", suffix: "pcs" },
    { label: t("fieldWeight"), k: "weight", suffix: "kg", step: 0.01 },
  ];
  const productVolumeLiters = ((Number(product.volL) || 0) * (Number(product.volW) || 0) * (Number(product.volH) || 0)) / 1000;
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
                  style={{ borderColor: COLORS.line, color: COLORS.ink }}
                  readOnly={readOnly} />
              ) : (
                <NumInput value={product[f.k] ?? (f.k === "declaredCNY" ? product.priceCNY : 0)}
                  onChange={(v) => onUpdate(idx, f.k, v)} suffix={f.suffix} step={f.step || 1} readOnly={readOnly} />
              )}
            </div>
          ))}
        </div>
        <div className="p-2.5 border" style={{ borderColor: COLORS.line, background: "rgba(255,255,255,0.72)" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] tracking-widest uppercase" style={{ color: COLORS.gold }}>商品尺寸</div>
            <span className="text-[10px] font-mono" style={{ color: productVolumeLiters > 0 ? COLORS.emerald : COLORS.crimson }}>
              {productVolumeLiters > 0 ? `${productVolumeLiters.toFixed(3)} L` : "未填完整"}
            </span>
          </div>
          <div className="flex gap-1.5 items-center">
            <NumInput value={product.volL || 0} onChange={(v) => onUpdate(idx, "volL", v)} suffix="cm" step={0.1} className="flex-1" readOnly={readOnly} />
            <span className="text-xs">x</span>
            <NumInput value={product.volW || 0} onChange={(v) => onUpdate(idx, "volW", v)} suffix="cm" step={0.1} className="flex-1" readOnly={readOnly} />
            <span className="text-xs">x</span>
            <NumInput value={product.volH || 0} onChange={(v) => onUpdate(idx, "volH", v)} suffix="cm" step={0.1} className="flex-1" readOnly={readOnly} />
          </div>
          <div className="mt-1 text-[10px] font-mono" style={{ color: COLORS.inkSoft }}>
            自动体积：{productVolumeLiters.toFixed(3)} L / {(productVolumeLiters / 1000).toFixed(4)} m3。Ozon/WB/Yandex 物流费会优先用这个体积匹配。
          </div>
        </div>
        {/* Shipping mode per product */}
        <div className="mt-2 p-2.5 border" style={{ borderColor: COLORS.line, background: COLORS.paper }}>
          <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: COLORS.gold }}>{t("shippingMode")}</div>
          <div className="flex gap-1 mb-2">
            {["manual", "gray", "white"].map(m => (
              <button key={m} onClick={() => onUpdate(idx, "shippingMode", m)}
                disabled={readOnly}
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
              <NumInput value={product.weightKg || 0} onChange={(v) => onUpdate(idx, "weightKg", v)} suffix="kg" step={0.01} className="flex-1" readOnly={readOnly} />
              <span className="text-[10px] font-mono" style={{ color: COLORS.gold }}>-&gt; {fmtRub(calcShipping(product, params))}/pc</span>
            </div>
          )}
          {(product.shippingMode || "manual") === "white" && (
            <div className="space-y-2">
              <span className="text-[10px] font-mono" style={{ color: COLORS.gold }}>By product dimensions -&gt; {((product.volL || 0) * (product.volW || 0) * (product.volH || 0) / 1e6).toFixed(4)} m3 - {fmtRub(calcShipping(product, params))}/pc</span>
            </div>
          )}
          {(product.shippingMode || "manual") === "gray" && params.taxScheme === "osn" && (
            <div className="mt-1 text-[10px]" style={{ color: COLORS.crimson }}>{t("grayNoVatNote")}</div>
          )}
        </div>
      </div>
      <PlatformSettingsPanel product={product} idx={idx} onUpdate={onUpdate} calc={calc} params={params} fmt={fmt} readOnly={readOnly} />
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
          {(params.labelingPerUnit || 0) > 0 && (
            <>
              <div style={{ color: COLORS.inkSoft }}>{t("calcLabeling")}</div><div className="text-right">{Ff(params.labelingPerUnit)}</div>
            </>
          )}
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
          <Tag color={COLORS.gold}>{t("roi")} {fmtPct(calc.roi)}</Tag>
          <Tag>{t("tagEffQty")} {calc.effectiveQty.toFixed(1)}</Tag>
        </div>
      </div>
    </div>
  );
};

const tariffRate = (value, digits = 1) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  const rate = Math.abs(n) > 1 ? n : n * 100;
  return `${rate.toFixed(digits)}%`;
};

const tariffMoney = (value, digits = 2) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: digits })} RUB`;
};

const compactRateBands = (rates, buckets = []) => {
  if (!Array.isArray(rates)) return tariffRate(rates);
  return rates.map((rate, index) => {
    const bucket = Number(buckets[index]);
    const label = Number.isFinite(bucket) ? `${bucket.toLocaleString("ru-RU")}+` : `Band ${index + 1}`;
    return `${label} ${tariffRate(rate, 0)}`;
  }).join(" / ");
};

const matchTariffQuery = (row, query, columns) => {
  if (!query) return true;
  return columns.some((column) => String(column.render(row) ?? "").toLocaleLowerCase().includes(query));
};

const TariffDataTable = ({ rows, columns, query, maxRows = 200, emptyText = "没有匹配行" }) => {
  const visibleRows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return rows.filter((row) => matchTariffQuery(row, q, columns)).slice(0, maxRows);
  }, [rows, columns, query, maxRows]);
  const totalMatches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return rows.length;
    return rows.reduce((count, row) => count + (matchTariffQuery(row, q, columns) ? 1 : 0), 0);
  }, [rows, columns, query]);

  return (
    <div className="border bg-white overflow-hidden" style={{ borderColor: COLORS.line }}>
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b text-[11px]" style={{ borderColor: COLORS.line, color: COLORS.inkSoft, background: COLORS.paper }}>
        <span>{totalMatches.toLocaleString("zh-CN")} 行匹配</span>
        {totalMatches > maxRows && <span>当前只显示前 {maxRows} 行，请搜索缩小范围。</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: columns.length * 180 }}>
          <thead style={{ background: COLORS.paper }}>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`p-2 text-[10px] font-semibold ${column.align === "right" ? "text-right" : "text-left"}`} style={{ color: COLORS.inkSoft, minWidth: column.width || 150 }}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={row.key || rowIndex} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                {columns.map((column) => (
                  <td key={column.key} className={`p-2 align-top ${column.align === "right" ? "text-right font-mono" : ""}`} style={{ color: column.color || COLORS.ink }}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-6 text-center text-xs" style={{ color: COLORS.inkSoft }}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TariffTablesPanel = () => {
  const [platformId, setPlatformId] = useState("ozon");
  const [sectionId, setSectionId] = useState("commissions");
  const [query, setQuery] = useState("");

  const tableData = useMemo(() => {
    const ozonFreight = PLATFORM_TARIFFS.ozon?.freight || {};
    const ozonVolumeBands = ozonFreight.volumeBands || [];
    const ozonClusters = ozonFreight.clusters || PLATFORM_TARIFFS.ozon?.clusters || [];
    const ozonFreightRows = Array.isArray(ozonFreight)
      ? ozonFreight.map((row, index) => ({
          key: `ozon-freight-${index}`,
          volume: row[1],
          supply: row[2],
          delivery: row[3],
          fee: row[5],
        }))
      : (ozonFreight.rows || []).map((row, index) => ({
          key: `ozon-freight-${index}`,
          volume: ozonVolumeBands[row[0]]?.[1] || row[0],
          supply: ozonClusters[row[1]] || row[1],
          delivery: ozonClusters[row[2]] || row[2],
          fee: row[3],
        }));

    return {
      ozonFreightRows,
      ozonCommissions: PLATFORM_TARIFFS.ozon?.commissions || [],
      ozonNonLocal: (PLATFORM_TARIFFS.ozon?.nonLocal || []).map((row, index) => ({ key: `ozon-nonlocal-${index}`, cluster: row[0], rate: row[1] })),
      wbCommissions: PLATFORM_TARIFFS.wb?.commissions || [],
      wbLocalization: (PLATFORM_TARIFFS.wb?.localization || []).map((row, index) => ({ key: `wb-localization-${index}`, band: row[0], coefficient: row[1], distribution: row[2] })),
      yandexCommissions: PLATFORM_TARIFFS.yandex?.commissions || [],
      yandexPayments: (PLATFORM_TARIFFS.yandex?.paymentFrequencies || []).map((row, index) => ({ key: `yandex-payment-${index}`, frequency: row[0], rate: row[1] })),
    };
  }, []);

  const sectionsByPlatform = {
    ozon: [
      {
        id: "commissions",
        label: "佣金（原表 B列：Тип товара）",
        hint: "对照 Excel 工作表“佣金”：选品类时主要看 B 列 Тип товара；后面费率按原表 FBO/FBS/RFBS 分段合并展示。",
        rows: tableData.ozonCommissions,
        columns: [
          { key: "type", header: "B列：Тип товара", width: 280, render: (row) => row[0] || "-" },
          { key: "fbo", header: "C-H列：FBO", width: 360, render: (row) => compactRateBands(row[1], PLATFORM_TARIFFS.ozon?.priceBuckets) },
          { key: "fbs", header: "O-T列：FBS", width: 360, render: (row) => compactRateBands(row[2], PLATFORM_TARIFFS.ozon?.priceBuckets) },
          { key: "rfbs", header: "U-X列：RFBS", width: 300, render: (row) => compactRateBands(row[3], PLATFORM_TARIFFS.ozon?.rfbsPriceBuckets) },
        ],
      },
      {
        id: "freight",
        label: "最新基本运费",
        hint: "对照 Excel 工作表“最新基本运费”：按 B 列体积、C 列 Кластер поставки、D 列 Кластер доставки 匹配；当前程序使用 F 列 Для товаров свыше 300 руб.。",
        rows: tableData.ozonFreightRows,
        columns: [
          { key: "volume", header: "B列：Объём товара", width: 220, render: (row) => row.volume || "-" },
          { key: "supply", header: "C列：Кластер поставки", width: 260, render: (row) => row.supply || "-" },
          { key: "delivery", header: "D列：Кластер доставки", width: 260, render: (row) => row.delivery || "-" },
          { key: "fee", header: "F列：Для товаров свыше 300 руб.", align: "right", width: 220, render: (row) => tariffMoney(row.fee) },
        ],
      },
      {
        id: "nonLocal",
        label: "非本地销售",
        hint: "对照 Excel 工作表“非本地销售”：A 列是 Кластер доставки，B 列是 Наценка за нелокальную продажу от вашей цены товара。",
        rows: tableData.ozonNonLocal,
        columns: [
          { key: "cluster", header: "A列：Кластер доставки", width: 320, render: (row) => row.cluster || "-" },
          { key: "rate", header: "B列：Наценка за нелокальную продажу", align: "right", width: 260, render: (row) => tariffRate(row.rate, 2) },
        ],
      },
    ],
    wb: [
      {
        id: "commissions",
        label: "类目佣金-2026（原表 B列：子类目）",
        hint: "对照 Excel 工作表“类目佣金-2026”：选品类时主要看 B 列 子类目；费率列保持原表 FBW/FBS/DBW/DBS。",
        rows: tableData.wbCommissions,
        columns: [
          { key: "subcategory", header: "B列：子类目", width: 300, render: (row) => row[0] || "-" },
          { key: "fbw", header: "C列：FBW", align: "right", render: (row) => tariffRate(row[1]) },
          { key: "fbs", header: "D列：FBS", align: "right", render: (row) => tariffRate(row[2]) },
          { key: "dbw", header: "E列：DBW", align: "right", render: (row) => tariffRate(row[3]) },
          { key: "dbs", header: "F列：DBS", align: "right", render: (row) => tariffRate(row[4]) },
        ],
      },
      {
        id: "localization",
        label: "本地化指数",
        hint: "对照 Excel 工作表“本地化指数”：A 列本地化指数，B 列地域分配系数，C 列销售分布系数。",
        rows: tableData.wbLocalization,
        columns: [
          { key: "band", header: "A列：本地化指数", width: 240, render: (row) => row.band || "-" },
          { key: "coefficient", header: "B列：地域分配系数", align: "right", width: 180, render: (row) => Number(row.coefficient || 0).toFixed(3) },
          { key: "distribution", header: "C列：销售分布系数", align: "right", width: 180, render: (row) => tariffRate(row.distribution, 3) },
        ],
      },
    ],
    yandex: [
      {
        id: "commissions",
        label: "Yandex 佣金表（Категория / Тариф）",
        hint: "对照 Yandex-4月佣金.xlsx：A-G 列是 Категория (Уровень 1-7)，H 列是 Тариф с 1.04.2026；这里把层级合成一列方便搜索。",
        rows: tableData.yandexCommissions,
        columns: [
          { key: "path", header: "A-G列：Категория (Уровень 1-7)", width: 420, render: (row) => row[0] || "-" },
          { key: "fby", header: "FBY：Тариф с 1.04.2026", align: "right", width: 190, render: (row) => tariffRate(row[1]) },
          { key: "fbs", header: "FBS：Тариф с 1.04.2026", align: "right", width: 190, render: (row) => tariffRate(row[2]) },
          { key: "express", header: "Экспресс：Тариф с 1.04.2026", align: "right", width: 220, render: (row) => tariffRate(row[3]) },
          { key: "dbs", header: "DBS：Тариф с 1.04.2026", align: "right", width: 190, render: (row) => tariffRate(row[4]) },
        ],
      },
      {
        id: "payments",
        label: "参考（付款频率）",
        hint: "对照星哈酷 Yandex 单位经济效益表的“参考”工作表：A 列 付款频率，B 列 %。",
        rows: tableData.yandexPayments,
        columns: [
          { key: "frequency", header: "A列：付款频率", width: 240, render: (row) => row.frequency || "-" },
          { key: "rate", header: "B列：%", align: "right", render: (row) => tariffRate(row.rate, 2) },
        ],
      },
    ],
  };

  const platformTabs = [
    { id: "ozon", label: "Ozon", count: tableData.ozonCommissions.length },
    { id: "wb", label: "Wildberries", count: tableData.wbCommissions.length },
    { id: "yandex", label: "Yandex Market", count: tableData.yandexCommissions.length },
  ];
  const activeSections = sectionsByPlatform[platformId] || sectionsByPlatform.ozon;
  const activeSection = activeSections.find((section) => section.id === sectionId) || activeSections[0];
  const sourceMap = PLATFORM_TARIFFS.sources || {};

  const switchPlatform = (nextPlatformId) => {
    setPlatformId(nextPlatformId);
    setSectionId("commissions");
    setQuery("");
  };

  return (
    <div className="space-y-5 anim-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-semibold">Excel 定价表原始字段核对</h2>
          <p className="text-xs mt-1 max-w-3xl leading-5" style={{ color: COLORS.inkSoft }}>
            这里尽量保留 Excel 原工作表名、原列名和列号；括号里的说明只帮助核对，不参与计算。
          </p>
        </div>
        <div className="text-[11px] leading-5 text-right" style={{ color: COLORS.inkSoft }}>
          <div>生成时间：{PLATFORM_TARIFFS.generatedAt || "未加载"}</div>
          <div>来源：{sourceMap[platformId] || "platform-tariffs.json"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {platformTabs.map((platform) => (
          <button
            key={platform.id}
            type="button"
            onClick={() => switchPlatform(platform.id)}
            className="text-left border px-4 py-3"
            style={{
              borderColor: platformId === platform.id ? COLORS.oxblood : COLORS.line,
              background: platformId === platform.id ? "rgba(92,26,27,0.06)" : "white",
              color: COLORS.ink,
            }}
          >
            <div className="font-display text-lg font-semibold">{platform.label}</div>
            <div className="text-[11px] mt-1" style={{ color: COLORS.inkSoft }}>
              {platform.count.toLocaleString("zh-CN")} 行原表数据
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {activeSections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => { setSectionId(section.id); setQuery(""); }}
              className="px-3 py-2 text-xs border"
              style={{
                borderColor: activeSection.id === section.id ? COLORS.oxblood : COLORS.line,
                background: activeSection.id === section.id ? COLORS.oxblood : "white",
                color: activeSection.id === section.id ? COLORS.cream : COLORS.inkSoft,
              }}
            >
              {section.label}
            </button>
          ))}
        </div>
        <div className="flex items-center border bg-white px-2 py-1.5 min-w-[260px]" style={{ borderColor: COLORS.line }}>
          <Search size={14} style={{ color: COLORS.inkSoft }} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索原表里的类目、集群、区间..."
            className="ml-2 flex-1 bg-transparent text-xs"
            style={{ color: COLORS.ink }}
          />
        </div>
      </div>

      <div className="border-l-2 px-3 py-2 text-xs leading-5" style={{ borderColor: COLORS.gold, background: COLORS.paper, color: COLORS.inkSoft }}>
        <strong style={{ color: COLORS.ink }}>{activeSection.label}</strong>
        <span className="ml-2">{activeSection.hint}</span>
      </div>

      <TariffDataTable rows={activeSection.rows} columns={activeSection.columns} query={query} />
    </div>
  );
};

// ============================================================
// 销售排期 Tab（含售价/平台综合扣费排期）
// ============================================================
const ScheduleTab = ({ products, projection, setProjection, scheduleStore, updateSchedule, applyCurve,
  priceScheduleStore, setPriceScheduleStore, restockStore, updateRestock, setRestockStore,
  withdrawalStore, setWithdrawalStore, t, lang, readOnly = false }) => {
  const months = projection.monthsHorizon;
  const totalAllProducts = products.reduce((a, b) => a + (b.qty || 0), 0);

  // 更新某 SKU 某月的售价
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

  // 更新某 SKU 某月的平台综合扣费
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

  // 重置所有平台计费价排期
  const resetPrices = () => {
    setPriceScheduleStore(s => {
      const next = { ...s };
      for (const id of Object.keys(next)) {
        if (next[id]) next[id] = { ...next[id], list: undefined };
      }
      return next;
    });
  };

  // 重置所有平台综合扣费排期
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
        <button onClick={() => applyCurve("seasonal")} className="px-2 py-1 border" style={{ borderColor: COLORS.line, background: "white" }}>{t("seasonalCurve")}</button>
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
              <th className="text-right p-2" style={{ minWidth: "72px" }}>{t("totalPieces")}</th>
              {Array.from({ length: months }, (_, i) => (
                <th key={i} className="text-center p-2 font-mono" style={{ minWidth: "60px" }}>{t("monthLabel")}{i + 1}</th>
              ))}
              <th className="text-right p-2" style={{ minWidth: "88px" }}>{t("allocatedPieces")}</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const stored = scheduleStore[p.id];
              const rSched = restockStore[p.id] || [p.qty || 0];
              const totalPurchased = rSched.reduce((a, b) => a + (b || 0), 0) || (p.qty || 0);
              const sched = getSchedule(p.id, totalPurchased, months, scheduleStore);
              const allocated = sched.reduce((a, b) => a + (b || 0), 0);
              const matches = allocated === totalPurchased;
              return (
                <tr key={p.id} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                  <td className="p-2 font-mono sticky left-0 z-10" style={{ background: "white" }}>{p.id}</td>
                  <td className="p-2 text-right font-mono" style={{ color: COLORS.inkSoft }}>{totalPurchased} {t("unitPieces")}</td>
                  {sched.map((q, i) => (
                    <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                      <InlineNumInput value={q || 0} min="0" readOnly={readOnly}
                        onChange={(value) => updateSchedule(p.id, i, Math.round(value || 0))} />
                    </td>
                  ))}
                  <td className="p-2 text-right font-mono font-semibold" style={{ color: matches ? COLORS.emerald : COLORS.crimson }}>
                    {allocated}/{totalPurchased} {t("unitPieces")}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot style={{ background: COLORS.paper }}>
            <tr className="font-semibold">
              <td className="p-2 sticky left-0" style={{ background: COLORS.paper }}>{t("total")}</td>
              <td className="p-2 text-right font-mono">
                {products.reduce((acc, p) => {
                  const rSched = restockStore[p.id] || [p.qty || 0];
                  return acc + (rSched.reduce((a, b) => a + (b || 0), 0) || (p.qty || 0));
                }, 0)} {t("unitPieces")}
              </td>
              {Array.from({ length: months }, (_, i) => {
                const sum = products.reduce((acc, p) => {
                  const rSched = restockStore[p.id] || [p.qty || 0];
                  const totalPurchased = rSched.reduce((a, b) => a + (b || 0), 0) || (p.qty || 0);
                  const sched = getSchedule(p.id, totalPurchased, months, scheduleStore);
                  return acc + (sched[i] || 0);
                }, 0);
                return <td key={i} className="p-2 text-center font-mono">{sum} {t("unitPieces")}</td>;
              })}
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ===== 补货排期 ===== */}
      <div className="border" style={{ borderColor: COLORS.line, background: 'white' }}>
        <button
          onClick={() => setShowRestockSchedule(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          style={{ background: COLORS.paper }}
        >
          <div className="flex items-center gap-2">
            {showRestockSchedule ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <div>
              <span className="font-display font-semibold text-sm">{t("restockTitle")}</span>
              <span className="text-[10px] ml-2" style={{ color: COLORS.inkSoft }}>{t("restockHint")}</span>
            </div>
          </div>
          {showRestockSchedule && (
            <button onClick={(e) => { e.stopPropagation(); setRestockStore({}); }}
              className="px-2 py-1 text-[11px] border" style={{ borderColor: COLORS.crimson, color: COLORS.crimson }}>
              {t("resetRestock")}
            </button>
          )}
        </button>
        {showRestockSchedule && (
          <div className="border-t overflow-x-auto" style={{ borderColor: COLORS.line }}>
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
                        <InlineNumInput value={rSched[0] || 0} min="0" readOnly={readOnly}
                          onChange={(value) => updateRestock(p.id, 0, Math.round(value || 0))}
                          style={{ color: COLORS.oxblood, fontWeight: 600 }} />
                      </td>
                      {Array.from({ length: months }, (_, i) => {
                        const v = rSched[i + 1] || 0;
                        return (
                          <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                            <InlineNumInput value={v || 0} min="0" readOnly={readOnly}
                              onChange={(value) => updateRestock(p.id, i + 1, Math.round(value || 0))}
                              style={{ color: v > 0 ? COLORS.emerald : undefined, fontWeight: v > 0 ? 600 : undefined }} />
                          </td>
                        );
                      })}
                      <td className="p-2 text-right font-mono font-semibold" style={{ color: COLORS.ink }}>
                        {totalPurchased} {t("unitPieces")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: COLORS.paper }}>
                <tr className="font-semibold">
                  <td className="p-2 sticky left-0" style={{ background: COLORS.paper }}>{t("total")}</td>
                  <td className="p-2 text-center font-mono" style={{ color: COLORS.oxblood }}>
                    {products.reduce((acc, p) => acc + ((restockStore[p.id] || [p.qty || 0])[0] || 0), 0)} {t("unitPieces")}
                  </td>
                  {Array.from({ length: months }, (_, i) => {
                    const sum = products.reduce((acc, p) => {
                      const rSched = restockStore[p.id] || [p.qty || 0, ...Array(months).fill(0)];
                      return acc + (rSched[i + 1] || 0);
                    }, 0);
                    return <td key={i} className="p-2 text-center font-mono" style={{ color: sum > 0 ? COLORS.emerald : undefined }}>{sum} {t("unitPieces")}</td>;
                  })}
                  <td className="p-2 text-right font-mono">
                    {products.reduce((acc, p) => {
                      const rSched = restockStore[p.id] || [p.qty || 0, ...Array(months).fill(0)];
                      return acc + rSched.reduce((a, b) => a + (b || 0), 0);
                    }, 0)} {t("unitPieces")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ===== 平台计费价排期表格（可折叠） ===== */}
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
                  <th className="text-right p-2" style={{ minWidth: "86px" }}>默认计费价（₽）</th>
                  {Array.from({ length: months }, (_, i) => (
                    <th key={i} className="text-center p-2 font-mono" style={{ minWidth: "70px" }}>{t("monthLabel")}{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const entry = priceScheduleStore[p.id];
                  const listArr = entry?.list || [];
                  const platformAvg = getProductPlatformAverages(p);
                  const defaultList = platformAvg.list;
                  return (
                    <tr key={p.id} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                      <td className="p-2 font-mono sticky left-0 z-10" style={{ background: "white" }}>{p.id}</td>
                      <td className="p-2 text-right font-mono" style={{ color: COLORS.inkSoft }}>{(defaultList || 0).toLocaleString("ru-RU")} RUB</td>
                      {Array.from({ length: months }, (_, i) => {
                        const v = listArr[i] || 0;
                        const isCustom = v > 0 && v !== (defaultList || 0);
                        return (
                          <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                            <InlineNumInput value={v || 0} min="0" readOnly={readOnly}
                              placeholder={String(Math.round(defaultList || 0))}
                              onChange={(value) => updatePrice(p.id, i, Math.round(value || 0))}
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

      {/* ===== 平台综合扣费排期表格（可折叠） ===== */}
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
                  <th className="text-right p-2" style={{ minWidth: "96px" }}>默认扣费（₽）</th>
                  {Array.from({ length: months }, (_, i) => (
                    <th key={i} className="text-center p-2 font-mono" style={{ minWidth: "70px" }}>{t("monthLabel")}{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const entry = priceScheduleStore[p.id];
                  const feeArr = entry?.fee || [];
                  const platformAvg = getProductPlatformAverages(p);
                  const defaultFee = platformAvg.platformFee;
                  return (
                    <tr key={p.id} className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                      <td className="p-2 font-mono sticky left-0 z-10" style={{ background: "white" }}>{p.id}</td>
                      <td className="p-2 text-right font-mono" style={{ color: COLORS.inkSoft }}>{(defaultFee || 0).toLocaleString("ru-RU")} RUB</td>
                      {Array.from({ length: months }, (_, i) => {
                        const v = feeArr[i] || 0;
                        const isCustom = v > 0 && v !== (defaultFee || 0);
                        return (
                          <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                            <InlineNumInput value={v || 0} min="0" readOnly={readOnly}
                              placeholder={String(Math.round(defaultFee || 0))}
                              onChange={(value) => updateFee(p.id, i, Math.round(value || 0))}
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


    </div>
  );
};


// ============================================================
// 增值税阈值监控（动态税制）
// ============================================================
const VATThresholdMonitor = ({ proj, projection, updateProj, params, t, lang }) => {
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
              <strong> 0-0M</strong>{t("vatTier0Desc")};
              <strong style={{ color: COLORS.gold }}> 20M-50M</strong>{t("vatTier1Desc")};
              <strong style={{ color: COLORS.oxbloodSoft }}> 250M-50M</strong>{t("vatTier2Desc")};
              <strong style={{ color: COLORS.crimson }}> 450M+</strong>{t("vatTier3Desc")}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-xs p-3 border" style={{ borderColor: COLORS.line, background: COLORS.paper, color: COLORS.inkSoft }}>
          <Info size={12} className="inline mr-1" />
          {t("vatFixedNote")} <strong style={{ color: COLORS.oxblood }}>{taxSchemeShortLabel(TAX_SCHEMES[params.taxScheme], lang)}</strong>.
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
const ProjectionTab = ({ proj, projection, setProjection, params, totals, withdrawalStore, setWithdrawalStore, t, lang, fmt, readOnly = false }) => {
  const updateProj = (k, v) => setProjection(p => ({ ...p, [k]: v }));
  const months = projection.monthsHorizon;
  const [showWithdrawalSchedule, setShowWithdrawalSchedule] = useState(false);
  const updateWithdrawal = (monthIdx, val) => {
    setWithdrawalStore(s => {
      const arr = [...(s.amounts || Array(months).fill(0))];
      while (arr.length < months) arr.push(0);
      arr[monthIdx] = Math.max(0, val);
      return { ...s, amounts: arr };
    });
  };
  const F = fmt.fmtPrimary, Fs = fmt.fmtSecondary;
  return (
    <div className="space-y-6 anim-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 border" style={{ borderColor: COLORS.line, background: "white" }}>
          <Metric label={t("currentMonth")}
            value={proj.breakEvenMonth ? t("monthN", { n: proj.breakEvenMonth }) : "-"}
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

      <Card kicker="增值税门槛 2026" title={t("vatThreshold")}>
        <VATThresholdMonitor proj={proj} projection={projection} updateProj={updateProj} params={params} t={t} lang={lang} />
      </Card>

      <AudienceQuickGuide compact />

      <Card kicker="累计现金" title={t("cumCashChart")}>
        <CashFlowChart proj={proj} t={t} fmt={fmt} />
      </Card>

      <Card kicker="月度利润" title={t("monthlyNetProfit")}>
        <MonthlyPnLChart proj={proj} t={t} fmt={fmt} />
      </Card>

      <Card kicker="预测参数" title={t("projParams")}>
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
            <NumInput value={projection.monthlyFixedCost} onChange={(v) => updateProj("monthlyFixedCost", Math.max(0, v))} suffix="RUB" step={1000} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("priorRevenue")}</label>
            <NumInput value={projection.priorYearRevenue} onChange={(v) => updateProj("priorYearRevenue", Math.max(0, v))} suffix="RUB" step={100000} className="mt-1" />
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

      {/* ===== 分润排期 ===== */}
      <Card kicker="分润/提现" title={t("withdrawalTitle")}>
        <div className="text-xs mb-3" style={{ color: COLORS.inkSoft }}>
          {t("withdrawalHint")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: COLORS.paper }}>
              <tr className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.inkSoft }}>
                <th className="text-left p-2 sticky left-0 z-10" style={{ background: COLORS.paper, minWidth: '120px' }}>{t("withdrawalLabel")}</th>
                {Array.from({ length: months }, (_, i) => (
                  <th key={i} className="text-center p-2 font-mono" style={{ minWidth: '80px' }}>{t("monthLabel")}{i + 1}</th>
                ))}
                <th className="text-right p-2" style={{ minWidth: '80px' }}>{t("totalAmountRub")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t ledger-row" style={{ borderColor: COLORS.line }}>
                <td className="p-2 font-mono sticky left-0 z-10" style={{ background: 'white' }}>{t("withdrawalAmount")}</td>
                {Array.from({ length: months }, (_, i) => {
                  const v = (withdrawalStore?.amounts?.[i]) || 0;
                  return (
                    <td key={i} className="schedule-cell p-0 border-l" style={{ borderColor: COLORS.line }}>
                      <InlineNumInput value={v || 0} min="0" step="1000" readOnly={readOnly}
                        onChange={(value) => updateWithdrawal(i, Math.round(value || 0))}
                        style={{ color: v > 0 ? COLORS.emerald : undefined, fontWeight: v > 0 ? 600 : undefined }} />
                    </td>
                  );
                })}
                <td className="p-2 text-right font-mono font-semibold" style={{ color: COLORS.emerald }}>
                  {((withdrawalStore?.amounts || []).reduce((a, b) => a + (b || 0), 0)).toLocaleString('ru-RU')} RUB
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-[10px]" style={{ color: COLORS.inkSoft }}>
            {t("withdrawalSplitNote", { pct: projection.partnerSharePct || 0 })}
          </span>
          <button onClick={() => setWithdrawalStore({ amounts: [] })} className="px-2 py-0.5 border text-[10px]"
            style={{ borderColor: COLORS.crimson, color: COLORS.crimson }}>{t("resetWithdrawal")}</button>
        </div>
      </Card>

      <Card kicker="月度明细" title={t("cashFlowDetail")}>
        <div className="mb-3">
          <MetricBasisNote totals={totals} params={params} proj={proj} projection={projection} fmt={fmt} compact />
        </div>
        <div className="text-xs mb-3 p-2 border-l-2" style={{ borderColor: COLORS.gold, background: COLORS.paper, color: COLORS.inkSoft }}>
          <Info size={12} className="inline mr-1" />
          <strong style={{ color: COLORS.ink }}>{t("projCashVsPnl")}</strong>
          <br />- <strong>{t("projNetLabel")}</strong> {t("projNetDesc")}
          <br />- <strong>{t("projCashLabel")}</strong> {t("projCashDesc")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: "1650px" }}>
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
                <th className="text-right p-2" style={{ color: COLORS.crimson }}>{t("thDamageLoss")}</th>
                <th className="text-right p-2 border-l" style={{ borderColor: COLORS.line }}>{t("thMonthlyNet")}</th>
                <th className="text-right p-2" style={{ color: COLORS.gold }}>{t("thDistributed")}</th>
                <th className="text-right p-2">{t("thPartner")}</th>
                <th className="text-right p-2">{t("thOwner")}</th>
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
                    {m.isInitial ? "-" : (m.vatTierKey ? t(m.vatTierKey, m.vatTierKey === "vatLabelFixedOsn" ? { rate: (m.vatRate*100).toFixed(0) } : {}) : "-")}
                  </td>
                  <td className="p-2 text-right font-mono text-[10px]" style={{ color: m.restockQty > 0 ? COLORS.crimson : COLORS.inkSoft }}>
                    {m.restockQty > 0 ? `+${m.restockQty} ${t("unitPieces")}` : "-"}
                    {m.restockCost > 0 && !m.isInitial && <div className="text-[9px]" style={{ color: COLORS.crimson }}>-{F(m.restockCost)}</div>}
                  </td>
                  <td className="p-2 text-right font-mono" style={{ color: m.stockWarning ? COLORS.crimson : COLORS.inkSoft }}>
                    {m.stockEnd} {t("unitPieces")}{m.stockWarning && <span className="ml-1 text-[9px]">!</span>}
                  </td>
                  <td className="p-2 text-right font-mono">{m.soldQty ? `${m.soldQty} ${t("unitPieces")}` : "-"}</td>
                  <td className="p-2 text-right font-mono">{m.revenue ? F(m.revenue) : "-"}</td>
                  <td className="p-2 text-right font-mono">{m.cogs ? F(m.cogs) : (m.isInitial ? F(-(proj.initialOutflow - (m.importVAT || 0))) : "-")}</td>
                  <td className="p-2 text-right font-mono">{m.expenses ? F(m.expenses) : "-"}</td>
                  <td className="p-2 text-right font-mono">{m.fixedCost ? F(m.fixedCost) : "-"}</td>
                  <td className="p-2 text-right font-mono" style={{ color: m.tax > 0 ? COLORS.crimson : COLORS.inkSoft }}>{m.tax ? F(m.tax) : "-"}</td>
                  <td className="p-2 text-right font-mono" style={{ color: COLORS.crimson }}>{m.damageLoss ? F(m.damageLoss) : "-"}</td>
                  <td className="p-2 text-right font-mono font-semibold border-l" style={{ borderColor: COLORS.line, color: m.netProfit >= 0 ? COLORS.emerald : COLORS.crimson }}>
                    {F(m.netProfit)}
                  </td>
                  <td className="p-2 text-right font-mono" style={{ color: COLORS.gold }}>{m.distributed ? F(m.distributed) : "-"}</td>
                  <td className="p-2 text-right font-mono">{m.partnerPayout ? F(m.partnerPayout) : "-"}</td>
                  <td className="p-2 text-right font-mono">{m.ownerPayout ? F(m.ownerPayout) : "-"}</td>
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
                  {proj.months.reduce((a, b) => a + (b.restockQty || 0), 0)} {t("unitPieces")}
                </td>
                <td className="p-2 text-right font-mono">
                  {proj.months.length > 0 ? proj.months[proj.months.length - 1].stockEnd : 0} {t("unitPieces")}
                </td>
                <td className="p-2 text-right font-mono">{proj.months.reduce((a, b) => a + b.soldQty, 0)} {t("unitPieces")}</td>
                <td className="p-2 text-right font-mono">{F(proj.totalRevenue)}</td>
                <td colSpan={3}></td>
                <td className="p-2 text-right font-mono" style={{ color: COLORS.crimson }}>{F(proj.totalTax)}</td>
                <td className="p-2 text-right font-mono" style={{ color: COLORS.crimson }}>{F(proj.months.filter(m => !m.isInitial).reduce((a, b) => a + (b.damageLoss || 0), 0))}</td>
                <td className="p-2 text-right font-mono border-l" style={{ borderColor: COLORS.line, color: proj.totalNetProfit >= 0 ? COLORS.emerald : COLORS.crimson }}>
                  {F(proj.totalNetProfit)}
                </td>
                <td className="p-2 text-right font-mono" style={{ color: COLORS.gold }}>
                  {F(proj.months.reduce((a, b) => a + (b.distributed || 0), 0))}
                </td>
                <td className="p-2 text-right font-mono">{F(proj.totalPartnerPayout)}</td>
                <td className="p-2 text-right font-mono">
                  {F(proj.months.reduce((a, b) => a + (b.ownerPayout || 0), 0))}
                </td>
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
      <TaxSchemePicker params={params} setParams={setParams} t={t} lang={lang} />
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

const TaxSchemePicker = ({ params, setParams, t, lang }) => (
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
          <Tag color={params.taxScheme === k ? COLORS.oxblood : COLORS.inkSoft}>{taxSchemeShortLabel(v, lang)}</Tag>
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
    { label: t("paramExchangeRate"), k: "exchangeRate", suffix: "RUB/CNY", step: 0.1 },
    { label: t("paramUsdRate"), k: "usdRate", suffix: "RUB/USD", step: 0.5 },
    { label: t("paramDamageRate"), k: "damageRate", suffix: "%", step: 0.5, multiplier: 100 },
    { label: t("paramOneTime"), k: "oneTimeCosts", suffix: "RUB", step: 100 },
  ];
  return (
    <div className="space-y-3">
      {items.map(it => (
        <div key={it.k}>
          <label className="text-xs" style={{ color: COLORS.inkSoft }}>{it.label}</label>
          <NumInput value={it.multiplier ? params[it.k] * it.multiplier : params[it.k]}
            onChange={(v) => setParams(p => ({ ...p, [it.k]: it.multiplier ? v / it.multiplier : v }))}
            suffix={it.suffix} step={it.step || 1} className="mt-1" />
          {it.k === "oneTimeCosts" && (
            <div className="mt-1 text-xs leading-relaxed" style={{ color: COLORS.inkSoft }}>
              约 {fmtCnyShort((params.oneTimeCosts || 0) / (params.exchangeRate || 12.8))}。这里只放首批启动费：样品、包装打样、拍摄内容、合规资料整理；不含库存采购、广告测款、现金周转、到俄头程/清关/入仓。
            </div>
          )}
        </div>
      ))}
      {/* Shipping section */}
      <div className="pt-3 mt-2 border-t" style={{ borderColor: COLORS.line }}>
        <div className="text-[10px] tracking-widest uppercase mb-2" style={{ color: COLORS.gold }}>{t("shippingMode")}</div>
        <div className="space-y-2">
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("paramShipping")} ({t("shippingManual")})</label>
            <NumInput value={params.shippingPerUnit} onChange={(v) => setParams(p => ({ ...p, shippingPerUnit: v }))} suffix="RUB/pc" step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("grayShipPrice")}</label>
            <NumInput value={params.grayShipPrice} onChange={(v) => setParams(p => ({ ...p, grayShipPrice: v }))} suffix="CNY/kg" step={0.5} className="mt-1" />
          </div>
          <div>
            <label className="text-xs" style={{ color: COLORS.inkSoft }}>{t("whiteShipPrice")}</label>
            <NumInput value={params.whiteShipPrice} onChange={(v) => setParams(p => ({ ...p, whiteShipPrice: v }))} suffix="CNY/m3" step={10} className="mt-1" />
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
    <Card kicker="2026 税改" title={t("helpTitle")} className="lg:col-span-2">
      <div className="space-y-4 text-sm">
        <div>
          <div className="font-display font-semibold text-base mb-1">{t("helpVatTitle")}</div>
          <p style={{ color: COLORS.inkSoft }}>{t("helpVatDesc")}</p>
        </div>
        <div>
          <div className="font-display font-semibold text-base mb-1">{t("helpUsnTitle")}</div>
          <ul className="list-disc list-inside space-y-1" style={{ color: COLORS.inkSoft }}>
            <li>2025: 60M RUB</li>
            <li className="font-semibold" style={{ color: COLORS.oxblood }}>2026: 20M RUB</li>
            <li>2027: 15M RUB</li>
            <li>2028: 10M RUB</li>
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

    <Card kicker="实操提醒" title={t("helpPractical")}>
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
const GLOSSARY_SECTIONS = [
  {
    section: "总览指标",
    items: [
      { term: "总营收", desc: "所有销售单位扣完平台综合扣费后的平台到手回款合计。", example: "平台计费价 1249 ₽ - 平台扣费 652 ₽ = 到手回款 597 ₽/销售单位。" },
      { term: "总投资", desc: "当前模型里已填写的采购成本、物流/清关相关字段、贴标和启动费等投入合计。", example: "单个销售单位成本 224 ₽ × 30 件 = 6720 ₽。" },
      { term: "商品经营利润（未扣启动费）", desc: "这批商品按当前报价和税费算出来的利润，还没有扣一次性启动费。", example: "销售回款 - 商品成本 - 海外仓费 - 管理费 - 税。" },
      { term: "最后账上还剩现金", desc: "按月度销售、固定支出、补货和分润/提现后，项目账上最后剩下的钱。", example: "M0 是先付出去的钱；后面月份再把实际现金进出加回来。" },
    ],
  },
  {
    section: "投资人关注",
    items: [
      { term: "M0 先付出去的钱", desc: "还没开始卖之前先垫出去的钱，通常包括首批备货和已填写的前置成本。", example: "M0 = -108万 ₽，表示销售回款进来前先垫了 108万 ₽。" },
      { term: "回本月份", desc: "账上累计现金第一次转正的月份。", example: "M5 还是负数，M6 转正，那就是第 6 个月回本。" },
      { term: "最缺钱的时候", desc: "预测期间账上现金最低的点，也就是最大资金压力。", example: "通常出现在 M0 或补货后、回款前。" },
      { term: "回报率（ROI/投入产出）", desc: "利润 ÷ 投入 × 100%，看每投入 1 块钱大概能赚回多少。", example: "投资 10万 ₽，利润 4.7万 ₽，回报率就是 47%。" },
    ],
  },
  {
    section: "商品明细",
    items: [
      { term: "供应商报价/报关申报价", desc: "供应商报价是实际采购测算口径；报关申报价用于清关、进口 VAT 和可抵扣成本假设。", example: "实际采购 20 元，报关申报 15 元，两者可以不同。" },
      { term: "平台综合扣费", desc: "每个销售单位被 Ozon、WB 或 Yandex 扣掉的钱，包含佣金和已纳入的平台相关费用。", example: "平台计费价 1249 ₽ - 平台扣费 652 ₽ = 到手回款 597 ₽。" },
      { term: "有效销售数量", desc: "扣掉货损率后预计真正能卖出去的数量。", example: "100 件 × 97% = 97 件有效销售数量。" },
    ],
  },
  {
    section: "税务与现金流",
    items: [
      { term: "本月经营利润", desc: "某个月按销售回款、成本、费用和税算出来的经营利润。", example: "30万 ₽ 回款 - 15万 ₽ 成本 - 5万 ₽ 费用 - 2万 ₽ 税 = 8万 ₽。" },
      { term: "账上累计现金", desc: "从 M0 到每个月末滚动计算的现金余额。", example: "负数表示还没回本，正数表示账上现金已转正。" },
      { term: "本月适用税制", desc: "这个月实际套用的税制，包含超过门槛后触发增值税（VAT）的情况。", example: "年收入超过 20M ₽ 后，模型会提示 VAT 档变化。" },
    ],
  },
];

const GLOSSARY = {
  zh: GLOSSARY_SECTIONS,
  en: GLOSSARY_SECTIONS,
  ru: GLOSSARY_SECTIONS,
};

const GlossaryPanel = ({ totals, params, proj, projection, fmt, t, lang }) => {
  const data = GLOSSARY[lang] || GLOSSARY.zh;
  const titles = { zh: "术语说明 - 指标怎么读", en: "术语说明 - 指标怎么读", ru: "术语说明 - 指标怎么读" };
  const hints = { zh: "每个指标都配了白话解释和一个小例子，方便新人、老板和供应商一起看。", en: "每个指标都配了白话解释和一个小例子，方便新人、老板和供应商一起看。", ru: "每个指标都配了白话解释和一个小例子，方便新人、老板和供应商一起看。" };

  return (
    <div className="space-y-6 anim-in">
      <div>
        <h2 className="font-display text-2xl font-semibold">{titles[lang] || titles.zh}</h2>
        <p className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{hints[lang] || hints.zh}</p>
      </div>
      <MetricBasisNote totals={totals} params={params} proj={proj} projection={projection} fmt={fmt} />
      {data.map((sec, si) => (
        <Card key={si} title={sec.section}>
          <div className="space-y-0">
            {sec.items.map((item, ii) => (
              <div key={ii} className="py-3 border-b last:border-b-0 row-glow" style={{ borderColor: COLORS.line }}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-display font-semibold text-sm" style={{ color: COLORS.ink }}>{item.term}</div>
                    <div className="text-xs mt-1" style={{ color: COLORS.inkSoft }}>{item.desc}</div>
                  </div>
                </div>
                {item.example && (
                  <div className="mt-2 p-2.5 text-xs font-mono whitespace-pre-line" style={{ background: COLORS.paper, color: COLORS.ink, borderLeft: `3px solid ${COLORS.gold}` }}>
                    示例：{item.example}
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
