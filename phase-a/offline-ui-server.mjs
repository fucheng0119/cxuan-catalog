import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.LIFF_OFFLINE_PORT || 8765);

const products = [
  {
    cx: "cx7",
    name: "超長完整品名驗證－全屋淨軟一體機二十一公升智慧再生旗艦版本（不得截斷）",
    vendor: "茗毅（全屋淨）",
    cost: "7,035.00",
    retail: 25000,
  },
  { cx: "cx8", name: "測試用第二品項 1812.5 小數批發價", vendor: "測試廠商", cost: 1812.5, retail: 3000 },
  { cx: "cxCAP", name: "離線超限測試品項", vendor: "測試廠商", cost: 300001, retail: 400000 },
];

function harnessScript(mode, branch) {
  const groupId = mode === "failclosed" ? "C" + "f".repeat(32) : "C74762837d7f7cfe191892008cbd554a5";
  const prelude = `
<script>
localStorage.clear();
window.__OFFLINE_ONLY__ = true;
window.__MOCK_FETCHES = [];
window.__MOCK_PRODUCTS = ${JSON.stringify(products)};
window.liff = {
  init: async () => {},
  isLoggedIn: () => true,
  login: () => { throw new Error('offline harness forbids login'); },
  getProfile: async () => ({ userId: 'U' + '1'.repeat(32), displayName: '離線驗收員' }),
  getContext: () => ({ type: 'group', groupId: ${JSON.stringify(groupId)} }),
  sendMessages: async () => {}
};
window.fetch = async (url, options = {}) => {
  const target = String(url);
  window.__MOCK_FETCHES.push({ target: target.includes('script.google.com') ? 'products-mock' : 'blocked-webhook-mock', cache: options.cache || '' });
  if (target.includes('script.google.com')) return new Response(JSON.stringify({ products: window.__MOCK_PRODUCTS }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  if (target.includes('hook.us2.make.com')) throw new Error('offline harness: true webhook forbidden');
  throw new Error('offline harness: network forbidden');
};
</script>`;

  const fixture = `
<script>
(async () => {
  for (let i = 0; i < 100 && (!window.products || products.length === 0); i++) await new Promise(r => setTimeout(r, 20));
  const mode = ${JSON.stringify(mode)};
  if (mode === 'confirm') {
    setQty('cx7', 2);
    setQty('cx8', 3);
    draftNote = '指寄員林店\\n地址：彰化縣員林市中山路二段251號\\n電話：0958-123083';
    openConfirm();
  } else if (mode === 'overcap') {
    setQty('cxCAP', 1);
    draftNote = '離線超限驗證，不送出';
    openConfirm();
  } else if (mode === 'success') {
    setQty('cx7', 2);
    draftNote = '指寄員林店\\n備註逐字保留';
    pendingOrderId = ${branch ? "'ORD-信義-260826-120000'" : "'ORD-中部倉-260826-120000'"};
    showSuccess(buildPayload());
  } else if (mode === 'reconcile') {
    setQty('cx7', 2);
    draftNote = '此為離線 duplicate 核對畫面';
    pendingOrderId = ${branch ? "'ORD-信義-260826-120001'" : "'ORD-中部倉-260826-120001'"};
    const payload = buildPayload();
    const serializedPayload = JSON.stringify(payload);
    savePending({ orderId: payload.orderId, serializedPayload, state: 'needs_reconciliation', createdAt: Date.now() - 25 * 60 * 60 * 1000, lastEscalationAt: 0 });
    showPendingState();
  } else if (mode === 'failclosed') {
    setQty('cx7', 1);
    updateCart();
  }
  document.documentElement.dataset.fixtureReady = 'true';
})();
</script>`;
  return { prelude, fixture };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const branch = url.pathname !== "/warehouse";
    const mode = url.searchParams.get("mode") || "confirm";
    const file = branch ? "cxuan-branch-order.html" : "wh-liff/cxuan-warehouse.html";
    let html = await readFile(path.join(root, file), "utf8");
    html = html.replace(/<script[^>]+src=["'][^"']*line-scdn[^"']*["'][^>]*><\/script>/gi, "");
    const { prelude, fixture } = harnessScript(mode, branch);
    html = html.replace("</head>", `${prelude}</head>`).replace("</body>", `${fixture}</body>`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(String(error.stack || error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`LIFF offline UI server: http://127.0.0.1:${port}`);
});
