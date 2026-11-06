import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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
const toasts = [];
let loginCalls = 0;
let loginMode = "ok";
let requestMode = "ok";
let nextResponse = { statusCode: 200, data: {} };

globalThis.getApp = () => ({ globalData: state });
globalThis.wx = {
  getStorageSync() {
    return "";
  },
  setStorageSync() {},
  switchTab() {},
  showToast(options) {
    toasts.push(options);
  },
  login(options) {
    loginCalls += 1;
    if (loginMode === "hang") return;
    if (loginMode === "fail") options.fail({ errMsg: "login:fail" });
    else options.success({ code: "code-from-wx" });
  },
  request(options) {
    requests.push(options);
    if (requestMode === "hang") return;
    options.success(nextResponse);
  },
};

let pageDef = null;
globalThis.Page = (definition) => {
  pageDef = definition;
};
require(path.join(root, "pages/account/account.js"));
const api = require(path.join(root, "utils/api.js"));
const pages = [];

function createPage() {
  const page = {
    data: Object.assign({}, pageDef.data),
    setData(patch, callback) {
      Object.assign(this.data, patch || {});
      if (typeof callback === "function") callback();
    },
  };
  for (const [key, value] of Object.entries(pageDef)) {
    if (typeof value === "function") page[key] = value.bind(page);
  }
  page.onLoad();
  pages.push(page);
  return page;
}

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
  toasts.length = 0;
  loginCalls = 0;
  loginMode = "ok";
  requestMode = "ok";
  nextResponse = { statusCode: 200, data: {} };
  globalThis.getApp = () => ({ globalData: state });
  api.clearSession();
}

function bodyOf(index) {
  const data = requests[index].data;
  return typeof data === "string" ? JSON.parse(data) : data;
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

const wxml = fs.readFileSync(path.join(root, "pages/account/account.wxml"), "utf8");
const loginAt = wxml.indexOf("师傅登录");
const messageAt = wxml.indexOf('id="authMessage"');
const debugAt = wxml.indexOf("报价接口");
assert.ok(loginAt > 0 && messageAt > loginAt && messageAt < debugAt);
assert.match(wxml, /scroll-into-view="\{\{authAnchor\}\}"/);
assert.match(wxml, /bindtap="onWechat"/);
assert.match(wxml, /bindtap="onLogin"/);
assert.equal(wxml.includes('disabled="{{loggingIn}}"'), false);
assert.match(wxml, /class="message"/);

reset();
const emptyPage = createPage();
state.bindTicket = "ticket-stuck";
emptyPage.onLogin();
assert.equal(emptyPage.data.message, "请填写手机号和密码");
assert.equal(emptyPage.data.authAnchor, "authMessage");
assert.equal(toasts.at(-1).title, "请填写手机号和密码");
assert.equal(toasts.at(-1).icon, "none");
assert.equal(requests.length, 0);
assert.equal(loginCalls, 0);
assert.equal(emptyPage._authLock, false);
assert.equal(emptyPage.data.loggingIn, false);

reset();
const blankPage = createPage();
blankPage.setData({ mobile: "   ", password: "  " });
blankPage.onLogin();
assert.equal(blankPage.data.message, "请填写手机号和密码");
assert.equal(requests.length, 0);
assert.equal(blankPage._authLock, false);

reset();
const mobileOnly = createPage();
mobileOnly.setData({ mobile: "18800000002", password: "" });
mobileOnly.onLogin();
assert.equal(mobileOnly.data.message, "请填写手机号和密码");
assert.equal(requests.length, 0);

reset();
const passwordOnly = createPage();
passwordOnly.setData({ mobile: "", password: "123456" });
passwordOnly.onLogin();
assert.equal(passwordOnly.data.message, "请填写手机号和密码");
assert.equal(requests.length, 0);

reset();
const stuckEmpty = createPage();
stuckEmpty._authLock = true;
stuckEmpty._authLockAt = 0;
stuckEmpty.data.loggingIn = true;
state.bindTicket = "ticket-stuck";
stuckEmpty.onLogin();
assert.equal(stuckEmpty.data.message, "请填写手机号和密码");
assert.equal(stuckEmpty._authLock, false);
assert.equal(stuckEmpty.data.loggingIn, false);
assert.equal(requests.length, 0);
state.bindTicket = "";
stuckEmpty.setData({ mobile: "18800000002", password: "123456" });
nextResponse = {
  statusCode: 200,
  data: {
    token: "phone-after-stuck",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false },
  },
};
stuckEmpty.onLogin();
await flush();
assert.equal(requests.length, 1);
assert.match(requests[0].url, /\/api\/auth\/staff-login$/);
assert.equal(stuckEmpty._authLock, false);
assert.equal(stuckEmpty.data.loggingIn, false);
assert.match(stuckEmpty.data.message, /登录成功/);

reset();
requestMode = "hang";
const busy = createPage();
busy.setData({ mobile: "18800000002", password: "123456" });
busy.onLogin();
assert.equal(requests.length, 1);
assert.equal(busy.data.message, "正在登录…");
assert.equal(busy.data.loggingIn, true);
assert.equal(busy._authLock, true);
busy.setData({ mobile: "", password: "" });
busy.onLogin();
assert.equal(requests.length, 1);
assert.equal(busy.data.message, "正在登录，请稍候");
assert.equal(busy._authLock, true);
const busyGen = busy._authGen;
busy.onAuthTimeout(busyGen);
assert.equal(busy._authLock, false);
assert.equal(busy.data.loggingIn, false);
assert.equal(busy.data.message, "登录超时，请再试一次");
requests[0].success({
  statusCode: 200,
  data: { token: "late", user: { name: "张师傅", role: "technician", canIssueReceipts: true } },
});
await flush();
assert.equal(busy.data.message, "登录超时，请再试一次");
assert.equal(busy._authLock, false);
assert.equal(busy.data.loggingIn, false);
busy.setData({ mobile: "", password: "" });
busy.onLogin();
assert.equal(busy.data.message, "请填写手机号和密码");
assert.equal(requests.length, 1);

reset();
const stale = createPage();
stale._authLock = true;
stale._authLockAt = 1;
stale.data.loggingIn = true;
stale.setData({ mobile: "18800000002", password: "123456" });
nextResponse = {
  statusCode: 200,
  data: {
    token: "after-stale",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false },
  },
};
stale.onLogin();
assert.equal(stale.data.message, "正在登录…");
assert.equal(requests.length, 1);
await flush();
assert.equal(stale._authLock, false);
assert.equal(stale.data.loggingIn, false);
assert.match(stale.data.message, /登录成功/);

reset();
loginMode = "hang";
const wechatBusy = createPage();
wechatBusy.onWechat();
assert.equal(loginCalls, 1);
assert.equal(requests.length, 0);
assert.equal(wechatBusy.data.message, "正在通过微信登录…");
assert.equal(wechatBusy._authLock, true);
wechatBusy.onWechat();
assert.equal(loginCalls, 1);
assert.equal(wechatBusy.data.message, "正在登录，请稍候");
assert.equal(wechatBusy._authLock, true);
wechatBusy.onAuthTimeout(wechatBusy._authGen);
assert.equal(wechatBusy._authLock, false);
assert.equal(wechatBusy.data.loggingIn, false);
assert.equal(wechatBusy.data.message, "登录超时，请再试一次");

reset();
loginMode = "fail";
const wechatFail = createPage();
wechatFail.renderUser = () => {
  throw new Error("render-broke");
};
wechatFail.onWechat();
await flush();
assert.equal(requests.length, 0);
assert.match(wechatFail.data.message, /微信登录/);
assert.equal(wechatFail._authLock, false);
assert.equal(wechatFail.data.loggingIn, false);
assert.equal(toasts.at(-1).title, wechatFail.data.message);
loginMode = "ok";
nextResponse = { statusCode: 200, data: { bound: false, bindTicket: "ticket-9", message: "请绑定" } };
wechatFail.renderUser = pageDef.renderUser.bind(wechatFail);
wechatFail.onWechat();
await flush();
assert.equal(requests.length, 1);
assert.match(requests[0].url, /\/api\/auth\/wechat-login$/);
assert.match(wechatFail.data.message, /尚未绑定/);
assert.equal(wechatFail.data.loginLabel, "绑定并登录");
assert.equal(wechatFail._authLock, false);
assert.equal(wechatFail.data.loggingIn, false);

reset();
const thrown = createPage();
thrown.setData({ mobile: "18800000002", password: "123456" });
globalThis.getApp = () => {
  throw new Error("getApp failed");
};
thrown.onLogin();
assert.equal(thrown.data.message, "getApp failed");
assert.equal(thrown._authLock, false);
assert.equal(thrown.data.loggingIn, false);
assert.equal(requests.length, 0);
globalThis.getApp = () => ({ globalData: state });

reset();
const syncFail = createPage();
syncFail.setData({ mobile: "18800000002", password: "123456" });
const originalLogin = api.loginWithPassword;
api.loginWithPassword = () => {
  throw new Error("boom-sync");
};
try {
  syncFail.onLogin();
  assert.equal(syncFail.data.message, "boom-sync");
  assert.equal(syncFail._authLock, false);
  assert.equal(syncFail.data.loggingIn, false);
} finally {
  api.loginWithPassword = originalLogin;
}

reset();
const renderFail = createPage();
renderFail.setData({ mobile: "18800000002", password: "123456" });
renderFail.renderUser = () => {
  throw new Error("render-broke");
};
nextResponse = {
  statusCode: 200,
  data: {
    token: "rendered",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false },
  },
};
renderFail.onLogin();
await flush();
assert.equal(renderFail.data.message, "render-broke");
assert.equal(renderFail._authLock, false);
assert.equal(renderFail.data.loggingIn, false);

reset();
const shown = createPage();
shown._authLock = true;
shown._authLockAt = 1;
shown.data.loggingIn = true;
shown.onShow();
await flush();
assert.equal(shown._authLock, false);
assert.equal(shown.data.loggingIn, false);
assert.equal(shown.data.message, "上次登录没有完成，请再试一次");

reset();
const freshShow = createPage();
freshShow._authLock = true;
freshShow._authLockAt = Date.now();
freshShow.data.loggingIn = true;
freshShow.onShow();
await flush();
assert.equal(freshShow._authLock, true);
assert.equal(freshShow.data.loggingIn, true);
assert.equal(freshShow.data.message, "");

reset();
state.bindTicket = "ticket-1";
nextResponse = {
  statusCode: 200,
  data: {
    token: "token-2",
    user: { id: "staff_tech", name: "张师傅", role: "technician", canIssueReceipts: false, wechatBound: true },
  },
};
const bindPage = createPage();
bindPage.setData({ mobile: " 18800000002 ", password: "123456" });
bindPage.onLogin();
await flush();
assert.equal(requests.length, 1);
assert.match(requests[0].url, /\/api\/auth\/wechat-bind$/);
assert.equal(bodyOf(0).bindTicket, "ticket-1");
assert.equal(bodyOf(0).mobile, "18800000002");
assert.equal(bodyOf(0).password, "123456");
assert.match(bindPage.data.message, /已绑定微信/);
assert.equal(bindPage.data.password, "");
assert.equal(bindPage.data.loggedIn, true);
assert.equal(bindPage._authLock, false);
assert.equal(bindPage.data.loggingIn, false);

reset();
const unloadPage = createPage();
requestMode = "hang";
unloadPage.setData({ mobile: "18800000002", password: "123456" });
unloadPage.onLogin();
assert.notEqual(unloadPage._authTimer, 0);
unloadPage.onUnload();
assert.equal(unloadPage._authTimer, 0);

for (const page of pages) page.clearAuthTimer();

console.log("account auth feedback checks passed");
