const model = require("../../utils/model");
const api = require("../../utils/api");
const layout = require("../../utils/layout");
const initialFrame = layout.pageFrame(375, 667);

Page({
  data: {
    pageHeight: initialFrame.pageHeight,
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
    const user = getApp().globalData.user;
    if (!user) {
      this.receipts = [];
      this.setData({
        items: [],
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
        this.setData({ emptyText: "登录已失效，请重新登录", needLogin: true, items: [], countText: "0 条" });
        return null;
      }
      return api.listReceipts();
    }).then((data) => {
      if (!data) return;
      this.receipts = data.receipts || [];
      const items = this.receipts.map((item) => model.historyItem(item));
      this.setData({
        items,
        countText: items.length + " 条",
        emptyText: items.length ? "" : "暂无本人开具的收据",
        needLogin: false,
      });
    }).catch((error) => {
      this.receipts = [];
      this.setData({
        items: [],
        countText: "0 条",
        emptyText: "加载失败：" + error.message,
        needLogin: error.status === 401,
      });
    });
  },

  openAccount() {
    wx.navigateTo({ url: "/pages/account/account" });
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
