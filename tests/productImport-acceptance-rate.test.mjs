import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeImportedProducts,
  parseProductImportRows,
  parseProductImportText,
} from "../src/lib/productImport.js";

test("普通商品表导入三平台签收率并保留平台设置", () => {
  const parsed = parseProductImportRows([
    ["SKU", "采购价 CNY", "Ozon 预计签收率 %", "WB 预计签收率 %", "Yandex 预计签收率 %"],
    ["SKU-1", 10, "83%", 72, 64],
  ]);

  assert.equal(parsed.products.length, 1);
  assert.equal(parsed.products[0].platforms.ozon.acceptanceRatePct, 83);
  assert.equal(parsed.products[0].platforms.wb.acceptanceRatePct, 72);
  assert.equal(parsed.products[0].platforms.yandex.acceptanceRatePct, 64);
});

test("CSV 商品表支持英文签收率别名", () => {
  const parsed = parseProductImportText([
    "sku,cost,ozon acceptance rate,wb buyout rate,yandex acceptance rate",
    "SKU-CSV,10,81,77,69",
  ].join("\n"));

  assert.equal(parsed.products[0].platforms.ozon.acceptanceRatePct, 81);
  assert.equal(parsed.products[0].platforms.wb.acceptanceRatePct, 77);
  assert.equal(parsed.products[0].platforms.yandex.acceptanceRatePct, 69);
});

test("更新已有 SKU 时不覆盖其他平台参数", () => {
  const current = [{
    id: "SKU-1",
    platforms: {
      ozon: { enabled: true, salesShare: 60, commissionRate: 0.2, acceptanceRatePct: 90 },
      wb: { enabled: true, salesShare: 40, model: "FBW", commissionRate: 0.28 },
    },
  }];
  const imported = parseProductImportRows([
    ["SKU", "WB 预计签收率 %", "Yandex 预计签收率 %"],
    ["SKU-1", 72, 64],
  ]).products;

  const merged = mergeImportedProducts(current, imported);
  const product = merged.products[0];
  assert.equal(product.platforms.ozon.acceptanceRatePct, 90);
  assert.equal(product.platforms.ozon.commissionRate, 0.2);
  assert.equal(product.platforms.wb.acceptanceRatePct, 72);
  assert.equal(product.platforms.wb.commissionRate, 0.28);
  assert.equal(product.platforms.yandex.acceptanceRatePct, 64);
});

test("新 SKU 只填写非 Ozon 签收率时仍保留 Ozon 默认平台", () => {
  const imported = parseProductImportRows([
    ["SKU", "WB 预计签收率 %"],
    ["SKU-WB", 72],
  ]).products;
  const merged = mergeImportedProducts([], imported);
  const product = merged.products[0];

  assert.deepEqual(product.platforms.ozon, {
    enabled: true,
    salesShare: 100,
    model: "FBO",
  });
  assert.equal(product.platforms.wb.acceptanceRatePct, 72);
});

test("旧 SKU 没有平台配置时导入非 Ozon 签收率仍保留 Ozon 默认", () => {
  const imported = parseProductImportRows([
    ["SKU", "Yandex 预计签收率 %"],
    ["SKU-LEGACY", 64],
  ]).products;
  const merged = mergeImportedProducts([{ id: "SKU-LEGACY", priceCNY: 10 }], imported);
  const product = merged.products[0];

  assert.equal(product.platforms.ozon.enabled, true);
  assert.equal(product.platforms.ozon.salesShare, 100);
  assert.equal(product.platforms.yandex.acceptanceRatePct, 64);
});

test("无效或空签收率不覆盖默认值", () => {
  const parsed = parseProductImportRows([
    ["SKU", "采购价 CNY", "Ozon 预计签收率 %", "WB 预计签收率 %", "Yandex 预计签收率 %"],
    ["SKU-1", 10, 0, 101, ""],
  ]);

  assert.equal(parsed.products[0].platforms, undefined);
});

console.log("product import acceptance-rate tests passed");
