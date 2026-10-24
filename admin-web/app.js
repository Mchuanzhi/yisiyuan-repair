let categories = [], brands = [], services = [], cities = [], regions = [], rules = [], receipts = [];
const state = {
  activeSection: "dashboard",
  selectedServiceId: "",
  assetCategoryId: "",
  assetCategoryGroup: "appliance",
  cityRegionId: "",
  currentUser: null,
  manage: {
    prices: false,
    categories: false,
    brands: false,
    cities: false,
    regions: false,
    rules: false,
  },
  selected: {
    services: new Set(),
    categories: new Set(),
    brands: new Set(),
    cities: new Set(),
    regions: new Set(),
    rules: new Set(),
  },
  assetDraft: {
    type: "",
    id: "",
    categoryImage: "",
    brandLogo: "",
  },
};

const titles = {
  dashboard: ["数据总览", "维护报价、品牌图片、城市规则和电子收据。"],
  prices: ["报价项目", "录入服务项目、人工费、配件估价、包含内容和质保。"],
  assets: ["品类品牌", "维护小程序端展示的品类图片和品牌 Logo。"],
  cities: ["城市区域", "设置后台调价规则，小程序端只展示城市名称。"],
  rules: ["特殊费用", "维护高空费、远程费、夜间加急等现场加收规则。"],
  receipts: ["收据记录", "查询客户签名确认后的电子收据和二维码领取状态。"],
  wechat: ["公众号领取", "配置客户关注公众号后领取电子收据和保修凭证。"],
  permissions: ["权限设置", "控制内部人员生成收据权限，客户关注公众号并授权登录后领取。"],
  preview: ["小程序预览", "在后台直接观察小程序端页面，方便核对展示效果。"],
};

const STAFF_TOKEN_KEY = "ysy_staff_token";
const STAFF_USER_KEY = "ysy_staff_user";
const ASSET_STORAGE_KEY = "ysy_admin_asset_data";
const roleLabels = {
  admin: "管理员",
  technician: "维修师傅",
  support: "客服人员",
};

const els = {
  pageTitle: document.querySelector("#pageTitle"),
  pageSubtitle: document.querySelector("#pageSubtitle"),
  operatorName: document.querySelector("#operatorName"),
  operatorAvatar: document.querySelector("#operatorAvatar"),
  logoutBtn: document.querySelector("#logoutBtn"),
  globalSearch: document.querySelector("#globalSearch"),
  categoryFilter: document.querySelector("#categoryFilter"),
  priceCategoryTabs: document.querySelector("#priceCategoryTabs"),
  activeCategoryCount: document.querySelector("#activeCategoryCount"),
  statusFilter: document.querySelector("#statusFilter"),
  priceSearch: document.querySelector("#priceSearch"),
  serviceTable: document.querySelector("#serviceTable"),
  serviceForm: document.querySelector("#serviceForm"),
  editCategory: document.querySelector("#editCategory"),
  editName: document.querySelector("#editName"),
  editDesc: document.querySelector("#editDesc"),
  editLow: document.querySelector("#editLow"),
  editHigh: document.querySelector("#editHigh"),
  editPart: document.querySelector("#editPart"),
  editWarranty: document.querySelector("#editWarranty"),
  editIncludes: document.querySelector("#editIncludes"),
  editExcludes: document.querySelector("#editExcludes"),
  editorStatus: document.querySelector("#editorStatus"),
  toggleStatusBtn: document.querySelector("#toggleStatusBtn"),
  addServiceBtn: document.querySelector("#addServiceBtn"),
  managePricesBtn: document.querySelector("#managePricesBtn"),
  priceBatchBar: document.querySelector("#priceBatchBar"),
  priceSelectedCount: document.querySelector("#priceSelectedCount"),
  batchDeleteServicesBtn: document.querySelector("#batchDeleteServicesBtn"),
  manageCategoriesBtn: document.querySelector("#manageCategoriesBtn"),
  uploadCategoryBtn: document.querySelector("#uploadCategoryBtn"),
  categoryBatchBar: document.querySelector("#categoryBatchBar"),
  categorySelectedCount: document.querySelector("#categorySelectedCount"),
  batchDeleteCategoriesBtn: document.querySelector("#batchDeleteCategoriesBtn"),
  manageBrandsBtn: document.querySelector("#manageBrandsBtn"),
  addBrandBtn: document.querySelector("#addBrandBtn"),
  brandBatchBar: document.querySelector("#brandBatchBar"),
  brandSelectedCount: document.querySelector("#brandSelectedCount"),
  batchDeleteBrandsBtn: document.querySelector("#batchDeleteBrandsBtn"),
  manageCitiesBtn: document.querySelector("#manageCitiesBtn"),
  addCityBtn: document.querySelector("#addCityBtn"),
  cityForm: document.querySelector("#cityForm"),
  cityEditId: document.querySelector("#cityEditId"),
  cityNameInput: document.querySelector("#cityNameInput"),
  cityRateInput: document.querySelector("#cityRateInput"),
  cityRadiusInput: document.querySelector("#cityRadiusInput"),
  saveCityBtn: document.querySelector("#saveCityBtn"),
  resetCityBtn: document.querySelector("#resetCityBtn"),
  cityBatchBar: document.querySelector("#cityBatchBar"),
  citySelectedCount: document.querySelector("#citySelectedCount"),
  batchDeleteCitiesBtn: document.querySelector("#batchDeleteCitiesBtn"),
  manageRegionsBtn: document.querySelector("#manageRegionsBtn"),
  addRegionBtn: document.querySelector("#addRegionBtn"),
  regionForm: document.querySelector("#regionForm"),
  regionEditId: document.querySelector("#regionEditId"),
  regionCityInput: document.querySelector("#regionCityInput"),
  regionNameInput: document.querySelector("#regionNameInput"),
  regionRateInput: document.querySelector("#regionRateInput"),
  regionRadiusInput: document.querySelector("#regionRadiusInput"),
  saveRegionBtn: document.querySelector("#saveRegionBtn"),
  resetRegionBtn: document.querySelector("#resetRegionBtn"),
  regionBatchBar: document.querySelector("#regionBatchBar"),
  regionSelectedCount: document.querySelector("#regionSelectedCount"),
  batchDeleteRegionsBtn: document.querySelector("#batchDeleteRegionsBtn"),
  manageRulesBtn: document.querySelector("#manageRulesBtn"),
  addRuleBtn: document.querySelector("#addRuleBtn"),
  ruleForm: document.querySelector("#ruleForm"),
  ruleEditId: document.querySelector("#ruleEditId"),
  ruleNameInput: document.querySelector("#ruleNameInput"),
  rulePriceInput: document.querySelector("#rulePriceInput"),
  ruleSceneInput: document.querySelector("#ruleSceneInput"),
  saveRuleBtn: document.querySelector("#saveRuleBtn"),
  resetRuleBtn: document.querySelector("#resetRuleBtn"),
  ruleBatchBar: document.querySelector("#ruleBatchBar"),
  ruleSelectedCount: document.querySelector("#ruleSelectedCount"),
  batchDeleteRulesBtn: document.querySelector("#batchDeleteRulesBtn"),
  metricServices: document.querySelector("#metricServices"),
  metricBrands: document.querySelector("#metricBrands"),
  metricCities: document.querySelector("#metricCities"),
  categoryAssets: document.querySelector("#categoryAssets"),
  assetCategoryGroups: document.querySelector("#assetCategoryGroups"),
  brandAssets: document.querySelector("#brandAssets"),
  cityList: document.querySelector("#cityList"),
  regionTable: document.querySelector("#regionTable"),
  ruleList: document.querySelector("#ruleList"),
  receiptTable: document.querySelector("#receiptTable"),
  exportReceiptsBtn: document.querySelector("#exportReceiptsBtn"),
  receiptModal: document.querySelector("#receiptModal"),
  modalReceiptNo: document.querySelector("#modalReceiptNo"),
  modalCustomer: document.querySelector("#modalCustomer"),
  modalRepairTime: document.querySelector("#modalRepairTime"),
  modalService: document.querySelector("#modalService"),
  modalCity: document.querySelector("#modalCity"),
  modalWarranty: document.querySelector("#modalWarranty"),
  modalWarrantyLeft: document.querySelector("#modalWarrantyLeft"),
  modalReceiptLines: document.querySelector("#modalReceiptLines"),
  modalAmount: document.querySelector("#modalAmount"),
  modalSignature: document.querySelector("#modalSignature"),
  modalQr: document.querySelector("#modalQr"),
  modalClaimText: document.querySelector("#modalClaimText"),
  claimBoard: document.querySelector("#claimBoard"),
  permissionList: document.querySelector("#permissionList"),
  miniappPreview: document.querySelector("#miniappPreview"),
  refreshPreviewBtn: document.querySelector("#refreshPreviewBtn"),
  assetModal: document.querySelector("#assetModal"),
  assetModalEyebrow: document.querySelector("#assetModalEyebrow"),
  assetModalTitle: document.querySelector("#assetModalTitle"),
  categoryAssetForm: document.querySelector("#categoryAssetForm"),
  categoryNameInput: document.querySelector("#categoryNameInput"),
  categoryToneInput: document.querySelector("#categoryToneInput"),
  categoryAccentInput: document.querySelector("#categoryAccentInput"),
  categoryImageInput: document.querySelector("#categoryImageInput"),
  categoryImagePreview: document.querySelector("#categoryImagePreview"),
  brandAssetForm: document.querySelector("#brandAssetForm"),
  brandNameInput: document.querySelector("#brandNameInput"),
  brandLatinInput: document.querySelector("#brandLatinInput"),
  brandColorInput: document.querySelector("#brandColorInput"),
  brandLogoInput: document.querySelector("#brandLogoInput"),
  brandLogoPreview: document.querySelector("#brandLogoPreview"),
  brandCategoryChoices: document.querySelector("#brandCategoryChoices"),
  brandSpecialInput: document.querySelector("#brandSpecialInput"),
};

const assetCategoryGroupDefinitions = [
  { id: "appliance", name: "家电维修", names: ["空调", "洗衣机", "冰箱", "电热水器", "燃气热水器", "油烟机", "燃气灶", "电视"] },
  { id: "home", name: "房屋维修", names: ["电路维修", "水路维修", "管道疏通", "厨卫小件", "防水补漏"] },
  { id: "cleaning", name: "家电清洗", names: ["空调清洗", "洗衣机清洗", "油烟机清洗", "燃气灶清洗", "热水器清洗", "冰箱清洗"] },
  { id: "general", name: "综合服务", names: ["基础服务", "安装服务", "合作套餐"] },
];

function assetGroupForCategory(category) {
  const exact = assetCategoryGroupDefinitions.find(group => group.names.includes(category.name));
  if (exact) return exact;
  if (/防水|管道|水路|电路|厨卫|房屋/.test(category.name)) return assetCategoryGroupDefinitions[1];
  if (/清洗|保养/.test(category.name)) return assetCategoryGroupDefinitions[2];
  if (/基础|安装|套餐/.test(category.name)) return assetCategoryGroupDefinitions[3];
  return assetCategoryGroupDefinitions[0];
}

function authHeaders() {
  const headers = {};
  const token = localStorage.getItem(STAFF_TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function adminJson(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "操作失败，请稍后重试");
  }
  return payload;
}

function staffAvatar(user) {
  return (user?.name || "YSY").trim().slice(0, 1).toUpperCase() || "YSY";
}

function setOperator(user) {
  state.currentUser = user;
  els.operatorName.textContent = `${user.name} · ${roleLabels[user.role] || "内部人员"}`;
  els.operatorAvatar.textContent = staffAvatar(user);
}

function redirectToLogin() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem(STAFF_USER_KEY);
  window.location.href = "/login?next=/admin/";
}

async function loadCurrentUser() {
  try {
    const cached = JSON.parse(localStorage.getItem(STAFF_USER_KEY) || "null");
    if (cached) setOperator(cached);
  } catch (error) {
    localStorage.removeItem(STAFF_USER_KEY);
  }

  const response = await fetch("/api/auth/me", { headers: authHeaders() });
  if (!response.ok) {
    redirectToLogin();
    return;
  }
  const payload = await response.json();
  localStorage.setItem(STAFF_USER_KEY, JSON.stringify(payload.user));
  setOperator(payload.user);
}

async function logoutStaff() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
    });
  } finally {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_USER_KEY);
    window.location.href = "/login";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeApiCategory(category) {
  return {
    id: category.id,
    name: category.name,
    count: Number(category.count || 0),
    tone: category.tone || "#14766f",
    accent: category.accent || "#f59f2f",
    image: category.image || "",
    enabled: category.enabled !== false,
  };
}

function normalizeApiBrand(brand) {
  return {
    id: brand.id,
    name: brand.name,
    latin: brand.latin || brand.name,
    color: brand.color || "#14766f",
    factor: Number(brand.factor || 1),
    categoryIds: brand.categoryIds || [],
    categories: brand.categories || [],
    special: Boolean(brand.special),
    logo: brand.logo || "",
  };
}

function normalizeApiCity(city) {
  return {
    id: city.id,
    name: city.name,
    rate: city.rate || "标准",
    radius: city.radius || "10公里",
    multiplier: Number(city.multiplier || 1),
    enabled: city.enabled !== false,
  };
}

function normalizeApiRegion(region) {
  return {
    id: region.id,
    cityId: region.cityId || "",
    city: region.city,
    region: region.region,
    rate: region.rate || "标准",
    radius: region.radius || "10公里",
    multiplier: Number(region.multiplier || 1),
    enabled: region.enabled !== false,
  };
}

function normalizeApiRule(rule) {
  return {
    id: rule.id,
    name: rule.name,
    price: rule.price || `${Number(rule.amount || 0)}元`,
    scene: rule.scene || "",
    amount: Number(rule.amount || 0),
    enabled: rule.enabled !== false,
  };
}

function normalizeApiReceipt(receipt) {
  return {
    no: receipt.no,
    time: receipt.repairTime || receipt.createdAt || "",
    customer: receipt.customerName || "-",
    service: receipt.serviceName || "-",
    amount: `¥${Number(receipt.amount || 0)}`,
    city: receipt.cityName || "-",
    warrantyDays: Number(receipt.warrantyDays || 0),
    signatureDataUrl: receipt.signatureDataUrl || "",
    status: receipt.voided ? "已作废" : "已签名",
    followStatus: receipt.followStatus || "待关注",
    claimStatus: receipt.claimStatus || "待关注登录",
    lines: (receipt.lines || []).map((line) => [line.label || line[0], `¥${line.amount ?? line[1] ?? 0}`]),
  };
}

async function loadAdminAssets() {
  try {
    const payload = await adminJson("/api/admin/assets");
    categories = (payload.categories || []).map(normalizeApiCategory);
    brands = (payload.brands || []).map(normalizeApiBrand);
    fillSelects();
    renderAll();
  } catch (error) {
    document.querySelector("#dataMessage").textContent = `数据加载失败：${error.message}，请刷新重试`;
  }
}

async function loadAdminOperations() {
  try {
    const payload = await adminJson("/api/admin/operations");
    cities = (payload.cities || []).map(normalizeApiCity);
    regions = (payload.regions || []).map(normalizeApiRegion);
    rules = (payload.rules || []).map(normalizeApiRule);
    renderAll();
  } catch (error) {
    document.querySelector("#dataMessage").textContent = `数据加载失败：${error.message}，请刷新重试`;
  }
}

async function loadAdminReceipts() {
  try {
    const payload = await adminJson("/api/admin/receipts");
    const nextReceipts = (payload.receipts || []).map(normalizeApiReceipt);
    receipts = nextReceipts;
    renderAll();
  } catch (error) {
    document.querySelector("#dataMessage").textContent = `数据加载失败：${error.message}，请刷新重试`;
  }
}

function readImageFile(input) {
  const file = input.files?.[0];
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function categoryImage(category) {
  return category.image || categorySvg(category);
}

function brandLogo(brand) {
  return brand.logo || brandSvg(brand);
}

function svgUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function categorySvg(category) {
  const tone = category.tone || "#14766f";
  const accent = category.accent || "#f59f2f";
  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 92">
      <rect width="128" height="92" rx="12" fill="#fff"/>
      <circle cx="104" cy="18" r="14" fill="${accent}" opacity=".25"/>
      <rect x="28" y="24" width="72" height="30" rx="8" fill="${tone}"/>
      <rect x="38" y="34" width="38" height="6" rx="3" fill="#fff" opacity=".9"/>
      <path d="M35 66c8 7 15 7 23 0M70 66c8 7 15 7 23 0" stroke="${tone}" stroke-width="5" stroke-linecap="round" fill="none"/>
    </svg>
  `);
}

function brandSvg(brand) {
  const color = brand.color || "#14766f";
  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 72">
      <rect x="2" y="2" width="156" height="68" rx="10" fill="#fff" stroke="${color}" stroke-width="4"/>
      <text x="18" y="40" fill="${color}" font-size="22" font-weight="800" font-family="Arial, sans-serif">${escapeXml(brand.latin)}</text>
      <text x="18" y="58" fill="#53615f" font-size="13" font-weight="700" font-family="'Microsoft YaHei', sans-serif">${escapeXml(brand.name)}</text>
    </svg>
  `);
}

function receiptQrSvg(receiptNo) {
  const modules = 21;
  const cell = 5;
  const size = modules * cell;
  const chars = receiptNo.split("").map((char) => char.charCodeAt(0));

  function finder(x, y) {
    const p = x * cell;
    const q = y * cell;
    return `
      <rect x="${p}" y="${q}" width="${7 * cell}" height="${7 * cell}" fill="#14211f"/>
      <rect x="${p + cell}" y="${q + cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/>
      <rect x="${p + cell * 2}" y="${q + cell * 2}" width="${3 * cell}" height="${3 * cell}" fill="#14211f"/>
    `;
  }

  function inFinder(x, y, fx, fy) {
    return x >= fx && x < fx + 7 && y >= fy && y < fy + 7;
  }

  const dots = [];
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      const reserved = inFinder(x, y, 0, 0) || inFinder(x, y, 14, 0) || inFinder(x, y, 0, 14);
      if (reserved) continue;
      const seed = chars[(x + y) % chars.length] ?? 37;
      if ((x * 7 + y * 5 + seed) % 4 === 0) {
        dots.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#14211f"/>`);
      }
    }
  }

  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#fff"/>
      ${finder(0, 0)}
      ${finder(14, 0)}
      ${finder(0, 14)}
      ${dots.join("")}
    </svg>
  `);
}

function parseWarrantyDays(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 30;
}

function warrantyInfo(receipt) {
  const start = new Date(receipt.time.replace(" ", "T"));
  const days = receipt.warrantyDays ?? parseWarrantyDays(receipt.warranty);
  const expires = new Date(start);
  expires.setDate(expires.getDate() + days);
  const today = new Date();
  const msLeft = expires.getTime() - today.getTime();
  const daysLeft = Math.ceil(msLeft / 86400000);
  const dateText = `${expires.getFullYear()}-${String(expires.getMonth() + 1).padStart(2, "0")}-${String(expires.getDate()).padStart(2, "0")}`;

  if (daysLeft < 0) {
    return { dateText, leftText: `已过期 ${Math.abs(daysLeft)} 天`, tone: "warranty-expired" };
  }
  if (daysLeft <= 7) {
    return { dateText, leftText: `剩余 ${daysLeft} 天`, tone: "warranty-warning" };
  }
  return { dateText, leftText: `剩余 ${daysLeft} 天`, tone: "warranty-good" };
}

function categoryName(id) {
  return categories.find((item) => item.id === id)?.name ?? "未分类";
}

function moneyRange(service) {
  return service.priceText || `¥${service.low}-${service.high}`;
}

function selectedService() {
  return services.find((service) => service.id === state.selectedServiceId) ?? services[0];
}

function fillSelects() {
  const previousCategory = els.categoryFilter.value;
  const categoryOptions = categories.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  els.categoryFilter.innerHTML = categoryOptions;
  els.editCategory.innerHTML = categories.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
  els.categoryFilter.value = categories.some(item => item.id === previousCategory)
    ? previousCategory
    : categories.find(item => services.some(service => service.categoryId === item.id))?.id || categories[0]?.id || "";
}

function filteredServices() {
  const category = els.categoryFilter.value || categories[0]?.id || "";
  const status = els.statusFilter.value || "all";
  const localKeyword = els.priceSearch.value.trim().toLowerCase();
  const globalKeyword = els.globalSearch.value.trim().toLowerCase();
  return services.filter((service) => {
    const serviceCategoryName = categoryName(service.categoryId);
    const categoryTerms = serviceCategoryName.endsWith("维修")
      ? serviceCategoryName
      : `${serviceCategoryName} ${serviceCategoryName}维修`;
    const inCategory = Boolean(globalKeyword) || service.categoryId === category;
    const inStatus = status === "all" || service.status === status;
    const text = `${categoryTerms} ${service.name} ${service.desc} ${service.includes || ""} ${service.excludes || ""}`.toLowerCase();
    const matchesLocal = !localKeyword || text.includes(localKeyword);
    const matchesGlobal = !globalKeyword || text.includes(globalKeyword);
    return inCategory && inStatus && matchesLocal && matchesGlobal;
  });
}

function renderPriceCategoryTabs() {
  if (!els.priceCategoryTabs) return;
  const activeId = els.categoryFilter.value || categories[0]?.id || "";
  els.priceCategoryTabs.innerHTML = categories.map(category => {
    const count = services.filter(service => service.categoryId === category.id).length;
    const active = category.id === activeId ? " is-active" : "";
    return `
      <button class="price-category-card${active}" type="button" data-price-category="${escapeHtml(category.id)}" aria-pressed="${category.id === activeId}">
        <span class="price-category-icon"><img src="${categoryImage(category)}" alt="" /></span>
        <span class="price-category-copy"><strong>${escapeHtml(category.name)}</strong><small>${count} 个项目</small></span>
      </button>`;
  }).join("");
  const activeCategory = categories.find(category => category.id === activeId);
  const globalKeyword = els.globalSearch.value.trim();
  els.activeCategoryCount.textContent = globalKeyword
    ? `搜索结果 · ${filteredServices().length} 项`
    : activeCategory ? `${activeCategory.name} · ${filteredServices().length} 项` : "";
  els.priceCategoryTabs.querySelectorAll("[data-price-category]").forEach(button => {
    button.addEventListener("click", () => {
      els.categoryFilter.value = button.dataset.priceCategory;
      state.selectedServiceId = services.find(service => service.categoryId === button.dataset.priceCategory)?.id || "";
      renderServiceTable();
      renderEditor();
    });
  });
}

function setSelected(group, id, checked) {
  if (checked) {
    state.selected[group].add(id);
  } else {
    state.selected[group].delete(id);
  }
  updateBatchBars();
}

function toggleManage(scope) {
  state.manage[scope] = !state.manage[scope];
  const selectedGroup = {
    prices: "services",
    categories: "categories",
    brands: "brands",
    cities: "cities",
    regions: "regions",
    rules: "rules",
  }[scope];
  state.selected[selectedGroup].clear();
  renderAll();
}

function updateManageButtons() {
  els.managePricesBtn.textContent = state.manage.prices ? "完成" : "管理";
  els.manageCategoriesBtn.textContent = state.manage.categories ? "完成" : "管理";
  els.manageBrandsBtn.textContent = state.manage.brands ? "完成" : "管理";
  els.manageCitiesBtn.textContent = state.manage.cities ? "完成" : "管理";
  els.manageRegionsBtn.textContent = state.manage.regions ? "完成" : "管理";
  els.manageRulesBtn.textContent = state.manage.rules ? "完成" : "管理";
}

function updateBatchBars() {
  const configs = [
    [els.priceBatchBar, els.priceSelectedCount, state.manage.prices, state.selected.services, "项报价"],
    [els.categoryBatchBar, els.categorySelectedCount, state.manage.categories, state.selected.categories, "个品类"],
    [els.brandBatchBar, els.brandSelectedCount, state.manage.brands, state.selected.brands, "个品牌"],
    [els.cityBatchBar, els.citySelectedCount, state.manage.cities, state.selected.cities, "个城市"],
    [els.regionBatchBar, els.regionSelectedCount, state.manage.regions, state.selected.regions, "个区域"],
    [els.ruleBatchBar, els.ruleSelectedCount, state.manage.rules, state.selected.rules, "条规则"],
  ];
  configs.forEach(([bar, count, enabled, selected, label]) => {
    bar.hidden = !enabled;
    count.textContent = `已选择 ${selected.size} ${label}`;
  });
}

function renderMetrics() {
  els.metricServices.textContent = services.length;
  els.metricBrands.textContent = brands.length;
  els.metricCities.textContent = cities.length;
  document.querySelector("#metricPublished").textContent = `已上架 ${services.filter(item => item.status === "on").length} 项`;
  document.querySelector("#metricReceiptCount").textContent = receipts.filter(item => item.time.slice(0,10) === new Date().toLocaleDateString("en-CA")).length;
  document.querySelector("#catalogHealth").innerHTML = `<div><strong>未配置服务的品类</strong><span>${categories.filter(category => !services.some(service => service.categoryId === category.id)).length} 类</span></div><div><strong>未上架项目</strong><span>${services.filter(item => item.status !== "on").length} 项</span></div>`;
  document.querySelector("#recentReceipts").innerHTML = receipts.length ? receipts.slice(0,3).map(item => `<div><span>${escapeHtml(item.time)}</span><strong>${escapeHtml(item.customer)} · ${escapeHtml(item.service)} · ${escapeHtml(item.amount)}</strong></div>`).join("") : "暂无收据";
}

function renderServiceTable() {
  renderPriceCategoryTabs();
  const rows = filteredServices();
  els.serviceTable.innerHTML = rows
    .map((service) => {
      const selected = service.id === state.selectedServiceId ? " is-selected" : "";
      const statusClass = service.status === "on" ? "" : " draft";
      const statusText = service.status === "on" ? "已上架" : "草稿";
      const checked = state.selected.services.has(service.id) ? "checked" : "";
      const action = state.manage.prices
        ? `
          <div class="action-group">
            <label class="select-check">
              <input type="checkbox" data-select-service="${service.id}" ${checked} />
              选择
            </label>
            <button class="danger-small" type="button" data-delete-service="${service.id}">删除</button>
          </div>
        `
        : '<span class="muted-action">点击行编辑</span>';
      return `
        <tr class="${selected}" data-service-id="${service.id}">
          <td>${categoryName(service.categoryId)}</td>
          <td><strong>${service.name}</strong><br><span>${service.desc}</span></td>
          <td class="money-cell">${moneyRange(service)}</td>
          <td>${service.part ? `¥${service.part}` : "无"}</td>
          <td>${service.warranty}</td>
          <td><span class="status-pill${statusClass}">${statusText}</span></td>
          <td>${action}</td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll("[data-service-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedServiceId = row.dataset.serviceId;
      renderServiceTable();
      renderEditor();
    });
  });

  document.querySelectorAll("[data-delete-service]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteService(button.dataset.deleteService);
    });
  });
  document.querySelectorAll("[data-select-service]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => setSelected("services", input.dataset.selectService, input.checked));
  });
}

async function loadAdminServices() {
  const payload = await adminJson("/api/admin/services");
  services = payload.services.map(item => ({ ...item, warranty: item.warrantyDays > 0 ? `${item.warrantyDays}天` : "不涉及", status: item.enabled ? "on" : "draft" }));
  fillSelects();
  const activeCategoryId = els.categoryFilter.value;
  if (!services.some(item => item.id === state.selectedServiceId && item.categoryId === activeCategoryId)) {
    state.selectedServiceId = services.find(item => item.categoryId === activeCategoryId)?.id || "";
  }
  renderAll();
}
let serviceSaving = false;
async function mutateServices(action) {
  if (serviceSaving) return;
  serviceSaving = true;
  try { await action(); await loadAdminServices(); document.querySelector("#dataMessage").textContent = "已保存到数据库，报价端刷新后生效"; }
  catch (error) { document.querySelector("#dataMessage").textContent = `操作失败：${error.message}`; await loadAdminServices().catch(() => {}); }
  finally { serviceSaving = false; }
}
function deleteService(id) {
  return mutateServices(() => adminJson(`/api/admin/services/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
function batchDeleteServices() {
  const ids = [...state.selected.services];
  return mutateServices(async () => { for (const id of ids) await adminJson(`/api/admin/services/${encodeURIComponent(id)}`, { method: "DELETE" }); state.selected.services.clear(); });
}

function renderEditor() {
  const service = selectedService();
  if (!service) {
    els.serviceForm.querySelectorAll("input, select, textarea, button").forEach((field) => {
      field.disabled = true;
    });
    els.editorStatus.textContent = "无项目";
    return;
  }
  els.serviceForm.querySelectorAll("input, select, textarea, button").forEach((field) => {
    field.disabled = false;
  });
  els.editCategory.value = service.categoryId;
  els.editName.value = service.name;
  els.editDesc.value = service.desc;
  els.editLow.value = service.low;
  els.editHigh.value = service.high;
  els.editPart.value = service.part;
  els.editWarranty.value = service.warranty;
  els.editIncludes.value = service.includes;
  els.editExcludes.value = service.excludes;
  els.editorStatus.textContent = service.status === "on" ? "已上架" : "草稿";
  els.editorStatus.classList.toggle("draft", service.status !== "on");
  els.toggleStatusBtn.textContent = service.status === "on" ? "下架" : "上架";
}

function saveEditor() {
  const service = selectedService();
  if (!service) return;
  const body = { categoryId: els.editCategory.value, name: els.editName.value.trim(), desc: els.editDesc.value.trim(), low: Number(els.editLow.value), high: Number(els.editHigh.value), part: Number(els.editPart.value), warrantyDays: parseWarrantyDays(els.editWarranty.value), includes: els.editIncludes.value.trim(), excludes: els.editExcludes.value.trim() };
  return mutateServices(() => adminJson(`/api/admin/services/${encodeURIComponent(service.id)}`, { method: "PATCH", body: JSON.stringify(body) }));
}
function addService() {
  if (!categories.length) { document.querySelector("#dataMessage").textContent = "请先新增品类"; return; }
  return mutateServices(async () => {
    const payload = await adminJson("/api/admin/services", { method: "POST", body: JSON.stringify({ categoryId: categories[0].id, name: "新服务项目", low: 0, high: 0, part: 0, warrantyDays: 30, enabled: false }) });
    state.selectedServiceId = payload.service.id;
  });
}

function renderAssets() {
  const groupedCategories = categories.filter(category => assetGroupForCategory(category).id === state.assetCategoryGroup);
  els.assetCategoryGroups.innerHTML = assetCategoryGroupDefinitions.map(group => {
    const count = categories.filter(category => assetGroupForCategory(category).id === group.id).length;
    return `<button class="asset-category-group${group.id === state.assetCategoryGroup ? " is-active" : ""}" type="button" data-asset-group="${group.id}" aria-pressed="${group.id === state.assetCategoryGroup}"><strong>${group.name}</strong><span>${count} 个二级品类</span></button>`;
  }).join("");
  els.categoryAssets.innerHTML = groupedCategories
    .map((category) => {
      const serviceCount = services.filter((service) => service.categoryId === category.id).length;
      const checked = state.selected.categories.has(category.id) ? "checked" : "";
      const action = state.manage.categories
        ? `
          <div class="action-group">
            <label class="select-check">
              <input type="checkbox" data-select-category="${category.id}" ${checked} />
              选择
            </label>
            <button class="danger-small" type="button" data-delete-category="${category.id}">删除</button>
          </div>
        `
        : `<button class="secondary-small" type="button" data-edit-category="${category.id}">编辑/换图</button>`;
      return `
        <article class="category-asset ${state.assetCategoryId === category.id ? "is-active" : ""}" data-filter-category="${escapeHtml(category.id)}" tabindex="0" role="button" aria-pressed="${state.assetCategoryId === category.id}">
          <div class="thumb"><img src="${categoryImage(category)}" alt="${escapeHtml(category.name)}" /></div>
          <div>
            <strong>${escapeHtml(category.name)}</strong>
            <span>${serviceCount} 个报价项目 · 小程序已展示</span>
          </div>
          ${action}
        </article>
      `;
    })
    .join("");

  const activeCategory = categories.find((category) => category.id === state.assetCategoryId);
  const visibleBrands = activeCategory ? brands.filter((brand) => brand.categoryIds.includes(activeCategory.id)) : [];
  document.querySelector("#brandPanelTitle").textContent = activeCategory ? `${activeCategory.name}品牌` : "关联品牌";
  document.querySelector("#brandPanelHint").textContent = activeCategory ? `共 ${visibleBrands.length} 个关联品牌` : "请先从上方选择二级品类";

  els.brandAssets.innerHTML = visibleBrands.length ? visibleBrands
    .map(
      (brand) => {
        const checked = state.selected.brands.has(brand.id) ? "checked" : "";
        const action = state.manage.brands
          ? `
            <div class="action-group">
              <label class="select-check">
                <input type="checkbox" data-select-brand="${brand.id}" ${checked} />
                选择
              </label>
              <button class="danger-small" type="button" data-delete-brand="${brand.id}">删除</button>
            </div>
          `
          : `<button class="secondary-small" type="button" data-edit-brand="${brand.id}">编辑</button>`;
        return `
        <article class="brand-asset">
          <div class="logo-preview"><img src="${brandLogo(brand)}" alt="${escapeHtml(brand.name)} Logo" /></div>
          <div>
            <strong>${escapeHtml(brand.name)}</strong>
            <span>${escapeHtml(brand.categories.join("、"))}</span>
            <em class="brand-price-rule">${brandFactorText(brand.factor)}</em>
          </div>
          ${action}
        </article>
      `;
      },
    )
    .join("") : `<div class="brand-empty"><span>⌁</span><strong>${activeCategory ? "暂无关联品牌" : "选择一个二级品类"}</strong><p>${activeCategory ? "可以编辑现有品牌并关联此品类，或新增品牌。" : "下方将显示该品类可用的品牌和报价系数。"}</p></div>`;

  document.querySelectorAll("[data-asset-group]").forEach(button => {
    button.addEventListener("click", () => {
      state.assetCategoryGroup = button.dataset.assetGroup;
      state.assetCategoryId = "";
      renderAssets();
    });
  });

  document.querySelectorAll("[data-delete-category]").forEach((button) => {
    button.addEventListener("click", () => deleteCategory(button.dataset.deleteCategory));
  });
  document.querySelectorAll("[data-delete-brand]").forEach((button) => {
    button.addEventListener("click", () => deleteBrand(button.dataset.deleteBrand));
  });
  document.querySelectorAll("[data-edit-category]").forEach((button) => {
    button.addEventListener("click", () => openCategoryModal(button.dataset.editCategory));
  });
  document.querySelectorAll("[data-edit-brand]").forEach((button) => {
    button.addEventListener("click", () => openBrandModal(button.dataset.editBrand));
  });
  document.querySelectorAll("[data-filter-category]").forEach((card) => {
    const chooseCategory = (event) => {
      if (event.type === "click" && event.target.closest("button, input, label")) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      state.assetCategoryId = card.dataset.filterCategory;
      renderAssets();
    };
    card.addEventListener("click", chooseCategory);
    card.addEventListener("keydown", chooseCategory);
  });
  document.querySelectorAll("[data-select-category]").forEach((input) => {
    input.addEventListener("change", () => setSelected("categories", input.dataset.selectCategory, input.checked));
  });
  document.querySelectorAll("[data-select-brand]").forEach((input) => {
    input.addEventListener("change", () => setSelected("brands", input.dataset.selectBrand, input.checked));
  });
}

function setAssetModal(type, title, eyebrow) {
  state.assetDraft.type = type;
  els.assetModalTitle.textContent = title;
  els.assetModalEyebrow.textContent = eyebrow;
  els.categoryAssetForm.hidden = type !== "category";
  els.brandAssetForm.hidden = type !== "brand";
  els.assetModal.hidden = false;
}

function closeAssetModal() {
  els.assetModal.hidden = true;
  state.assetDraft = {
    type: "",
    id: "",
    categoryImage: "",
    brandLogo: "",
  };
  els.categoryImageInput.value = "";
  els.brandLogoInput.value = "";
}

function updateCategoryPreview() {
  const category = {
    tone: els.categoryToneInput.value || "#14766f",
    accent: els.categoryAccentInput.value || "#f59f2f",
    image: state.assetDraft.categoryImage,
  };
  els.categoryImagePreview.src = categoryImage(category);
}

function updateBrandPreview() {
  const brand = {
    name: els.brandNameInput.value.trim() || "品牌名称",
    latin: els.brandLatinInput.value.trim() || "BRAND",
    color: els.brandColorInput.value || "#14766f",
    logo: state.assetDraft.brandLogo,
  };
  els.brandLogoPreview.src = brandLogo(brand);
}

function openCategoryModal(id = "") {
  const category = categories.find((item) => item.id === id);
  state.assetDraft.id = category?.id || "";
  state.assetDraft.categoryImage = category?.image || "";
  els.categoryNameInput.value = category?.name || "";
  els.categoryToneInput.value = category?.tone || "#14766f";
  els.categoryAccentInput.value = category?.accent || "#f59f2f";
  els.categoryImageInput.value = "";
  updateCategoryPreview();
  setAssetModal("category", category ? "编辑品类图片" : "上传品类图", "品类图片");
  els.categoryNameInput.focus();
}

function renderBrandCategoryChoices(selectedIds = []) {
  const selected = new Set(selectedIds);
  const choices = categories.map(category => category.id);
  els.brandCategoryChoices.innerHTML = choices
    .filter((choice, index) => choices.indexOf(choice) === index)
    .map(
      (choice) => `
        <label class="category-choice">
          <input type="checkbox" value="${escapeHtml(choice)}" ${selected.has(choice) ? "checked" : ""} />
          <span class="category-choice-mark" aria-hidden="true"></span>
          <span class="category-choice-copy">
            <strong>${escapeHtml(categories.find(category => category.id === choice)?.name || choice)}</strong>
            <small>适用此品牌</small>
          </span>
        </label>
      `,
    )
    .join("");
  updateBrandCategorySummary();
}

function brandFactorText(factorValue) {
  const factor = Number(factorValue || 1);
  const percent = Math.round((factor - 1) * 100);
  if (!percent) return "标准报价 · 系数 1.00";
  return `${percent > 0 ? "整体报价 +" : "整体报价 "}${percent}% · 系数 ${factor.toFixed(2)}`;
}

function updateBrandCategorySummary() {
  const selected = els.brandCategoryChoices.querySelectorAll("input:checked").length;
  const summary = document.querySelector("#brandCategorySummary");
  if (summary) summary.textContent = selected ? `已选择 ${selected} 个品类` : "请至少选择 1 个品类";
  els.brandCategoryChoices.classList.toggle("has-empty-selection", selected === 0);
}

function openBrandModal(id = "") {
  const brand = brands.find((item) => item.id === id);
  state.assetDraft.id = brand?.id || "";
  state.assetDraft.brandLogo = brand?.logo || "";
  els.brandNameInput.value = brand?.name || "";
  els.brandLatinInput.value = brand?.latin || "";
  els.brandColorInput.value = brand?.color || "#14766f";
  els.brandLogoInput.value = "";
  els.brandSpecialInput.checked = Boolean(brand?.special ?? true);
  document.querySelector("#brandFactorInput").value = brand?.factor ?? 1;
  renderBrandCategoryChoices(brand?.categoryIds || (state.assetCategoryId ? [state.assetCategoryId] : []));
  updateBrandPreview();
  setAssetModal("brand", brand ? "编辑品牌 Logo" : "新增品牌", "品牌 Logo");
  els.brandNameInput.focus();
}

function selectedBrandCategories() {
  const selected = [...els.brandCategoryChoices.querySelectorAll("input:checked")].map((input) => input.value);
  return selected;
}

async function saveCategoryAsset(event) {
  event.preventDefault();
  const name = els.categoryNameInput.value.trim();
  if (!name) {
    els.categoryNameInput.focus();
    return;
  }

  const existing = categories.find((item) => item.id === state.assetDraft.id);
  const payload = {
    name,
    count: existing?.count ?? 0,
    tone: els.categoryToneInput.value || "#14766f",
    accent: els.categoryAccentInput.value || "#f59f2f",
    image: state.assetDraft.categoryImage || existing?.image || "",
  };

  try {
    await adminJson(existing ? `/api/admin/categories/${existing.id}` : "/api/admin/categories", {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    closeAssetModal();
    await loadAdminAssets();
  } catch (error) {
    alert(error.message);
  }
}

async function saveBrandAsset(event) {
  event.preventDefault();
  const name = els.brandNameInput.value.trim();
  if (!name) {
    els.brandNameInput.focus();
    return;
  }

  const existing = brands.find((item) => item.id === state.assetDraft.id);
  const payload = {
    name,
    latin: els.brandLatinInput.value.trim() || name,
    color: els.brandColorInput.value || "#14766f",
    factor: Number(document.querySelector("#brandFactorInput").value),
    categoryIds: selectedBrandCategories(),
    special: Number(document.querySelector("#brandFactorInput").value) !== 1,
    logo: state.assetDraft.brandLogo || existing?.logo || "",
  };

  try {
    await adminJson(existing ? `/api/admin/brands/${existing.id}` : "/api/admin/brands", {
      method: existing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    closeAssetModal();
    await loadAdminAssets();
  } catch (error) {
    alert(error.message);
  }
}

async function handleCategoryImageInput() {
  const dataUrl = await readImageFile(els.categoryImageInput);
  if (!dataUrl) return;
  state.assetDraft.categoryImage = dataUrl;
  updateCategoryPreview();
}

async function handleBrandLogoInput() {
  const dataUrl = await readImageFile(els.brandLogoInput);
  if (!dataUrl) return;
  state.assetDraft.brandLogo = dataUrl;
  updateBrandPreview();
}

async function deleteCategory(id) {
  try {
    await adminJson(`/api/admin/categories/${id}`, { method: "DELETE" });
    state.selected.categories.delete(id);
    services = services.filter((service) => service.categoryId !== id);
    if (!services.some((service) => service.id === state.selectedServiceId)) {
      state.selectedServiceId = services[0]?.id ?? "";
    }
    await loadAdminAssets();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteBrand(id) {
  try {
    await adminJson(`/api/admin/brands/${id}`, { method: "DELETE" });
    state.selected.brands.delete(id);
    await loadAdminAssets();
  } catch (error) {
    alert(error.message);
  }
}

async function batchDeleteCategories() {
  try {
    const ids = [...state.selected.categories];
    for (const id of ids) {
      await adminJson(`/api/admin/categories/${id}`, { method: "DELETE" });
    }
    state.selected.categories.clear();
    services = services.filter((service) => !ids.includes(service.categoryId));
    if (!services.some((service) => service.id === state.selectedServiceId)) {
      state.selectedServiceId = services[0]?.id ?? "";
    }
    await loadAdminAssets();
  } catch (error) {
    alert(error.message);
  }
}

async function batchDeleteBrands() {
  try {
    const ids = [...state.selected.brands];
    for (const id of ids) {
      await adminJson(`/api/admin/brands/${id}`, { method: "DELETE" });
    }
    state.selected.brands.clear();
    await loadAdminAssets();
  } catch (error) {
    alert(error.message);
  }
}

function renderCities() {
  renderRegionCityOptions();
  els.cityList.innerHTML = cities
    .map(
      (city) => {
        const checked = state.selected.cities.has(city.id) ? "checked" : "";
        const action = state.manage.cities
          ? `
            <div class="action-group">
              <label class="select-check">
                <input type="checkbox" data-select-city="${city.id}" ${checked} />
                选择
              </label>
              <button class="danger-small" type="button" data-delete-city="${city.id}">删除</button>
            </div>
          `
          : `<button class="secondary-small" type="button" data-edit-city="${city.id}">编辑</button>`;
        return `
        <article class="city-row ${state.cityRegionId === city.id ? "is-active" : ""}" data-filter-city="${escapeHtml(city.id)}" tabindex="0" role="button" aria-pressed="${state.cityRegionId === city.id}">
          <div>
            <strong>${escapeHtml(city.name)}</strong>
            <span>小程序端只显示城市名称</span>
          </div>
          <span class="city-rate">${escapeHtml(city.rate)}</span>
          ${action}
        </article>
      `;
      },
    )
    .join("");

  const activeCity = cities.find((city) => city.id === state.cityRegionId);
  const visibleRegions = activeCity ? regions.filter((region) => region.cityId === activeCity.id || region.city === activeCity.name) : [];
  document.querySelector("#regionPanelTitle").textContent = activeCity ? `${activeCity.name}区域规则` : "区域规则";
  document.querySelector("#regionPanelHint").textContent = activeCity ? `共 ${visibleRegions.length} 条区域规则` : "请先从左侧选择城市";
  if (activeCity) els.regionCityInput.value = activeCity.name;

  els.regionTable.innerHTML = visibleRegions.length ? visibleRegions
    .map(
      (region) => {
        const key = region.id;
        const checked = state.selected.regions.has(key) ? "checked" : "";
        const action = state.manage.regions
          ? `
            <div class="action-group">
              <label class="select-check">
                <input type="checkbox" data-select-region="${key}" ${checked} />
                选择
              </label>
              <button class="danger-small" type="button" data-delete-region="${region.id}">删除</button>
            </div>
          `
          : `<button class="secondary-small" type="button" data-edit-region="${region.id}">编辑</button>`;
        return `
        <tr>
          <td>${escapeHtml(region.city)}</td>
          <td>${escapeHtml(region.region)}</td>
          <td class="money-cell">${escapeHtml(region.rate)}</td>
          <td>${escapeHtml(region.radius)}</td>
          <td>${action}</td>
        </tr>
      `;
      },
    )
    .join("") : `<tr class="region-empty-row"><td colspan="5"><div class="region-empty"><span>⌁</span><strong>${activeCity ? "暂无区域规则" : "选择一个城市"}</strong><p>${activeCity ? "可以新增该城市的区域调价规则。" : "右侧将只展示所选城市的区域和调价规则。"}</p></div></td></tr>`;

  document.querySelectorAll("[data-delete-city]").forEach((button) => {
    button.addEventListener("click", () => deleteCity(button.dataset.deleteCity));
  });
  document.querySelectorAll("[data-delete-region]").forEach((button) => {
    button.addEventListener("click", () => deleteRegion(button.dataset.deleteRegion));
  });
  document.querySelectorAll("[data-edit-city]").forEach((button) => {
    button.addEventListener("click", () => fillCityForm(button.dataset.editCity));
  });
  document.querySelectorAll("[data-edit-region]").forEach((button) => {
    button.addEventListener("click", () => fillRegionForm(button.dataset.editRegion));
  });
  document.querySelectorAll("[data-filter-city]").forEach((card) => {
    const chooseCity = (event) => {
      if (event.type === "click" && event.target.closest("button, input, label")) return;
      if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      state.cityRegionId = card.dataset.filterCity;
      renderCities();
    };
    card.addEventListener("click", chooseCity);
    card.addEventListener("keydown", chooseCity);
  });
  document.querySelectorAll("[data-select-city]").forEach((input) => {
    input.addEventListener("change", () => setSelected("cities", input.dataset.selectCity, input.checked));
  });
  document.querySelectorAll("[data-select-region]").forEach((input) => {
    input.addEventListener("change", () => setSelected("regions", input.dataset.selectRegion, input.checked));
  });
}

function renderRegionCityOptions() {
  const selected = els.regionCityInput.value;
  els.regionCityInput.innerHTML = cities
    .map((city) => `<option value="${escapeHtml(city.name)}">${escapeHtml(city.name)}</option>`)
    .join("");
  if (selected && cities.some((city) => city.name === selected)) {
    els.regionCityInput.value = selected;
  }
}

function resetCityForm() {
  els.cityEditId.value = "";
  els.cityNameInput.value = "";
  els.cityRateInput.value = "标准";
  els.cityRadiusInput.value = "10公里";
  els.saveCityBtn.textContent = "保存城市";
}

function fillCityForm(id) {
  const city = cities.find((item) => item.id === id);
  if (!city) return resetCityForm();
  els.cityEditId.value = city.id;
  els.cityNameInput.value = city.name;
  els.cityRateInput.value = city.rate || "标准";
  els.cityRadiusInput.value = city.radius || "10公里";
  els.saveCityBtn.textContent = "保存修改";
  els.cityNameInput.focus();
}

async function saveCityForm(event) {
  event.preventDefault();
  const id = els.cityEditId.value;
  const name = els.cityNameInput.value.trim();
  if (!name) return els.cityNameInput.focus();
  const rate = els.cityRateInput.value.trim() || "标准";
  const radius = els.cityRadiusInput.value.trim() || "10公里";
  try {
    const city = cities.find((item) => item.id === id);
    await adminJson(city ? `/api/admin/cities/${city.id}` : "/api/admin/cities", {
      method: city ? "PATCH" : "POST",
      body: JSON.stringify({ name, rate, radius }),
    });
    resetCityForm();
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

function resetRegionForm() {
  els.regionEditId.value = "";
  els.regionCityInput.value = cities[0]?.name || "";
  els.regionNameInput.value = "";
  els.regionRateInput.value = "标准";
  els.regionRadiusInput.value = "10公里";
  els.saveRegionBtn.textContent = "保存区域";
}

function fillRegionForm(id) {
  const region = regions.find((item) => item.id === id);
  if (!region) return resetRegionForm();
  els.regionEditId.value = region.id;
  els.regionCityInput.value = region.city;
  els.regionNameInput.value = region.region;
  els.regionRateInput.value = region.rate || "标准";
  els.regionRadiusInput.value = region.radius || "10公里";
  els.saveRegionBtn.textContent = "保存修改";
  els.regionNameInput.focus();
}

async function saveRegionForm(event) {
  event.preventDefault();
  const id = els.regionEditId.value;
  const city = els.regionCityInput.value;
  const regionName = els.regionNameInput.value.trim();
  if (!city) return els.regionCityInput.focus();
  if (!regionName) return els.regionNameInput.focus();
  const rate = els.regionRateInput.value.trim() || "标准";
  const radius = els.regionRadiusInput.value.trim() || "10公里";
  try {
    const region = regions.find((item) => item.id === id);
    await adminJson(region ? `/api/admin/regions/${region.id}` : "/api/admin/regions", {
      method: region ? "PATCH" : "POST",
      body: JSON.stringify({ city, region: regionName, rate, radius }),
    });
    resetRegionForm();
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteCity(id) {
  try {
    await adminJson(`/api/admin/cities/${id}`, { method: "DELETE" });
    state.selected.cities.delete(id);
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteRegion(id) {
  try {
    await adminJson(`/api/admin/regions/${id}`, { method: "DELETE" });
    state.selected.regions.delete(id);
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

async function batchDeleteCities() {
  try {
    for (const id of [...state.selected.cities]) {
      await adminJson(`/api/admin/cities/${id}`, { method: "DELETE" });
    }
    state.selected.cities.clear();
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

async function batchDeleteRegions() {
  try {
    for (const id of [...state.selected.regions]) {
      await adminJson(`/api/admin/regions/${id}`, { method: "DELETE" });
    }
    state.selected.regions.clear();
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

function renderRules() {
  els.ruleList.innerHTML = rules
    .map(
      (rule) => {
        const checked = state.selected.rules.has(rule.id) ? "checked" : "";
        const action = state.manage.rules
          ? `
            <div class="action-group">
              <label class="select-check">
                <input type="checkbox" data-select-rule="${rule.id}" ${checked} />
                选择
              </label>
              <button class="danger-small" type="button" data-delete-rule="${rule.id}">删除</button>
            </div>
          `
          : `<button class="secondary-small" type="button" data-edit-rule="${rule.id}">编辑规则</button>`;
        return `
        <article class="rule-row">
          <div>
            <strong>${escapeHtml(rule.name)}</strong>
            <span>${escapeHtml(rule.scene)}</span>
          </div>
          <span class="rule-price">${escapeHtml(rule.price)}</span>
          ${action}
        </article>
      `;
      },
    )
    .join("");

  document.querySelectorAll("[data-delete-rule]").forEach((button) => {
    button.addEventListener("click", () => deleteRule(button.dataset.deleteRule));
  });
  document.querySelectorAll("[data-edit-rule]").forEach((button) => {
    button.addEventListener("click", () => fillRuleForm(button.dataset.editRule));
  });
  document.querySelectorAll("[data-select-rule]").forEach((input) => {
    input.addEventListener("change", () => setSelected("rules", input.dataset.selectRule, input.checked));
  });
}

function resetRuleForm() {
  els.ruleEditId.value = "";
  els.ruleNameInput.value = "";
  els.rulePriceInput.value = "";
  els.ruleSceneInput.value = "";
  els.saveRuleBtn.textContent = "保存规则";
}

function fillRuleForm(id) {
  const rule = rules.find((item) => item.id === id);
  if (!rule) return resetRuleForm();
  els.ruleEditId.value = rule.id;
  els.ruleNameInput.value = rule.name;
  els.rulePriceInput.value = rule.price || "";
  els.ruleSceneInput.value = rule.scene || "";
  els.saveRuleBtn.textContent = "保存修改";
  els.ruleNameInput.focus();
}

async function saveRuleForm(event) {
  event.preventDefault();
  const id = els.ruleEditId.value;
  const name = els.ruleNameInput.value.trim();
  const price = els.rulePriceInput.value.trim();
  const scene = els.ruleSceneInput.value.trim();
  if (!name) return els.ruleNameInput.focus();
  if (!price) return els.rulePriceInput.focus();
  try {
    const rule = rules.find((item) => item.id === id);
    await adminJson(rule ? `/api/admin/extras/${rule.id}` : "/api/admin/extras", {
      method: rule ? "PATCH" : "POST",
      body: JSON.stringify({ name, price, scene }),
    });
    resetRuleForm();
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteRule(id) {
  try {
    await adminJson(`/api/admin/extras/${id}`, { method: "DELETE" });
    state.selected.rules.delete(id);
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

async function batchDeleteRules() {
  try {
    for (const id of [...state.selected.rules]) {
      await adminJson(`/api/admin/extras/${id}`, { method: "DELETE" });
    }
    state.selected.rules.clear();
    await loadAdminOperations();
  } catch (error) {
    alert(error.message);
  }
}

function renderReceipts() {
  els.receiptTable.innerHTML = receipts
    .map((receipt) => {
      const statusClass = receipt.status === "已签名" ? "receipt-signed" : "receipt-pending";
      const claimClass = receipt.claimStatus.includes("已登录领取") ? "receipt-signed" : "receipt-pending";
      const warranty = warrantyInfo(receipt);
      return `
        <tr>
          <td><strong>${receipt.no}</strong></td>
          <td>${receipt.time}</td>
          <td>${receipt.customer}</td>
          <td>${receipt.service}</td>
          <td class="money-cell">${receipt.amount}</td>
          <td><span class="status-pill ${statusClass}">${receipt.status}</span></td>
          <td><span class="status-pill ${claimClass}">${receipt.followStatus} · ${receipt.claimStatus}</span></td>
          <td><span class="${warranty.tone}">${warranty.leftText}</span></td>
          <td>
            <button class="secondary-small" type="button" data-preview-receipt="${receipt.no}">预览</button>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll("[data-preview-receipt]").forEach((button) => {
    button.addEventListener("click", () => openReceiptPreview(button.dataset.previewReceipt));
  });
}

async function exportReceipts() {
  try {
    const response = await fetch("/api/admin/receipts/export", {
      headers: authHeaders(),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || "导出失败");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    link.href = url;
    link.download = `收据记录-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert(error.message);
  }
}

function renderClaimBoard() {
  els.claimBoard.innerHTML = receipts
    .map((receipt) => {
      const claimClass = receipt.claimStatus.includes("已登录领取") ? "receipt-signed" : "receipt-pending";
      return `
        <article class="claim-card">
          <div>
            <strong>${receipt.customer} · ${receipt.service}</strong>
            <span>${receipt.no} · ${receipt.time}</span>
          </div>
          <span class="status-pill ${claimClass}">${receipt.followStatus} · ${receipt.claimStatus}</span>
        </article>
      `;
    })
    .join("");
}

function renderPermissions() {
  els.permissionList.textContent = "进入权限设置以加载最新账号权限";
}

async function loadStaffPermissions() {
  const isAdmin = state.currentUser?.role === "admin";
  document.querySelector("#addStaffBtn").hidden = !isAdmin;
  document.querySelector("#staffAccountForm").hidden = true;
  try {
    const { staffUsers } = await adminJson("/api/admin/permissions");
    const readonlyHint = isAdmin ? "" : '<p class="permission-readonly-hint">当前为只读查看。账号新增、编辑、密码重置、停用/启用、删除及开据权限设置仅管理员可操作。</p>';
    els.permissionList.innerHTML = readonlyHint + staffUsers.map(user => `<article class="permission-card"><div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.mobile)} · ${escapeHtml(roleLabels[user.role] || user.role)} · ${user.canIssueReceipts ? "已开通收据权限" : "无收据权限"}</span></div>${isAdmin && user.role === "technician" ? `<button type="button" class="secondary-small" data-staff-permission="${escapeHtml(user.id)}" data-grant="${!user.canIssueReceipts}">${user.canIssueReceipts ? "撤销权限" : "开通权限"}</button>` : ""}</article>`).join("");
    if (!isAdmin) return;
    els.permissionList.querySelectorAll(".permission-card").forEach((card, index) => {
      const user = staffUsers[index];
      const actions = document.createElement("div");
      actions.className = "staff-account-actions";
      actions.innerHTML = `<span class="status-pill">${user.enabled ? "已启用" : "已停用"}</span><button type="button" class="secondary-small" data-action="edit">编辑账号</button><button type="button" class="secondary-small" data-action="password">重置密码</button><button type="button" class="secondary-small" data-action="toggle" ${user.id === state.currentUser.id ? "disabled" : ""}>${user.enabled ? "停用" : "启用"}</button><button type="button" class="danger-small" data-action="delete" ${user.id === state.currentUser.id ? "disabled" : ""}>删除</button>`;
      card.append(actions);
      actions.addEventListener("click", event => {
        const action = event.target.dataset.action;
        if (!action) return;
        card.querySelector(".staff-management-form")?.remove();
        const form = document.createElement("form");
        form.className = "staff-management-form edit-form";
        const fields = action === "edit" ? `<label>姓名<input name="name" value="${escapeHtml(user.name)}" required /></label><label>手机号<input name="mobile" value="${escapeHtml(user.mobile)}" pattern="1[0-9]{10}" required /></label>` : action === "password" ? '<label>新密码<input name="password" type="password" minlength="8" autocomplete="new-password" placeholder="至少8位，重置后需重新登录" required /></label>' : `<p>${action === "delete" ? "删除后该账号将无法登录，历史收据保留。" : user.enabled ? "停用后立即退出登录并停止开据。" : "确认重新启用该账号？"}</p>`;
        form.innerHTML = `${fields}<div class="staff-account-actions"><button type="submit" class="primary-small">确认${action === "delete" ? "删除" : "保存"}</button><button type="button" class="secondary-small" data-cancel>取消</button></div>`;
        form.querySelector("[data-cancel]").onclick = () => form.remove();
        form.onsubmit = async event => {
          event.preventDefault();
          const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
          try {
            const body = action === "toggle" ? { enabled: !user.enabled } : Object.fromEntries(new FormData(form));
            await adminJson(`/api/admin/staff/${encodeURIComponent(user.id)}`, { method: action === "delete" ? "DELETE" : "PATCH", ...(action === "delete" ? {} : { body: JSON.stringify(body) }) });
            document.querySelector("#permissionMessage").textContent = "账号操作已生效";
            await loadStaffPermissions();
          } catch (error) { document.querySelector("#permissionMessage").textContent = error.message; submit.disabled = false; }
        };
        card.append(form);
      });
    });
    els.permissionList.querySelectorAll("[data-staff-permission]").forEach(button => button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await adminJson(`/api/admin/staff/${encodeURIComponent(button.dataset.staffPermission)}/receipt-permission`, { method: "PATCH", body: JSON.stringify({ canIssueReceipts: button.dataset.grant === "true" }) });
        document.querySelector("#permissionMessage").textContent = "权限已保存，即时生效";
        await loadStaffPermissions();
      } catch (error) { document.querySelector("#permissionMessage").textContent = error.message; button.disabled = false; }
    }));
  } catch (error) { els.permissionList.textContent = error.message; }
}

document.querySelector("#addStaffBtn").addEventListener("click", () => { document.querySelector("#staffAccountForm").hidden = false; });
document.querySelector("#staffAccountForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await adminJson("/api/admin/staff", { method: "POST", body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    form.reset();
    document.querySelector("#permissionMessage").textContent = "师傅账号已创建，请按需开通收据权限";
    await loadStaffPermissions();
  } catch (error) { document.querySelector("#permissionMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

function openReceiptPreview(no) {
  const receipt = receipts.find((item) => item.no === no);
  if (!receipt) return;
  const warranty = warrantyInfo(receipt);
  els.modalReceiptNo.textContent = receipt.no;
  els.modalCustomer.textContent = receipt.customer;
  els.modalRepairTime.textContent = receipt.time;
  els.modalService.textContent = receipt.service;
  els.modalCity.textContent = receipt.city;
  els.modalWarranty.textContent = `${receipt.warrantyDays}天，至 ${warranty.dateText}`;
  els.modalWarrantyLeft.textContent = warranty.leftText;
  els.modalWarrantyLeft.className = warranty.tone;
  els.modalAmount.textContent = receipt.amount;
  els.modalSignature.replaceChildren();
  if (/^data:image\/png;base64,/.test(receipt.signatureDataUrl)) {
    const signature = document.createElement("img");
    signature.src = receipt.signatureDataUrl;
    signature.alt = "客户手写签名";
    signature.style.cssText = "max-width:100%;max-height:100px;object-fit:contain";
    els.modalSignature.append(signature);
  } else {
    els.modalSignature.textContent = "暂无签名图片";
  }
  els.modalQr.hidden = true;
  els.modalClaimText.textContent = `${receipt.followStatus} · ${receipt.claimStatus}；微信领取尚未接入`;
  els.modalReceiptLines.innerHTML = receipt.lines
    .map(
      (line) => `
        <div class="receipt-line">
          <span>${escapeHtml(line[0])}</span>
          <strong>${escapeHtml(line[1])}</strong>
        </div>
      `,
    )
    .join("");
  els.receiptModal.hidden = false;
}

function closeReceiptPreview() {
  els.receiptModal.hidden = true;
}

function switchSection(section) {
  state.activeSection = section;
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.section === section);
  });
  document.querySelectorAll(".section-view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `${section}Section`);
  });
  els.pageTitle.textContent = titles[section][0];
  els.pageSubtitle.textContent = titles[section][1];
  if (section === "permissions") loadStaffPermissions();
  if (section === "receipts" || section === "dashboard") loadAdminReceipts();
  if (section === "prices") loadAdminServices().catch(error => { document.querySelector("#dataMessage").textContent = error.message; });
}

function renderAll() {
  updateManageButtons();
  renderMetrics();
  renderServiceTable();
  renderEditor();
  renderAssets();
  renderCities();
  renderRules();
  renderReceipts();
  renderClaimBoard();
  renderPermissions();
  updateBatchBars();
}


fillSelects();
renderAll();
loadCurrentUser().then(() => Promise.all([loadAdminAssets(), loadAdminOperations(), loadAdminReceipts(), loadAdminServices()])).catch(error => { document.querySelector("#dataMessage").textContent = error.message; });

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => switchSection(button.dataset.section));
});

[els.categoryFilter, els.statusFilter, els.priceSearch].forEach((input) => {
  input.addEventListener("input", renderServiceTable);
  input.addEventListener("change", renderServiceTable);
});

function applyGlobalServiceSearch() {
  const rows = filteredServices();
  const first = rows[0];
  state.selectedServiceId = first?.id || "";
  if (first) els.categoryFilter.value = first.categoryId;
  renderServiceTable();
  renderEditor();
}

const globalResults = document.createElement("div");
globalResults.className = "global-search-results";
globalResults.id = "globalSearchResults";
globalResults.hidden = true;
globalResults.setAttribute("aria-label", "全局搜索结果");
els.globalSearch.closest("label").after(globalResults);
els.globalSearch.closest("label").parentElement.style.position = "relative";
els.globalSearch.setAttribute("aria-controls", globalResults.id);
let globalMatches = [];

function renderGlobalSearch() {
  const query = els.globalSearch.value.trim().toLowerCase();
  if (!query) { globalResults.hidden = true; return; }
  const candidates = [
    ...services.map(item => ({ type: "报价项目", name: item.name, detail: categoryName(item.categoryId), item, section: "prices", text: `${categoryName(item.categoryId)}维修 ${item.name} ${item.desc}` })),
    ...brands.map(item => ({ type: "品牌", name: item.name, detail: item.latin || "品牌资料", item, section: "assets", text: `${item.name} ${item.latin || ""}` })),
    ...cities.map(item => ({ type: "城市", name: item.name, detail: "城市与区域规则", item, section: "cities", text: item.name })),
    ...receipts.map(item => ({ type: "收据", name: item.no, detail: `${item.customer} · ${item.service}`, item, section: "receipts", text: `${item.no} ${item.customer} ${item.service} ${item.city}` })),
  ];
  globalMatches = candidates.filter(item => item.text.toLowerCase().includes(query));
  globalResults.innerHTML = `<div class="global-search-summary">找到 ${globalMatches.length} 条结果</div>` + (globalMatches.length ? globalMatches.map((result, index) => `<button type="button" data-global-result="${index}"><span class="status-pill">${result.type}</span><span><strong>${escapeHtml(result.name)}</strong><small>${escapeHtml(result.detail)}</small></span></button>`).join("") : '<p>没有匹配结果，请尝试项目名称、品牌、城市或收据编号。</p>');
  globalResults.hidden = false;
}

function openGlobalResult(index) {
  const result = globalMatches[index];
  if (!result) return;
  els.globalSearch.value = "";
  globalResults.hidden = true;
  if (result.section === "prices") {
    els.priceSearch.value = "";
    els.statusFilter.value = "all";
    els.categoryFilter.value = result.item.categoryId;
    state.selectedServiceId = result.item.id;
    renderServiceTable(); renderEditor();
  } else if (result.section === "cities") {
    state.cityRegionId = result.item.id;
    renderCities();
  } else if (result.section === "assets") {
    state.assetCategoryId = result.item.categoryIds?.[0] || "";
    const category = categories.find(item => item.id === state.assetCategoryId);
    if (category) state.assetCategoryGroup = assetGroupForCategory(category).id;
    renderAssets();
  }
  switchSection(result.section);
  if (result.section === "assets") openBrandModal(result.item.id);
  if (result.section === "receipts") openReceiptPreview(result.item.no);
}

globalResults.addEventListener("click", event => {
  const button = event.target.closest("[data-global-result]");
  if (button) openGlobalResult(Number(button.dataset.globalResult));
});
els.globalSearch.addEventListener("input", () => {
  if (state.activeSection === "prices") applyGlobalServiceSearch();
  renderGlobalSearch();
});
els.globalSearch.addEventListener("focus", renderGlobalSearch);
els.globalSearch.addEventListener("keydown", event => {
  if (event.key === "Escape") globalResults.hidden = true;
  if (event.key === "Enter") { event.preventDefault(); openGlobalResult(0); }
  if (event.key === "ArrowDown" && !globalResults.hidden) { event.preventDefault(); globalResults.querySelector("button")?.focus(); }
});
document.addEventListener("click", event => {
  if (!globalResults.contains(event.target) && !els.globalSearch.closest("label").contains(event.target)) globalResults.hidden = true;
});

els.serviceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveEditor();
});

els.toggleStatusBtn.addEventListener("click", () => {
  const service = selectedService();
  if (!service) return;
  mutateServices(() => adminJson(`/api/admin/services/${encodeURIComponent(service.id)}`, { method: "PATCH", body: JSON.stringify({ enabled: service.status !== "on" }) }));
});

els.addServiceBtn.addEventListener("click", addService);

els.managePricesBtn.addEventListener("click", () => toggleManage("prices"));
els.manageCategoriesBtn.addEventListener("click", () => toggleManage("categories"));
els.uploadCategoryBtn.addEventListener("click", () => openCategoryModal());
els.manageBrandsBtn.addEventListener("click", () => toggleManage("brands"));
els.addBrandBtn.addEventListener("click", () => openBrandModal());
els.manageCitiesBtn.addEventListener("click", () => toggleManage("cities"));
els.addCityBtn.addEventListener("click", () => {
  resetCityForm();
  els.cityNameInput.focus();
});
els.manageRegionsBtn.addEventListener("click", () => toggleManage("regions"));
els.addRegionBtn.addEventListener("click", () => {
  resetRegionForm();
  els.regionNameInput.focus();
});
els.manageRulesBtn.addEventListener("click", () => toggleManage("rules"));
els.addRuleBtn.addEventListener("click", () => {
  resetRuleForm();
  els.ruleNameInput.focus();
});

els.batchDeleteServicesBtn.addEventListener("click", batchDeleteServices);
els.batchDeleteCategoriesBtn.addEventListener("click", batchDeleteCategories);
els.batchDeleteBrandsBtn.addEventListener("click", batchDeleteBrands);
els.batchDeleteCitiesBtn.addEventListener("click", batchDeleteCities);
els.batchDeleteRegionsBtn.addEventListener("click", batchDeleteRegions);
els.batchDeleteRulesBtn.addEventListener("click", batchDeleteRules);

document.querySelectorAll("[data-close-receipt]").forEach((button) => {
  button.addEventListener("click", closeReceiptPreview);
});

document.querySelectorAll("[data-close-asset]").forEach((button) => {
  button.addEventListener("click", closeAssetModal);
});

els.categoryAssetForm.addEventListener("submit", saveCategoryAsset);
els.brandAssetForm.addEventListener("submit", saveBrandAsset);
els.brandCategoryChoices.addEventListener("change", updateBrandCategorySummary);
els.cityForm.addEventListener("submit", saveCityForm);
els.regionForm.addEventListener("submit", saveRegionForm);
els.ruleForm.addEventListener("submit", saveRuleForm);
els.resetCityBtn.addEventListener("click", resetCityForm);
els.resetRegionBtn.addEventListener("click", resetRegionForm);
els.resetRuleBtn.addEventListener("click", resetRuleForm);

els.categoryImageInput.addEventListener("change", () => {
  handleCategoryImageInput().catch(() => alert("品类图片读取失败，请重新选择图片"));
});
els.brandLogoInput.addEventListener("change", () => {
  handleBrandLogoInput().catch(() => alert("品牌 Logo 读取失败，请重新选择图片"));
});

[els.categoryToneInput, els.categoryAccentInput].forEach((input) => {
  input.addEventListener("input", updateCategoryPreview);
});

[els.brandNameInput, els.brandLatinInput, els.brandColorInput].forEach((input) => {
  input.addEventListener("input", updateBrandPreview);
});

els.refreshPreviewBtn.addEventListener("click", () => {
  const src = els.miniappPreview.getAttribute("src");
  els.miniappPreview.setAttribute("src", `${src.split("?")[0]}?t=${Date.now()}`);
});

els.exportReceiptsBtn.addEventListener("click", exportReceipts);
els.logoutBtn.addEventListener("click", logoutStaff);
document.querySelector("#refreshDataBtn").addEventListener("click", () => {
  Promise.all([loadAdminAssets(), loadAdminOperations(), loadAdminServices(), loadAdminReceipts()]).catch(error => { document.querySelector("#dataMessage").textContent = error.message; });
});
