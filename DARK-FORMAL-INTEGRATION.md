# 闇屬性正式鑑定 v120

入口：`index.html?v=120`。正式結果維持既有抽選與不可變資料，闇屬性最低 A，使用獨立的光闇 A／S／SS 機率。畫完、收束後從 A 翼顯現，再依已確定的結果演出 A→S→SS。

## 翼形與進化

- A：新生成的初生膜翼，短翼骨、簡潔翼膜與短翼尖。
- S：新生成的成熟膜翼，較大跨度與分層結構，較 SS 簡潔。
- SS：沿用已確認的黑藍長翼尖、破損翼膜、鎖鏈與凝聚／展翼動畫。
- A、S 素材使用內建 image generation 產生；原始 PNG 與完整提示詞位於 `assets/dark-demon-wings-{a,s}-v1.png`、同名 `.prompt.txt`。
- 所有材質使用固定 UV，A 與 S 僅平移到共同翼根，沒有依輪廓拉伸。新翼形從翼根向外柔化顯現，交界覆蓋冷紫白光；完整形體形成後，再恢復黑藍材質。
- 每次進化形成 1.2 秒，曝光回落 0.9 秒；兩次進化間隔 0.1 秒。沿用光屬性時序，數字結束不會截斷尚未完成的 SS 演出。
- 鎖鏈使用各階級獨立附著位置，舊鎖鏈先隱去，新翼骨成形後接上。待機、翼膜擺動、爆發與粒子使用同一個持續時鐘；A／S 的強度低於 SS。

## 檔案責任

- `js/dark-rank-growth.js`：共用已核可的光屬性進化排程，提供闇色語意與固定翼根版面。
- `js/dark-demon-wing-growth-renderer.js`：三階材質、翼根對齊、柔化交界、曝光與鎖鏈接續；重用 SS 基底動畫和繪圖。
- `index.html`：正式流程、數字／階級、重新鑑定、樣板 A／S／SS 切換，以及載入／隱藏／WebGL 恢復處理。
- `assets/dark-demon-wings-ranks.local.js`：A、S 圖片嵌入，與既有 SS／鎖鏈嵌入素材一起支援 `file://`。
- `service-worker.js`：`mana-pwa-v3-portal-120`，預存正式闇翼程式與所有嵌入素材。相較施工中的 v119，也包含離線版本網址與鎖鏈進化銜接修正。

## 驗證

- `tests/dark-rank-growth.cjs`：不可變結果、進化／曝光排程、連續時鐘、各階粒子與鎖鏈端點。
- `tests/dark-formal-browser.cjs`：實際畫筆流程，A750、S900、SS1000、SS9999；過渡停格、響應版面、隱藏恢復、WebGL 中途恢復、重試釋放。
- `tests/dark-formal-offline-browser.cjs`：v120 快取、離線重新載入、A／S／SS 三張嵌入圖片與正確材質。
- `tests/dark-growth-preview-browser.cjs`：樣板階級切換、暫停／重播與載入途中釋放；版本參數網址也可命中離線首頁快取。
- `tests/dark-demon-wing-motion.cjs`、`tests/dark-demon-wing-motion-browser.cjs`：獨立 SS 動畫相容性。
- `tests/light-formal-browser.cjs`、`tests/rare-rank-probabilities.cjs`：光屬性既有流程與光闇機率回歸。

已檢視正式 A、S、SS、進化亮光與手機／橫向版面截圖。自動化瀏覽器驗證不等於實機 PWA 的幀率驗收；實機流暢度仍待實際使用確認。
