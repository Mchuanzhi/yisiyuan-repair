const model = require("../../utils/model");
const api = require("../../utils/api");

Page({
  data: {
    serviceName: "未选择报价",
    warrantyText: "",
    totalText: "—",
    customerName: "",
    hint: "请客户在上方空白处签名确认报价",
    hintError: false,
    hasSignature: false,
    submitting: false,
  },

  onLoad() {
    const draft = getApp().globalData.quoteDraft;
    if (!draft) {
      this.setData({ hint: "请先在查价页确认报价", hintError: true });
      return;
    }
    const days = Number(draft.warrantyDays || 0);
    this.setData({
      serviceName: draft.serviceName || "维修项目",
      warrantyText: (days === 0 ? "不保修" : "保修" + days + "天") + " · 以服务端核定金额为准",
      totalText: model.money(draft.total),
    });
  },

  onReady() {
    this.initCanvas();
  },

  initCanvas(attempt) {
    const tries = attempt || 0;
    this.createSelectorQuery().select("#signatureCanvas").fields({ node: true, size: true }).exec((res) => {
      const info = res && res[0];
      if (!info || !info.node || !info.width) {
        if (tries < 8) setTimeout(() => this.initCanvas(tries + 1), 60);
        return;
      }
      const canvas = info.node;
      const ctx = canvas.getContext("2d");
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = windowInfo.pixelRatio || 1;
      canvas.width = info.width * dpr;
      canvas.height = info.height * dpr;
      ctx.scale(dpr, dpr);
      this._canvas = canvas;
      this._ctx = ctx;
      this._width = info.width;
      this._height = info.height;
      this._dpr = dpr;
      this.paintBackground();
    });
  },

  paintBackground() {
    const ctx = this._ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this._width, this._height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this._width, this._height);
    ctx.strokeStyle = "#14211f";
    ctx.fillStyle = "#14211f";
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  },

  point(touch) {
    if (typeof touch.x === "number" && typeof touch.y === "number") return { x: touch.x, y: touch.y };
    return { x: touch.clientX, y: touch.clientY };
  },

  strokeTo(from, to) {
    const ctx = this._ctx;
    if (!ctx) return;
    ctx.beginPath();
    if (from.x === to.x && from.y === to.y) {
      ctx.arc(to.x, to.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  },

  onTouchStart(event) {
    if (!this._ctx) return;
    const point = this.point(event.touches[0]);
    this._drawing = true;
    this._last = point;
    this.strokeTo(point, point);
    this.setData({ hasSignature: true, hint: "签名已记录，可生成收据", hintError: false });
  },

  onTouchMove(event) {
    if (!this._drawing || !this._ctx) return;
    const point = this.point(event.touches[0]);
    this.strokeTo(this._last, point);
    this._last = point;
  },

  onTouchEnd() {
    this._drawing = false;
  },

  onName(event) {
    this.setData({ customerName: event.detail.value });
  },

  onClear() {
    this.paintBackground();
    this.setData({ hasSignature: false, hint: "请客户在上方空白处签名确认报价", hintError: false });
  },

  exportSignature() {
    const canvas = this._canvas;
    if (!canvas) return Promise.reject(new Error("签名板还没准备好，请稍后再试"));
    if (typeof canvas.toDataURL === "function") {
      try {
        const url = canvas.toDataURL("image/png");
        if (url) return Promise.resolve(url);
      } catch (error) {
        // 部分基础库没有 toDataURL，改走临时文件。
      }
    }
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        success: (res) => {
          wx.getFileSystemManager().readFile({
            filePath: res.tempFilePath,
            encoding: "base64",
            success: (file) => resolve("data:image/png;base64," + file.data),
            fail: () => reject(new Error("读取签名失败")),
          });
        },
        fail: () => reject(new Error("导出签名失败")),
      });
    });
  },

  onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.hasSignature) {
      this.setData({ hint: "请先完成客户签名", hintError: true });
      return;
    }
    const customerName = String(this.data.customerName || "").trim();
    if (!customerName) {
      this.setData({ hint: "请填写客户姓名", hintError: true });
      return;
    }
    const draft = getApp().globalData.quoteDraft;
    if (!draft) {
      this.setData({ hint: "请返回重新确认报价", hintError: true });
      return;
    }
    this.setData({ submitting: true, hint: "正在生成收据…", hintError: false });
    this.exportSignature().then((dataUrl) => {
      return api.createReceipt(Object.assign({}, draft.input, {
        customerName,
        signatureDataUrl: dataUrl,
        expectedTotal: draft.total,
      })).then((result) => ({ result, dataUrl }));
    }).then(({ result, dataUrl }) => {
      return api.writeSignatureFile(result.receipt.signatureDataUrl || dataUrl).then((path) => {
        getApp().globalData.lastReceipt = model.presentReceipt(result.receipt, path);
        wx.redirectTo({ url: "/pages/receipt/receipt" });
      });
    }).catch((error) => {
      this.setData({ submitting: false, hint: error.message || "生成失败", hintError: true });
      if (error.status === 401 || error.status === 403) wx.switchTab({ url: "/pages/account/account" });
    });
  },
});
