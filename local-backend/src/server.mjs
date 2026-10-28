import http from "node:http";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_PORT = Number(process.env.PORT || 8787);
const DEFAULT_HOST = process.env.HOST || "127.0.0.1";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE_DIR = path.resolve(ROOT_DIR, "..");
const ADMIN_WEB_DIR = path.join(WORKSPACE_DIR, "admin-web");
const MINIAPP_UI_DIR = path.join(WORKSPACE_DIR, "miniapp-ui");
const DEFAULT_DB_FILE = path.join(ROOT_DIR, "data", "yisiyuan-repair.sqlite");
const STAFF_COOKIE_NAME = "ysy_staff_token";
const WECHAT_APPID_PLACEHOLDER = "wxXXXXXXXXXXXXXXXX";
const WECHAT_JSCODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";
const DEFAULT_BIND_TICKET_TTL_MS = 10 * 60 * 1000;

const seedData = {
  staffUsers: [
    { id: "staff_admin", name: "李主管", mobile: "18800000001", password: "123456", role: "admin", enabled: true },
    { id: "staff_tech", name: "张师傅", mobile: "18800000002", password: "123456", role: "technician", enabled: true },
    { id: "staff_support", name: "门店前台", mobile: "18800000003", password: "123456", role: "support", enabled: true },
  ],
  customers: [],
  sessions: [],
  categories: [
    { id: "air", name: "空调维修", count: 8, tone: "#14766f", accent: "#f59f2f", enabled: true },
    { id: "washer", name: "洗衣机", count: 5, tone: "#316fd1", accent: "#2f8f68", enabled: true },
    { id: "fridge", name: "冰箱冰柜", count: 4, tone: "#2f8ca3", accent: "#84c7d8", enabled: true },
    { id: "heater", name: "热水器", count: 5, tone: "#ce4d3d", accent: "#f1a33d", enabled: true },
    { id: "kitchen", name: "厨电维修", count: 6, tone: "#7d5a3a", accent: "#d9861f", enabled: true },
    { id: "water", name: "水电管道", count: 7, tone: "#28666e", accent: "#51a3a3", enabled: true },
    { id: "cleaning", name: "清洗保养", count: 9, tone: "#2f8f68", accent: "#316fd1", enabled: true },
  ],
  brands: [
    { id: "gree", name: "格力", latin: "GREE", color: "#0b7f72", factor: 1.08, categoryIds: ["air"], categories: ["空调维修"], special: true },
    { id: "midea", name: "美的", latin: "Midea", color: "#1877c9", factor: 1.05, categoryIds: ["air", "washer", "fridge", "heater", "kitchen"], categories: ["空调维修", "洗衣机", "冰箱冰柜", "热水器", "厨电维修"], special: true },
    { id: "haier", name: "海尔", latin: "Haier", color: "#139ed9", factor: 1.04, categoryIds: ["air", "washer", "fridge", "heater"], categories: ["空调维修", "洗衣机", "冰箱冰柜", "热水器"], special: true },
    { id: "aux", name: "奥克斯", latin: "AUX", color: "#d12d33", factor: 1.03, categoryIds: ["air"], categories: ["空调维修"], special: true },
    { id: "siemens", name: "西门子", latin: "SIEMENS", color: "#08706f", factor: 1.12, categoryIds: ["washer", "fridge", "kitchen"], categories: ["洗衣机", "冰箱冰柜", "厨电维修"], special: true },
    { id: "other", name: "其他品牌", latin: "OTHER", color: "#5f6f6c", factor: 1, categoryIds: ["air", "washer", "fridge", "heater", "kitchen", "water", "cleaning"], categories: ["全部品类"], special: false },
  ],
  cities: [
    { id: "shanghai", name: "上海", rate: "+10%", radius: "8公里", multiplier: 1.1, enabled: true },
    { id: "hangzhou", name: "杭州", rate: "标准", radius: "10公里", multiplier: 1, enabled: true },
    { id: "suzhou", name: "苏州", rate: "+5%", radius: "10公里", multiplier: 1.05, enabled: true },
    { id: "hefei", name: "合肥", rate: "-5%", radius: "12公里", multiplier: 0.95, enabled: true },
  ],
  regions: [
    { id: "region_shanghai_pudong", cityId: "shanghai", city: "上海", region: "浦东新区", rate: "+12%", radius: "8公里", multiplier: 1.12, enabled: true },
    { id: "region_shanghai_jingan", cityId: "shanghai", city: "上海", region: "静安区", rate: "+10%", radius: "6公里", multiplier: 1.1, enabled: true },
    { id: "region_hangzhou_binjiang", cityId: "hangzhou", city: "杭州", region: "滨江区", rate: "标准", radius: "10公里", multiplier: 1, enabled: true },
    { id: "region_suzhou_industrial", cityId: "suzhou", city: "苏州", region: "工业园区", rate: "+8%", radius: "9公里", multiplier: 1.08, enabled: true },
  ],
  services: [
    {
      id: "air-capacitor",
      categoryId: "air",
      name: "更换电容/传感器",
      desc: "启动电容、压缩机电容、温度传感器等",
      low: 90,
      high: 180,
      part: 65,
      warrantyDays: 90,
      includes: "拆装、检测、调试",
      excludes: "配件",
      enabled: true,
    },
    {
      id: "air-basic",
      categoryId: "air",
      name: "挂机普通维修",
      desc: "漏水、异响、遥控异常、传感器异常等小修",
      low: 80,
      high: 160,
      part: 0,
      warrantyDays: 30,
      includes: "检测、人工调试",
      excludes: "配件、高空",
      enabled: true,
    },
    {
      id: "water-faucet",
      categoryId: "water",
      name: "水龙头/角阀/软管更换",
      desc: "单点位检测、更换、接头处理",
      low: 50,
      high: 100,
      part: 35,
      warrantyDays: 30,
      includes: "人工",
      excludes: "材料",
      enabled: true,
    },
  ],
  extras: [
    { id: "remote", name: "远程费", price: "30-100元", scene: "超出约定服务半径", amount: 50, enabled: true },
    { id: "height", name: "高空费", price: "50-180元", scene: "空调外机、窗外施工", amount: 100, enabled: true },
    { id: "night", name: "夜间/节假日加急", price: "上浮20%-50%", scene: "紧急漏水、商户停业", amount: 80, enabled: true },
    { id: "heavy", name: "严重油污/重度污垢", price: "30-150元", scene: "厨房、油烟机、长期未清洗设备", amount: 60, enabled: true },
    { id: "ceiling", name: "拆吊顶/拆柜体", price: "80-300元起", scene: "隐藏设备检修", amount: 120, enabled: true },
  ],
  receipts: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function warrantyCountdown(expireDateText) {
  if (!expireDateText) return { status: "none", text: "不保修", daysLeft: null };
  const expire = new Date(`${expireDateText}T23:59:59`);
  const daysLeft = Math.ceil((expire.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return { status: "expired", text: `已过期 ${Math.abs(daysLeft)} 天`, daysLeft };
  if (daysLeft <= 7) return { status: "warning", text: `剩余 ${daysLeft} 天`, daysLeft };
  return { status: "active", text: `剩余 ${daysLeft} 天`, daysLeft };
}

function receiptNo(date = new Date()) {
  return `YSY${todayKey(date)}${String(date.getTime()).slice(-5)}`;
}

function encodeJson(value) {
  return JSON.stringify(value ?? []);
}

function decodeJson(value, fallback = []) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function boolFromDb(value) {
  return Boolean(Number(value));
}

function boolToDb(value) {
  return value ? 1 : 0;
}

function ensureColumn(database, table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function createSchema(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      openid TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      mobile TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      tone TEXT,
      accent TEXT,
      image TEXT,
      meta TEXT
    );

    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latin TEXT,
      color TEXT,
      factor REAL NOT NULL DEFAULT 1,
      category_ids TEXT NOT NULL DEFAULT '[]',
      categories TEXT NOT NULL DEFAULT '[]',
      special INTEGER NOT NULL DEFAULT 0,
      logo TEXT,
      meta TEXT
    );

    CREATE TABLE IF NOT EXISTS cities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      multiplier REAL NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      rate TEXT,
      radius TEXT
    );

    CREATE TABLE IF NOT EXISTS regions (
      id TEXT PRIMARY KEY,
      city_id TEXT,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      rate TEXT,
      radius TEXT,
      multiplier REAL NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      low INTEGER NOT NULL DEFAULT 0,
      high INTEGER NOT NULL DEFAULT 0,
      part INTEGER NOT NULL DEFAULT 0,
      warranty_days INTEGER NOT NULL DEFAULT 30,
      includes TEXT,
      excludes TEXT,
      price_text TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      meta TEXT
    );

    CREATE TABLE IF NOT EXISTS extras (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      price TEXT,
      scene TEXT
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      no TEXT NOT NULL UNIQUE,
      scene TEXT NOT NULL UNIQUE,
      created_by_staff_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      openid TEXT,
      customer_id TEXT,
      service_id TEXT,
      service_name TEXT,
      brand_id TEXT,
      brand_name TEXT,
      city_id TEXT,
      city_name TEXT,
      repair_time TEXT,
      warranty_days INTEGER NOT NULL DEFAULT 30,
      warranty_expire_date TEXT,
      amount INTEGER NOT NULL DEFAULT 0,
      lines TEXT NOT NULL DEFAULT '[]',
      includes TEXT,
      excludes TEXT,
      signature_data_url TEXT,
      stamp_name TEXT,
      follow_status TEXT,
      login_status TEXT,
      claim_status TEXT,
      voided INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      claimed_at TEXT,
      qr TEXT NOT NULL DEFAULT '{}'
    );
  `);
  ensureColumn(database, "staff_users", "can_issue_receipts", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "staff_users", "wechat_openid", "TEXT");
  ensureColumn(database, "staff_users", "wechat_unionid", "TEXT");
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_users_wechat_openid
    ON staff_users(wechat_openid)
    WHERE wechat_openid IS NOT NULL AND wechat_openid != ''
  `);
  ensureColumn(database, "cities", "rate", "TEXT");
  ensureColumn(database, "cities", "radius", "TEXT");
  ensureColumn(database, "extras", "price", "TEXT");
  ensureColumn(database, "extras", "scene", "TEXT");
  ensureColumn(database, "services", "price_text", "TEXT");
}

function seedIfEmpty(database) {
  const seeded = database.prepare("SELECT value FROM app_meta WHERE key = ?").get("seeded");
  if (seeded) return;
  const imported = database.prepare("SELECT value FROM app_meta WHERE key = ?").get("quote_imported_at");
  if (imported) {
    database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)").run("seeded", imported.value);
    return;
  }

  database.exec("BEGIN IMMEDIATE");
  try {
    writeDbRows(database, seedData);
    database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)").run("seeded", new Date().toISOString());
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function ensureReferenceRows(database) {
  const updateCity = database.prepare("UPDATE cities SET rate = COALESCE(rate, ?), radius = COALESCE(radius, ?) WHERE id = ?");
  for (const city of seedData.cities) {
    updateCity.run(city.rate || "", city.radius || "", city.id);
  }

  const updateExtra = database.prepare("UPDATE extras SET price = COALESCE(price, ?), scene = COALESCE(scene, ?) WHERE id = ?");
  for (const extra of seedData.extras) {
    updateExtra.run(extra.price || `${extra.amount}元`, extra.scene || "", extra.id);
  }

  const regionsSeeded = database.prepare("SELECT value FROM app_meta WHERE key = ?").get("regions_seeded");
  const regionCount = database.prepare("SELECT COUNT(*) AS count FROM regions").get().count;
  if (!regionsSeeded && !regionCount) {
    const insertRegion = database.prepare(`
      INSERT INTO regions (id, city_id, city, region, rate, radius, multiplier, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const region of seedData.regions) {
      insertRegion.run(region.id, region.cityId, region.city, region.region, region.rate, region.radius, Number(region.multiplier || 1), boolToDb(region.enabled !== false));
    }
    database.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)").run("regions_seeded", new Date().toISOString());
  }
}

async function withDatabase(dbFile, action) {
  await fs.mkdir(path.dirname(dbFile), { recursive: true });
  const database = new DatabaseSync(dbFile);
  try {
    createSchema(database);
    seedIfEmpty(database);
    ensureReferenceRows(database);
    return action(database);
  } finally {
    database.close();
  }
}

function writeDbRows(database, db) {
  database.prepare("DELETE FROM receipts").run();
  database.prepare("DELETE FROM sessions").run();
  database.prepare("DELETE FROM customers").run();
  database.prepare("DELETE FROM services").run();
  database.prepare("DELETE FROM extras").run();
  database.prepare("DELETE FROM regions").run();
  database.prepare("DELETE FROM cities").run();
  database.prepare("DELETE FROM brands").run();
  database.prepare("DELETE FROM categories").run();
  database.prepare("DELETE FROM staff_users").run();

  const insertStaff = database.prepare(`
    INSERT INTO staff_users (id, name, mobile, password, role, enabled, can_issue_receipts, wechat_openid, wechat_unionid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const user of db.staffUsers || []) {
    const wechatOpenid = String(user.wechatOpenid || "").trim();
    const wechatUnionid = String(user.wechatUnionid || "").trim();
    insertStaff.run(
      user.id,
      user.name,
      user.mobile,
      user.password,
      user.role,
      boolToDb(user.enabled),
      boolToDb(user.canIssueReceipts === true),
      wechatOpenid || null,
      wechatUnionid || null,
    );
  }

  const insertCategory = database.prepare(`
    INSERT INTO categories (id, name, enabled, sort_order, tone, accent, image, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [index, category] of (db.categories || []).entries()) {
    insertCategory.run(
      category.id,
      category.name,
      boolToDb(category.enabled !== false),
      index,
      category.tone || "",
      category.accent || "",
      category.image || "",
      encodeJson({ count: category.count ?? 0 }),
    );
  }

  const insertBrand = database.prepare(`
    INSERT INTO brands (id, name, latin, color, factor, category_ids, categories, special, logo, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const brand of db.brands || []) {
    insertBrand.run(
      brand.id,
      brand.name,
      brand.latin || "",
      brand.color || "",
      Number(brand.factor || 1),
      encodeJson(brand.categoryIds || []),
      encodeJson(brand.categories || []),
      boolToDb(brand.special),
      brand.logo || "",
      encodeJson({}),
    );
  }

  const insertCity = database.prepare(`
    INSERT INTO cities (id, name, multiplier, enabled, rate, radius)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const city of db.cities || []) {
    insertCity.run(city.id, city.name, Number(city.multiplier || 1), boolToDb(city.enabled !== false), city.rate || "", city.radius || "");
  }

  const insertRegion = database.prepare(`
    INSERT INTO regions (id, city_id, city, region, rate, radius, multiplier, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const region of db.regions || []) {
    insertRegion.run(
      region.id,
      region.cityId || "",
      region.city,
      region.region,
      region.rate || "",
      region.radius || "",
      Number(region.multiplier || 1),
      boolToDb(region.enabled !== false),
    );
  }

  const insertService = database.prepare(`
    INSERT INTO services (id, category_id, name, description, low, high, part, warranty_days, includes, excludes, price_text, enabled, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const service of db.services || []) {
    insertService.run(
      service.id,
      service.categoryId,
      service.name,
      service.desc || "",
      Number(service.low || 0),
      Number(service.high || 0),
      Number(service.part || 0),
      Number(service.warrantyDays ?? 30),
      service.includes || "",
      service.excludes || "",
      service.priceText || "",
      boolToDb(service.enabled !== false),
      encodeJson({}),
    );
  }

  const insertExtra = database.prepare(`
    INSERT INTO extras (id, name, amount, enabled, price, scene)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const extra of db.extras || []) {
    insertExtra.run(extra.id, extra.name, Number(extra.amount || 0), boolToDb(extra.enabled !== false), extra.price || `${Number(extra.amount || 0)}元`, extra.scene || "");
  }

  const insertCustomer = database.prepare(`
    INSERT INTO customers (id, openid, nickname, mobile, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const customer of db.customers || []) {
    insertCustomer.run(customer.id, customer.openid, customer.nickname, customer.mobile || "", customer.createdAt || new Date().toISOString());
  }

  const insertSession = database.prepare(`
    INSERT INTO sessions (token, type, user_id, created_at)
    VALUES (?, ?, ?, ?)
  `);
  for (const session of db.sessions || []) {
    insertSession.run(session.token, session.type, session.userId, session.createdAt || new Date().toISOString());
  }

  const insertReceipt = database.prepare(`
    INSERT INTO receipts (
      id, no, scene, created_by_staff_id, customer_name, customer_phone, openid, customer_id,
      service_id, service_name, brand_id, brand_name, city_id, city_name, repair_time,
      warranty_days, warranty_expire_date, amount, lines, includes, excludes, signature_data_url,
      stamp_name, follow_status, login_status, claim_status, voided, created_at, claimed_at, qr
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const receipt of db.receipts || []) {
    insertReceipt.run(
      receipt.id,
      receipt.no,
      receipt.scene,
      receipt.createdByStaffId || "",
      receipt.customerName,
      receipt.customerPhone || "",
      receipt.openid || "",
      receipt.customerId || "",
      receipt.serviceId || "",
      receipt.serviceName || "",
      receipt.brandId || "",
      receipt.brandName || "",
      receipt.cityId || "",
      receipt.cityName || "",
      receipt.repairTime || "",
      Number(receipt.warrantyDays ?? 30),
      receipt.warrantyExpireDate || "",
      Number(receipt.amount || 0),
      encodeJson(receipt.lines || []),
      receipt.includes || "",
      receipt.excludes || "",
      receipt.signatureDataUrl || "",
      receipt.stampName || "",
      receipt.followStatus || "",
      receipt.loginStatus || "",
      receipt.claimStatus || "",
      boolToDb(receipt.voided),
      receipt.createdAt || new Date().toISOString(),
      receipt.claimedAt || "",
      encodeJson(receipt.qr || {}),
    );
  }
}

function readDbRows(database) {
  const categories = database
    .prepare("SELECT * FROM categories ORDER BY sort_order, rowid")
    .all()
    .map((row) => {
      const meta = decodeJson(row.meta, {});
      return {
        id: row.id,
        name: row.name,
        count: Number(meta.count || 0),
        tone: row.tone || "#14766f",
        accent: row.accent || "#f59f2f",
        image: row.image || "",
        enabled: boolFromDb(row.enabled),
      };
    });

  return {
    staffUsers: database.prepare("SELECT * FROM staff_users ORDER BY rowid").all().map((row) => ({
      id: row.id,
      name: row.name,
      mobile: row.mobile,
      password: row.password,
      canIssueReceipts: boolFromDb(row.can_issue_receipts),
      role: row.role,
      enabled: boolFromDb(row.enabled),
      wechatOpenid: row.wechat_openid || "",
      wechatUnionid: row.wechat_unionid || "",
    })),
    customers: database.prepare("SELECT * FROM customers ORDER BY rowid").all().map((row) => ({
      id: row.id,
      openid: row.openid,
      nickname: row.nickname,
      mobile: row.mobile || "",
      createdAt: row.created_at,
    })),
    sessions: database.prepare("SELECT * FROM sessions ORDER BY rowid").all().map((row) => ({
      token: row.token,
      type: row.type,
      userId: row.user_id,
      createdAt: row.created_at,
    })),
    categories,
    brands: database.prepare("SELECT * FROM brands ORDER BY rowid").all().map((row) => ({
      id: row.id,
      name: row.name,
      latin: row.latin || row.name,
      color: row.color || "#14766f",
      factor: Number(row.factor || 1),
      categoryIds: decodeJson(row.category_ids, []),
      categories: decodeJson(row.categories, []),
      special: boolFromDb(row.special),
      logo: row.logo || "",
    })),
    cities: database.prepare("SELECT * FROM cities ORDER BY rowid").all().map((row) => ({
      id: row.id,
      name: row.name,
      rate: row.rate || (Number(row.multiplier || 1) === 1 ? "标准" : `${Math.round((Number(row.multiplier || 1) - 1) * 100)}%`),
      radius: row.radius || "10公里",
      multiplier: Number(row.multiplier || 1),
      enabled: boolFromDb(row.enabled),
    })),
    regions: database.prepare("SELECT * FROM regions ORDER BY rowid").all().map((row) => ({
      id: row.id,
      cityId: row.city_id || "",
      city: row.city,
      region: row.region,
      rate: row.rate || "标准",
      radius: row.radius || "10公里",
      multiplier: Number(row.multiplier || 1),
      enabled: boolFromDb(row.enabled),
    })),
    services: database.prepare("SELECT * FROM services ORDER BY rowid").all().map((row) => ({
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      desc: row.description || "",
      low: Number(row.low || 0),
      high: Number(row.high || 0),
      part: Number(row.part || 0),
      warrantyDays: Number(row.warranty_days ?? 30),
      includes: row.includes || "",
      excludes: row.excludes || "",
      priceText: row.price_text || "",
      enabled: boolFromDb(row.enabled),
    })),
    extras: database.prepare("SELECT * FROM extras ORDER BY rowid").all().map((row) => ({
      id: row.id,
      name: row.name,
      amount: Number(row.amount || 0),
      price: row.price || `${Number(row.amount || 0)}元`,
      scene: row.scene || "",
      enabled: boolFromDb(row.enabled),
    })),
    quoteImport: readQuoteImport(database),
    receipts: database.prepare("SELECT * FROM receipts ORDER BY rowid").all().map((row) => ({
      id: row.id,
      no: row.no,
      scene: row.scene,
      createdByStaffId: row.created_by_staff_id || "",
      customerName: row.customer_name,
      customerPhone: row.customer_phone || "",
      openid: row.openid || null,
      customerId: row.customer_id || null,
      serviceId: row.service_id || "",
      serviceName: row.service_name || "",
      brandId: row.brand_id || "",
      brandName: row.brand_name || "",
      cityId: row.city_id || "",
      cityName: row.city_name || "",
      repairTime: row.repair_time || "",
      warrantyDays: Number(row.warranty_days ?? 30),
      warrantyExpireDate: row.warranty_expire_date || "",
      amount: Number(row.amount || 0),
      lines: decodeJson(row.lines, []),
      includes: row.includes || "",
      excludes: row.excludes || "",
      signatureDataUrl: row.signature_data_url || "",
      stampName: row.stamp_name || "",
      followStatus: row.follow_status || "",
      loginStatus: row.login_status || "",
      claimStatus: row.claim_status || "",
      voided: boolFromDb(row.voided),
      createdAt: row.created_at || "",
      claimedAt: row.claimed_at || "",
      qr: decodeJson(row.qr, {}),
    })),
  };
}

async function readDb(dbFile) {
  return withDatabase(dbFile, readDbRows);
}

async function writeDb(dbFile, db) {
  await withDatabase(dbFile, (database) => {
    database.exec("BEGIN IMMEDIATE");
    try {
      writeDbRows(database, db);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  });
}

function coerceJsonObject(value, depth = 0) {
  if (typeof value === "string" && depth < 2) {
    const text = value.trim();
    if (text.startsWith("{") || text.startsWith("[")) return coerceJsonObject(JSON.parse(text), depth + 1);
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
}

async function parseJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  // DevTools may form-encode the POST, or stringify a body that is already JSON text.
  // Both still carry bindTicket. An empty body does not.
  if (!raw.startsWith("{") && !raw.startsWith("[") && !raw.startsWith('"') && raw.includes("=")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  return coerceJsonObject(JSON.parse(raw));
}

async function parseForm(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return Object.fromEntries(new URLSearchParams(raw));
}

function send(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    ...headers,
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendHtml(res, status, html, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(html);
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    ...headers,
  });
  res.end(text);
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function staticContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
  };
  return types[ext] || "application/octet-stream";
}

function resolveStaticFile(rootDir, mountPath, pathname) {
  const mountPrefix = `${mountPath}/`;
  const decodedSubpath = decodeURIComponent(pathname.slice(mountPrefix.length));
  const requested = decodedSubpath || "index.html";
  const filePath = path.resolve(rootDir, requested);
  const relative = path.relative(rootDir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    const error = new Error("静态页面路径不允许访问");
    error.status = 403;
    error.code = "forbidden_static_path";
    throw error;
  }
  return filePath;
}

async function serveStatic(req, res, rootDir, mountPath, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  let filePath = resolveStaticFile(rootDir, mountPath, pathname);
  let stat = await fs.stat(filePath).catch(() => null);
  if (stat?.isDirectory()) {
    filePath = path.join(filePath, "index.html");
    stat = await fs.stat(filePath).catch(() => null);
  }
  if (!stat?.isFile()) return notFound(res);

  res.writeHead(200, {
    "Content-Type": staticContentType(filePath),
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  if (req.method === "HEAD") return res.end();
  return res.end(await fs.readFile(filePath));
}

function notFound(res) {
  send(res, 404, { error: "not_found", message: "接口不存在" });
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  return cookieHeader.split(";").reduce((cookies, item) => {
    const [rawName, ...rawValue] = item.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
    return cookies;
  }, {});
}

function staffSessionCookie(token) {
  return `${STAFF_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`;
}

function clearStaffSessionCookie() {
  return `${STAFF_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function safeAdminNext(next) {
  return typeof next === "string" && next.startsWith("/admin") ? next : "/admin/";
}

function htmlAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function adminLoginHtml(next = "/admin/", error = "") {
  const nextPath = safeAdminNext(next);
  const nextValue = htmlAttr(nextPath);
  const messageText = error ? "账号或密码错误，请重新输入" : "";
  return `<!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>壹思源维修后台登录</title>
        <style>
          :root {
            color-scheme: light;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            --bg: #eef2f3;
            --ink: #182322;
            --muted: #687675;
            --primary: #14766f;
            --line: #dfe6e8;
            --surface: #ffffff;
          }
          * { box-sizing: border-box; }
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink); }
          main { width: min(980px, calc(100vw - 40px)); min-height: 560px; display: grid; grid-template-columns: .95fr 1.05fr; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; box-shadow: 0 18px 42px rgba(24, 35, 34, .12); }
          .intro { padding: 42px; background: #172625; color: #fff; display: flex; flex-direction: column; justify-content: space-between; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand-mark { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 8px; background: #fff; color: var(--primary); font-size: 26px; font-weight: 900; }
          .brand strong { display: block; font-size: 18px; }
          .brand small, .intro p, .intro li { color: rgba(255, 255, 255, .68); }
          h1 { margin: 38px 0 12px; font-size: 30px; line-height: 1.25; }
          p { margin: 0; line-height: 1.75; }
          ul { margin: 28px 0 0; padding: 0; list-style: none; display: grid; gap: 12px; }
          li { display: flex; gap: 10px; align-items: center; }
          li::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #f3a938; flex: none; }
          .login-panel { padding: 54px 56px; display: flex; flex-direction: column; justify-content: center; }
          .login-panel h2 { margin: 0 0 8px; font-size: 28px; }
          .login-panel > p { color: var(--muted); margin-bottom: 30px; }
          form { display: grid; gap: 16px; }
          label { display: grid; gap: 8px; color: #314240; font-weight: 800; }
          input { height: 46px; border: 1px solid var(--line); border-radius: 8px; padding: 0 13px; color: var(--ink); outline: none; }
          input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(20, 118, 111, .12); }
          button { height: 46px; border: 0; border-radius: 8px; background: var(--primary); color: #fff; font-weight: 900; cursor: pointer; }
          button:disabled { opacity: .68; cursor: wait; }
          .message { min-height: 22px; color: #ce4d3d; font-weight: 700; }
          .links { display: flex; justify-content: space-between; gap: 12px; margin-top: 22px; color: var(--muted); font-size: 14px; }
          a { color: var(--primary); font-weight: 800; text-decoration: none; }
          :root { --bg: #f1f3ff; --ink: #283451; --muted: #7b849d; --primary: #4c65f5; --line: #e7ebf7; }
          body { background: radial-gradient(ellipse at 15% 15%, #dff5ff, transparent 50%), linear-gradient(130deg, #f1f5ff, #eeeaff); }
          main { border: 1px solid #fff; border-radius: 30px; box-shadow: 0 24px 80px #697cc11f; }
          .intro { background: linear-gradient(145deg, #e2f3ff, #e5dfff); color: var(--ink); padding: 46px; }
          .brand small, .intro p, .intro li { color: #7784a2; }
          .brand-mark { border-radius: 16px; background: linear-gradient(140deg, #7bd7ff, #6764f5); color: #fff; box-shadow: inset 0 2px 4px #ffffff99, 0 7px 16px #697bdc26; }
          h1 { font-size: 32px; line-height: 1.5; font-weight: 750; }
          li::before { background: #7284f4; }
          label { color: #526080; font-size: 13px; font-weight: 600; }
          input { background: #f7f8fd; height: 50px; border-radius: 13px; font: inherit; }
          input:focus { box-shadow: 0 0 0 3px #708cff20; }
          button { height: 50px; border-radius: 14px; background: linear-gradient(110deg, #348dff, #675af6); box-shadow: 0 6px 16px #6073ea26; font-size: 15px; font-weight: 650; }
          button:focus-visible, a:focus-visible { outline: 3px solid #9cb7ff; outline-offset: 3px; }
          @media (max-width: 760px) {
            main { grid-template-columns: 1fr; width: 100%; min-height: 100vh; border-radius: 0; }
            .intro { padding: 30px; }
            .login-panel { padding: 32px 24px; }
          }
        </style>
      </head>
      <body>
        <main>
          <section class="intro">
            <div>
              <div class="brand">
                <span class="brand-mark">壹</span>
                <div>
                  <strong>壹思源维修</strong>
                  <small>报价管理后台</small>
                </div>
              </div>
              <h1>内部人员登录后才能进入后台</h1>
              <p>后台用于维护报价项目、品牌图片、城市区域、特殊费用和客户电子收据。</p>
              <ul>
                <li>维修师傅可生成报价和收据</li>
                <li>管理员可维护价格和权限</li>
                <li>普通客户不能进入后台</li>
              </ul>
            </div>
            <p>小程序端用于给客户查看报价和领取收据，后台端必须由内部账号进入。</p>
          </section>
          <section class="login-panel">
            <h2>后台登录</h2>
            <p>请输入内部人员手机号和密码。</p>
            <form id="loginForm" action="/admin-login" method="post">
              <input type="hidden" name="next" value="${nextValue}" />
              <label>
                手机号
                <input id="mobile" name="mobile" type="tel" autocomplete="username" placeholder="内部人员手机号" required />
              </label>
              <label>
                密码
                <input id="password" name="password" type="password" autocomplete="current-password" placeholder="登录密码" required />
              </label>
              <button id="loginBtn" type="submit">登录后台</button>
              <div class="message" id="message" aria-live="polite">${messageText}</div>
            </form>
            <div class="links">
              <span>本地测试环境</span>
              <a href="/miniapp/">查看小程序预览</a>
            </div>
          </section>
        </main>
      </body>
    </html>`;
}

function assertRequired(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      const error = new Error(`缺少字段：${field}`);
      error.status = 400;
      error.code = "missing_field";
      throw error;
    }
  }
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return match[1];
  return parseCookies(req)[STAFF_COOKIE_NAME];
}

function authContext(req, db) {
  const token = getBearer(req);
  if (!token) return null;
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  if (session.type === "staff") {
    const user = db.staffUsers.find((item) => item.id === session.userId && item.enabled);
    return user ? { type: "staff", user, session } : null;
  }
  if (session.type === "customer") {
    const user = db.customers.find((item) => item.id === session.userId);
    return user ? { type: "customer", user, session } : null;
  }
  return null;
}

function requireStaff(ctx, roles = []) {
  if (!ctx || ctx.type !== "staff") {
    const error = new Error("需要内部人员登录");
    error.status = 401;
    error.code = "staff_auth_required";
    throw error;
  }
  if (roles.length && !roles.includes(ctx.user.role)) {
    const error = new Error("当前内部账号无此权限");
    error.status = 403;
    error.code = "forbidden";
    throw error;
  }
}

function canIssueReceipts(user) {
  return Boolean(user?.enabled && user.role === "technician" && user.canIssueReceipts);
}

function staffView(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile || "",
    role: user.role,
    canIssueReceipts: canIssueReceipts(user),
    wechatBound: Boolean(user.wechatOpenid),
  };
}

function httpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function parseEnvText(text) {
  const result = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) result[key] = value;
  }
  return result;
}

function loadLocalEnvFile() {
  const file = path.join(ROOT_DIR, ".env");
  try {
    const parsed = parseEnvText(readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function wechatSettings() {
  const appid = String(process.env.WECHAT_APPID || "").trim();
  const secret = String(process.env.WECHAT_APP_SECRET || "").trim();
  const normalized = appid.toLowerCase();
  const placeholder = normalized === WECHAT_APPID_PLACEHOLDER.toLowerCase() || normalized === "touristappid";
  return { configured: Boolean(appid) && !placeholder && Boolean(secret) };
}

function assertWechatConfigured() {
  if (!wechatSettings().configured) {
    throw httpError(
      503,
      "wechat_not_configured",
      "尚未配置微信登录。请在后端设置环境变量 WECHAT_APPID 和 WECHAT_APP_SECRET，并把同一个 AppID 写入小程序 project.config.json 与 config.js。当前仍可使用手机号和密码登录。",
    );
  }
}

function normalizeOpenId(openid) {
  const value = String(openid || "").trim();
  if (!value || value.length > 128 || /\s/.test(value)) {
    throw httpError(502, "wechat_openid_missing", "微信未返回有效身份，请重试");
  }
  return value;
}

async function defaultExchangeWechatCode(code) {
  assertWechatConfigured();
  const appid = String(process.env.WECHAT_APPID).trim();
  const secret = String(process.env.WECHAT_APP_SECRET).trim();
  const url = new URL(WECHAT_JSCODE2SESSION_URL);
  url.searchParams.set("appid", appid);
  url.searchParams.set("secret", secret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");
  let payload;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    payload = await response.json();
  } catch {
    throw httpError(502, "wechat_unreachable", "无法连接微信登录服务，请稍后重试。当前仍可使用手机号和密码登录。");
  }
  if (!payload || payload.errcode || !payload.openid) {
    throw httpError(401, "wechat_code_invalid", "微信登录凭证无效，请重试。也可使用手机号和密码登录。");
  }
  return {
    openid: String(payload.openid),
    unionid: payload.unionid ? String(payload.unionid) : "",
  };
}

function purgeBindTickets(pendingBinds, now = Date.now()) {
  for (const [ticket, item] of pendingBinds) {
    if (!item || item.expiresAt <= now) pendingBinds.delete(ticket);
  }
}

function issueStaffSession(db, user) {
  const token = randomUUID();
  db.sessions.push({ token, type: "staff", userId: user.id, createdAt: new Date().toISOString() });
  return token;
}

function requireCustomer(ctx) {
  if (!ctx || ctx.type !== "customer") {
    const error = new Error("客户需要微信授权登录后领取");
    error.status = 401;
    error.code = "customer_auth_required";
    throw error;
  }
}

function readQuoteImport(database) {
  const rows = database.prepare(
    "SELECT key, value FROM app_meta WHERE key IN ('quote_import_source', 'quote_imported_at', 'quote_import_counts')",
  ).all();
  const meta = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  if (!meta.quote_imported_at && !meta.quote_import_source) return null;
  let counts = null;
  if (meta.quote_import_counts) {
    try {
      const parsed = JSON.parse(meta.quote_import_counts);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) counts = parsed;
    } catch {
      counts = null;
    }
  }
  return {
    source: meta.quote_import_source || "",
    importedAt: meta.quote_imported_at || "",
    counts,
  };
}

function publicCatalog(db) {
  const categoryIds = new Set(db.categories.filter(item => item.enabled).map(item => item.id));
  const services = db.services.filter(item => item.enabled && categoryIds.has(item.categoryId));
  return {
    categories: db.categories.filter((item) => item.enabled).map(item => ({ ...item, count: services.filter(service => service.categoryId === item.id).length })),
    brands: db.brands,
    cities: db.cities.filter((item) => item.enabled).map(({ multiplier, ...city }) => city),
    services,
    extras: db.extras.filter((item) => item.enabled),
  };
}

function categoryNamesFromIds(db, categoryIds) {
  const ids = new Set(categoryIds || []);
  return db.categories.filter((category) => ids.has(category.id)).map((category) => category.name);
}

function categoryIdsFromNames(db, categoryNames) {
  if ((categoryNames || []).includes("全部品类")) {
    return db.categories.filter((category) => category.enabled).map((category) => category.id);
  }
  const names = new Set(categoryNames || []);
  return db.categories.filter((category) => names.has(category.name)).map((category) => category.id);
}

function adminAssets(db) {
  return {
    categories: db.categories,
    brands: db.brands.map((brand) => ({
      ...brand,
      categories: categoryNamesFromIds(db, brand.categoryIds),
    })),
  };
}

function adminOperations(db) {
  return {
    cities: db.cities,
    regions: db.regions || [],
    rules: db.extras,
  };
}

function multiplierFromRate(rate, fallback = 1) {
  const text = String(rate || "").trim();
  if (!text || text === "标准") return 1;
  const match = text.match(/^([+-]?\d+(?:\.\d+)?)%$/);
  if (!match) return fallback;
  return Math.round((1 + Number(match[1]) / 100) * 10000) / 10000;
}

function cityFromBody(body, existing = {}) {
  const rate = body.rate ?? existing.rate ?? "标准";
  return {
    id: existing.id || body.id || `city_${randomUUID()}`,
    name: body.name || existing.name,
    rate,
    radius: body.radius ?? existing.radius ?? "10公里",
    multiplier: Number(body.multiplier ?? multiplierFromRate(rate, existing.multiplier ?? 1)),
    enabled: body.enabled ?? existing.enabled ?? true,
  };
}

function regionFromBody(db, body, existing = {}) {
  const city = db.cities.find((item) => item.id === body.cityId || item.name === body.city || item.name === existing.city);
  const rate = body.rate ?? existing.rate ?? "标准";
  return {
    id: existing.id || body.id || `region_${randomUUID()}`,
    cityId: city?.id || body.cityId || existing.cityId || "",
    city: city?.name || body.city || existing.city,
    region: body.region || existing.region,
    rate,
    radius: body.radius ?? existing.radius ?? city?.radius ?? "10公里",
    multiplier: Number(body.multiplier ?? multiplierFromRate(rate, existing.multiplier ?? city?.multiplier ?? 1)),
    enabled: body.enabled ?? existing.enabled ?? true,
  };
}

function ruleFromBody(body, existing = {}) {
  const price = body.price ?? existing.price ?? `${Number(body.amount ?? existing.amount ?? 0)}元`;
  const amount = Number(body.amount ?? String(price).match(/\d+/)?.[0] ?? existing.amount ?? 0);
  return {
    id: existing.id || body.id || `extra_${randomUUID()}`,
    name: body.name || existing.name,
    price,
    scene: body.scene ?? existing.scene ?? "",
    amount,
    enabled: body.enabled ?? existing.enabled ?? true,
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function receiptsCsv(receipts) {
  const headers = ["收据编号", "维修时间", "客户", "手机号", "服务项目", "品牌", "城市", "金额", "保修天数", "保修到期", "关注状态", "领取状态"];
  const rows = receipts.map((receipt) => [
    receipt.no,
    receipt.repairTime,
    receipt.customerName,
    receipt.customerPhone,
    receipt.serviceName,
    receipt.brandName,
    receipt.cityName,
    receipt.amount,
    receipt.warrantyDays,
    receipt.warrantyExpireDate,
    receipt.followStatus,
    receipt.claimStatus,
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function categoryFromBody(body, existing = {}) {
  return {
    id: existing.id || body.id || `category_${randomUUID()}`,
    name: body.name || existing.name,
    count: Number(body.count ?? existing.count ?? 0),
    tone: body.tone || existing.tone || "#14766f",
    accent: body.accent || existing.accent || "#f59f2f",
    image: body.image ?? existing.image ?? "",
    enabled: body.enabled ?? existing.enabled ?? true,
  };
}

function brandFromBody(db, body, existing = {}) {
  const requestedIds = body.categoryIds ?? (body.categories ? categoryIdsFromNames(db, body.categories) : existing.categoryIds || []);
  if (!Array.isArray(requestedIds) || !requestedIds.length || requestedIds.some(id => !db.categories.some(category => category.id === id))) {
    throw Object.assign(new Error("请至少选择一个有效关联品类"), { status: 400 });
  }
  const categoryIds = [...new Set(requestedIds)];
  const factor = Number(body.factor ?? existing.factor ?? 1);
  if (!Number.isFinite(factor) || factor <= 0 || factor > 10) throw Object.assign(new Error("配件价格系数须大于0且不超过10"), { status: 400 });
  return {
    id: existing.id || body.id || `brand_${randomUUID()}`,
    name: body.name || existing.name,
    latin: body.latin || existing.latin || body.name || existing.name,
    color: body.color || existing.color || "#14766f",
    factor,
    categoryIds,
    categories: categoryNamesFromIds(db, categoryIds),
    special: body.special ?? existing.special ?? false,
    logo: body.logo ?? existing.logo ?? "",
  };
}

function calculateQuote(db, body) {
  assertRequired(body, ["brandId", "cityId"]);
  const requestedServiceIds = body.serviceIds ?? (body.serviceId ? [body.serviceId] : []);
  if (!Array.isArray(requestedServiceIds) || !requestedServiceIds.length) {
    throw Object.assign(new Error("请至少选择一个故障项目"), { status: 400 });
  }
  const uniqueServiceIds = [...new Set(requestedServiceIds)];
  const services = uniqueServiceIds.map(id => db.services.find(item => item.id === id && item.enabled));
  const brand = db.brands.find((item) => item.id === body.brandId);
  const city = db.cities.find((item) => item.id === body.cityId && item.enabled);
  if (services.some(service => !service) || !brand || !city) {
    const error = new Error("服务、品牌或城市不存在");
    error.status = 400;
    error.code = "invalid_quote_input";
    throw error;
  }
  const categoryIds = new Set(services.map(service => service.categoryId));
  if (categoryIds.size !== 1 || !db.categories.some(item => categoryIds.has(item.id) && item.enabled) || !brand.categoryIds.includes(services[0].categoryId)) {
    const error = new Error("该品类已停用或品牌不适用，请刷新报价目录"); error.status = 400; throw error;
  }
  if (!Array.isArray(body.extraIds ?? []) || (body.extraIds || []).some(id => !db.extras.some(item => item.id === id && item.enabled))) {
    const error = new Error("特殊费用已变更，请刷新报价目录"); error.status = 400; throw error;
  }

  const selectedExtras = [...new Set(body.extraIds || [])]
    .map((id) => db.extras.find((item) => item.id === id && item.enabled))
    .filter(Boolean);
  const serviceRows = services.flatMap(service => {
    const labor = Math.round(((service.low + service.high) / 2) * city.multiplier * brand.factor);
    const part = Math.round(service.part * brand.factor);
    return [
      { label: `${service.name} · 维修人工费`, amount: labor },
      ...(part ? [{ label: `${service.name} · ${brand.name}配件估算`, amount: part }] : []),
    ];
  });
  const rows = [
    ...serviceRows,
    ...selectedExtras.map((extra) => ({ label: extra.name, amount: extra.amount })),
  ];
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return { service: services[0], services, brand, city, rows, total };
}

function receiptView(receipt) {
  return {
    ...receipt,
    warrantyExpireDate: Number(receipt.warrantyDays) === 0 ? "" : receipt.warrantyExpireDate,
    warrantyCountdown: warrantyCountdown(Number(receipt.warrantyDays) === 0 ? "" : receipt.warrantyExpireDate),
  };
}

function serviceFromBody(db, body, existing = {}) {
  const item = { id: existing.id || `service_${randomUUID()}` };
  for (const key of ["categoryId", "name", "desc", "includes", "excludes", "priceText"]) {
    const value = body[key] ?? existing[key] ?? "";
    if (typeof value !== "string") { const error = new Error("服务文字字段格式不正确"); error.status = 400; throw error; }
    item[key] = value.trim();
  }
  if (!item.name || !db.categories.some(category => category.id === item.categoryId)) {
    const error = new Error("请填写服务名称并选择有效品类"); error.status = 400; throw error;
  }
  for (const key of ["low", "high", "part", "warrantyDays"]) {
    const value = body[key] ?? existing[key] ?? (key === "warrantyDays" ? 30 : 0);
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      const error = new Error("金额与保修天数必须是非负整数"); error.status = 400; throw error;
    }
    item[key] = value;
  }
  if (item.high < item.low) { const error = new Error("最高人工费不能小于最低人工费"); error.status = 400; throw error; }
  item.enabled = body.enabled ?? existing.enabled ?? false;
  if (typeof item.enabled !== "boolean") { const error = new Error("上架状态格式不正确"); error.status = 400; throw error; }
  return item;
}

async function handle(req, res, serverOptions) {
  const dbFile = serverOptions.dbFile;
  const exchangeWechatCode = serverOptions.exchangeWechatCode || defaultExchangeWechatCode;
  const pendingBinds = serverOptions.pendingBinds;
  const bindTicketTtlMs = serverOptions.bindTicketTtlMs || DEFAULT_BIND_TICKET_TTL_MS;
  if (req.method === "OPTIONS") return send(res, 204, {});

  const url = new URL(req.url || "/", "http://127.0.0.1");
  const route = `${req.method} ${url.pathname}`;

  if (url.pathname === "/miniapp") return redirect(res, "/miniapp/");
  if (url.pathname.startsWith("/miniapp/")) return serveStatic(req, res, MINIAPP_UI_DIR, "/miniapp", url.pathname);

  const db = await readDb(dbFile);
  const ctx = authContext(req, db);

  if (url.pathname === "/admin") return redirect(res, "/admin/");
  if (url.pathname.startsWith("/admin/")) {
    if (!ctx || ctx.type !== "staff") return redirect(res, `/login?next=${encodeURIComponent(url.pathname)}`);
    return serveStatic(req, res, ADMIN_WEB_DIR, "/admin", url.pathname);
  }

  if ((route === "GET /" || route === "GET /login") && ctx?.type === "staff") {
    return redirect(res, "/admin/");
  }

  if (route === "GET /" || route === "GET /login") {
    return sendHtml(res, 200, adminLoginHtml(url.searchParams.get("next") || "/admin/", url.searchParams.get("error") || ""));
  }

  if (route === "POST /admin-login") {
    const body = await parseForm(req);
    const nextPath = safeAdminNext(body.next || "/admin/");
    const user = db.staffUsers.find((item) => item.mobile === body.mobile && item.password === body.password && item.enabled);
    if (!user) return redirect(res, `/login?next=${encodeURIComponent(nextPath)}&error=invalid`);
    const token = randomUUID();
    db.sessions.push({ token, type: "staff", userId: user.id, createdAt: new Date().toISOString() });
    await writeDb(dbFile, db);
    return redirect(res, nextPath, { "Set-Cookie": staffSessionCookie(token) });
  }

  if (route === "GET /logout") {
    const token = getBearer(req);
    if (token) {
      db.sessions = db.sessions.filter((session) => session.token !== token);
      await writeDb(dbFile, db);
    }
    return redirect(res, "/login", { "Set-Cookie": clearStaffSessionCookie() });
  }

  if (route === "GET /api") {
    return send(res, 200, {
      service: "yisiyuan-local-backend",
      endpoints: [
        "GET /api/health",
        "GET /api/catalog",
        "POST /api/auth/staff-login",
        "POST /api/auth/wechat-login",
        "POST /api/auth/wechat-bind",
        "GET /api/auth/me",
        "POST /api/auth/logout",
        "GET /api/admin/assets",
        "GET /api/admin/operations",
        "POST /api/admin/categories",
        "POST /api/admin/brands",
        "POST /api/admin/cities",
        "POST /api/admin/regions",
        "POST /api/admin/extras",
        "POST /api/quotes/calculate",
        "POST /api/staff/receipts",
        "POST /api/wechat/scan",
        "POST /api/customer/wechat-login",
        "POST /api/customer/claim",
        "GET /api/customer/receipts",
        "GET /api/admin/receipts",
        "GET /api/admin/receipts/export",
        "GET /api/admin/permissions",
      ],
    });
  }

  if (route === "GET /api/health") {
    return send(res, 200, {
      ok: true,
      service: "yisiyuan-local-backend",
      now: new Date().toISOString(),
      wechatLogin: wechatSettings().configured ? "configured" : "not_configured",
    });
  }

  if (route === "GET /api/catalog") {
    return send(res, 200, publicCatalog(db));
  }

  if (route === "POST /api/auth/staff-login") {
    const body = await parseJson(req);
    assertRequired(body, ["mobile", "password"]);
    const user = db.staffUsers.find((item) => item.mobile === body.mobile && item.password === body.password && item.enabled);
    if (!user) return send(res, 401, { error: "invalid_login", message: "账号或密码错误" });
    const token = randomUUID();
    db.sessions.push({ token, type: "staff", userId: user.id, createdAt: new Date().toISOString() });
    await writeDb(dbFile, db);
    return send(res, 200, { token, user: staffView(user) }, { "Set-Cookie": staffSessionCookie(token) });
  }

  if (route === "GET /api/auth/me") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    return send(res, 200, { user: staffView(ctx.user) });
  }

  if (route === "POST /api/auth/logout") {
    const token = getBearer(req);
    if (token) {
      db.sessions = db.sessions.filter((session) => session.token !== token);
      await writeDb(dbFile, db);
    }
    return send(res, 200, { ok: true }, { "Set-Cookie": clearStaffSessionCookie() });
  }

  if (route === "POST /api/auth/wechat-login") {
    const body = await parseJson(req);
    if (typeof body.code === "string") body.code = body.code.trim();
    assertRequired(body, ["code"]);
    if (body.code.length > 128) return send(res, 400, { error: "invalid_code", message: "微信登录凭证无效" });
    const identity = await exchangeWechatCode(body.code);
    const openid = normalizeOpenId(identity.openid);
    const user = db.staffUsers.find((item) => item.wechatOpenid === openid);
    if (user && !user.enabled) return send(res, 403, { error: "staff_disabled", message: "该微信绑定的师傅账号已停用" });
    if (user) {
      const token = issueStaffSession(db, user);
      await writeDb(dbFile, db);
      return send(res, 200, { bound: true, token, user: staffView(user) }, { "Set-Cookie": staffSessionCookie(token) });
    }
    purgeBindTickets(pendingBinds);
    const bindTicket = randomUUID();
    pendingBinds.set(bindTicket, {
      openid,
      unionid: identity.unionid ? String(identity.unionid) : "",
      expiresAt: Date.now() + bindTicketTtlMs,
    });
    return send(res, 200, {
      bound: false,
      bindTicket,
      message: "该微信尚未绑定师傅账号，请使用手机号和密码完成首次绑定。绑定不会开通开据权限。",
    });
  }

  if (route === "POST /api/auth/wechat-bind") {
    const body = await parseJson(req);
    if (typeof body.bindTicket === "string") body.bindTicket = body.bindTicket.trim();
    if (typeof body.mobile === "string") body.mobile = body.mobile.trim();
    assertRequired(body, ["bindTicket", "mobile", "password"]);
    purgeBindTickets(pendingBinds);
    const pending = pendingBinds.get(body.bindTicket);
    if (!pending) return send(res, 401, { error: "bind_ticket_invalid", message: "绑定已过期，请重新微信登录后再试" });
    const user = db.staffUsers.find((item) => item.mobile === body.mobile && item.password === body.password && item.enabled);
    if (!user) return send(res, 401, { error: "invalid_login", message: "账号或密码错误" });
    if (user.wechatOpenid && user.wechatOpenid !== pending.openid) {
      return send(res, 409, { error: "staff_already_bound", message: "该师傅账号已绑定其他微信" });
    }
    const taken = db.staffUsers.find((item) => item.wechatOpenid === pending.openid && item.id !== user.id);
    if (taken) return send(res, 409, { error: "wechat_already_bound", message: "该微信已绑定其他师傅账号" });
    user.wechatOpenid = pending.openid;
    if (pending.unionid) user.wechatUnionid = pending.unionid;
    const token = issueStaffSession(db, user);
    await writeDb(dbFile, db);
    pendingBinds.delete(body.bindTicket);
    return send(res, 200, { bound: true, token, user: staffView(user) }, { "Set-Cookie": staffSessionCookie(token) });
  }

  if (route === "GET /api/admin/permissions") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    return send(res, 200, {
      staffUsers: db.staffUsers.map(({ password, wechatOpenid, wechatUnionid, ...user }) => ({
        ...user,
        canIssueReceipts: canIssueReceipts(user),
        wechatBound: Boolean(wechatOpenid),
      })),
      customerRule: "客户必须先关注公众号，再微信授权登录领取；后续在小程序“我的收据”查看。",
    });
  }

  if (route === "POST /api/admin/staff") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    if (typeof body.name !== "string" || !body.name.trim() || !/^1\d{10}$/.test(body.mobile || "") || typeof body.password !== "string" || body.password.length < 8) return send(res, 400, { message: "请填写姓名、11位手机号和至少8位密码" });
    if (db.staffUsers.some(user => user.mobile === body.mobile)) return send(res, 409, { message: "该手机号已有内部账号" });
    const user = { id: `staff_${randomUUID()}`, name: body.name.trim(), mobile: body.mobile, password: body.password, role: "technician", enabled: true, canIssueReceipts: false };
    db.staffUsers.push(user);
    await writeDb(dbFile, db);
    return send(res, 201, { user: staffView(user) });
  }

  const staffAccountMatch = url.pathname.match(/^\/api\/admin\/staff\/([^/]+)$/);
  if (staffAccountMatch && ["PATCH", "DELETE"].includes(req.method)) {
    requireStaff(ctx, ["admin"]);
    const user = db.staffUsers.find(item => item.id === staffAccountMatch[1]);
    if (!user) return send(res, 404, { message: "账号不存在" });
    const body = req.method === "PATCH" ? await parseJson(req) : {};
    if ((req.method === "DELETE" || body.enabled === false) && user.id === ctx.user.id) return send(res, 400, { message: "不能停用或删除当前登录账号" });
    if ((req.method === "DELETE" || body.enabled === false) && user.role === "admin" && !db.staffUsers.some(item => item.id !== user.id && item.role === "admin" && item.enabled)) return send(res, 400, { message: "必须保留至少一个启用的管理员" });
    if (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim())) return send(res, 400, { message: "姓名不能为空" });
    if (body.mobile !== undefined && !/^1\d{10}$/.test(body.mobile)) return send(res, 400, { message: "请输入11位手机号" });
    if (body.mobile !== undefined && db.staffUsers.some(item => item.id !== user.id && item.mobile === body.mobile)) return send(res, 409, { message: "手机号已被使用" });
    if (body.password !== undefined && (typeof body.password !== "string" || body.password.length < 8)) return send(res, 400, { message: "新密码至少8位" });
    if (body.enabled !== undefined && typeof body.enabled !== "boolean") return send(res, 400, { message: "账号状态必须为布尔值" });
    if (req.method === "DELETE") db.staffUsers = db.staffUsers.filter(item => item.id !== user.id);
    else {
      if (body.name !== undefined) user.name = body.name.trim();
      if (body.mobile !== undefined) user.mobile = body.mobile;
      if (body.password !== undefined) user.password = body.password;
      if (body.enabled !== undefined) user.enabled = body.enabled;
    }
    if (req.method === "DELETE" || body.password !== undefined || body.enabled === false) db.sessions = db.sessions.filter(session => session.type !== "staff" || session.userId !== user.id);
    await writeDb(dbFile, db);
    return send(res, 200, { ok: true });
  }

  const staffPermissionMatch = url.pathname.match(/^\/api\/admin\/staff\/([^/]+)\/receipt-permission$/);
  if (staffPermissionMatch && req.method === "PATCH") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    if (typeof body.canIssueReceipts !== "boolean") return send(res, 400, { message: "权限值必须为布尔值" });
    const user = db.staffUsers.find(item => item.id === staffPermissionMatch[1]);
    if (!user || user.role !== "technician") return send(res, 400, { message: "只能为内部师傅账号设置开据权限" });
    user.canIssueReceipts = body.canIssueReceipts;
    await writeDb(dbFile, db);
    return send(res, 200, { user: staffView(user) });
  }

  if (route === "GET /api/admin/assets") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    return send(res, 200, { ...adminAssets(db), quoteImport: db.quoteImport || null });
  }

  if (route === "GET /api/admin/operations") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    return send(res, 200, { ...adminOperations(db), quoteImport: db.quoteImport || null });
  }

  if (route === "POST /api/admin/categories") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    assertRequired(body, ["name"]);
    const category = categoryFromBody(body);
    db.categories.unshift(category);
    await writeDb(dbFile, db);
    return send(res, 201, { category });
  }

  const categoryMatch = url.pathname.match(/^\/api\/admin\/categories\/([^/]+)$/);
  if (categoryMatch && req.method === "PATCH") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    const category = db.categories.find((item) => item.id === categoryMatch[1]);
    if (!category) return send(res, 404, { error: "category_not_found", message: "品类不存在" });
    const previousName = category.name;
    Object.assign(category, categoryFromBody(body, category));
    if (previousName !== category.name) {
      for (const brand of db.brands) {
        brand.categories = (brand.categories || []).map((name) => (name === previousName ? category.name : name));
      }
    }
    await writeDb(dbFile, db);
    return send(res, 200, { category });
  }

  if (categoryMatch && req.method === "DELETE") {
    requireStaff(ctx, ["admin"]);
    const category = db.categories.find((item) => item.id === categoryMatch[1]);
    if (!category) return send(res, 404, { error: "category_not_found", message: "品类不存在" });
    db.categories = db.categories.filter((item) => item.id !== category.id);
    db.services = db.services.filter((service) => service.categoryId !== category.id);
    for (const brand of db.brands) {
      brand.categoryIds = (brand.categoryIds || []).filter((id) => id !== category.id);
      brand.categories = (brand.categories || []).filter((name) => name !== category.name);
    }
    await writeDb(dbFile, db);
    return send(res, 200, { ok: true });
  }

  if (route === "POST /api/admin/brands") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    assertRequired(body, ["name"]);
    const brand = brandFromBody(db, body);
    db.brands.unshift(brand);
    await writeDb(dbFile, db);
    return send(res, 201, { brand });
  }

  const brandMatch = url.pathname.match(/^\/api\/admin\/brands\/([^/]+)$/);
  if (brandMatch && req.method === "PATCH") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    const brand = db.brands.find((item) => item.id === brandMatch[1]);
    if (!brand) return send(res, 404, { error: "brand_not_found", message: "品牌不存在" });
    Object.assign(brand, brandFromBody(db, body, brand));
    await writeDb(dbFile, db);
    return send(res, 200, { brand });
  }

  if (brandMatch && req.method === "DELETE") {
    requireStaff(ctx, ["admin"]);
    const brand = db.brands.find((item) => item.id === brandMatch[1]);
    if (!brand) return send(res, 404, { error: "brand_not_found", message: "品牌不存在" });
    db.brands = db.brands.filter((item) => item.id !== brand.id);
    await writeDb(dbFile, db);
    return send(res, 200, { ok: true });
  }

  if (route === "POST /api/admin/cities") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    assertRequired(body, ["name"]);
    const city = cityFromBody(body);
    db.cities.unshift(city);
    await writeDb(dbFile, db);
    return send(res, 201, { city });
  }

  const cityMatch = url.pathname.match(/^\/api\/admin\/cities\/([^/]+)$/);
  if (cityMatch && req.method === "PATCH") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    const city = db.cities.find((item) => item.id === cityMatch[1] || item.name === cityMatch[1]);
    if (!city) return send(res, 404, { error: "city_not_found", message: "城市不存在" });
    const previousName = city.name;
    Object.assign(city, cityFromBody(body, city));
    for (const region of db.regions || []) {
      if (region.cityId === city.id || region.city === previousName) {
        region.cityId = city.id;
        region.city = city.name;
      }
    }
    await writeDb(dbFile, db);
    return send(res, 200, { city });
  }

  if (cityMatch && req.method === "DELETE") {
    requireStaff(ctx, ["admin"]);
    const city = db.cities.find((item) => item.id === cityMatch[1] || item.name === cityMatch[1]);
    if (!city) return send(res, 404, { error: "city_not_found", message: "城市不存在" });
    db.cities = db.cities.filter((item) => item.id !== city.id);
    db.regions = (db.regions || []).filter((region) => region.cityId !== city.id && region.city !== city.name);
    await writeDb(dbFile, db);
    return send(res, 200, { ok: true });
  }

  if (route === "POST /api/admin/regions") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    assertRequired(body, ["city", "region"]);
    const region = regionFromBody(db, body);
    db.regions = [region, ...(db.regions || [])];
    await writeDb(dbFile, db);
    return send(res, 201, { region });
  }

  const regionMatch = url.pathname.match(/^\/api\/admin\/regions\/([^/]+)$/);
  if (regionMatch && req.method === "PATCH") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    const region = (db.regions || []).find((item) => item.id === regionMatch[1]);
    if (!region) return send(res, 404, { error: "region_not_found", message: "区域不存在" });
    Object.assign(region, regionFromBody(db, body, region));
    await writeDb(dbFile, db);
    return send(res, 200, { region });
  }

  if (regionMatch && req.method === "DELETE") {
    requireStaff(ctx, ["admin"]);
    const region = (db.regions || []).find((item) => item.id === regionMatch[1]);
    if (!region) return send(res, 404, { error: "region_not_found", message: "区域不存在" });
    db.regions = (db.regions || []).filter((item) => item.id !== region.id);
    await writeDb(dbFile, db);
    return send(res, 200, { ok: true });
  }

  if (route === "POST /api/admin/extras") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    assertRequired(body, ["name"]);
    const rule = ruleFromBody(body);
    db.extras.unshift(rule);
    await writeDb(dbFile, db);
    return send(res, 201, { rule });
  }

  const extraMatch = url.pathname.match(/^\/api\/admin\/extras\/([^/]+)$/);
  if (extraMatch && req.method === "PATCH") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    const rule = db.extras.find((item) => item.id === extraMatch[1] || item.name === extraMatch[1]);
    if (!rule) return send(res, 404, { error: "extra_not_found", message: "特殊费用不存在" });
    Object.assign(rule, ruleFromBody(body, rule));
    await writeDb(dbFile, db);
    return send(res, 200, { rule });
  }

  if (extraMatch && req.method === "DELETE") {
    requireStaff(ctx, ["admin"]);
    const rule = db.extras.find((item) => item.id === extraMatch[1] || item.name === extraMatch[1]);
    if (!rule) return send(res, 404, { error: "extra_not_found", message: "特殊费用不存在" });
    db.extras = db.extras.filter((item) => item.id !== rule.id);
    await writeDb(dbFile, db);
    return send(res, 200, { ok: true });
  }

  if (route === "GET /api/admin/services") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    return send(res, 200, { services: db.services, quoteImport: db.quoteImport || null });
  }

  if (route === "POST /api/admin/services") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    assertRequired(body, ["categoryId", "name", "low", "high"]);
    const service = serviceFromBody(db, body);
    db.services.unshift(service);
    await writeDb(dbFile, db);
    return send(res, 201, { service });
  }

  const serviceMatch = url.pathname.match(/^\/api\/admin\/services\/([^/]+)$/);
  if (serviceMatch && req.method === "PATCH") {
    requireStaff(ctx, ["admin"]);
    const body = await parseJson(req);
    const service = db.services.find((item) => item.id === serviceMatch[1]);
    if (!service) return send(res, 404, { error: "service_not_found", message: "报价项目不存在" });
    Object.assign(service, serviceFromBody(db, body, service));
    await writeDb(dbFile, db);
    return send(res, 200, { service });
  }

  if (serviceMatch && req.method === "DELETE") {
    requireStaff(ctx, ["admin"]);
    db.services = db.services.filter((item) => item.id !== serviceMatch[1]);
    await writeDb(dbFile, db);
    return send(res, 200, { ok: true });
  }

  if (route === "POST /api/quotes/calculate") {
    const body = await parseJson(req);
    return send(res, 200, calculateQuote(db, body));
  }

  if (route === "POST /api/staff/receipts") {
    requireStaff(ctx, ["technician"]);
    if (!canIssueReceipts(ctx.user)) return send(res, 403, { error: "receipt_permission_required", message: "该师傅账号尚未获得开具收据权限，请联系管理员" });
    const body = await parseJson(req);
    assertRequired(body, ["customerName", "brandId", "cityId", "signatureDataUrl"]);
    const quote = calculateQuote(db, body);
    const now = new Date();
    if (body.expectedTotal !== undefined && body.expectedTotal !== quote.total) return send(res, 409, { error: "quote_changed", message: "报价已变更，请返回重新确认并签名" });
    const warrantyDays = Number(body.warrantyDays ?? Math.max(...quote.services.map(service => service.warrantyDays ?? 30)));
    const no = receiptNo(now);
    const receipt = {
      id: randomUUID(),
      no,
      scene: `receipt_${no}`,
      createdByStaffId: ctx.user.id,
      customerName: body.customerName,
      customerPhone: body.customerPhone || "",
      openid: null,
      customerId: null,
      serviceId: quote.services.map(service => service.id).join(","),
      serviceName: quote.services.map(service => service.name).join("、"),
      brandId: quote.brand.id,
      brandName: quote.brand.name,
      cityId: quote.city.id,
      cityName: quote.city.name,
      repairTime: formatDateTime(now),
      warrantyDays,
      warrantyExpireDate: warrantyDays === 0 ? "" : formatDate(addDays(now, warrantyDays)),
      amount: quote.total,
      lines: quote.rows,
      includes: [...new Set(quote.services.map(service => service.includes).filter(Boolean))].join("；"),
      excludes: [...new Set(quote.services.map(service => service.excludes).filter(Boolean))].join("；"),
      signatureDataUrl: body.signatureDataUrl,
      stampName: "壹思源维修电子章",
      followStatus: "待关注",
      loginStatus: "待授权登录",
      claimStatus: "待关注登录",
      voided: false,
      createdAt: now.toISOString(),
    };
    receipt.qr = {
      type: "official_account_param_qr",
      scene: receipt.scene,
      text: "扫码关注公众号，授权登录后领取电子收据",
      localClaimUrl: `/customer/claim?scene=${encodeURIComponent(receipt.scene)}`,
    };
    db.receipts.unshift(receipt);
    await writeDb(dbFile, db);
    return send(res, 201, { receipt: receiptView(receipt) });
  }

  if (route === "GET /api/staff/receipts") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    return send(res, 200, { receipts: db.receipts.filter(item => item.createdByStaffId === ctx.user.id).map(receiptView) });
  }

  if (route === "GET /api/admin/receipts") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    return send(res, 200, { receipts: db.receipts.map(receiptView) });
  }

  if (route === "GET /api/admin/receipts/export") {
    requireStaff(ctx, ["admin", "technician", "support"]);
    const csv = receiptsCsv(db.receipts.map(receiptView));
    return sendText(res, 200, csv, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receipts-${todayKey()}.csv"`,
    });
  }

  const receiptAdminMatch = url.pathname.match(/^\/api\/admin\/receipts\/([^/]+)\/void$/);
  if (receiptAdminMatch && req.method === "POST") {
    requireStaff(ctx, ["admin", "support"]);
    const receipt = db.receipts.find((item) => item.id === receiptAdminMatch[1] || item.no === receiptAdminMatch[1]);
    if (!receipt) return send(res, 404, { error: "receipt_not_found", message: "收据不存在" });
    receipt.voided = true;
    receipt.claimStatus = "已作废";
    await writeDb(dbFile, db);
    return send(res, 200, { receipt: receiptView(receipt) });
  }

  if (route === "POST /api/wechat/scan") {
    const body = await parseJson(req);
    assertRequired(body, ["scene", "openid"]);
    const receipt = db.receipts.find((item) => item.scene === body.scene && !item.voided);
    if (!receipt) return send(res, 404, { error: "receipt_not_found", message: "二维码对应收据不存在或已作废" });
    receipt.openid = body.openid;
    if (body.subscribed) {
      receipt.followStatus = "已关注";
      receipt.claimStatus = "待授权登录";
    } else {
      receipt.followStatus = "待关注";
      receipt.claimStatus = "待关注登录";
    }
    await writeDb(dbFile, db);
    return send(res, 200, {
      scene: body.scene,
      subscribed: Boolean(body.subscribed),
      nextAction: body.subscribed ? "wechat_login" : "follow_official_account",
      message: body.subscribed ? "已关注公众号，请进入小程序授权登录领取收据" : "请先关注公众号，再领取收据",
    });
  }

  if (route === "POST /api/customer/wechat-login") {
    const body = await parseJson(req);
    assertRequired(body, ["openid"]);
    let customer = db.customers.find((item) => item.openid === body.openid);
    if (!customer) {
      customer = {
        id: `customer_${randomUUID()}`,
        openid: body.openid,
        nickname: body.nickname || "微信用户",
        mobile: body.mobile || "",
        createdAt: new Date().toISOString(),
      };
      db.customers.push(customer);
    } else {
      customer.nickname = body.nickname || customer.nickname;
      customer.mobile = body.mobile || customer.mobile;
    }
    const token = randomUUID();
    db.sessions.push({ token, type: "customer", userId: customer.id, createdAt: new Date().toISOString() });
    await writeDb(dbFile, db);
    return send(res, 200, { token, customer });
  }

  if (route === "POST /api/customer/claim") {
    requireCustomer(ctx);
    const body = await parseJson(req);
    assertRequired(body, ["scene"]);
    const receipt = db.receipts.find((item) => item.scene === body.scene && !item.voided);
    if (!receipt) return send(res, 404, { error: "receipt_not_found", message: "收据不存在或已作废" });
    if (receipt.openid && receipt.openid !== ctx.user.openid) {
      return send(res, 403, { error: "openid_mismatch", message: "该收据已绑定其他微信用户" });
    }
    if (receipt.followStatus !== "已关注") {
      return send(res, 403, { error: "follow_required", message: "需要先关注公众号" });
    }
    receipt.openid = ctx.user.openid;
    receipt.customerId = ctx.user.id;
    receipt.loginStatus = "已授权登录";
    receipt.claimStatus = "已登录领取";
    receipt.claimedAt = new Date().toISOString();
    await writeDb(dbFile, db);
    return send(res, 200, { receipt: receiptView(receipt) });
  }

  if (route === "GET /api/customer/receipts") {
    requireCustomer(ctx);
    const receipts = db.receipts.filter((item) => item.customerId === ctx.user.id && !item.voided).map(receiptView);
    return send(res, 200, { receipts });
  }

  const customerReceiptMatch = url.pathname.match(/^\/api\/customer\/receipts\/([^/]+)$/);
  if (customerReceiptMatch && req.method === "GET") {
    requireCustomer(ctx);
    const receipt = db.receipts.find(
      (item) => (item.id === customerReceiptMatch[1] || item.no === customerReceiptMatch[1]) && item.customerId === ctx.user.id && !item.voided,
    );
    if (!receipt) return send(res, 404, { error: "receipt_not_found", message: "收据不存在" });
    return send(res, 200, { receipt: receiptView(receipt) });
  }

  return notFound(res);
}

const databaseQueues = new Map();

export function createServer(options = {}) {
  const dbFile = options.dbFile || process.env.DB_FILE || DEFAULT_DB_FILE;
  const serverOptions = {
    dbFile,
    exchangeWechatCode: options.exchangeWechatCode || defaultExchangeWechatCode,
    pendingBinds: new Map(),
    bindTicketTtlMs: options.bindTicketTtlMs || DEFAULT_BIND_TICKET_TTL_MS,
  };
  return http.createServer(async (req, res) => {
    try {
      // The storage adapter writes snapshots. Serialize read-modify-write cycles
      // across both frontends so concurrent requests cannot overwrite each other.
      const key = path.resolve(dbFile);
      const previous = databaseQueues.get(key) || Promise.resolve();
      const current = previous.catch(() => {}).then(() => handle(req, res, serverOptions));
      databaseQueues.set(key, current);
      try { await current; } finally { if (databaseQueues.get(key) === current) databaseQueues.delete(key); }
    } catch (error) {
      send(res, error.status || 500, {
        error: error.code || "server_error",
        message: error.message || "服务异常",
      });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadLocalEnvFile();
  const server = createServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`Local backend running at http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}
