# 參考圖改版：第一階段

已完成星雲底圖、上下淡金天體裝飾、標題與分隔星芒。中央保留約拇指大小的水球，粒子與既有互動沿用目前版本。參考圖中的密集旋流與流動光絲留待下一階段。

- 背景：assets/nebula-stage1.png（約 2.1 MB），由內建 image_gen 產生；原始圖片保留。
- 金線：assets/celestial-frame.svg，由程式繪製。
- 待機背景以 32 秒週期微幅漂移；減少動態偏好停用漂移。觸碰後保留背景，聚集時淡出。
- 字型使用裝置可用的襯線字型，跨裝置字形可能不同。
- 快取：mana-pwa-v2-nebula-stage1，包含兩個新增素材。
- 實機驗收由使用者進行：檢查手機標題是否單行、上下金線比例、背景明暗及開始／重新鑑定銜接。

## 素材生成提示詞（內建工具）

Create a production background texture for a portrait fantasy magic interaction PWA, 9:16 composition. Deep almost-black indigo night with highly detailed wispy violet-grey and muted blue nebula clouds curling along ALL outer edges, subtle dusty muted gold filaments especially lower corners, fine granular magical dust. Elegant mysterious quiet illustrated fantasy aesthetic. Keep the central 50 percent mostly dark and open for live particles and a tiny interactive core; upper middle dark enough for gold title. Rich painterly gaseous texture, layered depth, faint scattered pinpoints only. NO text, NO typography, NO symbols, NO decorative borders, NO large stars, NO bright central galaxy or white light, NO planets, NO water orb. The background must be dim and atmospheric rather than washed out, edge clouds visible but subordinate. Full bleed standalone texture.

## 手指粒子補充
互動期間，粒子靠近手指停留後淡出，從四邊外側重新流入；較久未靠近手指的粒子也錯開循環，維持補充。沿用固定粒子池，放開停止補充，鑑定聚集不重置粒子。新增 tests/inflow.cjs 驗證手機及桌面一分鐘持續補充、四邊來源、入射方向、物件池與放開／聚集／重設。快取版本：mana-pwa-v2-inflow-1。實際動態由使用者確認。

## 流入第二版與持續互動測試
修正首次補充等待過久、外圍吸力過弱：首次補充分批提前至觸碰後約 0.6 秒起，外圍入射速度提高至約 260–320 CSS px/s，遠距吸力提高。暫時啟用 config.js 的 interactionPreview，停用自動共鳴推進，保留正式鑑定流程供日後恢復。頁面回歸同時驗證長按及放開各一分鐘不離開互動，以及停用預覽後的完整鑑定。版本 mana-pwa-v2-inflow-2-preview。

## 粒子數與跟隨速度
粒子總數 340 → 680；細塵／星芒／前景光斑同比加倍至 596／72／12。按住手指期間位移速度乘以 1.5，持續互動預覽保持開啟。快取 mana-pwa-v2-inflow-3-preview。
