import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const h = require('../utils/history');
const now = new Date('2026-10-31T16:00:00Z'); // November 1 in Shanghai
const base = { createdByStaffId: 'me', amount: 70, warrantyDays: 7, warrantyExpireDate: '2026-11-01', customerName: '陈女士', brandName: 'Haier', categoryName: '空调', deviceName: '挂机', serviceName: '深度清洗', no: 'YSY001' };
const receipts = [
  { ...base, createdAt: '2026-10-31T15:59:59Z' },
  { ...base, no: 'YSY002', createdAt: '2026-10-31T16:00:00Z' },
  { ...base, no: 'YSY003', repairTime: '2026-11-01 00:01', amount: 30 },
  { ...base, createdByStaffId: 'other', createdAt: '2026-11-01T00:00:00Z', amount: 999 },
];
test('UTC+8 month boundary, bare wall time and own receipts only', () => {
  assert.equal(h.shanghaiDate(now), '2026-11-01');
  assert.deepEqual(h.monthlySummary(receipts, 'me', now), { count: 2, amount: 100 });
  assert.deepEqual(h.monthlySummary(receipts, null, now), { count: 0, amount: 0 });
});
test('warranty expiry uses Shanghai today, zero or absent expiry is never expired', () => {
  assert.equal(h.warrantyStatus(base, now), 'active');
  assert.equal(h.warrantyStatus({ ...base, warrantyExpireDate: '2026-10-31' }, now), 'expired');
  for (const receipt of [{ ...base, warrantyDays: 0 }, { ...base, warrantyExpireDate: '' }]) {
    assert.equal(h.warrantyStatus(receipt, now), 'none');
    assert.deepEqual(h.filterReceipts([receipt], { staffId: 'me', status: 'expired', now }), []);
  }
});
test('search matches every required field, trims and ignores case', () => {
  for (const query of ['陈女士', ' HAIER ', '空调', '挂机', '深度清洗', ' ysy001 ']) {
    assert.equal(h.filterReceipts([base], { staffId: 'me', query, now }).length, 1, query);
  }
});
test('query and status compose, distinct empty states and monthly total stays unfiltered', () => {
  const options = { staffId: 'me', now, query: 'missing', status: 'active' };
  const result = h.presentHistory(receipts, options);
  assert.equal(result.items.length, 0);
  assert.equal(result.emptyText, '没有符合条件的收据');
  assert.equal(result.monthCount, 2);
  assert.equal(h.presentHistory([], options).emptyText, '暂无收据');
  assert.equal(h.filterReceipts([base], { ...options, query: 'Haier', status: 'expired' }).length, 0);
});
test('catalog resolves receipt device and allows category search', () => {
  const items = h.withDevices([{ ...base, deviceName: '', categoryName: '', serviceId: 'svc' }], {
    services: [{ id: 'svc', categoryId: 'washer' }], categories: [{ id: 'washer', name: '滚筒洗衣机' }],
  });
  assert.equal(items[0].deviceName, '滚筒洗衣机');
  assert.equal(h.filterReceipts(items, { staffId: 'me', query: '洗衣机', now }).length, 1);
});
test('mock zero warranty persists empty expiry, retains complete own history and receipt presentation clears legacy expiry', async () => {
  const storage = new Map();
  const state = { useMock: true, user: { id: 'me', canIssueReceipts: true } };
  globalThis.getApp = () => ({ globalData: state });
  globalThis.wx = { getStorageSync: (key) => storage.get(key), setStorageSync: (key, value) => storage.set(key, value) };
  const api = require('../utils/api');
  const model = require('../utils/model');
  storage.set('mockReceipts', Array.from({ length: 55 }, (_, i) => ({ ...base, no: 'old' + i })));
  const { receipt } = await api.createReceipt({ customerName: '客户', serviceIds: ['air-basic'], brandId: 'gree', cityId: 'shanghai', warrantyDays: 0, signatureDataUrl: 'data:image/png;base64,dGVzdA==' });
  assert.equal(receipt.warrantyExpireDate, '');
  assert.equal(receipt.warrantyDays, 0);
  assert.equal((await api.listReceipts()).receipts.length, 56);
  const legacy = model.presentReceipt({ ...receipt, warrantyExpireDate: '2026-11-01' });
  assert.equal(legacy.warrantyText, '不保修');
  assert.equal(legacy.warrantyExpire, '');
  delete globalThis.wx;
  delete globalThis.getApp;
});
