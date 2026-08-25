# Phase C staging 驗證證據（2026-08-26·Claude 執行）

- staging 場景：branch 6050505／wh 6050507／T9 誘發 6050550（測畢即刪）；hook 2733782/2733784；datastore 138191；測試表 11lt-6xMyttKyPIMCKyqdvStsVX39giUx6Mdd-N-O_5s；全部推播目的地＝小洪測試房。
- 17/17 PASS：T4a/T4b（ok 全鏈）、T11a+T14（duplicate·ops=3=零讀價）、T1/T5/T8/T10a/T10b/T6b（held 六型·blockedItems 逐項正確）、T11c（被擋單號同號重試 ok=不燒號）、T12（7,035.00 千分位全鏈 ok）、T2b/T2w（over_cap 恰三欄·分店E上限30M/倉管D上限50M）、T3（stale 差1分）、T6a（無 clientVersion gate 放行）、T9（壞表→preflight_unavailable·號未燒）。
- 副作用鐵證：兩測試表各恰 5 列（=5 張 ok 單）、被擋單零寫入；datastore 恰 6 鍵；ok=13 ops／held=8／over=8／stale=6／dup=3 指紋一致。
- T-ACK 淨檢：全部 ACK 無 snapshot/dOriginal/dMinor 鍵（grep 驗）。T-PUSH：推播模板零金額（倉管線）／分店線僅申報 ΣE；文本正確性由模板層＋小洪測試房人工可見。
- ⚠️既有 live 怪癖（非 v5 造成）：千分位價格商品 D×qty 算術欄寫空（live [4] FORMATTED_VALUE 同病）——bug-for-bug 相容保留，另列資料衛生議題。

## 全部 ACK 原文
    T11a|{"status": "duplicate", "orderId": "STG-T4A"}
    T14|{"status": "duplicate", "orderId": "STG-T14-DUP"}
    T1|{"status": "held", "orderId": "STG-T1", "blockedItems": [{"itemIndex":0,"cx":"TCX05","name":"TCX05_測試空目的地","reason":"empty_dest"}]}
    T11c|{"status": "ok", "orderId": "STG-T1"}
    T5|{"status": "held", "orderId": "STG-T5", "blockedItems": [{"itemIndex":1,"cx":"TCX04","name":"TCX04_測試壞價","reason":"bad_price"}]}
    T8|{"status": "held", "orderId": "STG-T8", "blockedItems": [{"itemIndex":0,"cx":"cx404","name":"","reason":"no_match"},{"itemIndex":1,"cx":"cx405","name":"","reason":"no_match"}]}
    T10a|{"status": "held", "orderId": "STG-T10A", "blockedItems": [{"itemIndex":0,"cx":"TCX06","name":"TCX06_測試雙列","reason":"multi_row"}]}
    T10b|{"status": "held", "orderId": "STG-T10B", "blockedItems": [{"itemIndex":0,"cx":"TCX01","name":"","reason":"bad_qty"}]}
    T12|{"status": "ok", "orderId": "STG-T12"}
    T2b|{"status": "over_cap", "orderId": "STG-T2B", "capMinor": 30000000}
    T3|{"status": "stale_price", "orderId": "STG-T3", "serverTotalMinor": 12500, "declaredTotalMinor": 12501}
    T6a|{"status": "ok", "orderId": "STG-T6A"}
    T6b|{"status": "held", "orderId": "STG-T6B", "blockedItems": [{"itemIndex":0,"cx":"TCX05","name":"TCX05_測試空目的地","reason":"empty_dest"}]}
    T4b|{"status": "ok", "orderId": "STG-T4B"}
    T2w|{"status": "over_cap", "orderId": "STG-T2W", "capMinor": 50000000}
    T1w|{"status": "held", "orderId": "STG-T1W", "blockedItems": [{"itemIndex":0,"cx":"TCX05","name":"TCX05_測試空目的地","reason":"empty_dest"}]}
