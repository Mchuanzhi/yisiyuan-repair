let categories = [], brands = [], services = [], extras = [], history = [];
let cities = {};
let catalogReady = false, catalogLoading = false, quoteVersion = 0;
const state = {
  categoryGroup: "appliance",
  categoryId: "air",
  serviceIds: new Set(["air-basic"]),
  brandId: "gree",
  cityId: "shanghai",
  enabledExtras: new Set(),
  query: "",
  warrantyDays: 30,
  receipt: null,
};

const els = {
  categoryGrid: document.querySelector("#categoryGrid"),
  categoryGroupTabs: document.querySelector("#categoryGroupTabs"),
  serviceList: document.querySelector("#serviceList"),
  brandGrid: document.querySelector("#brandGrid"),
  extraList: document.querySelector("#extraList"),
  historyList: document.querySelector("#historyList"),
  categoryCount: document.querySelector("#categoryCount"),
  resultCount: document.querySelector("#resultCount"),
  brandCount: document.querySelector("#brandCount"),
  warrantySummary: document.querySelector("#warrantySummary"),
  warrantyOptions: document.querySelector("#warrantyOptions"),
  serviceTitle: document.querySelector("#serviceTitle"),
  searchInput: document.querySelector("#searchInput"),
  citySelect: document.querySelector("#citySelect"),
  quoteServiceName: document.querySelector("#quoteServiceName"),
  quoteCategoryImage: document.querySelector("#quoteCategoryImage"),
  quoteBrandLogo: document.querySelector("#quoteBrandLogo"),
  quoteBrandName: document.querySelector("#quoteBrandName"),
  quoteCityName: document.querySelector("#quoteCityName"),
  quoteTotal: document.querySelector("#quoteTotal"),
  quoteBreakdown: document.querySelector("#quoteBreakdown"),
  quoteIncludes: document.querySelector("#quoteIncludes"),
  quoteExcludes: document.querySelector("#quoteExcludes"),
  quoteWarranty: document.querySelector("#quoteWarranty"),
  confirmQuoteBtn: document.querySelector("#confirmQuoteBtn"),
  signatureSheet: document.querySelector("#signatureSheet"),
  receiptSheet: document.querySelector("#receiptSheet"),
  closeSignatureBtn: document.querySelector("#closeSignatureBtn"),
  closeReceiptBtn: document.querySelector("#closeReceiptBtn"),
  clearSignatureBtn: document.querySelector("#clearSignatureBtn"),
  generateReceiptBtn: document.querySelector("#generateReceiptBtn"),
  signatureCanvas: document.querySelector("#signatureCanvas"),
  signatureHint: document.querySelector("#signatureHint"),
  signatureServiceName: document.querySelector("#signatureServiceName"),
  signatureWarranty: document.querySelector("#signatureWarranty"),
  signatureTotal: document.querySelector("#signatureTotal"),
  receiptNo: document.querySelector("#receiptNo"),
  receiptTime: document.querySelector("#receiptTime"),
  receiptCity: document.querySelector("#receiptCity"),
  receiptWarranty: document.querySelector("#receiptWarranty"),
  receiptWarrantyExpire: document.querySelector("#receiptWarrantyExpire"),
  receiptLines: document.querySelector("#receiptLines"),
  receiptTotal: document.querySelector("#receiptTotal"),
  receiptSignature: document.querySelector("#receiptSignature"),
  receiptQr: document.querySelector("#receiptQr"),
  receiptClaimHint: document.querySelector("#receiptClaimHint"),
};

let hasSignature = false;
let staffUser = null;
let confirmedQuote = null;
let receiptSubmitting = false;

const categoryGroups = [
  { id: "appliance", name: "家电维修", names: ["空调", "洗衣机", "冰箱", "电热水器", "燃气热水器", "油烟机", "燃气灶", "电视"] },
  { id: "home", name: "房屋维修", names: ["电路维修", "水路维修", "管道疏通", "厨卫小件", "防水补漏"] },
  { id: "cleaning", name: "家电清洗", names: ["空调清洗", "洗衣机清洗", "油烟机清洗", "燃气灶清洗", "热水器清洗", "冰箱清洗"] },
  { id: "general", name: "综合服务", names: ["基础服务", "安装服务", "合作套餐"] },
];

function groupForCategory(category) {
  const exact = categoryGroups.find(group => group.names.includes(category.name));
  if (exact) return exact;
  if (/防水|管道|水路|电路|厨卫|房屋/.test(category.name)) return categoryGroups[1];
  if (/清洗|保养/.test(category.name)) return categoryGroups[2];
  if (/基础|安装|套餐/.test(category.name)) return categoryGroups[3];
  return categoryGroups[0];
}

function categoriesInActiveGroup() {
  return categories.filter(category => groupForCategory(category).id === state.categoryGroup);
}

async function staffApi(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.message || "请求失败，请稍后重试"); error.status = response.status; throw error; }
  return data;
}

function renderAccount() {
  document.querySelector("#profileName").textContent = staffUser?.name || "欢迎使用壹思源";
  document.querySelector("#profileStatus").textContent = staffUser ? ({ technician: "内部维修师傅", admin: "管理员 · 在管理后台授权师傅", support: "客服人员" }[staffUser.role] || "内部人员") : "游客可查价，开具收据需师傅账号授权";
  document.querySelector("#receiptPermission").textContent = !staffUser ? "未登录" : staffUser.canIssueReceipts ? "已开通 · 可开具电子收据" : staffUser.role === "technician" ? "未开通 · 请联系管理员" : "该账号负责管理或客服，不具备师傅开据权限";
  document.querySelector("#staffLoginForm").hidden = Boolean(staffUser);
  document.querySelector("#staffLogoutBtn").hidden = !staffUser;
  els.confirmQuoteBtn.textContent = staffUser?.canIssueReceipts ? "确认报价 · 签名 →" : "登录 / 查看开据权限";
}

async function refreshStaff() {
  try { staffUser = (await staffApi("/api/auth/me")).user; }
  catch (error) { staffUser = null; if (error.status !== 401) document.querySelector("#accountMessage").textContent = "暂时无法验证权限，请稍后重试"; }
  renderAccount();
  return staffUser;
}

function receiptInput() {
  return { serviceIds: [...state.serviceIds], brandId: state.brandId, cityId: state.cityId, extraIds: [...state.enabledExtras], warrantyDays: state.warrantyDays };
}

document.querySelector("#staffLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const values = new FormData(form);
    staffUser = (await staffApi("/api/auth/staff-login", { method: "POST", body: JSON.stringify({ mobile: values.get("mobile").trim(), password: values.get("password") }) })).user;
    form.reset();
    renderAccount();
    document.querySelector("#accountMessage").textContent = staffUser.canIssueReceipts ? "登录成功，可以返回查价报价开具收据。" : "登录成功。开据权限需由管理员开通。";
  } catch (error) { document.querySelector("#accountMessage").textContent = error.message; }
  finally { button.disabled = false; }
});

document.querySelector("#staffLogoutBtn").addEventListener("click", async () => {
  try {
    await staffApi("/api/auth/logout", { method: "POST" });
    staffUser = null; confirmedQuote = null; state.receipt = null; history = []; renderHistory();
    closeSignatureSheet(); closeReceiptSheet(); clearSignature(); renderAccount();
    document.querySelector("#accountMessage").textContent = "已退出登录";
  } catch (error) { document.querySelector("#accountMessage").textContent = error.message; }
});

document.addEventListener("visibilitychange", () => { if (!document.hidden) { refreshStaff(); if (els.signatureSheet.hidden && els.receiptSheet.hidden) loadCatalog(); if (document.querySelector("#historyView").classList.contains("is-active")) loadHistory(); } });

function svgUrl(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function categorySvg(category) {
  if (category.image) return category.image;
  const { tone, accent, type } = category;
  const common = `
    <defs><linearGradient id="body" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="${tone}"/></linearGradient></defs>
    <rect width="180" height="126" rx="28" fill="#ffffff" fill-opacity=".7"/>
    <circle cx="145" cy="24" r="18" fill="${accent}" opacity=".22"/>
    <circle cx="28" cy="98" r="20" fill="${tone}" opacity=".12"/>
  `;
  const drawings = {
    ac: `
      <rect x="30" y="34" width="120" height="38" rx="8" fill="${tone}"/>
      <rect x="40" y="44" width="74" height="8" rx="4" fill="#fff" opacity=".9"/>
      <rect x="122" y="44" width="16" height="8" rx="4" fill="${accent}"/>
      <path d="M52 82c8 10 18 10 26 0M86 82c8 10 18 10 26 0M120 82c8 10 18 10 26 0" fill="none" stroke="${tone}" stroke-width="5" stroke-linecap="round"/>
    `,
    washer: `
      <rect x="52" y="22" width="76" height="88" rx="12" fill="${tone}"/>
      <rect x="62" y="32" width="56" height="12" rx="4" fill="#fff" opacity=".85"/>
      <circle cx="90" cy="73" r="25" fill="#fff"/>
      <circle cx="90" cy="73" r="17" fill="${accent}" opacity=".65"/>
      <path d="M76 72c10-8 18 8 30 0" fill="none" stroke="${tone}" stroke-width="4" stroke-linecap="round"/>
    `,
    fridge: `
      <rect x="58" y="18" width="64" height="94" rx="10" fill="${tone}"/>
      <path d="M58 56h64" stroke="#fff" stroke-width="4" opacity=".8"/>
      <rect x="66" y="30" width="8" height="18" rx="4" fill="#fff"/>
      <rect x="66" y="68" width="8" height="24" rx="4" fill="#fff"/>
      <circle cx="119" cy="28" r="14" fill="${accent}" opacity=".9"/>
    `,
    heater: `
      <rect x="46" y="26" width="88" height="58" rx="18" fill="${tone}"/>
      <rect x="66" y="84" width="48" height="10" rx="5" fill="${accent}"/>
      <path d="M76 44c-10 12 9 14 0 26M96 42c-10 12 9 14 0 26" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
      <path d="M72 102h36" stroke="${tone}" stroke-width="6" stroke-linecap="round"/>
    `,
    kitchen: `
      <path d="M48 30h84l-12 32H60z" fill="${tone}"/>
      <rect x="62" y="64" width="56" height="38" rx="8" fill="${accent}"/>
      <circle cx="79" cy="83" r="8" fill="#fff" opacity=".9"/>
      <circle cx="101" cy="83" r="8" fill="#fff" opacity=".9"/>
      <path d="M68 28h44" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
    `,
    water: `
      <path d="M54 40h42c16 0 26 10 26 24v4" fill="none" stroke="${tone}" stroke-width="12" stroke-linecap="round"/>
      <path d="M110 72c0 18-18 28-18 28S74 90 74 72c0-10 8-18 18-18s18 8 18 18z" fill="${accent}"/>
      <path d="M52 88h34" stroke="${tone}" stroke-width="10" stroke-linecap="round"/>
      <rect x="42" y="30" width="34" height="18" rx="6" fill="${accent}"/>
    `,
    cleaning: `
      <rect x="48" y="38" width="70" height="50" rx="10" fill="${tone}"/>
      <path d="M118 52h16v22h-16" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
      <path d="M62 98h44M70 26h28" stroke="${tone}" stroke-width="8" stroke-linecap="round"/>
      <circle cx="62" cy="56" r="5" fill="#fff"/>
      <circle cx="80" cy="56" r="5" fill="#fff"/>
      <circle cx="98" cy="56" r="5" fill="#fff"/>
    `,
  };

  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 126" role="img">
      ${common}
      ${drawings[type].replaceAll(`fill="${tone}"`, 'fill="url(#body)"')}
    </svg>
  `);
}

function brandSvg(brand) {
  if (brand.logo) return brand.logo;
  const shortName = brand.latin.length > 8 ? brand.latin.slice(0, 8) : brand.latin;
  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 72" role="img">
      <rect x="2" y="2" width="156" height="68" rx="12" fill="#fff" stroke="${brand.color}" stroke-width="4"/>
      <circle cx="30" cy="36" r="16" fill="${brand.color}" opacity=".14"/>
      <path d="M22 38c8-14 19-14 27 0" fill="none" stroke="${brand.color}" stroke-width="5" stroke-linecap="round"/>
      <text x="55" y="34" fill="${brand.color}" font-size="21" font-weight="800" font-family="Arial, sans-serif">${shortName}</text>
      <text x="55" y="53" fill="#4f5c5a" font-size="13" font-weight="700" font-family="'Microsoft YaHei', sans-serif">${escapeReceiptText(brand.name)}</text>
    </svg>
  `);
}

function money(value) {
  return `¥${Math.round(value)}`;
}

function parseWarrantyDays(value) {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 30;
}

function setWarrantyFromService(service) {
  state.warrantyDays = parseWarrantyDays(service.warranty);
}

function setWarrantyFromServices() {
  const days = activeServices().map(service => parseWarrantyDays(service.warranty));
  if (days.length) state.warrantyDays = Math.max(...days);
}

function uniqueServiceText(selectedServices, key) {
  const values = [...new Set(selectedServices.map(service => service[key]).filter(Boolean))];
  return values.length ? values.join("；") : "—";
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatRepairTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function warrantyExpireText(startDate, days) {
  const expire = new Date(startDate);
  expire.setDate(expire.getDate() + days);
  return formatDate(expire);
}

function makeReceiptNo(date) {
  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `YSY${datePart}${String(date.getTime()).slice(-5)}`;
}

function receiptQrSvg(receiptNo) {
  const modules = 21;
  const cell = 6;
  const size = modules * cell;
  const chars = receiptNo.split("").map((char) => char.charCodeAt(0));

  function inFinder(x, y, originX, originY) {
    return x >= originX && x < originX + 7 && y >= originY && y < originY + 7;
  }

  function finder(originX, originY) {
    const p = originX * cell;
    const q = originY * cell;
    return `
      <rect x="${p}" y="${q}" width="${7 * cell}" height="${7 * cell}" fill="#14211f"/>
      <rect x="${p + cell}" y="${q + cell}" width="${5 * cell}" height="${5 * cell}" fill="#fff"/>
      <rect x="${p + cell * 2}" y="${q + cell * 2}" width="${3 * cell}" height="${3 * cell}" fill="#14211f"/>
    `;
  }

  const bits = [];
  for (let y = 0; y < modules; y += 1) {
    for (let x = 0; x < modules; x += 1) {
      const isFinder =
        inFinder(x, y, 0, 0) || inFinder(x, y, modules - 7, 0) || inFinder(x, y, 0, modules - 7);
      if (isFinder) continue;
      const seed = chars[(x + y) % chars.length] ?? 31;
      if ((x * 3 + y * 5 + seed) % 4 !== 0) continue;
      bits.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}" fill="#14211f"/>`);
    }
  }

  return svgUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img">
      <rect width="${size}" height="${size}" fill="#fff"/>
      ${finder(0, 0)}
      ${finder(modules - 7, 0)}
      ${finder(0, modules - 7)}
      ${bits.join("")}
    </svg>
  `);
}

function activeCategory() {
  return categories.find((item) => item.id === state.categoryId);
}

function activeService() {
  return activeServices()[0];
}

function activeServices() {
  return services.filter((item) => state.serviceIds.has(item.id));
}

function activeBrand() {
  return availableBrands().find((item) => item.id === state.brandId);
}

function activeCity() {
  return cities[state.cityId];
}

function midpoint(service) {
  return Math.round((service.low + service.high) / 2);
}

function filteredServices() {
  const query = state.query.trim().toLowerCase();
  return services.filter((service) => {
    const matchCategory = service.categoryId === state.categoryId;
    const category = categories.find((item) => item.id === service.categoryId);
    const categoryName = category?.name || "";
    const categoryTerms = categoryName.endsWith("维修") ? categoryName : `${categoryName} ${categoryName}维修`;
    const text = `${categoryTerms} ${escapeReceiptText(service.name)} ${escapeReceiptText(service.desc)} ${service.includes} ${service.excludes}`.toLowerCase();
    return query ? text.includes(query) : matchCategory;
  });
}

function availableBrands() {
  return brands.filter((brand) => brand.categories.includes(state.categoryId));
}

function ensureValidSelection() {
  if (!categories.some(item => item.id === state.categoryId)) state.categoryId = categories.find(category => services.some(service => service.categoryId === category.id))?.id || categories[0]?.id || "";
  const selectedCategory = categories.find(item => item.id === state.categoryId);
  if (selectedCategory) state.categoryGroup = groupForCategory(selectedCategory).id;
  const serviceSet = filteredServices();
  state.serviceIds = new Set([...state.serviceIds].filter(id => serviceSet.some(item => item.id === id)));
  if (!state.serviceIds.size && serviceSet[0]) { state.serviceIds.add(serviceSet[0].id); setWarrantyFromServices(); }
  if (!availableBrands().some(item => item.id === state.brandId)) state.brandId = availableBrands()[0]?.id || "";
  if (!cities[state.cityId]) state.cityId = Object.keys(cities)[0] || "";
  state.enabledExtras = new Set([...state.enabledExtras].filter(id => extras.some(item => item.id === id)));
}

async function loadCatalog() {
  if (catalogLoading) return;
  catalogLoading = true; catalogReady = false; ++quoteVersion;
  els.confirmQuoteBtn.disabled = true;
  document.querySelector("#catalogMessage").textContent = "正在同步最新报价…";
  try {
    const data = await staffApi("/api/catalog");
    categories = data.categories.map(item => ({ ...item, type: ({air:"ac",washer:"washer",fridge:"fridge",heater:"heater",kitchen:"kitchen",water:"water",cleaning:"cleaning"})[item.id] || "ac" }));
    services = data.services.map(item => ({ ...item, warranty: item.warrantyDays > 0 ? `${item.warrantyDays}天` : "不涉及" }));
    brands = data.brands.map(item => ({ ...item, latin: item.latin || item.name, categories: item.categoryIds || [] }));
    extras = data.extras.map(item => ({ ...item, desc: item.scene || "" }));
    cities = Object.fromEntries(data.cities.map(item => [item.id, { ...item, label: item.name }]));
    els.citySelect.innerHTML = data.cities.map(item => `<option value="${escapeReceiptText(item.id)}">${escapeReceiptText(item.name)}</option>`).join("");
    catalogReady = true;
    document.querySelector("#catalogMessage").textContent = services.length ? "价格与管理后台同步" : "暂无已上架服务，请联系管理员录入";
  } catch (error) {
    categories = []; services = []; brands = []; extras = []; cities = {};
    els.citySelect.innerHTML = "";
    document.querySelector("#catalogMessage").textContent = `加载失败：${error.message}，请点击刷新`;
  } finally { catalogLoading = false; render(); els.citySelect.value = state.cityId; }
}

function renderCategories() {
  const groupCategories = categoriesInActiveGroup();
  els.categoryCount.textContent = `4 组 · ${categories.length} 类`;
  els.categoryGroupTabs.innerHTML = categoryGroups.map(group => {
    const count = categories.filter(category => groupForCategory(category).id === group.id).length;
    return `<button class="category-group-tab${group.id === state.categoryGroup ? " is-active" : ""}" type="button" data-category-group="${group.id}" aria-pressed="${group.id === state.categoryGroup}"><strong>${group.name}</strong><span>${count}</span></button>`;
  }).join("");
  els.categoryGrid.innerHTML = groupCategories
    .map((category) => {
      const active = category.id === state.categoryId ? " is-active" : "";
      return `
        <button class="category-card${active}" type="button" data-category="${escapeReceiptText(category.id)}">
          <img src="${escapeReceiptText(categorySvg(category))}" alt="${escapeReceiptText(category.name)}" />
          <strong>${escapeReceiptText(category.name)}</strong>
          <span>${category.count} 个项目</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-category-group]").forEach((button) => {
    button.addEventListener("click", () => {
      state.categoryGroup = button.dataset.categoryGroup;
      const firstCategory = categoriesInActiveGroup().find(category => services.some(service => service.categoryId === category.id)) || categoriesInActiveGroup()[0];
      if (!firstCategory) return;
      state.categoryId = firstCategory.id;
      state.query = "";
      els.searchInput.value = "";
      const firstService = services.find(service => service.categoryId === firstCategory.id);
      state.serviceIds = new Set(firstService ? [firstService.id] : []);
      if (firstService) setWarrantyFromServices();
      state.brandId = availableBrands()[0]?.id ?? "other";
      render();
    });
  });

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.categoryId = button.dataset.category;
      state.query = "";
      els.searchInput.value = "";
      const first = services.find((service) => service.categoryId === state.categoryId);
      state.serviceIds = new Set(first ? [first.id] : []);
      if (first) setWarrantyFromServices();
      state.brandId = availableBrands()[0]?.id ?? "other";
      render();
    });
  });
}

function renderServices() {
  const items = filteredServices();
  const category = activeCategory();
  els.serviceTitle.textContent = state.query ? "搜索结果 · 可多选" : `${category?.name || "服务项目"} · 故障可多选`;
  els.resultCount.textContent = `${items.length} 项 · 已选 ${state.serviceIds.size}`;
  if (!items.length) { els.serviceList.textContent = state.query ? "没有匹配的服务项目" : "该品类暂无已上架项目"; return; }
  els.serviceList.innerHTML = items
    .map((service) => {
      const active = state.serviceIds.has(service.id) ? " is-active" : "";
      return `
        <button class="service-card${active}" type="button" data-service="${escapeReceiptText(service.id)}" aria-pressed="${state.serviceIds.has(service.id)}">
          <span class="service-check" aria-hidden="true"></span>
          <span class="service-main">
            <strong>${escapeReceiptText(service.name)}</strong>
            <p>${escapeReceiptText(service.desc)}</p>
          </span>
          <span class="service-price">
            <strong>${escapeReceiptText(service.priceText || `¥${service.low}-${service.high}`)}</strong>
            <span>${escapeReceiptText(service.warranty)}</span>
          </span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-service]").forEach((button) => {
    button.addEventListener("click", () => {
      const service = services.find(item => item.id === button.dataset.service);
      if (!service) return;
      const hasAnotherCategory = activeServices().some((item) => item.categoryId !== service.categoryId);
      if (hasAnotherCategory) state.serviceIds.clear();
      if (state.serviceIds.has(service.id)) state.serviceIds.delete(service.id);
      else state.serviceIds.add(service.id);
      state.categoryId = service.categoryId;
      setWarrantyFromServices();
      if (!availableBrands().some((brand) => brand.id === state.brandId)) {
        state.brandId = availableBrands()[0]?.id ?? "other";
      }
      render();
    });
  });
}

function renderBrands() {
  const items = availableBrands();
  els.brandCount.textContent = `${items.length} 个`;
  els.brandGrid.innerHTML = items
    .map((brand) => {
      const active = brand.id === state.brandId ? " is-active" : "";
      const factorPercent = Math.round((Number(brand.factor || 1) - 1) * 100);
      const priceLabel = factorPercent === 0 ? "标准报价" : `品牌调价 ${factorPercent > 0 ? "+" : ""}${factorPercent}%`;
      return `
        <button class="brand-card${active}" type="button" data-brand="${escapeReceiptText(brand.id)}">
          <img src="${escapeReceiptText(brandSvg(brand))}" alt="${escapeReceiptText(brand.name)}标识" />
          <strong>${escapeReceiptText(brand.name)}</strong>
          <span>${priceLabel}</span>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-brand]").forEach((button) => {
    button.addEventListener("click", () => {
      state.brandId = button.dataset.brand;
      render();
    });
  });
}

function compactExtraPrice(extra) {
  const name = extra.name || "";
  const price = extra.price || money(extra.amount);
  if (name.includes("远程")) return "¥30–100/单";
  if (name.includes("高空")) return "¥50起";
  if (name.includes("夜间") || name.includes("节假日")) return "+20%–50%";
  if (name.includes("严重油污") || name.includes("重度污垢")) return "+¥30–150";
  if (name.includes("拆吊顶") || name.includes("拆柜体")) return "¥80起";
  if (name.includes("打孔") || name.includes("扩孔")) return "¥50起";
  if (name.includes("开槽") || name.includes("暗管")) return "¥150起";
  if (name.includes("自备配件")) return "人工+10%–20%";
  if (name.includes("旧机拆除")) return "¥50起";
  if (name.includes("多点施工")) return "人工-20%–40%";
  if (name.includes("大件") || name.includes("商用")) return "现场报价";
  return price.length > 13 ? `${price.slice(0, 12)}…` : price;
}

function renderExtras() {
  const cards = extras
    .map((extra) => {
      const checked = state.enabledExtras.has(extra.id) ? "checked" : "";
      return `
        <label class="extra-item${checked ? " is-active" : ""}">
          <input type="checkbox" data-extra="${escapeReceiptText(extra.id)}" ${checked} />
          <span class="extra-check" aria-hidden="true"></span>
          <span class="extra-copy">
            <strong>${escapeReceiptText(extra.name)}</strong>
            <small>${escapeReceiptText(compactExtraPrice(extra))}</small>
          </span>
        </label>
      `;
    })
    .join("");
  els.extraList.innerHTML = `<div class="extra-card-grid">${cards}</div>`;

  document.querySelectorAll("[data-extra]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.enabledExtras.add(input.dataset.extra);
      } else {
        state.enabledExtras.delete(input.dataset.extra);
      }
      input.closest(".extra-item")?.classList.toggle("is-active", input.checked);
      void renderQuote();
    });
  });
}

function renderWarrantyOptions() {
  const options = [0, 7, 30, 90, 180];
  els.warrantySummary.textContent = state.warrantyDays === 0 ? "不保修" : `${state.warrantyDays}天`;
  els.warrantyOptions.innerHTML = options
    .map((days) => {
      const active = days === state.warrantyDays ? " is-active" : "";
      return `
        <button class="warranty-option${active}" type="button" data-warranty-days="${days}">
          ${days === 0 ? "不保修" : `${days}天`}
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-warranty-days]").forEach((button) => {
    button.addEventListener("click", () => {
      state.warrantyDays = Number(button.dataset.warrantyDays);
      renderWarrantyOptions();
      renderQuote();
    });
  });
}

async function renderQuote() {
  const version = ++quoteVersion;
  const category = activeCategory(), selectedServices = activeServices(), brand = activeBrand(), city = activeCity();
  els.confirmQuoteBtn.disabled = true;
  els.quoteTotal.textContent = "—";
  document.querySelector("#dockTotal").textContent = "—";
  els.quoteBreakdown.textContent = "请选择有效的项目、品牌和城市";
  els.quoteServiceName.textContent = selectedServices.length ? (selectedServices.length === 1 ? selectedServices[0].name : `已选 ${selectedServices.length} 项故障`) : "请至少选择一个故障";
  els.quoteBrandName.textContent = brand?.name || "暂无适用品牌";
  els.quoteCityName.textContent = city?.label || "暂无城市";
  els.quoteIncludes.textContent = uniqueServiceText(selectedServices, "includes");
  els.quoteExcludes.textContent = uniqueServiceText(selectedServices, "excludes");
  els.quoteWarranty.textContent = selectedServices.length ? (state.warrantyDays === 0 ? "不保修" : `${state.warrantyDays}天`) : "—";
  els.quoteCategoryImage.hidden = !category;
  els.quoteBrandLogo.hidden = !brand;
  if (category) { els.quoteCategoryImage.src = categorySvg(category); els.quoteCategoryImage.alt = category.name; }
  if (brand) { els.quoteBrandLogo.src = brandSvg(brand); els.quoteBrandLogo.alt = brand.name; }
  if (!catalogReady || !selectedServices.length || !brand || !city) return;
  els.quoteBreakdown.textContent = "正在计算…";
  try {
    const quote = await staffApi("/api/quotes/calculate", { method: "POST", body: JSON.stringify(receiptInput()) });
    if (version !== quoteVersion) return;
    els.quoteTotal.textContent = money(quote.total);
    document.querySelector("#dockTotal").textContent = money(quote.total);
    els.quoteBreakdown.innerHTML = quote.rows.map(row => `<div class="breakdown-row"><span>${escapeReceiptText(row.label)}</span><strong>${money(row.amount)}</strong></div>`).join("");
    els.confirmQuoteBtn.disabled = false;
  } catch (error) {
    if (version === quoteVersion) els.quoteBreakdown.textContent = `报价失败：${error.message}，请刷新数据`;
  }
}

async function createReceipt(signatureDataUrl) {
  const customerName = document.querySelector("#receiptCustomerName").value.trim();
  if (!customerName) throw new Error("请填写客户姓名");
  if (!confirmedQuote) throw new Error("请返回重新确认报价");
  const { receipt } = await staffApi("/api/staff/receipts", { method: "POST", body: JSON.stringify({ ...confirmedQuote.input, customerName, signatureDataUrl, expectedTotal: confirmedQuote.total }) });
  return {
    no: receipt.no,
    time: receipt.repairTime,
    city: receipt.cityName,
    total: receipt.amount,
    warrantyDays: receipt.warrantyDays,
    warrantyExpire: receipt.warrantyExpireDate,
    claimText: "收据已保存。微信扫码领取尚未接入，请联系门店获取凭证。",
    signatureDataUrl: receipt.signatureDataUrl,
    qrUrl: "",
    lines: [
      { label: "客户", value: receipt.customerName },
      { label: "服务项目", value: receipt.serviceName },
      { label: "维修品牌", value: receipt.brandName },
      ...receipt.lines.map((row) => ({ label: row.label, value: money(row.amount) })),
    ],
  };
}

function renderReceipt(receipt) {
  els.receiptNo.textContent = receipt.no;
  els.receiptTime.textContent = receipt.time;
  els.receiptCity.textContent = receipt.city;
  els.receiptWarranty.textContent = Number(receipt.warrantyDays) === 0 ? "不保修" : `${receipt.warrantyDays}天`;
  els.receiptWarrantyExpire.textContent = receipt.warrantyExpire;
  els.receiptTotal.textContent = money(receipt.total);
  els.receiptSignature.src = receipt.signatureDataUrl;
  els.receiptQr.hidden = !receipt.qrUrl;
  if (receipt.qrUrl) els.receiptQr.src = receipt.qrUrl;
  els.receiptClaimHint.textContent = receipt.claimText;
  els.receiptLines.innerHTML = receipt.lines
    .map(
      (line) => `
        <div class="receipt-line">
          <span>${escapeReceiptText(line.label)}</span>
          <strong>${escapeReceiptText(line.value)}</strong>
        </div>
      `,
    )
    .join("");
}

function escapeReceiptText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

async function openSignatureSheet() {
  els.confirmQuoteBtn.disabled = true;
  try {
    await refreshStaff();
    if (!staffUser?.canIssueReceipts) {
      document.querySelector('[data-view="mine"]').click();
      return;
    }
    const input = receiptInput();
    const quote = await staffApi("/api/quotes/calculate", { method: "POST", body: JSON.stringify(input) });
    confirmedQuote = { input, total: quote.total };
    els.signatureServiceName.textContent = quote.services.map(service => service.name).join("、");
    els.signatureWarranty.textContent = `${input.warrantyDays === 0 ? "不保修" : `保修${input.warrantyDays}天`} · 以服务端核定金额为准`;
    els.signatureTotal.textContent = money(quote.total);
    els.signatureSheet.hidden = false;
    clearSignature();
  } catch (error) {
    document.querySelector('[data-view="mine"]').click();
    document.querySelector("#accountMessage").textContent = `无法开具收据：${error.message}。请确认该项目已由后台录入。`;
  } finally { els.confirmQuoteBtn.disabled = false; }
}

function closeSignatureSheet() {
  els.signatureSheet.hidden = true;
}

function openReceiptSheet() {
  els.receiptSheet.hidden = false;
}

function closeReceiptSheet() {
  els.receiptSheet.hidden = true;
}

function clearSignature() {
  const canvas = els.signatureCanvas;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
  els.signatureHint.textContent = "请客户在上方空白处签名确认报价";
  els.signatureHint.classList.remove("is-error");
}

function setupSignaturePad() {
  const canvas = els.signatureCanvas;
  const context = canvas.getContext("2d");
  let drawing = false;

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    drawing = true;
    hasSignature = true;
    canvas.setPointerCapture(event.pointerId);
    const start = point(event);
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#14211f";
    els.signatureHint.textContent = "签名已记录，可生成收据";
    els.signatureHint.classList.remove("is-error");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  });

  canvas.addEventListener("pointerup", () => {
    drawing = false;
  });

  canvas.addEventListener("pointercancel", () => {
    drawing = false;
  });
}

function renderHistory() {
  document.querySelector("#historyCount").textContent = `${history.length} 条`;
  els.historyList.innerHTML = history.length ? history.map(item => `<article class="history-card"><div class="history-row"><strong>${escapeReceiptText(item.customerName)}</strong><span>${escapeReceiptText(item.repairTime)}</span></div><div class="history-row"><span>${escapeReceiptText(item.serviceName)}</span><strong>${money(item.amount)}</strong></div><div class="history-row"><span>${escapeReceiptText(item.no)}</span><span>${item.voided ? "已作废" : "已开具"}</span></div></article>`).join("") : "暂无本人开具的收据";
}

async function loadHistory() {
  history = []; renderHistory();
  await refreshStaff();
  if (!staffUser) { els.historyList.textContent = "请在「我的」登录后查看本人开具的收据"; return; }
  const userId = staffUser.id;
  try {
    const data = await staffApi("/api/staff/receipts");
    if (staffUser?.id !== userId) return;
    history = data.receipts; renderHistory();
  } catch (error) { els.historyList.textContent = `加载失败：${error.message}`; }
}

function render() {
  ensureValidSelection();
  renderCategories();
  renderServices();
  renderBrands();
  renderExtras();
  renderWarrantyOptions();
  renderQuote();
  renderHistory();
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((tab) => tab.setAttribute("aria-pressed", String(tab === button)));
    document.querySelector("#quoteDock").hidden = button.dataset.view !== "price";
    document.querySelector(".welcome-banner").hidden = button.dataset.view !== "price";
    document.querySelector(".search-wrap").hidden = button.dataset.view !== "price";
    document.querySelector(".content").scrollTop = 0;
    document.querySelector(".topbar h1").textContent = ({ price: "壹思源维修报价", history: "历史报价", mine: "我的" })[button.dataset.view];
    document.querySelector(".city-picker").hidden = button.dataset.view !== "price";
    document.querySelectorAll("[data-view]").forEach((tab) => tab.classList.remove("is-active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelector(`#${button.dataset.view}View`).classList.add("is-active");
    if (button.dataset.view === "mine") refreshStaff();
    if (button.dataset.view === "history") loadHistory();
    if (button.dataset.view === "price") loadCatalog();
  });
});

document.querySelectorAll("[data-collapse]").forEach((button) => {
  button.addEventListener("click", () => {
    const panel = document.querySelector(`[data-panel="${button.dataset.collapse}"]`);
    const collapsed = panel.classList.toggle("is-collapsed");
    button.setAttribute("aria-expanded", String(!collapsed));
    const content = document.querySelector(".content");
    requestAnimationFrame(() => {
      const maximum = Math.max(0, content.scrollHeight - content.clientHeight);
      if (content.scrollTop > maximum) content.scrollTop = maximum;
      void content.offsetHeight;
    });
  });
});

els.confirmQuoteBtn.addEventListener("click", openSignatureSheet);
els.closeSignatureBtn.addEventListener("click", closeSignatureSheet);
els.closeReceiptBtn.addEventListener("click", closeReceiptSheet);
els.clearSignatureBtn.addEventListener("click", clearSignature);
els.generateReceiptBtn.addEventListener("click", async () => {
  if (receiptSubmitting) return;
  if (!hasSignature) {
    els.signatureHint.textContent = "请先完成客户签名";
    els.signatureHint.classList.add("is-error");
    return;
  }
  receiptSubmitting = true;
  els.generateReceiptBtn.disabled = true;
  try {
    state.receipt = await createReceipt(els.signatureCanvas.toDataURL("image/png"));
    renderReceipt(state.receipt);
    closeSignatureSheet();
    openReceiptSheet();
  } catch (error) {
    els.signatureHint.textContent = error.message;
    els.signatureHint.classList.add("is-error");
    if (error.status === 401 || error.status === 403) await refreshStaff();
  } finally { receiptSubmitting = false; els.generateReceiptBtn.disabled = false; }
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  const first = filteredServices()[0];
  if (first) {
    state.serviceIds = new Set([first.id]);
    state.categoryId = first.categoryId;
    setWarrantyFromServices();
  } else if (state.query.trim()) {
    state.serviceIds.clear();
  }
  render();
});

els.citySelect.addEventListener("change", (event) => {
  state.cityId = event.target.value;
  renderQuote();
});

setupSignaturePad();
render();
refreshStaff();
loadCatalog();
document.querySelector("#refreshCatalogBtn").addEventListener("click", loadCatalog);
