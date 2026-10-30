# SS 水之星球：美術動畫樣板

獨立入口：`water-ocean-study.html`。同一套海面已接入正式水屬性鑑定，以及「設定 → 特效 → 屬性揭曉樣板」的兩種預覽，PWA 資源版本為 portal-87。

## 這版要確認的視覺方向

- 移除前方兩道交會浪冠、碰撞水花與週期性交鋒演出，先集中調整球體本身的海洋材質。
- 以真實海水參考中的深藍浪谷、不同尺度的連續起伏、破碎白沫與天空反射為美術方向。海面流動沿球面分布，不再以幾條凸出的規則浪帶作為主體。
- 白沫集中在局部浪峰並隨水流變化；保留深色水體，讓細小起伏與反光有可辨識的層次。
- 使用生成的寫實海面細節素材，配合持續變化的球面幾何、表面法線、流動取樣與反光。這是美術材質動畫，不是真實流體模擬；靜態素材負責細節，動畫仍由共用時間驅動。
- 沿用小水球至 E–SS 的尺寸、底部錨點與數值成長規格，按階級控制材質與動態；海水自然度與手機實際效能仍需在裝置上確認。

## 屬性揭曉樣板整合

- 「預覽六種屬性」選水：直接呈現完整海洋球面，沿用該預覽的出現／淡出、暫停與重新播放。
- 「預覽收筆到屬性」選水：畫線後進入原有收束流程，從小水球形成，隨預覽魔力值長大，最後停在 9999／SS 並持續流動。保留水色背景、向下的瀑布能量與 S／SS 星芒。
- `js/water-ocean-reveal.js` 負責球體尺寸、底部錨點與透明合成，直接使用 `WaterOceanStudy` 和 `OceanSurfaceShader`；不複製海面 shader，不再加入先前的戳刺變形或兩股交會浪。
- 所有動態沿用揭曉時鐘。暫停、重播、切換背景與旋轉螢幕不會產生第二個動畫時鐘；材質載入完成前保留流程時間，返回設定時釋放海洋 WebGL 資源。
- 預覽與正式水屬性共用新適配器，其餘屬性保留既有 renderer。新腳本及海面 WebP 已納入離線資源。

### E–SS 正式規格

所有比例均以完整 SS 為基準，各階級水球尺寸維持原本曲線。

沿球面推進的整道白色大浪只在 S／SS 出現。A～E 同時關閉大浪幾何、浪冠明暗與浪花粒子，保留下表規格的海面材質和細小起伏。

| 階級 | 動畫速度 | 波形幅度 | 海面白沫 | 浪花粒子 | 星芒 |
| --- | --- | --- | --- | --- | --- |
| SS | 100% | 100% | 完整材質 | 持續 | 同火屬 SS |
| S | 80% | 100% | 同 SS | 短波間歇，週期約 42% | 同火屬 S |
| A | 70% | 70% | 減少白沫 | 無 | 無 |
| B | 60% | 60% | 同 A | 無 | 無 |
| C | 50% | 50% | 比 A 更少白沫 | 無 | 無 |
| D | 40% | 40% | 同 C | 無 | 無 |
| E | 30% | 30% | 無海面貼圖，保留藍水體與反光 | 無 | 無 |

`WaterRankEffects` 依目前顯示的魔力值選擇目標規格，每次跨階後用 0.65 秒平滑融合貼圖、白沫、波形與浪頭；連續快速跨階可疊加融合，數字停下後仍會完成最後的轉變。速度用同一緩動曲線的解析積分，避免突然加速或跳動材質相位；S 的短波粒子也會漸入，升 SS 時逐步變為持續出現。暫停及重播可重現相同畫面。星芒使用火屬共用的魔力值規格與宿主活動時間，不再額外縮小或被海面速度倍率減速；保留水色及原本球面周圍的位置。結果依然由 `ManaResults.Session` 在每輪開始時決定，不因動畫或預覽改寫。

### 沿球面向右上推進的碎浪

- 浪頭從球體左下方進入，沿球面弧度往右上推進，再繞至背面；球面上同時有先後錯開的浪頭。
- 共用球面波前控制幾何隆起、法線、青綠色水壁與破碎白沫。浪頭前方有較暗的浪谷，後方泡沫逐漸稀疏，泡沫細節混合既有海面素材，避免平均發光的白線。
- 保留球形輪廓，靠近畫面輪廓時減少幾何隆起，泡沫繼續沿弧面通過；浪花沿用海面時鐘，不累積貼圖偏移。
- 揭曉的波形依階級套用上表；獨立 SS 樣板的「海面風浪」仍可調整碎浪強度。
- 單一共用 shader 同時供獨立樣板與屬性揭曉預覽使用；本機 `file://` 的貼圖相容載入維持原有方式。

### 立體浪冠、飛滴與細霧

- 保留原本隆起水壁與表面白沫，在浪冠上加入有前後位置的泡沫團、向前拋起再回落的細水珠，以及少量快速變淡的水霧。粒子沿同一道球面波前前進，沒有另開動畫計時器。
- 泡沫團使用不規則邊緣、顆粒凹凸與藍灰色底部陰影，亮面接近中性白。大小、翻滾角度和出現時間錯開，保留團塊之間的空隙。
- 粒子與海面共用 WebGL 深度緩衝，球背的水花會被擋住；透明粒子由遠到近繪製，採預乘透明混色，避免疊成發光白帶或產生黑邊。
- 固定 3010 個粒子槽上限：每道浪頭有 560 片泡沫、32 顆飛滴與 10 片細霧。主泡沫沿浪冠切線延展、交疊，分成前後四排填滿浪頭；高度貼近水壁，弱化個體球狀明暗並柔化交界，形成連續白沫。少量飛滴保留獨立高光及拋起回落。
- 亮面保持白亮，保留藍灰暗部和泡沫細紋；靠近球體輪廓柔化。粒子只在 S／SS 顯示，SS 使用完整浪冠強度。
- 海面、浪頭、泡沫與飛滴共用 3 倍動畫時間（速度增加 200%）；揭曉流程、數值成長及暫停／重播仍使用原本的主時鐘。
- 海面細節改繞浪冠共同的球面軸流動，畫面前方由左下往右上；大、小波紋的主要方向同步對齊。貼圖座標、三平面混合權重與反向法線轉換共用同一旋轉，避免長時間播放後材質拉伸。
- 這是有立體位置與光照的粒子美術效果，並非完整流體模擬。粒子陰影由著色計算，沒有額外的即時陰影貼圖。

## 操作

- 暫停／繼續、重新播放。
- 播放速度：0.5×、1×、1.5×，相對於新的海洋動畫基準速度。
- 海面風浪：調整海面的起伏與材質表現。
- 切換至背景會停止動畫時間；暫停中調整尺寸或強度會保留時間重畫。

## 檔案與介面

- `js/water-ocean-study.js`：`WaterOceanStudy(canvas)`，管理海面 WebGL program、球面網格與共用深度緩衝的粒子 pass。舊版兩股海潮交鋒的 program 已移除；使用有上限的渲染尺寸，無第三方依賴。
- `js/water-ocean-reveal.js`：把共用海洋 renderer 接上揭曉的尺寸、魔力值與時間；不產生鑑定結果。
- `js/ocean-surface-shader.js`：海面幾何、法線、色彩、細節素材與反光的 shader。
- `js/ocean-spray-field.js`：沿既有球面浪頭，以絕對時間取樣泡沫、飛滴和細霧的三維位置與生命週期。
- `js/ocean-spray.js`：同一個 WebGL context 的粒子著色、透明排序與深度遮擋；還原繪圖狀態並支援 context restore／dispose。
- `assets/ocean-surface-v1.webp`：生成的海面細節素材。`renderer.ready` 在素材載入完成後結束，`textureReady` 可檢查載入狀態；HTTP／PWA 直接載入此同源圖片。
- `assets/ocean-surface-v1.local.js`：直接以 `file:///…/index.html` 或 `file:///…/water-ocean-study.html` 開啟時才懶載入，內含同一張 WebP 的原始位元組。瀏覽器允許這份 data URL 上傳到 WebGL，解決本機圖片顯示正常但貼圖上傳出現 `SecurityError` 的問題。沒有改動圖片或關閉瀏覽器安全限制；HTTP／PWA 不下載這份檔案。更換 WebP 後執行 `node scripts/build-local-ocean-texture.cjs` 同步產生。
- `water-ocean-study.html`：獨立播放時鐘、控制、錯誤訊息、手機直橫式版面。
- `window.waterOceanStudy.renderAt(seconds)`：定格於指定時間，供畫格檢查；`pause(boolean)` 控制播放，`dispose()` 釋放資源。
- `js/water-rank-effects.js`：階級規格、無跳相位的視覺時鐘及 S 級短波粒子包絡；不負責抽選結果或球體尺寸。
- 不改動正式結果抽選、機率、數值或火屬性演出；service worker 收錄正式水屬性需要的全部資源。

## 驗證

`node tests/water-ocean-study-browser.cjs`

主頁整合驗證：`node tests/water-ocean-reveal-browser.cjs`。

本機檔案驗證：`node tests/water-ocean-local-browser.cjs`，以實際 `file://` 入口檢查海面載入、兩種預覽與收筆流程，並確認內嵌素材與原始 WebP 位元組完全相同。

碎浪驗證：`node tests/ocean-breakers-browser.cjs`，比較關閉／開啟碎浪的實際 GPU 像素，檢查可見差異、同時刻一致性、風浪強度聯動、過曝限制與長時間取樣，並輸出連續浪頭的方向量測和 `artifacts/ocean-breakers-motion.png` 畫格對照。浪花沿用原始材質，不新增外部圖片。

立體粒子驗證：`node tests/ocean-spray-field.cjs` 與 `node tests/ocean-spray-browser.cjs`，涵蓋固定數量、絕對時間一致性、水滴拋起回落、實際海面深度遮擋、透明混色、下一幀繪圖狀態還原及 context restore。畫格對照：`artifacts/ocean-volume-spray.png`。

海面流向驗證：`node tests/ocean-current-browser.cjs`，暫時關閉浪冠及粒子，只追蹤原始海面材質的實際 GPU 畫格。在 0、56、112 秒各比較 0.6 秒間隔，檢查左、中、右三區紋理都往右上移動；輸出 `artifacts/ocean-current-direction.png` 與位移量測 JSON。

階級驗證：`node tests/water-rank-effects.cjs` 檢查七階規格、原尺寸、跨階連續時間及結果不變；`node tests/water-ranks-browser.cjs` 檢查實際 GPU 參數、E 不依賴貼圖像素、不同白沫量、S 粒子開關與 SS 完整效果，產出 `artifacts/water-ranks.png`。正式流程驗證：`node tests/water-scan-host-browser.cjs` 使用真實設定與抽選，檢查共用海洋、9999／SS、背景暫停、三種版面及離開釋放。

整合測試涵蓋兩個入口、同源材質載入、小球成長至 9999／SS、暫停／恢復／重播／背景切換、三種版面淨空、正式水屬性使用共用海洋 renderer，以及實際 service worker 離線重新載入後顯示海洋。截圖：`artifacts/ocean-reveal-portrait.png`、`artifacts/ocean-reveal-small.png`、`artifacts/ocean-reveal-landscape.png`。`node tests/stage1.cjs` 另檢查載入等待不消耗演出時間、舊水材質不與新海洋重疊、離開釋放資源及結果不被預覽改動。

測試自行啟動僅監聽 `127.0.0.1` 的臨時唯讀 HTTP 伺服器，結束後關閉。檢查素材成功載入、實際海面 shader 編譯與 WebGL 錯誤、交鋒 program 已移除、非空動畫畫面、同時間像素一致、時間推進、暫停／重播／速度／強度、頁面隱藏與恢復、暫停時改變尺寸，以及 390×844、320×568、844×390 的畫面與控制區淨空。此檢查驗證桌面 Chrome；手機 PWA 的觀感與效能另行確認。

實際畫格：`artifacts/ocean-study-portrait.png`、`artifacts/ocean-study-small.png`、`artifacts/ocean-study-landscape.png`。

### 長時間播放材質拉伸修正

海流旋轉原本只作用在取樣座標，三平面貼圖混合仍使用未旋轉的球面方向；轉到側向時會選到幾乎側對視線的投影，將白沫拉成橫條。現在取樣座標與投影權重共用同一個旋轉座標系，保留原有海面素材、起伏、反光與播放節奏。

GPU 回歸測試取樣 0、56、112、224、336、449、1800 秒，檢查球面前方仍保有水平與垂直細節，避免旋轉約四分之一圈後退化成條紋。這是指定時間取樣，不是連續播放 30 分鐘。修正前後畫格對照：`artifacts/ocean-projection-before.png`、`artifacts/ocean-projection-after.png`。此輪修改前 shader 保留在 `backups/ocean-surface-before-projection-fix.js`。

## 素材與技術參考

- 海面細節由 imagegen 生成，依照使用者提供的真實海水照片方向製作；WebP 約 666 KiB。原始生成圖保留在 `assets/ocean-surface-v1.png`。
- 大尺度幾何與小尺度法線分層的水面做法參考 [GPU Gems：Effective Water Simulation from Physical Models](https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models)。本專案的球面座標、海面細節投影、材質與生命週期為獨立實作。
- 此輪修改前備份：`backups/before-ocean-surface-study.zip`。
- 新增球面碎浪前備份：`backups/before-traveling-ocean-breakers-portal54.zip`。
- 新增立體粒子前備份：`backups/before-volume-ocean-spray-portal55.zip`。
