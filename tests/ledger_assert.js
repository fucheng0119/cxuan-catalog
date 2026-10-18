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
  return Object.assign({ ok: true, store: '沙鹿店', month: MONTH, asOf: `${MONTH}-18T17:30:00+08:00`, stale: false, total: 10665, orderCount: 6, voidedOrderCount: 1, reviewLineCount: 0, undatedRowCount: 0, orders, listLimit: 60, listTruncated: false,
    payable: { state: 'ok', goods: 563674, posted: 563674, pendingKnown: 0, unknownCount: 2, taxMixedCount: 0, duplicateCount: 0, cutoff: `${MONTH}-16T22:33:13+08:00`, stale: false, readAt: `${MONTH}-18T22:30:00+08:00` } }, extra || {});
}

function makeEnv({ ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID }, store = {}, fetchImpl } = {}) {
  const S = { fetches: [], listExtra: '', lsWrites: 0, loggedIn: true };
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
  const longTimers = new Map(); let timerSeq = 0; const intervals = []; const docListeners = {};
  const fakeSetTimeout = (fn, ms, ...a) => {
    if (ms >= 10000) { const id = 'L' + (++timerSeq); longTimers.set(id, { fn, ms }); return id; }
    return setTimeout(fn, ms, ...a);
  };
  const fakeClearTimeout = id => { if (typeof id === 'string' && longTimers.has(id)) longTimers.delete(id); else clearTimeout(id); };
  const context = {
    console: { log() {}, warn() {}, error() {} }, setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval() {},
    AbortController, Promise, JSON, Date: FakeDate, Math, Number, String, Array, Object, Error,
    localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { S.lsWrites++; ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
    document: {
      getElementById: id => {
        if (id === 'ledger-list') return bodyHtml.includes('id="ledger-list"') ? list : null;
        if (id === 'ledger-more') return bodyHtml.includes('id="ledger-more"') ? els['ledger-more'] : null;
        return els[id] || null;
      },
      querySelectorAll: sel => sel === '.main-tab' ? tabs : sel === '.view' ? [els['view-order'], els['view-ledger']] : [],
      addEventListener: (t, f) => { (docListeners[t] = docListeners[t] || []).push(f); },
      visibilityState: 'visible'
    },
    liff: { ready: Promise.resolve(), getContext: () => ctx, isLoggedIn: () => S.loggedIn, getAccessToken: () => 'eyJhbGciOiJIUzI1NiJ9.sandbox-token.sig' },
    fetch: async (url, opt) => { S.fetches.push({ url, opt }); return fetchImpl(url, opt, S); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context, { timeout: 5000 });
  return {
    S, ls, els, tabs, body,
    advance: ms => { offset += ms; },
    fireLong: (ms) => { for (const [id, t] of [...longTimers]) if (t.ms === ms) { longTimers.delete(id); t.fn(); } },
    fireIntervals: async () => { intervals.forEach(i => i.fn()); await tick(); },
    fireVisible: async () => { (docListeners.visibilitychange || []).forEach(f => f()); await tick(); },
    setCtx: c => { Object.keys(ctx).forEach(k => delete ctx[k]); Object.assign(ctx, c); },
    setLoggedIn: v => { S.loggedIn = v; },
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
  // 1) 階段 1b：群外（一對一、電腦版）也能看自己店；只有 LINE 沒登入完成才擋、不打 API
  {
    const e = makeEnv({ ctx: { type: 'utou', userId: UID }, fetchImpl: async () => jsonResp(200, payload(3)) });
    await e.clickTab(1); await tick(10);
    A(e.S.fetches.length === 1 && e.html().includes('NT$ 563,674'), '群外也能看: 一對一打開照樣打 API、顯示自己店');
    A(!e.html().includes('請從分店群組開啟'), '群外也能看: 不再出現群組限定提示');
    A(e.els['view-ledger'].classList.contains('active') && !e.els['view-order'].classList.contains('active'), '切分頁: 我的叫貨要顯示、叫貨頁要隱藏');
    await e.clickTab(0);
    A(e.els['view-order'].classList.contains('active') && !e.els['view-ledger'].classList.contains('active'), '切回叫貨: 叫貨頁要恢復');
    A(e.tabs[0].attrs['aria-selected'] === 'true' && e.tabs[1].attrs['aria-selected'] === 'false', '切回叫貨: aria-selected 要同步');
    const n = makeEnv({ fetchImpl: async () => jsonResp(200, payload(3)) });
    n.setLoggedIn(false);
    await n.clickTab(1);
    A(n.S.fetches.length === 0 && !n.html().includes('NT$') && n.html().includes('LINE 登入還沒完成'), '沒登入: 只提示、不打 API、無金額');
  }
  // 2) 名單內、有資料 23 張：合計、張數、固定小字、前 10 張、拉到底再 10 張、沒有更多；⛔不存手機
  {
    const e = makeEnv({ fetchImpl: async () => jsonResp(200, payload(23)) });
    await e.clickTab(1);
    const h = e.html();
    A(h.includes('NT$ 10,665'), '有資料: 合計 NT$ 10,665');
    A(h.includes('本月叫貨貨款（模擬帳）') && h.includes('NT$ 563,674'), '有資料: 主數字＝模擬帳本月貨款');
    A(h.includes('已列帳 NT$ 563,674・待入帳已知 NT$ 0'), '有資料: 已列帳／待入帳已知');
    A(h.includes('另有 2 筆待帳金額未明，尚未加計'), '有資料: 待帳金額未明提示');
    A(h.includes('模擬帳資料讀至 10/16 22:33'), '有資料: 模擬帳讀至時間');
    A(h.includes('※ 依模擬帳估算，不含廣告費與發票稅金；正式應付以明珠核對為準'), '有資料: 固定小字');
    A(h.includes('其中用 LIFF 叫的：6 張・NT$ 10,665（不含已作廢）'), '有資料: LIFF 叫貨為輔');
    A(h.includes('LIFF 叫貨紀錄（只含用 LIFF 下的單）'), '有資料: 明細標題寫清楚只含 LIFF');
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
  // R1-04b) 月底 23:59:30 載入、40 秒後（未滿 1 分鐘）跨月再切回：也要清掉上月帳重新確認
  {
    const pend = []; let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(3)) : new Promise((a, b) => pend.push({ a, b })); } });
    e.advance(msToNextTaipeiMonth() - 30 * 1000);
    await e.clickTab(1);
    A(e.html().includes('NT$ 10,665'), 'R1-04b: 月底最後 30 秒有資料');
    e.advance(40 * 1000);
    await e.clickTab(0); await e.clickTab(1);
    A(!e.html().includes('NT$') && n === 2, 'R1-04b: 未滿 1 分鐘跨月也清掉並重新確認');
  }
  // R2-01) 背景更新失敗後過了 10 分鐘才點警示列重試：重新確認期間不得顯示舊帳（跨月同）
  for (const kind of ['expire', 'month']) {
    let n = 0; const pend = [];
    const e = makeEnv({ fetchImpl: async () => { n++; if (n === 1) return jsonResp(200, payload(3)); if (n === 2) throw new Error('network down'); return new Promise((a, b) => pend.push({ a, b })); } });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1); await tick(10);
    A(e.sync().text.includes('資料可能不是最新'), 'R2-01 ' + kind + ': 先有小字警示');
    e.advance(kind === 'expire' ? 10 * 60 * 1000 : msToNextTaipeiMonth() + 5000);
    e.els['ledger-sync'].listeners.click.forEach(f => f()); await tick();
    A(e.S.fetches.length === 3, 'R2-01 ' + kind + ': 點警示列有重打');
    A(!e.html().includes('NT$'), 'R2-01 ' + kind + ': 重新確認期間不得顯示舊帳');
  }
  // R2-02) 舊請求晚到：清空後回來的 200 不得把金額畫回來
  {
    const pend = [];
    const ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID };
    const e = makeEnv({ ctx, fetchImpl: async () => new Promise((a, b) => pend.push({ a, b })) });
    await e.clickTab(1);
    A(pend.length === 1, 'R2-02: 第一個請求發出');
    e.setLoggedIn(false);
    await e.clickTab(0); await e.clickTab(1);
    A(e.html().includes('LINE 登入還沒完成'), 'R2-02: 清空後顯示提示');
    pend[0].a(jsonResp(200, payload(3))); await tick(10);
    A(!e.html().includes('NT$') && e.html().includes('LINE 登入還沒完成'), 'R2-02: 舊請求晚到不得畫回金額');
  }
  // R2-02b) 群組不變：背景更新 A 進行中→過期被清空、新請求 B 回 403→A 才晚到 200，不得把金額畫回來
  {
    const pend = []; let n = 0;
    const e = makeEnv({ fetchImpl: async () => {
      n++;
      if (n === 1) return jsonResp(200, payload(3));
      if (n === 2) return new Promise((a, b) => pend.push({ a, b }));
      return jsonResp(403, { ok: false, code: 'forbidden', message: '無權限，請從分店群組開啟或聯絡總部' });
    } });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1);
    A(n === 2 && pend.length === 1, 'R2-02b: 背景更新 A 已發出');
    e.advance(10 * 60 * 1000);
    await e.fireIntervals(); await tick(10);
    A(n === 3 && e.html().includes('無權限'), 'R2-02b: 過期清空後新請求 B 回 403');
    pend[0].a(jsonResp(200, payload(3))); await tick(10);
    A(!e.html().includes('NT$') && e.html().includes('無權限'), 'R2-02b: A 晚到的 200 不得把金額畫回來');
  }
  // R2-03a) 月底發出、隔月才到的回應：不畫上月帳，重抓一次；重抓仍不同（手機時鐘不準）就採後端、不無限重抓
  {
    const prev = (() => { const d = new Date(Date.now() + 8 * 3600e3); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
    let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(3, { month: prev, total: 999 })) : jsonResp(200, payload(3)); } });
    await e.clickTab(1); await tick(10);
    A(n === 2, 'R2-03a: 跨月回應要重抓一次, got=' + n);
    A(!e.html().includes('NT$ 999') && e.html().includes('NT$ 10,665'), 'R2-03a: 只畫本月帳');
    let m = 0;
    const e2 = makeEnv({ fetchImpl: async () => { m++; return jsonResp(200, payload(3, { month: prev, total: 999 })); } });
    await e2.clickTab(1); await tick(20);
    A(m === 2, 'R2-03a: 重抓仍不同只重抓一次, got=' + m);
    A(!e2.html().includes('NT$') && e2.html().includes('無法確認本月月份') && e2.html().includes('data-ledger-retry'), 'R3-02: 重抓仍不同＝清空並提示確認手機日期時間、不顯示金額');
  }
  // R2-03b) 停在本頁跨月（沒有點分頁）：定時檢查或切回前景就清掉上月帳並重新確認
  for (const how of ['interval', 'visible']) {
    const pend = [];
    let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(3)) : new Promise((a, b) => pend.push({ a, b })); } });
    await e.clickTab(1);
    A(e.html().includes('NT$ 10,665'), 'R2-03b ' + how + ': 跨月前有資料');
    e.advance(msToNextTaipeiMonth() + 5000);
    if (how === 'interval') await e.fireIntervals(); else await e.fireVisible();
    A(!e.html().includes('NT$'), 'R2-03b ' + how + ': 跨月後清掉上月帳');
    A(n === 2, 'R2-03b ' + how + ': 人在本頁就重新確認');
  }
  // R2-04) 403 標頭一到就清（本文卡住也一樣）；200 本文卡住 → 60 秒逾時涵蓋讀本文、之後可再重試
  {
    let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(3)) : { ok: false, status: 403, json: () => new Promise(() => {}) }; } });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1); await tick(10);
    A(!e.html().includes('NT$') && e.html().includes('無權限'), 'R2-04: 403 本文卡住也立刻清掉金額');
    const hang = makeEnv({ fetchImpl: async (url, opt) => ({ ok: true, status: 200, json: () => new Promise((a, b) => { opt.signal.addEventListener('abort', () => { const er = new Error('aborted'); er.name = 'AbortError'; b(er); }); }) }) });
    await hang.clickTab(1);
    A(hang.sync().text.includes('正在載入'), 'R2-04: 本文卡住時還在載入');
    hang.fireLong(60000); await tick(10);
    A(hang.html().includes('連線逾時') && hang.html().includes('data-ledger-retry'), 'R2-04: 60 秒逾時涵蓋讀本文，顯示可重試');
    await hang.clickBody('[data-ledger-retry]');
    A(hang.S.fetches.length === 2, 'R2-04: 逾時後沒有卡死、可以再重試');
  }
  // R3-01) 情境變成群外後：定時檢查、回到前景、警示列、晚到的回應都不得打 API 或畫出金額
  {
    const pend = []; let n = 0;
    const ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID };
    const e = makeEnv({ ctx, fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(3)) : new Promise((a, b) => pend.push({ a, b })); } });
    await e.clickTab(1);
    A(e.html().includes('NT$ 10,665'), 'R3-01: 群內有資料');
    e.setLoggedIn(false);
    await e.fireIntervals();
    A(!e.html().includes('NT$') && e.html().includes('LINE 登入還沒完成') && n === 1, 'R3-01: 定時檢查發現群外＝立刻清掉、不打 API');
    e.advance(11 * 60 * 1000);
    await e.fireVisible();
    e.els['ledger-sync'].listeners.click.forEach(f => f()); await tick();
    A(n === 1 && !e.html().includes('NT$'), 'R3-01: 群外時回到前景／警示列都不打 API, n=' + n);
  }
  {
    const pend = [];
    const ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID };
    const e = makeEnv({ ctx, fetchImpl: async () => new Promise((a, b) => pend.push({ a, b })) });
    await e.clickTab(1);
    e.setLoggedIn(false);
    pend[0].a(jsonResp(200, payload(3))); await tick(10);
    A(!e.html().includes('NT$') && e.html().includes('LINE 登入還沒完成'), 'R3-01: 回應落地前情境已不是群組＝不畫金額');
  }
  {
    let n = 0;
    const ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID };
    const e = makeEnv({ ctx, fetchImpl: async () => { n++; if (n === 2) throw new Error('network down'); return jsonResp(200, payload(3)); } });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1); await tick(10);
    A(e.sync().cls.includes('warn') && e.html().includes('NT$'), 'R3-01b: 背景更新失敗，警示列亮著、資料留著');
    e.setLoggedIn(false);
    e.els['ledger-sync'].listeners.click.forEach(f => f()); await tick(10);
    A(n === 2 && !e.html().includes('NT$') && e.html().includes('LINE 登入還沒完成'), 'R3-01b: 群外點警示列＝不打 API、清掉金額, n=' + n);
  }
  // R4-01a) 群內載入 23 張後情境變群外：拉到底或點「載入更多」都不得再加金額
  for (const how of ['scroll', 'tap']) {
    let n = 0;
    const ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID };
    const e = makeEnv({ ctx, fetchImpl: async () => { n++; return jsonResp(200, payload(23)); } });
    await e.clickTab(1);
    A(e.cards() === 10, 'R4-01a ' + how + ': 先有 10 張');
    e.setLoggedIn(false);
    if (how === 'scroll') await e.scrollBottom(); else await e.clickBody('.ledger-more.tap');
    A(e.cards() === 0 && !e.html().includes('NT$') && e.html().includes('LINE 登入還沒完成') && n === 1, 'R4-01a ' + how + ': 群外不追加、清掉金額、不打 API');
  }
  // R4-01b) 背景更新進行中變群外、接著更新失敗：不得保留金額
  {
    const pend = []; let n = 0;
    const ctx = { type: 'group', groupId: 'C6fe1a185ee49446104b177bf963fcba4', userId: UID };
    const e = makeEnv({ ctx, fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(3)) : new Promise((a, b) => pend.push({ a, b })); } });
    await e.clickTab(1);
    e.advance(61 * 1000);
    await e.clickTab(0); await e.clickTab(1);
    e.setLoggedIn(false);
    pend[0].b(new Error('network down')); await tick(10);
    A(!e.html().includes('NT$') && e.html().includes('LINE 登入還沒完成'), 'R4-01b: 群外時更新失敗＝清掉金額、不留警示');
  }
  // R4-01c) 跨月後（還沒輪到定時檢查）拉到底：不追加上月帳，清掉並重新確認
  {
    const pend = []; let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; return n === 1 ? jsonResp(200, payload(23)) : new Promise((a, b) => pend.push({ a, b })); } });
    await e.clickTab(1);
    e.advance(msToNextTaipeiMonth() + 5000);
    await e.scrollBottom();
    A(e.cards() === 0 && !e.html().includes('NT$') && n === 2, 'R4-01c: 跨月後拉到底＝不追加、清掉、重新確認, n=' + n);
  }
  // R3-03) 跨月重抓的狀態只屬於同一次更新流程：中途被 403 結束，重新開啟後第一筆跨月回應仍要重抓
  {
    const prev = (() => { const d = new Date(Date.now() + 8 * 3600e3); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
    let n = 0;
    const e = makeEnv({ fetchImpl: async () => {
      n++;
      if (n === 1 || n === 3) return jsonResp(200, payload(3, { month: prev, total: 999 }));
      if (n === 2) return jsonResp(403, { ok: false, code: 'forbidden', message: '無權限，請從分店群組開啟或聯絡總部' });
      return jsonResp(200, payload(3));
    } });
    await e.clickTab(1); await tick(10);
    A(n === 2 && e.html().includes('無權限'), 'R3-03: 第一次流程跨月重抓後被 403 結束');
    await e.clickBody('[data-ledger-retry]'); // 無權限畫面沒有重試鈕，改用重新切分頁開新流程
    await e.clickTab(0); await e.clickTab(1); await tick(10);
    A(n === 4, 'R3-03: 新流程第一筆跨月回應也要重抓一次, n=' + n);
    A(e.html().includes('NT$ 10,665') && !e.html().includes('NT$ 999'), 'R3-03: 只畫本月帳');
  }
  // 1b-1) 模擬帳讀取中：先顯示 LIFF 合計並說明；20 秒後自動再抓，讀到就換模擬帳主數字；一直讀取中最多再抓 3 次
  {
    let n = 0;
    const e = makeEnv({ fetchImpl: async () => { n++; return jsonResp(200, n < 3 ? payload(3, { payable: { state: 'loading' } }) : payload(3)); } });
    await e.clickTab(1); await tick(10);
    A(e.html().includes('用 LIFF 叫的（只含用 LIFF 下的單）') && e.html().includes('NT$ 10,665') && e.html().includes('模擬帳讀取中，稍後自動更新'), '1b 讀取中: 先顯示 LIFF 合計並說明');
    A(!e.html().includes('NT$ 563,674'), '1b 讀取中: 不掰模擬帳數字');
    e.fireLong(20000); await tick(10);
    A(n === 2 && e.html().includes('模擬帳讀取中'), '1b 讀取中: 20 秒後自動再抓（仍讀取中）');
    e.fireLong(20000); await tick(10);
    A(n === 3 && e.html().includes('NT$ 563,674') && e.html().includes('本月叫貨貨款（模擬帳）'), '1b 讀取中: 讀到就換成模擬帳主數字');
    e.fireLong(20000); await tick(10);
    A(n === 3, '1b 讀取中: 讀到後不再自動抓');
    let m = 0;
    const always = makeEnv({ fetchImpl: async () => { m++; return jsonResp(200, payload(3, { payable: { state: 'loading' } })); } });
    await always.clickTab(1); await tick(10);
    for (let i = 0; i < 5; i++) { always.fireLong(20000); await tick(10); }
    A(m === 4, '1b 讀取中: 一直讀取中最多再抓 3 次, m=' + m);
    let k = 0;
    const lost = makeEnv({ fetchImpl: async () => { k++; return jsonResp(200, payload(3, { payable: { state: 'loading' } })); } });
    await lost.clickTab(1); await tick(10);
    lost.setLoggedIn(false);
    await lost.fireIntervals();
    lost.fireLong(20000); await tick(10);
    A(k === 1 && !lost.html().includes('NT$'), '1b 讀取中: 登入失效清空後不再自動抓');
  }
  // 1b-2) 模擬帳未開帳／讀不到／底帳待補：只顯示 LIFF 合計並寫清楚原因
  for (const [pay, label] of [[{ state: 'unconfigured' }, '本月模擬帳還沒開帳'], [{ state: 'unavailable' }, '模擬帳暫時讀不到'],
    [{ state: 'unmapped' }, '模擬帳暫時讀不到'], [{ state: 'ok', goods: null, posted: null, pendingKnown: 0, unknownCount: 0, taxMixedCount: 0, duplicateCount: 0, cutoff: null, stale: false }, '模擬帳本月底帳待補']]) {
    const e = makeEnv({ fetchImpl: async () => jsonResp(200, payload(3, { payable: pay })) });
    await e.clickTab(1); await tick(10);
    A(e.html().includes(label) && e.html().includes('完整叫貨帳以模擬帳為準') && e.html().includes('用 LIFF 叫的（只含用 LIFF 下的單）'), '1b ' + label);
    A(e.S.fetches.length === 1, '1b ' + label + ': 不自動重抓');
  }
  // 1b-3) 模擬帳超過 48 小時沒更新、含稅待拆、疑似重複：都要提醒
  {
    const e = makeEnv({ fetchImpl: async () => jsonResp(200, payload(3, { payable: { state: 'ok', goods: 615908, posted: 460116, pendingKnown: 155792, unknownCount: 0, taxMixedCount: 1, duplicateCount: 1, cutoff: `${MONTH}-16T22:33:13+08:00`, stale: true, readAt: `${MONTH}-18T22:30:00+08:00` } })) });
    await e.clickTab(1); await tick(10);
    const h = e.html();
    A(h.includes('NT$ 615,908') && h.includes('已列帳 NT$ 460,116・待入帳已知 NT$ 155,792'), '1b 嘉義型: 已列帳＋待入帳已知');
    A(h.includes('模擬帳超過 48 小時沒更新') && h.includes('含稅費尚待拆分') && h.includes('疑似已列帳'), '1b: stale／含稅／疑似重複都要提醒');
    A(!h.includes('待帳金額未明'), '1b: 沒有未明金額就不提');
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
    A(e.html().includes('本月還沒有用 LIFF 叫貨') && e.html().includes('NT$ 563,674') && e.html().includes('其中用 LIFF 叫的：0 張・NT$ 0'), '空狀態: 模擬帳照顯示、LIFF 0 張');
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
