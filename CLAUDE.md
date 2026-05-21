# 澄軒 cxuan-catalog 重要 MCP 工具備忘

## 📊 Sheet 寫入工具（Make.com MCP）

**MCP server**: `mcp.make.com`
**Internal ID**: `cf68c669-de81-476b-b1b0-87cfbf4860a3`
**用途**: 讓 Claude 可以**直接寫入 Google Sheets** 的 cell

### 主要工具
- `mcp__cf68c669-de81-476b-b1b0-87cfbf4860a3__s5027182_sheet_batch_update`
  - 對 Google Sheets 做 `values:batchUpdate`（精確指定 range + values）
  - 參數：
    - `spreadsheet_id`：Google Sheets ID
    - `data_json`：JSON 字串，格式 `{"valueInputOption":"USER_ENTERED","data":[{"range":"工作表名!A1:B2","values":[[...]]}, ...]}`

### 使用範例
```json
{
  "spreadsheet_id": "1GB9OAla1Hsxj7N036kAZcN_qVkQuwxxbBsyyhGZPCYc",
  "data_json": "{\"valueInputOption\":\"USER_ENTERED\",\"data\":[{\"range\":\"建立自動化 ERP 資料庫結構!D118\",\"values\":[[\"17317\"]]}]}"
}
```

### 重要提醒
- 工具是「deferred tool」（不會自動載入）。先用 `ToolSearch query="select:mcp__cf68c669-de81-476b-b1b0-87cfbf4860a3__s5027182_sheet_batch_update"` 載入 schema 才能 call。
- 工具一旦載入後本對話內可直接呼叫。新對話開始時要重新 ToolSearch 載入。
- 若 ToolSearch 找不到，可能是 OAuth token 過期，要先 `mcp__cf68c669-de81-476b-b1b0-87cfbf4860a3__authenticate` 走 OAuth 流程。

---

## 🔍 Sheet 查詢工具（Apps Script MCP）

**MCP server**: Apps Script (`script.google.com/macros/s/AKfycbzWl0-yLyiIkiRSLXPubXNXccMZkdXNffVLqoeB_IuQZK7VT0EQdyudfH8cexfpxbjCWA`)
**Internal ID**: `92341622-c118-4047-b65f-0b82663dd77a`
**用途**: 全文搜尋澄軒體系內所有 Sheet 資料（商品定價庫、淨利總表、薪資表等）

### 主要工具
- `mcp__92341622-c118-4047-b65f-0b82663dd77a__search_cxuan_data`
  - 參數：`query`（搜尋字串）
  - 回傳：跨多個 sheet 的命中清單，含 sheet 名、列號、整列內容、URL

### 重要 sheet ID 速查
- **商品定價庫 / 建立自動化 ERP 資料庫結構**：`1GB9OAla1Hsxj7N036kAZcN_qVkQuwxxbBsyyhGZPCYc`
  - 工作表名：`建立自動化 ERP 資料庫結構`
  - 規則：cx編號 `cxN` 對應 row 號**不一定** = N+1（早期 cx1-cx179 是 N+1，cx117 = row 118，但 cx365 起會偏移成 row 369，後加插的 cx550+ 完全打亂 row 序），**寫入前一定要先 search_cxuan_data 確認真實 row 號**。
- **澄軒淨利總表 / 門市軍需定價融合總表**：`1iV_AopnBN5QriwE6X0l0x2NvaSgS8pVLKsGiIlOyQLI`

### 商品定價庫欄位結構
| 欄 | 內容 |
| :-: | :-- |
| A | cx編號_品名 |
| B | 中部發貨方式（總倉出貨 / 廠商直寄） |
| C | 外區發貨方式 |
| D | **總部進貨成本（應付廠商）** |
| E | **分店批發價（應收分店）** |
| F | 負責廠商/單位 |
| G | 廠商 LINE 群組 ID（發貨方） |
| H | **終端建議售價（死豬價）** |
| I | 廠商 LINE 群組 ID（進貨方） |
| J | A 欄備份 |

### 業務規則
- **毛利率上限 25%**：`(E - D) / E ≤ 25%`。超過者要砍 E 到 `D / 0.75` 取整百。
- **末端售價**要對齊**廠商提供的最新促銷價**（Q2 PDR 或進貨表為準）。

### 重要 LINE 群組 ID
- **3M 進貨方**：`Cb4c776aa6592015935eb1c0254d74f02`
- **盛智_3m商用**：`C09f92d9060059d82524046e7de8767f5`
- **中部倉管（總倉發貨）**：`Cd8014768f521fa98bc716cf522fe91c6`

---

## 📁 Drive MCP

**MCP server**: `drivemcp.googleapis.com`
**Internal ID**: `a1d2a20f-757f-4074-af3e-c09309435212`
**用途**: 讀 Google Drive 檔案內容（Sheets 整表轉 Markdown、Docs、Excel）

### 主要工具
- `mcp__a1d2a20f-757f-4074-af3e-c09309435212__read_file_content`：讀檔案內容（會截斷大檔）
- `mcp__a1d2a20f-757f-4074-af3e-c09309435212__download_file_content`：下載檔案二進位

---

## 🔁 工作流程：要改 sheet 時的 SOP

1. **先用 `search_cxuan_data`** 確認目標 cx 編號的真實 row 號
2. **整理批次寫入清單**（列 cell A1 + 新值）
3. **ToolSearch 載入** `s5027182_sheet_batch_update` schema
4. **一次 batch update** 全部寫入（不要逐個 cell 寫，浪費 API quota）
5. 完成後給用戶 sheet 連結讓他打開核對

---

## 🚨 千萬不要再忘記

之前數次對話因為「忘記有 Make MCP 可以寫表」而走錯路（用 Drive 讀+列清單請 user 手動填），這完全違反 organization instructions「叫使用高級座位的人動手非常不划算」。

只要 cf68c669 (Make) MCP 還在訂閱中，**永遠優先用它寫表**，不要再退回到「列清單給 user 手動貼」的方案。
