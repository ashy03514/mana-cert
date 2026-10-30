/* Hosts the exact ocean study inside the existing reveal clock and layout. */
(function(root){
  'use strict';
  const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
  const smooth=value=>{const p=clamp(value);return p*p*(3-2*p);};
  // Projected diameter / square canvas edge for the study's perspective camera.
  // This only accounts for transparent padding; it does not change its shader.
  const SPHERE_COVERAGE=2.61/Math.sqrt(3.4*3.4-1);
  class WaterOceanReveal {
    constructor(){
      this.surface=new root.WaterOceanStudy(document.createElement('canvas'));
      this.ready=this.surface.ready;
      this.lastTime=-Infinity;this.lastKey='';this.placement=null;
      this.onRestored=()=>{this.lastTime=-Infinity;this.lastKey='';};
      this.surface.canvas.addEventListener('webglcontextrestored',this.onRestored);
    }
    get loaded(){return this.surface.textureReady&&!this.error&&!this.lost&&!this.surface.disposed;}
    get lost(){return this.surface.lost;}
    get error(){return this.surface.error;}
    static placement(width,height,box,{waterPower,formation=1}={}){
      const cx=box.x+box.width/2;
      if(!Number.isFinite(waterPower)){
        const diameter=Math.min(width*.88,box.height*.92,Math.max(32,height-260));
        const cy=box.y+box.height/2;
        return {x:cx-diameter/2,y:cy-diameter/2,diameter,cx,cy,rootY:cy+diameter/2};
      }
      const power=clamp(waterPower,0,3);
      // Keep the established E–SS volume growth and bottom anchor. Geometry,
      // normals, reflected sky and foam all come from the shared ocean study.
      let radius=.12+.53*Math.pow(Math.min(power,1),.82);
      radius+=.22*clamp((power-1)/.94)+.15*smooth((power-1.94)/.58)+.03*smooth((power-2.52)/.48);
      radius*=.10+.90*smooth(formation/.82);
      const diameter=box.width*radius,rootY=box.y+box.height/2+box.width*.33;
      const cy=rootY-diameter/2;
      return {x:cx-diameter/2,y:rootY-diameter,diameter,cx,cy,rootY};
    }
    draw(ctx,background,width,height,frame){
      if(!this.loaded)return false;
      const time=Number.isFinite(frame.time)?Math.max(0,frame.time):0;
      const placement=WaterOceanReveal.placement(width,height,frame.box,frame);
      const edge=placement.diameter/SPHERE_COVERAGE;
      const profile=frame.waterEffects?.profile||root.WaterRankEffects.profileForPower(frame.waterPower);
      const visualTime=Number.isFinite(frame.waterEffects?.time)?Math.max(0,frame.waterEffects.time):time*profile.speed;
      const spray=root.WaterRankEffects.sprayStrength(visualTime,profile);
      const resolution=Math.max(128,Math.min(640,Math.round(edge*Math.min(1.5,root.devicePixelRatio||1))));
      const key=[resolution,profile.rank,spray,profile.waveScale,profile.seaTexture,
        profile.foamAmount,profile.breakers].join(':');
      this.placement=placement;
      this.effects={profile,time:visualTime,spray};
      // The host owns pause, seek and lifecycle. No second animation loop, no
      // accumulated texture offsets, and no old SS pokes or crossing waves.
      if(time<this.lastTime||time-this.lastTime>=1/30-1e-6||key!==this.lastKey){
        this.surface.resize(resolution,resolution,1);
        if(!this.surface.draw(visualTime,{surge:1,spray,breakers:profile.breakers,waveScale:profile.waveScale,
          seaTexture:profile.seaTexture,foamAmount:profile.foamAmount}))return false;
        this.lastTime=time;this.lastKey=key;
      }
      ctx.save();ctx.globalCompositeOperation='source-over';ctx.globalAlpha=clamp(frame.opacity??1);
      ctx.drawImage(this.surface.canvas,placement.cx-edge/2,placement.cy-edge/2,edge,edge);ctx.restore();
      return true;
    }
    dispose(){
      this.surface.canvas.removeEventListener('webglcontextrestored',this.onRestored);
      this.surface.dispose();this.lastTime=-Infinity;
    }
  }
  root.WaterOceanReveal=WaterOceanReveal;
})(globalThis);
