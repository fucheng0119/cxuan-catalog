# Phase C live 上線證據（2026-08-26 04:40-04:46 台北·Claude 執行）

## 上線程序
- before 檔：audit/make-backups/{5091914,5000701}-20260826-before-v5-preflight.json（PATCH 前實測零漂移）
- applied／readback 檔：同資料夾 -applied-v5-preflight.json／-readback-v5.json
- flat-diff 驗證器（build-v5-blueprint.py 同源）：新增模組限 300-331、移除僅[4]、mapper/filter 置換全在允許清單（含 [9] 目的地非空縱深 filter＝同款置換、[200] 僅承載 pass 路 filter）→ PASS
- PATCH＝blueprint＋scheduling 同一呼叫；讀回三重驗證：isActive ✓ scheduling=immediately ✓ 結構=applied byte 級 ✓ module312 codeEditorJavascript sha256=4d4a869d… ✓（兩線）

## live 零寫入驗證（皆 PROBE 單號·前後對照）
- 基線→事後：日誌 859→859、央帳 1261→1261、ds124620 77→77；PROBE-LIVEV5-* 未入 dedup（不燒號）
- ops 指紋：held=8／over_cap=8／stale=6／duplicate=3（零讀價實錘）
    L1-held|{"status": "held", "orderId": "PROBE-LIVEV5-HELD", "blockedItems": [{"itemIndex":0,"cx":"PROBETEST99","name":"探針假品","reason":"no_match"}]}
    L2-overcap|{"status": "over_cap", "orderId": "PROBE-LIVEV5-OVER", "capMinor": 30000000}
    L3-stale|{"status": "stale_price", "orderId": "PROBE-LIVEV5-STALE", "serverTotalMinor": 1700000, "declaredTotalMinor": 1700001}
    L4-dup|{"status": "stale_price", "orderId": "ORD-員林-260825-160307", "serverTotalMinor": 1700000, "declaredTotalMinor": 100}
    L4-redo|{"status": "duplicate", "orderId": "ORD-中部倉-260825-113928"}

## 附註
- L4 首發用 ORD-員林-260825-160307 回 stale 非 bug：該單為店小二打字單（4752742）從不進 dedup；改用真 LIFF 單 ORD-中部倉-260825-113928 重驗=duplicate ✓（且 declared 亂填也回 duplicate=r4 點2語義 live 實證）
- 推播噪音：老闆 2 則、倉管群 1 則（PROBE 標示）；分店群零打擾（over_cap 群推播導向小洪測試房）
- staging 資產全清（場景×5/hook×5/datastore）；測試試算表 TEST-LIFF-v5-staging-20260826 屬 boxcage12 雲端（sheets-proxy 無刪除端點）＝留置無害、名稱已標 TEST
- 既有 live 資料衛生議題（非 v5）：千分位價格商品之 D×qty 算術欄寫空（今日 live 同病）＝另案
- 探針哨兵（09:10）用固定 PROBE 單號＝v5 後走 probe-duplicate 3 ops，wire 狀態不變、不受影響
