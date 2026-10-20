# 台灣颱風假機率觀測平台

原生 JavaScript 靜態網站，預設進入極致全息版，載入後自動循環播放預報時間軸，可隨時暫停或拖曳；亦可切換至莫蘭地極簡版。資料管線讀取中央氣象署（CWA）公開颱風消息及人事行政總處（DGPA）公告，依本地規則估算 22 縣市的颱風影響，選用 Gemini 產生文字摘要。

機率是未經校準的模型推估，不是官方停班停課決定；雲系、風場與雨帶是視覺模擬，不是實測雷達回波。停班停課以各縣市政府正式公告為準。

## 功能與資料狀態

- 依官方消息分別顯示每顆活躍颱風的現況與未來路徑，時間軸可播放、拖曳或點選預報節點。
- 地圖顯示來源提供的七級／十級風圈與路徑潛勢；缺少十級風圈時不補造半徑。
- 縣市風力與入圈判定使用該時間點的位置；雨量為模型估算的 24 小時累積量。
- 摘要依當次颱風資料產生，切換颱風會同步切換摘要。
- 官方確認沒有活躍颱風時顯示無颱風狀態，不據此推論一般天氣或政府是否停班停課。
- CWA 連線、格式或必要資料驗證失敗時，更新命令失敗並保留上一份 JSON。畫面分別顯示資料產生時間、官方觀測時間，資料超過兩個更新週期會提示逾期。
- DGPA 以縣市公告資料列判讀；來源不可用或無法辨識時標示未知，不當作沒有公告。
- 手機版將氣壓、風速、半徑與移動資訊放在地圖外，保留完整縣市點選範圍，並提供地圖、縣市及最新消息導覽。
- 最新消息從中央通訊社生活 RSS 與公視新聞網 Atom 取得近 7 天颱風相關報導，每 3 小時整理，按發布或更新時間排序、去除重複並保留最多 12 則。只保存標題、來源、新聞時間與原文連結，不保存新聞全文。
- 新聞部分來源失敗時標示部分更新；全部失敗時保留仍在 7 天內的快取並標示上次成功時間，過期新聞不再顯示。沒有新聞與來源更新失敗是不同狀態。
- 頁面每 5 分鐘讀取已產生的新聞 JSON（隱藏分頁暫停抓取），每分鐘重算文章期限與來源時效；也可手動重新載入。

## 本機使用

需要 Node.js 22 與 Python 3，沒有外部 npm 套件相依。

```bash
# 離線回歸測試；不呼叫真實 API、不改寫網站資料
npm test

# 讀取官方資料，成功後以原子替換方式更新 data/typhoon-data.json
npm run update-data

# 獨立更新新聞連結至 data/news.json
npm run update-news

# 本機預覽：http://127.0.0.1:4173
npm start
```

`buildTyphoonDataset()` 只回傳資料。正式寫入由 CLI 顯式呼叫 `writeTyphoonDatasetAtomic()`，測試使用固定來源回應與暫存目錄。

## GitHub Pages 與定時更新

1. 在 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
2. 選擇性設定 repository secret `GEMINI_API_KEY`，用於 Gemini 文字摘要。未設定或呼叫失敗時，使用本次資料產生規則摘要。
3. CWA 使用公開的 `TY_NEWS-Data.js`，不需要 `CWA_API_KEY`；目前沒有串接需要授權碼的 OpenData API。

更新 workflow 每 3 小時執行（臺灣時間 02、05、08、11、14、17、20、23 時），亦可手動觸發：

1. 執行離線測試。
2. 分別更新預報與新聞；預報來源失敗不覆蓋原預報，新聞全部來源失敗則保存明確的過期狀態及有效快取。任一更新失敗不阻擋另一份資料更新。
3. 提交可用資料與來源狀態，取得該次 commit SHA。
4. 直接呼叫共用部署 workflow，部署該 SHA 的網站。
5. 回報來源更新結果；若任一更新命令失敗，即使可用資料已部署，整個 workflow 仍標為失敗，避免把更新失敗當成完全成功。

更新流程不依賴機器人 push 觸發另一個 workflow。部署流程也會在一般 `main`／`master` push 或手動執行時運作，只上傳 HTML、`src/` 與 `data/`。

## 專案結構

```text
index.html                         極致全息版預設首頁，自動循環播放
classic.html                       莫蘭地極簡版
ultra.html                         舊極致版連結，導向預設首頁
src/app.js / src/ultra-app.js       互動、時間軸與側欄
src/map-renderer.js                 極簡版 Canvas 地圖
src/ultra-renderer.js               全息版 Canvas 地圖
src/taiwan-geo.js                   縣市地圖座標
data/thresholds.json               模型使用的風雨門檻
data/typhoon-data.json             最近一次成功產生的資料
data/news.json                     新聞標題、連結與各來源更新狀態
scripts/update_typhoon_data.mjs    官方來源解析、估算與 CLI 寫入
scripts/update_news.mjs            新聞 RSS／Atom 解析、去重與快取
src/news.js / src/news.css         兩版共用的新聞區塊
tests/                             離線回歸測試與固定來源資料
.github/workflows/                 更新與部署流程
```

新聞來源與使用說明：[中央通訊社 RSS](https://www.cna.com.tw/about/rss.aspx)、[公視新聞網](https://news.pts.org.tw/)。原文與著作權歸各媒體所有。
