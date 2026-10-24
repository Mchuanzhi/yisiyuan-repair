import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { applyAppIdFiles, assertWechatAppId } from "../scripts/apply-appid.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const state = {
  apiBase: "http://127.0.0.1:8787",
  useMock: false,
  token: "",
  user: null,
  bindTicket: "",
  wechatHint: "",
  wechatErrorCode: "",
  skipWechatAuto: false,
  sessionReady: null,
  sessionPromise: null,
};
const requests = [];
let loginCalls = 0;
let nextResponse = { statusCode: 200, data: {} };

globalThis.getApp = () => ({ globalData: state });
globalThis.wx = {
  getStorageSync() {
    return "";
  },
  setStorageSync() {},
  login(options) {
    loginCalls += 1;
    if (globalThis.wx.loginMode === "fail") options.fail({ errMsg: "login:fail" });
    else options.success({ code: "code-from-wx" });
  },
  request(options) {
    requests.push({
      url: options.url,
      method: options.method,
      data: options.data,
      header: options.header || {},
    });
    options.success(nextResponse);
  },
};

const api = require("../utils/api.js");

function reset() {
  Object.assign(state, {
    apiBase: "http://127.0.0.1:8787",
    useMock: false,
    token: "",
    user: null,
    bindTicket: "",
    wechatHint: "",
    wechatErrorCode: "",
    skipWechatAuto: false,
    sessionReady: null,
    sessionPromise: null,
  });
  requests.length = 0;
  loginCalls = 0;
  globalThis.wx.loginMode = "ok";
  nextResponse = {
    statusCode: 200,
    data: {
      bound: true,
      token: "token-1",
      user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false, wechatBound: true },
    },
  };
}

reset();
const entered = await api.enterWithWechat();
assert.equal(entered.bound, true);
assert.equal(entered.user.canIssueReceipts, false);
assert.equal(state.token, "token-1");
assert.equal(loginCalls, 1);
assert.equal(requests[0].url, "http://127.0.0.1:8787/api/auth/wechat-login");
assert.equal(requests[0].data.code, "code-from-wx");
assert.equal(requests[0].header.Authorization, undefined);
assert.equal(requests[0].header["Content-Type"], "application/json");

nextResponse = { statusCode: 200, data: { receipts: [] } };
await api.listReceipts();
assert.equal(requests[1].header.Authorization, "Bearer token-1");

reset();
nextResponse = { statusCode: 200, data: { bound: false, bindTicket: "ticket-1", message: "请绑定" } };
const unbound = await api.enterWithWechat();
assert.equal(unbound.bound, false);
assert.equal(state.token, "");
assert.equal(state.bindTicket, "ticket-1");
nextResponse = {
  statusCode: 200,
  data: {
    bound: true,
    token: "token-2",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false, wechatBound: true },
  },
};
const bound = await api.wechatBind("ticket-1", " 18800000002 ", "123456");
assert.equal(requests[1].url, "http://127.0.0.1:8787/api/auth/wechat-bind");
assert.equal(requests[1].data.bindTicket, "ticket-1");
assert.equal(requests[1].data.mobile, "18800000002");
assert.equal(requests[1].data.password, "123456");
assert.equal(requests[1].header.Authorization, undefined);
assert.equal(bound.user.canIssueReceipts, false);
assert.equal(state.token, "token-2");
assert.equal(state.bindTicket, "");

reset();
nextResponse = { statusCode: 503, data: { error: "wechat_not_configured", message: "尚未配置" } };
await assert.rejects(() => api.enterWithWechat({ force: true }), (error) => error.code === "wechat_not_configured" && error.message === "尚未配置");
assert.equal(state.token, "");
assert.equal(state.wechatErrorCode, "wechat_not_configured");
const boot = await api.bootstrapSession();
assert.equal(boot, null);
assert.equal(state.token, "");

reset();
state.useMock = true;
const mocked = await api.enterWithWechat();
assert.equal(mocked.mock, true);
assert.equal(loginCalls, 0);
const staff = await api.staffLogin("18800000002", "123456");
assert.equal(staff.user.canIssueReceipts, true);
assert.equal(state.token, "mock:staff_tech");

reset();
state.token = "token-1";
state.user = { id: "staff_tech", canIssueReceipts: false };
state.useMock = false;
nextResponse = { statusCode: 200, data: { ok: true } };
await api.staffLogout();
assert.equal(state.token, "");
assert.equal(state.skipWechatAuto, true);
assert.equal(loginCalls, 0);
const skipped = await api.enterWithWechat();
assert.equal(skipped.skipped, true);
assert.equal(loginCalls, 0);

reset();
globalThis.wx.loginMode = "fail";
await assert.rejects(() => api.enterWithWechat({ force: true }), (error) => error.code === "wx_login_failed");
assert.equal(state.token, "");

assert.throws(() => assertWechatAppId("wxXXXXXXXXXXXXXXXX"), /占位符/);
assert.throws(() => assertWechatAppId("touristappid"), /touristappid/);
assert.throws(() => assertWechatAppId("wx123"), /AppID/);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ysy-appid-"));
const projectConfigPath = path.join(dir, "project.config.json");
const configJsPath = path.join(dir, "config.js");
const privateConfigPath = path.join(dir, "project.private.config.json");
fs.writeFileSync(projectConfigPath, `${JSON.stringify({ appid: "wxXXXXXXXXXXXXXXXX", setting: { urlCheck: false } }, null, 2)}\n`);
fs.writeFileSync(configJsPath, "module.exports = { wechatAppId: \"wxXXXXXXXXXXXXXXXX\" };\n");
const id = applyAppIdFiles({ appid: "wx0123456789abcdef", projectConfigPath, configJsPath, privateConfigPath });
assert.equal(id, "wx0123456789abcdef");
assert.equal(JSON.parse(fs.readFileSync(projectConfigPath, "utf8")).appid, id);
assert.match(fs.readFileSync(configJsPath, "utf8"), /wechatAppId: "wx0123456789abcdef"/);
const privateConfig = JSON.parse(fs.readFileSync(privateConfigPath, "utf8"));
assert.equal(privateConfig.appid, id);
assert.equal(privateConfig.setting.urlCheck, false);
assert.equal(JSON.parse(fs.readFileSync(path.join(root, "project.config.json"), "utf8")).appid, "wxXXXXXXXXXXXXXXXX");

const cli = spawnSync(process.execPath, [path.join(root, "scripts/apply-appid.mjs")], {
  env: { ...process.env, WECHAT_APPID: "" },
  encoding: "utf8",
});
assert.notEqual(cli.status, 0);
assert.match(cli.stderr, /WECHAT_APPID/);
assert.equal(JSON.parse(fs.readFileSync(path.join(root, "project.config.json"), "utf8")).appid, "wxXXXXXXXXXXXXXXXX");

const originalGetApp = globalThis.getApp;
const originalGetStorage = globalThis.wx.getStorageSync;
const originalSetStorage = globalThis.wx.setStorageSync;

reset();
globalThis.wx.loginMode = "ok";
globalThis.getApp = () => undefined;
await assert.rejects(async () => {
  await api.bootstrapSession();
}, (error) => error.code === "app_not_ready" && !(error instanceof TypeError));

reset();
globalThis.getApp = () => undefined;
const earlyUser = await api.bootstrapSession({ globalData: state });
assert.equal(earlyUser.canIssueReceipts, false);
assert.equal(earlyUser.wechatBound, true);
assert.equal(state.token, "token-1");
assert.equal(loginCalls, 1);
assert.equal(requests[0].url, "http://127.0.0.1:8787/api/auth/wechat-login");
assert.equal(requests[0].data.code, "code-from-wx");

reset();
state.useMock = true;
globalThis.getApp = () => {
  throw new TypeError("Cannot read property 'globalData' of undefined");
};
const mockBoot = await api.bootstrapSession({ globalData: state });
assert.equal(mockBoot, null);
assert.equal(loginCalls, 0);
const mockStaff = await api.staffLogin("18800000002", "123456");
assert.equal(mockStaff.user.canIssueReceipts, true);
assert.equal(state.token, "mock:staff_tech");
assert.equal(loginCalls, 0);

state.useMock = false;
state.token = "";
state.user = null;
requests.length = 0;
nextResponse = {
  statusCode: 200,
  data: {
    token: "phone-token",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false },
  },
};
const phone = await api.staffLogin("18800000002", "123456");
assert.equal(phone.token, "phone-token");
assert.equal(phone.user.canIssueReceipts, false);
assert.equal(state.token, "phone-token");
assert.equal(requests[0].url, "http://127.0.0.1:8787/api/auth/staff-login");
assert.equal(requests[0].data.mobile, "18800000002");
assert.equal(requests[0].data.password, "123456");
assert.equal(loginCalls, 0);

const storage = {};
globalThis.wx.getStorageSync = (key) => (Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : "");
globalThis.wx.setStorageSync = (key, value) => {
  storage[key] = value;
};
globalThis.getApp = () => undefined;
let launched = null;
globalThis.App = (definition) => {
  launched = definition;
  definition.onLaunch();
};
nextResponse = {
  statusCode: 200,
  data: {
    bound: true,
    token: "launch-token",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false, wechatBound: true },
  },
};
loginCalls = 0;
requests.length = 0;
require(path.join(root, "app.js"));
assert.ok(launched);
assert.equal(typeof launched.globalData.sessionReady.then, "function");
const launchedUser = await launched.globalData.sessionReady;
assert.equal(launchedUser.name, "张师傅");
assert.equal(launchedUser.canIssueReceipts, false);
assert.equal(launched.globalData.token, "launch-token");
assert.equal(state.token, "phone-token");
assert.equal(loginCalls, 1);
assert.equal(requests[0].url, "http://127.0.0.1:8787/api/auth/wechat-login");
assert.equal(storage.staffToken, "launch-token");

for (const key of Object.keys(storage)) delete storage[key];
storage.useMock = true;
loginCalls = 0;
requests.length = 0;
launched.onLaunch();
const mockReady = await launched.globalData.sessionReady;
assert.equal(mockReady, null);
assert.equal(launched.globalData.useMock, true);
assert.equal(loginCalls, 0);
assert.equal(requests.length, 0);
const launchedMock = await api.staffLogin("18800000002", "123456");
assert.equal(launchedMock.user.canIssueReceipts, true);
assert.equal(launched.globalData.token, "mock:staff_tech");
assert.equal(loginCalls, 0);

for (const key of Object.keys(storage)) delete storage[key];
globalThis.getApp = () => {
  throw new TypeError("getApp is not ready");
};
nextResponse = {
  statusCode: 200,
  data: {
    token: "phone-after-launch",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false },
  },
};
launched.globalData.useMock = false;
requests.length = 0;
loginCalls = 0;
const launchedPhone = await api.staffLogin("18800000002", "123456");
assert.equal(launchedPhone.token, "phone-after-launch");
assert.equal(launched.globalData.token, "phone-after-launch");
assert.equal(launchedPhone.user.canIssueReceipts, false);
assert.equal(requests[0].url, "http://127.0.0.1:8787/api/auth/staff-login");
assert.equal(loginCalls, 0);

nextResponse = { statusCode: 503, data: { error: "wechat_not_configured", message: "尚未配置" } };
for (const key of Object.keys(storage)) delete storage[key];
loginCalls = 0;
requests.length = 0;
assert.doesNotThrow(() => launched.onLaunch());
const failedBoot = await launched.globalData.sessionReady;
assert.equal(failedBoot, null);
assert.equal(launched.globalData.token, "");
assert.equal(loginCalls, 1);
assert.equal(launched.globalData.wechatErrorCode, "wechat_not_configured");

globalThis.getApp = originalGetApp;
globalThis.wx.getStorageSync = originalGetStorage;
globalThis.wx.setStorageSync = originalSetStorage;

console.log("miniprogram wechat login checks passed");
