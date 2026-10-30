# SS 闇屬性：深淵封印

獨立美術樣板：`dark-seal-study.html`。本階段僅製作 SS，尚未接入正式鑑定，也未修改 A／S 或結果機率。

## 畫面與動態

- 深藍黑／暗紫背景、內部吸光的狹長裂隙，背景每兩秒有淡色向內魔力脈衝。
- 六條不同粗細與前後深度的重鐵鏈，扣住破損封印環。鏈節沿曲線彎曲，保留原素材的扣接順序和鏤空透明度。
- 6.6 秒一輪：慢速蓄力 → 裂隙向外撐開 → 封印收束、鎖鏈繃緊 → 鏈節餘震與少量紫白／淡金火花。待機也有微動、碎片與吸入光點。
- 封印環切成九片，分開浮動並受同一股壓力驅動；內緣在壓力升高時短暫泛光。
- 這版未加入惡魔翼影或一次性升級斷鏈；先確認鎖鏈與深淵封印的美術方向。

## 生成素材

使用內建 image_gen，保留原始透明 PNG，未使用 CLI。

1. `assets/dark-chain-v1.png`：參考使用者的 `Z:/狐狸樹屋/商品/玩偶/小幽靈/小幽靈封印透卡.jpg` 鎖鏈形狀，生成橫向黑鐵鏈。厚橢圓交錯鏈節、刮痕、鑿損、低亮冷色反光。完整提示詞：`assets/dark-chain-v1.prompt.txt`。
2. `assets/dark-seal-ring-v1.png`：配合同一種磨損金屬的正面封印環，浮雕刻紋、裂痕及透明中空。完整提示詞：`assets/dark-seal-ring-v1.prompt.txt`。

相同素材另存成 `.local.js` 的 data URI，讓直接開啟 file:// 時也能載入、量測 alpha 與繪圖。原始生成檔保留在 Codex generated_images，網頁引用的是本專案 assets。

## 程式責任

- `js/dark-seal-motion.js`：活動時鐘、壓力曲線、鏈條路徑與錨點。
- `js/dark-seal-shader.js`：背景、霧、裂隙及內縮能量波。
- `js/dark-seal-renderer.js`：生成材質、封印碎片、鏈條、火花與前後層次。
- `js/dark-seal-study.js`：播放控制、分頁暫停、繪圖恢復與資源釋放。

## 驗證

`node tests/dark-seal-motion.cjs`：數值邊界、無結果亂數消耗、連續的壓力與震動曲線、固定外側錨點、可重播。

`node tests/dark-seal-browser.cjs`：實際生成素材與透明邊界、本機檔案載入、四種階段、暫停／重播／1.5 倍速、背景分頁停止計時、WebGL 恢復、390×844／320×568／844×390／1440×900、無 JavaScript／WebGL 錯誤與資源釋放。

檢視圖：`artifacts/dark-seal-contact.png`。上述為桌面 Chromium 自動檢查；實際手機流暢度與最終美術觀感仍待確認。
