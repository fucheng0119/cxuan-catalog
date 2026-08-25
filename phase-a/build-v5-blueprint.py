#!/usr/bin/env python3
"""LIFF v5 blueprint transformer (Phase C).
用法: build-v5-blueprint.py <before.json> <branch|wh> <staging|live> <out.json> <config.json>
config.json: {"stagingHookId":N,"stagingDatastoreId":N,"testSpreadsheetId":"…","testRoom":"C…",
              "makeReadyPath":"phase-a/liff-v5-preflight-make.js"}
單一來源產 staging / live 兩種藍圖：v5 修改完全相同，staging 只把資源(hook/datastore/表/推播目的地)換成測試資源。
允許改動=R10-F 五類＋插入預檢段；[200] 本體 param/mapper/onerror 零改動、僅承載 pass 路 route filter（flat-diff 揭露）。
"""
import json, sys, re

WAREHOUSE_GROUP = "Ccbe9fe0367d2ee9305493e94bb7ef15b"
OWNER = "U206f2f4e05e7f1ed4aff214c370bbfbc"
LINE_CONN = 8097199
SHEETS_CONN = 8017295
PRICE_SS = "1GB9OAla1Hsxj7N036kAZcN_qVkQuwxxbBsyyhGZPCYc"
PRICE_TAB = "建立自動化 ERP 資料庫結構"

HELD_TEXT = ("⚠️【LIFF v5 已整單擋下・未寫帳未派單】\n🆔 {{1.orderId}}\n🏬 {{1.store}} / 👤 {{1.user}}\n"
             "原因品項：\n{{312.result.blockedText}}\n➡️ 整單未寫日誌、未記帳、未通知廠商；修正後請重新確認送出。")
OVER_BR = ("⛔【LIFF v5 已擋下・超過分店單筆上限】\n🆔 {{1.orderId}}\n🏬 {{1.store}} / 👤 {{1.user}}\n"
           "申報批發合計 NT${{1.totalDeclaredMinor / 100}}、上限 NT${{312.capMinor / 100}}。\n整單未寫帳、未通知廠商，請拆單後重新下單。")
OVER_WH = ("⛔【LIFF v5 已擋下・超過倉管成本上限】\n🆔 {{1.orderId}}\n🏬 {{1.store}} / 👤 {{1.user}}\n"
           "本單超過總部成本上限，整單未寫帳、未通知廠商。請拆單或聯絡老闆處理。")

SWAPS = [("4.`0`", "3.name"), ("4.`2`", "3.cOriginal"), ("4.`3`", "3.dOriginal"),
         ("4.`5`", "3.vendor"), ("4.`6`", "3.destinationId"), ("4.`7`", "3.hOriginal"),
         ("4.`8`", "3.destinationId")]

def respond(mid, body, name):
    return {"id": mid, "module": "gateway:WebhookRespond", "version": 1, "parameters": {},
            "mapper": {"body": body, "status": "200", "headers": [{"key": "Content-Type", "value": "application/json"}]},
            "metadata": {"designer": {"x": 0, "y": 0, "name": name}}}

def push(mid, to, text, name):
    return {"id": mid, "module": "line:sendPushMessages", "version": 1,
            "parameters": {"__IMTCONN__": LINE_CONN},
            "mapper": {"to": to, "messages": [{"text": text, "type": "text"}], "notificationDisabled": False},
            "metadata": {"designer": {"x": 0, "y": 0, "name": name}}}

def ignore(mid):
    return {"id": mid, "module": "builtin:Ignore", "version": 1, "parameters": {}, "mapper": None,
            "metadata": {"designer": {"x": 0, "y": 0}}}

def sfilter(name, a, o, b):
    return {"name": name, "conditions": [[{"a": a, "o": o, "b": b}]]}

def build(before_path, line, mode, out_path, cfg_path):
    cfg = json.load(open(cfg_path))
    make_ready = open(cfg["makeReadyPath"], encoding="utf-8").read()
    d = json.load(open(before_path))
    bp = d.get("response", d).get("blueprint", d.get("blueprint"))
    flow = bp["flow"]
    assert [m["id"] for m in flow[:2]] == [1, 200], "unexpected head"
    webhook, add200 = flow[0], flow[1]
    tail = flow[2:]                      # [3],[4],... 主鏈其餘
    tail = [m for m in tail if m["id"] != 4]   # 允許清單②移除 [4]
    # 允許清單①：[3] 改吃快照（code 模組輸出掛在 result.* 底下＝2026-08-26 實測）
    for m in tail:
        if m["id"] == 3:
            m["mapper"]["array"] = "{{312.result.snapshot}}"
    # 允許清單③④⑤：{{4.*}} 全域置換（[4] 已移除，其餘引用=主鏈+107/108+106條件）
    s = json.dumps(tail, ensure_ascii=False)
    for a, b in SWAPS:
        s = s.replace(a, b)
    assert "{{4." not in s, "殘留 {{4.*}} 引用"
    tail = json.loads(s)

    staging = mode == "staging"
    ds = cfg["stagingDatastoreId"] if staging else 124620
    price_ss = cfg["testSpreadsheetId"] if staging else PRICE_SS
    room = cfg["testRoom"]
    wh_group = room if staging else WAREHOUSE_GROUP
    owner = room if staging else OWNER

    if staging:  # 資源置換（不動語義）
        webhook = dict(webhook); webhook["parameters"] = dict(webhook["parameters"]); webhook["parameters"]["hook"] = cfg["stagingHookId"]
        s2 = json.dumps(tail, ensure_ascii=False)
        s2 = s2.replace("1JF59y7c03tNibE7rdNjLOuIaAJ6x-WLgxwmHrlwo9Do", cfg["testSpreadsheetId"])
        s2 = s2.replace("1YUwfjWNmK5TRr9CfZu8SPiD7Om--TAWMOCrS93Dt84w", cfg["testSpreadsheetId"])
        s2 = s2.replace(WAREHOUSE_GROUP, room).replace(OWNER, room)
        tail = json.loads(s2)
    add200 = json.loads(json.dumps(add200).replace("124620", str(ds))) if staging else add200
    # [200] 承載 pass 路 filter（本體其餘零改動）
    add200 = dict(add200); add200["filter"] = sfilter("預檢=pass 才進冪等閘", "{{312.result.status}}", "text:equal", "pass")

    pre_err = lambda mid: [respond(mid, '{"status": "preflight_unavailable", "orderId": "{{1.orderId}}"}', "預檢不可用"), ignore(mid + 1)]

    m300 = {"id": 300, "module": "datastore:ExistRecord", "version": 1,
            "parameters": {"datastore": ds}, "mapper": {"key": "{{1.orderId}}"},
            "metadata": {"designer": {"x": 0, "y": 0, "name": "A0 orderId probe(唯讀)"}},
            "onerror": pre_err(303)}
    m310 = {"id": 310, "module": "google-sheets:getSheetContent", "version": 2,
            "parameters": {"__IMTCONN__": SHEETS_CONN},
            "mapper": {"select": "map", "spreadsheetId": price_ss, "sheetId": PRICE_TAB, "range": "A:I",
                       "includesHeaders": True, "valueRenderOption": "FORMATTED_VALUE", "dateTimeRenderOption": "FORMATTED_STRING"},
            "metadata": {"designer": {"x": 0, "y": 0, "name": "唯一價庫讀取A:I"}},
            "onerror": pre_err(305)}
    m310["filter"] = sfilter("probe=不存在才預檢", "{{300.exist}}", "boolean:equal", "false")
    m311 = {"id": 311, "module": "builtin:BasicAggregator", "version": 1, "parameters": {"feeder": 310},
            "mapper": {"A": "{{310.`0`}}", "C": "{{310.`2`}}", "D": "{{310.`3`}}", "E": "{{310.`4`}}",
                       "F": "{{310.`5`}}", "G": "{{310.`6`}}", "H": "{{310.`7`}}", "I": "{{310.`8`}}"},
            "metadata": {"designer": {"x": 0, "y": 0, "name": "價庫rows聚合"}},
            "onerror": pre_err(307)}
    m312 = {"id": 312, "module": "code:ExecuteCode", "version": 1, "parameters": {},
            "mapper": {"codeEditorJavascript": make_ready, "language": "javascript", "inputFormat": "editor",
                       "input": [{"name": "orderId", "value": "{{1.orderId}}"},
                                 {"name": "store", "value": "{{1.store}}"},
                                 {"name": "groupId", "value": "{{1.groupId}}"},
                                 {"name": "user", "value": "{{1.user}}"},
                                 {"name": "userId", "value": "{{1.userId}}"},
                                 {"name": "note", "value": "{{1.note}}"},
                                 {"name": "clientVersion", "value": "{{1.clientVersion}}"},
                                 {"name": "totalDeclaredMinor", "value": "{{1.totalDeclaredMinor}}"},
                                 {"name": "items", "value": "{{1.items}}"},
                                 {"name": "rows", "value": "{{311.array}}"},
                                 {"name": "route", "value": "branch" if line == "branch" else "wh"}]},
            "metadata": {"designer": {"x": 0, "y": 0, "name": "整單預檢(審定hash程式)"}},
            "onerror": pre_err(330)}

    m314 = push(314, wh_group, HELD_TEXT, "held→倉管群"); m314["filter"] = sfilter("held", "{{312.result.status}}", "text:equal", "held")
    m315 = push(315, owner, HELD_TEXT, "held→老闆")
    m316 = respond(316, '{"status": "held", "orderId": "{{1.orderId}}", "blockedItems": {{312.result.blockedItemsJson}}}', "回held")
    over_group_to = "{{1.groupId}}" if line == "branch" else wh_group
    over_text = OVER_BR if line == "branch" else OVER_WH
    m317 = push(317, over_group_to, over_text, "over_cap→群(零D)"); m317["filter"] = sfilter("over_cap", "{{312.result.status}}", "text:equal", "over_cap")
    m318 = push(318, owner, over_text, "over_cap→老闆")
    m319 = respond(319, '{"status": "over_cap", "orderId": "{{1.orderId}}", "capMinor": {{312.result.capMinor}}}', "回over_cap")
    m320 = respond(320, '{"status": "stale_price", "orderId": "{{1.orderId}}", "serverTotalMinor": {{312.result.serverTotalMinor}}, "declaredTotalMinor": {{312.result.declaredTotalMinor}}}', "回stale_price")
    m320["filter"] = sfilter("stale_price", "{{312.result.status}}", "text:equal", "stale_price")

    m313 = {"id": 313, "module": "builtin:BasicRouter", "version": 1, "parameters": {}, "mapper": None,
            "metadata": {"designer": {"x": 0, "y": 0, "name": "預檢分流"}},
            "routes": [{"flow": [m314, m315, m316]},
                       {"flow": [m317, m318, m319]},
                       {"flow": [m320]},
                       {"flow": [add200] + tail}]}
    m302 = respond(302, '{"status": "duplicate", "orderId": "{{1.orderId}}"}', "probe命中→duplicate")
    m302["filter"] = sfilter("probe=已註冊", "{{300.exist}}", "boolean:equal", "true")
    m301 = {"id": 301, "module": "builtin:BasicRouter", "version": 1, "parameters": {}, "mapper": None,
            "metadata": {"designer": {"x": 0, "y": 0, "name": "probe分流"}},
            "routes": [{"flow": [m302]},
                       {"flow": [m310, m311, m312, m313]}]}

    bp["flow"] = [webhook, m300, m301]
    if staging:
        bp["name"] = f"TEST-liff-v5-staging-{line}"
    json.dump(bp, open(out_path, "w"), ensure_ascii=False)
    print(f"built {mode}/{line} -> {out_path} ({len(json.dumps(bp))} bytes)")

if __name__ == "__main__":
    build(*sys.argv[1:6])
