import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "../../local-backend/src/server.mjs";

const require = createRequire(import.meta.url);
const model = require("../utils/model.js");
const layout = require("../utils/layout.js");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function assertPng(file) {
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", file);
  assert.ok(bytes.length > 80, file);
}

async function request(baseUrl, method, pathname, body) {
  const response = await fetch(baseUrl + pathname, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

function assertStructure() {
  const app = JSON.parse(read("app.json"));
  const project = JSON.parse(read("project.config.json"));
  assert.equal(project.compileType, "miniprogram");
  assert.equal(project.setting.urlCheck, false);
  assert.equal(project.appid, "touristappid");
  assert.deepEqual(app.tabBar.list.map((item) => item.pagePath), ["pages/quote/quote", "pages/history/history"]);
  assert.deepEqual(app.tabBar.list.map((item) => item.text), ["查价报价", "历史报价"]);
  for (const page of ["pages/quote/quote", "pages/history/history", "pages/signature/signature", "pages/receipt/receipt", "pages/account/account"]) {
    assert.ok(app.pages.includes(page), page);
    for (const ext of [".js", ".json", ".wxml", ".wxss"]) {
      assert.ok(fs.existsSync(path.join(root, page + ext)), page + ext);
    }
  }
  assert.equal(app.tabBar.list.some((item) => item.pagePath.includes("signature")), false);
  assert.equal(app.tabBar.list.some((item) => item.pagePath.includes("receipt")), false);

  const wxml = ["quote", "history", "signature", "receipt", "account"].map((name) => read(`pages/${name}/${name}.wxml`)).join("\n");
  assert.equal(wxml.includes("<web-view"), false);
  assert.equal(wxml.includes("<select"), false);
  assert.equal(wxml.includes("data:image"), false);
  assert.equal(wxml.includes(":has("), false);
  assert.match(read("pages/quote/quote.wxml"), /<picker/);
  assert.match(read("pages/quote/quote.wxml"), /<switch/);
  assert.match(read("pages/quote/quote.wxml"), /打开本地演示/);
  assert.match(read("pages/quote/quote.wxml"), /scrollHeight/);
  assert.equal(read("pages/quote/quote.wxss").includes("height: 0"), false);
  assert.equal(read("pages/history/history.wxss").includes("height: 0"), false);
  assert.match(read("pages/quote/quote.wxss"), /100vh/);
  assert.match(read("pages/history/history.wxss"), /100vh/);
  assert.match(read("pages/signature/signature.wxml"), /type="2d"/);
  assert.match(read("pages/signature/signature.wxml"), /catchtouchstart/);
  assert.match(read("pages/signature/signature.js"), /pixelRatio/);
  assert.equal(read("pages/quote/quote.wxss").includes(":has("), false);
  assert.equal(read("app.wxss").includes(":hover"), false);

  for (const file of [
    "images/tab-quote.png",
    "images/tab-quote-active.png",
    "images/tab-history.png",
    "images/tab-history-active.png",
    "images/categories/air.png",
    "images/categories/default.png",
    "images/brands/gree.png",
    "images/brands/other.png",
  ]) assertPng(file);
}

function assertMockMath() {
  const capacitor = model.calculateMock({ serviceIds: ["air-capacitor"], brandId: "gree", cityId: "shanghai", extraIds: ["remote"] });
  const basic = model.calculateMock({ serviceIds: ["air-basic"], brandId: "gree", cityId: "shanghai" });
  const both = model.calculateMock({ serviceIds: ["air-capacitor", "air-basic"], brandId: "gree", cityId: "shanghai" });
  const faucet = model.calculateMock({ serviceIds: ["water-faucet"], brandId: "other", cityId: "hefei", extraIds: ["height"] });
  assert.equal(capacitor.total, 280);
  assert.equal(basic.total, 143);
  assert.equal(both.total, 373);
  assert.equal(faucet.total, 206);
  assert.equal(both.rows.length, 3);
  assert.throws(() => model.calculateMock({ serviceIds: ["water-faucet"], brandId: "gree", cityId: "shanghai" }), /品牌不适用/);

  const catalog = model.normalizeCatalog(model.publicCatalog());
  assert.equal(catalog.categories.find((item) => item.id === "air").image, "/images/categories/air.png");
  assert.equal(model.categoryImage({ id: "air", image: "data:image/svg+xml,abc" }), "/images/categories/air.png");
  assert.equal(model.brandImage({ id: "gree", logo: "data:image/png;base64,aaaa" }), "/images/brands/gree.png");
  assert.equal(model.brandImage({ id: "aux" }), "/images/brands/aux-brand.png");
  assert.equal(fs.existsSync(path.join(root, "images/brands/aux.png")), false);
  assertPng("images/brands/aux-brand.png");
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  for (const file of fs.readdirSync(path.join(root, "images/brands"))) {
    assert.equal(reserved.test(path.parse(file).name), false, file);
  }
  const view = model.presentLists(catalog, model.blankState());
  assert.equal(view.selection.serviceIds[0], "air-basic");
  assert.equal(view.canQuote, true);
  assert.equal(view.groups.length, 4);
  const empty = model.presentLists(model.normalizeCatalog({}), model.blankState());
  assert.equal(empty.canQuote, false);
  assert.equal(empty.groups.length, 4);
  const frame = layout.quoteFrame(375, 667);
  assert.equal(frame.pageHeight, 667);
  assert.ok(frame.scrollHeight >= 280);
  assert.ok(frame.scrollHeight < frame.pageHeight);
  assert.equal(layout.pageFrame(390, 700).pageHeight, 700);
  assert.equal(layout.quoteFrame(375, 800, 800).pageHeight, 750);
}

async function assertServerParity() {
  const dbFile = path.join(os.tmpdir(), `yisiyuan-mp-quote-${process.pid}.sqlite`);
  await Promise.all([dbFile, `${dbFile}-wal`, `${dbFile}-shm`].map((file) => fs.promises.rm(file, { force: true })));
  const server = createServer({ dbFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await request(baseUrl, "GET", "/api/health");
    assert.equal(health.payload.ok, true);
    const catalog = await request(baseUrl, "GET", "/api/catalog");
    assert.ok(catalog.payload.services.length >= 3);
    const normalized = model.normalizeCatalog(catalog.payload);
    assert.equal(normalized.categories[0].image.startsWith("/images/"), true);
    const cases = [
      { serviceIds: ["air-capacitor"], brandId: "gree", cityId: "shanghai", extraIds: ["remote"], warrantyDays: 90 },
      { serviceIds: ["air-basic"], brandId: "gree", cityId: "shanghai", extraIds: [], warrantyDays: 30 },
      { serviceIds: ["air-capacitor", "air-basic"], brandId: "gree", cityId: "shanghai", extraIds: ["night"], warrantyDays: 90 },
      { serviceIds: ["water-faucet"], brandId: "other", cityId: "hefei", extraIds: ["height"], warrantyDays: 30 },
    ];
    for (const body of cases) {
      const remote = await request(baseUrl, "POST", "/api/quotes/calculate", body);
      const local = model.calculateMock(body);
      assert.equal(remote.status, 200, JSON.stringify(remote.payload));
      assert.equal(remote.payload.total, local.total, JSON.stringify(body));
      assert.deepEqual(remote.payload.rows, local.rows, JSON.stringify(body));
    }
    const rejected = await request(baseUrl, "POST", "/api/quotes/calculate", { serviceIds: ["water-faucet"], brandId: "gree", cityId: "shanghai" });
    assert.equal(rejected.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await Promise.all([dbFile, `${dbFile}-wal`, `${dbFile}-shm`].map((file) => fs.promises.rm(file, { force: true })));
  }
}

function assertUiPolish() {
  const initial = model.collapsedPanels(null, false, "category");
  assert.deepEqual(initial, {
    category: false,
    service: true,
    brand: true,
    extra: true,
    warranty: true,
    quote: true,
  });
  const afterCategory = model.collapsedPanels({ category: true }, false, "service");
  assert.equal(afterCategory.category, false);
  assert.equal(afterCategory.service, false);
  assert.equal(afterCategory.brand, true);
  assert.equal(afterCategory.extra, true);
  assert.equal(afterCategory.warranty, true);
  assert.equal(afterCategory.quote, true);
  const withExtra = model.collapsedPanels({ category: true, service: true, brand: true }, true, "warranty");
  assert.equal(withExtra.extra, false);
  assert.equal(withExtra.warranty, false);
  assert.equal(withExtra.quote, true);
  const quoted = model.collapsedPanels({ category: true, service: true, brand: true, warranty: true, quote: true }, false, "quote");
  assert.equal(quoted.quote, false);
  assert.equal(quoted.warranty, false);
  assert.equal(quoted.extra, true);
  const catalog = model.normalizeCatalog(model.publicCatalog());
  const ready = model.presentLists(catalog, model.blankState());
  const firstScreen = model.collapsedPanels({}, ready.selection.extraIds.length > 0, "category");
  assert.equal(ready.canQuote, true);
  assert.equal(firstScreen.service, true);
  assert.equal(firstScreen.brand, true);
  assert.equal(firstScreen.quote, true);

  const quoteJs = read("pages/quote/quote.js");
  assert.match(quoteJs, /collapsedPanels/);
  assert.match(quoteJs, /syncPanels\("service"\)/);
  assert.match(quoteJs, /syncPanels\("quote"\)/);
  assert.match(quoteJs, /确认报价 · 签名/);
  assert.match(read("pages/quote/quote.wxml"), /dock-amount/);
  assert.match(read("pages/quote/quote.wxml"), /onConfirm/);

  const account = read("pages/account/account.wxml");
  const debugAt = account.indexOf("showDebugTools");
  assert.ok(debugAt > account.indexOf("onLogout"));
  const before = account.slice(0, debugAt);
  assert.equal(before.includes("报价接口"), false);
  assert.equal(before.includes("本地演示数据"), false);
  assert.match(before, /开具收据权限/);
  assert.match(before, /内部人员登录/);
  const debug = account.slice(debugAt);
  assert.match(debug, /报价接口/);
  assert.match(debug, /本地演示数据/);
  const accountJs = read("pages/account/account.js");
  assert.match(accountJs, /envVersion === "develop"/);
  assert.match(accountJs, /onDebugEntry/);
  assert.match(accountJs, /showDebugTools = true/);

  const claim = model.presentReceipt({ amount: 10, lines: [], warrantyDays: 30 }, "");
  assert.equal(claim.claimText, "收据已保存在师傅端，可在历史报价中查看。");
  assert.equal(/公众号|订阅消息|扫码|领取/.test(claim.claimText), false);
  const receiptWxml = read("pages/receipt/receipt.wxml");
  assert.match(receiptWxml, /claimText/);
  assert.equal(/公众号|订阅消息/.test(receiptWxml), false);

  const previewRoot = path.resolve(root, "../miniapp-ui");
  const preview = fs.readFileSync(path.join(previewRoot, "index.html"), "utf8");
  const previewJs = fs.readFileSync(path.join(previewRoot, "app.js"), "utf8");
  assert.match(preview, /class="panel collapsible" data-panel="category"/);
  assert.match(preview, /class="panel service-panel collapsible is-collapsed"/);
  assert.match(preview, /class="panel brand-panel collapsible is-collapsed"/);
  assert.match(preview, /class="panel collapsible is-collapsed" data-panel="extra"/);
  assert.match(preview, /class="panel collapsible is-collapsed" data-panel="warranty"/);
  assert.match(preview, /class="quote-card inline-quote collapsible is-collapsed"/);
  assert.equal(/关注公众号|订阅消息|扫码领取/.test(preview + previewJs), false);
  assert.match(preview, /收据已保存在师傅端，可在历史报价中查看。/);
  assert.match(previewJs, /function revealStep/);
  assert.match(preview, /id="dockTotal"/);
  assert.match(preview, /确认报价 · 签名/);
}

assertStructure();
assertMockMath();
assertUiPolish();
await assertServerParity();
console.log("miniprogram quote checks passed");
