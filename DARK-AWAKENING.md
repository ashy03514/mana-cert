# v133 闇屬性特殊覺醒

正式鑑定與收筆流程預覽共用：最後魔力收束 → 0.45 秒暗核吞光 → 0.6 秒紫黑氣流凝聚 → 0.85 秒魔力向兩側撐開 → 原有 0.8 秒魔翼顯現 → 數值攀升與 A／S／SS 成長。

暗核周圍的冷紫反光、彎曲氣流與細碎光塵保持流動；釋放時以柔化能量波向外擴張，光流向兩側伸展銜接翼根。背景使用既有闇翼配色，上下圖層在 FORM 交接，避免背景突然跳回入口。音效開啟時只播放一次低頻覺醒音，沿用既有停止、靜音與音源數上限。

A、S、SS 共用相同開場，不提前顯示數值或階級，不改變已抽選的結果。基礎屬性與光屬性的時序保持原設定。直接材質預覽不增加開場。

- js/dark-awakening.js：由流程時鐘取樣，無獨立計時器／貼圖／隨機狀態。
- js/reveal-flow.js：獨立 darkAwakening 開關，延後 FORM，不改寫材質成長時鐘。
- index.html：正式及流程預覽接線、圖層銜接、階段標籤與音效分流。
- service-worker.js：離線快取新增模組；頁面版本與快取版本同步升至 v133。

驗證：dark-awakening-flow.cjs、dark-awakening-browser.cjs、light-awakening-flow.cjs、reveal-flow.cjs、light-awakening-audio.cjs、stage6.cjs；瀏覽器檢查包括真實筆畫輸入、形成前無翅膀及讀值、凍結結果不變、999 SS 終點、暫停／背景分頁／重播和三種畫幅。另以 dark-formal-offline-browser.cjs 驗證網站快取及離線素材，以 light-awakening-browser.cjs 回歸光屬流程。

自動化以桌面 Chromium 執行，實際手機觀感與效能仍需裝置確認。
