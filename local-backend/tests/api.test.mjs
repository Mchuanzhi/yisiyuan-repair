import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createServer, parseEnvText } from "../src/server.mjs";

const dbFile = path.join(os.tmpdir(), "yisiyuan-repair-test-db.sqlite");

async function removeTestDb() {
  await Promise.all([
    fs.rm(dbFile, { force: true }),
    fs.rm(`${dbFile}-wal`, { force: true }),
    fs.rm(`${dbFile}-shm`, { force: true }),
  ]);
}

async function request(baseUrl, method, pathname, { token, cookie, body, redirect } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    redirect,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  return { status: response.status, payload, headers: response.headers };
}

async function main() {
  await removeTestDb();

  const server = createServer({ dbFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const home = await request(baseUrl, "GET", "/");
    assert.equal(home.status, 200);
    assert.match(home.payload, /后台登录/);

    const adminWithoutLogin = await request(baseUrl, "GET", "/admin/", { redirect: "manual" });
    assert.equal(adminWithoutLogin.status, 302);
    assert.match(adminWithoutLogin.headers.get("location"), /^\/login/);

    const formLogin = await fetch(`${baseUrl}/admin-login`, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ mobile: "18800000001", password: "123456", next: "/admin/" }),
    });
    assert.equal(formLogin.status, 302);
    assert.equal(formLogin.headers.get("location"), "/admin/");
    assert.match(formLogin.headers.get("set-cookie"), /ysy_staff_token=/);

    const miniappPage = await request(baseUrl, "GET", "/miniapp/");
    assert.equal(miniappPage.status, 200);
    assert.match(miniappPage.payload, /壹思源维修报价/);

    const health = await request(baseUrl, "GET", "/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.payload.ok, true);

    const catalog = await request(baseUrl, "GET", "/api/catalog");
    assert.equal(catalog.status, 200);
    assert.ok(catalog.payload.services.length >= 1);

    const unauthorized = await request(baseUrl, "GET", "/api/customer/receipts");
    assert.equal(unauthorized.status, 401);

    const staffLogin = await request(baseUrl, "POST", "/api/auth/staff-login", {
      body: { mobile: "18800000002", password: "123456" },
    });
    assert.equal(staffLogin.status, 200);
    assert.equal(staffLogin.payload.user.role, "technician");
    const staffToken = staffLogin.payload.token;
    const staffCookie = staffLogin.headers.get("set-cookie");
    assert.match(staffCookie, /ysy_staff_token=/);

    const adminPage = await request(baseUrl, "GET", "/admin/", { cookie: staffCookie });
    assert.equal(adminPage.status, 200);
    assert.match(adminPage.payload, /壹思源维修后台管理端/);

    const currentStaff = await request(baseUrl, "GET", "/api/auth/me", { cookie: staffCookie });
    assert.equal(currentStaff.status, 200);
    assert.equal(currentStaff.payload.user.role, "technician");

    const quote = await request(baseUrl, "POST", "/api/quotes/calculate", {
      body: {
        serviceId: "air-capacitor",
        brandId: "gree",
        cityId: "shanghai",
        extraIds: ["remote"],
      },
    });
    assert.equal(quote.status, 200);
    assert.ok(quote.payload.total > 0);
    const secondQuote = await request(baseUrl, "POST", "/api/quotes/calculate", { body: { serviceId: "air-basic", brandId: "gree", cityId: "shanghai" } });
    const multiQuote = await request(baseUrl, "POST", "/api/quotes/calculate", { body: { serviceIds: ["air-capacitor", "air-basic"], brandId: "gree", cityId: "shanghai" } });
    assert.equal(multiQuote.status, 200);
    assert.equal(multiQuote.payload.services.length, 2);
    assert.equal(multiQuote.payload.total, quote.payload.total - 50 + secondQuote.payload.total);

    const receiptBody = { customerName: "权限测试", serviceId: "air-capacitor", brandId: "gree", cityId: "shanghai", signatureDataUrl: "data:image/png;base64,dGVzdA==" };
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { body: receiptBody })).status, 401);
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: staffToken, body: receiptBody })).status, 403);
    const permissionAdmin = await request(baseUrl, "POST", "/api/auth/staff-login", { body: { mobile: "18800000001", password: "123456" } });
    const permissionToken = permissionAdmin.payload.token;
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: permissionToken, body: receiptBody })).status, 403);
    const permissionUrl = "/api/admin/staff/staff_tech/receipt-permission";
    assert.equal((await request(baseUrl, "PATCH", permissionUrl, { token: staffToken, body: { canIssueReceipts: true } })).status, 403);
    assert.equal((await request(baseUrl, "PATCH", permissionUrl, { token: permissionToken, body: { canIssueReceipts: "true" } })).status, 400);
    assert.equal((await request(baseUrl, "PATCH", permissionUrl, { token: permissionToken, body: { canIssueReceipts: true } })).status, 200);
    assert.equal((await request(baseUrl, "GET", "/api/auth/me", { token: staffToken })).payload.user.canIssueReceipts, true);
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: staffToken, body: { ...receiptBody, expectedTotal: -1 } })).status, 409);
    const newStaff = await request(baseUrl, "POST", "/api/admin/staff", { token: permissionToken, body: { name: "新师傅", mobile: "18800000009", password: "test123456", canIssueReceipts: true, role: "admin" } });
    assert.equal(newStaff.status, 201);
    assert.equal(newStaff.payload.user.canIssueReceipts, false);
    assert.equal(newStaff.payload.user.role, "technician");
    assert.equal((await request(baseUrl, "POST", "/api/admin/staff", { token: staffToken, body: { name: "非法", mobile: "18800000008", password: "test123456" } })).status, 403);
    const created = await request(baseUrl, "POST", "/api/staff/receipts", {
      token: staffToken,
      body: {
        customerName: "测试客户",
        customerPhone: "13900000000",
        serviceIds: ["air-capacitor", "air-basic"],
        brandId: "gree",
        cityId: "shanghai",
        extraIds: ["remote"],
        warrantyDays: 90,
        signatureDataUrl: "data:image/png;base64,dGVzdA==",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(created.payload.receipt.followStatus, "待关注");
    assert.equal(created.payload.receipt.claimStatus, "待关注登录");
    assert.equal(created.payload.receipt.warrantyDays, 90);
    assert.match(created.payload.receipt.serviceName, /更换电容\/传感器、挂机普通维修/);
    const scene = created.payload.receipt.scene;
    assert.equal((await request(baseUrl, "PATCH", permissionUrl, { token: permissionToken, body: { canIssueReceipts: false } })).status, 200);
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: staffToken, body: receiptBody })).status, 403);
    const supportLogin = await request(baseUrl, "POST", "/api/auth/staff-login", { body: { mobile: "18800000003", password: "123456" } });
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: supportLogin.payload.token, body: receiptBody })).status, 403);
    const reopenedServer = createServer({ dbFile });
    await new Promise(resolve => reopenedServer.listen(0, "127.0.0.1", resolve));
    try {
      const restored = await request(`http://127.0.0.1:${reopenedServer.address().port}`, "GET", "/api/auth/me", { token: staffToken });
      assert.equal(restored.payload.user.canIssueReceipts, false);
    } finally { await new Promise(resolve => reopenedServer.close(resolve)); }

    const scanBeforeFollow = await request(baseUrl, "POST", "/api/wechat/scan", {
      body: { scene, openid: "openid_test_001", subscribed: false },
    });
    assert.equal(scanBeforeFollow.status, 200);
    assert.equal(scanBeforeFollow.payload.nextAction, "follow_official_account");

    const scanAfterFollow = await request(baseUrl, "POST", "/api/wechat/scan", {
      body: { scene, openid: "openid_test_001", subscribed: true },
    });
    assert.equal(scanAfterFollow.status, 200);
    assert.equal(scanAfterFollow.payload.nextAction, "wechat_login");

    const customerLogin = await request(baseUrl, "POST", "/api/customer/wechat-login", {
      body: { openid: "openid_test_001", nickname: "测试客户" },
    });
    assert.equal(customerLogin.status, 200);
    const customerToken = customerLogin.payload.token;
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: customerToken, body: receiptBody })).status, 401);

    const claim = await request(baseUrl, "POST", "/api/customer/claim", {
      token: customerToken,
      body: { scene },
    });
    assert.equal(claim.status, 200);
    assert.equal(claim.payload.receipt.loginStatus, "已授权登录");
    assert.equal(claim.payload.receipt.claimStatus, "已登录领取");
    assert.equal(claim.payload.receipt.warrantyCountdown.status, "active");

    const myReceipts = await request(baseUrl, "GET", "/api/customer/receipts", {
      token: customerToken,
    });
    assert.equal(myReceipts.status, 200);
    assert.equal(myReceipts.payload.receipts.length, 1);
    assert.equal(myReceipts.payload.receipts[0].no, created.payload.receipt.no);

    const adminLogin = await request(baseUrl, "POST", "/api/auth/staff-login", {
      body: { mobile: "18800000001", password: "123456" },
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = adminLogin.payload.token;
    const invalidBrand = await request(baseUrl, "POST", "/api/admin/brands", { token: adminToken, body: { name: "未关联品牌", categoryIds: [] } });
    assert.equal(invalidBrand.status, 400);
    const linkedBrand = await request(baseUrl, "POST", "/api/admin/brands", { token: adminToken, body: { name: "限定品牌", categoryIds: ["washer"], factor: 1.2 } });
    assert.equal(linkedBrand.status, 201);
    const linkedAssets = await request(baseUrl, "GET", "/api/admin/assets", { token: adminToken });
    const linked = linkedAssets.payload.brands.find(item => item.name === "限定品牌");
    assert.deepEqual(linked.categories, ["洗衣机"]);
    assert.equal(linked.factor, 1.2);
    const mismatchedQuote = await request(baseUrl, "POST", "/api/quotes/calculate", { body: { serviceId: "air-capacitor", brandId: linked.id, cityId: "shanghai" } });
    assert.equal(mismatchedQuote.status, 400);
    const invalidFactor = await request(baseUrl, "PATCH", `/api/admin/brands/${linked.id}`, { token: adminToken, body: { factor: -1 } });
    assert.equal(invalidFactor.status, 400);
    await request(baseUrl, "DELETE", `/api/admin/brands/${linked.id}`, { token: adminToken });
    const draft = await request(baseUrl, "POST", "/api/admin/services", { token: adminToken, body: { categoryId: "air", name: "统一数据测试", low: 100, high: 200, part: 50, warrantyDays: 7, enabled: false } });
    assert.equal(draft.status, 201);
    const syncedId = draft.payload.service.id;
    assert.equal((await request(baseUrl, "GET", "/api/catalog")).payload.services.some(item => item.id === syncedId), false);
    const updated = await request(baseUrl, "PATCH", `/api/admin/services/${syncedId}`, { token: adminToken, body: { enabled: true, low: 200, high: 300 } });
    assert.equal(updated.status, 200);
    const syncedCatalog = (await request(baseUrl, "GET", "/api/catalog")).payload;
    assert.equal(syncedCatalog.services.find(item => item.id === syncedId).low, 200);
    assert.equal(syncedCatalog.categories.find(item => item.id === "air").count, syncedCatalog.services.filter(item => item.categoryId === "air").length);
    const syncedQuote = await request(baseUrl, "POST", "/api/quotes/calculate", { body: { serviceId: syncedId, brandId: "gree", cityId: "shanghai", extraIds: ["remote", "remote"] } });
    assert.equal(syncedQuote.payload.total, 401);
    const standardQuote = await request(baseUrl, "POST", "/api/quotes/calculate", { body: { serviceId: syncedId, brandId: "other", cityId: "shanghai", extraIds: ["remote"] } });
    assert.ok(syncedQuote.payload.total > standardQuote.payload.total, "品牌系数应作用于整项报价");
    assert.equal((await request(baseUrl, "PATCH", `/api/admin/services/${syncedId}`, { token: adminToken, body: { low: 400, high: 100 } })).status, 400);
    const concurrent = await Promise.all([1, 2].map(i => request(baseUrl, "POST", "/api/admin/services", { token: adminToken, body: { categoryId: "air", name: `并发项目${i}`, low: 10, high: 20 } })));
    const persistedServices = (await request(baseUrl, "GET", "/api/admin/services", { token: adminToken })).payload.services;
    for (const result of concurrent) { assert.equal(result.status, 201); assert.ok(persistedServices.some(item => item.id === result.payload.service.id)); }
    const ownerHistory = await request(baseUrl, "GET", "/api/staff/receipts", { token: staffToken });
    assert.equal(ownerHistory.payload.receipts.length, 1);
    assert.equal((await request(baseUrl, "GET", "/api/staff/receipts", { token: adminToken })).payload.receipts.length, 0);
    assert.equal((await request(baseUrl, "GET", "/api/staff/receipts")).status, 401);
    await request(baseUrl, "PATCH", `/api/admin/services/${syncedId}`, { token: adminToken, body: { enabled: false } });
    assert.equal((await request(baseUrl, "POST", "/api/quotes/calculate", { body: { serviceId: syncedId, brandId: "gree", cityId: "shanghai" } })).status, 400);
    for (const id of [syncedId, ...concurrent.map(item => item.payload.service.id)]) await request(baseUrl, "DELETE", `/api/admin/services/${id}`, { token: adminToken });
    assert.equal((await request(baseUrl, "GET", "/api/admin/services", { token: adminToken })).payload.services.some(item => item.id === syncedId), false);

    const adminReceipts = await request(baseUrl, "GET", "/api/admin/receipts", {
      token: adminToken,
    });
    assert.equal(adminReceipts.status, 200);
    assert.equal(adminReceipts.payload.receipts[0].claimStatus, "已登录领取");

    const permissions = await request(baseUrl, "GET", "/api/admin/permissions", {
      token: adminToken,
    });
    assert.equal(permissions.status, 200);
    assert.match(permissions.payload.customerRule, /关注公众号/);

    const operations = await request(baseUrl, "GET", "/api/admin/operations", {
      token: adminToken,
    });
    assert.equal(operations.status, 200);
    assert.ok(operations.payload.cities.length >= 1);
    assert.ok(operations.payload.regions.length >= 1);
    assert.ok(operations.payload.rules.length >= 1);

    const cityCreated = await request(baseUrl, "POST", "/api/admin/cities", {
      token: adminToken,
      body: { name: "测试城市", rate: "+6%", radius: "11公里" },
    });
    assert.equal(cityCreated.status, 201);
    assert.equal(cityCreated.payload.city.name, "测试城市");
    const cityId = cityCreated.payload.city.id;

    const cityUpdated = await request(baseUrl, "PATCH", `/api/admin/cities/${cityId}`, {
      token: adminToken,
      body: { rate: "+8%" },
    });
    assert.equal(cityUpdated.status, 200);
    assert.equal(cityUpdated.payload.city.rate, "+8%");

    const regionCreated = await request(baseUrl, "POST", "/api/admin/regions", {
      token: adminToken,
      body: { city: "测试城市", region: "测试区", rate: "+9%", radius: "8公里" },
    });
    assert.equal(regionCreated.status, 201);
    assert.equal(regionCreated.payload.region.city, "测试城市");
    const regionId = regionCreated.payload.region.id;

    const regionUpdated = await request(baseUrl, "PATCH", `/api/admin/regions/${regionId}`, {
      token: adminToken,
      body: { radius: "9公里" },
    });
    assert.equal(regionUpdated.status, 200);
    assert.equal(regionUpdated.payload.region.radius, "9公里");

    const ruleCreated = await request(baseUrl, "POST", "/api/admin/extras", {
      token: adminToken,
      body: { name: "测试特殊费", price: "10-20元", scene: "测试场景" },
    });
    assert.equal(ruleCreated.status, 201);
    assert.equal(ruleCreated.payload.rule.name, "测试特殊费");
    const ruleId = ruleCreated.payload.rule.id;

    const ruleUpdated = await request(baseUrl, "PATCH", `/api/admin/extras/${ruleId}`, {
      token: adminToken,
      body: { price: "20-30元" },
    });
    assert.equal(ruleUpdated.status, 200);
    assert.equal(ruleUpdated.payload.rule.price, "20-30元");

    const exportedReceipts = await request(baseUrl, "GET", "/api/admin/receipts/export", {
      token: adminToken,
    });
    assert.equal(exportedReceipts.status, 200);
    assert.match(exportedReceipts.payload, /收据编号/);

    const ruleDeleted = await request(baseUrl, "DELETE", `/api/admin/extras/${ruleId}`, {
      token: adminToken,
    });
    assert.equal(ruleDeleted.status, 200);

    const regionDeleted = await request(baseUrl, "DELETE", `/api/admin/regions/${regionId}`, {
      token: adminToken,
    });
    assert.equal(regionDeleted.status, 200);

    const cityDeleted = await request(baseUrl, "DELETE", `/api/admin/cities/${cityId}`, {
      token: adminToken,
    });
    assert.equal(cityDeleted.status, 200);

    const assets = await request(baseUrl, "GET", "/api/admin/assets", {
      token: adminToken,
    });
    assert.equal(assets.status, 200);
    assert.ok(assets.payload.categories.length >= 1);
    assert.ok(assets.payload.brands.length >= 1);

    const categoryCreated = await request(baseUrl, "POST", "/api/admin/categories", {
      token: adminToken,
      body: {
        name: "测试品类",
        tone: "#14766f",
        accent: "#f59f2f",
        image: "data:image/png;base64,dGVzdA==",
      },
    });
    assert.equal(categoryCreated.status, 201);
    assert.equal(categoryCreated.payload.category.name, "测试品类");
    const categoryId = categoryCreated.payload.category.id;

    const categoryUpdated = await request(baseUrl, "PATCH", `/api/admin/categories/${categoryId}`, {
      token: adminToken,
      body: { name: "测试品类已编辑" },
    });
    assert.equal(categoryUpdated.status, 200);
    assert.equal(categoryUpdated.payload.category.name, "测试品类已编辑");

    const brandCreated = await request(baseUrl, "POST", "/api/admin/brands", {
      token: adminToken,
      body: {
        name: "测试品牌",
        latin: "TEST",
        color: "#1877c9",
        categories: ["测试品类已编辑"],
        special: true,
        logo: "data:image/png;base64,dGVzdA==",
      },
    });
    assert.equal(brandCreated.status, 201);
    assert.equal(brandCreated.payload.brand.categories[0], "测试品类已编辑");
    const brandId = brandCreated.payload.brand.id;

    const brandUpdated = await request(baseUrl, "PATCH", `/api/admin/brands/${brandId}`, {
      token: adminToken,
      body: { name: "测试品牌已编辑", special: false },
    });
    assert.equal(brandUpdated.status, 200);
    assert.equal(brandUpdated.payload.brand.name, "测试品牌已编辑");

    const brandDeleted = await request(baseUrl, "DELETE", `/api/admin/brands/${brandId}`, {
      token: adminToken,
    });
    assert.equal(brandDeleted.status, 200);

    const categoryDeleted = await request(baseUrl, "DELETE", `/api/admin/categories/${categoryId}`, {
      token: adminToken,
    });
    assert.equal(categoryDeleted.status, 200);

    const logout = await request(baseUrl, "POST", "/api/auth/logout", { token: staffToken });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);

    const loggedOutAdmin = await request(baseUrl, "GET", "/admin/", { cookie: logout.headers.get("set-cookie"), redirect: "manual" });
    assert.equal(loggedOutAdmin.status, 302);

    await wechatAuthTests();
    console.log("All local backend API tests passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await removeTestDb();
  }
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function removeDb(dbFile) {
  await Promise.all([dbFile, `${dbFile}-wal`, `${dbFile}-shm`].map((file) => fs.rm(file, { force: true })));
}

async function withEnv(values, action) {
  const previous = new Map();
  for (const key of Object.keys(values)) {
    previous.set(key, process.env[key]);
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    return await action();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function mockExchange(code) {
  if (code === "bad") {
    const error = new Error("invalid code");
    error.status = 401;
    error.code = "wechat_code_invalid";
    throw error;
  }
  const table = {
    "code-tech": { openid: "openid-tech", unionid: "union-tech", sessionKey: "sk-should-not-leak" },
    "code-tech-2": { openid: "openid-tech", unionid: "union-tech", sessionKey: "sk-should-not-leak" },
    "code-other": { openid: "openid-other", sessionKey: "sk-other" },
  };
  const found = table[code];
  if (!found) {
    const error = new Error("invalid code");
    error.status = 401;
    error.code = "wechat_code_invalid";
    throw error;
  }
  return found;
}

async function wechatAuthTests() {
  const beforeSecret = process.env.WECHAT_APP_SECRET;
  const parsed = parseEnvText("# comment\nWECHAT_APP_SECRET=\"do-not-leak\"\nWECHAT_APPID=wx0123456789abcdef\n=bad\n");
  assert.equal(parsed.WECHAT_APP_SECRET, "do-not-leak");
  assert.equal(parsed.WECHAT_APPID, "wx0123456789abcdef");
  assert.equal(process.env.WECHAT_APP_SECRET, beforeSecret);

  const plainFile = path.join(os.tmpdir(), `yisiyuan-wechat-plain-${process.pid}.sqlite`);
  await removeDb(plainFile);
  const plain = createServer({ dbFile: plainFile });
  const plainUrl = await listen(plain);
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  let secretInUrl = false;
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    if (target.includes("jscode2session")) {
      fetchCalled = true;
      secretInUrl = target.includes("super-secret-value");
      throw new Error("jscode2session should not be called");
    }
    return originalFetch(url, options);
  };
  try {
    await withEnv({ WECHAT_APPID: undefined, WECHAT_APP_SECRET: undefined }, async () => {
      const missing = await request(plainUrl, "POST", "/api/auth/wechat-login", { body: { code: "anything" } });
      assert.equal(missing.status, 503);
      assert.equal(missing.payload.error, "wechat_not_configured");
      assert.equal(missing.payload.token, undefined);
      const health = await request(plainUrl, "GET", "/api/health");
      assert.equal(health.payload.wechatLogin, "not_configured");
    });
    await withEnv({ WECHAT_APPID: "wxXXXXXXXXXXXXXXXX", WECHAT_APP_SECRET: "super-secret-value" }, async () => {
      const placeholder = await request(plainUrl, "POST", "/api/auth/wechat-login", { body: { code: "anything" } });
      assert.equal(placeholder.status, 503);
      assert.equal(placeholder.payload.error, "wechat_not_configured");
      assert.equal(JSON.stringify(placeholder.payload).includes("super-secret-value"), false);
    });
    await withEnv({ WECHAT_APPID: "wx0123456789abcdef", WECHAT_APP_SECRET: undefined }, async () => {
      const noSecret = await request(plainUrl, "POST", "/api/auth/wechat-login", { body: { code: "anything" } });
      assert.equal(noSecret.status, 503);
    });
    assert.equal(fetchCalled, false);
    await withEnv({ WECHAT_APPID: "wx0123456789abcdef", WECHAT_APP_SECRET: "super-secret-value" }, async () => {
      const health = await request(plainUrl, "GET", "/api/health");
      assert.equal(health.payload.wechatLogin, "configured");
      assert.equal(JSON.stringify(health.payload).includes("super-secret-value"), false);
      assert.equal(JSON.stringify(health.payload).includes("wx0123456789abcdef"), false);
      const attempted = await request(plainUrl, "POST", "/api/auth/wechat-login", { body: { code: "anything" } });
      assert.equal(attempted.status, 502);
      assert.equal(attempted.payload.error, "wechat_unreachable");
      assert.equal(JSON.stringify(attempted.payload).includes("super-secret-value"), false);
    });
    assert.equal(fetchCalled, true);
    assert.equal(secretInUrl, true);
    const stillPassword = await request(plainUrl, "POST", "/api/auth/staff-login", {
      body: { mobile: "18800000002", password: "123456" },
    });
    assert.equal(stillPassword.status, 200);
    assert.equal(stillPassword.payload.user.canIssueReceipts, false);
    assert.equal(stillPassword.payload.user.wechatBound, false);
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => plain.close(resolve));
    await removeDb(plainFile);
  }

  const dbFile = path.join(os.tmpdir(), `yisiyuan-wechat-${process.pid}.sqlite`);
  await removeDb(dbFile);
  let active = createServer({ dbFile, exchangeWechatCode: mockExchange });
  let baseUrl = await listen(active);
  const receiptBody = {
    customerName: "微信开据",
    serviceId: "air-capacitor",
    brandId: "gree",
    cityId: "shanghai",
    signatureDataUrl: "data:image/png;base64,dGVzdA==",
  };
  try {
    assert.equal((await request(baseUrl, "POST", "/api/auth/wechat-login", { body: {} })).status, 400);
    assert.equal((await request(baseUrl, "POST", "/api/auth/wechat-login", { body: { code: "bad" } })).status, 401);

    const unbound = await request(baseUrl, "POST", "/api/auth/wechat-login", { body: { code: "code-tech" } });
    const sameOpenid = await request(baseUrl, "POST", "/api/auth/wechat-login", { body: { code: "code-tech-2" } });
    assert.equal(unbound.status, 200);
    assert.equal(unbound.payload.bound, false);
    assert.equal(sameOpenid.payload.bound, false);
    assert.equal(unbound.payload.token, undefined);
    const unboundText = JSON.stringify(unbound.payload);
    assert.equal(unboundText.includes("openid-tech"), false);
    assert.equal(unboundText.includes("sk-should-not-leak"), false);
    assert.equal(unboundText.includes("session_key"), false);
    assert.equal(unboundText.includes("sessionKey"), false);
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { body: receiptBody })).status, 401);

    const wrong = await request(baseUrl, "POST", "/api/auth/wechat-bind", {
      body: { bindTicket: unbound.payload.bindTicket, mobile: "18800000002", password: "wrong-pass" },
    });
    assert.equal(wrong.status, 401);
    assert.equal((await request(baseUrl, "POST", "/api/auth/wechat-login", { body: { code: "code-other" } })).payload.bound, false);

    const bound = await request(baseUrl, "POST", "/api/auth/wechat-bind", {
      body: { bindTicket: unbound.payload.bindTicket, mobile: " 18800000002 ", password: "123456" },
    });
    assert.equal(bound.status, 200);
    assert.equal(bound.payload.bound, true);
    assert.equal(bound.payload.user.id, "staff_tech");
    assert.equal(bound.payload.user.role, "technician");
    assert.equal(bound.payload.user.canIssueReceipts, false);
    assert.equal(bound.payload.user.wechatBound, true);
    assert.equal(JSON.stringify(bound.payload).includes("openid-tech"), false);
    assert.equal(JSON.stringify(bound.payload).includes("sk-should-not-leak"), false);
    const token = bound.payload.token;
    assert.match(bound.headers.get("set-cookie") || "", /ysy_staff_token=/);
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token, body: receiptBody })).status, 403);
    assert.equal((await request(baseUrl, "GET", "/api/customer/receipts", { token })).status, 401);

    const stolen = await request(baseUrl, "POST", "/api/auth/wechat-bind", {
      body: { bindTicket: sameOpenid.payload.bindTicket, mobile: "18800000003", password: "123456" },
    });
    assert.equal(stolen.status, 409);
    assert.equal(stolen.payload.error, "wechat_already_bound");

    const database = new DatabaseSync(dbFile);
    try {
      const row = database.prepare("SELECT wechat_openid, wechat_unionid, can_issue_receipts, password FROM staff_users WHERE id = ?").get("staff_tech");
      assert.equal(row.wechat_openid, "openid-tech");
      assert.equal(row.wechat_unionid, "union-tech");
      assert.equal(Number(row.can_issue_receipts), 0);
      assert.equal(row.password, "123456");
      const columns = database.prepare("PRAGMA table_info(staff_users)").all().map((column) => column.name);
      assert.equal(columns.includes("session_key"), false);
    } finally {
      database.close();
    }
    const raw = await fs.readFile(dbFile);
    assert.equal(raw.includes("sk-should-not-leak"), false);

    await new Promise((resolve) => active.close(resolve));
    active = createServer({ dbFile, exchangeWechatCode: mockExchange });
    baseUrl = await listen(active);
    const again = await request(baseUrl, "POST", "/api/auth/wechat-login", { body: { code: "code-tech" } });
    assert.equal(again.status, 200);
    assert.equal(again.payload.bound, true);
    assert.equal(again.payload.user.canIssueReceipts, false);
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: again.payload.token, body: receiptBody })).status, 403);

    const admin = await request(baseUrl, "POST", "/api/auth/staff-login", { body: { mobile: "18800000001", password: "123456" } });
    assert.equal((await request(baseUrl, "PATCH", "/api/admin/staff/staff_tech/receipt-permission", {
      token: admin.payload.token,
      body: { canIssueReceipts: true },
    })).status, 200);
    const me = await request(baseUrl, "GET", "/api/auth/me", { token: again.payload.token });
    assert.equal(me.payload.user.canIssueReceipts, true);
    assert.equal(me.payload.user.wechatBound, true);
    const created = await request(baseUrl, "POST", "/api/staff/receipts", { token: again.payload.token, body: receiptBody });
    assert.equal(created.status, 201);
    const history = await request(baseUrl, "GET", "/api/staff/receipts", { token: again.payload.token });
    assert.equal(history.payload.receipts.some((item) => item.no === created.payload.receipt.no), true);

    const permissions = await request(baseUrl, "GET", "/api/admin/permissions", { token: admin.payload.token });
    const tech = permissions.payload.staffUsers.find((item) => item.id === "staff_tech");
    assert.equal(tech.wechatBound, true);
    assert.equal(tech.wechatOpenid, undefined);
    assert.equal(JSON.stringify(permissions.payload).includes("openid-tech"), false);

    const other = await request(baseUrl, "POST", "/api/auth/wechat-login", { body: { code: "code-other" } });
    assert.equal(other.payload.bound, false);
    const otherOnTech = await request(baseUrl, "POST", "/api/auth/wechat-bind", {
      body: { bindTicket: other.payload.bindTicket, mobile: "18800000002", password: "123456" },
    });
    assert.equal(otherOnTech.status, 409);
    assert.equal(otherOnTech.payload.error, "staff_already_bound");
    const support = await request(baseUrl, "POST", "/api/auth/wechat-bind", {
      body: { bindTicket: other.payload.bindTicket, mobile: "18800000003", password: "123456" },
    });
    assert.equal(support.status, 200);
    assert.equal(support.payload.user.canIssueReceipts, false);
    assert.equal((await request(baseUrl, "POST", "/api/staff/receipts", { token: support.payload.token, body: receiptBody })).status, 403);

    assert.equal((await request(baseUrl, "PATCH", "/api/admin/staff/staff_tech", {
      token: admin.payload.token,
      body: { enabled: false },
    })).status, 200);
    const disabled = await request(baseUrl, "POST", "/api/auth/wechat-login", { body: { code: "code-tech" } });
    assert.equal(disabled.status, 403);
    assert.equal(disabled.payload.error, "staff_disabled");
  } finally {
    await new Promise((resolve) => active.close(resolve));
    await removeDb(dbFile);
  }

  const shortFile = path.join(os.tmpdir(), `yisiyuan-wechat-short-${process.pid}.sqlite`);
  await removeDb(shortFile);
  const short = createServer({ dbFile: shortFile, exchangeWechatCode: mockExchange, bindTicketTtlMs: -1 });
  const shortUrl = await listen(short);
  try {
    const ticket = await request(shortUrl, "POST", "/api/auth/wechat-login", { body: { code: "code-other" } });
    assert.equal(ticket.payload.bound, false);
    const expired = await request(shortUrl, "POST", "/api/auth/wechat-bind", {
      body: { bindTicket: ticket.payload.bindTicket, mobile: "18800000003", password: "123456" },
    });
    assert.equal(expired.status, 401);
    assert.equal(expired.payload.error, "bind_ticket_invalid");
  } finally {
    await new Promise((resolve) => short.close(resolve));
    await removeDb(shortFile);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
