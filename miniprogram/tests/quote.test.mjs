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
  assert.equal(project.appid, "wxXXXXXXXXXXXXXXXX");
  assert.equal(project.appid.includes("touristappid"), false);
  assert.match(read("config.js"), /wechatAppId:\s*"wxXXXXXXXXXXXXXXXX"/);
  assert.match(read("utils/api.js"), /wx\.login/);
  assert.match(read("utils/api.js"), /\/api\/auth\/wechat-login/);
  assert.match(read("utils/api.js"), /Authorization: "Bearer "/);
  assert.match(read("pages/account/account.wxml"), /微信登录/);
  assert.match(read("pages/account/account.js"), /绑定并登录/);
  assert.match(read("README.md"), /合法域名/);
  assert.match(read("README.md"), /WECHAT_APP_SECRET/);
  assert.match(read("README.md"), /project\.config\.json/);
  assert.deepEqual(app.tabBar.list.map((item) => item.pagePath), ["pages/quote/quote", "pages/history/history", "pages/account/account"]);
  assert.deepEqual(app.tabBar.list.map((item) => item.text), ["查价报价", "历史报价", "我的"]);
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
  assert.equal(read("pages/quote/quote.wxml").includes("我的"), false);
  assert.equal(read("pages/quote/quote.wxml").includes('class="mine"'), false);
  assert.equal(read("pages/history/history.wxml").includes("我的"), false);
  const navSources = ["pages/quote/quote.js", "pages/history/history.js", "pages/signature/signature.js", "pages/receipt/receipt.js", "pages/account/account.js"].map((file) => read(file)).join("\n");
  assert.equal(navSources.includes('navigateTo({ url: "/pages/account/account" })'), false);
  assert.equal(navSources.includes('redirectTo({ url: "/pages/account/account" })'), false);
  assert.match(read("pages/quote/quote.js"), /switchTab\(\{ url: "\/pages\/account\/account" \}\)/);
  assert.match(read("pages/history/history.js"), /switchTab\(\{ url: "\/pages\/account\/account" \}\)/);
  assert.match(read("pages/signature/signature.js"), /switchTab\(\{ url: "\/pages\/account\/account" \}\)/);
  assert.match(read("pages/account/account.wxml"), /pageHeight/);
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
    "images/tab-mine.png",
    "images/tab-mine-active.png",
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

assertStructure();
assertMockMath();
await assertServerParity();
console.log("miniprogram quote checks passed");
