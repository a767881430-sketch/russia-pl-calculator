import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { MAX_FORECAST_MONTHS, buildBlankProjectData, normalizeForecastHorizon } from "../src/lib/calcEngine.js";
import { buildProjectWorkbook } from "../src/lib/projectExcel.js";

const writeFile = (XLSX.default || XLSX).writeFile;

function writeWorkbook(filePath, data, options = {}) {
  writeFile(buildProjectWorkbook(data, options), filePath, { compression: true });
  console.log(`已生成 ${filePath}`);
}

const blank = buildBlankProjectData("完整项目 Excel 模板");
const requestedTemplateMonths = Number(process.env.PROJECT_TEMPLATE_MONTHS || 12);
blank.projection = {
  ...blank.projection,
  monthsHorizon: normalizeForecastHorizon(requestedTemplateMonths, 12),
};

const a009 = JSON.parse(await readFile("public/a009-wig-project.json", "utf8"));

// Keep the generic template's default horizon readable at 12 months while
// reserving columns through M36 so users can change the parameter without
// manually adding monthly columns.
writeWorkbook("public/投资损益计算器完整项目填写模板.xlsx", blank, { reserveMonths: MAX_FORECAST_MONTHS });
writeWorkbook("public/A009-假发完整项目导入.xlsx", a009);
writeWorkbook("public/project-import-template.xlsx", blank, { reserveMonths: MAX_FORECAST_MONTHS });
writeWorkbook("public/a009-wig-import.xlsx", a009);
