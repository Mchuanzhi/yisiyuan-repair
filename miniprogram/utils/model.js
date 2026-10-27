const CATEGORY_IMAGES = {
  air: "/images/categories/air.png",
  washer: "/images/categories/washer.png",
  fridge: "/images/categories/fridge.png",
  heater: "/images/categories/heater.png",
  kitchen: "/images/categories/kitchen.png",
  water: "/images/categories/water.png",
  cleaning: "/images/categories/cleaning.png",
};

const BRAND_IMAGES = {
  gree: "/images/brands/gree.png",
  midea: "/images/brands/midea.png",
  haier: "/images/brands/haier.png",
  aux: "/images/brands/aux-brand.png",
  siemens: "/images/brands/siemens.png",
  other: "/images/brands/other.png",
};

const categoryGroups = [
  { id: "appliance", name: "家电维修", names: ["空调", "洗衣机", "冰箱", "电热水器", "燃气热水器", "油烟机", "燃气灶", "电视"] },
  { id: "home", name: "房屋维修", names: ["电路维修", "水路维修", "管道疏通", "厨卫小件", "防水补漏"] },
  { id: "cleaning", name: "家电清洗", names: ["空调清洗", "洗衣机清洗", "油烟机清洗", "燃气灶清洗", "热水器清洗", "冰箱清洗"] },
  { id: "general", name: "综合服务", names: ["基础服务", "安装服务", "合作套餐"] },
];

const WARRANTY_OPTIONS = [0, 7, 30, 90, 180];

function mockDb() {
  return {
    categories: [
      { id: "air", name: "空调维修", count: 8, tone: "#14766f", accent: "#f59f2f", enabled: true },
      { id: "washer", name: "洗衣机", count: 5, tone: "#316fd1", accent: "#2f8f68", enabled: true },
      { id: "fridge", name: "冰箱冰柜", count: 4, tone: "#2f8ca3", accent: "#84c7d8", enabled: true },
      { id: "heater", name: "热水器", count: 5, tone: "#ce4d3d", accent: "#f1a33d", enabled: true },
      { id: "kitchen", name: "厨电维修", count: 6, tone: "#7d5a3a", accent: "#d9861f", enabled: true },
      { id: "water", name: "水电管道", count: 7, tone: "#28666e", accent: "#51a3a3", enabled: true },
      { id: "cleaning", name: "清洗保养", count: 9, tone: "#2f8f68", accent: "#316fd1", enabled: true },
    ],
    brands: [
      { id: "gree", name: "格力", latin: "GREE", color: "#0b7f72", factor: 1.08, categoryIds: ["air"] },
      { id: "midea", name: "美的", latin: "Midea", color: "#1877c9", factor: 1.05, categoryIds: ["air", "washer", "fridge", "heater", "kitchen"] },
      { id: "haier", name: "海尔", latin: "Haier", color: "#139ed9", factor: 1.04, categoryIds: ["air", "washer", "fridge", "heater"] },
      { id: "aux", name: "奥克斯", latin: "AUX", color: "#d12d33", factor: 1.03, categoryIds: ["air"] },
      { id: "siemens", name: "西门子", latin: "SIEMENS", color: "#08706f", factor: 1.12, categoryIds: ["washer", "fridge", "kitchen"] },
      { id: "other", name: "其他品牌", latin: "OTHER", color: "#5f6f6c", factor: 1, categoryIds: ["air", "washer", "fridge", "heater", "kitchen", "water", "cleaning"] },
    ],
    cities: [
      { id: "shanghai", name: "上海", rate: "+10%", radius: "8公里", multiplier: 1.1, enabled: true },
      { id: "hangzhou", name: "杭州", rate: "标准", radius: "10公里", multiplier: 1, enabled: true },
      { id: "suzhou", name: "苏州", rate: "+5%", radius: "10公里", multiplier: 1.05, enabled: true },
      { id: "hefei", name: "合肥", rate: "-5%", radius: "12公里", multiplier: 0.95, enabled: true },
    ],
    services: [
      { id: "air-capacitor", categoryId: "air", name: "更换电容/传感器", desc: "启动电容、压缩机电容、温度传感器等", low: 90, high: 180, part: 65, warrantyDays: 90, includes: "拆装、检测、调试", excludes: "配件", enabled: true },
      { id: "air-basic", categoryId: "air", name: "挂机普通维修", desc: "漏水、异响、遥控异常、传感器异常等小修", low: 80, high: 160, part: 0, warrantyDays: 30, includes: "检测、人工调试", excludes: "配件、高空", enabled: true },
      { id: "water-faucet", categoryId: "water", name: "水龙头/角阀/软管更换", desc: "单点位检测、更换、接头处理", low: 50, high: 100, part: 35, warrantyDays: 30, includes: "人工", excludes: "材料", enabled: true },
    ],
    extras: [
      { id: "remote", name: "远程费", price: "30-100元", scene: "超出约定服务半径", amount: 50, enabled: true },
      { id: "height", name: "高空费", price: "50-180元", scene: "空调外机、窗外施工", amount: 100, enabled: true },
      { id: "night", name: "夜间/节假日加急", price: "上浮20%-50%", scene: "紧急漏水、商户停业", amount: 80, enabled: true },
      { id: "heavy", name: "严重油污/重度污垢", price: "30-150元", scene: "厨房、油烟机、长期未清洗设备", amount: 60, enabled: true },
      { id: "ceiling", name: "拆吊顶/拆柜体", price: "80-300元起", scene: "隐藏设备检修", amount: 120, enabled: true },
    ],
  };
}

const mockUsers = [
  { id: "staff_admin", name: "李主管", mobile: "18800000001", password: "123456", role: "admin", canIssueReceipts: false },
  { id: "staff_tech", name: "张师傅", mobile: "18800000002", password: "123456", role: "technician", canIssueReceipts: true },
  { id: "staff_support", name: "门店前台", mobile: "18800000003", password: "123456", role: "support", canIssueReceipts: false },
];

function money(value) {
  return "¥" + Math.round(Number(value) || 0);
}

function httpImage(value) {
  return typeof value === "string" && /^https?:\/\//.test(value);
}

function categoryImage(category) {
  if (category && httpImage(category.image)) return category.image;
  if (category && CATEGORY_IMAGES[category.id]) return CATEGORY_IMAGES[category.id];
  return "/images/categories/default.png";
}

function brandImage(brand) {
  if (brand && httpImage(brand.logo)) return brand.logo;
  if (brand && httpImage(brand.image)) return brand.image;
  if (brand && BRAND_IMAGES[brand.id]) return BRAND_IMAGES[brand.id];
  return "/images/brands/other.png";
}

function groupForCategory(category) {
  const name = category && category.name ? category.name : "";
  const exact = categoryGroups.find((group) => group.names.indexOf(name) >= 0);
  if (exact) return exact;
  if (/防水|管道|水路|电路|厨卫|房屋/.test(name)) return categoryGroups[1];
  if (/清洗|保养/.test(name)) return categoryGroups[2];
  if (/基础|安装|套餐/.test(name)) return categoryGroups[3];
  return categoryGroups[0];
}

function normalizeCatalog(raw) {
  const data = raw || {};
  const categories = (data.categories || []).filter((item) => item.enabled !== false).map((item) => ({
    id: item.id,
    name: item.name,
    count: Number(item.count || 0),
    image: categoryImage(item),
  }));
  const services = (data.services || []).filter((item) => item.enabled !== false).map((item) => ({
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    desc: item.desc || "",
    low: Number(item.low || 0),
    high: Number(item.high || 0),
    part: Number(item.part || 0),
    warrantyDays: Number(item.warrantyDays || 0),
    warranty: Number(item.warrantyDays) > 0 ? Number(item.warrantyDays) + "天" : "不涉及",
    includes: item.includes || "",
    excludes: item.excludes || "",
    priceText: item.priceText || "¥" + item.low + "-" + item.high,
  }));
  const brands = (data.brands || []).map((item) => ({
    id: item.id,
    name: item.name,
    latin: item.latin || item.name,
    factor: Number(item.factor || 1),
    categoryIds: item.categoryIds || [],
    image: brandImage(item),
  }));
  const cities = (data.cities || []).filter((item) => item.enabled !== false).map((item) => ({
    id: item.id,
    name: item.name,
    rate: item.rate || "",
  }));
  const extras = (data.extras || []).filter((item) => item.enabled !== false).map((item) => ({
    id: item.id,
    name: item.name,
    price: item.price || "",
    scene: item.scene || item.desc || "",
    amount: Number(item.amount || 0),
    priceLabel: compactExtraPrice(item),
  }));
  return { categories, services, brands, cities, extras };
}

function publicCatalog() {
  const db = mockDb();
  const services = db.services.filter((item) => item.enabled);
  return {
    categories: db.categories.filter((item) => item.enabled).map((item) => Object.assign({}, item, {
      count: services.filter((service) => service.categoryId === item.id).length,
    })),
    brands: db.brands.map((item) => Object.assign({}, item)),
    cities: db.cities.filter((item) => item.enabled).map((item) => ({
      id: item.id,
      name: item.name,
      rate: item.rate,
      radius: item.radius,
      enabled: item.enabled,
    })),
    services: services.map((item) => Object.assign({}, item)),
    extras: db.extras.filter((item) => item.enabled).map((item) => Object.assign({}, item)),
  };
}

function compactExtraPrice(extra) {
  const name = extra.name || "";
  const price = extra.price || money(extra.amount);
  if (name.indexOf("远程") >= 0) return "¥30–100/单";
  if (name.indexOf("高空") >= 0) return "¥50起";
  if (name.indexOf("夜间") >= 0 || name.indexOf("节假日") >= 0) return "+20%–50%";
  if (name.indexOf("严重油污") >= 0 || name.indexOf("重度污垢") >= 0) return "+¥30–150";
  if (name.indexOf("拆吊顶") >= 0 || name.indexOf("拆柜体") >= 0) return "¥80起";
  if (name.indexOf("打孔") >= 0 || name.indexOf("扩孔") >= 0) return "¥50起";
  if (name.indexOf("开槽") >= 0 || name.indexOf("暗管") >= 0) return "¥150起";
  if (name.indexOf("自备配件") >= 0) return "人工+10%–20%";
  if (name.indexOf("旧机拆除") >= 0) return "¥50起";
  if (name.indexOf("多点施工") >= 0) return "人工-20%–40%";
  if (name.indexOf("大件") >= 0 || name.indexOf("商用") >= 0) return "现场报价";
  return price.length > 13 ? price.slice(0, 12) + "…" : price;
}

function factorLabel(factor) {
  const percent = Math.round((Number(factor || 1) - 1) * 100);
  if (percent === 0) return "标准报价";
  return "品牌调价 " + (percent > 0 ? "+" : "") + percent + "%";
}

function warrantyLabel(days) {
  return Number(days) === 0 ? "不保修" : Number(days) + "天";
}

function filteredServices(catalog, state) {
  const query = String(state.query || "").trim().toLowerCase();
  return catalog.services.filter((service) => {
    if (!query) return service.categoryId === state.categoryId;
    const category = catalog.categories.find((item) => item.id === service.categoryId);
    const categoryName = category ? category.name : "";
    const text = [categoryName, service.name, service.desc, service.includes, service.excludes].join(" ").toLowerCase();
    return text.indexOf(query) >= 0;
  });
}

function availableBrands(catalog, categoryId) {
  return catalog.brands.filter((brand) => (brand.categoryIds || []).indexOf(categoryId) >= 0);
}

function warrantyFromServices(catalog, serviceIds) {
  const days = catalog.services.filter((service) => serviceIds.indexOf(service.id) >= 0).map((service) => Number(service.warrantyDays || 0));
  if (!days.length) return 30;
  return Math.max.apply(null, days);
}

function blankState() {
  return {
    categoryGroup: "appliance",
    categoryId: "air",
    serviceIds: ["air-basic"],
    brandId: "gree",
    cityId: "shanghai",
    extraIds: [],
    query: "",
    warrantyDays: 30,
  };
}

function ensureSelection(catalog, state) {
  const next = Object.assign(blankState(), state || {});
  next.serviceIds = (next.serviceIds || []).slice();
  next.extraIds = (next.extraIds || []).slice();
  next.query = next.query || "";
  if (!catalog.categories.some((item) => item.id === next.categoryId)) {
    const fallback = catalog.categories.find((category) => catalog.services.some((service) => service.categoryId === category.id));
    next.categoryId = fallback ? fallback.id : (catalog.categories[0] ? catalog.categories[0].id : "");
  }
  const selectedCategory = catalog.categories.find((item) => item.id === next.categoryId);
  if (selectedCategory) next.categoryGroup = groupForCategory(selectedCategory).id;
  const visible = filteredServices(catalog, next);
  next.serviceIds = next.serviceIds.filter((id) => visible.some((item) => item.id === id));
  if (!next.serviceIds.length && visible[0]) {
    next.serviceIds = [visible[0].id];
    next.warrantyDays = warrantyFromServices(catalog, next.serviceIds);
  }
  const brands = availableBrands(catalog, next.categoryId);
  if (!brands.some((item) => item.id === next.brandId)) next.brandId = brands[0] ? brands[0].id : "";
  if (!catalog.cities.some((item) => item.id === next.cityId)) next.cityId = catalog.cities[0] ? catalog.cities[0].id : "";
  const knownExtras = {};
  catalog.extras.forEach((item) => {
    knownExtras[item.id] = true;
  });
  next.extraIds = next.extraIds.filter((id) => knownExtras[id]);
  return next;
}

function categoriesInGroup(catalog, groupId) {
  return catalog.categories.filter((category) => groupForCategory(category).id === groupId);
}

function quoteInput(state) {
  return {
    serviceIds: (state.serviceIds || []).slice(),
    brandId: state.brandId,
    cityId: state.cityId,
    extraIds: (state.extraIds || []).slice(),
    warrantyDays: Number(state.warrantyDays || 0),
  };
}

function selectedServices(catalog, state) {
  return catalog.services.filter((service) => state.serviceIds.indexOf(service.id) >= 0);
}

function uniqueText(services, key) {
  const values = [];
  services.forEach((service) => {
    const value = service[key];
    if (value && values.indexOf(value) < 0) values.push(value);
  });
  return values.length ? values.join("；") : "—";
}

function presentLists(catalog, state) {
  const selection = ensureSelection(catalog, state);
  const groupCategories = categoriesInGroup(catalog, selection.categoryGroup);
  const visibleServices = filteredServices(catalog, selection);
  const brands = availableBrands(catalog, selection.categoryId);
  const chosen = selectedServices(catalog, selection);
  const category = catalog.categories.find((item) => item.id === selection.categoryId) || null;
  const brand = brands.find((item) => item.id === selection.brandId) || null;
  const city = catalog.cities.find((item) => item.id === selection.cityId) || null;
  const cityIndex = Math.max(0, catalog.cities.findIndex((item) => item.id === selection.cityId));
  return {
    selection,
    category,
    brand,
    city,
    groups: categoryGroups.map((group) => ({
      id: group.id,
      name: group.name,
      count: categoriesInGroup(catalog, group.id).length,
      active: group.id === selection.categoryGroup,
    })),
    categories: groupCategories.map((item) => ({
      id: item.id,
      name: item.name,
      count: item.count,
      image: item.image,
      active: item.id === selection.categoryId,
    })),
    services: visibleServices.map((item) => ({
      id: item.id,
      name: item.name,
      desc: item.desc,
      priceText: item.priceText,
      warranty: item.warranty,
      selected: selection.serviceIds.indexOf(item.id) >= 0,
    })),
    brands: brands.map((item) => ({
      id: item.id,
      name: item.name,
      image: item.image,
      priceLabel: factorLabel(item.factor),
      active: item.id === selection.brandId,
    })),
    extras: catalog.extras.map((item) => ({
      id: item.id,
      name: item.name,
      priceLabel: item.priceLabel,
      scene: item.scene,
      on: selection.extraIds.indexOf(item.id) >= 0,
    })),
    warrantyOptions: WARRANTY_OPTIONS.map((days) => ({
      days,
      label: warrantyLabel(days),
      active: days === Number(selection.warrantyDays),
    })),
    cities: catalog.cities,
    cityIndex,
    cityName: city ? city.name : "选择城市",
    categoryCount: "4 组 · " + catalog.categories.length + " 类",
    serviceTitle: selection.query ? "搜索结果 · 可多选" : (category ? category.name : "服务项目") + " · 故障可多选",
    resultCount: visibleServices.length + " 项 · 已选 " + selection.serviceIds.length,
    brandCount: brands.length + " 个",
    warrantySummary: warrantyLabel(selection.warrantyDays),
    quoteName: chosen.length ? (chosen.length === 1 ? chosen[0].name : "已选 " + chosen.length + " 项故障") : "请至少选择一个故障",
    quoteBrand: brand ? brand.name : "暂无适用品牌",
    quoteCity: city ? city.name : "暂无城市",
    includes: uniqueText(chosen, "includes"),
    excludes: uniqueText(chosen, "excludes"),
    quoteWarranty: chosen.length ? warrantyLabel(selection.warrantyDays) : "—",
    categoryImage: category ? category.image : "",
    brandImage: brand ? brand.image : "",
    emptyServices: visibleServices.length ? "" : (selection.query ? "没有匹配的服务项目" : "该品类暂无已上架项目"),
    canQuote: Boolean(chosen.length && brand && city),
  };
}

function calculateMock(body) {
  const db = mockDb();
  const requested = body.serviceIds || (body.serviceId ? [body.serviceId] : []);
  if (!Array.isArray(requested) || !requested.length) {
    throw Object.assign(new Error("请至少选择一个故障项目"), { status: 400 });
  }
  const uniqueIds = requested.filter((id, index) => requested.indexOf(id) === index);
  const services = uniqueIds.map((id) => db.services.find((item) => item.id === id && item.enabled));
  const brand = db.brands.find((item) => item.id === body.brandId);
  const city = db.cities.find((item) => item.id === body.cityId && item.enabled);
  if (services.some((service) => !service) || !brand || !city) {
    throw Object.assign(new Error("服务、品牌或城市不存在"), { status: 400 });
  }
  const categoryIds = services.map((service) => service.categoryId).filter((id, index, list) => list.indexOf(id) === index);
  if (categoryIds.length !== 1 || brand.categoryIds.indexOf(services[0].categoryId) < 0) {
    throw Object.assign(new Error("该品类已停用或品牌不适用，请刷新报价目录"), { status: 400 });
  }
  const extraIds = body.extraIds || [];
  if (extraIds.some((id) => !db.extras.some((item) => item.id === id && item.enabled))) {
    throw Object.assign(new Error("特殊费用已变更，请刷新报价目录"), { status: 400 });
  }
  const selectedExtras = extraIds.filter((id, index) => extraIds.indexOf(id) === index).map((id) => db.extras.find((item) => item.id === id));
  const rows = [];
  services.forEach((service) => {
    const labor = Math.round(((service.low + service.high) / 2) * city.multiplier * brand.factor);
    const part = Math.round(service.part * brand.factor);
    rows.push({ label: service.name + " · 维修人工费", amount: labor });
    if (part) rows.push({ label: service.name + " · " + brand.name + "配件估算", amount: part });
  });
  selectedExtras.forEach((extra) => rows.push({ label: extra.name, amount: extra.amount }));
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  return {
    services: services.map((service) => ({ id: service.id, name: service.name, warrantyDays: service.warrantyDays })),
    brand: { id: brand.id, name: brand.name },
    city: { id: city.id, name: city.name },
    rows,
    total,
  };
}

function mockLogin(mobile, password) {
  const user = mockUsers.find((item) => item.mobile === String(mobile || "").trim() && item.password === password);
  if (!user) throw Object.assign(new Error("账号或密码错误"), { status: 401 });
  return {
    token: "mock:" + user.id,
    user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role, canIssueReceipts: user.canIssueReceipts },
  };
}

function roleLabel(user) {
  if (!user) return "游客可查价，开具收据需师傅账号授权";
  if (user.role === "technician") return "内部维修师傅";
  if (user.role === "admin") return "管理员 · 在管理后台授权师傅";
  if (user.role === "support") return "客服人员";
  return "内部人员";
}

function permissionLabel(user) {
  if (!user) return "未登录";
  if (user.canIssueReceipts) return "已开通 · 可开具电子收据";
  if (user.role === "technician") return "未开通 · 请联系管理员";
  return "该账号负责管理或客服，不具备师傅开据权限";
}

function presentReceipt(receipt, signaturePath) {
  const days = Number(receipt.warrantyDays || 0);
  return {
    no: receipt.no,
    time: receipt.repairTime,
    city: receipt.cityName,
    warrantyText: days === 0 ? "不保修" : days + "天",
    warrantyExpire: days === 0 ? "" : receipt.warrantyExpireDate,
    total: money(receipt.amount),
    customerName: receipt.customerName,
    serviceName: receipt.serviceName,
    brandName: receipt.brandName,
    includes: receipt.includes || "",
    excludes: receipt.excludes || "",
    lines: (receipt.lines || []).map((row) => ({ label: row.label, value: money(row.amount) })),
    signaturePath: signaturePath || "",
    claimText: "收据已保存，请向客户出示本页留存。",
    voided: Boolean(receipt.voided),
    statusText: receipt.voided ? "已作废" : "已开具",
  };
}

function historyItem(receipt) {
  return {
    no: receipt.no,
    customerName: receipt.customerName || "未填写",
    repairTime: receipt.repairTime || "",
    serviceName: receipt.serviceName || "",
    amountText: money(receipt.amount),
    statusText: receipt.voided ? "已作废" : "已开具",
  };
}

module.exports = {
  WARRANTY_OPTIONS,
  money,
  categoryImage,
  brandImage,
  groupForCategory,
  normalizeCatalog,
  publicCatalog,
  compactExtraPrice,
  factorLabel,
  warrantyLabel,
  filteredServices,
  availableBrands,
  blankState,
  ensureSelection,
  quoteInput,
  presentLists,
  calculateMock,
  mockLogin,
  mockDb,
  roleLabel,
  permissionLabel,
  presentReceipt,
  historyItem,
  warrantyFromServices,
  selectedServices,
};
