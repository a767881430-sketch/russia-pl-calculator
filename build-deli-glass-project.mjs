import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = path.dirname(fileURLToPath(import.meta.url));
const siteBase = process.env.PUBLIC_BASE_URL || "/russia-pl-calculator/";

const exchangeRate = 12.8;
const months = 12;
// 默认销量不是平均分摊：前期冷启动较低，10-12月按俄罗斯玻璃餐厨旺季加权。
const sellCurve = [0.03, 0.04, 0.05, 0.06, 0.06, 0.07, 0.08, 0.08, 0.10, 0.13, 0.16, 0.14];
const restockCurves = {
  scale: [0.25, 0, 0, 0, 0.15, 0, 0.16, 0, 0.18, 0, 0.15, 0.11, 0],
  watch: [0.50, 0, 0, 0, 0, 0, 0.30, 0, 0, 0, 0.20, 0, 0],
  validate: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const priceCurves = {
  scale: [0.88, 0.90, 0.94, 0.97, 1.00, 1.00, 1.02, 1.04, 1.05, 1.06, 1.10, 1.08],
  watch: [0.90, 0.92, 0.95, 0.98, 1.00, 1.00, 1.03, 1.05, 1.06, 1.08, 1.12, 1.10],
  validate: [0.92, 0.92, 0.96, 0.98, 1.00, 1.00, 1.00, 1.03, 1.05, 1.05, 1.08, 1.06],
};

const tierBySku = new Map([
  ["TY1628", "scale"],
  ["TY1640", "scale"],
  ["TS5163", "scale"],
  ["TKB512", "scale"],
  ["TZ2829", "scale"],
  ["TZ3052", "scale"],
  ["TZ4306", "scale"],
  ["TY1628T", "scale"],
  ["TY1640T", "scale"],
  ["TZ2829-T", "scale"],
  ["TGD1911", "scale"],
  ["TBT001", "scale"],
  ["TCF053-L12", "watch"],
  ["TCF9003-L12", "watch"],
  ["TCF057-L12", "watch"],
  ["TR502-L7", "watch"],
  ["TKB508-L5", "watch"],
]);

const sku = [
  ["TY1628", "基础水杯6只装", 18, 15, 18000, 0.95, 1690, 0.56, 105, 39],
  ["TY1640", "大容量水杯4只装", 22, 18, 14000, 1.00, 2090, 0.56, 120, 48],
  ["TS5163", "轻量水杯6只装", 16, 13, 12000, 0.82, 1390, 0.56, 100, 36],
  ["TKB512", "小杯茶水杯6只装", 12, 10, 10000, 0.62, 1190, 0.56, 85, 30],
  ["TZ2829", "玻璃马克杯2只装", 16, 14, 12000, 0.72, 1690, 0.55, 105, 36],
  ["TZ3052", "中容量马克杯2只装", 20, 17, 8000, 0.86, 1690, 0.56, 115, 45],
  ["TZ4306", "大容量马克杯2只装", 24, 20, 7000, 1.02, 1890, 0.56, 130, 51],
  ["TCF053-L12", "咖啡杯碟12件套", 95, 75, 2500, 2.90, 6490, 0.57, 280, 120],
  ["TCF9003-L12", "咖啡杯碟12件套230ml", 110, 88, 2200, 3.25, 6290, 0.57, 310, 138],
  ["TCF057-L12", "咖啡杯碟12件套275ml", 125, 100, 1800, 3.60, 6990, 0.57, 340, 150],
  ["TR502-L7", "壶杯套装1壶6杯", 82, 65, 2200, 3.20, 5490, 0.60, 290, 108],
  ["TKB508-L5", "壶杯套装1壶4杯", 68, 54, 2500, 2.60, 3890, 0.57, 260, 90],
  ["TY1628T", "花色水杯6图案", 23, 18, 6000, 0.98, 1990, 0.56, 120, 51],
  ["TY1640T", "花色大杯4图案", 28, 22, 5000, 1.08, 2290, 0.56, 135, 60],
  ["TZ2829-T", "花色马克杯2只装", 22, 18, 6000, 0.82, 1890, 0.55, 120, 48],
  ["TZ301-470T", "创意文字杯礼盒", 20, 16, 4000, 0.88, 1790, 0.56, 115, 45],
  ["TGD1911", "糖罐储物2件套", 18, 15, 5000, 0.76, 1590, 0.56, 110, 39],
  ["TBT001", "玻璃储物罐950ml", 20, 16, 5000, 0.92, 1690, 0.56, 125, 42],
  ["TK518", "高脚小杯6只装", 18, 14, 1800, 1.05, 1690, 0.57, 140, 39],
  ["TR509", "分酒器1000ml礼盒", 42, 34, 1600, 1.75, 2990, 0.57, 200, 66],
  ["TF206-100B", "小酒杯6只装", 14, 11, 1800, 0.68, 1290, 0.56, 95, 30],
  ["TYG1207", "玻璃烟缸单只", 10, 8, 2400, 0.55, 990, 0.55, 70, 24],
];

const tierQtyBase = {
  scale: 1,
  watch: 0.5,
  validate: 0.25,
};

const scenarioDefinitions = [
  {
    slug: "conservative",
    projectName: "德力玻璃俄罗斯电商首批22款产品_A保守试水",
    scenarioLabel: "A 模型 · 保守试水",
    oneTimeCostsCNY: 380000,
    qtyFactor: { scale: 0.45, watch: 0.55, validate: 0.6 },
    note: "保守试水版：控制首批现金占用，验证款以样品、目录现货或最低起订量为主，只在核心款出现稳定转化后补货。",
  },
  {
    slug: "standard",
    projectName: "德力玻璃俄罗斯电商首批22款产品_B标准启动",
    scenarioLabel: "B 模型 · 标准启动",
    oneTimeCostsCNY: 760000,
    qtyFactor: { scale: 1, watch: 1, validate: 1 },
    note: "标准启动版：22 款建档验证，12 个跑量款多次补货，5 个利润/高客单款小补一次，5 个测品款不默认补货。",
  },
  {
    slug: "aggressive",
    projectName: "德力玻璃俄罗斯电商首批22款产品_C进取放量",
    scenarioLabel: "C 模型 · 进取放量",
    oneTimeCostsCNY: 1800000,
    qtyFactor: { scale: 2.1, watch: 1.6, validate: 1.2 },
    note: "进取放量版：核心款按 Ozon + WB 同步放量准备，利润/高客单款放大验证，测品款仍不作为默认补货款。",
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
  return Math.max(1, Math.round(value / 10) * 10);
}

function buildProducts(definition) {
  return sku.map(([id, title, priceCNY, declaredCNY, qty, weight, list, feePct, warehouse, mgmt]) => {
  const launchTier = tierBySku.get(id) || "validate";
  const plannedQty = Math.max(1, Math.round(qty * tierQtyBase[launchTier] * definition.qtyFactor[launchTier]));
  return {
    id: `${id}_${title}`,
    priceCNY,
    declaredCNY,
    qty: plannedQty,
    launchTier,
    weight,
    list,
    feePct,
    platformFee: Math.round(list * feePct),
    warehouse,
    mgmt,
    shippingMode: "manual",
  };
  });
}

function buildPriceSchedule(products) {
  return Object.fromEntries(products.map((product) => {
    const curve = priceCurves[product.launchTier] || priceCurves.validate;
    const list = curve.map((factor) => roundRub(product.list * factor));
    const fee = list.map((price) => Math.round(price * product.feePct));
    return [product.id, { list, fee }];
  }));
}

const standardDef = scenarioDefinitions.find((definition) => definition.slug === "standard");
const products = buildProducts(standardDef);

const scheduleStore = Object.fromEntries(products.map((product) => [product.id, allocate(product.qty, sellCurve)]));
const restockStore = Object.fromEntries(products.map((product) => [product.id, allocate(product.qty, restockCurves[product.launchTier] || restockCurves.validate)]));
const priceScheduleStore = buildPriceSchedule(products);

const project = {
  projectName: standardDef.projectName,
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
    oneTimeCosts: standardDef.oneTimeCostsCNY * exchangeRate,
  },
  products,
  scheduleStore,
  priceScheduleStore,
  restockStore,
  withdrawalStore: { amounts: Array(months).fill(0) },
  projection: {
    monthsHorizon: months,
    partnerSharePct: 50,
    monthlyFixedCost: 0,
    autoVATEscalation: true,
    priorYearRevenue: 0,
  },
  notes: [
    "商品 list 为卖家标价口径，不是买家到手价。",
    "竞品买家价约 500 RUB 时，卖家标价可按约 714-999 RUB 反推。",
    "platformFee 字段为平台综合成本，不是单一佣金；包含佣金、支付/收单、平台配送、退货逆向、广告促销预留等综合扣减，本版按 55%-60% 承压口径。",
    "本版已加入月度售价排期和淡旺季销量曲线：M1-M3 为冷启动低销量，M4-M9 逐步放大，M10-M12 按俄罗斯玻璃餐厨旺季加权；不是按全年平均分摊。",
    "当前 A/B/C 模型为不含到俄运费版本：未计入中国至俄罗斯头程、出口报关、俄罗斯清关、保险、尾程派送和平台仓入仓费用；待工厂与货代报价后重算。",
    "labelingPerUnit 当前设为 0：贴标/本地化暂不计入利润测算，后续若采用俄文贴标或彩盒需由工厂单独报价；shippingPerUnit 当前故意留空为 0，不参与利润测算。",
    "经营净利不含 oneTimeCosts；项目净利和现金流已扣除 oneTimeCosts。",
    "本版采用建档验证 + 二次备货口径：跑量款多次补货，利润/高客单款只允许一次小补货，测品款只做最低起订量或样品验证，不默认补货。",
    "测品款不是预测卖不了，而是用于验证搜索需求、破损风险、价格天花板和是否值得进入第二批。",
    "本版备货量等于 12 个月计划销售量，不额外压尾货；5% 破损率在收入端扣减。",
    "首批投测按标准启动情景：Ozon 测款，形成 8-12 个稳定产品后复制到 WB。",
    standardDef.note,
    "计算到俄物流前，需取得每个销售单位毛重、销售单位包装尺寸、外箱尺寸、外箱毛重、每箱套数、交货条件（EXW/FOB/FCA）、运输路线、清关/VAT/保险/尾程/平台仓预约是否包含、入仓城市和运输破损责任规则。",
    "未取得工厂正式报价、装箱尺寸、毛重、货代报价与跌落测试前，本项目为测算版。",
  ],
};

function buildProject(definition) {
  if (definition.slug === "standard") return project;
  const scenarioProducts = buildProducts(definition);
  return {
    ...project,
    projectName: definition.projectName,
    params: {
      ...project.params,
      oneTimeCosts: definition.oneTimeCostsCNY * exchangeRate,
    },
    products: scenarioProducts,
    scheduleStore: Object.fromEntries(scenarioProducts.map((product) => [product.id, allocate(product.qty, sellCurve)])),
    priceScheduleStore: buildPriceSchedule(scenarioProducts),
    restockStore: Object.fromEntries(scenarioProducts.map((product) => [product.id, allocate(product.qty, restockCurves[product.launchTier] || restockCurves.validate)])),
    notes: project.notes.map((note) => note === standardDef.note ? definition.note : note),
  };
}

function makeShareUrl(projectData) {
  const compact = {
    projectName: projectData.projectName,
    p: Object.fromEntries(
      Object.entries(projectData.params).filter(([, value]) => value !== undefined && value !== null)
    ),
    pr: projectData.products,
    pj: projectData.projection,
    ss: projectData.scheduleStore,
    ps: projectData.priceScheduleStore,
    rs: projectData.restockStore,
    ws: projectData.withdrawalStore,
  };
  const sharePayload = gzipSync(Buffer.from(JSON.stringify(compact), "utf8")).toString("base64");
  return `${siteBase}#share=${encodeURIComponent(sharePayload)}`;
}

function makeProjectUrl(definition) {
  return `${siteBase}?project=deli-glass-russia-22sku-${definition.slug}-project.json`;
}

const publicDir = path.join(root, "public");
const linkLines = [];
for (const definition of scenarioDefinitions) {
  const scenarioProject = buildProject(definition);
  const out = path.join(publicDir, `deli-glass-russia-22sku-${definition.slug}-project.json`);
  await fs.writeFile(out, `${JSON.stringify(scenarioProject, null, 2)}\n`, "utf8");
  const shareUrl = makeShareUrl(scenarioProject);
  await fs.writeFile(path.join(publicDir, `deli-glass-russia-22sku-${definition.slug}-share-url.txt`), `${shareUrl}\n`, "utf8");
  linkLines.push(`${definition.scenarioLabel}\n${makeProjectUrl(definition)}\n${shareUrl}\n`);
  if (definition.slug === "standard") {
    await fs.writeFile(path.join(publicDir, "deli-glass-russia-22sku-project.json"), `${JSON.stringify(scenarioProject, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(publicDir, "deli-glass-russia-22sku-share-url.txt"), `${shareUrl}\n`, "utf8");
  }
  console.log(out);
}

const scenarioLinksHtml = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>德力玻璃俄罗斯电商 · 三种损益模型</title>
<style>
body{font-family:system-ui,"Noto Sans SC",sans-serif;background:#f6f0e6;color:#1c1813;margin:0;padding:40px}
main{max-width:880px;margin:auto}
h1{font-family:Georgia,"Noto Serif SC",serif;font-weight:500}
.card{background:white;border:1px solid #d8cab6;padding:22px;margin:16px 0}
a{color:#8a3f16;font-weight:700}
p{line-height:1.7;color:#5d5145}
</style>
<main>
<h1>德力玻璃俄罗斯电商 · 三种损益模型</h1>
<p>三套模型都已加入月度售价排期和淡旺季销量曲线：前期冷启动较低，10-12月按俄罗斯玻璃餐厨旺季加权；不是按全年平均分摊。</p>
<p><strong>这些金额不是市场价，也不是工厂报价。</strong>它们是资金准备测算：首批库存采购按当前模型预估供货价计算，样品、包装、跌落测试、合规资料、到俄物流、清关、保险和入仓都需要工厂或货代报价后替换；广告、破损赔付和现金流储备属于周转缓冲。</p>
<p><strong>当前为不含到俄运费版本：</strong>未计入中国至俄罗斯头程、清关、保险、尾程派送和平台仓入仓费用；贴标/本地化也暂不计入。到俄物流与本地化处理需等工厂装箱参数、包装方案和货代报价后重算。</p>
${scenarioDefinitions.map((definition) => `<section class="card"><h2>${definition.scenarioLabel.replace("Scenario ", "")}</h2><p>${definition.note}</p><a href="${makeProjectUrl(definition)}">打开 ${definition.scenarioLabel.replace("Scenario ", "")} 损益表</a></section>`).join("\n")}
</main>
</html>`;
await fs.writeFile(path.join(publicDir, "deli-glass-russia-22sku-scenarios.html"), scenarioLinksHtml, "utf8");
await fs.writeFile(path.join(publicDir, "deli-glass-russia-22sku-scenario-share-urls.txt"), `${linkLines.join("\n")}\n`, "utf8");
