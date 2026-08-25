# LIFF v5 ACK × 呼叫方矩陣（Phase A）

| ACK／結果 | v5 分店／倉管 | v4 LIFF | 嘴炮王 bot（現況） | curl／其他舊呼叫 | 前端／呼叫方語意 |
|---|---|---|---|---|---|
| `ok` | 啟用 | 啟用 | ACK 白名單有 | 啟用 | **唯一成功**；可清 pending |
| `duplicate` | 啟用 | 已知狀態 | ACK 白名單有，但 GA 前須改文案 | 規範須補警示 | **非成功**；完成度未確認、三處核對 |
| `held` | 完整性全呼叫方啟用 | 啟用 | ACK 白名單有 | 啟用 | 整單零寫入；依 blockedItems 修正 |
| `over_cap` | 僅 `clientVersion=liff-v5` | gate 不跑 | 試點 gate 不會收到；GA 前擴 ACK | 缺 v5 欄不跑 | 零寫入；新草稿／新單號 |
| `stale_price` | 僅 `clientVersion=liff-v5` | gate 不跑 | 試點 gate 不會收到；GA 前擴 ACK | 缺 v5 欄不跑 | 零寫入；強制價庫重抓後重建 |
| `preflight_unavailable` | 啟用 | 啟用 | **現行 ACKS 未含**；須在後端上線前決定 fail-closed 文案 | 呼叫端須保留原單號重試 | dedup 前零寫入；草稿＋原 ID 保留 |
| 無 ACK（unknown） | 鎖定＋byte-equal 原單重送 | v4 現有未知資產不得削弱 | 現行誠實 unknown 契約 | 不得假稱失敗 | dedup 後完成度未知；不清 payload |

## 實測／靜態證據標記

- v5 兩 HTML：離線 VM mock 已逐狀態注入 ACK，沒有呼叫真 webhook。
- `ok/duplicate/held/over_cap/stale_price/preflight_unavailable/unknown`：兩 HTML 狀態分支與持久化測試全綠。
- bot live source（2026-08-26 本機 HEAD `ffbb739`）的 `ACKS` 仍只有 `ok, duplicate, held`；因此 `preflight_unavailable` 對 bot 是本次施工中發現的 GA／後端上線前契約缺口，不能假稱已支援。
- Phase C staging 才能把本表的後端路徑由「離線模型」升格成「Make execution 實測」。本 Phase A 沒有真 webhook 證據，也不應有。
