# LIFF v5 Phase A — Make flat-diff 與路徑枚舉

> 本檔是離線提案，不是可直接 PATCH 的 live blueprint。2026-08-26 僅做 `scenarios_get`、hook status 與 module schema 唯讀查驗；沒有執行 webhook、沒有建立場景、沒有 PATCH。

## 1. 共同新增段（兩線都插在 [1] 與 [200] 之間）

| 邏輯 ID | 模組 | 輸入 | 產出／終點 | live 寫入 |
|---|---|---|---|---|
| 300 | `datastore:ExistRecord` v1 | datastore 124620；key=`{{1.orderId}}` | `exist=true` 直接 duplicate；false 才往 310；錯誤回 preflight_unavailable | 0（唯讀） |
| 310 | `google-sheets:getSheetContent` v2 | 價庫 `A:I`，`FORMATTED_VALUE` | 單次價庫 rows；錯誤回 preflight_unavailable | 0 |
| 311 | `builtin:BasicAggregator` | 310 的 A:I bundles | `rows[]`＋count；零輸入只看 count，不碰空 bundle 欄位 | 0 |
| 312 | `code:ExecuteCode` v1 | payload、rows、route | originalItems 差集、blockedItems、minor totals、snapshot | 0 |
| 313 | `builtin:BasicRouter` | 312 result | held → over_cap → stale_price → pass（固定優先序） | 0 |

三個新 app module 的 configuration schema 已用 Make validator 驗證：`valid=true`、errors=0、warnings=0。Module 312 的唯一貼入正本為 `phase-a/liff-v5-preflight-make.js`，登記值在 `phase-a/liff-v5-preflight-make.sha256`；Phase C 必須逐字貼入，PATCH 後 GET 回讀 `mapper.codeEditorJavascript` 並驗 SHA-256，禁止臨場改寫。`liff-v5-preflight-reference.js` 只供 Node 斷言；兩檔共同核心由離線斷言做逐位元組一致性檢查。

### 金額變數不得混用

| 線 | `declaredTotalMinor`（跟 payload 比） | `capTotalMinor`（上限判斷） |
|---|---:|---:|
| 分店 | ΣE | ΣE |
| 倉管 | ΣE（前端只看得到 E） | ΣD（只留後端） |

因此倉管 stale_price 的 `serverTotalMinor` 是 ΣE；over_cap ACK 恰 `{status,orderId,capMinor}` 三欄，不回傳 internal `capTotalMinor`／ΣD。倉管相關群只收零金額警示；任何 ΣD 金額若需通知，只允許送老闆 1:1。D 不得出現在 HTML、payload、ACK 或任何群組訊息。

## 2. 5091914 flat-diff

| 現行位置 | before | proposal after | R10-F 類別 |
|---|---|---|---|
| [1]→[200] | 直接進原子 AddRecord | 插入 300/310/311/312/313 | 預檢段 |
| [3].array | `{{1.items}}` | `{{312.result.snapshot}}` | ① |
| [4] | `google-sheets:filterRows` limit=1 | 移除 | ② |
| [5] | 讀 `{{4.*}}`＋`{{3.qty}}` | 讀 `{{3.name/vendor/destinationId/cx/eOriginal/qty}}` | ③ |
| [6] | 讀 `{{4.*}}`＋`{{3.qty}}` | 同上；原本 H 衍生欄改讀 `{{3.hOriginal}}` | ③ |
| [9] | G/品名/價格讀 `{{4.*}}` | destination/name/cx/eOriginal/qty 全讀 [3] snapshot | ③ |
| [7] | 品名/廠商讀 `{{4.*}}` | `{{3.name}}`／`{{3.vendor}}` | ③ |
| 其他 | 現況 | 零修改 | 不得動 |

## 3. 5000701 flat-diff

| 現行位置 | before | proposal after | R10-F 類別 |
|---|---|---|---|
| [1]→[200] | 直接進原子 AddRecord | 插入 300/310/311/312/313 | 預檢段 |
| [3].array | `{{1.items}}` | `{{312.result.snapshot}}` | ① |
| [4] | `google-sheets:filterRows` limit=1 | 移除 | ② |
| [5]/[6]/[9]/[7] | 讀 `{{4.*}}`＋舊 qty | 全改讀 [3] snapshot；[6] H 值由 `hOriginal` 保留 | ③ |
| [106] | 判 `{{4.8}}`（I） | 判 `{{3.destinationId}}` | ④ |
| [107]/[108] | 警示文字中的品名讀 <code>{{4.`0`}}</code> | 機械改成 `{{3.name}}`；文字/收件人/連線/路由零改動 | ⑤ |
| 其他 | 現況 | 零修改 | 不得動 |

### v1.7 已核准之允許清單⑤

live [107]/[108] 都引用將被移除的 [4]；v1.7 已把兩個 <code>{{4.`0`}}→{{3.name}}</code> 純 mapper 置換正式列為 R10-F ⑤。此核准不包含任何文字、收件人、連線或路由變更，flat-diff 若出現其他差異仍須退件。

## 4. probe＋preflight 路徑枚舉

| # | 前置 | 判斷／故障 | 唯一終點 | 價庫讀 | dedup 寫 | 帳／派單 | 通知 |
|---:|---|---|---|---:|---:|---:|---|
| P1 | orderId 已存在 | probe `exist=true` | `duplicate`（非成功） | 0 | 0 | 0 | 0 |
| P2 | 任意 | probe module error | `preflight_unavailable` | 0 | 0 | 0 | 0 |
| P3 | orderId 不存在 | getRange/aggregate/code error | `preflight_unavailable` | ≤1 次嘗試 | 0 | 0 | 0 |
| P4 | orderId 不存在 | 價庫全空／全品項 0 match | `held`，blockedItems＝originalItems 全差集 | 1 | 0 | 0 | 倉管＋老闆 |
| P5 | orderId 不存在 | mixed 一 match＋一 no_match | `held`，只列缺席 itemIndex | 1 | 0 | 0 | 倉管＋老闆 |
| P6 | orderId 不存在 | 同 CX 兩列 | `held/multi_row` | 1 | 0 | 0 | 倉管＋老闆 |
| P7 | orderId 不存在 | bad_qty/bad_price/empty_dest 任一或並列 | `held`，列出全部違規 | 1 | 0 | 0 | 倉管＋老闆 |
| P8 | v5、完整性全過 | `capTotalMinor>capMinor` | `over_cap`（ACK 恰三欄） | 1 | 0 | 0 | 分店：群＋老闆可含 ΣE；倉管：群零金額，ΣD 僅老闆 1:1 |
| P9 | v5、完整性/cap 全過 | declared 與 live ΣE 差 1 minor | `stale_price` | 1 | 0 | 0 | 0 |
| P10 | v4/bot/curl 無 v5 欄 | 完整性全過、但超 cap 或無 declared | `pass` 到 [200]（gate 不擋） | 1 | 依 [200] | 依主鏈 | 依主鏈 |
| P11 | 預檢 pass | 併發另一發先搶 [200] | [200] 原子 onerror `duplicate` | 1 | 第二發 0 | 第二發 0 | 第二發 0 |
| P12 | 預檢 pass、[200] 成功 | 主鏈全完成 | `ok`（唯一成功） | 1 | 1 | 全部 | 既有出貨＋確認卡 |
| P13 | 預檢 pass、[200] 成功 | dedup 後主鏈 Break/DLQ | **無 ACK**→前端 unknown 鎖定 | 1 | 1 | 未確認 | 未確認 |
| P14 | unknown 原 payload 重送 | P13 已燒 orderId | P1 `duplicate`→needs_reconciliation | 0 | 0 | 0 | 0 |
| P15 | held/preflight_unavailable | [200] 前終止 | 修正後原/新 ID 依狀態表再進 P1–P12 | 視重試 | 首次 0 | 首次 0 | 依新結果 |

P13 是 R10-H 明定的 dedup 後誠實契約，不能為了湊「每路徑都有 Respond」偽造 held/失敗。P1–P12 的 pre-dedup／原子閘分支則必須恰一顆 WebhookRespond。

## 5. rollback 與驗收閘

- 任何 Phase C PATCH 前，Claude 必須重新 GET 完整 live blueprint，落一份當時的 before 檔；本 Phase A 提案不是 rollback 檔。
- PATCH 後必讀回完整 blueprint 並確認 `scheduling.type == immediately`。
- staging 要用獨立 hook、獨立 datastore、測試 Sheets、測試 LINE 群；不得把本提案直接貼 live 驗證。
- 模組級 execution log 才是路徑證據；operations 數不可代替。
