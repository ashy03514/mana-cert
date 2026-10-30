/* Shared by the static page and the dependency-free regression checks. */
(function (root) {
  'use strict';
  const CONFIG = {
    interactionPreview: true,
    // Portal baseline angular speeds (radians/second); individual clouds vary around these.
    portalMotion: {
      idleSpeed:0.075, maxSpeed:Math.PI*2,
      accelerationSeconds:2, decelerationSeconds:2,
      mistRateMin:0.5, mistRateMax:1.65, mistDrift:0.10
    },
    portalSparkles: {
      maxCount:5, idleLimit:3,
      // Increase spawn frequency by 5% while retaining the simultaneous-count limits.
      idleInterval:0.55/1.05, activeInterval:0.22/1.05,
      lifeMin:0.8, lifeMax:1.4,
      sizeMin:16, sizeMax:40, rareSize:48
    },
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
      S: { range:[900,998], note:'魔力如暴風般湧動<br>所有任務都難不倒你！' },
      SS: { range:[999,999], note:'魔力達到最高值<br>最高階級 SS！' },
      MUGGLE: { range:[1,9], note:'未偵測到魔力屬性<br>平凡之中，也有自己的光。' }
    },
    timing: { gather:1100, reveal:1200,
      interactionMin:2800, interactionMax:6000, resonancePause:180, rankConfirm:900 },
    elementReveal: { duration:2000, titleAt:600,
      colors:{火:'#ff965a',水:'#83d8ff',風:'#91ecc7',土:'#e4ba73',光:'#fff0b6',暗:'#c599f2'} },
    resonance: { passiveRate:0.10, heldRate:0.09, distanceRate:0.00022,
      distanceCap:0.35, touchGain:0.035, touchCap:0.105, turnRate:0.04 },
    interaction: { particles:354, touchParticles:96, mistClouds:24, followSpeed:1.5, trails:1024, dprMax:1.75,
      fieldRadius:190, maxSpeed:1250, trailLife:3 },
    scan: { duration:2400, ssNormalDuration:1800, ssRushDuration:900,
      ssLimitHold:180, ssUnknownHold:220, ssStart:999, ssLimit:999 },
    resultText: { scanning:'魔力測定中', confirmed:'鑑定完成',
      overflow:'⚠ 超出標準測定範圍', unknown:'無法正常測定' }
  };
  function freeze(value) {
    Object.values(value).forEach(v => { if (v && typeof v === 'object') freeze(v); });
    return Object.freeze(value);
  }
  root.ManaConfig = freeze(CONFIG);
})(globalThis);
