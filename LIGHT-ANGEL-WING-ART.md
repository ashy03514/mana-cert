# 聖光主翼：靜態美術驗收

靜態主翼已確認，後續只沿用這一對羽翼製作展翼與羽尖飄動，不擴充六翼。正式鑑定不變。

素材：`assets/light-angel-wings-v1.png`。使用內建 `image_gen` 工具製作，保留原始生成檔，專案內使用獨立版本檔。

預覽入口：`light-angel-wing-study.html`。完整構圖使用現有金色背景與光暈，主翼是透明 PNG，沒有程式生成的替代羽毛。「放大細節」可放大至 1.8 倍並在羽翼區域捲動。預覽固定時間、沒有動畫迴圈；舊的六翼樣板保留以供比較。

v93：原始羽翼 PNG 不變，透過顯示層增加外緣柔焦光暈、低透明度薄霧，以及兩翼交會處的白金強光。保留清晰原圖與羽毛陰影。中心光暈依實際 contain 圖片的 x50%／y72% 定位，放大和視窗尺寸改變時一同縮放。此預覽關閉舊的硬邊菱形核心，改用柔化強光。

v94：修正完整構圖的容器裁切造成左右羽尖光暈直線接縫；PNG 本身不變，完整構圖允許柔光自然超出畫框，細節模式保留捲動視窗。背景新增從交會中心向外擴散的柔化放射聖光束，寬度、距離和亮度錯落，靠近下方文字區逐漸淡去。以 `uGodRays` 選用此光場，既有六翼動畫樣板預設不啟用。

素材為 1536×1024，約 2.1 MB，已確認有實際透明 alpha。驗證指令：`node tests/light-angel-wing-browser.cjs`，涵蓋本機檔案載入、靜態畫面一致、390×844／320×568／844×390／1440×900、完整羽尖不裁切、放大與回復、繪圖環境恢復與資源釋放。正式動畫與手機流暢度不屬本階段。

## v95 單對羽翼動畫

入口為 `light-angel-motion-study.html`，靜態頁保留作比較。原始 PNG 不變，分成左右兩個帶外緣留白的紋理網格。翼根固定在同一個光心，依序帶動內翼、外翼與羽尖；不是將整張圖等比例放大。左右翼保留細微相位差。約 0–0.7 秒凝光、0.4–2.8 秒舒展，之後持續低幅度擺動與羽尖延遲飄動，中心聖光及背景光束輕緩呼吸。

頁面提供暫停、重播、0.5×／1×／1.5×及三階段定格。時間由頁面單獨管理，載入、暫停、隱藏頁面、繪圖環境中斷時均凍結；恢復不追趕漏掉的時間。渲染器可獨立釋放，GPU 畫面以最多 56 萬像素及 30fps 更新。原圖的同內容 data URI 放在 `assets/light-angel-wings-v1.local.js`，避免 `file://` 的 WebGL 跨來源紋理限制。

檢查：`node tests/light-angel-motion.cjs` 驗證時間連續性、翼根固定、精確網格邊界不翻折與長時間回播；`node tests/light-angel-motion-browser.cjs` 驗證真實 WebGL 紋理繪製、四種尺寸、播放控制、分頁隱藏、context loss 恢復及清理。自動化使用桌面 Chromium，手機實際流暢度與展翼觀感仍需目視驗收。

## v96 SS 蓄力與聖光爆發

依使用者回饋改為保持展開輪廓的魔力蓄放：一輪 9.2 秒，前段緩慢縮約 9%，尾羽透過外翼關節與局部彎曲向下；約 1.82 秒開始加速舒展，最大比平常放大 6.5%，尾羽上揚，之後回穩。原圖不變，翼根始終固定，兩翼網格分別處理中心邊界，避免貼圖翻折。凝聚時細光向中心流入，爆發時釋出 46 顆四角星芒與 26 顆細光塵，大小、方向、速度、旋轉和壽命各異；光粒在下方操作區前淡去。

背景新增選用的 `uRayMotion` 與 `uRayBurst`。每一束光有獨立、連續的雲隙遮擋變化，控制寬度、長度、亮度與少量局部偏向，沒有共同的旋轉角。爆發時中心白金光及背景散射同步增強，羽毛仍保留原圖的冷色陰影。靜態樣板與既有舊樣板未啟用這兩個 uniform，維持原樣。

定格改成蓄力 1.72s、爆發 2.38s、餘光 3.15s。GPU 測試另外比較背景各方向亮度：同一段時間有光束增亮也有光束減暗，並驗證爆發比常態明亮；四種尺寸、暫停重播、長時間回播、繪圖環境恢復仍有檢查。此版本仍是 SS 動態預覽，未接入正式鑑定。

## v97 待機光場與持續光點

待機不再只靠低幅度呼吸。27 道背景光束保留各自的時序，雲隙遮擋、光束寬度、長度與亮度現在約 1–2 秒就有可見變化；局部偏向幅度有限，沒有共同旋轉。中心加入獨立閃爍強光與 12 道細長漸淡光刺，各自伸縮，強光的亮度及範圍在非爆發時仍持續變化。

背景有 96 條交錯生命週期的發光粒子，從中心持續向外流動，大小、速度、柔焦不同。使用 GPU point sprites，在背景光束之後、羽翼之前繪製，下方文字區前淡去；時間不綁定 9.2 秒蓄放循環，因此不會每輪重置或中斷。暫停、隱藏和繪圖環境恢復仍共用同一個活動時間。資源釋放涵蓋新增 shader 與粒子 buffer。

CPU 檢查新增非爆發期間的向外運動、尺寸與速度差、透明的粒子循環邊界、中心光變化及回播一致性；GPU 檢查獨立中心強光與背景粒子在待機時確實產生可見像素，並擷取 5.2／6.1／7.2 秒的待機畫面。

## v98 光點縮小與前景火屬星芒

背景光點的半徑上限由畫幅的 `.0157` 調整為 `.01099`，最大尺寸降低 30%，最小尺寸仍為 `.0017`，保留細小遠景光點。生命週期、柔焦、向外流動及背景圖層位置不變。

新增持續出現的前景星芒，直接共用 `FireRankSparkles.samples` 與 `drawFrames`，沿用火屬 SS 的數量、畫面尺寸基準、最大半徑、1 秒放大後縮小消失、自轉和暖金色票。只重新配置移動路徑，從雙翼中心向外散開；預先為每顆的最大光暈預留完整路徑，避免抵達畫框後卡住。繪製順序在羽翼、既有爆發粒子、中央強光之後，讓星芒位於特效最上層；頁面按鈕仍可操作。

新增逐顆與火屬樣本比對、持續遠離中心、圖層最後繪製與待機可見像素檢查，保留原暫停、重播及繪圖環境恢復測試。

## v99 屬性揭曉樣板移植

`index.html` 的光屬性材質預覽與收筆流程預覽共用已確認的 `LightAngelMotionRenderer`，包含單對雙翼、蓄力展翼爆發、持續變化的背光與中心強光、縮小後的背景光點，以及最前景的火屬同規格星芒。此階段為 SS 揭曉樣板，尚未改動正式光屬鑑定或設計 A／S 差異。

揭曉後保持動畫時鐘前進；載入、暫停、背景分頁與 WebGL 中斷時暫停。重畫會重設時鐘，離開預覽會釋放羽翼繪圖資源。收束中心對齊雙翼交會處，金色背景隨屬性形成淡入。嵌入素材保留直接開啟 `file://` 的相容性。

## v100 A／S／SS 光屬性樣板

揭曉樣板新增 A、S、SS 三個切換按鈕，同時支援直接材質預覽與收筆流程預覽。選擇階級後重新播放該級動畫，切換其他屬性時隱藏光屬階級列；仍保留使用者最後選擇的光屬預覽階級。此階段尚未接入正式魔力值攀升。

三個階級共用原本的單對羽翼與固定鏡頭構圖，透過羽翼動作、光芒與粒子層次表現威力。A 級為柔和聖光、輕微羽翼起伏與光點，不出現爆發星芒；S 級加入較收斂的蓄力展翼、較小且較少的火屬 S 級星芒；SS 級保留已確認的完整爆發、強光與前景星芒效果。直向預覽保留階級列的額外空間，橫向使用左側羽翼、右側控制。

## v101 三階級獨立羽翼素材

揭曉樣板的 A／S／SS 現在分別使用 `light-angel-wings-a-v1.png`、`light-angel-wings-s-v1.png`、原本的 `light-angel-wings-v1.png`。A 為短飛羽與絨羽較多的幼翼，S 為長羽和裝飾較收斂的成熟羽翼，SS 保留原圖；三者共用鏡頭比例，保留各自實際輪廓大小，A 的羽根對齊中央光源。

透明 PNG 原檔不加工，新增 `light-angel-wings-ranks.local.js` 嵌入 A／S 素材供本機檔案與離線樣板載入。載入三張圖後才推進預覽時鐘；切換階級直接綁定對應紋理，繪圖環境恢復會重建三張紋理，離開時一併釋放。這次僅替換樣板圖像，延續 v100 的各階級動態與光效，正式鑑定不變。

## v102 正式光屬鑑定與羽翼成長

正式光屬性鑑定接入同一套三階級羽翼素材與聖光背景。屬性形成先呈現 A 級幼翼；讀值開始後依已確定結果的魔力攀升推進羽毛成長，數字階級只會顯示 A／S／SS，未到 A 門檻前顯示「—」。結果僅提供成長終點，手勢或動畫不會重新抽選或改寫結果。

`LightRankGrowth` 提供純時間取樣、連續成長量與累積動畫時鐘，繪圖器依成長量讓羽翼輪廓與材質漸進變化。背景光、中心強光與前景星芒同步增強；深金色數字配合明亮神聖背景。載入、背景分頁與繪圖環境中斷沿用既有暫停機制，完成後維持動畫並提供重新鑑定。

揭曉樣板仍可直接切換 A／S／SS，方便單獨檢視素材；正式鑑定則以連續成長連接這些狀態。

## v103 正式階級機率修正

光、暗屬性先前忽略設定頁傳入的階級比例，固定使用內建 A／S／SS 機率。現在會取使用者設定的 A、S、SS 權重抽選，保留最低 A 的規則；三者皆為零時固定 A。沒有傳入階級設定的舊呼叫仍沿用原始預設。正式值、讀值階級、羽翼終點及重新鑑定皆依同一次抽選結果，S 100%／SS 100% 已透過實際設定頁流程驗證。

## v106 正式羽化成長

將已確認的羽化交界光流、高曝光成形與 0.9 秒恢復原色接入正式 A／S／SS。A 初次顯現、A → S、S → SS 皆使用各自原圖，正式轉換不再使用每欄外輪廓拉伸。保留階級光芒與展翼動作，明確區分形體進度與曝光恢復，升級不重疊。詳細時序、快取與驗證見 `LIGHT-ANGEL-GROWTH-STUDY.md` v106。

## 生成規格

Use case: stylized-concept.
Asset type: premium fantasy-game angel wing pair, original transparent raster artwork for a fixed-view magical attribute reveal. This is the static master artwork for visual approval before animation.
Primary request: create ONE PAIR of extraordinarily beautiful, airy, elegant angel feather wings, shown frontally, fully spread in a sweeping uplifted arc. Exactly two wings, no person, body, face, costume, armor, jewels, letters or scenery.
Composition: wide 3:2 canvas, both wings entirely visible including all soft tips, at least 5% transparent padding. Thick soft wing roots face each other just below the canvas center, separated by a narrow clean gap for a small magical core. The wings rise and sweep outwards into long graceful flight-feather tips. Full feather mass has gently curved shoulders, a believable elbow and wrist, then longer feathers flowing outward in elegant overlapping clusters; shorter dense soft feathers clothe the inner shoulders. The silhouette must read as real angelic bird wings, NOT insect leaves or six lobes.
Materials: finely art-directed pearlescent white and ivory feathers, subtle cool blue-gray and pale lavender occlusion in the recesses, restrained warm champagne rim light. Substantial beautiful layered volume; feather groups share coherent soft directional lighting and cast subtle contact shadows on each other. Long translucent tips have delicate airy wisps and feather barbs, with soft light transmitted through edges. Varied widths, lengths, overlapping directions and some gentle natural asymmetry. Beautiful high-end fantasy RPG cinematic render with painterly refinement, not a flat vector drawing or a logo.
Mood: serene, celestial, sacred, ethereal, majestic. Readable texture and shaded feather layers, very small luminous highlights, no blown-out white mass.
Constraints: actual transparent alpha background, no baked background or checkerboard, no halo ring, no stars, no particles, no drop shadow outside the wing silhouette. No rigid repeated quills, no metallic blades, no plastic, no triangular teeth, no outlines. This asset will be composited over an existing warm gold and ivory background, so retain blue-gray shadow separation inside the white wings. All edges must remain inside the canvas.
