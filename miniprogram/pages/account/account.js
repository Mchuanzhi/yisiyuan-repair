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
  },

  onShow() {
    const state = getApp().globalData;
    this.setData({ apiBase: state.apiBase, useMock: state.useMock });
    const refresh = state.token ? api.refreshMe().catch(() => null) : Promise.resolve(null);
    refresh.then(() => this.renderUser());
  },

  renderUser() {
    const user = getApp().globalData.user;
    this.setData({
      loggedIn: Boolean(user),
      profileName: user ? user.name : "欢迎使用壹思源",
      profileStatus: model.roleLabel(user),
      permission: model.permissionLabel(user),
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
    this.setData({ loggingIn: true, message: "" });
    api.staffLogin(this.data.mobile, this.data.password).then((result) => {
      const allowed = result.user && result.user.canIssueReceipts;
      this.setData({
        password: "",
        message: allowed ? "登录成功，可以返回查价报价开具收据。" : "登录成功。开据权限需由管理员开通。",
      });
      this.renderUser();
    }).catch((error) => {
      this.setData({ message: error.message });
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
      else this.setData({ message: data.ok ? "已连通 local-backend。" : "服务有响应，但状态异常。" });
    }).catch((error) => {
      this.setData({ message: "连接失败：" + error.message });
    });
  },
});
