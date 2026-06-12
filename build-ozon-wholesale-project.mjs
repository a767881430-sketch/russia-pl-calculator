import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const siteBase = process.env.PUBLIC_BASE_URL || "/russia-pl-calculator/";
const exchangeRate = 13;
const months = 3;
const sellCurve = [0.20, 0.35, 0.45];
const monthlyStoreRentCNY = 3000;

const baseBundles = [
  ["PLUSH_KEYCHAIN_BUNDLE", "毛绒挂件组合装", 999, 300, 0.12, 0.58, 0.25, 25, 15],
  ["KEYCHAIN_MULTI_PACK", "钥匙扣多件装", 699, 400, 0.08, 0.58, 0.25, 18, 12],
  ["CLEANING_BRUSH_SET", "洗碗刷清洁刷套装", 799, 350, 0.18, 0.57, 0.25, 22, 14],
  ["SINK_FILTER_PACK", "水槽过滤网多件装", 699, 350, 0.12, 0.58, 0.25, 18, 12],
  ["PEELER_SET", "削皮器刨皮刀组合", 799, 250, 0.12, 0.57, 0.25, 20, 14],
  ["KITCHEN_TOOL_BUNDLE", "果蔬切厨房工具组合", 999, 180, 0.30, 0.56, 0.25, 35, 18],
  ["EGG_SLICER_SET", "鸡蛋切补充款", 699, 120, 0.16, 0.57, 0.25, 20, 12],
  ["TOILET_BRUSH_TRIAL", "马桶刷小批测试", 1299, 80, 0.55, 0.56, 0.28, 60, 25],
  ["STORAGE_OIL_TRIAL", "储物罐油壶谨慎测试", 1499, 60, 0.75, 0.56, 0.28, 75, 30],
];

const scenarios = [
  {
    slug: "conservative",
    label: "A 保守试销",
    projectName: "OZON俄罗斯本地现货供给合作_A保守试销_经营口径",
    qtyFactor: 1,
    monthlyFixedCostCNY: monthlyStoreRentCNY,
    note: "保守版：首批验证核心小件/组合装，重点观察商品卡转化、广告效率、客服与履约反馈。",
  },
  {
    slug: "standard",
    label: "B 标准启动",
    projectName: "OZON俄罗斯本地现货供给合作_B标准启动_经营口径",
    qtyFactor: 1.9,
    monthlyFixedCostCNY: monthlyStoreRentCNY,
    note: "标准版：按50个左右SKU组织阶段化试销，第3个月GMV进入120万-200万RUB区间后评估扩展空间。",
  },
  {
    slug: "scale",
    label: "C 放量验证",
    projectName: "OZON俄罗斯本地现货供给合作_C放量验证_经营口径",
    qtyFactor: 4,
    monthlyFixedCostCNY: monthlyStoreRentCNY,
    note: "放量版：适用于供货价、补货稳定性、换款机制和售后责任边界更清晰的合作情景。",
  },
];

function allocate(total, curve) {
  const raw = curve.map((part) => Math.floor(total * part));
  let diff = total - raw.reduce((sum, value) => sum + value, 0);
  for (let i = raw.length - 1; diff > 0; i = (i - 1 + raw.length) % raw.length) {
    raw[i] += 1;
    diff -= 1;
  }
  return raw;
}

function roundRub(value) {
  return Math.max(1, Math.round(value));
}

function roundPrice(value) {
  return Math.max(1, Math.round(value / 10) * 10);
}

function buildProducts(scenario) {
  return baseBundles.map(([sku, title, list, baseQty, weight, feePct, supplyPct, warehouse, ops]) => {
    const qty = Math.max(1, Math.round(baseQty * scenario.qtyFactor));
    const supplySettlement = roundRub(list * supplyPct);
    return {
      id: `${sku}_${title}`,
      priceCNY: 0,
      declaredCNY: 0,
      qty,
      launchTier: "trial",
      weight,
      list,
      feePct,
      platformFee: roundRub(list * feePct),
      warehouse,
      mgmt: supplySettlement + ops,
      shippingMode: "manual",
    };
  });
}

function buildPriceSchedule(products) {
  return Object.fromEntries(products.map((product) => {
    const list = [0.95, 1, 1.03].map((factor) => roundPrice(product.list * factor));
    const fee = list.map((price) => roundRub(price * product.feePct));
    return [product.id, { list, fee }];
  }));
}

function buildProject(scenario) {
  const products = buildProducts(scenario);
  const scheduleStore = Object.fromEntries(products.map((product) => [product.id, allocate(product.qty, sellCurve)]));
  const restockStore = Object.fromEntries(products.map((product) => [product.id, [product.qty, 0, 0, 0]]));
  const priceScheduleStore = buildPriceSchedule(products);

  return {
    projectName: scenario.projectName,
    params: {
      exchangeRate,
      usdRate: 95,
      damageRate: 0.05,
      shippingPerUnit: 0,
      labelingPerUnit: 0,
      grayShipPrice: 0,
      whiteShipPrice: 0,
      taxScheme: "usn_15_vat5",
      vatRate: 0.22,
      profitTaxRate: 0.25,
      customTaxRate: 0.15,
      incomeBasis: "payout",
      oneTimeCosts: 0,
    },
    products,
    scheduleStore,
    priceScheduleStore,
    restockStore,
    withdrawalStore: { amounts: Array(months).fill(0) },
    projection: {
      monthsHorizon: months,
      partnerSharePct: 50,
      monthlyFixedCost: scenario.monthlyFixedCostCNY * exchangeRate,
      autoVATEscalation: true,
      priorYearRevenue: 0,
    },
    projectMeta: {
      type: "localWholesaleCooperation",
      monthlyFixedCostCNY: scenario.monthlyFixedCostCNY,
      monthlyFixedCostRUB: scenario.monthlyFixedCostCNY * exchangeRate,
      sharePct: 50,
      basis: "经营口径：不买断库存，供货结算占位进入单件mgmt；广告预留在平台综合费用里，店铺月租按固定费用进入现金流预测。",
      recommendation: "当前不设置大额一次性运营投入；重点看商品经营净利、每月3000 RMB店铺月租后的现金流和供货价替换后的利润敏感性。",
    },
    notes: [
      "合作口径：俄罗斯当地批发老板供货，运营侧提供OZON上架、俄语内容、广告、客服、销售复盘和扩展策略。",
      "收益口径：本模型用于测算项目经营净利与权益分配弹性。",
      "本项目按寄售/联营逻辑建模：priceCNY填0，避免把货主库存误算成运营侧现金采购投入。",
      "mgmt字段包含供货结算占位价和单件运营处理费；供货结算占位价按卖家标价的25%-28%估算，拿到老板真实供货价后必须替换。",
      "platformFee为OZON综合平台负担估算，覆盖佣金、平台物流/履约、支付、退货、促销和广告消耗的综合扣减，不等同于单一佣金。",
      "warehouse字段为本地处理、仓储、打包和尾程相关占位费；真实尺寸重量和OZON物流费出来后要替换。",
      "买家热卖价通常是卖家标价的60%-70%，且1卢布明星产品不作为正常售价参考。",
      "低价单件模型不成立，必须优先做组合装、多件装或提高客单价到699-999RUB以上。",
      `本计算器为经营口径：不设置大额一次性启动费；店铺月租按${scenario.monthlyFixedCostCNY.toLocaleString("zh-CN")} RMB/月进入现金流预测。`,
      "阶段化节奏：M1验证流程，M2筛选SKU，M3结合GMV、净利率、补货能力和售后责任评估扩展空间。",
      "合作资料：需取得供货价、可供数量、尺寸重量、退换货规则和补货周期，用于替换当前占位参数。",
      scenario.note,
    ],
  };
}

function makeShareUrl(projectData) {
  const compact = {
    projectName: projectData.projectName,
    p: projectData.params,
    pr: projectData.products,
    pj: projectData.projection,
    ss: projectData.scheduleStore,
    ps: projectData.priceScheduleStore,
    rs: projectData.restockStore,
    ws: projectData.withdrawalStore,
    pm: projectData.projectMeta,
  };
  const sharePayload = gzipSync(Buffer.from(JSON.stringify(compact), "utf8")).toString("base64");
  return `${siteBase}#share=${encodeURIComponent(sharePayload)}`;
}

function makeProjectUrl(scenario) {
  return `${siteBase}?project=ozon-wholesale-90day-${scenario.slug}-project.json`;
}

function estimateScenario(project) {
  const monthRows = Array.from({ length: months }, (_, monthIdx) => ({
    listGmv: 0,
    payout: 0,
    damageLoss: 0,
    expenses: 0,
    tax: 0,
    netProfit: 0,
    soldQty: 0,
  }));

  for (const product of project.products) {
    const schedule = project.scheduleStore[product.id];
    const prices = project.priceScheduleStore[product.id];
    for (let m = 0; m < months; m += 1) {
      const qty = schedule[m] || 0;
      const list = prices.list[m] || product.list;
      const fee = prices.fee[m] || product.platformFee;
      const payout = qty * (list - fee);
      const listGmv = qty * list * (1 - project.params.damageRate);
      const damageLoss = payout * project.params.damageRate;
      const expenses = qty * (1 - project.params.damageRate) * ((product.warehouse || 0) + (product.mgmt || 0));

      monthRows[m].listGmv += listGmv;
      monthRows[m].payout += payout;
      monthRows[m].damageLoss += damageLoss;
      monthRows[m].expenses += expenses;
      monthRows[m].soldQty += qty;
    }
  }

  for (const row of monthRows) {
    const fixedCost = project.projection.monthlyFixedCost || 0;
    const incomeBase = row.payout - row.damageLoss;
    const outputVAT = row.listGmv * 0.05 / 1.05;
    const taxableIncome = Math.max(0, incomeBase - outputVAT - row.expenses - fixedCost);
    const tax = outputVAT + Math.max(taxableIncome * 0.15, (incomeBase - outputVAT) * 0.01);
    row.fixedCost = fixedCost;
    row.tax = tax;
    row.netProfit = row.payout - row.damageLoss - row.expenses - fixedCost - tax;
  }

  return monthRows.map((row, index) => ({
    month: `M${index + 1}`,
    soldQty: Math.round(row.soldQty),
    listGmv: Math.round(row.listGmv),
    payout: Math.round(row.payout),
    expenses: Math.round(row.expenses),
    fixedCost: Math.round(row.fixedCost),
    tax: Math.round(row.tax),
    netProfit: Math.round(row.netProfit),
    partnerShare50: Math.round(row.netProfit * 0.5),
    partnerShare50CNY: Math.round(row.netProfit * 0.5 / exchangeRate),
    netMarginOnGmv: Number((row.netProfit / row.listGmv).toFixed(4)),
  }));
}

const linkLines = [];
const summary = [];

for (const scenario of scenarios) {
  const project = buildProject(scenario);
  const fileName = `ozon-wholesale-90day-${scenario.slug}-project.json`;
  const out = path.join(publicDir, fileName);
  const estimate = estimateScenario(project);
  project.withdrawalStore = { amounts: estimate.map((row) => Math.max(0, row.netProfit)) };
  const shareUrl = makeShareUrl(project);
  const m3 = estimate[2];

  await fs.writeFile(out, `${JSON.stringify(project, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(publicDir, `ozon-wholesale-90day-${scenario.slug}-share-url.txt`), `${shareUrl}\n`, "utf8");

  linkLines.push(`${scenario.label}
${makeProjectUrl(scenario)}
${shareUrl}
`);
  summary.push({
    scenario: scenario.label,
    projectFile: fileName,
    monthlyFixedCostCNY: scenario.monthlyFixedCostCNY,
    monthlyFixedCostRUB: scenario.monthlyFixedCostCNY * exchangeRate,
    operatingBasis: "经营口径：不设置大额一次性启动费；店铺月租按月固定费用进入现金流预测。",
    m3GmvRUB: m3.listGmv,
    m3NetProfitRUB: m3.netProfit,
    m3OwnerShareRUB: m3.partnerShare50,
    m3OwnerShareCNY: m3.partnerShare50CNY,
    m3NetMarginOnGmv: m3.netMarginOnGmv,
    monthlyEstimate: estimate,
  });

  if (scenario.slug === "standard") {
    await fs.writeFile(path.join(publicDir, "ozon-wholesale-90day-standard-project.json"), `${JSON.stringify(project, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(publicDir, "ozon-wholesale-90day-standard-share-url.txt"), `${shareUrl}\n`, "utf8");
  }

  console.log(`${scenario.label}: ${out}`);
}

await fs.writeFile(path.join(publicDir, "ozon-wholesale-90day-scenario-links.txt"), `${linkLines.join("\n")}\n`, "utf8");
await fs.writeFile(path.join(publicDir, "ozon-wholesale-90day-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(JSON.stringify(summary, null, 2));
