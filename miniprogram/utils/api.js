const model = require("./model");

// DevTools lib 3.17.5 still has getApp() undefined for the whole App.onLaunch call.
// onLaunch passes its instance in; later calls use getApp() once the runtime has registered it.
let appInstance = null;
// Ticket issued by wechat-login. Kept here because DevTools lib 3.17.5 may
// finish App.onLaunch on a different object than the one getApp() returns later.
let pendingBindTicket = "";

function runtime() {
  let app = null;
  if (typeof getApp === "function") {
    try {
      app = getApp();
    } catch (error) {
      app = null;
    }
  }
  if (!app || !app.globalData) app = appInstance;
  if (!app || !app.globalData) {
    throw Object.assign(new Error("小程序尚未完成启动"), { code: "app_not_ready" });
  }
  return app.globalData;
}

function decodeResponse(data) {
  if (data && typeof data === "object") return data;
  if (typeof data === "string" && data.trim()) {
    try {
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") return parsed;
    } catch (error) {}
  }
  return {};
}

function request(path, options) {
  const settings = options || {};
  const state = runtime();
  const base = String(state.apiBase || "").replace(/\/$/, "");
  const method = settings.method || "GET";
  let data = settings.data;
  const verb = String(method).toUpperCase();
  // wx.request JSON-serializes an object only when header["content-type"]
  // (that exact lowercase key) is application/json. DevTools lib 3.17.5
  // already defaults that key, so a capitalized Content-Type is a second
  // header and the object body is dropped. The server then sees {} and
  // POST /api/auth/wechat-bind returns 400 缺少字段：bindTicket.
  // Strings are sent as-is, so this JSON arrives once.
  if (data != null && typeof data === "object" && verb !== "GET" && verb !== "HEAD") {
    data = JSON.stringify(data);
  }
  return new Promise((resolve, reject) => {
    wx.request({
      url: base + path,
      method,
      data,
      timeout: 15000,
      header: Object.assign(
        { "content-type": "application/json" },
        state.token ? { Authorization: "Bearer " + state.token } : {},
      ),
      success(res) {
        const body = decodeResponse(res.data);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
          return;
        }
        const error = new Error(body.message || "请求失败，请稍后重试");
        error.status = res.statusCode;
        error.code = body.error;
        reject(error);
      },
      fail(err) {
        const error = new Error((err && err.errMsg) || "网络异常，请确认 local-backend 已启动");
        error.status = 0;
        reject(error);
      },
    });
  });
}

function sessionDataList() {
  const list = [];
  const add = (data) => {
    if (data && list.indexOf(data) === -1) list.push(data);
  };
  try {
    add(runtime());
  } catch (error) {}
  if (appInstance && appInstance.globalData) add(appInstance.globalData);
  return list;
}

function mirrorBindTicket(ticket) {
  pendingBindTicket = String(ticket || "").trim();
  for (const data of sessionDataList()) data.bindTicket = pendingBindTicket;
  return pendingBindTicket;
}

function currentBindTicket() {
  let data = null;
  try {
    data = runtime();
  } catch (error) {
    return pendingBindTicket;
  }
  const onData = String(data.bindTicket || "").trim();
  if (onData) {
    pendingBindTicket = onData;
    return onData;
  }
  if (pendingBindTicket) data.bindTicket = pendingBindTicket;
  return pendingBindTicket;
}

function publishWechatStatus(partial) {
  for (const data of sessionDataList()) {
    if (partial.wechatHint !== undefined) data.wechatHint = partial.wechatHint;
    if (partial.wechatErrorCode !== undefined) data.wechatErrorCode = partial.wechatErrorCode;
    if (partial.skipWechatAuto !== undefined) data.skipWechatAuto = partial.skipWechatAuto;
  }
}

function saveSession(token, user) {
  const nextToken = token || "";
  const nextUser = user || null;
  const list = sessionDataList();
  if (!list.length) {
    throw Object.assign(new Error("小程序尚未完成启动"), { code: "app_not_ready" });
  }
  for (const data of list) {
    data.token = nextToken;
    data.user = nextUser;
  }
  wx.setStorageSync("staffToken", nextToken);
  wx.setStorageSync("staffUser", nextUser);
}

function clearSession() {
  pendingBindTicket = "";
  saveSession("", null);
  for (const data of sessionDataList()) data.bindTicket = "";
}

function wxLoginCode() {
  return new Promise((resolve, reject) => {
    if (typeof wx === "undefined" || !wx.login) {
      reject(Object.assign(new Error("当前环境不能调用微信登录，请使用手机号和密码"), { status: 0, code: "wx_login_unavailable" }));
      return;
    }
    wx.login({
      timeout: 10000,
      success(res) {
        if (!res || !res.code) {
          reject(Object.assign(new Error("微信登录未返回 code，请改用手机号和密码"), { status: 0, code: "wx_login_failed" }));
          return;
        }
        resolve(res.code);
      },
      fail(err) {
        const detail = err && err.errMsg ? "（" + err.errMsg + "）" : "";
        reject(Object.assign(new Error("微信登录不可用，请先在 project.config.json 和 config.js 填写 AppID，或改用手机号密码登录" + detail), { status: 0, code: "wx_login_failed" }));
      },
    });
  });
}

function enterWithWechat(options) {
  const force = Boolean(options && options.force);
  const state = runtime();
  if (state.useMock) return Promise.resolve({ bound: false, mock: true });
  if (!force && state.skipWechatAuto) return Promise.resolve({ bound: false, skipped: true });
  if (!force && state.token) {
    return refreshMe().then((user) => ({ bound: Boolean(user), user })).catch((error) => {
      if (error && error.status === 401) return enterWithWechat({ force: true });
      throw error;
    });
  }
  state.skipWechatAuto = false;
  publishWechatStatus({ skipWechatAuto: false });
  return wxLoginCode().then((code) => request("/api/auth/wechat-login", {
    method: "POST",
    data: { code },
  })).then((result) => {
    state.wechatHint = "";
    state.wechatErrorCode = "";
    publishWechatStatus({ wechatHint: "", wechatErrorCode: "" });
    if (result.bound && result.token) {
      saveSession(result.token, result.user);
      mirrorBindTicket("");
    } else {
      mirrorBindTicket(result.bindTicket || "");
      if (!result.bound) {
        state.wechatHint = result.message || "";
        publishWechatStatus({ wechatHint: state.wechatHint });
      }
    }
    return result;
  }).catch((error) => {
    state.wechatErrorCode = error.code || "";
    state.wechatHint = error.message || "微信登录失败，请使用手机号和密码";
    publishWechatStatus({ wechatErrorCode: state.wechatErrorCode, wechatHint: state.wechatHint });
    throw error;
  });
}

function clientError(message, code) {
  return Object.assign(new Error(message), { status: 400, code });
}

function wechatBind(bindTicket, mobile, password) {
  const ticket = String(bindTicket || "").trim();
  const mobileText = String(mobile || "").trim();
  const passwordText = password == null ? "" : String(password);
  if (!ticket) {
    return Promise.reject(clientError("请先点「微信登录」。还没有绑定凭证，或凭证已失效。也可以直接填写手机号和密码登录。", "missing_bind_ticket"));
  }
  if (!mobileText || !passwordText) {
    return Promise.reject(clientError("请填写手机号和密码", "missing_field"));
  }
  return request("/api/auth/wechat-bind", {
    method: "POST",
    data: {
      bindTicket: ticket,
      mobile: mobileText,
      password: passwordText,
    },
  }).then((result) => {
    saveSession(result.token, result.user);
    mirrorBindTicket("");
    publishWechatStatus({ wechatHint: "", wechatErrorCode: "", skipWechatAuto: false });
    return result;
  }).catch((error) => {
    if (error && error.code === "bind_ticket_invalid") mirrorBindTicket("");
    if (error && error.code === "missing_field" && String(error.message || "").indexOf("bindTicket") !== -1) {
      error.message = "绑定凭证没有提交成功。请重新点「微信登录」，再填写手机号和密码。";
    }
    return Promise.reject(error);
  });
}

function loginWithPassword(mobile, password) {
  const mobileText = String(mobile || "").trim();
  const passwordText = password == null ? "" : String(password);
  if (!mobileText || !passwordText) {
    return Promise.reject(clientError("请填写手机号和密码", "missing_field"));
  }
  const state = runtime();
  const ticket = state.useMock ? "" : currentBindTicket();
  if (ticket) return wechatBind(ticket, mobileText, passwordText);
  return staffLogin(mobileText, passwordText);
}

function bootstrapSession(app) {
  if (app && app.globalData) appInstance = app;
  const state = runtime();
  if (state.sessionPromise) return state.sessionPromise;
  const run = () => {
    if (state.useMock || state.skipWechatAuto) return Promise.resolve(state.user || null);
    if (state.token) {
      return refreshMe().catch((error) => {
        if (error && error.status === 401) return enterWithWechat().then((result) => (result && result.user) || null);
        throw error;
      });
    }
    return enterWithWechat().then((result) => (result && result.user) || null).catch(() => null);
  };
  state.sessionPromise = run().finally(() => {
    state.sessionPromise = null;
  });
  return state.sessionPromise;
}

function whenSessionReady() {
  try {
    const ready = runtime().sessionReady;
    if (!ready || typeof ready.then !== "function") return Promise.resolve();
    return ready.then(() => undefined, () => undefined);
  } catch (error) {
    return Promise.resolve();
  }
}

function getCatalog() {
  if (runtime().useMock) return Promise.resolve(model.normalizeCatalog(model.publicCatalog()));
  return request("/api/catalog").then((data) => model.normalizeCatalog(data));
}

function calculate(input) {
  if (runtime().useMock) {
    try {
      return Promise.resolve(model.calculateMock(input));
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return request("/api/quotes/calculate", { method: "POST", data: input });
}

function health() {
  if (runtime().useMock) return Promise.resolve({ ok: true, mock: true });
  return request("/api/health");
}

function staffLogin(mobile, password) {
  if (runtime().useMock) {
    try {
      const result = model.mockLogin(mobile, password);
      saveSession(result.token, result.user);
      return Promise.resolve(result);
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return request("/api/auth/staff-login", {
    method: "POST",
    data: { mobile: String(mobile || "").trim(), password },
  }).then((result) => {
    saveSession(result.token, result.user);
    return result;
  });
}

function staffLogout() {
  const finish = () => {
    clearSession();
    publishWechatStatus({ skipWechatAuto: true });
    return { ok: true };
  };
  if (runtime().useMock || !runtime().token) return Promise.resolve(finish());
  return request("/api/auth/logout", { method: "POST" }).then(finish, finish);
}

function refreshMe() {
  if (runtime().useMock) return Promise.resolve(runtime().user);
  if (!runtime().token) {
    clearSession();
    return Promise.resolve(null);
  }
  return request("/api/auth/me").then((data) => {
    saveSession(runtime().token, data.user);
    return data.user;
  }).catch((error) => {
    if (error.status === 401) clearSession();
    throw error;
  });
}

function createReceipt(body) {
  if (runtime().useMock) {
    try {
      return Promise.resolve({ receipt: mockReceipt(body) });
    } catch (error) {
      return Promise.reject(error);
    }
  }
  return request("/api/staff/receipts", { method: "POST", data: body });
}

function listReceipts() {
  if (runtime().useMock) {
    const user = runtime().user;
    if (!user) return Promise.resolve({ receipts: [] });
    const all = wx.getStorageSync("mockReceipts") || [];
    return Promise.resolve({ receipts: all.filter((item) => item.createdByStaffId === user.id) });
  }
  return request("/api/staff/receipts");
}

function saveSettings(apiBase, useMock) {
  const state = runtime();
  const nextBase = String(apiBase || "").trim().replace(/\/$/, "");
  const nextMock = Boolean(useMock);
  const modeChanged = state.useMock !== nextMock;
  state.apiBase = nextBase || state.apiBase;
  state.useMock = nextMock;
  wx.setStorageSync("apiBase", state.apiBase);
  wx.setStorageSync("useMock", nextMock);
  state.catalogDirty = true;
  if (modeChanged) {
    clearSession();
    state.skipWechatAuto = false;
    state.sessionReady = bootstrapSession().catch(() => null);
  }
  return { apiBase: state.apiBase, useMock: nextMock };
}

function mockReceipt(body) {
  const user = runtime().user;
  if (!user || !user.canIssueReceipts) {
    throw Object.assign(new Error("该师傅账号尚未获得开具收据权限，请联系管理员"), { status: 403 });
  }
  if (!String(body.customerName || "").trim()) throw Object.assign(new Error("请填写客户姓名"), { status: 400 });
  if (!body.signatureDataUrl) throw Object.assign(new Error("请先完成客户签名"), { status: 400 });
  const quote = model.calculateMock(body);
  if (body.expectedTotal !== undefined && body.expectedTotal !== quote.total) {
    throw Object.assign(new Error("报价已变更，请返回重新确认并签名"), { status: 409 });
  }
  const now = new Date();
  const pad = (value) => (value < 10 ? "0" : "") + value;
  const repairTime = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
  const expire = new Date(now);
  expire.setDate(expire.getDate() + Number(body.warrantyDays || 0));
  const expireText = expire.getFullYear() + "-" + pad(expire.getMonth() + 1) + "-" + pad(expire.getDate());
  const no = "YSY" + now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + String(now.getTime()).slice(-5);
  const receipt = {
    no,
    createdByStaffId: user.id,
    customerName: String(body.customerName).trim(),
    serviceName: quote.services.map((service) => service.name).join("、"),
    brandName: quote.brand.name,
    cityName: quote.city.name,
    repairTime,
    warrantyDays: Number(body.warrantyDays || 0),
    warrantyExpireDate: expireText,
    amount: quote.total,
    lines: quote.rows,
    includes: "",
    excludes: "",
    signatureDataUrl: body.signatureDataUrl,
    voided: false,
  };
  const all = wx.getStorageSync("mockReceipts") || [];
  all.unshift(receipt);
  wx.setStorageSync("mockReceipts", all.slice(0, 50));
  return receipt;
}

function writeSignatureFile(dataUrl) {
  const matched = String(dataUrl || "").match(/^data:image\/\w+;base64,(.+)$/);
  if (!matched || !wx.env || !wx.env.USER_DATA_PATH) return Promise.resolve("");
  const filePath = wx.env.USER_DATA_PATH + "/sig-" + Date.now() + ".png";
  return new Promise((resolve) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data: matched[1],
      encoding: "base64",
      success: () => resolve(filePath),
      fail: () => resolve(""),
    });
  });
}

module.exports = {
  request,
  saveSession,
  clearSession,
  getCatalog,
  calculate,
  health,
  staffLogin,
  staffLogout,
  refreshMe,
  enterWithWechat,
  wechatBind,
  loginWithPassword,
  currentBindTicket,
  bootstrapSession,
  whenSessionReady,
  createReceipt,
  listReceipts,
  saveSettings,
  writeSignatureFile,
};
