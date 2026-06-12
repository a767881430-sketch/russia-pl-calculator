import fs from "node:fs/promises";
import path from "node:path";

const workspaceRoot = process.cwd();
const publicDir = path.join(workspaceRoot, "public");
const outputDir = path.join(workspaceRoot, "supabase", "seed");
const outputPath = path.join(outputDir, "legacy-projects.json");

const legacyProjects = [
  { name: "雄伟传奇", file: "xiongwei-chuanqi-project.json", slug: "xiongwei-chuanqi" },
  { name: "德力 22SKU - 保守", file: "deli-glass-russia-22sku-conservative-project.json", slug: "deli-22sku-conservative" },
  { name: "德力 22SKU - 标准", file: "deli-glass-russia-22sku-standard-project.json", slug: "deli-22sku-standard" },
  { name: "德力 22SKU - 放量", file: "deli-glass-russia-22sku-aggressive-project.json", slug: "deli-22sku-aggressive" },
  { name: "Ozon 90天 - 保守", file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-conservative-project.json", slug: "ozon-90day-conservative" },
  { name: "Ozon 90天 - 标准", file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-standard-project.json", slug: "ozon-90day-standard" },
  { name: "Ozon 90天 - 放量", file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-scale-project.json", slug: "ozon-90day-scale" },
];

async function main() {
  const rows = [];

  for (const item of legacyProjects) {
    const fullPath = path.join(publicDir, item.file);
    try {
      const raw = await fs.readFile(fullPath, "utf8");
      const parsed = JSON.parse(raw);
      rows.push({
        name: parsed.projectName || item.name,
        slug: item.slug,
        legacy_file_path: item.file,
        current_data_json: parsed,
      });
    } catch (error) {
      rows.push({
        name: item.name,
        slug: item.slug,
        legacy_file_path: item.file,
        error: error.message,
      });
    }
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(rows, null, 2), "utf8");
  console.log(`Wrote ${rows.length} legacy project rows to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
