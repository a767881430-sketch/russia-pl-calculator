import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { findProductImportSheet } from "../src/lib/productImport.js";
import { buildProjectWorkbook, isProjectExcelWorkbook, parseProjectWorkbook } from "../src/lib/projectExcel.js";

const project = {
  projectName: "导入测试",
  params: {
    exchangeRate: 12,
    payoutLossRate: 0.05,
    payoutLossBasis: "actual_payout",
    taxScheme: "usn_6",
    incomeBasis: "list",
    taxRevenueRecognition: "gross_sales",
    taxCostBasis: "actual_landed_cost",
    platformFeeDeductible: false,
    payoutLossDeductible: true,
    ipInsuranceEnabled: true,
    ipInsuranceThreshold: 0,
    ipInsuranceCap: 0,
  },
  products: [{
    id: "SKU-1",
    name: "测试商品",
    priceCNY: 10,
    declaredCNY: 8,
    qty: 100,
    list: 1999,
    platformFee: 600,
    warehouse: 50,
    mgmt: 30,
    shippingMode: "manual",
  }],
  scheduleStore: { "SKU-1": [10, 20] },
  priceScheduleStore: { "SKU-1": { list: [1999, 2099], fee: [600, 620] } },
  restockStore: { "SKU-1": [100, 0, 20] },
  withdrawalStore: { amounts: [50, 80] },
  projection: {
    monthsHorizon: 2,
    partnerSharePct: 50,
    monthlyFixedCost: 0,
    autoVATEscalation: false,
    priorYearRevenue: 0,
    forecastStartMonth: "2026-12",
    openingTaxableIncome: 1000,
    openingDeductibleExpenses: 700,
    openingUsnAdvancePaid: 20,
  },
  projectMeta: {},
};

const workbook = buildProjectWorkbook(project);
const parsed = parseProjectWorkbook(workbook);
const parameterRows = XLSX.utils.sheet_to_json(workbook.Sheets["项目参数"], { header: 1, raw: true });

function setParameterValue(targetWorkbook, label, value) {
  const sheet = targetWorkbook.Sheets["项目参数"];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const row = rows.findIndex((entry) => entry[0] === label) + 1;
  assert.ok(row > 0, `missing parameter row: ${label}`);
  sheet[`B${row}`] = typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value };
}

assert.equal(workbook.SheetNames.length, 6);
assert.deepEqual(parameterRows[0], ["参数名称", "填写内容", "填写说明"]);
assert.equal(parameterRows[1][0], "项目名称");
assert.equal(parameterRows.find((row) => row[0] === "税制")[1], "USN 6%（销售额税）");
assert.equal(parameterRows.find((row) => row[0] === "收入税计税基数")[1], "按销售额计税");
assert.equal(parameterRows.find((row) => row[0] === "计税收入确认方式")[1], "按含税销售额确认");
assert.equal(parameterRows.find((row) => row[0] === "可扣成本口径")[1], "按实际到仓成本（内部测算）");
assert.equal(parameterRows.find((row) => row[0] === "平台综合费可扣除")[1], "否");
assert.equal(parameterRows.find((row) => row[0] === "回款损耗可扣除")[1], "是");
assert.equal(parameterRows.find((row) => row[0] === "预测起始月份（YYYY-MM）")[1], "2026-12");
assert.equal(parameterRows.find((row) => row[0] === "回款损耗计提基数")[1], "按实际回款计提");
assert.equal(parameterRows.find((row) => row[0] === "启用 ИП 附加保险")[1], "是");
const priorRevenueRow = parameterRows.find((row) => row[0] === "预测开始前累计营收（VAT跨阈值用） RUB");
assert.ok(priorRevenueRow, "prior revenue parameter should explain its VAT threshold role");
assert.match(priorRevenueRow[2], /不等同于本税年 USN 15% 期初计税收入/);
const taxSchemeDescription = parameterRows.find((row) => row[0] === "税制")[2];
assert.match(taxSchemeDescription, /6%\+1%/);
assert.match(taxSchemeDescription, /15%.*ИП.*保险/);
const ipInsuranceDescription = parameterRows.find((row) => row[0] === "启用 ИП 附加保险")[2];
assert.match(ipInsuranceDescription, /6%.*15%/);
assert.equal(parsed.products[0].id, "SKU-1");
assert.deepEqual(parsed.scheduleStore["SKU-1"], [10, 20]);
assert.equal(parsed.params.payoutLossRate, 0.05);
assert.equal(parsed.params.payoutLossBasis, "actual_payout");
assert.equal(parsed.params.taxRevenueRecognition, "gross_sales");
assert.equal(parsed.params.taxCostBasis, "actual_landed_cost");
assert.equal(parsed.params.platformFeeDeductible, false);
assert.equal(parsed.params.payoutLossDeductible, true);
assert.equal(parsed.params.incomeBasis, "list");
assert.equal(parsed.projection.forecastStartMonth, "2026-12");
assert.equal(parsed.projection.openingTaxableIncome, 1000);
assert.equal(parsed.projection.openingDeductibleExpenses, 700);
assert.equal(parsed.projection.openingUsnAdvancePaid, 20);
assert.throws(() => parseProjectWorkbook(XLSX.utils.book_new()), /缺少工作表/);
assert.equal(isProjectExcelWorkbook(workbook), true);
assert.equal(isProjectExcelWorkbook(XLSX.utils.book_new()), false);

const invalidStartMonthWorkbook = buildProjectWorkbook(project);
setParameterValue(invalidStartMonthWorkbook, "预测起始月份（YYYY-MM）", "2026-1");
assert.throws(() => parseProjectWorkbook(invalidStartMonthWorkbook), /YYYY-MM/);

const excelDateStartMonthWorkbook = buildProjectWorkbook(project);
setParameterValue(excelDateStartMonthWorkbook, "预测起始月份（YYYY-MM）", 46023);
assert.equal(parseProjectWorkbook(excelDateStartMonthWorkbook).projection.forecastStartMonth, "2026-01");

const legacyPriorRevenueWorkbook = buildProjectWorkbook(project);
const legacyPriorRevenueRows = XLSX.utils.sheet_to_json(
  legacyPriorRevenueWorkbook.Sheets["项目参数"],
  { header: 1, raw: true, defval: "" },
);
const legacyPriorRevenueRow = legacyPriorRevenueRows.findIndex(
  (row) => row[0] === "预测开始前累计营收（VAT跨阈值用） RUB",
);
assert.ok(legacyPriorRevenueRow >= 0, "new prior revenue row should exist before alias check");
legacyPriorRevenueWorkbook.Sheets["项目参数"][`A${legacyPriorRevenueRow + 1}`] = {
  t: "s",
  v: "上一年度收入 RUB",
};
assert.equal(parseProjectWorkbook(legacyPriorRevenueWorkbook).projection.priorYearRevenue, 0);

const conflictingRecognitionWorkbook = buildProjectWorkbook(project);
setParameterValue(conflictingRecognitionWorkbook, "收入税计税基数", "按回款计税");
assert.throws(() => parseProjectWorkbook(conflictingRecognitionWorkbook), /不一致/);

const periodPlaceholderWorkbook = buildProjectWorkbook(project);
XLSX.utils.sheet_add_aoa(periodPlaceholderWorkbook.Sheets["提款分润"], [["M3", 0], ["M4", 0]], { origin: -1 });
assert.deepEqual(parseProjectWorkbook(periodPlaceholderWorkbook).withdrawalStore.amounts, [50, 80]);
XLSX.utils.sheet_add_aoa(periodPlaceholderWorkbook.Sheets["提款分润"], [["M5", 1]], { origin: -1 });
assert.throws(() => parseProjectWorkbook(periodPlaceholderWorkbook), /超出项目预测月份 M2/);

const a009 = JSON.parse(await readFile("public/a009-wig-project.json", "utf8"));
const a009RoundTrip = parseProjectWorkbook(buildProjectWorkbook(a009));
assert.equal(a009RoundTrip.products.length, 70);
assert.equal(a009RoundTrip.params.payoutLossRate, 0.05);
assert.equal(a009RoundTrip.params.payoutLossBasis, "actual_payout");
assert.ok(Object.values(a009RoundTrip.scheduleStore).flat().every(Number.isInteger));
assert.equal(
  Object.values(a009RoundTrip.restockStore).reduce((sum, values) => sum + values[0], 0),
  6064,
);

const readWorkbookFile = (XLSX.default || XLSX).readFile;
const templateWorkbook = readWorkbookFile("public/投资损益计算器完整项目填写模板.xlsx");
assert.deepEqual(templateWorkbook.SheetNames, ["项目参数", "商品明细", "销售排期", "价格排期", "补货排期", "提款分润"]);
const templateProductRows = XLSX.utils.sheet_to_json(
  templateWorkbook.Sheets["商品明细"],
  { header: 1, raw: true, defval: "" },
);
assert.ok(templateProductRows[0].includes("Ozon 预计签收率 %"));
assert.ok(templateProductRows[0].includes("WB 预计签收率 %"));
assert.ok(templateProductRows[0].includes("Yandex 预计签收率 %"));
const templateProject = parseProjectWorkbook(templateWorkbook);
assert.equal(templateProject.params.taxRevenueRecognition, "gross_sales");
assert.equal(templateProject.params.taxCostBasis, "documented_book_cost");
assert.equal(templateProject.params.platformFeeDeductible, true);
assert.equal(templateProject.params.payoutLossDeductible, false);
assert.equal(templateProject.params.incomeBasis, "list");
assert.equal(templateProject.projection.forecastStartMonth, "2026-01");
const templateSheets = templateWorkbook.SheetNames.map((name) => ({
  name,
  rows: XLSX.utils.sheet_to_json(templateWorkbook.Sheets[name], { header: 1, defval: "" }),
}));
assert.equal(findProductImportSheet(templateSheets)?.name, "商品明细");

const asciiTemplateWorkbook = readWorkbookFile("public/project-import-template.xlsx");
assert.deepEqual(asciiTemplateWorkbook.SheetNames, templateWorkbook.SheetNames);

const a009WorkbookFile = readWorkbookFile("public/A009-假发完整项目导入.xlsx");
const a009ImportedFile = parseProjectWorkbook(a009WorkbookFile);
assert.equal(a009ImportedFile.products.length, 70);
assert.equal(a009ImportedFile.params.payoutLossRate, 0.05);
assert.equal(a009ImportedFile.params.payoutLossBasis, "actual_payout");
assert.ok(Object.values(a009ImportedFile.scheduleStore).flat().every(Number.isInteger));

const asciiA009WorkbookFile = readWorkbookFile("public/a009-wig-import.xlsx");
assert.equal(parseProjectWorkbook(asciiA009WorkbookFile).products.length, 70);

const app = await readFile("src/App.jsx", "utf8");
assert.match(app, /const importProjectExcel =/);
assert.match(app, /导入完整项目 Excel/);
assert.match(app, /下载 Excel 模板/);
assert.match(app, /const exportProjectExcel =/);
assert.match(app, /导出当前项目 Excel/);
assert.match(app, /XLSX\.writeFile/);
assert.match(app, /project-import-template\.xlsx/);
assert.doesNotMatch(app, /onClick=\{importProjectJSON\}/);

console.log("projectExcel tests passed");
