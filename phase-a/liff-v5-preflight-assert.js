"use strict";

const assert = require("node:assert/strict");
const { moneyMinor, runPreflight } = require("./liff-v5-preflight-reference.js");

let passed = 0;
function ok(condition, message) { assert.ok(condition, message); passed += 1; }
function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); passed += 1; }

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
eq(overWh.serverTotalMinor, 199800000, "倉管 over_cap 回 D cap total");

const stale = runPreflight({
  payload: payload([{ itemIndex: 0, cx: "cx1", name: "一", qty: 1 }], { totalDeclaredMinor: 181249 }),
  rows,
  route: "wh",
});
eq(stale.status, "stale_price", "declared 差 1 minor 擋下");
eq(stale.serverTotalMinor, 181250, "stale_price 回 E declared total");

const legacy = runPreflight({
  payload: payload([{ cx: "cx2", name: "二", qty: 999 }], { clientVersion: "v4" }),
  rows,
  route: "branch",
});
eq(legacy.status, "pass", "非 v5 不啟用 cap/declared gate");
eq(legacy.snapshot[0].itemIndex, 0, "缺 itemIndex 以行序補位");

console.log(`RESULT: PASS (${passed} assertions; offline preflight reference)`);
