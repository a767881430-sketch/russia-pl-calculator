// ============================================================
// 国际化 (i18n) + 货币格式化 + 实时汇率
// ============================================================
import { useState, useEffect, useCallback, createContext, useContext } from "react";

// --- 翻译字典 ---
const DICT = {
  // === Header ===
  brandSub: { zh: "Cross-border P&L · Россия 2026", en: "Cross-border P&L · Russia 2026", ru: "Кросс-бордер P&L · Россия 2026" },
  brandTitle: { zh: "俄罗斯电商损益与现金流计算器", en: "Russia E-commerce P&L Calculator", ru: "Калькулятор P&L для маркетплейсов" },
  saveCloud: { zh: "保存数据", en: "Save", ru: "Сохранить" },
  saving: { zh: "保存中…", en: "Saving…", ru: "Сохранение…" },
  exportCSV: { zh: "导出 CSV", en: "Export CSV", ru: "Экспорт CSV" },
  resetSample: { zh: "重置样例", en: "Reset", ru: "Сброс" },
  saved: { zh: "✓ 已保存", en: "✓ Saved", ru: "✓ Сохранено" },
  saveFail: { zh: "保存失败", en: "Save failed", ru: "Ошибка сохранения" },
  loadedLocal: { zh: "已加载本地数据", en: "Local data loaded", ru: "Данные загружены" },

  // === Tabs ===
  tabDashboard: { zh: "总览仪表盘", en: "Dashboard", ru: "Обзор" },
  tabProducts: { zh: "商品明细", en: "Products", ru: "Товары" },
  tabSchedule: { zh: "销售排期", en: "Sales Schedule", ru: "График продаж" },
  tabProjection: { zh: "现金流预测", en: "Cash Flow", ru: "Денежный поток" },
  tabSettings: { zh: "参数与税制", en: "Settings & Tax", ru: "Настройки" },
  tabHelp: { zh: "税制说明", en: "Tax Guide", ru: "Налоговый гид" },

  // === Login ===
  loginTitle: { zh: "损益计算器", en: "P&L Calculator", ru: "Калькулятор P&L" },
  loginLabel: { zh: "访问密码", en: "Access Password", ru: "Пароль доступа" },
  loginPlaceholder: { zh: "请输入密码", en: "Enter password", ru: "Введите пароль" },
  loginButton: { zh: "进入系统", en: "Enter", ru: "Войти" },
  loginError: { zh: "密码错误，请重试", en: "Wrong password", ru: "Неверный пароль" },
  loginFooter: { zh: "星哈酷 · 投资效益分析工具", en: "XingHaKu · Investment Analytics", ru: "XingHaKu · Аналитика инвестиций" },

  // === Dashboard Metrics ===
  totalRevenue: { zh: "总营收", en: "Total Revenue", ru: "Общая выручка" },
  totalInvestment: { zh: "总投资", en: "Total Investment", ru: "Инвестиции" },
  cashNetProfit: { zh: "现金净利", en: "Net Profit", ru: "Чистая прибыль" },
  roiLabel: { zh: "ROI / 投资回报", en: "ROI", ru: "ROI" },
  netMargin: { zh: "净利率", en: "Net Margin", ru: "Маржа" },
  bookNetProfit: { zh: "账面净利", en: "Book Net Profit", ru: "Бух. прибыль" },

  // === Dashboard Cards ===
  cumCashTitle: { zh: "累积现金流", en: "Cumulative Cash Flow", ru: "Накопленный кэш" },
  cumCashKicker: { zh: "Cumulative Cash", en: "Cumulative Cash", ru: "Кумулятивный кэш" },
  investorTitle: { zh: "投资人关注", en: "Investor Metrics", ru: "Метрики инвестора" },
  investorKicker: { zh: "Investor Metrics", en: "Investor Metrics", ru: "Инвестор" },
  initialOutflow: { zh: "初始投入", en: "Initial Outflow", ru: "Начальные вложения" },
  maxDrawdown: { zh: "最大资金压力", en: "Max Drawdown", ru: "Макс. просадка" },
  finalCash: { zh: "期末现金", en: "Final Cash", ru: "Итоговый кэш" },
  avgMonthly: { zh: "平均月回款", en: "Avg Monthly Revenue", ru: "Сред. месяц. выручка" },
  monthlyPnL: { zh: "月度净利分布", en: "Monthly P&L", ru: "Помесячная прибыль" },
  monthlyPnLKicker: { zh: "Monthly P&L", en: "Monthly P&L", ru: "Помесячно" },

  // === Break Even ===
  breakEvenMsg: { zh: "第 {n} 个月回本（达成盈亏平衡）", en: "Break even in month {n}", ru: "Окупаемость за {n} мес." },
  noBreakEven: { zh: "预测期内未回本，可调整销售排期或延长预测期", en: "No break-even within forecast period", ru: "Не окупается в прогнозном периоде" },

  // === Cost Structure ===
  costStructure: { zh: "成本结构", en: "Cost Structure", ru: "Структура затрат" },
  costKicker: { zh: "Cost Structure", en: "Cost Structure", ru: "Затраты" },
  costProcure: { zh: "采购+到俄运输", en: "Procurement + Shipping", ru: "Закупка + Доставка" },
  costWarehouse: { zh: "海外仓", en: "Warehouse", ru: "Склад" },
  costMgmt: { zh: "管理费", en: "Management", ru: "Управление" },
  costTax: { zh: "税", en: "Tax", ru: "Налоги" },
  costOneTime: { zh: "一次性费用", en: "One-time Costs", ru: "Разовые расходы" },
  costNetProfit: { zh: "净利润", en: "Net Profit", ru: "Чистая прибыль" },

  // === Tax Structure ===
  taxStructure: { zh: "税务结构", en: "Tax Breakdown", ru: "Структура налогов" },
  preTaxProfit: { zh: "税前利润", en: "Pre-tax Profit", ru: "Прибыль до налогов" },
  totalTax: { zh: "总税额", en: "Total Tax", ru: "Общий налог" },
  effectiveRate: { zh: "实际税负", en: "Effective Rate", ru: "Эффект. ставка" },

  // === Product Ranking ===
  rankingTitle: { zh: "商品盈利排行 (按ROI)", en: "Product Ranking (by ROI)", ru: "Рейтинг товаров (ROI)" },
  rankingKicker: { zh: "Profitability Ranking", en: "Profitability Ranking", ru: "Рейтинг" },

  // === Products Tab ===
  productsTitle: { zh: "商品明细", en: "Product Details", ru: "Детали товаров" },
  productCount: { zh: "{n} 个SKU", en: "{n} SKUs", ru: "{n} SKU" },
  productsHint: { zh: "点击行展开编辑（含申报价字段）。", en: "Click row to expand and edit.", ru: "Нажмите на строку для редактирования." },
  clearAll: { zh: "清空", en: "Clear", ru: "Очистить" },
  addProduct: { zh: "添加商品", en: "Add Product", ru: "Добавить" },
  productId: { zh: "产品ID", en: "Product ID", ru: "ID товара" },
  costCny: { zh: "实¥", en: "Cost ¥", ru: "Себест. ¥" },
  qty: { zh: "数量", en: "Qty", ru: "Кол-во" },
  listPrice: { zh: "售价₽", en: "List ₽", ru: "Цена ₽" },
  platformFee: { zh: "平台费", en: "Platform", ru: "Площадка" },
  warehouseFee: { zh: "仓费", en: "Storage", ru: "Склад" },
  mgmtFee: { zh: "管理", en: "Mgmt", ru: "Упр." },
  investment: { zh: "总投资", en: "Investment", ru: "Инвестиция" },
  revenue: { zh: "总营收", en: "Revenue", ru: "Выручка" },
  tax: { zh: "税", en: "Tax", ru: "Налог" },
  netProfitCol: { zh: "净利₽", en: "Profit", ru: "Прибыль" },
  roi: { zh: "ROI", en: "ROI", ru: "ROI" },
  action: { zh: "操作", en: "Action", ru: "Действие" },
  deleteBtn: { zh: "删除", en: "Delete", ru: "Удалить" },

  // === Schedule Tab ===
  scheduleTitle: { zh: "销售排期 · 按月预估销量", en: "Sales Schedule · Monthly Estimate", ru: "График продаж · Помесячно" },
  scheduleHint: { zh: "填入每个SKU每月预估销量。空白/零的列不会纳入费用。\"已分配\" 列会显示是否与备货量一致。", en: "Enter monthly estimated sales per SKU.", ru: "Введите плановые продажи по месяцам." },
  forecastMonths: { zh: "预测月数", en: "Forecast Months", ru: "Месяцев прогноза" },
  months: { zh: "个月", en: "months", ru: "мес." },
  filterSku: { zh: "一键匹配商品（输入匹配SKU）", en: "Filter SKUs", ru: "Фильтр SKU" },
  linearDist: { zh: "均匀平均", en: "Even", ru: "Равномерно" },
  frontload: { zh: "前重后轻", en: "Frontload", ru: "С начала" },
  bellCurve: { zh: "钟形曲线", en: "Bell Curve", ru: "Гаусс" },
  resetDist: { zh: "清空 (自动均分)", en: "Reset", ru: "Сброс" },
  sku: { zh: "SKU", en: "SKU", ru: "SKU" },
  total: { zh: "总量", en: "Total", ru: "Всего" },
  allocated: { zh: "已分配", en: "Allocated", ru: "Распред." },
  monthLabel: { zh: "M", en: "M", ru: "М" },

  // === Projection Tab ===
  projTitle: { zh: "现金流预测", en: "Cash Flow Forecast", ru: "Прогноз денежного потока" },
  currentMonth: { zh: "当前月份", en: "Current Month", ru: "Текущий месяц" },
  monthN: { zh: "第 {n} 月", en: "Month {n}", ru: "Месяц {n}" },
  maxInvestment: { zh: "最大资金占用", en: "Max Capital Required", ru: "Макс. вложения" },
  cashBalance: { zh: "最终净值", en: "Final Balance", ru: "Итоговый баланс" },
  totalProfit: { zh: "累计利润", en: "Total Profit", ru: "Общая прибыль" },
  vatThreshold: { zh: "VAT 触发阈值监控", en: "VAT Threshold Monitor", ru: "Мониторинг порога НДС" },
  vatAutoLabel: { zh: "营收过20M ₽自动触发VAT", en: "Auto-trigger VAT above 20M ₽", ru: "Авто НДС при выручке >20М ₽" },
  cumCashChart: { zh: "累积现金流（含投资支出）", en: "Cumulative Cash (incl. investment)", ru: "Накопленный кэш (с инвест.)" },
  monthlyNetProfit: { zh: "月度净利分布", en: "Monthly Net Profit", ru: "Помесячная прибыль" },
  projParams: { zh: "投测参数", en: "Projection Parameters", ru: "Параметры прогноза" },
  projMonths: { zh: "预测月数", en: "Forecast Months", ru: "Мес. прогноза" },
  partnerShare: { zh: "合伙人月度分成（按月净利）", en: "Partner Monthly Share", ru: "Доля партнёра" },
  fixedCost: { zh: "每月固定支出（薪资/工具）", en: "Monthly Fixed Cost", ru: "Пост. расходы/мес." },
  priorRevenue: { zh: "本年已累计营收（跨阈值用）", en: "Prior Year Revenue", ru: "Выручка за пред. период" },
  projNote: { zh: "月测据：按预先每月的销量分配（默认从均匀排期计算），营业附加费（VAT）自动与跨档计算程序挂钩。", en: "Projection based on monthly sales schedule. VAT auto-escalation linked to revenue thresholds.", ru: "Прогноз по графику продаж. НДС привязан к порогам выручки." },
  cashFlowDetail: { zh: "月度损益与现金流明细", en: "Monthly P&L & Cash Flow Detail", ru: "Помесячный P&L и кэш" },
  cashFlowWarning: { zh: "\"损益现金\" vs \"现金流明细\"两个不同视角", en: "Two different views: P&L vs Cash Flow", ru: "Два ракурса: P&L и Кэш" },

  // === Table Headers (Projection) ===
  thMonth: { zh: "月份", en: "Month", ru: "Месяц" },
  thSoldQty: { zh: "售出", en: "Sold", ru: "Продано" },
  thRevenue: { zh: "销售回款", en: "Revenue", ru: "Выручка" },
  thCogs: { zh: "销货成本", en: "COGS", ru: "Себест." },
  thExpenses: { zh: "仓储佣金", en: "Expenses", ru: "Расходы" },
  thGrossProfit: { zh: "毛利/税前", en: "Gross Profit", ru: "Валовая" },
  thTax: { zh: "税", en: "Tax", ru: "Налог" },
  thNetProfit: { zh: "当月净利", en: "Net Profit", ru: "Чист. приб." },
  thPartner: { zh: "合伙人", en: "Partner", ru: "Партнёр" },
  thCashFlow: { zh: "现金流", en: "Cash Flow", ru: "Кэш" },
  thCumCash: { zh: "累计现金", en: "Cum. Cash", ru: "Накоп. кэш" },
  initialRow: { zh: "初始（备货）", en: "Initial (Stock)", ru: "Начальные" },

  // === Settings Tab ===
  taxRegime: { zh: "俄罗斯税制选择", en: "Russian Tax Regime", ru: "Налоговый режим РФ" },
  taxRegimeKicker: { zh: "Tax Regime · 2026", en: "Tax Regime · 2026", ru: "Налоговый режим · 2026" },
  globalParams: { zh: "全局参数", en: "Global Parameters", ru: "Глобальные параметры" },
  globalParamsKicker: { zh: "Global Parameters", en: "Global Parameters", ru: "Параметры" },
  exchangeRate: { zh: "汇率（1元 → ? 卢布）", en: "Exchange Rate (1 CNY → ? RUB)", ru: "Курс (1 CNY → ? RUB)" },
  damageRate: { zh: "损耗率", en: "Damage Rate", ru: "Потери" },
  shippingPerUnit: { zh: "到俄运费/单品运费", en: "Shipping per Unit", ru: "Доставка за ед." },
  labelingCost: { zh: "贴标/标记 (Честный знак)", en: "Labeling (Chestny Znak)", ru: "Маркировка (Честный знак)" },
  oneTimeCosts: { zh: "首批一次性费用（设计/拍照/合规）", en: "One-time Setup Costs", ru: "Разовые расходы" },
  incomeBasis: { zh: "收入确认基础", en: "Income Recognition", ru: "Признание дохода" },
  incomeBasisKicker: { zh: "Income Recognition", en: "Income Recognition", ru: "Признание дохода" },
  basisPayout: { zh: "平台到手金额（M × 售价 − 平台费用）", en: "Platform Payout (M × Price − Fees)", ru: "Выплата площадки" },
  basisPayoutDesc: { zh: "实操推荐：以平台实际回款为税基入账。", en: "Recommended: use actual platform payout as tax base.", ru: "Рекомендуется: выплата площадки как налоговая база." },
  basisList: { zh: "全额上架价（M × 售价）", en: "Full List Price (M × Price)", ru: "Полная цена (М × Цена)" },
  basisListDesc: { zh: "最保守：把平台佣金大元加成入税, OSN 6% 下门槛会更高。", en: "Conservative: includes platform fees in tax base.", ru: "Консервативно: платформенные сборы в налоговую базу." },

  // === Footer ===
  footerText: { zh: "数据基于 联邦法 №425-FZ（2025.11.28，2026.1.1生效）。USN门槛 2026=20M / 2027=15M / 2028=10M ₽。", en: "Based on Federal Law №425-FZ (2025.11.28, effective 2026.1.1). USN thresholds: 2026=20M / 2027=15M / 2028=10M ₽.", ru: "По ФЗ №425-ФЗ (28.11.2025, с 01.01.2026). Пороги УСН: 2026=20М / 2027=15М / 2028=10М ₽." },
  footerDisclaimer: { zh: "本工具仅供测算参考，最终申报请咨询当地会计师。", en: "For estimation only. Consult a local accountant for filings.", ru: "Только для оценки. Обратитесь к бухгалтеру." },

  // === Exchange Rate ===
  liveRate: { zh: "实时汇率", en: "Live Rate", ru: "Курс онлайн" },
  rateUpdated: { zh: "汇率已更新", en: "Rate updated", ru: "Курс обновлён" },
  rateFailed: { zh: "汇率获取失败，使用手动值", en: "Rate fetch failed, using manual", ru: "Ошибка курса, ручной ввод" },
  rateManual: { zh: "手动", en: "Manual", ru: "Вручную" },
  rateLive: { zh: "实时", en: "Live", ru: "Онлайн" },

  // === Misc ===
  confirmClear: { zh: "确定清空所有商品？此操作不可撤销。", en: "Clear all products? This cannot be undone.", ru: "Очистить все товары? Это необратимо." },
  confirmReset: { zh: "重置为样例数据？当前编辑会丢失。", en: "Reset to sample data? Current edits will be lost.", ru: "Сбросить до примера? Текущие данные будут потеряны." },
  dualTrackNote: { zh: "在 USN 15% 或 OSN 下，税务局只认可有白关票据的\"报关申报\"成本。如果\"实际采购\"高于\"报关申报\"，差额部分将无法抵扣，会产生额外的税务损耗。", en: "Under USN 15% or OSN, only declared customs costs are deductible. If actual cost exceeds declared, the difference is non-deductible.", ru: "При УСН 15% или ОСН признаются только задекларированные таможенные расходы." },
};

// --- 创建翻译函数 ---
export const createT = (lang) => (key, params) => {
  const entry = DICT[key];
  if (!entry) return key;
  let text = entry[lang] || entry.zh || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
};

// --- 货币格式化工厂 ---
export const createCurrencyFormatter = (lang, exchangeRate) => {
  // 主币种（大字显示的）
  const primaryCurrency = lang === "ru" ? "RUB" : lang === "en" ? "USD" : "CNY";

  const fmtRub = (v, digits = 0) => "₽ " + (Number(v) || 0).toLocaleString("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  const fmtRubShort = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1e6) return "₽" + (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e3) return "₽" + (n / 1e3).toFixed(0) + "K";
    return "₽" + n.toFixed(0);
  };

  const fmtCny = (v) => "¥ " + (Number(v) || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtCnyShort = (v) => {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1e6) return "¥" + (n / 1e6).toFixed(2) + "M";
    if (Math.abs(n) >= 1e4) return "¥" + (n / 1e4).toFixed(1) + "万";
    return "¥" + n.toFixed(0);
  };

  const fmtPct = (v) => ((Number(v) || 0) * 100).toFixed(1) + "%";

  // 主显示金额（根据语言，以用户习惯的币种显示大字）
  const fmtPrimary = (rubValue) => {
    if (lang === "zh") return fmtCnyShort(rubValue / exchangeRate);
    return fmtRubShort(rubValue);
  };

  // 辅显示金额（小字副信息）
  const fmtSecondary = (rubValue) => {
    if (lang === "zh") return fmtRubShort(rubValue);
    return fmtCny(rubValue / exchangeRate);
  };

  return { fmtRub, fmtRubShort, fmtCny, fmtCnyShort, fmtPct, fmtPrimary, fmtSecondary };
};

// --- 实时汇率 Hook ---
export const useLiveRate = (manualRate) => {
  const [liveRate, setLiveRate] = useState(null);
  const [rateSource, setRateSource] = useState("manual"); // "manual" | "live"
  const [rateLoading, setRateLoading] = useState(false);

  const fetchRate = useCallback(async () => {
    setRateLoading(true);
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/CNY");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (data.result === "success" && data.rates?.RUB) {
        setLiveRate(parseFloat(data.rates.RUB.toFixed(2)));
        setRateSource("live");
      }
    } catch (e) {
      setRateSource("manual");
    } finally {
      setRateLoading(false);
    }
  }, []);

  useEffect(() => { fetchRate(); }, [fetchRate]);

  const effectiveRate = rateSource === "live" && liveRate ? liveRate : manualRate;

  return { liveRate, effectiveRate, rateSource, rateLoading, fetchRate, setRateSource };
};

// --- 语言名称 & emoji ---
export const LANG_OPTIONS = [
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "ru", label: "РУ", flag: "🇷🇺" },
];
