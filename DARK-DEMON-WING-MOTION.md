# SS 闇王之翼動畫樣板

入口：`dark-demon-wing-motion-study.html?v=118`。沿用已確認的黑藍膜翼 v2 與獨立鎖鏈素材。正式 A／S／SS 鑑定已在 v120 接入，詳見 `DARK-FORMAL-INTEGRATION.md`；此頁保留獨立 SS 動畫驗收。

## 動畫

- 9.4 秒一輪；0.42 秒開始凝聚，雙翼稍向內收、尾端下彎，微粒向根部聚集。
- 2.02 秒開始展翼，2.50 秒充分張開；肩部先動、外側翼骨與膜面跟隨。2.20 秒起星芒與淡紫魔力波向外散開。
- 約 4 秒後恢復連續待機：肩部緩擺、腕部延遲、膜面與翼尖細微起伏。跨循環不重設待機相位。
- 鎖鏈兩端固定跟隨翼骨，中段有獨立延遲與衰減回彈；紋理不沿曲線滑動。

## 檔案責任

- `js/dark-demon-wing-motion.js`：純時間取樣、翼骨／翼膜形變、鎖鏈回應、粒子。
- `js/dark-demon-wing-motion-renderer.js`：兩片透明紋理網格、鎖鏈帶、深色背景與光效，處理 WebGL 資源恢復。
- `js/dark-demon-wing-motion-study.js`：唯一播放時鐘、暫停／重播／速度／停格、隱藏頁面與資源生命週期。

預覽支援本機 `file://`；資料 URI 素材避免 WebGL 本機來源限制。支援減少動態偏好，預設停在待機畫面，仍可手動播放。暫停、隱藏與載入期間不持續要求動畫影格。

## 驗證

`node tests/dark-demon-wing-motion.cjs`：根部固定、鎖鏈端點、閒置動態、週期連續、粒子上限、完整時間軸網格沒有翻折。

`node tests/dark-demon-wing-motion-browser.cjs`：本機載入、同時間完全相同的繪圖、暫停／重播／速度、隱藏恢復、WebGL 中斷恢復、資源釋放，以及 390×844、320×568、844×390、1440×900 控制可見性。畫面截圖已檢視。

像素測試會大量讀回 Canvas，因此測試環境預先設定 `willReadFrequently: true`，避免 Chrome 在測試中途切換 GPU／CPU 造成漸層取整差異；保留完全相等的像素斷言。正式 renderer 保留瀏覽器加速路徑。真實手機／PWA 的流暢度仍需裝置驗收。
