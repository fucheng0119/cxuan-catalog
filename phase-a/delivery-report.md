# LIFF 安全確認 v5 Phase A 施工回報（Codex → Claude）

- 日期：2026-08-26（Asia/Taipei）
- 規格：`specs/2026-08-25_施工單_LIFF安全確認v5_分店倉管.md` v1.5（老闆轉達終評 94 PASS）
- repo：`/Users/fucheng0119/Documents/cxuan-catalog-live`
- branch：`liff-v5-safe-confirm`
- 動工基線：`699c002`
- 結論：**Phase A 離線施工 PASS；Phase C 仍有兩項規格／契約閘門，未解前不得 PATCH。**
- 生產變更：**0**。沒有 Make PATCH、沒有部署、沒有真 webhook、沒有 LINE 訊息、沒有帳表寫入。

## ① 分支 diff

正式前端／測試 diff：

```text
cxuan-branch-order.html      | 525 +++++++++++++++++++++++++++++++++----------
tests/liff_assert.js         | 366 ++++++++++++++++++++----------
wh-liff/cxuan-warehouse.html | 489 +++++++++++++++++++++++++++++++---------
3 files changed, 1049 insertions(+), 331 deletions(-)
```

另新增 `phase-a/` 交付證據（blueprint proposal、離線預檢模型、矩陣、mock UI server、截圖、本報告）。

## ② liff_assert 與語法全綠

施工前基線：canonical runner 兩檔各 41 assertions PASS；repo runner 兩檔各 49 assertions PASS。

施工後以規格指定 canonical entrypoint 執行：

```text
RESULT: PASS (97 assertions; v5 new=92)   # branch
RESULT: PASS (95 assertions; v5 new=90)   # warehouse
RESULT: PASS (31 assertions; offline preflight reference)
RESULT: PASS (2 blueprint diff JSON parsed)
RESULT: PASS (forbidden UI strings absent)
RESULT: PASS (required v5 anchors present)
```

另通過：

- `node --check`：repo liff_assert、preflight reference/assert、offline UI server。
- `git diff --check`：零 whitespace error。
- canonical runner `/Users/fucheng0119/cxuan-automation/liff-tests/liff_assert.js` 已改為固定轉入本 branch 的 versioned test，避免 HTML 與斷言漂移。

## ③ blueprint diff 提案×2＋flat-diff＋probe 路徑

- `phase-a/blueprint-diff-5091914.json`
- `phase-a/blueprint-diff-5000701.json`
- `phase-a/flat-diff-and-paths.md`
- `phase-a/liff-v5-preflight-reference.js`
- `phase-a/liff-v5-preflight-assert.js`

2026-08-26 唯讀讀回 live：

| scenario | 名稱 | scheduling | webhook module | dedup datastore |
|---:|---|---|---:|---:|
| 5091914 | LIFF 分店叫貨訂單處理 | immediately | hook 2319154 | 124620 |
| 5000701 | LIFF 倉管訂單處理 | immediately | hook 2278202 | 124620 |

新增模組的 Make schema 驗證：

| 模組 | 結果 |
|---|---|
| `datastore:ExistRecord` v1 | valid；0 errors；0 warnings |
| `google-sheets:getSheetContent` v2（A:I） | valid；0 errors；0 warnings |
| `code:ExecuteCode` v1 | valid；0 errors；0 warnings |

probe 分支、preflight 全分支、[200] 競態與 dedup 後 unknown 共 15 路徑已列於 `flat-diff-and-paths.md`。提案明確保留 [200] 原子 AddRecord 與既有完整 onerror 樹。

## ④ 逐 R 自檢

| R | 判定 | 證據 |
|---|---|---|
| R1 完整確認 | PASS | 兩端完整品名、單號、單價、小計、E 合計；倉管另有 D 後端檢核說明；禁字 grep=0 |
| R2 即時重抓 | PASS | `cache:'no-store'`；name/vendor/cost 指紋變更零 webhook 並重建；fetch error fail-closed |
| R3 minor／cap | PASS | 逗號與 0–2 位小數→minor 整數；分店 30M 前端擋；倉管 D 只在後端 proposal |
| R4 qty 1–999 | PASS | set/change/鍵盤均 cap 999；0 刪除；999/1000 邊界斷言 |
| R5 分店群 fail-closed | PASS | 未登錄／1對1 currentBranch 空，無手選 fallback，送出 disabled |
| R6 note 逐字 | PASS | modal 重建前 capture；換行／地址原文留在 payload；audit 不留 PII |
| R7 held | PASS（前端） | 兩端完全由 ACK blockedItems 渲染；文案明示整單未寫帳、未通知廠商 |
| R8 結果頁 | PASS | ok 唯一成功；成功頁完整；duplicate 轉 needs_reconciliation 且不發 echo |
| R9 G/I 空 | PASS（proposal） | preflight reference 逐項 regex fail-closed；live 未 PATCH |
| R10 probe/preflight/snapshot | PASS（proposal） | 兩 JSON＋31 assertions＋15 路徑；module schema valid；Phase C 待 staging |
| R11 持久化六態 | PASS | byte-equal retry、reload、duplicate lock、preflight 同 ID 可編輯、ok clear、journal 去 PII；另修正 sending→unknown 落檔 |

## ⑤ 截圖

- `phase-a/screenshot-branch-confirm.png`
- `phase-a/screenshot-branch-success.png`
- `phase-a/screenshot-branch-over-cap.png`
- `phase-a/screenshot-branch-fail-closed.png`
- `phase-a/screenshot-branch-needs-reconciliation.png`
- `phase-a/screenshot-warehouse-confirm.png`

截圖來自 localhost 離線 harness；它移除 LINE CDN，mock products fetch，所有 Make URL 一律 throw。瀏覽器 DOM 額外讀回：超限 confirm disabled、fail-closed send disabled、needs_reconciliation 原單重送按鈕 count=0；真 webhook calls=0。

## ⑥ ACK × 呼叫方矩陣

完整表：`phase-a/ack-caller-matrix.md`。

核心結論：

- `ok` 是唯一成功。
- `duplicate` 明確標為**非成功**，只進三處核對。
- v5 cap/stale gate 不影響試點期 v4/bot/curl。
- unknown 沿用 byte-equal 原 payload／原 ID；不得改寫或假稱失敗。

## ⑦ §0-2 bot hook 實查

| 項目 | 本回合結果 |
|---|---|
| 本機 bot source | HEAD `ffbb739`；`ORDER_STORE_WEBHOOK_URL`／`ORDER_WAREHOUSE_WEBHOOK_URL` env 名稱吻合 |
| Fly 運行中 env 是否等於 Make 兩 hook | **UNVERIFIED**：此 Codex 環境的 Fly CLI 無 access token；沒有拿舊回覆冒充 live 證據 |
| bot ACK 白名單 | live local source 仍只有 `{ok,duplicate,held}`；缺 `preflight_unavailable`、`over_cap`、`stale_price` |
| Netlify live SHA | **UNVERIFIED**：repo 無 `.netlify/state.json`、本機無 Netlify CLI／site identity；未猜測 |

Phase C 前 Claude 必須在有授權的環境補讀 Fly process env（只比 hash／不外洩 URL）與 Netlify SHA。

## ⑧ 金額正規化

契約：

1. `String(value).replace(/,/g,'').trim()`。
2. 只接受 `digits` 或 `digits.1–2`；拒絕科學記號、NaN、空、負、0、超 2 位小數。
3. 數值必須 finite 且 `>0`。
4. `minor=Math.round(value*100)`，並以 `abs(value*100-minor)<1e-6` 守住浮點邊界。
5. 所有總額用 `minor*qty` 整數相加。

已覆蓋：`1812.5`、`0.01`、`7,035.00`、`22050.0` 通過；`1812.505`、NaN、負、0 拒絕。

倉管雙總額語意：payload／stale compare＝ΣE；50 萬 cap＝ΣD。這兩個變數不可共用，D 不得進前端。

## Phase C 前置阻擋（未解不得 PATCH）

1. **v1.5 R10-F 允許清單漏 [107]/[108]**：live 兩個警示模組仍引用將移除的 `{{4.0}}`。需 Claude 書面增列兩個機械 mapper 置換為 `{{3.name}}`；文字、收件人、連線與路由不動。
2. **bot 缺 `preflight_unavailable` ACK**：完整性＋probe 對所有呼叫方生效，bot 可能收到此狀態；後端上線前須定案 bot 誠實文案或確保回應收斂，不可讓它誤報未知後盲動。

## 紅線遵守聲明

- 沒有呼叫 `scenarios_update`／PATCH。
- 沒有 deploy／push／Netlify 操作。
- 沒有呼叫真 webhook；offline server 對 Make URL直接拒絕。
- 沒有測試資料進正式 Sheets、datastore 或 LINE 群。
- 沒有碰 4752742、bot repo、定價庫、dedup datastore 本體。
