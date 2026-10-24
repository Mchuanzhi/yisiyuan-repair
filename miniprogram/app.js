const config = require("./config");

App({
  globalData: {
    apiBase: config.apiBase,
    useMock: false,
    token: "",
    user: null,
    catalogDirty: false,
    quoteDraft: null,
    lastReceipt: null,
  },
  onLaunch() {
    const storedBase = wx.getStorageSync("apiBase");
    const storedMock = wx.getStorageSync("useMock");
    if (storedBase) this.globalData.apiBase = String(storedBase).replace(/\/$/, "");
    this.globalData.useMock = storedMock === true;
    this.globalData.token = wx.getStorageSync("staffToken") || "";
    this.globalData.user = wx.getStorageSync("staffUser") || null;
  },
});
