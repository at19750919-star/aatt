# WAA 介面（前端單頁）

線上版（GitHub Pages）：

- 立即開啟：https://at19750919-star.github.io/aatt/

這個 repo 是一個純前端（HTML/CSS/JS）的小工具，不需要後端，就能在瀏覽器使用或部署到 GitHub Pages。

## 線上版（GitHub Pages）

開啟 GitHub 專案 Settings → Pages，依下列設定：

- Build and deployment → Source: Deploy from a branch
- Branch: `main`，Folder: `/root`
- 儲存後，稍等 1～2 分鐘，GitHub 會顯示你的網站網址。
- 本專案網址：
  - https://at19750919-star.github.io/aatt/

如果想避免 Jekyll 解析（本專案已添加 `.nojekyll`），保持原樣即可。

## 本機使用

- 直接雙擊 `index.html` 用瀏覽器開啟
- 或用任何靜態伺服器（例如 `npx serve`）在本機啟動

## 主要功能

- 核心：設定靴數、訊號色、和局訊號、尾段等，點「創建」生成
- 模擬：切牌、換色，自動卡色交換（卡色）與套用
- 統計：顯示花色/牌面統計，並提供預覽與 Excel/CSV 匯出
- 左/右表格：
  - 左側「詳細表格」顯示每局與卡牌
  - 右側「預覽與列印」顯示 15×28 網格，可列印或另開視窗
- 警示面板：
  - 花色訊號殘留（創建後顯示，已移至中間「模擬」卡片下方單行 chip）
  - 卡色交換警示（卡色後顯示於統計卡下方）

## 匯出

- 右側「Excel」：輸出 .xlsx，含顏色、T_idx 外框與版面設定
- 「導出」：輸出處理後 CSV（回放/分析用）

## 操作小抄（無需安裝）

- 「創建」：生成一組牌靴
- 「卡色」：依規則進行就近交換，之後按「套用」更新統計與預覽
- 「預覽」/「列印」：右側網格另開視窗或直接列印
- 「Excel」：依右側預覽 15×28 版面輸出 .xlsx

### 快捷鍵（已內建）
- Z：進入「編輯」模式（選兩張牌後按 X 交換）
- X：卡交換（手動交換已選兩張牌）
- K：卡色（自動交換）
- A：套用
- G：創建
- V：預覽
- Ctrl+X：Excel 匯出
- U：CSV 導出
- C：切牌
- Esc：取消編輯
- ?：顯示快捷鍵提示

瀏覽器通用快捷：
- `Ctrl+P` 列印
- `Tab` 在按鈕/欄位間切換焦點，`Enter` 觸發

## 開發備忘

- 主要檔案：
  - `index.html`：結構與控制元件
  - `style.css`：整體樣式、表格與預覽網格
  - `script.js`：邏輯、渲染、Excel 匯出與警示面板
- 無後端依賴，適合放在任意靜態主機

## 常見問題

- 啟用 GitHub Pages 後網址在哪？
  - 回到 Settings → Pages，最上方會出現網站 URL；或使用 `https://<帳號>.github.io/<repo>/`。
- Excel 顏色或框線不對？
  - 請用支援的桌面版 Excel 開啟；Web 版少數樣式可能略有差異。

---
有需要我可以再補上「鍵盤快捷鍵」功能（例如快速觸發創建/卡色/預覽），或幫你自動化 Pages 發佈（GitHub Actions）。
