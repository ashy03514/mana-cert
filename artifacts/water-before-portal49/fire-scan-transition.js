/* Fire reveal to mana reading. Pure samples of the existing reveal clock. */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const smooth=v=>{const p=clamp(v);return p*p*(3-2*p);};
  const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
  const TIMING=Object.freeze({identify:.05,shiftEnd:.65,heatEnd:.4,
    numbersStart:.25,numbersEnd:.65,scanStart:.85,scanDuration:3.2,complete:4.05});
  const PREVIEW=Object.freeze({type:'magic',element:'火',mana:862,rank:'A'});
  const RANKS=Object.freeze([[1000,'SS'],[900,'S'],[750,'A'],[550,'B'],
    [350,'C'],[200,'D'],[10,'E']].map(entry=>Object.freeze(entry)));

  class FireScanTransition {
    static get timing(){return TIMING;}
    static get previewResult(){return PREVIEW;}
    static powerForValue(value){
      const mana=Math.max(0,Math.min(9999,finite(value)));
      // The former maximum is now the A threshold. S opens more fuel and SS
      // occupies the upper scene; continuous joins avoid a rank-boundary pop.
      if(mana<=750)return Math.pow(mana/750,.95);
      if(mana<=900)return 1+.36*smooth((mana-750)/150);
      if(mana<=1000)return 1.36+1.16*smooth((mana-900)/100);
      return 2.52+.48*(1-Math.exp(-(mana-1000)/650))/(1-Math.exp(-8999/650));
    }
    static speedForPower(power){
      return .7+1.2*Math.min(1,power)+.4*Math.max(0,power-1);
    }
    static flameTime(elapsed,result=PREVIEW){
      const time=Math.max(0,finite(elapsed)),target=Math.max(0,finite(result?.mana));
      const active=Math.max(0,time-TIMING.scanStart),span=Math.min(TIMING.scanDuration,active);
      // Integrate speed rather than multiplying time by the current intensity:
      // fuel changes must not jump the noise phase or teleport rising embers.
      let integral=0;
      if(span>0){
        const steps=128,step=span/steps;
        for(let i=0;i<=steps;i++){
          const value=target*smooth(i*step/TIMING.scanDuration);
          integral+=(FireScanTransition.speedForPower(FireScanTransition.powerForValue(value))-.7)*(i===0||i===steps?1:i%2?4:2);
        }
        integral*=step/3;
      }
      integral+=Math.max(0,active-TIMING.scanDuration)*(FireScanTransition.speedForPower(FireScanTransition.powerForValue(target))-.7);
      return time*.7+integral;
    }
    static rankForValue(value){
      for(const [threshold,rank] of RANKS)if(value>=threshold)return rank;
      return '—';
    }
    static sample(elapsed,result=PREVIEW){
      const time=Math.max(0,finite(elapsed));
      const target=Math.max(0,Math.trunc(finite(result?.mana)));
      const progress=clamp((time-TIMING.scanStart)/TIMING.scanDuration);
      const complete=time>=TIMING.complete;
      // The endpoint comes from the already committed result. Sampling never
      // advances time, chooses an outcome, or changes a saved result.
      const value=complete?target:Math.floor(target*smooth(progress));
      return {
        shift:smooth((time-TIMING.identify)/(TIMING.shiftEnd-TIMING.identify)),
        heat:smooth((time-TIMING.identify)/(TIMING.heatEnd-TIMING.identify)),
        opacity:smooth((time-TIMING.numbersStart)/(TIMING.numbersEnd-TIMING.numbersStart)),
        ignition:smooth((time-TIMING.numbersStart)/.2)
          *(1-smooth((time-TIMING.numbersEnd)/(TIMING.scanStart-TIMING.numbersEnd))),
        scanStarted:time>=TIMING.scanStart,complete,progress,value,
        power:FireScanTransition.powerForValue(value),fireTime:FireScanTransition.flameTime(time,result),
        rank:FireScanTransition.rankForValue(value),
        label:complete?'階段完成':time>=TIMING.scanStart?'魔力攀升':time>=TIMING.numbersStart?'數值顯現':time>=TIMING.identify?'火焰蓄熱':'屬性展開'
      };
    }
    static layout(width,height,baseBox,shift,{preview=false}={}){
      const w=Math.max(1,finite(width,1)),h=Math.max(1,finite(height,1));
      const amount=clamp(finite(shift));
      const box={...baseBox};
      const sideBySide=w>=h*1.35;
      const bottom=h-(preview?150:80),safeTop=70;
      // The material box includes transparent headroom. Protect the visible
      // flame, not that empty padding, so short phones still have room below.
      const boxTop=Math.max(10,safeTop-baseBox.height*.16);
      const maxLift=Math.max(0,Math.min(h*.09,76,baseBox.y-boxTop));
      const targetY=baseBox.y-maxLift;
      const compact=!sideBySide&&h<760;
      const fontSize=Math.max(32,Math.min(compact?32:52,w*.125,h*.075));
      const rankFontSize=Math.max(19,Math.min(26,fontSize*.5));
      const labelFontSize=compact?12:Math.max(14,Math.min(18,fontSize*.36));
      let x=w/2,y;
      box.y=baseBox.y-maxLift*amount;
      if(sideBySide){
        // On short screens the same material fits beside the readout. Moving
        // its box preserves the shader's world scale and flame proportions.
        const targetX=w*.30-baseBox.width/2;
        box.x=baseBox.x+(targetX-baseBox.x)*amount;
        x=w*.70;
        y=Math.max(safeTop+fontSize+labelFontSize+16,
          Math.min(bottom-rankFontSize-22,(safeTop+bottom)/2+fontSize*.2));
      }else{
        // The flame root is below the box centre (p.y around -.66). Reserve
        // its volumetric fringe too, then the attribute title above the label.
        const bodyBottom=targetY+baseBox.height*.81;
        y=Math.min(bottom-rankFontSize-22,bodyBottom+(compact?48:58)+fontSize+labelFontSize*.35);
        y=Math.max(safeTop+fontSize+labelFontSize+16,y);
      }
      return {box,sideBySide,numbers:{x,y,fontSize,rankFontSize,labelFontSize,
        labelY:y-fontSize-labelFontSize*.35,rankY:y+rankFontSize+14}};
    }
  }
  root.FireScanTransition=FireScanTransition;
})(globalThis);
