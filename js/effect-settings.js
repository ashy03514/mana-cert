/* Versioned device-local visual settings. Never used by result probabilities. */
(function(root){
  'use strict';
  const key='mana.portal.effects.v1';
  const range=(group,label,value,min,max,step=1,unit='%')=>({group,label,value,min,max,step,unit,type:'range'});
  const color=(group,label,value)=>({group,label,value,type:'color'});
  const toggle=(group,label,value=true)=>({group,label,value,type:'checkbox'});
  const palette=(group,value)=>({group,label:'色彩池',value:Object.freeze(value),type:'palette'});
  const paletteLimit=12;
  const fields={
    idleSeconds:range('motion','待機每圈秒數',Math.PI*2/.075,10,180,.1,'秒'),
    activeSeconds:range('motion','按住每圈秒數',1,.3,5,.1,'秒'),
    acceleration:range('motion','加速時間',2,.2,8,.1,'秒'),
    deceleration:range('motion','恢復時間',2,.2,8,.1,'秒'),
    mistEnabled:toggle('mist','顯示霧'),
    mistCount:range('mist','霧團總數',30,12,144,1,'團'),
    mistSize:range('mist','大小',100,50,200,5),
    mistOpacity:range('mist','濃淡',100,10,150,5),
    mistDrift:range('mist','飄動程度',100,0,200,5),
    mistPalette:palette('mist',['#6457a2']),
    dotEnabled:toggle('dots','顯示圓點'),
    dotCount:range('dots','圓點總數',55,12,306,1,'顆'),
    dotSize:range('dots','大小',100,50,250,5),
    dotOpacity:range('dots','亮度',100,10,150,5),
    dotSpeed:range('dots','速度倍率',100,25,200,5),
    dotDepth:range('dots','深度感',100,0,200,5),
    dotPalette:palette('dots',['#d7dbf6']),
    starEnabled:toggle('stars','顯示星芒',false),
    starSize:range('stars','大小',100,50,200,5),
    starOpacity:range('stars','亮度',100,10,115,5),
    starIdle:range('stars','待機出現頻率',100,25,200,5),
    starHeld:range('stars','按住出現頻率',100,25,200,5),
    starDuration:range('stars','平均持續時間',1.1,.3,3.5,.1,'秒'),
    starPalette:palette('stars',['#65eaff','#ce83ff','#ffffff']),
    burstCount:range('burst','魔力球數量',100,25,150,5),
    burstSize:range('burst','魔力球大小',100,50,200,5),
    burstOpacity:range('burst','魔力球亮度',100,10,100,5),
    burstRadius:range('burst','向外擴散範圍',100,50,160,5),
    burstDepth:range('burst','遠近深度感',100,0,150,5),
    burstDuration:range('burst','爆炸到收束時間',2.1,1.2,4,.1,'秒'),
    burstUseTrail:toggle('burst','沿用手指軌跡顏色'),
    burstPalette:palette('burst',['#7deaff','#ac82f3']),
    burstStarEnabled:toggle('burstStars','顯示爆炸星芒'),
    burstStarCount:range('burstStars','每次數量',48,0,96,1,'顆'),
    burstStarSize:range('burstStars','大小',100,50,200,5),
    burstStarOpacity:range('burstStars','亮度',100,10,100,5),
    burstStarSpin:range('burstStars','自轉速度',100,0,200,5),
    burstStarPalette:palette('burstStars',['#65eaff','#ce83ff','#ffffff']),
    flashEnabled:toggle('flashes','顯示瞬閃星芒'),
    flashCount:range('flashes','每次數量',30,0,60,1,'顆'),
    flashSize:range('flashes','大小',100,50,250,5),
    flashOpacity:range('flashes','亮度',100,10,100,5),
    flashDuration:range('flashes','平均閃現時間',.14,.06,.3,.01,'秒'),
    flashPalette:palette('flashes',['#65eaff','#ce83ff','#ffffff']),
    backgroundCenter:color('background','中央顏色','#080915'),
    backgroundOuter:color('background','外圍顏色','#24223f'),
    trailEnabled:toggle('trails','顯示手指軌跡'),
    trailWidth:range('trails','光帶粗細',2.5,1,6,.5,'px'),
    trailOpacity:range('trails','線條亮度',86,10,100,1),
    trailGlowSize:range('trails','光暈大小',10,4,24,1,'px'),
    trailGlowOpacity:range('trails','光暈亮度',30,0,60,5),
    trailFingerSize:range('trails','指尖光點大小',24,8,32,1,'px'),
    trailHold:range('trails','放開後停留時間',2,0,8,.1,'秒'),
    trailFade:range('trails','淡出時間',1.5,.2,4,.1,'秒'),
    trailFlowEnabled:toggle('trails','沿線能量流動'),
    trailFlowDensity:range('trails','流動亮段數量',100,0,200,5),
    trailFlowSpeed:range('trails','能量流動速度',100,25,200,5),
    trailDustEnabled:toggle('trails','星塵、細閃與消散光點'),
    trailDustDensity:range('trails','星塵與光點數量',100,0,200,5),
    trailRandom:toggle('trails','每筆隨機選色',false),
    trailPalette:palette('trails',['#7deaff','#ce83ff','#ffffff'])
  };
  const defaults=Object.freeze(Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,f.value])));
  const validColor=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  // Migrate only the old color controls. Keep every unrelated saved setting,
  // and honor disabled colors in both current values and personal presets.
  function legacyPalette(source,key){
    if(key==='mistPalette')return [1,2,3].map(i=>source['mistColor'+i]);
    if(key==='dotPalette')return [source.dotColor];
    const prefix=key==='trailPalette'?'trail':'star';
    const fallback=prefix==='trail'?defaults.trailPalette:defaults.starPalette;
    const colors=['Blue','Purple','White'].map((name,i)=>source[prefix+name]===false?null:
      (source[prefix+'Color'+(i+1)]??fallback[i]));
    return colors.some(validColor)?colors:[validColor(source[prefix+'Color3'])?source[prefix+'Color3']:fallback[2]];
  }
  function normalizePalette(value,fallback){
    const colors=Array.isArray(value)?value.filter(validColor).map(v=>v.toLowerCase()).slice(0,paletteLimit):[];
    return colors.length?colors:[...fallback];
  }
  function normalize(input){
    const source=input&&typeof input==='object'?input:{};
    const result={};
    for(const [k,f] of Object.entries(fields)){
      const v=source[k];
      result[k]=f.type==='range'?(typeof v==='number'&&Number.isFinite(v)?Math.min(f.max,Math.max(f.min,v)):f.value)
        :f.type==='palette'?normalizePalette(v??(k==='burstPalette'?f.value:
          (k==='flashPalette'||k==='burstStarPalette')?(source.starPalette??legacyPalette(source,'starPalette')):legacyPalette(source,k)),f.value)
        :f.type==='color'?(validColor(v)?v.toLowerCase():f.value)
        :typeof v==='boolean'?v:f.value;
    }
    for(const k of ['mistCount','dotCount','burstStarCount','flashCount'])result[k]=Math.round(result[k]);
    return result;
  }
  const appearanceRevision=2,backupKey=key+'.before-reference';
  function load(storage){
    try{
      const raw=storage.getItem(key),data=JSON.parse(raw);
      if(data?.version!==1)return normalize();
      if(data.appearanceRevision===appearanceRevision)return normalize(data.values);
      // Apply the approved whole-scene appearance once. Keep the user's speed
      // controls and preserve a recoverable copy of all previous visual values.
      const old=normalize(data.values),next=normalize();
      for(const [k,f] of Object.entries(fields))if(f.group==='motion')next[k]=old[k];
      try{
        if(!storage.getItem(backupKey))storage.setItem(backupKey,raw);
        save(storage,next);
      }catch(_){/* Restricted storage must not prevent rendering the new look. */}
      return next;
    }catch(_){return normalize();}
  }
  function save(storage,values){try{storage.setItem(key,JSON.stringify({version:1,appearanceRevision,values:normalize(values)}));return true;}catch(_){return false;}}
  const defaultsKey=key+'.user-defaults';
  function loadDefaults(storage){
    try{const data=JSON.parse(storage.getItem(defaultsKey));return normalize(data?.version===1?data.values:null);}
    catch(_){return normalize();}
  }
  function saveDefaults(storage,values){
    try{storage.setItem(defaultsKey,JSON.stringify({version:1,values:normalize(values)}));return true;}
    catch(_){return false;}
  }
  function resetGroup(values,group,preset=defaults){const next={...values},target=normalize(preset);for(const [k,f] of Object.entries(fields))if(f.group===group)next[k]=target[k];return normalize(next);}
  function mount(doc,storage,onChange){
    let values=load(storage);
    const status=doc.getElementById('effectSaveStatus');
    const setDefault=doc.getElementById('effectSetDefault');
    const paletteViews=new Map();
    const groupNames={mist:'霧',dots:'圓點粒子',stars:'閃爍星芒',trails:'手指軌跡',burst:'爆炸',burstStars:'爆炸星芒',flashes:'瞬閃星芒'};
    const suggested=['#65eaff','#ce83ff','#ffffff','#ffb76b','#ff83b7','#91ffc5','#ffe68c'];
    function renderPalette(k){
      const host=doc.getElementById('effect_'+k),colors=values[k];
      let view=paletteViews.get(k);
      if(!view){
        const grid=host.querySelector('.effectPaletteGrid');
        const add=doc.createElement('button');add.type='button';add.className='effectPaletteAdd';
        add.textContent='＋\n新增顏色';add.setAttribute('aria-label',groupNames[fields[k].group]+' 新增顏色');
        add.addEventListener('click',()=>{
          if(values[k].length>=paletteLimit)return;
          const next=suggested.find(c=>!values[k].includes(c))||'#ffffff';
          values=normalize({...values,[k]:[...values[k],next]});commit();
          paletteViews.get(k).items.at(-1).input.focus();
        });
        grid.appendChild(add);
        view={grid,add,items:[],hint:host.querySelector('.effectPaletteHint')};paletteViews.set(k,view);
      }
      // Keep native color inputs mounted while a picker is open. Replacing them
      // on every input event closes the picker on some mobile browsers.
      if(view.items.length!==colors.length){
        for(const item of view.items)item.card.remove();
        view.items=colors.map((color,index)=>{
          const card=doc.createElement('div');card.className='effectSwatch';
          const label=doc.createElement('label');label.textContent='顏色 '+(index+1);
          const input=doc.createElement('input');input.type='color';
          input.id='effect_'+k+'_'+index;label.htmlFor=input.id;
          input.addEventListener('input',()=>{
            const next=[...values[k]];next[index]=input.value;
            values=normalize({...values,[k]:next});commit();
          });
          const remove=doc.createElement('button');remove.type='button';remove.className='effectSwatchRemove';
          remove.textContent='×';remove.setAttribute('aria-label','刪除顏色 '+(index+1));
          remove.addEventListener('click',()=>{
            if(values[k].length<=1)return;
            values=normalize({...values,[k]:values[k].filter((_,i)=>i!==index)});commit();
            paletteViews.get(k).items[Math.min(index,values[k].length-1)].input.focus();
          });
          card.append(input,label,remove);view.grid.insertBefore(card,view.add);
          return {card,input,remove};
        });
      }
      view.items.forEach((item,i)=>{item.input.value=colors[i];item.remove.disabled=colors.length===1;});
      view.add.disabled=colors.length>=paletteLimit;
      view.hint.textContent=colors.length+' 種顏色 · 點色格修改，× 刪除；保留 1–'+paletteLimit+' 色。';
    }
    function render(){for(const [k,f] of Object.entries(fields)){
      if(f.type==='palette'){renderPalette(k);continue;}
      const input=doc.getElementById('effect_'+k);
      if(f.type==='checkbox')input.checked=values[k];else input.value=values[k];
      if(f.type==='range')doc.getElementById('effect_value_'+k).textContent=Number(values[k].toFixed(f.step<.1?2:1))+f.unit;
    }}
    function commit(){render();setDefault.textContent='設為預設';status.textContent=save(storage,values)?'已儲存在此裝置':'本次調整已套用；此裝置目前無法儲存。';onChange(values);}
    for(const [k,f] of Object.entries(fields)){
      if(f.type==='palette')continue;
      const input=doc.getElementById('effect_'+k);
      input.addEventListener(f.type==='checkbox'?'change':'input',()=>{
        values=normalize({...values,[k]:f.type==='checkbox'?input.checked:f.type==='range'?Number(input.value):input.value});commit();
      });
    }
    for(const group of new Set(Object.values(fields).map(f=>f.group)))doc.getElementById('effect_reset_'+group).addEventListener('click',()=>{values=resetGroup(values,group,loadDefaults(storage));commit();});
    doc.getElementById('effectResetAll').addEventListener('click',()=>{values=loadDefaults(storage);commit();});
    setDefault.addEventListener('click',()=>{
      const saved=saveDefaults(storage,values);
      setDefault.textContent=saved?'已設為預設':'儲存失敗';
      status.textContent=saved?'目前特效已設為此裝置的預設值':'無法儲存預設值，原本的預設值未變更。';
    });
    render();onChange(values);
  }
  root.EffectSettings={fields,defaults,paletteLimit,normalize,load,save,loadDefaults,saveDefaults,resetGroup,mount};
})(globalThis);
