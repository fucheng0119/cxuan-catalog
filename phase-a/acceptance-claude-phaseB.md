# Phase B：Claude 對抗審驗收紀錄（LIFF 安全確認 v5）

- 日期：2026-08-26｜驗收：Claude（Fable）｜對象：branch `liff-v5-safe-confirm` @ `0f8426a`（Codex Phase A 交付）
- **結論：Phase A 對抗審 PASS（有條件）**——前端兩檔與後端提案品質合格；Phase C 開工前置＝下方「v1.6 窄幅修正案」四項經 Sol delta 審＋老闆核准。本輪零施工零 PATCH 零部署零真 webhook。

## 一、獨立重驗（⛔未採信任何自報結果）
| 項 | 方法 | 結果 |
|---|---|---|
| repo 狀態 | git 實查 | branch 未 push（remote 0）、main 原封 @699c002（live Pages 零風險）、工作樹乾淨。⚠️交付轉述「12 檔+1960/−430」不準，git 實際 **17 檔 +1960/−331**（報告本文①正確） |
| 測試 | 本機重跑 | canonical→branch **97 PASS**、wh **95 PASS**、預檢模型 **31 PASS**；`node --check` 四檔 OK；測試檔與離線 server 均無真網路（server 對 hook.us2 直接 throw） |
| §7 greps | 兩檔 | slice(0,18)/舊held句/store-select/成本合計＝0；capMinor/clientVersion/totalDeclaredMinor/itemIndex/needs_reconciliation 在場；解鎖 UI/UNLOCK_ADMINS＝0 |
| 前端 diff | 兩檔全文精讀 | R1–R8、R11 全數符合 v1.5（含 fail-closed 重抓、備註跨重繪、五態持久化、結案雙確認+journal 去 PII、escapeHtml 加分）；倉管端無前端 ΣE 擋（正確）、說明列在 |
| 藍圖提案 | 對 live 藍圖結構驗證 | 插入段限 [1]-[200]；[107][108] 未偷渡（隔離待核准 ✓）；ackSchema 欄位白名單式 ✓；15 路徑枚舉合理（P13 誠實無 ACK ✓） |
| §0-2 bot hook | Fly ssh printenv→sha256 比對（URL 未外洩） | **實錘同兩支 hook**：ORDER_STORE=88twj…hash 吻合、ORDER_WAREHOUSE=1cdd…hash 吻合 |
| bot ACK 行為 | 讀碼 execute.mjs | ACKS={ok,duplicate,held}（L25）；duplicate→needs_reconciliation（既有）；unknown→鎖草稿+byte-identical 重送+完整性封鎖＝**preflight_unavailable 落 bot unknown 流是安全收斂**→裁定：非 Phase C 阻擋，精準文案併 GA bot 工單 |
| Netlify 回滾錨點 | curl 正確站 `joyful-puffpuff-e51970` | `/` 與 `/cxuan-warehouse.html` 均 200；**live wh SHA `6a9e5af9…`＝repo main byte 級一致** ✓ 錨點成立 |
| [107][108] | live 藍圖 mapper 實讀 | **兩模組均引用 `{{4.`0`}}`**——Codex 阻擋一成立 |

## 二、Claude 新抓問題（交付未報）
1. **🔴 D 反推 oracle（必修）**：倉管 over_cap ACK 依提案帶 `serverTotalMinor=ΣD`；倉管 hook URL 寫死於公開 Netlify 頁原始碼→任何取得 URL 者可灌 qty 構造超額單、由 ΣD/qty 反推單品 D。→ 修正案 (c)。
2. **🔴 reference 非 pass 回傳夾帶 snapshot（含 dOriginal/dMinor）（必修）**：held/over_cap/stale 的 result 物件含 snapshot——Phase C 若 respond body 整包映射即全面洩 D。→ 修正案 (d)（源頭剝除＋staging ACK body 驗無 D 欄位）。
3. **🟡 live `/`（index）與 `/cxuan-warehouse.html` 內容不同**（SHA f4c6fec3 vs 6a9e5af9；鐵則要求雙檔同內容）→ Phase D 部署包一併矯正並查明 index 現為何版。
4. 🟢 小瑕疵三件（不擋門）：下架品錯誤訊息被通用「價庫讀不到」吃掉；目錄含壞價時 cart bar 顯示 $0（送出仍 fail-closed）；stale_price 未自動重抓（但重送路徑必經重抓＝語義等效）。wh `WAREHOUSE_CAP_MINOR` 為死常數。

## 三、v1.6 窄幅修正案（草案·待 Sol delta 審＋老闆核准後由 Claude 落單）
(a) R10-F 允許清單增列：**[107]/[108] 僅允許 `{{4.`0`}}→{{3.name}}` mapper 置換**，文字/收件人/連線/路由零改動（live 實錘引用存在，不改則縱深 held 路引用已移除模組）。
(b) R10-C 等效機制認可：**getSheetContent(A:I)+ExecuteCode 單次讀取計數**取代 filterRows limit=2（0/1/2+ 計數語義等效；整單單讀=TOCTOU 更緊+省 ops）；**module 312 程式碼＝審定 hash 固定之 `liff-v5-preflight-reference.js`，Phase C 由 Claude 貼入，⛔臨場改寫**。
(c) **over_cap ACK 兩線一律移除 `serverTotalMinor`**（schema 改 `{status,orderId,capMinor}`）；ΣD/ΣE 明細只進老闆/群 push——封 D oracle。前端現實作本就不顯示 server 數字＝前端零改動。
(d) **reference `runPreflight` 非 pass 狀態回傳剝除 `snapshot`**（改後重跑 31 斷言＋重定 hash）；Phase C 驗收加測：staging 實測 held/over_cap/stale ACK body **無 snapshot/dOriginal/dMinor 鍵**。

## 四、Phase C 其餘前置（既定，非新增）
staging scenario（測試表+測試群+獨立 hook+staging datastore）全鏈→live PATCH（before 檔+scheduling 查）→live 僅零寫入測試；bot GA 工單（totalDeclaredMinor/clientVersion/itemIndex/ACKS 擴充含 preflight_unavailable/duplicate 文案）；curl SOP 卡補欄。

— 以上證據均可由本檔所列方法重放。驗收人：Claude（Fable）2026-08-26。
