const model = require("./model");

// DevTools lib 3.17.5 still has getApp() undefined for the whole App.onLaunch call.
// onLaunch passes its instance in; later calls use getApp() once the runtime has registered it.
let appInstance = null;

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

function request(path, options) {
  const settings = options || {};
  const state = runtime();
  const base = String(state.apiBase || "").replace(/\/$/, "");
  return new Promise((resolve, reject) => {
    wx.request({
      url: base + path,
      method: settings.method || "GET",
      data: settings.data,
      timeout: 15000,
      header: Object.assign(
        { "Content-Type": "application/json" },
        state.token ? { Authorization: "Bearer " + state.token } : {},
      ),
      success(res) {
        const body = res.data && typeof res.data === "object" ? res.data : {};
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

function saveSession(token, user) {
  const state = runtime();
  state.token = token || "";
  state.user = user || null;
  wx.setStorageSync("staffToken", state.token);
  wx.setStorageSync("staffUser", state.user);
}

function clearSession() {
  const state = runtime();
  state.bindTicket = "";
  saveSession("", null);
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
  return wxLoginCode().then((code) => request("/api/auth/wechat-login", {
    method: "POST",
    data: { code },
  })).then((result) => {
    state.wechatHint = "";
    state.wechatErrorCode = "";
    if (result.bound && result.token) {
      saveSession(result.token, result.user);
      state.bindTicket = "";
    } else {
      state.bindTicket = result.bindTicket || "";
      if (!result.bound) state.wechatHint = result.message || "";
    }
    return result;
  }).catch((error) => {
    state.wechatErrorCode = error.code || "";
    state.wechatHint = error.message || "微信登录失败，请使用手机号和密码";
    throw error;
  });
}

function wechatBind(bindTicket, mobile, password) {
  return request("/api/auth/wechat-bind", {
    method: "POST",
    data: {
      bindTicket,
      mobile: String(mobile || "").trim(),
      password,
    },
  }).then((result) => {
    const state = runtime();
    saveSession(result.token, result.user);
    state.bindTicket = "";
    state.wechatHint = "";
    state.wechatErrorCode = "";
    state.skipWechatAuto = false;
    return result;
  });
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
    runtime().skipWechatAuto = true;
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
  bootstrapSession,
  whenSessionReady,
  createReceipt,
  listReceipts,
  saveSettings,
  writeSignatureFile,
};
