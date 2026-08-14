import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { buildProjectWorkbook, parseProjectWorkbook } from "../src/lib/projectExcel.js";

const months = 24;
const longProject = {
  projectName: "24月 Excel 往返",
  params: { exchangeRate: 12, taxScheme: "usn_6", damageRate: 0 },
  products: [{
    id: "SKU-24",
    name: "24月商品",
    priceCNY: 10,
    declaredCNY: 10,
    qty: 100,
    weight: 0.2,
    list: 199,
    platformFee: 30,
    warehouse: 5,
    mgmt: 3,
    platforms: {
      ozon: { enabled: true, salesShare: 60, model: "FBO", acceptanceRatePct: 83 },
      wb: { enabled: true, salesShare: 40, model: "FBW", acceptanceRatePct: 72 },
      yandex: { enabled: false, salesShare: 0, model: "FBY", acceptanceRatePct: 64 },
    },
  }],
  scheduleStore: {
    "SKU-24": Array.from({ length: months }, (_, index) => index + 1),
  },
  priceScheduleStore: {
    "SKU-24": {
      list: Array.from({ length: months }, (_, index) => 199 + index),
      fee: Array.from({ length: months }, (_, index) => 30 + index),
    },
  },
  restockStore: {
    "SKU-24": [100, ...Array.from({ length: months }, (_, index) => index + 2)],
  },
  withdrawalStore: { amounts: Array.from({ length: months }, (_, index) => index * 10) },
  projection: {
    monthsHorizon: months,
    partnerSharePct: 50,
    monthlyFixedCost: 0,
    autoVATEscalation: false,
    forecastStartMonth: "2027-01",
  },
};

const workbook = buildProjectWorkbook(longProject);
const salesRows = XLSX.utils.sheet_to_json(workbook.Sheets["销售排期"], { header: 1, raw: true });
const restockRows = XLSX.utils.sheet_to_json(workbook.Sheets["补货排期"], { header: 1, raw: true });
const productRows = XLSX.utils.sheet_to_json(workbook.Sheets["商品明细"], { header: 1, raw: true });
const salesHeader = salesRows[0];
const restockHeader = restockRows[0];
assert.ok(productRows[0].includes("Ozon 预计签收率 %"));
assert.ok(productRows[0].includes("WB 预计签收率 %"));
assert.ok(productRows[0].includes("Yandex 预计签收率 %"));
assert.equal(salesHeader.at(-1), "M24");
assert.equal(restockHeader.at(-1), "M24");
assert.equal(salesRows[1].at(-1), 24);
assert.equal(restockRows[1].at(-1), 25);

const parsed = parseProjectWorkbook(workbook);
assert.equal(parsed.projection.monthsHorizon, months);
assert.equal(parsed.scheduleStore["SKU-24"].length, months);
assert.equal(parsed.scheduleStore["SKU-24"][23], 24);
assert.equal(parsed.priceScheduleStore["SKU-24"].list[23], 222);
assert.equal(parsed.priceScheduleStore["SKU-24"].fee[23], 53);
assert.equal(parsed.restockStore["SKU-24"].length, months + 1);
assert.equal(parsed.restockStore["SKU-24"][24], 25);
assert.equal(parsed.withdrawalStore.amounts.length, months);
assert.equal(parsed.withdrawalStore.amounts[23], 230);
assert.equal(parsed.products[0].platforms.ozon.acceptanceRatePct, 83);
assert.equal(parsed.products[0].platforms.wb.acceptanceRatePct, 72);
assert.equal(parsed.products[0].platforms.yandex.acceptanceRatePct, 64);
assert.equal(parsed.products[0].platforms.ozon.enabled, true);
assert.equal(parsed.products[0].platforms.wb.enabled, true);
assert.equal(parsed.products[0].platforms.yandex.enabled, false);
assert.equal(parsed.products[0].platforms.ozon.salesShare, 60);
assert.equal(parsed.products[0].platforms.wb.salesShare, 40);

const reservedWorkbook = buildProjectWorkbook({
  ...longProject,
  projection: { ...longProject.projection, monthsHorizon: 12 },
}, { reserveMonths: 36 });
const reservedSalesRows = XLSX.utils.sheet_to_json(reservedWorkbook.Sheets["销售排期"], { header: 1, raw: true });
assert.equal(reservedSalesRows[0].at(-1), "M36");
assert.equal(parseProjectWorkbook(reservedWorkbook).projection.monthsHorizon, 12);

console.log("project Excel 24-month round trip passed");
