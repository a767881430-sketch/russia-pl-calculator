export const LEGACY_PUBLIC_PROJECTS = [
  {
    name: "雄伟传奇",
    file: "xiongwei-chuanqi-project.json",
    slug: "xiongwei-chuanqi",
    desc: "新增线上项目，适合直接发给别人看。",
  },
  {
    name: "德力 22SKU · 保守试水",
    file: "deli-glass-russia-22sku-conservative-project.json",
    slug: "deli-22sku-conservative",
    desc: "先小批试卖、控制现金占用。",
  },
  {
    name: "德力 22SKU · 标准启动",
    file: "deli-glass-russia-22sku-standard-project.json",
    slug: "deli-22sku-standard",
    desc: "默认讲解版本，适合老板/供应商一起看。",
  },
  {
    name: "德力 22SKU · 进取放量",
    file: "deli-glass-russia-22sku-aggressive-project.json",
    slug: "deli-22sku-aggressive",
    desc: "讨论多平台和更高备货规模。",
  },
  {
    name: "Ozon 90 天 · 保守试销",
    file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-conservative-project.json",
    slug: "ozon-90day-conservative",
    desc: "低预算验证上架、客服和履约链路。",
  },
  {
    name: "Ozon 90 天 · 标准启动",
    file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-standard-project.json",
    slug: "ozon-90day-standard",
    desc: "本地现货供货合作的默认测算。",
  },
  {
    name: "Ozon 90 天 · 放量验证",
    file: "ozon-wholesale-90day-pack/ozon-wholesale-90day-scale-project.json",
    slug: "ozon-90day-scale",
    desc: "需要供货价、库存、补货和售后机制更稳定。",
  },
];

export function findLegacyPublicProjectByFile(file) {
  return LEGACY_PUBLIC_PROJECTS.find((item) => item.file === file) || null;
}

export function findLegacyPublicProjectBySlug(slug) {
  return LEGACY_PUBLIC_PROJECTS.find((item) => item.slug === slug) || null;
}
