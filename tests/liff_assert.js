// 用法: node liff_assert.js <html路徑> <branch|wh>
// LIFF v5 Phase A 離線斷言；所有 fetch 都被 mock，絕不接真 webhook。
const fs = require('fs');
const vm = require('vm');
const { webcrypto } = require('crypto');
const { TextEncoder } = require('util');
const [,, PATH, KIND] = process.argv;
if (!PATH || !['branch', 'wh'].includes(KIND)) {
  console.error('usage: node liff_assert.js <html> <branch|wh>');
  process.exit(2);
}

const src = fs.readFileSync(PATH, 'utf8');
const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let code = blocks[blocks.length - 1];

const storage = new Map();
const elements = new Map();
function classList() {
  const set = new Set();
  return { add:v=>set.add(v), remove:v=>set.delete(v), contains:v=>set.has(v), toggle(v,on){ on ? set.add(v) : set.delete(v); } };
}
function element(id='') {
  if (!elements.has(id)) elements.set(id, {
    id, innerHTML:'', textContent:'', value:'', disabled:false, style:{}, dataset:{cat:'hot'},
    classList:classList(), addEventListener(){}, appendChild(){}, remove(){}, closest(){return null;},
    querySelector(){return null;}, querySelectorAll(){return [];}
  });
  return elements.get(id);
}
const activeTab = element('active-tab');
activeTab.dataset.cat = 'hot';
const submitBtn = element('submit-btn');
const magic = () => new Proxy(function(){}, {
  get:(t,k)=>{
    if (k === 'classList') return classList();
    if (k === 'dataset') return {cat:'hot'};
    if (k === 'value' || k === 'textContent' || k === 'innerHTML') return '';
    if (k === 'length') return 0;
    if (k === Symbol.toPrimitive) return () => '';
    return magic();
  }, set:()=>true, apply:()=>magic()
});

const BASE_PRODUCT = {cx:'cx1', name:'四十字完整測試濾心名稱－不得截斷', vendor:'測商', cost:100, retail:200};
let webhookMode = 'ok';
let priceMode = 'ok';
let freshProducts = [{...BASE_PRODUCT}];
const S = {toasts:[], calls:[], bodies:[], echoes:0, fails:[], passes:0, v5Passes:0};

const ctx = {
  console:{log(){},warn(){},error(){},__real:(...a)=>process.stdout.write(a.join(' ')+'\n')},
  setTimeout, clearTimeout, AbortController, URLSearchParams, TextEncoder, crypto:webcrypto,
  navigator:{}, location:{search:''},
  localStorage:{
    getItem:k=>storage.has(k)?storage.get(k):null,
    setItem:(k,v)=>storage.set(k,String(v)),
    removeItem:k=>storage.delete(k),
    clear:()=>storage.clear()
  },
  document:{
    getElementById:id=>element(id),
    querySelector:sel=>{
      if (sel.includes('btn-confirm')) return submitBtn;
      if (sel === '.cat-tab.active' || sel.includes('data-cat="hot"')) return activeTab;
      return magic();
    },
    querySelectorAll:()=>[], addEventListener(){}, createElement:()=>element('created-'+Math.random())
  },
  liff:{
    init:()=>Promise.resolve(), isInClient:()=>true, isLoggedIn:()=>true, login(){}, closeWindow(){},
    getContext:()=>KIND==='branch'
      ? {type:'group',groupId:'Caf25eb0528c9f66eb8935550b5742453'}
      : {type:'group',groupId:'Cb7c923a5177ebc313074092e03e86169'},
    getProfile:()=>Promise.resolve({displayName:'測試者',userId:'U-test'}),
    sendMessages:()=>{S.echoes++;return Promise.resolve();}
  },
  fetch:async(url,opt={})=>{
    if (!String(url).includes('hook.us2.make.com')) {
      if (priceMode === 'fail') throw new Error('price api down');
      return {ok:true,status:200,json:async()=>({products:freshProducts.map(x=>({...x}))})};
    }
    const body = String(opt.body || '');
    const payload = JSON.parse(body);
    S.calls.push({mode:webhookMode,payload});
    S.bodies.push(body);
    if (webhookMode === 'throw' || webhookMode === 'acklost') throw new Error('network down after send');
    if (webhookMode === 'timeout') { const e=new Error('aborted'); e.name='AbortError'; throw e; }
    if (webhookMode === 'http500') return {ok:false,status:500,json:async()=>({})};
    if (webhookMode === 'legacy') return {ok:true,status:200,json:async()=>{throw new Error('Accepted')}};
    if (webhookMode === 'weird') return {ok:true,status:200,json:async()=>({foo:1})};
    if (webhookMode === 'dup') return {ok:true,status:200,json:async()=>({status:'duplicate',orderId:payload.orderId})};
    if (webhookMode === 'held') return {ok:true,status:200,json:async()=>({status:'held',orderId:payload.orderId,blockedItems:[{itemIndex:0,cx:'cx1',name:BASE_PRODUCT.name,reason:'empty_dest'}]})};
    if (webhookMode === 'over_cap') return {ok:true,status:200,json:async()=>({status:'over_cap',orderId:payload.orderId,serverTotalMinor:50000001,capMinor:50000000})};
    if (webhookMode === 'stale') return {ok:true,status:200,json:async()=>({status:'stale_price',orderId:payload.orderId,serverTotalMinor:20001,declaredTotalMinor:20000})};
    if (webhookMode === 'preflight') return {ok:true,status:200,json:async()=>({status:'preflight_unavailable',orderId:payload.orderId})};
    return {ok:true,status:200,json:async()=>({status:'ok',orderId:payload.orderId})};
  },
  window:null, confirm:()=>true,
  __S:S, __src:src, __storage:storage,
  __setWebhook:m=>{webhookMode=m;},
  __setPrice:m=>{priceMode=m;},
  __setFresh:list=>{freshProducts=list.map(x=>({...x}));}
};
ctx.window = ctx;

code += `
;(async()=>{
  await new Promise(r=>setTimeout(r,60));
  const A=(cond,msg)=>{ if(cond) __S.passes++; else __S.fails.push(msg); };
  const V=(cond,msg)=>{ if(cond){__S.passes++;__S.v5Passes++;} else __S.fails.push('v5 '+msg); };
  const modal=()=>document.getElementById('modal-content').innerHTML;
  const title=()=>document.getElementById('modal-title').textContent;
  const lastToast=()=>__S.toasts[__S.toasts.length-1]||'';
  showToast=(m)=>{__S.toasts.push(String(m));};
  window.confirm=()=>true;

  const reset=()=>{
    Object.keys(cart).forEach(k=>delete cart[k]);
    pendingOrderId=null; pendingSnapshot=null; draftNote=''; submitting=false;
    __storage.clear(); __S.toasts.length=0; __S.calls.length=0; __S.bodies.length=0;
    products.length=0; products.push({...${JSON.stringify(BASE_PRODUCT)}});
    __setFresh([{...${JSON.stringify(BASE_PRODUCT)}}]); __setPrice('ok'); __setWebhook('ok');
    document.getElementById('note').value='';
    document.getElementById('modal-content').innerHTML='';
    document.getElementById('modal-title').textContent='';
    ${KIND==='branch' ? "currentGroupId='Caf25eb0528c9f66eb8935550b5742453';currentBranch={name:'楠梓店',short:'楠梓'};" : ''}
    updateCart();
  };
  const seed=(qty=2,note='測試地址\\n電話 0912-000-000')=>{
    reset(); cart.cx1=qty; draftNote=note; document.getElementById('note').value=note; updateCart();
  };

  const vendorCases=[['3M',true],['舒萬諾',true],['Solventum',true],['盛智_3m商用/中部倉管',false],['家享/澄軒客服',false]];
  for (const [vendor,expected] of vendorCases) A(isRetiredSolventumProduct({vendor})===expected,'退場供應商判斷 '+vendor);
  V(filterOrderableProducts([{vendor:'測商',cost:'7,035.00'}]).length===1,'千分位合法價不得被下架');

  V(!/slice\\(0,\\s*18\\)/.test(__src),'完整品名不得 slice(0,18)');
  V(__src.includes("const CLIENT_VERSION = 'liff-v5'"),'clientVersion 常數');
  V(__src.includes('totalDeclaredMinor'),'payload minor 欄');
  V(__src.includes('itemIndex'),'itemIndex 欄');
  V(__src.includes("cache: 'no-store'"),'確認前 no-store 重抓');
  V(__src.includes('needs_reconciliation'),'duplicate 核對態');
  V(__src.includes('preflight_unavailable'),'預檢錯誤態');
  V(!__src.includes('UNLOCK_ADMINS'),'不得有前端管理員解鎖名單');
  V(__src.includes('本單未寫入帳表、未通知廠商'),'held 誠實文案');
  V(__src.includes('payloadHash')&&!__src.includes('adminUserId'),'journal 最小化');
  V(${KIND==='branch' ? "!__src.includes('store-select')" : "true"},'分店端不得有手選店別');
  V(${KIND==='branch' ? "__src.includes('BRANCH_CAP_MINOR = 30000000')" : "__src.includes('WAREHOUSE_CAP_MINOR = 50000000')"},'金額上限常數');

  V(moneyToMinor(1812.5)===181250,'1812.5');
  V(moneyToMinor(0.01)===1,'0.01');
  V(moneyToMinor('7,035.00')===703500,'千分位');
  for (const bad of [1812.505,NaN,-1,0]) { let threw=false; try{moneyToMinor(bad);}catch(_){threw=true;} V(threw,'bad price '+bad); }
  seed(); setQty('cx1',1000); V(cart.cx1===999,'qty 上限 999');
  qtyModalValue=998; qtyOp(10); V(qtyModalValue===999,'數字鍵盤上限 999');

  seed(); openConfirm();
  V(!!pendingOrderId&&modal().includes(pendingOrderId),'確認頁顯示訂單號');
  V(modal().includes(${JSON.stringify(BASE_PRODUCT.name)}),'確認頁完整品名');
  V(modal().includes('單價 $100')&&modal().includes('小計 $200'),'單價與小計');
  V(modal().includes('批發合計（E）')&&modal().includes('$200'),'E 合計');
  document.getElementById('note').value='保留這行\\n以及地址';
  confirmAdjust('cx1',1);
  V(draftNote==='保留這行\\n以及地址','調數量保留備註逐字');
  V(modal().includes('保留這行')&&modal().includes('以及地址'),'重建確認頁保留備註');
  ${KIND==='wh' ? "V(modal().includes('總部成本 Σ≤50 萬')&&!modal().includes('總部成本 $'),'倉管只顯示後端 D 上限說明');" : ''}

  ${KIND==='branch' ? `seed(); currentBranch=null; updateCart(); const c0=__S.calls.length; openConfirm(); await submitOrder();
  V(document.getElementById('send-btn').disabled===true,'未登錄群 send disabled');
  V(__S.calls.length===c0,'未登錄群零 webhook');
  V(lastToast().includes('禁止送單'),'未登錄群阻擋文案');` : ''}

  seed(); openConfirm(); __setPrice('fail'); const pf0=__S.calls.length; await submitOrder();
  V(__S.calls.length===pf0,'價庫失敗零 webhook');
  V(lastToast().includes('價庫暫時讀不到')&&lastToast().includes('尚未送出'),'價庫失敗誠實文案');
  V(cart.cx1===2&&pendingOrderId!==null,'價庫失敗保留草稿與單號');

  seed(); openConfirm(); __setFresh([{...${JSON.stringify(BASE_PRODUCT)},cost:101}]); const pc0=__S.calls.length; await submitOrder();
  V(__S.calls.length===pc0,'價變第一按零 webhook');
  V(lastToast().includes('已有更新')&&lastToast().includes('尚未送出'),'價變重核文案');
  V(modal().includes('$202'),'價變後確認頁更新合計');

  for (const mode of ['throw','timeout','http500','legacy','weird']) {
    seed(); openConfirm(); const id=pendingOrderId; __setWebhook(mode); await submitOrder();
    V(pendingSnapshot&&pendingSnapshot.state==='unknown',mode+' unknown state');
    V(JSON.parse(__storage.get(PENDING_STORAGE_KEY)).state==='unknown',mode+' unknown 持久化');
    V(pendingOrderId===id&&cart.cx1===2,mode+' 保留原單與購物車');
    V(title().includes('送出狀態未確認'),mode+' 未確認標題');
    V(__storage.get(PENDING_STORAGE_KEY).includes('0912-000-000'),mode+' PII 只在 pending 快照');
  }

  seed(); openConfirm(); __setWebhook('acklost'); await submitOrder();
  const firstBody=__S.bodies[0], sameId=pendingOrderId;
  __setWebhook('dup'); await retryPendingOrder();
  V(__S.bodies[1]===firstBody,'unknown retry payload byte-equal');
  V(pendingSnapshot.state==='needs_reconciliation'&&pendingOrderId===sameId,'duplicate 鎖核對態');
  V(cart.cx1===2&&title().includes('完成度未確認'),'duplicate 不清購物車不成功');
  V(!document.getElementById('modal-actions').innerHTML.includes('原單重送'),'duplicate 不得有重送鈕');
  V(__S.echoes===0,'duplicate 不發迴聲');
  await finishReconciliation();
  V(pendingSnapshot===null&&Object.keys(cart).length===0,'三處核對結案才清草稿');
  const reconAudit=__storage.get(AUDIT_STORAGE_KEY)||'';
  V(reconAudit.includes('boss-confirmed')&&!reconAudit.includes('0912-000-000'),'結案 journal 無 PII');

  seed(); openConfirm(); __setWebhook('acklost'); await submitOrder();
  const storedId=pendingOrderId; pendingSnapshot=null; pendingOrderId=null; Object.keys(cart).forEach(k=>delete cart[k]);
  V(restorePendingState()===true,'跨載入 restore');
  V(pendingOrderId===storedId&&cart.cx1===2&&title().includes('送出狀態未確認'),'restore 還原鎖定狀態');
  V(JSON.parse(__storage.get(PENDING_STORAGE_KEY)).state==='unknown','restore 將 sending 持久化為 unknown');

  seed(); openConfirm(); __setWebhook('held'); await submitOrder();
  V(pendingOrderId===null&&pendingSnapshot===null&&cart.cx1===2,'held 清 pending 保留草稿');
  V(title().includes('整單擋下')&&modal().includes('未寫入帳表、未通知廠商'),'held 誠實整單文案');
  V(modal().includes('cx1')&&modal().includes('empty_dest'),'held blockedItems');

  seed(); openConfirm(); __setWebhook('stale'); await submitOrder();
  V(pendingOrderId===null&&cart.cx1===2,'stale 清 pending 保留草稿');
  V(modal().includes('價庫資料已變更')&&modal().includes('未通知廠商'),'stale 文案');

  seed(); openConfirm(); const preId=pendingOrderId; __setWebhook('preflight'); await submitOrder();
  V(pendingSnapshot.state==='preflight_unavailable'&&pendingOrderId===preId,'preflight 保原 ID');
  pendingSnapshot=null; pendingOrderId=null; Object.keys(cart).forEach(k=>delete cart[k]); draftNote='';
  V(restorePendingState()===true&&pendingSnapshot.state==='preflight_unavailable'&&title().includes('確認'),'preflight 跨載入可編輯不誤鎖 unknown');
  draftNote='預檢後修改'; document.getElementById('note').value=draftNote; __setWebhook('ok'); await submitOrder();
  V(__S.calls[1].payload.orderId===preId,'preflight 編輯後同 ID 重試');
  V(pendingSnapshot===null&&pendingOrderId===null,'preflight 重試 ok 清狀態');

  seed(); openConfirm(); const e0=__S.echoes; __setWebhook('ok'); await submitOrder();
  const sent=__S.calls[0].payload;
  V(sent.clientVersion==='liff-v5','payload clientVersion');
  V(sent.totalDeclaredMinor===20000,'payload totalDeclaredMinor');
  V(sent.items[0].itemIndex===0&&sent.items[0].qty===2,'payload itemIndex/qty');
  V(Object.keys(cart).length===0&&pendingOrderId===null,'ok 清草稿');
  V(title().includes('已完成')&&modal().includes(${JSON.stringify(BASE_PRODUCT.name)}),'ok 完整成功頁');
  V(modal().includes('$取消貨 '+sent.orderId)&&modal().includes('0912-000-000'),'ok 後續與備註全文');
  V(__S.echoes===e0+1,'只有 ok 發唯一迴聲');
  const audit=__storage.get(AUDIT_STORAGE_KEY)||'';
  V(audit.includes('payloadHash')&&!audit.includes('0912-000-000')&&!audit.includes(${JSON.stringify(BASE_PRODUCT.name)}),'audit journal 不含 PII/品項');

  ${KIND==='branch' ? `seed(999); products[0].cost=400; __setFresh([{...products[0]}]); openConfirm(); const cap0=__S.calls.length; await submitOrder();
  V(__S.calls.length===cap0,'分店超 30 萬前端零 webhook');
  V(modal().includes('超過分店單筆上限')||lastToast().includes('上限'),'分店 cap 文案');` : `seed(); openConfirm(); __setWebhook('over_cap'); await submitOrder();
  V(pendingOrderId===null&&cart.cx1===2,'倉管 over_cap 保留草稿');
  V(modal().includes('總部成本超過 $500,000')&&modal().includes('未通知廠商'),'倉管後端 D cap 文案');`}

  V(__S.v5Passes>=24,'新增 v5 assertions 至少 24，實際 '+__S.v5Passes);
  if (__S.fails.length) {
    console.__real('FAIL '+__S.fails.length+' 條:');
    __S.fails.forEach(f=>console.__real('  ✗ '+f));
  }
  console.__real((__S.fails.length?'RESULT: FAIL':'RESULT: PASS')+' ('+__S.passes+' assertions; v5 new='+__S.v5Passes+')');
})().catch(e=>{console.__real('TESTERR '+e.stack);__S.fails.push('exception');});`;

vm.createContext(ctx);
vm.runInContext(code, ctx, {timeout:30000});
setTimeout(()=>process.exit(S.fails.length?1:0), 4000);
