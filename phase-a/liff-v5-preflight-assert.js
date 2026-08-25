"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { moneyMinor, runPreflight } = require("./liff-v5-preflight-reference.js");

let passed = 0;
function ok(condition, message) { assert.ok(condition, message); passed += 1; }
function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); passed += 1; }

const CORE_START = "// CXUAN_PREFLIGHT_CORE_START";
const CORE_END = "// CXUAN_PREFLIGHT_CORE_END";
const referenceSource = fs.readFileSync(path.join(__dirname, "liff-v5-preflight-reference.js"), "utf8");
const makeSource = fs.readFileSync(path.join(__dirname, "liff-v5-preflight-make.js"), "utf8");
const recordedMakeHash = fs.readFileSync(path.join(__dirname, "liff-v5-preflight-make.sha256"), "utf8").trim().split(/\s+/)[0];
const branchProposal = JSON.parse(fs.readFileSync(path.join(__dirname, "blueprint-diff-5091914.json"), "utf8"));
const warehouseProposal = JSON.parse(fs.readFileSync(path.join(__dirname, "blueprint-diff-5000701.json"), "utf8"));

function extractCore(source) {
  const start = source.indexOf(CORE_START);
  const end = source.indexOf(CORE_END);
  assert.ok(start >= 0 && end > start, "preflight core markers missing or out of order");
  return source.slice(start, end + CORE_END.length);
}

function hasForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if (["snapshot", "dOriginal", "dMinor"].includes(key)) return true;
    if (hasForbiddenKey(child)) return true;
  }
  return false;
}

const makeRunner = new Function("input", makeSource);

eq(extractCore(makeSource), extractCore(referenceSource), "Make-ready 與 reference 共同核心逐位元組一致");
ok(!makeSource.includes("module.exports"), "Make-ready 不含 module.exports");
ok(makeSource.includes("const { payload, rows, route } = input;"), "Make-ready 從 input 取得三個輸入");
ok(makeSource.includes("return runPreflight({ payload, rows, route });"), "Make-ready 以頂層 return 回傳預檢結果");
eq(
  crypto.createHash("sha256").update(makeSource).digest("hex"),
  recordedMakeHash,
  "Make-ready SHA-256 與登記檔一致",
);
for (const proposal of [branchProposal, warehouseProposal]) {
  const codeContract = proposal.verifiedModuleSchemas.find((entry) => entry.module === "code:ExecuteCode").mapperContract;
  eq(codeContract.source, "phase-a/liff-v5-preflight-make.js", `${proposal.base.scenarioId} 指向 Make-ready 唯一正本`);
  eq(codeContract.sourceSha256, recordedMakeHash, `${proposal.base.scenarioId} 登記 Make-ready 同一 SHA-256`);
  eq(
    Object.keys(proposal.ackSchema.over_cap).sort(),
    ["capMinor", "orderId", "status"],
    `${proposal.base.scenarioId} over_cap schema 恰三欄`,
  );
}
eq(
  warehouseProposal.allowedMainChainChanges
    .filter((entry) => [107, 108].includes(entry.moduleId))
    .map((entry) => [entry.moduleId, entry.changeClass, entry.after]),
  [[107, 5, "warning text product name reads {{3.name}}"], [108, 5, "warning text product name reads {{3.name}}"]],
  "倉管 [107]/[108] 已移入允許清單⑤",
);
ok(!Object.hasOwn(warehouseProposal, "specAmendmentRequiredBeforePhaseC"), "倉管提案已移除待核准舊段");
ok(
  warehouseProposal.overCapPushPolicy.warehouseRelatedGroups.includes("zero-money")
    && warehouseProposal.overCapPushPolicy.ownerDirect.includes("only permitted"),
  "倉管 push 分級為群零金額、ΣD 僅老闆 1:1",
);
ok(
  branchProposal.overCapPushPolicy.branchOrderGroup.includes("ΣE")
    && branchProposal.overCapPushPolicy.branchOrderGroup.includes("never D"),
  "分店 push 僅允許 ΣE、禁止 D",
);

const G = "C" + "a".repeat(32);
const I = "R" + "b".repeat(32);
const rows = [
  { A: "cx1_測試商品一", D: "1,500.00", E: "1,812.5", F: "廠商甲", G, H: 2500, I },
  { A: "cx2_測試商品二", D: 2000, E: "7,035.00", F: "廠商乙", G, H: 9000, I },
];
const payload = (items, extra = {}) => ({
  orderId: "ORD-TEST-1",
  clientVersion: "liff-v5",
  items,
  totalDeclaredMinor: 0,
  ...extra,
});

eq(moneyMinor("1,812.5"), 181250, "一位小數可轉 minor");
eq(moneyMinor("7,035.00"), 703500, "千分位兩位小數可轉 minor");
eq(moneyMinor("0.01"), 1, "最小一分可轉 minor");
eq(moneyMinor("1812.505"), null, "超過兩位小數拒絕");
eq(moneyMinor("NaN"), null, "NaN 拒絕");
eq(moneyMinor(-1), null, "負數拒絕");
eq(moneyMinor(0), null, "零拒絕");

const branchOk = runPreflight({
  payload: payload([{ itemIndex: 0, cx: "cx1", name: "舊名", qty: 2 }], { totalDeclaredMinor: 362500 }),
  rows,
  route: "branch",
});
eq(branchOk.status, "pass", "分店合法單通過");
eq(branchOk.declaredTotalMinor, 362500, "分店 declared 使用 E");
eq(branchOk.capTotalMinor, 362500, "分店 cap 使用 E");
eq(branchOk.snapshot[0].name, "cx1_測試商品一", "主鏈使用 live 快照品名");
eq(branchOk.snapshot[0].hOriginal, 2500, "既有中央帳 H 欄 mapper 由同一快照保留");

const whOk = runPreflight({
  payload: payload([{ itemIndex: 0, cx: "cx1", name: "舊名", qty: 2 }], { totalDeclaredMinor: 362500 }),
  rows,
  route: "wh",
});
eq(whOk.status, "pass", "倉管合法單通過");
eq(whOk.declaredTotalMinor, 362500, "倉管 declared 防竄改仍使用 E");
eq(whOk.capTotalMinor, 300000, "倉管 cap 使用 D");

const noMatch = runPreflight({
  payload: payload([
    { itemIndex: 4, cx: "cx404", name: "缺商品", qty: 1 },
    { itemIndex: 9, cx: "cx405", name: "也缺商品", qty: 1 },
  ]),
  rows,
  route: "branch",
});
eq(noMatch.status, "held", "全 no_match 整單 held");
eq(noMatch.blockedItems.map((x) => x.itemIndex), [4, 9], "全 no_match 以 itemIndex 完整差集");
ok(noMatch.blockedItems.every((x) => x.reason === "no_match"), "全 no_match 原因完整");
ok(!hasForbiddenKey(noMatch), "held 結果遞迴禁 snapshot/dOriginal/dMinor");

const mixed = runPreflight({
  payload: payload([
    { itemIndex: 0, cx: "cx1", name: "一", qty: 1 },
    { itemIndex: 1, cx: "cx404", name: "缺", qty: 1 },
  ]),
  rows,
  route: "branch",
});
eq(mixed.status, "held", "mixed match/no_match 整單 held");
eq(mixed.blockedItems, [{ itemIndex: 1, cx: "cx404", name: "缺", reason: "no_match" }], "mixed 僅列缺席行");

const duplicatedRows = [...rows, { ...rows[0], A: "cx1_重複列" }];
const multi = runPreflight({
  payload: payload([{ itemIndex: 0, cx: "cx1", name: "一", qty: 1 }]),
  rows: duplicatedRows,
  route: "branch",
});
eq(multi.blockedItems[0].reason, "multi_row", "雙列回 multi_row");

const invalid = runPreflight({
  payload: payload([{ itemIndex: 7, cx: "cx1", name: "一", qty: 1000 }]),
  rows: [{ ...rows[0], E: "1812.505", G: "" }],
  route: "branch",
});
eq(invalid.blockedItems.map((x) => x.reason), ["bad_qty", "bad_price", "empty_dest"], "同一行違規可並列");
ok(invalid.blockedItems.every((x) => x.itemIndex === 7), "並列違規仍由 itemIndex 對位");

const overBranch = runPreflight({
  payload: payload([{ itemIndex: 0, cx: "cx2", name: "二", qty: 999 }], { totalDeclaredMinor: 702796500 }),
  rows,
  route: "branch",
});
eq(overBranch.status, "over_cap", "分店 E 超 30 萬回 over_cap");
eq(overBranch.capMinor, 30000000, "分店 capMinor 正確");

const overWh = runPreflight({
  payload: payload([{ itemIndex: 0, cx: "cx2", name: "二", qty: 999 }], { totalDeclaredMinor: 702796500 }),
  rows,
  route: "wh",
});
eq(overWh.status, "over_cap", "倉管 D 超 50 萬回 over_cap");
eq(
  overWh,
  { status: "over_cap", orderId: "ORD-TEST-1", capMinor: 50000000 },
  "over_cap 恰含 status/orderId/capMinor 三欄",
);
ok(!hasForbiddenKey(overWh), "over_cap 結果遞迴禁 snapshot/dOriginal/dMinor");

const stale = runPreflight({
  payload: payload([{ itemIndex: 0, cx: "cx1", name: "一", qty: 1 }], { totalDeclaredMinor: 181249 }),
  rows,
  route: "wh",
});
eq(stale.status, "stale_price", "declared 差 1 minor 擋下");
eq(stale.serverTotalMinor, 181250, "stale_price 回 E declared total");
ok(!hasForbiddenKey(stale), "stale_price 結果遞迴禁 snapshot/dOriginal/dMinor");

const legacy = runPreflight({
  payload: payload([{ cx: "cx2", name: "二", qty: 999 }], { clientVersion: "v4" }),
  rows,
  route: "branch",
});
eq(legacy.status, "pass", "非 v5 不啟用 cap/declared gate");
eq(legacy.snapshot[0].itemIndex, 0, "缺 itemIndex 以行序補位");

const makeEquivalenceCases = [
  {
    name: "pass",
    input: {
      payload: payload([{ itemIndex: 0, cx: "cx1", name: "舊名", qty: 2 }], { totalDeclaredMinor: 362500 }),
      rows,
      route: "branch",
    },
  },
  {
    name: "held",
    input: {
      payload: payload([{ itemIndex: 4, cx: "cx404", name: "缺商品", qty: 1 }]),
      rows,
      route: "branch",
    },
  },
  {
    name: "over_cap",
    input: {
      payload: payload([{ itemIndex: 0, cx: "cx2", name: "二", qty: 999 }], { totalDeclaredMinor: 702796500 }),
      rows,
      route: "wh",
    },
  },
  {
    name: "stale_price",
    input: {
      payload: payload([{ itemIndex: 0, cx: "cx1", name: "一", qty: 1 }], { totalDeclaredMinor: 181249 }),
      rows,
      route: "wh",
    },
  },
];
for (const testCase of makeEquivalenceCases) {
  eq(makeRunner(testCase.input), runPreflight(testCase.input), `Make-ready ${testCase.name} 與 reference 結果一致`);
}

console.log(`RESULT: PASS (${passed} assertions; offline preflight reference)`);
