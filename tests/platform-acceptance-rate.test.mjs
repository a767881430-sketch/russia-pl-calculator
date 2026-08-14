import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calcPlatformFeeBreakdown } from "../src/lib/platformPricing.js";

const baseConfig = {
  platformId: "ozon",
  model: "FBO",
  pricingAsOfDate: "2026-08-28",
  list: 1000,
  useTariffLookup: false,
  commissionRate: 0,
  paymentRate: 0,
  baseFreight: 58,
  fixedDeliveryFee: 25,
  returnHandling: 0,
  acceptanceRatePct: 100,
  adRate: 0,
  otherServiceRate: 0,
  otherFee: 0,
};

const accepted100 = calcPlatformFeeBreakdown(baseConfig);
const accepted50 = calcPlatformFeeBreakdown({ ...baseConfig, acceptanceRatePct: 50 });

assert.equal(accepted100.delivery, 83);
assert.equal(accepted100.logisticsTotal, 83);
// Ozon reference workbook removes the extra last-mile leg from the
// non-delivery multiplier. With 50% acceptance, 2*83 + 58 - 25 = 199.
assert.equal(accepted50.logisticsTotal, 199);
assert.equal(accepted100.acceptanceRatePctApplied, 100);
assert.equal(accepted50.acceptanceRatePctApplied, 50);
assert.equal(accepted50.total - accepted100.total, 116);

const newFormulaNonLocal0 = calcPlatformFeeBreakdown({ ...baseConfig, nonLocalRate: 0 });
const newFormulaNonLocal10 = calcPlatformFeeBreakdown({ ...baseConfig, nonLocalRate: 0.1 });
assert.equal(newFormulaNonLocal10.logisticsTotal, newFormulaNonLocal0.logisticsTotal);

const legacyConfig = {
  ...baseConfig,
  pricingAsOfDate: "2026-08-27",
  supplyCluster: "A",
  deliveryCluster: "B",
  returnHandling: 15,
};
const legacyNonLocal0 = calcPlatformFeeBreakdown({ ...legacyConfig, nonLocalRate: 0, acceptanceRatePct: 50 });
const legacyNonLocal10 = calcPlatformFeeBreakdown({ ...legacyConfig, nonLocalRate: 0.1, acceptanceRatePct: 50 });
// Ozon legacy reference workbook also removes the non-local increment from
// the returned parcel multiplier: (2-1) * (W-U) is explicitly subtracted.
assert.equal(legacyNonLocal10.logisticsTotal, 314);
assert.equal(legacyNonLocal0.logisticsTotal, 214);
assert.match(legacyNonLocal0.tariffSource, /旧版物流表/);
assert.match(newFormulaNonLocal0.tariffSource, /2026-08-28 物流表/);

const i18n = await readFile("src/i18n.js", "utf8");
const app = await readFile("src/App.jsx", "utf8");
assert.match(i18n, /platformAcceptanceRate:\s*\{\s*zh:\s*"预计签收率"/);
assert.match(i18n, /platformFieldNonLocalRate:\s*\{\s*zh:\s*"旧版跨区销售费率（2026-08-28 前兜底）"/);
assert.match(i18n, /platformAcceptanceRateApplied:\s*\{\s*zh:\s*"实际采用签收率"/);
assert.match(i18n, /platformAdjustedLogisticsTotal:\s*\{\s*zh:\s*"签收率调整后物流费用合计"/);
assert.match(app, /platformAcceptanceRateApplied/);
assert.match(app, /formulaVersion === "ozon_2026-08-28"/);
assert.match(app, /field !== "nonLocalRate"/);
assert.match(app, /data-testid=\{`platform-acceptance-rate-\$\{platform\.id\}`\}/);
assert.match(app, /platformAcceptanceRateHint/);

const wbConfig = {
  platformId: "wb",
  model: "FBW",
  list: 1000,
  useTariffLookup: false,
  commissionRate: 0.2,
  paymentRate: 0,
  volumeLiters: 2,
  baseRate: 50,
  overLiterRate: 10,
  warehouseMultiplier: 1,
  localizationCoef: 1,
  acceptanceRatePct: 100,
  adRate: 0,
};
const wb100 = calcPlatformFeeBreakdown(wbConfig);
const wb80 = calcPlatformFeeBreakdown({ ...wbConfig, acceptanceRatePct: 80 });
assert.ok(wb80.logisticsTotal > wb100.logisticsTotal);
assert.equal(wb80.commission, wb100.commission);

// WB reference row: X = localization coefficient * U + price * sales
// distribution coefficient; Y remains the unmultiplied return tariff.
const wbReference = calcPlatformFeeBreakdown({
  platformId: "wb",
  model: "FBW",
  list: 9999,
  useTariffLookup: false,
  commissionRate: 0,
  paymentRate: 0,
  volumeLiters: 22,
  baseRate: 46,
  overLiterRate: 14,
  warehouseMultiplier: 1.95,
  localizationCoef: 1.1,
  salesDistributionRate: 0.0205,
  acceptanceRatePct: 40,
  adRate: 0,
});
assert.equal(Number(wbReference.delivery.toFixed(4)), 934.2795);
assert.equal(Number(wbReference.reverseLogistics.toFixed(4)), 340);
assert.equal(Number(wbReference.logisticsTotal.toFixed(5)), 2845.69875);

const yandexConfig = {
  platformId: "yandex",
  model: "FBY",
  list: 1000,
  useTariffLookup: false,
  commissionRate: 0.2,
  acquiringFee: 0,
  paymentTransferRate: 0,
  volumeLiters: 2,
  returnHandling: 15,
  acceptanceRatePct: 100,
  adRate: 0,
};
const yandex100 = calcPlatformFeeBreakdown(yandexConfig);
const yandex80 = calcPlatformFeeBreakdown({ ...yandexConfig, acceptanceRatePct: 80 });
assert.ok(yandex80.logisticsTotal > yandex100.logisticsTotal);
assert.equal(yandex80.commission, yandex100.commission);

console.log("platform acceptance-rate calculation and UI contract passed");
