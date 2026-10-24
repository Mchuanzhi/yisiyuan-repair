Page({
  data: {
    missing: true,
    no: "",
    time: "",
    city: "",
    warrantyText: "",
    warrantyExpire: "",
    total: "",
    customerName: "",
    serviceName: "",
    brandName: "",
    includes: "",
    excludes: "",
    lines: [],
    signaturePath: "",
    claimText: "",
    voided: false,
  },

  onShow() {
    const receipt = getApp().globalData.lastReceipt;
    if (!receipt) {
      this.setData({ missing: true });
      return;
    }
    this.setData(Object.assign({ missing: false }, receipt));
  },

  goQuote() {
    wx.switchTab({ url: "/pages/quote/quote" });
  },

  goHistory() {
    wx.switchTab({ url: "/pages/history/history" });
  },
});
