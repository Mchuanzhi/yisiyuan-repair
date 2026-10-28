const model = require("./model");
const OFFSET = 8 * 60 * 60 * 1000;
// Backend repairTime is a Shanghai wall-clock string; timestamps with offsets
// keep their instant. Never let the device timezone interpret a bare date.
function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  let text = String(value || "").trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += "T00:00:00";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) text += "+08:00";
  return Date.parse(text);
}
function shanghaiDate(value) {
  const time = timestamp(value);
  return Number.isFinite(time) ? new Date(time + OFFSET).toISOString().slice(0, 10) : "";
}
function receiptTime(receipt) { return receipt.createdAt || receipt.repairTime; }
function ownReceipts(receipts, staffId) {
  if (!staffId) return [];
  return receipts.filter((receipt) => receipt.createdByStaffId === staffId);
}
function warrantyStatus(receipt, now) {
  const expiry = shanghaiDate(receipt.warrantyExpireDate);
  if (Number(receipt.warrantyDays) === 0 || !expiry) return "none";
  return expiry >= shanghaiDate(now) ? "active" : "expired";
}
function monthlySummary(receipts, staffId, now) {
  const month = shanghaiDate(now).slice(0, 7);
  return ownReceipts(receipts, staffId).reduce((summary, receipt) => {
    if (month && shanghaiDate(receiptTime(receipt)).slice(0, 7) === month) {
      summary.count += 1;
      summary.amount += Number(receipt.amount) || 0;
    }
    return summary;
  }, { count: 0, amount: 0 });
}
function filterReceipts(receipts, options) {
  const query = String(options.query || "").trim().toLowerCase();
  return ownReceipts(receipts, options.staffId).filter((receipt) => {
    const status = warrantyStatus(receipt, options.now);
    const text = [receipt.customerName, receipt.brandName, receipt.categoryName, receipt.deviceName, receipt.equipmentName, receipt.serviceName, receipt.no].join(" ").toLowerCase();
    return (!options.status || options.status === "all" || options.status === status) && (!query || text.includes(query));
  }).sort((a, b) => (timestamp(receiptTime(b)) || 0) - (timestamp(receiptTime(a)) || 0));
}
function withDevices(receipts, catalog) {
  return receipts.map((receipt) => {
    const ids = String(receipt.serviceId || "").split(",");
    const services = (catalog.services || []).filter((service) => ids.includes(service.id) || String(receipt.serviceName || "").split("、").includes(service.name));
    const names = (catalog.categories || []).filter((category) => services.some((service) => service.categoryId === category.id)).map((category) => category.name);
    return Object.assign({}, receipt, { deviceName: receipt.deviceName || names.join(" / ") });
  });
}
function presentHistory(receipts, options) {
  const own = ownReceipts(receipts, options.staffId);
  const summary = monthlySummary(own, options.staffId, options.now);
  const items = filterReceipts(own, options).map((receipt) => {
    const status = warrantyStatus(receipt, options.now);
    return Object.assign({}, model.historyItem(receipt), {
      device: [receipt.brandName, receipt.deviceName || receipt.categoryName || receipt.equipmentName].filter(Boolean).join(" · ") || "维修设备",
      repairTime: shanghaiDate(receiptTime(receipt)) + " " + (Number.isFinite(timestamp(receiptTime(receipt))) ? new Date(timestamp(receiptTime(receipt)) + OFFSET).toISOString().slice(11, 16) : ""),
      warrantyStatus: status,
      warrantyText: { none: "不保修", active: "保修中", expired: "已过保" }[status],
      warrantyDetail: status === "none" ? "本单不保修" : status === "active" ? "保修至 " + receipt.warrantyExpireDate : "保修已结束",
    });
  });
  return { items, countText: "共 " + own.length + " 笔", monthAmount: model.money(summary.amount), monthCount: summary.count,
    emptyText: own.length ? (items.length ? "" : "没有符合条件的收据") : "暂无收据" };
}
module.exports = { withDevices, timestamp, shanghaiDate, ownReceipts, warrantyStatus, monthlySummary, filterReceipts, presentHistory };
