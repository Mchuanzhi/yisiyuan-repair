const model = require("../../utils/model");
const history = require("../../utils/history");
const api = require("../../utils/api");
const layout = require("../../utils/layout");
const initialFrame = layout.pageFrame(375, 667);

Page({
  data: {
    pageHeight: initialFrame.pageHeight,
    query: "",
    filter: "all",
    filters: [{ id: "all", label: "全部" }, { id: "active", label: "保修中" }, { id: "expired", label: "已过保" }, { id: "none", label: "不保修" }],
    monthAmount: "¥0.00",
    monthCount: 0,
    items: [],
    countText: "0 条",
    subtitle: "",
    emptyText: "",
    needLogin: false,
  },

  onLoad() {
    this.applyLayout();
  },

  onShow() {
    this.applyLayout();
    this.load();
  },

  applyLayout() {
    try {
      const frame = layout.historyLayout();
      if (frame.pageHeight > 0) this.setData({ pageHeight: frame.pageHeight });
    } catch (error) {}
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  load() {
    return api.whenSessionReady().then(() => this.showReceipts());
  },

  showReceipts() {
    const user = getApp().globalData.user;
    if (!user) {
      this.receipts = [];
      this.setData({
        items: [],
        monthAmount: "¥0.00", monthCount: 0,
        countText: "0 条",
        subtitle: "登录后查看本人开具的收据",
        emptyText: "请先登录师傅账号",
        needLogin: true,
      });
      return Promise.resolve();
    }
    this.setData({ subtitle: user.name + " · 本人开具的收据", emptyText: "", needLogin: false });
    return api.refreshMe().catch(() => null).then(() => {
      if (!getApp().globalData.user) {
        this.receipts = [];
        this.setData({ emptyText: "登录已失效，请重新登录", needLogin: true, items: [], countText: "0 条", monthAmount: "¥0.00", monthCount: 0 });
        return null;
      }
      return Promise.all([api.listReceipts(), api.getCatalog().catch(() => ({}))]).then(([data, catalog]) => ({ receipts: history.withDevices(data.receipts || [], catalog) }));
    }).then((data) => {
      if (!data) return;
      this.receipts = data.receipts || [];
      this.renderHistory();
    }).catch((error) => {
      this.receipts = [];
      this.setData({
        items: [],
        monthAmount: "¥0.00", monthCount: 0,
        countText: "0 条",
        emptyText: "加载失败：" + error.message,
        needLogin: error.status === 401,
      });
    });
  },

  renderHistory() {
    const user = getApp().globalData.user;
    this.setData(Object.assign(history.presentHistory(this.receipts || [], {
      staffId: user && user.id, query: this.data.query, status: this.data.filter, now: new Date(),
    }), { needLogin: false }));
  },

  onSearch(event) {
    this.setData({ query: event.detail.value });
    if (!this.data.needLogin) this.renderHistory();
  },

  onFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.id });
    if (!this.data.needLogin) this.renderHistory();
  },

  openAccount() {
    wx.switchTab({ url: "/pages/account/account" });
  },

  onOpen(event) {
    const receipt = (this.receipts || []).find((item) => item.no === event.currentTarget.dataset.no);
    if (!receipt) return;
    api.writeSignatureFile(receipt.signatureDataUrl).then((path) => {
      getApp().globalData.lastReceipt = model.presentReceipt(receipt, path);
      wx.navigateTo({ url: "/pages/receipt/receipt" });
    });
  },
});
