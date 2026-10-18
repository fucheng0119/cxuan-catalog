// 用法: node ledger_assert.js <html路徑>
// 「我的叫貨」分頁（<script id="ledger-js">）考卷：假 DOM＋假 liff＋假 fetch＋可控時鐘，不連網、不送單
const fs = require('fs'), vm = require('vm');
const [,, PATH] = process.argv;
const src = fs.readFileSync(PATH, 'utf8');
const code = (src.match(/<script id="ledger-js">([\s\S]*?)<\/script>/) || [])[1];
if (!code) { console.log('RESULT: FAIL (找不到 ledger-js 區塊)'); process.exit(1); }

const fails = []; let passes = 0;
const A = (cond, msg) => { if (cond) passes++; else fails.push(msg); };
const count = (s, needle) => s.split(needle).length - 1;
const tick = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };
const MONTH = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
const UID = 'U06c36b215f4d9fab6efbe5b180b15ed1';
const msToNextTaipeiMonth = () => {
  const t = new Date(Date.now() + 8 * 3600e3);
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 1) - (Date.now() + 8 * 3600e3);
};

function payload(n, extra) {
  const orders = Array.from({ length: n }, (_, i) => ({
    id: `ORD-沙鹿-2610${String(17 - (i % 17)).padStart(2, '0')}-${100000 + i}`,
    time: `${MONTH}-${String(17 - (i % 17)).padStart(2, '0')}T14:02:12+08:00`,
    status: i === 1 ? '已作廢' : i === 2 ? '部分作廢' : '已送出',
    subtotal: i === 1 ? 0 : 5965,
    review: false,
    lines: [
      { cx: 'cx217', name: i === 3 ? '<img src=x onerror=alert(1)>' : 'CDA第一道濾心', qty: 8, price: 680, subtotal: 5440, status: i === 1 || i === 2 ? '已作廢' : '已送出', review: false },
      { cx: 'cx226', name: 'KT5mPP', qty: 5, price: 105, subtotal: 525, status: i === 1 ? '已作廢' : '已送出', review: false }
    ]
  }));
  return Object.assign({ ok: true, store: '沙鹿店', month: MONTH, asOf: `${MONTH}-18T17:30:00+08:00`, stale: false, total: 10665, orderCount: 6, voidedOrderCount: 1, reviewLineCount: 0, undatedRowCount: 0, orders, listLimit: 60, listTruncated: false }, extra || {});
}

function makeEnv({ ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID }, store = {}, fetchImpl } = {}) {
  const S = { fetches: [], listExtra: '', lsWrites: 0 };
  let offset = 0;
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + offset); }
    static now() { return RealDate.now() + offset; }
  }
  const classSet = (init) => {
    const set = new Set(String(init || '').split(/\s+/).filter(Boolean));
    return { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, on) => { (on === undefined ? !set.has(c) : on) ? set.add(c) : set.delete(c); }, _set: set };
  };
  const el = (id, cls) => {
    const e = { id, listeners: {}, attrs: {}, dataset: {}, style: {}, textContent: '', scrollTop: 0, clientHeight: 600, scrollHeight: 2000,
      classList: classSet(cls),
      addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; } };
    Object.defineProperty(e, 'className', { get() { return [...e.classList._set].join(' '); }, set(v) { e.classList = classSet(v); } });
    return e;
  };
  const body = el('ledger-body'); let bodyHtml = '';
  Object.defineProperty(body, 'innerHTML', { get() { return bodyHtml; }, set(v) { bodyHtml = String(v); S.listExtra = ''; } });
  const els = {
    'ledger-sync': el('ledger-sync', 'ledger-sync'), 'ledger-scroll': el('ledger-scroll', 'scroll-area'), 'ledger-body': body,
    'view-order': el('view-order', 'view active'), 'view-ledger': el('view-ledger', 'view'), 'ledger-more': el('ledger-more', 'ledger-more')
  };
  const list = { insertAdjacentHTML(_p, html) { S.listExtra += html; } };
  const tabs = [el('tab-order', 'main-tab active'), el('tab-ledger', 'main-tab')];
  tabs[0].dataset.view = 'view-order'; tabs[1].dataset.view = 'view-ledger';
  const ls = Object.assign({}, store);
  const context = {
    console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, AbortController, Promise, JSON, Date: FakeDate, Math, Number, String, Array, Object, Error,
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { S.lsWrites++; ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    document: {
      getElementById: id => {
        if (id === 'ledger-list') return bodyHtml.includes('id="ledger-list"') ? list : null;
        if (id === 'ledger-more') return bodyHtml.includes('id="ledger-more"') ? els['ledger-more'] : null;
        return els[id] || null;
      },
      querySelectorAll: sel => sel === '.main-tab' ? tabs : sel === '.view' ? [els['view-order'], els['view-ledger']] : []
    },
    liff: { ready: Promise.resolve(), getContext: () => ctx, getAccessToken: () => 'eyJhbGciOiJIUzI1NiJ9.sandbox-token.sig' },
    fetch: async (url, opt) => { S.fetches.push({ url, opt }); return fetchImpl(url, opt, S); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context, { timeout: 5000 });
  return {
    S, ls, els, tabs, body,
    advance: ms => { offset += ms; },
    html: () => bodyHtml + S.listExtra,
    cards: () => count(bodyHtml + S.listExtra, 'class="ledger-order'),
    sync: () => ({ text: els['ledger-sync'].textContent, cls: els['ledger-sync'].className }),
    clickTab: async (i) => { tabs[i].listeners.click.forEach(f => f()); await tick(); },
    scrollBottom: async () => { const s = els['ledger-scroll']; s.scrollTop = s.scrollHeight - s.clientHeight; s.listeners.scroll.forEach(f => f({ currentTarget: s })); await tick(); },
    clickBody: async (selector) => { body.listeners.click.forEach(f => f({ target: { closest: q => (q === selector ? {} : null) } })); await tick(); }
  };
}
const jsonResp = (status, obj) => ({ ok: status >= 200 && status < 300, status, json: async () => obj });
function deferredSeq(first) {
  const calls = [];
  const impl = async () => {
    if (calls.length === 0) { calls.push(null); return jsonResp(200, first); }
    let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); calls.push({ res, rej }); return p;
  };
  return { impl, calls };
}
const okThenFail = (first) => { let n = 0; return async () => { n++; if (n === 1) return jsonResp(200, first); throw new Error('network down'); }; };

(async () => {
  // 1) 群外開啟：只提示、不打 API、不顯示任何金額
  {
    const e = makeEnv({ ctx: { type: 'utou', userId: UID }, fetchImpl: async () => jsonResp(200, payload(3)) });
    await e.clickTab(1);
    A(e.html().includes('請從分店群組開啟「我的叫貨」'), '群外: 要顯示請從分店群組開啟');
    A(e.S.fetches.length === 0, '群外: 不得呼叫 API');
    A(!e.html().includes('NT$'), '群外: 不得顯示金額');
    A(e.els['view-ledger'].classList.contains('active') && !e.els['view-order'].classList.contains('active'), '切分頁: 我的叫貨要顯示、叫貨頁要隱藏');
    await e.clickTab(0);
    A(e.els['view-order'].classList.contains('active') && !e.els['view-ledger'].classList.contains('active'), '切回叫貨: 叫貨頁要恢復');
    A(e.tabs[0].attrs['aria-selected'] === 'true' && e.tabs[1].attrs['aria-selected'] === 'false', '切回叫貨: aria-selected 要同步');
  }
  // 2) 名單內、有資料 23 張：合計、張數、固定小字、前 10 張、拉到底再 10 張、沒有更多；⛔不存手機
  {
    const e = makeEnv({ fetchImpl: async () => jsonResp(200, payload(23)) });
    await e.clickTab(1);
    const h = e.html();
    A(h.includes('NT$ 10,665'), '有資料: 合計 NT$ 10,665');
    A(h.includes('共 6 張單・不含已作廢'), '有資料: 張數文案');
    A(h.includes('※ 依叫貨單批發價估算，非正式請款'), '有資料: 固定小字');
    A(h.includes('🏬 沙鹿店'), '有資料: 店名以後端為準');
    A(e.cards() === 10, '有資料: 先畫 10 張, got=' + e.cards());
    A(h.includes('ledger-order void'), '有資料: 已作廢整張灰字刪線');
    A(h.includes('lo-status partial'), '有資料: 部分作廢標示');
    A(h.includes('lo-line void'), '有資料: 作廢品項刪線');
    A(h.includes('&lt;img src=x onerror=alert(1)&gt;') && !h.includes('<img src=x'), '有資料: 品名要跳脫（防 XSS）');
    A(!/<select|store-select|請選擇/.test(h), '有資料: ⛔不得有店別選單');
    A(e.els['ledger-more'].textContent.includes('還有 13 張'), '有資料: 提示還有 13 張');
    await e.scrollBottom();
    A(e.cards() === 20, '拉到底: 再載 10 張, got=' + e.cards());
    await e.scrollBottom();
    A(e.cards() === 23, '拉到底: 載完 23 張, got=' + e.cards());
    A(e.els['ledger-more'].textContent === '沒有更多了', '拉到底: 沒有更多了');
    const f = e.S.fetches[0];
    A(e.S.fetches.length === 1, '有資料: 只打一次 API');
    A(f && f.url === 'https://cxuan-line-advisor.fly.dev/liff/store-ledger', '有資料: API 網址固定、不帶任何參數');
    A(f && f.opt.method === 'POST' && /text\/plain/.test(f.opt.headers['Content-Type']), '有資料: POST text/plain（免預檢）');
    const sent = f ? JSON.parse(f.opt.body) : {};
    A(JSON.stringify(Object.keys(sent)) === '["accessToken"]', '有資料: 只送 accessToken，⛔不送店別/群組/userId');
    A(e.S.lsWrites === 0 && Object.keys(e.ls).length === 0, '⛔帳不得存進手機（LL-R1-01）');
    A(e.sync().text === '', '有資料: 同步完狀態列消失');
    // 同一次打開：1 分鐘內切回不重抓、照樣顯示
    await e.clickTab(0); await e.clickTab(1);
    A(e.S.fetches.length === 1 && e.html().includes('NT$ 10,665'), '同次打開: 1 分鐘內切回直接顯示、不重抓');
  }
  // 3) 手機裡若殘留舊版快取，也⛔不得拿出來顯示（金額一定等後端這次確認）
  {
    const old = JSON.stringify({ uid: 'x', savedAt: Date.now(), data: payload(3) });
    const e = makeEnv({ store: { cxuan_ledger_v1: old }, fetchImpl: async () => new Promise(() => {}) });
    await e.clickTab(1);
    A(!e.html().includes('NT$'), '殘留舊快取: 等後端確認前不得顯示金額');
    A(e.sync().text.includes('正在載入'), '殘留舊快取: 顯示正在載入');
  }
  // 4) 同次打開超過 1 分鐘：照樣顯示＋背景更新；更新失敗 → 小字警示、資料留著（10 分鐘內確認過）
  {
    const e = makeEnv({ fetchImpl: okThenFail(payload(3)) });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1); await tick(10);
    A(e.S.fetches.length === 2, '超過 1 分鐘: 背景更新');
    A(e.html().includes('NT$ 10,665'), '背景更新失敗: 10 分鐘內確認過的資料留著');
    A(e.sync().text.includes('資料可能不是最新') && e.sync().cls.includes('warn'), '背景更新失敗: 小字警示, got=' + e.sync().text);
    e.els['ledger-sync'].listeners.click.forEach(f => f()); await tick();
    A(e.S.fetches.length === 3, '背景更新失敗: 點警示列可重試');
  }
  // 5) 同次打開超過 10 分鐘：重新確認期間畫面不得有舊帳；失敗就只有錯誤畫面
  {
    const d = deferredSeq(payload(3));
    const e = makeEnv({ fetchImpl: d.impl });
    await e.clickTab(1);
    e.advance(11 * 60 * 1000);
    await e.clickTab(0); await e.clickTab(1);
    A(d.calls.length === 2, '超過 10 分鐘: 重新打 API');
    A(!e.html().includes('NT$') && e.sync().text.includes('正在載入'), '超過 10 分鐘: 重新確認期間不得顯示舊帳');
    d.calls[1].rej(new Error('network down')); await tick(10);
    A(e.html().includes('連不上帳務資料') && !e.html().includes('NT$'), '超過 10 分鐘＋失敗: 只有錯誤畫面');
  }
  // 6) 頁面停留跨月：上個月的帳不得當本月顯示（LL-R1-04）
  {
    const d = deferredSeq(payload(3));
    const e = makeEnv({ fetchImpl: d.impl });
    await e.clickTab(1);
    A(e.html().includes('NT$ 10,665'), '跨月前: 有資料');
    e.advance(msToNextTaipeiMonth() + 10 * 1000); // 跨到下個月 1 號 00:00:10
    await e.clickTab(0); await e.clickTab(1);
    A(d.calls.length === 2, '跨月: 立刻重抓');
    A(!e.html().includes('NT$'), '跨月: 重新確認期間不得顯示上月金額');
    d.calls[1].rej(new Error('network down')); await tick(10);
    A(!e.html().includes('NT$') && e.html().includes('連不上帳務資料'), '跨月＋更新失敗: 不得保留上月金額');
  }
  // 6b) 背景更新途中超過 10 分鐘才失敗：不得留著過期的帳
  {
    const d = deferredSeq(payload(3));
    const e = makeEnv({ fetchImpl: d.impl });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1);
    A(d.calls.length === 2 && e.html().includes('NT$ 10,665'), '背景更新中: 10 分鐘內確認過的資料照樣顯示');
    e.advance(10 * 60 * 1000);
    d.calls[1].rej(new Error('network down')); await tick(10);
    A(!e.html().includes('NT$') && e.html().includes('連不上帳務資料'), '更新途中過期又失敗: 清掉金額');
  }
  // 7) 不在名單 403／驗證失敗 401：只一句話、無金額；同次打開中被移出名單也立刻清掉
  for (const st of [403, 401]) {
    const e = makeEnv({ fetchImpl: async () => jsonResp(st, { ok: false, code: 'forbidden', message: '無權限，請從分店群組開啟或聯絡總部' }) });
    await e.clickTab(1); await tick(10);
    A(e.html().includes('無權限，請從分店群組開啟或聯絡總部'), st + ': 顯示無權限');
    A(!e.html().includes('NT$'), st + ': 不得有任何金額');
  }
  {
    let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(3)) : jsonResp(403, { ok: false, code: 'forbidden', message: '無權限，請從分店群組開啟或聯絡總部' }); } });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1); await tick(10);
    A(e.html().includes('無權限') && !e.html().includes('NT$'), '同次打開中被移出名單: 立刻清掉金額');
    A(e.sync().text === '', '被移出名單: 狀態列清空');
    const before = e.S.fetches.length;
    await e.clickTab(0); await e.clickTab(1); await tick(10);
    A(e.S.fetches.length === before + 1, '被移出名單後再切回: 記憶體也清了，必須重新確認');
  }
  // 8) 連不上（第一次）：錯誤畫面＋重試鈕；逾時寫連線逾時；重試成功顯示資料
  {
    let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; if (n === 1) { const er = new Error('aborted'); er.name = 'AbortError'; throw er; } return jsonResp(200, payload(2)); } });
    await e.clickTab(1); await tick(10);
    A(e.html().includes('連不上帳務資料') && e.html().includes('連線逾時') && e.html().includes('data-ledger-retry'), '連不上: 錯誤畫面含逾時與重試鈕');
    A(!e.html().includes('NT$'), '連不上: 無金額');
    await e.clickBody('[data-ledger-retry]'); await tick(10);
    A(e.html().includes('NT$ 10,665'), '連不上→重試: 成功後顯示資料');
  }
  // 9) 後端 503（有訊息）：用後端訊息
  {
    const e = makeEnv({ fetchImpl: async () => jsonResp(503, { ok: false, code: 'unavailable', message: '帳務資料暫時讀不到，請稍後再試' }) });
    await e.clickTab(1); await tick(10);
    A(e.html().includes('帳務資料暫時讀不到，請稍後再試'), '503: 顯示後端訊息');
  }
  // 10) 空狀態
  {
    const e = makeEnv({ fetchImpl: async () => jsonResp(200, payload(0, { store: '西屯店', total: 0, orderCount: 0, voidedOrderCount: 0 })) });
    await e.clickTab(1); await tick(10);
    A(e.html().includes('本月尚無叫貨單') && e.html().includes('NT$ 0') && e.html().includes('共 0 張單'), '空狀態: 文案與 0 元');
  }
  // 11) 後端標 stale：狀態列警示
  {
    const e = makeEnv({ fetchImpl: async () => jsonResp(200, payload(2, { stale: true })) });
    await e.clickTab(1); await tick(10);
    A(e.sync().text.includes('總部資料暫時無法更新'), 'stale: 狀態列警示');
  }

  if (fails.length) { console.log('FAIL ' + fails.length + ' 條:'); fails.forEach(f => console.log('  ✗ ' + f)); }
  console.log((fails.length ? 'RESULT: FAIL' : 'RESULT: PASS') + ' (' + passes + ' assertions)');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.log('TESTERR ' + e.stack); process.exit(1); });
