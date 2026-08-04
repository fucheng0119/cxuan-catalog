// 用法: node liff_assert.js <html路徑> <branch|wh>
const fs=require('fs'),vm=require('vm');
const [,,PATH,KIND]=process.argv;
const src=fs.readFileSync(PATH,'utf8');
const blocks=[...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let code=blocks[blocks.length-1];
const magic=()=>new Proxy(function(){},{get:(t,k)=>{
  if(k==='classList')return{add(){},remove(){}};
  if(k==='dataset')return{cat:'hot'};
  if(k==='value')return '';
  if(k==='length')return 0;
  if(k===Symbol.toPrimitive)return()=>'';
  return magic();
},set:()=>true,apply:()=>magic()});
let fetchMode='ok';
const S={toasts:[],calls:[],backendProcessed:[],echoes:0,fails:[],passes:0};
const ctx={
  console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,AbortController,URLSearchParams,
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  navigator:{},location:{search:''},window:{},
  document:{getElementById:()=>magic(),querySelector:()=>magic(),querySelectorAll:()=>[],addEventListener(){}},
  liff:{init:()=>Promise.resolve(),isInClient:()=>true,isLoggedIn:()=>true,getContext:()=>null,
        getProfile:()=>Promise.resolve({displayName:'T',userId:'U'}),
        sendMessages:()=>{S.echoes++;return Promise.resolve();}},
  fetch:async(url,opt)=>{
    if(!String(url).includes('hook.us2.make.com'))
      return {ok:true,status:200,json:async()=>({products:[]})};
    const payload=JSON.parse(opt.body);
    S.calls.push({mode:fetchMode,orderId:payload.orderId});
    switch(fetchMode){
      case 'throw': throw new Error('network down');
      case 'timeout': {const e=new Error('aborted');e.name='AbortError';throw e;}
      case 'http500': return {ok:false,status:500,json:async()=>{throw new Error('x')}};
      case 'legacy': return {ok:true,status:200,json:async()=>{throw new Error('Accepted not json')}};
      case 'weird':  return {ok:true,status:200,json:async()=>({foo:1})};
      case 'acklost': S.backendProcessed.push(payload.orderId); throw new Error('conn reset after backend done');
      case 'dup':  return {ok:true,status:200,json:async()=>({status:'duplicate',orderId:payload.orderId})};
      case 'held': return {ok:true,status:200,json:async()=>({status:'held',orderId:payload.orderId})};
      case 'ok':   return {ok:true,status:200,json:async()=>({status:'ok',orderId:payload.orderId})};
    }
  },
  __S:S,__setMode:m=>{fetchMode=m},
};
ctx.window=ctx;
const seed = KIND==='branch'
 ? "currentBranch={name:'測試店',short:'測'}; currentGroupId='Cg';"
 : "";
code+=`
;(async()=>{
  await new Promise(r=>setTimeout(r,30));
  const A=(cond,msg)=>{ if(cond){__S.passes++;} else __S.fails.push(msg); };
  const T=()=>__S.toasts[__S.toasts.length-1]||'';
  const _st=showToast; showToast=(m,ms)=>{__S.toasts.push(String(m));};

  // 3M／舒萬諾退場：只移除未簽成的舒萬諾供應線，不誤刪盛智商用與家享零件。
  const vendorCases=[
    ['3M',true],
    ['3M/澄軒客服/中部倉管',true],
    ['舒萬諾',true],
    ['台灣舒萬諾股份有限公司',true],
    ['Solventum',true],
    ['盛智_3m商用/中部倉管/澄軒客服',false],
    ['家享/澄軒客服/中部倉管',false]
  ];
  for (const [vendor,expected] of vendorCases) {
    A(isRetiredSolventumProduct({vendor})===expected,'退場供應商判斷錯誤: '+vendor);
  }
  const orderable=filterOrderableProducts([
    {cx:'cx117',vendor:'3M',cost:1},
    {cx:'cx370',vendor:'盛智_3m商用',cost:1},
    {cx:'cx500',vendor:'家享',cost:1},
    {cx:'cx0',vendor:'其他',cost:0}
  ]).map(p=>p.cx).join(',');
  A(orderable==='cx370,cx500','退場篩選不得誤刪盛智商用或家享零件: '+orderable);

  products.length=0; products.push({cx:'cx1',name:'測試濾心',vendor:'測商'});
  ${seed}
  const seedCart=()=>{Object.keys(cart).forEach(k=>delete cart[k]); cart['cx1']=2;};

  // 1-6: 各種失敗/未知 → 一律「未確認」+保留購物車+保留單號
  for (const m of ['throw','timeout','http500','legacy','weird']) {
    seedCart(); pendingOrderId=null;
    __setMode(m); await submitOrder();
    A(cart['cx1']===2, m+': 購物車須保留');
    A(pendingOrderId!==null, m+': 單號須保留');
    A(T().includes('未確認'), m+': 文案須為未確認, got='+T().slice(0,20));
    A(!T().includes('沒有」送出'), m+': 不得斷言沒送出');
    A(submitting===false, m+': submitting 須復位');
  }
  // 7: ACK 回程遺失 → 未確認；重按 → 同單號 → duplicate → 收斂
  seedCart(); pendingOrderId=null; const e0=__S.echoes;
  __setMode('acklost'); await submitOrder();
  A(cart['cx1']===2,'acklost: 購物車保留');
  A(pendingOrderId!==null,'acklost: 單號保留');
  A(T().includes('未確認'),'acklost: 未確認文案');
  const P=pendingOrderId;
  __setMode('dup'); await submitOrder();
  A(__S.calls[__S.calls.length-1].orderId===P,'retry 必須沿用同一單號');
  A(__S.backendProcessed[0]===P,'後端首發處理的就是該單號');
  A(Object.keys(cart).length===0,'dup 後購物車清空');
  A(pendingOrderId===null,'dup 後單號歸零');
  A(T().includes('已收過'),'dup 中性文案');
  A(__S.echoes===e0,'duplicate 不得發迴聲');
  // 8: held
  seedCart(); __setMode('held'); await submitOrder();
  A(Object.keys(cart).length===0,'held 清空購物車');
  A(T().includes('人工處理'),'held 文案');
  A(__S.echoes===e0,'held 不得發迴聲');
  // 9: ok
  seedCart(); __setMode('ok'); await submitOrder();
  A(Object.keys(cart).length===0,'ok 清空購物車');
  A(T().includes('✅'),'ok 成功文案');
  A(__S.echoes===e0+1,'ok 必須發出唯一一次迴聲');
  // 10: 防連點
  seedCart(); pendingOrderId=null; const n0=__S.calls.length;
  __setMode('ok'); const p1=submitOrder(); const p2=submitOrder(); await p1; await p2;
  A(__S.calls.length===n0+1,'連點只允許一次 POST');

  if(__S.fails.length){ console.__real('FAIL '+__S.fails.length+' 條:'); __S.fails.forEach(f=>console.__real('  ✗ '+f)); }
  console.__real((__S.fails.length? 'RESULT: FAIL' : 'RESULT: PASS')+' ('+__S.passes+' assertions)');
})().catch(e=>{console.__real('TESTERR '+e.stack); __S.fails.push('exception');});`;
ctx.console.__real=(...a)=>process.stdout.write(a.join(' ')+'\n');
vm.createContext(ctx);
vm.runInContext(code,ctx,{timeout:30000});
setTimeout(()=>{ process.exit(S.fails.length?1:0); },2500);
