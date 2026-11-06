const model = require("../../utils/model");
const api = require("../../utils/api");
const layout = require("../../utils/layout");
const debugAccess = require("../../utils/debug-access");
const initialFrame = layout.pageFrame(375, 667);
// Longer than wx.login (10s) plus wx.request (15s). If those callbacks never
// fire, the lock still clears and the next tap can start a new attempt.
const AUTH_LOCK_MS = 30000;

Page({
  data: {
    pageHeight: initialFrame.pageHeight,
    profileName: "欢迎使用壹思源",
    profileStatus: "游客可查价，开具收据需师傅账号授权",
    permission: "未登录",
    loggedIn: false,
    avatarText: "壹",
    maskedMobile: "未提供",
    wechatBound: false,
    canIssue: false,
    mobile: "",
    password: "",
    apiBase: "",
    useMock: false,
    loggingIn: false,
    message: "",
    authAnchor: "",
    wechatLine: "进入后会尝试微信登录。还没有 AppID 时请用手机号和密码。",
    loginLabel: "登录",
    showDebug: debugAccess.showDebugSettings(debugAccess.readEnvVersion(), false),
  },

  onLoad() {
    this.debugUnlocked = false;
    this._authLock = false;
    this._authLockAt = 0;
    this._authGen = 0;
    this._authTimer = 0;
    this.applyLayout();
    this.refreshDebug();
  },

  onShow() {
    this.applyLayout();
    this.refreshDebug();
    if (this.releaseStuckAuth()) this.showAuthNotice("上次登录没有完成，请再试一次");
    const state = getApp().globalData;
    this.setData({ apiBase: state.apiBase, useMock: state.useMock });
    const ready = state.sessionReady || Promise.resolve();
    ready.then(() => (state.token ? api.refreshMe().catch(() => null) : null)).then(() => this.renderUser());
  },

  onUnload() {
    this.clearAuthTimer();
  },

  refreshDebug() {
    const version = debugAccess.readEnvVersion();
    this.setData({ showDebug: debugAccess.showDebugSettings(version, this.debugUnlocked) });
  },

  unlockDebug() {
    this.debugUnlocked = true;
    if (this.data.showDebug) return;
    this.setData({ showDebug: true, message: "已打开调试设置" });
  },

  onProfileTap() {
    const now = Date.now();
    const recent = (this._profileTaps || []).filter((at) => now - at < 2000);
    recent.push(now);
    this._profileTaps = recent;
    if (recent.length >= 5) this.unlockDebug();
  },

  onProfileLongPress() {
    this.unlockDebug();
  },

  applyLayout() {
    try {
      const box = layout.readWindow();
      const frame = layout.pageFrame(box.windowWidth, box.windowHeight, box.screenHeight);
      if (frame.pageHeight > 0) this.setData({ pageHeight: frame.pageHeight });
    } catch (error) {}
  },

  renderUser() {
    const state = getApp().globalData;
    const user = state.user;
    const bindTicket = state.useMock ? "" : api.currentBindTicket();
    let wechatLine = "未绑定微信。可点「微信登录」，或直接用手机号和密码。";
    if (state.useMock) wechatLine = "本地演示不连接微信。没有 AppID 时也可以用手机号和密码走通查价和开据。";
    else if (user && user.wechatBound) wechatLine = "已绑定微信。下次打开会优先使用微信登录。开据权限仍由管理员控制。";
    else if (bindTicket) wechatLine = "该微信尚未绑定。请填写下方手机号和密码完成首次绑定，不会因此开通开据权限。";
    else if (state.wechatErrorCode === "wechat_not_configured" || state.wechatErrorCode === "wx_login_failed" || state.wechatErrorCode === "wx_login_unavailable") {
      wechatLine = "微信登录还不可用。请在注册后把 AppID 写入 project.config.json 和 config.js，并在后端设置 WECHAT_APP_SECRET。现在可用手机号和密码登录。";
    } else if (state.wechatHint && !user) wechatLine = state.wechatHint;
    this.setData({
      loggedIn: Boolean(user),
      avatarText: user && user.name ? user.name.slice(0, 1) : "壹",
      maskedMobile: user && user.mobile ? user.mobile.replace(/^(\d{3})\d{4}(\d{4})$/, "$1 **** $2") : "未提供",
      wechatBound: Boolean(user && user.wechatBound),
      canIssue: Boolean(user && user.canIssueReceipts),
      profileName: user ? user.name : "欢迎使用壹思源",
      profileStatus: model.roleLabel(user),
      permission: model.permissionLabel(user),
      wechatLine,
      loginLabel: !state.useMock && bindTicket ? "绑定并登录" : "登录",
      useMock: state.useMock,
    });
  },

  onMobile(event) {
    this.setData({ mobile: event.detail.value });
  },

  onPassword(event) {
    this.setData({ password: event.detail.value });
  },

  onBase(event) {
    this.setData({ apiBase: event.detail.value });
  },

  onMock(event) {
    this.setData({ useMock: Boolean(event.detail.value) });
  },

  authInFlight() {
    if (!this._authLock && !this.data.loggingIn) return false;
    const started = this._authLockAt || 0;
    if (!started) return false;
    return Date.now() - started < AUTH_LOCK_MS;
  },

  clearAuthTimer() {
    if (!this._authTimer) return;
    clearTimeout(this._authTimer);
    this._authTimer = 0;
  },

  releaseStuckAuth() {
    if (this.authInFlight()) return false;
    if (!this._authLock && !this.data.loggingIn) return false;
    this.clearAuthTimer();
    this._authGen = (this._authGen || 0) + 1;
    this._authLock = false;
    this._authLockAt = 0;
    if (this.data.loggingIn) this.setData({ loggingIn: false });
    return true;
  },

  showAuthNotice(text) {
    const message = String(text || "");
    this.setData({ message, authAnchor: "" }, () => {
      if (message) this.setData({ authAnchor: "authMessage" });
    });
    if (!message || typeof wx === "undefined" || typeof wx.showToast !== "function") return;
    try {
      wx.showToast({ title: message, icon: "none", duration: 2500 });
    } catch (error) {}
  },

  beginAuth(progress) {
    if (!this.releaseStuckAuth() && (this._authLock || this.data.loggingIn)) {
      this.showAuthNotice("正在登录，请稍候");
      return 0;
    }
    this._authGen = (this._authGen || 0) + 1;
    const gen = this._authGen;
    this._authLock = true;
    this._authLockAt = Date.now();
    this.clearAuthTimer();
    this._authTimer = setTimeout(() => this.onAuthTimeout(gen), AUTH_LOCK_MS);
    this.setData({ loggingIn: true });
    if (progress) this.showAuthNotice(progress);
    return gen;
  },

  onAuthTimeout(gen) {
    if (gen !== this._authGen) return;
    this.clearAuthTimer();
    this._authGen += 1;
    this._authLock = false;
    this._authLockAt = 0;
    this.setData({ loggingIn: false });
    this.showAuthNotice("登录超时，请再试一次");
  },

  finishAuth(gen) {
    if (gen !== this._authGen) return;
    this.clearAuthTimer();
    this._authLock = false;
    this._authLockAt = 0;
    if (this.data.loggingIn) this.setData({ loggingIn: false });
  },

  settleAuth(gen, task, onResult, failureText) {
    Promise.resolve(task).then((result) => {
      if (gen !== this._authGen) return;
      try {
        onResult(result);
      } catch (error) {
        this.showAuthNotice((error && error.message) || "登录结果无法显示，请再试一次");
      }
    }, (error) => {
      if (gen !== this._authGen) return;
      this.showAuthNotice((error && error.message) || failureText || "登录失败");
      try {
        this.renderUser();
      } catch (renderError) {}
    }).then(() => this.finishAuth(gen), () => this.finishAuth(gen));
  },

  onLogin() {
    const mobile = String(this.data.mobile || "").trim();
    const password = this.data.password == null ? "" : String(this.data.password);
    if (!mobile || !String(password).trim()) {
      if (this.authInFlight()) {
        this.showAuthNotice("正在登录，请稍候");
        return;
      }
      this.releaseStuckAuth();
      this.showAuthNotice("请填写手机号和密码");
      return;
    }
    const gen = this.beginAuth("正在登录…");
    if (!gen) return;
    try {
      const state = getApp().globalData;
      const binding = !state.useMock && Boolean(api.currentBindTicket());
      this.settleAuth(gen, api.loginWithPassword(this.data.mobile, this.data.password), (result) => {
        const allowed = result.user && result.user.canIssueReceipts;
        let message = allowed ? "登录成功，可以返回查价报价开具收据。" : "登录成功。开据权限需由管理员开通。";
        if (binding) message = allowed ? "已绑定微信，可以返回查价报价开具收据。" : "已绑定微信。开据权限需由管理员开通，微信绑定不会自动开通。";
        this.setData({ password: "" });
        this.showAuthNotice(message);
        this.renderUser();
      });
    } catch (error) {
      this.showAuthNotice((error && error.message) || "登录失败");
      this.finishAuth(gen);
    }
  },

  onWechat() {
    const gen = this.beginAuth("正在通过微信登录…");
    if (!gen) return;
    try {
      this.settleAuth(gen, api.enterWithWechat({ force: true }), (result) => {
        let message = "请使用微信登录，或填写手机号和密码。";
        if (result && result.bound) {
          const allowed = result.user && result.user.canIssueReceipts;
          message = allowed ? "微信登录成功，可以返回查价报价开具收据。" : "微信登录成功。开据权限需由管理员开通。";
        } else if (result && result.bindTicket) {
          message = "该微信尚未绑定师傅账号，请填写手机号和密码完成首次绑定。绑定不会自动开通开据权限。";
        } else if (result && result.mock) {
          message = "本地演示不调用微信。请用手机号和密码登录。";
        }
        this.showAuthNotice(message);
        this.renderUser();
      }, "微信登录失败，请改用手机号和密码");
    } catch (error) {
      this.showAuthNotice((error && error.message) || "微信登录失败，请改用手机号和密码");
      this.finishAuth(gen);
    }
  },

  openHistory() {
    wx.switchTab({ url: "/pages/history/history" });
  },

  onLogout() {
    api.staffLogout().then(() => {
      this.setData({ message: "已退出登录" });
      this.renderUser();
    });
  },

  onSave() {
    const saved = api.saveSettings(this.data.apiBase, this.data.useMock);
    this.setData({
      apiBase: saved.apiBase,
      useMock: saved.useMock,
      message: saved.useMock ? "已改为本地演示数据。返回查价页会重新加载目录。" : "已保存接口地址 " + saved.apiBase + "。返回查价页会重新加载目录。",
    });
    this.renderUser();
  },

  onTest() {
    const saved = api.saveSettings(this.data.apiBase, this.data.useMock);
    this.setData({ apiBase: saved.apiBase, useMock: saved.useMock, message: "正在连接…" });
    this.renderUser();
    api.health().then((data) => {
      if (data.mock) this.setData({ message: "本地演示数据已启用，未请求网络。" });
      else {
        const wechat = data.wechatLogin === "configured" ? "微信登录已配置。" : "微信登录尚未配置，仍可用手机号密码。";
        this.setData({ message: (data.ok ? "已连通 local-backend。" : "服务有响应，但状态异常。") + wechat });
      }
    }).catch((error) => {
      this.setData({ message: "连接失败：" + error.message });
    });
  },
});
