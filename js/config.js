/* Shared by the static page and the dependency-free regression checks. */
(function (root) {
  'use strict';
  const CONFIG = {
    interactionPreview: true,
    muggleChance: 0.08,
    elementWeights: { 火:20, 水:20, 風:20, 土:20, 光:10, 暗:10 },
    normalRanks: { SS:0.04, S:0.10, A:0.20, B:0.20, C:0.20, D:0.20, E:0.06 },
    rareElementRanks: { A:0.60, S:0.30, SS:0.10 },
    ranks: {
      E: { range:[10,199], note:'魔力剛剛覺醒<br>還有很大的成長空間！' },
      D: { range:[200,349], note:'初學者光環<br>閃閃發亮！' },
      C: { range:[350,549], note:'魔力穩定<br>偶爾放個小法術。' },
      B: { range:[550,749], note:'勤加鍛鍊<br>有望突破A級門檻！' },
      A: { range:[750,899], note:'高階魔法使認證<br>請收下榮譽徽章。' },
      S: { range:[900,999], note:'魔力如暴風般湧動<br>所有任務都難不倒你！' },
      SS: { range:[1000,9999], note:'魔力已超出可檢測範圍<br>無法正常測定' },
      MUGGLE: { range:[1,9], note:'未偵測到魔力屬性<br>平凡之中，也有自己的光。' }
    },
    timing: { gather:1100, reveal:1200,
      interactionMin:2800, interactionMax:6000, resonancePause:180, rankConfirm:900 },
    elementReveal: { duration:2000, titleAt:600,
      colors:{火:'#ff965a',水:'#83d8ff',風:'#91ecc7',土:'#e4ba73',光:'#fff0b6',暗:'#c599f2'} },
    resonance: { passiveRate:0.10, heldRate:0.09, distanceRate:0.00022,
      distanceCap:0.35, touchGain:0.035, touchCap:0.105, turnRate:0.04 },
    interaction: { particles:680, followSpeed:1.5, trails:192, dprMax:1.75,
      fieldRadius:190, maxSpeed:1250, trailLife:1.25 },
    scan: { duration:2400, ssNormalDuration:1800, ssRushDuration:900,
      ssLimitHold:180, ssUnknownHold:220, ssStart:1000, ssLimit:9999 },
    resultText: { scanning:'魔力測定中', confirmed:'鑑定完成',
      overflow:'⚠ 超出標準測定範圍', unknown:'無法正常測定' }
  };
  function freeze(value) {
    Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); });
    return Object.freeze(value);
  }
  root.ManaConfig = freeze(CONFIG);
})(globalThis);
