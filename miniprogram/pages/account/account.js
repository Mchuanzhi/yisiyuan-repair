const model = require("../../utils/model");
const api = require("../../utils/api");

Page({
  data: {
    profileName: "欢迎使用壹思源",
    profileStatus: "游客可查价，开具收据需师傅账号授权",
    permission: "未登录",
    loggedIn: false,
    mobile: "",
    password: "",
    apiBase: "",
    useMock: false,
    loggingIn: false,
    message: "",
    wechatLine: "进入后会尝试微信登录。还没有 AppID 时请用手机号和密码。",
    loginLabel: "登录",
  },

  onShow() {
    const state = getApp().globalData;
    this.setData({ apiBase: state.apiBase, useMock: state.useMock });
    const ready = state.sessionReady || Promise.resolve();
    ready.then(() => (state.token ? api.refreshMe().catch(() => null) : null)).then(() => this.renderUser());
  },

  renderUser() {
    const state = getApp().globalData;
    const user = state.user;
    let wechatLine = "未绑定微信。可点「微信登录」，或直接用手机号和密码。";
    if (state.useMock) wechatLine = "本地演示不连接微信。没有 AppID 时也可以用手机号和密码走通查价和开据。";
    else if (user && user.wechatBound) wechatLine = "已绑定微信。下次打开会优先使用微信登录。开据权限仍由管理员控制。";
    else if (state.bindTicket) wechatLine = "该微信尚未绑定。请填写下方手机号和密码完成首次绑定，不会因此开通开据权限。";
    else if (state.wechatErrorCode === "wechat_not_configured" || state.wechatErrorCode === "wx_login_failed" || state.wechatErrorCode === "wx_login_unavailable") {
      wechatLine = "微信登录还不可用。请在注册后把 AppID 写入 project.config.json 和 config.js，并在后端设置 WECHAT_APP_SECRET。现在可用手机号和密码登录。";
    } else if (state.wechatHint && !user) wechatLine = state.wechatHint;
    this.setData({
      loggedIn: Boolean(user),
      profileName: user ? user.name : "欢迎使用壹思源",
      profileStatus: model.roleLabel(user),
      permission: model.permissionLabel(user),
      wechatLine,
      loginLabel: !state.useMock && state.bindTicket ? "绑定并登录" : "登录",
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

  onLogin() {
    if (this.data.loggingIn) return;
    const state = getApp().globalData;
    const binding = Boolean(state.bindTicket) && !state.useMock;
    this.setData({ loggingIn: true, message: "" });
    const action = binding
      ? api.wechatBind(state.bindTicket, this.data.mobile, this.data.password)
      : api.staffLogin(this.data.mobile, this.data.password);
    action.then((result) => {
      const allowed = result.user && result.user.canIssueReceipts;
      let message = allowed ? "登录成功，可以返回查价报价开具收据。" : "登录成功。开据权限需由管理员开通。";
      if (binding) message = allowed ? "已绑定微信，可以返回查价报价开具收据。" : "已绑定微信。开据权限需由管理员开通，微信绑定不会自动开通。";
      this.setData({ password: "", message });
      this.renderUser();
    }).catch((error) => {
      this.setData({ message: error.message });
    }).then(() => this.setData({ loggingIn: false }));
  },

  onWechat() {
    if (this.data.loggingIn) return;
    this.setData({ loggingIn: true, message: "正在通过微信登录…" });
    api.enterWithWechat({ force: true }).then((result) => {
      if (result && result.bound) {
        const allowed = result.user && result.user.canIssueReceipts;
        this.setData({ message: allowed ? "微信登录成功，可以返回查价报价开具收据。" : "微信登录成功。开据权限需由管理员开通。" });
      } else if (result && result.bindTicket) {
        this.setData({ message: "该微信尚未绑定师傅账号，请填写手机号和密码完成首次绑定。绑定不会自动开通开据权限。" });
      } else if (result && result.mock) {
        this.setData({ message: "本地演示不调用微信。请用手机号和密码登录。" });
      } else {
        this.setData({ message: "请使用微信登录，或填写手机号和密码。" });
      }
      this.renderUser();
    }).catch((error) => {
      this.setData({ message: error.message || "微信登录失败，请改用手机号和密码" });
      this.renderUser();
    }).then(() => this.setData({ loggingIn: false }));
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
