const model = require("../../utils/model");
const api = require("../../utils/api");
const layout = require("../../utils/layout");
const panels = require("../../utils/panels");
const initialFrame = layout.quoteFrame(375, 667);

Page({
  data: {
    pageHeight: initialFrame.pageHeight,
    scrollHeight: initialFrame.scrollHeight,
    catalogMessage: "正在加载报价",
    loadFailed: false,
    cities: [],
    cityIndex: 0,
    cityName: "上海",
    groups: [],
    categories: [],
    services: [],
    brands: [],
    extras: [],
    warrantyOptions: [],
    searchMounted: true,
    collapsed: panels.collapsedPanels(panels.initialOpenPanels()),
    categoryCount: "",
    serviceTitle: "常用项目",
    resultCount: "",
    brandCount: "",
    warrantySummary: "30天",
    quoteName: "请选择项目",
    quoteBrand: "",
    quoteCity: "",
    quoteTotal: "—",
    dockTotal: "—",
    rows: [],
    includes: "—",
    excludes: "—",
    quoteWarranty: "—",
    categoryImage: "",
    brandImage: "",
    emptyServices: "",
    quoteStatus: "",
    quoteReady: false,
    confirmText: "登录后签名开据",
  },

  onLoad() {
    this.applyLayout();
  },

  onShow() {
    this.applyLayout();
    const sync = () => {
      try {
        this.syncAccount();
      } catch (error) {
        this.setData({ confirmText: "登录后签名开据" });
      }
    };
    sync();
    api.whenSessionReady().then(sync);
    let dirty = false;
    try {
      dirty = !this.catalog || getApp().globalData.catalogDirty;
      if (getApp().globalData.catalogDirty) getApp().globalData.catalogDirty = false;
    } catch (error) {
      dirty = !this.catalog;
    }
    if (dirty) this.loadCatalog();
  },

  onPullDownRefresh() {
    try {
      if (this.data.loadFailed && getApp().globalData.useMock) getApp().globalData.useMock = false;
    } catch (error) {}
    this.loadCatalog().then(() => wx.stopPullDownRefresh(), () => wx.stopPullDownRefresh());
  },

  applyLayout() {
    try {
      const frame = layout.quoteLayout();
      if (frame.pageHeight > 0 && frame.scrollHeight > 0) this.setData(frame);
    } catch (error) {}
  },

  syncAccount() {
    const user = getApp().globalData.user;
    this.setData({
      confirmText: user && user.canIssueReceipts ? "确认报价 · 签名" : "登录后签名开据",
    });
  },

  loadCatalog() {
    if (this._loading) return this._loading;
    const task = this.fetchCatalog();
    this._loading = task;
    return task.then((value) => {
      this._loading = null;
      return value;
    }, (error) => {
      this._loading = null;
      throw error;
    });
  },

  fetchCatalog() {
    this.setData({ catalogMessage: "正在同步最新报价…" });
    return api.getCatalog().then((catalog) => {
      this.catalog = catalog;
      this.catalogReady = true;
      const mock = getApp().globalData.useMock;
      let message = catalog.services.length ? "价格与 local-backend 同步" : "暂无已上架服务，请联系管理员录入";
      if (mock) message = catalog.services.length ? "当前使用本地演示数据" : "本地演示数据为空";
      this.setData({ catalogMessage: message, loadFailed: false });
      this.renderView();
    }).catch((error) => this.failCatalog(error));
  },

  failCatalog(error) {
    const offline = !error || !error.status;
    let base = "接口";
    try {
      base = getApp().globalData.apiBase || base;
    } catch (readError) {}
    if (offline) {
      try {
        getApp().globalData.useMock = true;
      } catch (flagError) {}
      try {
        this.catalog = model.normalizeCatalog(model.publicCatalog());
      } catch (mockError) {
        this.catalog = model.normalizeCatalog({});
      }
      this.catalogReady = true;
      this.setData({
        loadFailed: true,
        catalogMessage: "连不上 " + base + "，已改用本地演示数据",
      });
      this.renderView();
      return;
    }
    this.catalog = model.normalizeCatalog({});
    this.catalogReady = false;
    this.setData({
      loadFailed: true,
      catalogMessage: "加载失败：" + (error.message || "请稍后重试") + "（" + base + "）",
      quoteReady: false,
      quoteTotal: "—",
      dockTotal: "—",
      quoteStatus: error.message || "加载失败",
    });
    this.renderView();
  },

  renderView() {
    if (!this.catalog) return;
    try {
      this.paintCatalog();
    } catch (error) {
      this.setData({
        loadFailed: true,
        catalogMessage: "页面数据异常：" + error.message,
      });
    }
  },

  paintCatalog() {
    const view = model.presentLists(this.catalog, this.selection || model.blankState());
    this.selection = view.selection;
    this.view = view;
    this.setData({
      cities: view.cities,
      cityIndex: view.cityIndex,
      cityName: view.cityName,
      groups: view.groups,
      categories: view.categories,
      services: view.services,
      brands: view.brands,
      extras: view.extras,
      warrantyOptions: view.warrantyOptions,
      categoryCount: view.categoryCount,
      serviceTitle: view.serviceTitle,
      resultCount: view.resultCount,
      brandCount: view.brandCount,
      warrantySummary: view.warrantySummary,
      quoteName: view.quoteName,
      quoteBrand: view.quoteBrand,
      quoteCity: view.quoteCity,
      includes: view.includes,
      excludes: view.excludes,
      quoteWarranty: view.quoteWarranty,
      categoryImage: view.categoryImage,
      brandImage: view.brandImage,
      emptyServices: view.emptyServices,
    });
    this.scheduleQuote();
  },

  scheduleQuote() {
    const version = (this._quoteVersion || 0) + 1;
    this._quoteVersion = version;
    clearTimeout(this._quoteTimer);
    this._quoteTimer = setTimeout(() => this.fetchQuote(version), 200);
  },

  fetchQuote(version) {
    if (!this.catalogReady) {
      if (version !== this._quoteVersion) return;
      this.setData({ quoteReady: false, quoteStatus: "正在同步报价…" });
      return;
    }
    if (!this.view || !this.view.canQuote) {
      if (version !== this._quoteVersion) return;
      this._quoteTotal = 0;
      this.setData({
        quoteReady: false,
        quoteTotal: "—",
        dockTotal: "—",
        rows: [],
        quoteStatus: "请选择有效的项目、品牌和城市",
      });
      return;
    }
    this.setData({ quoteStatus: "正在计算…", quoteReady: false });
    api.calculate(model.quoteInput(this.selection)).then((quote) => {
      if (version !== this._quoteVersion) return;
      this._quoteTotal = quote.total;
      this.setData({
        quoteTotal: model.money(quote.total),
        dockTotal: model.money(quote.total),
        rows: (quote.rows || []).map((row) => ({ label: row.label, amount: model.money(row.amount) })),
        quoteReady: true,
        quoteStatus: "",
      });
    }).catch((error) => {
      if (version !== this._quoteVersion) return;
      this._quoteTotal = 0;
      this.setData({
        quoteReady: false,
        quoteTotal: "—",
        dockTotal: "—",
        rows: [],
        quoteStatus: "报价失败：" + error.message,
      });
    });
  },

  togglePanel(event) {
    const key = event.currentTarget.dataset.key;
    const collapsed = Object.assign({}, this.data.collapsed);
    collapsed[key] = !collapsed[key];
    this.setData({ collapsed });
  },

  expandPanels(step, detail) {
    const keys = panels.panelsForStep(step, detail);
    if (!keys.length) return;
    this.setData({ collapsed: panels.collapsedPanels(keys, this.data.collapsed) });
  },

  onGroup(event) {
    const groupId = event.currentTarget.dataset.id;
    const first = (this.catalog.categories || []).find((category) => model.groupForCategory(category).id === groupId && this.catalog.services.some((service) => service.categoryId === category.id));
    if (!first) return;
    const service = this.catalog.services.find((item) => item.categoryId === first.id);
    this.selection = Object.assign({}, this.selection, {
      categoryGroup: groupId,
      categoryId: first.id,
      query: "",
      serviceIds: service ? [service.id] : [],
      brandId: "",
      warrantyDays: service ? Number(service.warrantyDays || 0) : 30,
    });
    this.expandPanels("category");
    this.remountSearch();
    this.renderView();
  },

  onCategory(event) {
    const categoryId = event.currentTarget.dataset.id;
    const service = this.catalog.services.find((item) => item.categoryId === categoryId);
    this.selection = Object.assign({}, this.selection, {
      categoryId,
      query: "",
      serviceIds: service ? [service.id] : [],
      brandId: "",
      warrantyDays: service ? Number(service.warrantyDays || 0) : 30,
    });
    this.expandPanels("category");
    this.remountSearch();
    this.renderView();
  },

  remountSearch() {
    this.setData({ searchMounted: false }, () => this.setData({ searchMounted: true }));
  },

  onService(event) {
    const service = this.catalog.services.find((item) => item.id === event.currentTarget.dataset.id);
    if (!service) return;
    const selected = model.selectedServices(this.catalog, this.selection);
    const mixed = selected.some((item) => item.categoryId !== service.categoryId);
    let ids = mixed ? [] : this.selection.serviceIds.slice();
    if (ids.indexOf(service.id) >= 0) ids = ids.filter((id) => id !== service.id);
    else ids.push(service.id);
    this.selection = Object.assign({}, this.selection, {
      categoryId: service.categoryId,
      serviceIds: ids,
      warrantyDays: model.warrantyFromServices(this.catalog, ids.length ? ids : [service.id]),
    });
    const brands = model.availableBrands(this.catalog, service.categoryId);
    if (!brands.some((brand) => brand.id === this.selection.brandId)) this.selection.brandId = brands[0] ? brands[0].id : "";
    this.expandPanels("service", { hasService: this.selection.serviceIds.length > 0 });
    this.renderView();
  },

  onBrand(event) {
    this.selection = Object.assign({}, this.selection, { brandId: event.currentTarget.dataset.id });
    this.expandPanels("brand");
    this.renderView();
  },

  onExtra(event) {
    const id = event.currentTarget.dataset.id;
    const enabled = Boolean(event.detail.value);
    const ids = this.selection.extraIds.slice();
    const index = ids.indexOf(id);
    if (enabled && index >= 0) return;
    if (!enabled && index < 0) return;
    if (enabled) ids.push(id);
    else ids.splice(index, 1);
    this.selection = Object.assign({}, this.selection, { extraIds: ids });
    this.expandPanels("extra");
    this.renderView();
  },

  onWarranty(event) {
    this.selection = Object.assign({}, this.selection, { warrantyDays: Number(event.currentTarget.dataset.days) });
    this.expandPanels("warranty");
    this.renderView();
  },

  onSearch(event) {
    const query = event.detail.value;
    const draft = Object.assign({}, this.selection, { query });
    const visible = model.filteredServices(this.catalog, draft);
    if (visible[0]) {
      draft.serviceIds = [visible[0].id];
      draft.categoryId = visible[0].categoryId;
      draft.warrantyDays = Number(visible[0].warrantyDays || 0);
    } else if (String(query || "").trim()) {
      draft.serviceIds = [];
    }
    this.selection = draft;
    this.expandPanels("search", { hasService: draft.serviceIds.length > 0 });
    this.renderView();
  },

  onCityChange(event) {
    const city = this.data.cities[Number(event.detail.value)];
    if (!city) return;
    this.selection = Object.assign({}, this.selection, { cityId: city.id });
    this.renderView();
  },

  onRefresh() {
    this.loadCatalog();
  },

  openDemo() {
    wx.switchTab({ url: "/pages/account/account" });
  },

  onConfirm() {
    if (!this.data.quoteReady || this._confirming) return;
    const user = getApp().globalData.user;
    if (!user || !user.canIssueReceipts) {
      wx.switchTab({ url: "/pages/account/account" });
      return;
    }
    const input = model.quoteInput(this.selection);
    this._confirming = true;
    api.calculate(input).then((quote) => {
      this._quoteTotal = quote.total;
      this.setData({
        quoteTotal: model.money(quote.total),
        dockTotal: model.money(quote.total),
        rows: (quote.rows || []).map((row) => ({ label: row.label, amount: model.money(row.amount) })),
      });
      const names = model.selectedServices(this.catalog, this.selection).map((item) => item.name).join("、");
      getApp().globalData.quoteDraft = {
        input,
        total: quote.total,
        serviceName: names,
        warrantyDays: this.selection.warrantyDays,
      };
      wx.navigateTo({ url: "/pages/signature/signature" });
    }).catch((error) => {
      this.setData({ quoteReady: false, quoteStatus: "报价失败：" + error.message });
    }).then(() => {
      this._confirming = false;
    });
  },
});
