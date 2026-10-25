import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "../src/server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "local-backend/scripts/import-standard-quote.py");
const workbook = path.join(root, "壹思源维修—标准报价表.xlsx");
const dbFile = path.join(os.tmpdir(), `yisiyuan-quote-import-${process.pid}.sqlite`);

function runImport(args, env = process.env) {
  return spawnSync("python3", [script, ...args], { encoding: "utf8", env });
}

function parseSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const line = result.stdout.trim().split("\n").at(-1);
  const payload = JSON.parse(line);
  assert.equal(payload.ok, true);
  assert.match(result.stdout, /标准报价导入成功/);
  assert.match(result.stdout, /时间: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  assert.match(result.stdout, /品类: \d+/);
  assert.match(result.stdout, /服务项目: \d+/);
  assert.match(result.stdout, /特殊费用: \d+/);
  return payload;
}

async function removeDb(file) {
  const dir = path.dirname(file);
  const stem = path.basename(file, path.extname(file));
  const names = await fs.readdir(dir).catch(() => []);
  await Promise.all(names.filter((name) => name === path.basename(file) || name.startsWith(`${stem}.`) || name.startsWith(`${stem}-`)).map((name) => fs.rm(path.join(dir, name), { force: true })));
}

function backupNames() {
  const stem = path.basename(dbFile, ".sqlite");
  return fs.readdir(path.dirname(dbFile)).then((names) => names.filter((name) => name.startsWith(`${stem}.before-excel-`)));
}

async function request(baseUrl, method, pathname, { token, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, payload };
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function snapshot(file) {
  const database = new DatabaseSync(file);
  try {
    const rows = (sql) => database.prepare(sql).all();
    return {
      staff: rows("SELECT id, name, mobile, password, role, enabled, can_issue_receipts, COALESCE(wechat_openid, '') AS wechat_openid, COALESCE(wechat_unionid, '') AS wechat_unionid FROM staff_users ORDER BY id"),
      customers: rows("SELECT id, openid, nickname, mobile FROM customers ORDER BY id"),
      sessions: rows("SELECT token, type, user_id FROM sessions ORDER BY token"),
      receipts: rows("SELECT id, no, customer_name, amount, brand_id, service_id, city_id FROM receipts ORDER BY id"),
      cities: rows("SELECT id, name, multiplier FROM cities ORDER BY id"),
      regions: rows("SELECT id, city, region, multiplier FROM regions ORDER BY id"),
    };
  } finally {
    database.close();
  }
}

function mutateProtectedRows() {
  const database = new DatabaseSync(dbFile);
  try {
    database.exec("BEGIN IMMEDIATE");
    database.prepare("UPDATE staff_users SET can_issue_receipts = 1, wechat_openid = ?, wechat_unionid = ? WHERE id = ?").run("openid-tech-keep", "union-keep", "staff_tech");
    database.prepare("INSERT INTO customers (id, openid, nickname, mobile, created_at) VALUES (?, ?, ?, ?, ?)").run("customer_keep", "openid-customer-keep", "保留客户", "13900000000", "2026-10-25T00:00:00.000Z");
    database.prepare("INSERT INTO sessions (token, type, user_id, created_at) VALUES (?, ?, ?, ?)").run("token-keep", "staff", "staff_admin", "2026-10-25T00:00:00.000Z");
    database.prepare(`
      INSERT INTO receipts (
        id, no, scene, created_by_staff_id, customer_name, customer_phone, openid,
        service_id, service_name, brand_id, brand_name, city_id, city_name,
        warranty_days, amount, lines, qr
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "receipt_keep",
      "YSYKEEP",
      "receipt_keep",
      "staff_tech",
      "保留客户",
      "13900000000",
      "openid-customer-keep",
      "air-basic",
      "挂机普通维修",
      "gree",
      "格力",
      "shanghai",
      "上海",
      30,
      188,
      "[]",
      "{}",
    );
    database.exec("COMMIT");
  } finally {
    database.close();
  }
}

async function main() {
  const probe = spawnSync("python3", ["-c", "import openpyxl"], { encoding: "utf8" });
  assert.equal(probe.status, 0, "需要先安装 openpyxl：python3 -m pip install -r local-backend/requirements.txt");
  await fs.access(workbook);
  await removeDb(dbFile);

  const server = createServer({ dbFile });
  const baseUrl = await listen(server);
  try {
    const catalog = await request(baseUrl, "GET", "/api/catalog");
    assert.equal(catalog.status, 200);
    assert.equal(catalog.payload.services.some((item) => item.name === "更换电容/传感器"), true);
  } finally {
    await close(server);
  }

  mutateProtectedRows();
  const preserved = snapshot(dbFile);

  const missingBook = runImport([path.join(os.tmpdir(), `missing-quote-${process.pid}.xlsx`), dbFile]);
  assert.notEqual(missingBook.status, 0);
  assert.match(missingBook.stderr, /找不到标准报价表/);
  assert.deepEqual(snapshot(dbFile), preserved);
  assert.deepEqual(await backupNames(), []);

  const badBook = path.join(os.tmpdir(), `bad-quote-${process.pid}.xlsx`);
  const badBookScript = spawnSync("python3", ["-c", "import openpyxl,sys; book=openpyxl.Workbook(); book.active.title='其他'; book.save(sys.argv[1])", badBook], { encoding: "utf8" });
  assert.equal(badBookScript.status, 0, badBookScript.stderr);
  const badImport = runImport([badBook, dbFile]);
  assert.notEqual(badImport.status, 0);
  assert.match(badImport.stderr, /不是标准报价表/);
  assert.deepEqual(snapshot(dbFile), preserved);
  assert.deepEqual(await backupNames(), []);
  await fs.rm(badBook, { force: true });

  const missingDb = runImport([workbook, path.join(os.tmpdir(), `missing-db-${process.pid}`, "none.sqlite")]);
  assert.notEqual(missingDb.status, 0);
  assert.match(missingDb.stderr, /数据库不存在/);

  const first = parseSuccess(runImport([workbook, dbFile]));
  assert.equal(first.categories, 21);
  assert.equal(first.services, 78);
  assert.equal(first.extras, 11);
  assert.equal(first.brands, 1);
  assert.equal(first.preserved.staffUsers, 3);
  assert.equal(first.preserved.receipts, 1);
  assert.equal(first.preserved.customers, 1);
  assert.equal(first.preserved.sessions, 1);
  assert.equal(first.preserved.cities, 4);
  assert.equal(first.preserved.regions, 4);
  assert.equal(await fs.access(first.backup).then(() => true, () => false), true);
  const backupSnapshot = snapshot(first.backup);
  assert.equal(backupSnapshot.staff.some((item) => item.wechat_openid === "openid-tech-keep"), true);
  assert.equal(backupSnapshot.receipts.some((item) => item.no === "YSYKEEP"), true);
  const backupDb = new DatabaseSync(first.backup);
  try {
    const oldService = backupDb.prepare("SELECT name FROM services WHERE name = ?").get("更换电容/传感器");
    assert.equal(oldService.name, "更换电容/传感器");
  } finally {
    backupDb.close();
  }
  assert.deepEqual(snapshot(dbFile), preserved);

  const database = new DatabaseSync(dbFile);
  let seededValue = "";
  try {
    const visit = database.prepare("SELECT name, low, high, price_text, warranty_days FROM services WHERE name = ?").get("市区上门检测");
    assert.equal(visit.name, "市区上门检测");
    assert.equal(visit.low, 30);
    assert.equal(visit.high, 50);
    assert.equal(visit.price_text, "30-50");
    assert.equal(visit.warranty_days, 0);
    const remote = database.prepare("SELECT amount, price FROM extras WHERE name = ?").get("远程费");
    assert.equal(remote.amount, 65);
    assert.match(remote.price, /30-100元/);
    const height = database.prepare("SELECT amount FROM extras WHERE name = ?").get("高空费");
    assert.equal(height.amount, 75);
    const brand = database.prepare("SELECT id, name, factor FROM brands").all();
    assert.equal(brand.length, 1);
    assert.equal(brand[0].id, "brand_general");
    assert.equal(brand[0].name, "通用品牌");
    assert.equal(brand[0].factor, 1);
    seededValue = database.prepare("SELECT value FROM app_meta WHERE key = 'seeded'").get().value;
    database.prepare("DELETE FROM app_meta WHERE key = 'seeded'").run();
  } finally {
    database.close();
  }
  assert.ok(seededValue);

  const restarted = createServer({ dbFile });
  const restartedUrl = await listen(restarted);
  try {
    const catalog = await request(restartedUrl, "GET", "/api/catalog");
    assert.equal(catalog.status, 200);
    assert.equal(catalog.payload.categories.some((item) => item.name === "空调维修"), false);
    assert.equal(catalog.payload.services.some((item) => item.id === "air-capacitor"), false);
    const visit = catalog.payload.services.find((item) => item.name === "市区上门检测");
    assert.equal(visit.low, 30);
    assert.equal(visit.high, 50);
    assert.equal(visit.warrantyDays, 0);
    assert.equal(visit.includes, "上门、初检、报价");
    const cleaning = catalog.payload.services.find((item) => item.name === "挂机普通清洗");
    assert.equal(cleaning.low, 60);
    assert.equal(cleaning.high, 80);
    assert.equal(cleaning.warrantyDays, 7);
    const repair = catalog.payload.services.find((item) => item.name === "开关/插座维修更换");
    assert.equal(repair.low, 50);
    assert.equal(repair.high, 100);
    assert.equal(repair.warrantyDays, 30);
    const bundle = catalog.payload.services.find((item) => item.name === "家电基础检测包");
    assert.equal(bundle.low, 99);
    assert.equal(bundle.high, 150);
    assert.equal(bundle.includes, "适用合作商：物业/公寓/门店");
    for (const name of ["基础服务", "空调", "空调清洗", "电路维修", "合作套餐"]) {
      assert.equal(catalog.payload.categories.some((item) => item.name === name), true, name);
    }
    assert.equal(catalog.payload.categories.length, 21);
    assert.equal(catalog.payload.services.length, 78);
    assert.equal(catalog.payload.extras.length, 11);
    assert.equal(catalog.payload.brands.length, 1);
    assert.equal(catalog.payload.brands[0].id, "brand_general");
    assert.equal(catalog.payload.brands[0].factor, 1);
    const remote = catalog.payload.extras.find((item) => item.name === "远程费");
    assert.equal(remote.amount, 65);
    const height = catalog.payload.extras.find((item) => item.name === "高空费");
    assert.equal(height.amount, 75);
    const night = catalog.payload.extras.find((item) => item.name === "夜间/节假日加急");
    assert.equal(night.amount, 50);
    const ceiling = catalog.payload.extras.find((item) => item.name === "拆吊顶/拆柜体");
    assert.equal(ceiling.amount, 190);
    assert.equal(catalog.payload.cities.find((item) => item.name === "上海").rate, "+10%");

    const quote = await request(restartedUrl, "POST", "/api/quotes/calculate", {
      body: { serviceIds: [visit.id], brandId: "brand_general", cityId: "hangzhou", extraIds: [remote.id] },
    });
    assert.equal(quote.status, 200, JSON.stringify(quote.payload));
    assert.equal(quote.payload.total, 105);
    const shanghai = await request(restartedUrl, "POST", "/api/quotes/calculate", {
      body: { serviceIds: [visit.id], brandId: "brand_general", cityId: "shanghai", extraIds: [] },
    });
    assert.equal(shanghai.status, 200, JSON.stringify(shanghai.payload));
    assert.equal(shanghai.payload.total, 44);

    const login = await request(restartedUrl, "POST", "/api/auth/staff-login", {
      body: { mobile: "18800000001", password: "123456" },
    });
    assert.equal(login.status, 200);
    const token = login.payload.token;
    const assets = await request(restartedUrl, "GET", "/api/admin/assets", { token });
    assert.equal(assets.payload.categories.length, 21);
    assert.equal(assets.payload.brands.length, 1);
    assert.equal(assets.payload.quoteImport.importedAt, first.importedAt);
    assert.equal(assets.payload.quoteImport.source, workbook);
    assert.deepEqual(assets.payload.quoteImport.counts, { categories: 21, services: 78, extras: 11, brands: 1 });
    const operations = await request(restartedUrl, "GET", "/api/admin/operations", { token });
    assert.equal(operations.payload.rules.length, 11);
    assert.equal(operations.payload.rules.some((item) => item.name === "远程费"), true);
    assert.equal(operations.payload.cities.length, 4);
    assert.equal(operations.payload.regions.some((item) => item.region === "浦东新区"), true);
    assert.equal(operations.payload.quoteImport.importedAt, first.importedAt);
    const services = await request(restartedUrl, "GET", "/api/admin/services", { token });
    assert.equal(services.payload.services.length, 78);
    assert.equal(services.payload.quoteImport.counts.services, 78);
    const permissions = await request(restartedUrl, "GET", "/api/admin/permissions", { token });
    const tech = permissions.payload.staffUsers.find((item) => item.id === "staff_tech");
    assert.equal(tech.canIssueReceipts, true);
    assert.equal(tech.wechatBound, true);
    const receipts = await request(restartedUrl, "GET", "/api/admin/receipts", { token });
    assert.equal(receipts.payload.receipts.some((item) => item.no === "YSYKEEP"), true);
    const adminPage = await fetch(`${restartedUrl}/admin/`, { headers: { Cookie: `ysy_staff_token=${token}` } });
    const html = await adminPage.text();
    assert.equal(adminPage.status, 200);
    assert.match(html, /id="quoteImportStatus"/);

    const meta = new DatabaseSync(dbFile);
    try {
      const seededAgain = meta.prepare("SELECT value FROM app_meta WHERE key = 'seeded'").get();
      assert.equal(seededAgain.value, first.importedAt);
    } finally {
      meta.close();
    }
  } finally {
    await close(restarted);
  }

  const afterApi = snapshot(dbFile);
  assert.equal(afterApi.staff.find((item) => item.id === "staff_tech").wechat_openid, "openid-tech-keep");
  assert.equal(afterApi.receipts.some((item) => item.no === "YSYKEEP"), true);
  const second = parseSuccess(runImport([workbook, dbFile]));
  assert.notEqual(second.backup, first.backup);
  assert.equal(second.categories, 21);
  assert.equal(second.services, 78);
  assert.equal(second.extras, 11);
  assert.equal(second.preserved.staffUsers, afterApi.staff.length);
  assert.equal(second.preserved.receipts, afterApi.receipts.length);
  assert.deepEqual(snapshot(dbFile), afterApi);
  const names = await backupNames();
  assert.equal(names.length, 2);
  assert.ok(names.every((name) => name.endsWith(".sqlite")));

  await removeDb(dbFile);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
