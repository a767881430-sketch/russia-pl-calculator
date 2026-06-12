import { PLATFORM_TARIFFS } from "./platformTariffs.js";

export const SALES_PLATFORMS = [
  {
    id: "ozon",
    label: "Ozon",
    short: "Ozon",
    defaultModel: "FBO",
    defaults: {
      commissionRate: 0.2,
      paymentRate: 0.015,
      baseFreight: 0,
      nonLocalRate: 0,
      fbsParcelHandling: 30,
      lastMile: 25,
      returnHandling: 15,
      acceptanceRatePct: 100,
      adRate: 0.1,
      otherFee: 0,
      supplyCluster: "Москва. МО и Дальние регионы",
      deliveryCluster: "Москва. МО и Дальние регионы",
    },
  },
  {
    id: "wb",
    label: "Wildberries",
    short: "WB",
    defaultModel: "FBW",
    defaults: {
      commissionRate: 0.28,
      paymentRate: 0.015,
      volumeLiters: 0,
      baseRate: 46,
      overLiterRate: 14,
      warehouseMultiplier: 1,
      localizationBand: "不计算",
      localizationCoef: 1,
      salesDistributionRate: 0,
      returnHandling: 46,
      acceptanceRatePct: 100,
      adRate: 0.06,
      fwbStoragePerLiterDay: 0.07,
      penaltyRate: 0.01,
      otherFee: 0,
    },
  },
  {
    id: "yandex",
    label: "Yandex Market",
    short: "Yandex",
    defaultModel: "FBY",
    defaults: {
      commissionRate: 0.315,
      acquiringFee: 0.12,
      paymentFrequency: "每月一次",
      paymentTransferRate: 0.013,
      lastMile: 0,
      orderProcessing: 30,
      avgDelivery: 0,
      returnHandling: 15,
      returnDelivery: 0,
      acceptanceRatePct: 100,
      fbyStorage: 0,
      adRate: 0.1,
      otherFee: 0,
      yandexCategory: "Все товары",
    },
  },
];

const PLATFORM_BY_ID = Object.fromEntries(SALES_PLATFORMS.map((platform) => [platform.id, platform]));

const TARIFF_MATCH_LABELS = {
  ozon: "Ozon 佣金表 B 列 + 最新基本运费表",
  wb: "WB 类目佣金表 B 列 + 本地化指数表",
  yandex: "Yandex 佣金路径 + 付款频率表",
};

const COMMISSION_MATCH_SOURCE_LABELS = {
  ozon: "Ozon 佣金表 B 列",
  wb: "WB 类目佣金表 B 列",
  yandex: "Yandex 佣金表类目路径",
};

export const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const normalizeRate = (value) => {
  const n = toNum(value, 0);
  return Math.abs(n) > 1 ? n / 100 : n;
};

const acceptanceFactor = (pct) => {
  const value = toNum(pct, 100);
  return value > 0 ? 100 / value : 1;
};

const norm = (value) => String(value || "").trim().toLocaleLowerCase();

const makeFirstMap = (rows, keyIndex) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = norm(row[keyIndex]);
    if (key && !map.has(key)) map.set(key, row);
  });
  return map;
};

const OZON_COMMISSION_BY_TYPE = makeFirstMap(PLATFORM_TARIFFS.ozon.commissions, 0);
const OZON_NON_LOCAL_BY_CLUSTER = new Map(PLATFORM_TARIFFS.ozon.nonLocal.map(([cluster, rate]) => [norm(cluster), rate]));
const OZON_FREIGHT_DATA = Array.isArray(PLATFORM_TARIFFS.ozon.freight)
  ? {
      volumeBands: Array.from(
        new Map(PLATFORM_TARIFFS.ozon.freight.map((row) => [row[1], [row[0], row[1]]])).values()
      ),
      clusters: PLATFORM_TARIFFS.ozon.clusters,
      rows: PLATFORM_TARIFFS.ozon.freight.map((row) => [
        row[1],
        PLATFORM_TARIFFS.ozon.clusters.indexOf(row[2]),
        PLATFORM_TARIFFS.ozon.clusters.indexOf(row[3]),
        row[5],
      ]),
      legacy: true,
    }
  : PLATFORM_TARIFFS.ozon.freight;
const OZON_CLUSTER_BY_NAME = new Map((OZON_FREIGHT_DATA.clusters || []).map((cluster, index) => [norm(cluster), index]));
const OZON_VOLUME_BAND_BY_TEXT = new Map((OZON_FREIGHT_DATA.volumeBands || []).map((row, index) => [row[1], index]));
const OZON_FREIGHT_BY_KEY = new Map(
  (OZON_FREIGHT_DATA.rows || []).map((row) => [`${row[0]}|${row[1]}|${row[2]}`, row])
);
const OZON_VOLUME_BANDS = (OZON_FREIGHT_DATA.volumeBands || [])
  .map(([from, text], index) => ({ from, text, index }))
  .sort((a, b) => a.from - b.from);

const WB_COMMISSION_BY_SUBCATEGORY = makeFirstMap(PLATFORM_TARIFFS.wb.commissions, 0);
const WB_LOCALIZATION_BY_BAND = new Map(PLATFORM_TARIFFS.wb.localization.map((row) => [norm(row[0]), row]));
const YANDEX_COMMISSION_BY_PATH = makeFirstMap(PLATFORM_TARIFFS.yandex.commissions, 0);
const YANDEX_PAYMENT_BY_FREQUENCY = new Map(
  PLATFORM_TARIFFS.yandex.paymentFrequencies.map(([label, rate]) => [norm(label), rate])
);

const lookupByName = (map, value) => {
  const direct = map.get(norm(value));
  if (direct) return direct;
  const lastPart = String(value || "").split("/").map((part) => part.trim()).filter(Boolean).pop();
  return lastPart ? map.get(norm(lastPart)) : undefined;
};

const pickPriceBucket = (price, buckets) => {
  let index = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    if (price >= buckets[i]) index = i;
  }
  return index;
};

const deriveVolumeLiters = (product = {}) => {
  const volL = toNum(product.volL, 0);
  const volW = toNum(product.volW, 0);
  const volH = toNum(product.volH, 0);
  if (volL > 0 && volW > 0 && volH > 0) return (volL * volW * volH) / 1000;
  return 0;
};

const calcWbRoundedVolume = (volume) => {
  const n = Math.max(0, toNum(volume, 0));
  return n <= 1 ? n : Math.ceil(n);
};

const getOzonVolumeText = (volumeLiters) => {
  const volume = Math.max(0, toNum(volumeLiters, 0));
  let match = OZON_VOLUME_BANDS[0]?.text || "";
  for (const band of OZON_VOLUME_BANDS) {
    if (volume >= band.from) match = band.text;
    else break;
  }
  return match;
};

const calcYandexDistanceFee = (volumeLiters) => {
  const v = Math.ceil(Math.max(0, toNum(volumeLiters, 0)));
  const part1 = v <= 1 ? 0 : v <= 30 ? (v - 1) * 9 : 29 * 9;
  const part2 = v <= 30 ? 0 : v <= 200 ? (v - 30) * 7 : 170 * 7;
  const part3 = v <= 200 ? 0 : (v - 200) * 5;
  return Math.min(80 + part1 + part2 + part3, 5500);
};

export function getProductPlatformConfigs(product = {}) {
  const hasExplicitPlatforms = product.platforms && typeof product.platforms === "object";
  const productVolumeLiters = deriveVolumeLiters(product);
  const configs = {};

  SALES_PLATFORMS.forEach((platform) => {
    const raw = hasExplicitPlatforms ? (product.platforms?.[platform.id] || {}) : {};
    const legacyOzon = platform.id === "ozon";
    const hasPlatformConfig = !!product.platforms?.[platform.id];
    const defaults = platform.defaults || {};
    const rawVolumeLiters = toNum(raw.volumeLiters, 0);
    const volumeLiters = productVolumeLiters > 0 ? productVolumeLiters : (rawVolumeLiters || defaults.volumeLiters || 0);

    configs[platform.id] = {
      platformId: platform.id,
      enabled: hasExplicitPlatforms ? (hasPlatformConfig ? !!raw.enabled : legacyOzon) : legacyOzon,
      salesShare: toNum(raw.salesShare, legacyOzon ? 100 : 0),
      model: raw.model || platform.defaultModel,
      list: toNum(raw.list, product.list || 0),
      platformFee: toNum(raw.platformFee, product.platformFee || 0),
      warehouse: toNum(raw.warehouse, product.warehouse || 0),
      mgmt: toNum(raw.mgmt, product.mgmt || 0),
      useFeeDetails: raw.useFeeDetails !== false,
      useTariffLookup: raw.useTariffLookup !== false,
      tariffCategory: raw.tariffCategory || raw.category || "",
      category: raw.category || raw.tariffCategory || "",
      ozonProductType: raw.ozonProductType || raw.tariffCategory || raw.category || "",
      wbSubcategory: raw.wbSubcategory || raw.tariffCategory || raw.category || "",
      yandexCategory: raw.yandexCategory || raw.tariffCategory || raw.category || defaults.yandexCategory || "",
      supplyCluster: raw.supplyCluster || defaults.supplyCluster || "",
      deliveryCluster: raw.deliveryCluster || defaults.deliveryCluster || "",
      localizationBand: raw.localizationBand || defaults.localizationBand || "",
      paymentFrequency: raw.paymentFrequency || defaults.paymentFrequency || "",
      commissionRate: normalizeRate(raw.commissionRate ?? defaults.commissionRate ?? 0),
      paymentRate: normalizeRate(raw.paymentRate ?? defaults.paymentRate ?? 0),
      baseFreight: toNum(raw.baseFreight ?? raw.logistics, defaults.baseFreight || defaults.logistics || 0),
      nonLocalRate: normalizeRate(raw.nonLocalRate ?? defaults.nonLocalRate ?? 0),
      fbsParcelHandling: toNum(raw.fbsParcelHandling ?? raw.fulfillment, defaults.fbsParcelHandling || defaults.fulfillment || 0),
      lastMile: toNum(raw.lastMile, defaults.lastMile || 0),
      returnHandling: toNum(raw.returnHandling ?? raw.returnReserve, defaults.returnHandling || defaults.returnReserve || 0),
      acceptanceRatePct: toNum(raw.acceptanceRatePct, defaults.acceptanceRatePct || 100),
      volumeLiters,
      baseRate: toNum(raw.baseRate, defaults.baseRate || 0),
      overLiterRate: toNum(raw.overLiterRate, defaults.overLiterRate || 0),
      warehouseMultiplier: toNum(raw.warehouseMultiplier, defaults.warehouseMultiplier || 1),
      localizationCoef: toNum(raw.localizationCoef, defaults.localizationCoef || 1),
      salesDistributionRate: normalizeRate(raw.salesDistributionRate ?? defaults.salesDistributionRate ?? 0),
      fwbStoragePerLiterDay: toNum(raw.fwbStoragePerLiterDay ?? raw.storage, defaults.fwbStoragePerLiterDay || defaults.storage || 0),
      penaltyRate: normalizeRate(raw.penaltyRate ?? defaults.penaltyRate ?? 0),
      acquiringFee: toNum(raw.acquiringFee, defaults.acquiringFee || 0),
      paymentTransferRate: normalizeRate(raw.paymentTransferRate ?? defaults.paymentTransferRate ?? 0),
      orderProcessing: toNum(raw.orderProcessing ?? raw.fulfillment, defaults.orderProcessing || defaults.fulfillment || 0),
      avgDelivery: toNum(raw.avgDelivery ?? raw.logistics, defaults.avgDelivery || defaults.logistics || 0),
      returnDelivery: toNum(raw.returnDelivery, defaults.returnDelivery || 0),
      fbyStorage: toNum(raw.fbyStorage ?? raw.storage, defaults.fbyStorage || defaults.storage || 0),
      adRate: normalizeRate(raw.adRate ?? defaults.adRate ?? 0),
      otherFee: toNum(raw.otherFee, defaults.otherFee || 0),
    };
  });

  if (!Object.values(configs).some((config) => config.enabled)) {
    configs.ozon.enabled = true;
    configs.ozon.salesShare = 100;
  }
  return configs;
}

export function calcPlatformFeeBreakdown(config) {
  const list = config.list || 0;
  const platformId = config.platformId;
  const useLookup = config.useTariffLookup !== false;
  let commissionRate = normalizeRate(config.commissionRate);
  let commissionMatched = false;
  let freightMatched = false;
  let note = "";

  if (platformId === "ozon") {
    const type = config.ozonProductType || config.tariffCategory || config.category;
    const hasVolume = toNum(config.volumeLiters, 0) > 0;
    const commissionRow = useLookup ? lookupByName(OZON_COMMISSION_BY_TYPE, type) : null;
    if (commissionRow) {
      const model = String(config.model || "").toUpperCase();
      const isRfbs = model.includes("RFBS");
      const rates = isRfbs ? commissionRow[3] : model.includes("FBS") ? commissionRow[2] : commissionRow[1];
      const buckets = isRfbs ? PLATFORM_TARIFFS.ozon.rfbsPriceBuckets : PLATFORM_TARIFFS.ozon.priceBuckets;
      commissionRate = normalizeRate(rates[Math.min(pickPriceBucket(list, buckets), rates.length - 1)]);
      commissionMatched = true;
    }

    const volumeText = getOzonVolumeText(config.volumeLiters);
    const volumeIndex = OZON_VOLUME_BAND_BY_TEXT.get(volumeText);
    const supplyIndex = OZON_CLUSTER_BY_NAME.get(norm(config.supplyCluster));
    const deliveryIndex = OZON_CLUSTER_BY_NAME.get(norm(config.deliveryCluster));
    const freightKey = `${volumeIndex}|${supplyIndex}|${deliveryIndex}`;
    const freightRow = useLookup && hasVolume ? OZON_FREIGHT_BY_KEY.get(freightKey) : null;
    const baseFreight = freightRow ? toNum(freightRow[3]) : (config.baseFreight || 0);
    freightMatched = !!freightRow;
    const nonLocalRate = config.supplyCluster === config.deliveryCluster
      ? 0
      : (OZON_NON_LOCAL_BY_CLUSTER.get(norm(config.deliveryCluster)) ?? normalizeRate(config.nonLocalRate));
    const bankFee = list * normalizeRate(config.paymentRate);
    const commission = list * commissionRate;
    const totalDeliveryFreight = baseFreight + list * nonLocalRate;
    const lastMile = Math.min(
      PLATFORM_TARIFFS.ozon.lastMileMax,
      Math.max(PLATFORM_TARIFFS.ozon.lastMileMin, list * PLATFORM_TARIFFS.ozon.lastMileRate)
    );
    const fbsHandling = String(config.model || "").toUpperCase() === "FBS" ? (config.fbsParcelHandling || 0) : 0;
    const fullDelivery = totalDeliveryFreight + lastMile + fbsHandling;
    const reverseLogistics = (config.returnHandling || 0) + baseFreight;
    const factor = acceptanceFactor(config.acceptanceRatePct);
    const logisticsTotal = Math.max(
      0,
      factor * fullDelivery +
      (factor - 1) * reverseLogistics -
      (factor - 1) * lastMile -
      (factor - 1) * (totalDeliveryFreight - baseFreight)
    );
    const adServices = list * normalizeRate(config.adRate);
    const total = commission + bankFee + logisticsTotal + adServices + (config.otherFee || 0);
    const lookupMatched = !useLookup || (commissionMatched && freightMatched && hasVolume);
    if (useLookup && !hasVolume) note = "请先填写商品长宽高，平台物流不能按 0 体积计算";
    else if (useLookup && !commissionMatched) note = "未匹配 Ozon 佣金表 B 列，暂用手填平台扣费";
    else if (useLookup && !freightMatched) note = "未匹配 Ozon 最新基本运费表 B/C/D 列，暂用手填平台扣费";
    return {
      total,
      lookupEnabled: useLookup,
      lookupMatched,
      tariffSource: TARIFF_MATCH_LABELS.ozon,
      commissionRate,
      commission,
      bankFee,
      baseFreight,
      nonLocalRate,
      lastMile,
      fbsHandling,
      logisticsTotal,
      adServices,
      storageFee: 0,
      penalty: 0,
      volumeText,
      commissionMatched,
      commissionMatchSource: COMMISSION_MATCH_SOURCE_LABELS.ozon,
      commissionMatchInput: type,
      commissionMatchValue: commissionRow?.[0] || "",
      freightMatched,
      note,
      missingInputs: useLookup ? [
        ...(hasVolume ? [] : ["商品长宽高/体积"]),
        ...(commissionMatched ? [] : ["Ozon 佣金表 B 列商品类型"]),
        ...(freightMatched ? [] : ["体积档位 + 供货集群 + 配送集群"]),
      ] : [],
    };
  }

  if (platformId === "wb") {
    const subcategory = config.wbSubcategory || config.tariffCategory || config.category;
    const hasVolume = toNum(config.volumeLiters, 0) > 0;
    const commissionRow = useLookup ? lookupByName(WB_COMMISSION_BY_SUBCATEGORY, subcategory) : null;
    if (commissionRow) {
      const model = String(config.model || "").toUpperCase();
      const col = model === "FBS" ? 2 : model === "DBW" ? 3 : model === "DBS" ? 4 : 1;
      commissionRate = normalizeRate(commissionRow[col]);
      commissionMatched = true;
    }

    const localizationRow = WB_LOCALIZATION_BY_BAND.get(norm(config.localizationBand));
    const localizationCoef = localizationRow ? toNum(localizationRow[1], 1) : (config.localizationCoef || 1);
    const salesDistributionRate = localizationRow ? normalizeRate(localizationRow[2]) : normalizeRate(config.salesDistributionRate);
    const bankFee = list * normalizeRate(config.paymentRate);
    const commission = list * commissionRate;
    const volume = calcWbRoundedVolume(config.volumeLiters);
    const baseRate = config.baseRate || 0;
    const overLiterRate = config.overLiterRate || 0;
    const multiplier = config.warehouseMultiplier || 1;
    const deliveryTariff = (baseRate + Math.max(0, volume - 1) * overLiterRate) * multiplier;
    const fullDelivery = localizationCoef * deliveryTariff + list * salesDistributionRate;
    const returnHandling = baseRate + Math.max(0, volume - 1) * overLiterRate;
    const factor = acceptanceFactor(config.acceptanceRatePct);
    const logisticsTotal = Math.max(0, factor * fullDelivery + (factor - 1) * returnHandling);
    const adServices = list * normalizeRate(config.adRate);
    const storageFee = String(config.model || "").toUpperCase() === "FBW" ? (config.fwbStoragePerLiterDay || 0) * volume * 30 * multiplier : 0;
    const penalty = list * normalizeRate(config.penaltyRate);
    const total = commission + bankFee + logisticsTotal + adServices + storageFee + penalty + (config.otherFee || 0);
    const lookupMatched = !useLookup || (commissionMatched && !!localizationRow && hasVolume);
    if (useLookup && !hasVolume) note = "请先填写商品长宽高，平台物流不能按 0 体积计算";
    else if (useLookup && !commissionMatched) note = "未匹配 WB 类目佣金表 B 列，暂用手填平台扣费";
    else if (useLookup && !localizationRow) note = "未匹配 WB 本地化指数表，暂用手填平台扣费";
    return {
      total,
      lookupEnabled: useLookup,
      lookupMatched,
      tariffSource: TARIFF_MATCH_LABELS.wb,
      commissionRate,
      commission,
      bankFee,
      volume,
      baseRate,
      overLiterRate,
      localizationCoef,
      salesDistributionRate,
      deliveryTariff,
      logisticsTotal,
      adServices,
      storageFee,
      penalty,
      commissionMatched,
      commissionMatchSource: COMMISSION_MATCH_SOURCE_LABELS.wb,
      commissionMatchInput: subcategory,
      commissionMatchValue: commissionRow?.[0] || "",
      localizationMatched: !!localizationRow,
      note,
      missingInputs: useLookup ? [
        ...(hasVolume ? [] : ["商品长宽高/体积"]),
        ...(commissionMatched ? [] : ["WB 类目佣金表 B 列子类目"]),
        ...(localizationRow ? [] : ["本地化指数区间"]),
      ] : [],
    };
  }

  if (platformId === "yandex") {
    const category = config.yandexCategory || config.tariffCategory || config.category || "Все товары";
    const hasVolume = toNum(config.volumeLiters, 0) > 0;
    const commissionRow = useLookup ? lookupByName(YANDEX_COMMISSION_BY_PATH, category) : null;
    if (commissionRow) {
      const model = String(config.model || "").toUpperCase();
      const col = model === "FBS" ? 2 : model === "DBS" ? 4 : model === "EXPRESS" ? 3 : 1;
      commissionRate = normalizeRate(commissionRow[col]);
      commissionMatched = true;
    }
    const commission = list * commissionRate;
    const acquiringFee = config.acquiringFee || 0;
    const paymentFrequencyMatched = YANDEX_PAYMENT_BY_FREQUENCY.has(norm(config.paymentFrequency));
    const transferRate = paymentFrequencyMatched ? YANDEX_PAYMENT_BY_FREQUENCY.get(norm(config.paymentFrequency)) : normalizeRate(config.paymentTransferRate);
    const paymentTransfer = list * transferRate;
    const lastMile = Math.min(list * 0.05, 1000);
    const orderProcessing = String(config.model || "").toUpperCase() === "FBS" ? (config.orderProcessing || 0) : 0;
    const avgDelivery = calcYandexDistanceFee(config.volumeLiters);
    const fullDelivery = String(config.model || "").toUpperCase() === "FBS"
      ? lastMile + orderProcessing + avgDelivery
      : lastMile + avgDelivery;
    const reverseLogistics = (config.returnHandling || 0) + avgDelivery;
    const factor = acceptanceFactor(config.acceptanceRatePct);
    const logisticsTotal = Math.max(0, factor * fullDelivery + (factor - 1) * reverseLogistics - (factor - 1) * lastMile);
    const storageFee = String(config.model || "").toUpperCase() === "FBY" ? 1.25 * 7 * Math.max(0, config.volumeLiters || 0) : 0;
    const adServices = list * normalizeRate(config.adRate);
    const total = commission + acquiringFee + paymentTransfer + logisticsTotal + storageFee + adServices + (config.otherFee || 0);
    const lookupMatched = !useLookup || (commissionMatched && paymentFrequencyMatched && hasVolume);
    if (useLookup && !hasVolume) note = "请先填写商品长宽高，平台物流不能按 0 体积计算";
    else if (useLookup && !commissionMatched) note = "未匹配 Yandex 佣金表类目路径，暂用手填平台扣费";
    else if (useLookup && !paymentFrequencyMatched) note = "未匹配 Yandex 付款频率表，暂用手填平台扣费";
    return {
      total,
      lookupEnabled: useLookup,
      lookupMatched,
      tariffSource: TARIFF_MATCH_LABELS.yandex,
      commissionRate,
      commission,
      acquiringFee,
      transferRate,
      paymentTransfer,
      lastMile,
      orderProcessing,
      avgDelivery,
      logisticsTotal,
      storageFee,
      adServices,
      commissionMatched,
      commissionMatchSource: COMMISSION_MATCH_SOURCE_LABELS.yandex,
      commissionMatchInput: category,
      commissionMatchValue: commissionRow?.[0] || "",
      paymentFrequencyMatched,
      note,
      missingInputs: useLookup ? [
        ...(hasVolume ? [] : ["商品长宽高/体积"]),
        ...(commissionMatched ? [] : ["Yandex 类目路径"]),
        ...(paymentFrequencyMatched ? [] : ["付款频率"]),
      ] : [],
    };
  }

  const commission = list * commissionRate;
  const bankFee = list * normalizeRate(config.paymentRate);
  const adServices = list * normalizeRate(config.adRate);
  const total = commission + bankFee + adServices + (config.baseFreight || 0) + (config.otherFee || 0);
  return { total, commissionRate, commission, bankFee, adServices, note };
}

export function calcPlatformDetailFee(config) {
  return calcPlatformFeeBreakdown(config).total;
}

export function calcPlatformUnitEconomics(config) {
  const detailBreakdown = calcPlatformFeeBreakdown(config);
  const detailFee = detailBreakdown.total;
  const canUseTariffFee = detailBreakdown.lookupMatched !== false;
  const feeSource = config.useFeeDetails
    ? (detailBreakdown.lookupEnabled === false ? "manualRateDetails" : (canUseTariffFee ? "tariff" : "manualFallback"))
    : "manual";
  const platformFee = config.useFeeDetails && canUseTariffFee ? detailFee : (config.platformFee || 0);
  const unitPayout = (config.list || 0) - platformFee;
  return {
    ...config,
    label: PLATFORM_BY_ID[config.platformId]?.label || config.platformId,
    short: PLATFORM_BY_ID[config.platformId]?.short || config.platformId,
    detailFee,
    detailBreakdown,
    feeSource,
    canUseTariffFee,
    platformFee,
    unitPayout,
  };
}

export function getEnabledPlatformEconomics(product = {}) {
  const configs = getProductPlatformConfigs(product);
  const enabled = SALES_PLATFORMS
    .map((platform) => calcPlatformUnitEconomics(configs[platform.id]))
    .filter((config) => config.enabled);
  const active = enabled.length ? enabled : [calcPlatformUnitEconomics(configs.ozon)];
  const shareSum = active.reduce((sum, config) => sum + Math.max(0, config.salesShare || 0), 0);
  return active.map((config) => ({
    ...config,
    weight: shareSum > 0 ? Math.max(0, config.salesShare || 0) / shareSum : 1 / active.length,
  }));
}

export function getProductPlatformAverages(product = {}) {
  const active = getEnabledPlatformEconomics(product);
  const avg = active.reduce((acc, config) => {
    acc.list += (config.list || 0) * config.weight;
    acc.platformFee += (config.platformFee || 0) * config.weight;
    acc.warehouse += (config.warehouse || 0) * config.weight;
    acc.mgmt += (config.mgmt || 0) * config.weight;
    return acc;
  }, { list: 0, platformFee: 0, warehouse: 0, mgmt: 0 });
  return {
    ...avg,
    unitPayout: avg.list - avg.platformFee,
    labels: active.map((config) => config.short),
    active,
  };
}

export function getPlatformTariffMeta() {
  return {
    sources: PLATFORM_TARIFFS.sources,
    ozonCategories: PLATFORM_TARIFFS.ozon.commissions.length,
    wbCategories: PLATFORM_TARIFFS.wb.commissions.length,
    yandexCategories: PLATFORM_TARIFFS.yandex.commissions.length,
    ozonCommissionCategories: PLATFORM_TARIFFS.ozon.commissions.map((row) => row[0]),
    wbCommissionCategories: PLATFORM_TARIFFS.wb.commissions.map((row) => row[0]),
    yandexCommissionCategories: PLATFORM_TARIFFS.yandex.commissions.map((row) => row[0]),
    ozonClusters: PLATFORM_TARIFFS.ozon.clusters,
    wbLocalizationBands: PLATFORM_TARIFFS.wb.localization.map((row) => row[0]),
    yandexPaymentFrequencies: PLATFORM_TARIFFS.yandex.paymentFrequencies.map((row) => row[0]),
  };
}
