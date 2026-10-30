const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// A pure timeline must work without DOM, timers, or random outcome generation.
const sandbox={Math:Object.create(Math)};
sandbox.Math.random=()=>{throw new Error('A visual transition must not roll a result');};
vm.runInNewContext(fs.readFileSync(require.resolve('../js/fire-scan-transition.js'),'utf8'),sandbox);
const F=sandbox.FireScanTransition;
const plain=value=>JSON.parse(JSON.stringify(value));
const result=Object.freeze({type:'magic',element:'火',mana:862,rank:'A'});
const snapshot=JSON.stringify(result);
assert.ok(Object.isFrozen(F.previewResult));assert.ok(Object.isFrozen(F.timing));
assert.deepEqual(plain(F.previewResult),result);
const waterPreview=F.previewForElement('water');
assert.equal(waterPreview.element,'水');assert.equal(waterPreview.rank,'SS');
assert.ok(Object.isFrozen(waterPreview));
assert.equal(F.sample(.1,waterPreview).label,'水流凝聚');
assert.equal(F.sample(4.05,waterPreview).value,9999);
const start=F.sample(0,result);
assert.equal(start.shift,0);assert.equal(start.opacity,0);assert.equal(start.value,0);
assert.equal(start.rank,'—');assert.equal(start.scanStarted,false);assert.equal(start.complete,false);
assert.equal(F.sample(.05,result).shift,0,'briefly establish the formed flame before moving it');
assert.equal(F.sample(.35,result).shift,.5,'fire moves smoothly without scaling');
assert.equal(F.sample(.65,result).shift,1);
assert.equal(F.sample(.25,result).opacity,0);
assert.ok(F.sample(.45,result).opacity>=.49,'numbers become readable within half a second of formation');
assert.equal(F.sample(.65,result).opacity,1);
assert.equal(F.sample(.849,result).scanStarted,false);
assert.equal(F.sample(.85,result).scanStarted,true);
assert.equal(F.sample(.85,result).value,0,'the readable 000 starts the scan');
assert.equal(F.sample(.85,result).power,0,'the readable 000 still has a small flame');
assert.equal(F.sample(.4,result).heat,1);
assert.ok(F.sample(.5,result).ignition>.99);
assert.ok(F.sample(.85,result).ignition<1e-10);

for(const mana of [10,199,200,349,350,549,550,749,750,899,900,999,1000,9999]){
  let previous=0;
  for(let frame=0;frame<=700;frame++){
    const a=F.sample(frame/100,{...result,mana});
    assert.ok(Number.isInteger(a.value)&&a.value>=previous&&a.value<=mana,
      `${mana}: reading rises monotonically and cannot overshoot`);
    assert.equal(a.rank,F.rankForValue(a.value));previous=a.value;
  }
  assert.equal(F.sample(4.05,{...result,mana}).value,mana);
  assert.equal(F.sample(500,{...result,mana}).value,mana,'endpoint remains alive and stable');
}
assert.equal(F.sample(4.049,result).complete,false);assert.equal(F.sample(4.05,result).complete,true);
assert.equal(F.sample(4.05,result).rank,'A');
const slow=F.sample(1.15,result).value-F.sample(.85,result).value;
const fast=F.sample(2.60,result).value-F.sample(2.30,result).value;
assert.ok(fast>slow*2,'scan starts slowly then accelerates');
let previousPower=0;
for(let mana=0;mana<=9999;mana++){
  const power=F.powerForValue(mana);
  assert.ok(power>=previousPower&&power<=3,'more mana never reduces the fuel');previousPower=power;
}
assert.equal(F.powerForValue(0),0);assert.equal(F.powerForValue(9999),3);
assert.equal(F.powerForValue(750),1,'A begins at the former maximum fire');
assert.ok(F.powerForValue(950)>1.8,'S opens a much wider fuel bed');
assert.ok(F.powerForValue(1000)>=2.5,'SS enters the large upper-screen flame immediately');
for(const threshold of [750,900,1000])assert.ok(Math.abs(F.powerForValue(threshold)-F.powerForValue(threshold-.001))<.00001,'rank joins stay continuous');
assert.ok(F.powerForValue(199)<F.powerForValue(750)*.4,'a low final result must retain a smaller fire');
assert.ok(F.powerForValue(9999)>F.powerForValue(899)+.15,'SS has additional intensity above ordinary ranks');
assert.equal(F.powerForValue(20000),3);assert.equal(F.powerForValue(-1),0);
for(const mana of [10,199,862,9999]){
  const outcome={...result,mana};let lastTime=0;
  for(let frame=0;frame<=160;frame++){
    const elapsed=frame/20,s=F.sample(elapsed,outcome);
    assert.equal(s.power,F.powerForValue(s.value),'fuel follows the displayed number, never the hidden final rank');
    if(elapsed<.85)assert.equal(s.power,0,'no full-size fire before the count');
    const delta=s.fireTime-lastTime;
    if(frame>0)assert.ok(delta>=.034&&delta<=.137,'integrated speed stays continuous across changes in fuel');
    lastTime=s.fireTime;
  }
  const velocity=F.flameTime(7,outcome)-F.flameTime(6,outcome);
  assert.ok(Math.abs(velocity-F.speedForPower(F.powerForValue(mana)))<1e-8,'final fire keeps its appropriate burning speed');
}
assert.equal(JSON.stringify(result),snapshot,'committed outcome is never modified');
const paused=plain(F.sample(3.4,result));
assert.deepEqual(plain(F.sample(3.4,result)),paused,'same clock gives identical pause frame');
assert.deepEqual(plain(F.sample(0,result)),plain(start),'replay needs only the reset clock');
for(const [value,rank] of [[0,'—'],[9,'—'],[10,'E'],[199,'E'],[200,'D'],[350,'C'],
  [550,'B'],[750,'A'],[900,'S'],[999,'S'],[1000,'SS']])assert.equal(F.rankForValue(value),rank);
for(const elapsed of [-1,NaN,Infinity])assert.deepEqual(plain(F.sample(elapsed,result)),plain(start));

for(const [width,height] of [[390,844],[320,568],[375,667],[360,640],[430,932],[768,1024],[844,390]]){
  const bh=Math.max(100,Math.min(width*1.27,height-250,660)),bw=bh/1.35;
  const base={x:(width-bw)/2,y:Math.max(76,(height-110)/2-bh/2),width:bw,height:bh};
  const before=JSON.stringify(base);
  for(const preview of [false,true])for(const shift of [0,.4,1]){
    const {box,numbers,sideBySide}=F.layout(width,height,base,shift,{preview});
    assert.equal(box.width,base.width);assert.equal(box.height,base.height);
    assert.ok(box.y+box.height*.16>=70&&box.y<=base.y,'visible flame clears top controls');
    assert.ok(base.y-box.y<=Math.min(height*.09,76)+1e-8);
    assert.ok(numbers.x>0&&numbers.x<width);
    assert.ok(numbers.labelY-numbers.labelFontSize>=70,'label avoids the top controls');
    assert.ok(numbers.rankY+numbers.rankFontSize*.25<=height-(preview?150:80),
      `${width}x${height} preview=${preview}: reading stays above bottom controls`);
    assert.ok(numbers.rankY>numbers.y&&numbers.y>numbers.labelY);
    if(sideBySide&&shift===1)assert.ok(box.x+box.width<numbers.x-numbers.fontSize*1.5,
      'short landscape separates the flame and number columns');
    if(!sideBySide&&shift===1)assert.ok(numbers.labelY-44>box.y+box.height*.81,
      'portrait title and text start below the luminous fire root');
  }
  assert.equal(JSON.stringify(base),before,'layout never changes the original material box');
}
console.log('Fire scan transition passed: immutable outcome, staged timing, smooth count, rank thresholds, pause/replay and responsive layout.');
