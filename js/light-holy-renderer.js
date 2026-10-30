/* SS holy-light art owner. All movement is sampled from active host seconds;
 * this study never chooses a result, advances a timer or changes settings. */
(function(root){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
  const finite=(v,f=0)=>Number.isFinite(v)?v:f;
  const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  class LightHolyRenderer {
    constructor(createCanvas=()=>document.createElement('canvas')){
      this.canvas=createCanvas();this.patch=createCanvas();this.patchCtx=this.patch.getContext('2d');
      this.gl=null;this.program=null;this.buffer=null;this.lost=false;this.disposed=false;
      this.error='';this.diagnostic='';this.lastTime=-Infinity;this.drawCount=0;this.lastKey='';
      this.onLost=e=>{e.preventDefault();this.lost=true;};
      this.onRestored=()=>{if(this.disposed)return;this.lost=false;this.gl=null;this.program=null;this.buffer=null;
        this.lastTime=-Infinity;this.lastKey='';this.error='';this.diagnostic='';this.init();};
      this.canvas.addEventListener?.('webglcontextlost',this.onLost);
      this.canvas.addEventListener?.('webglcontextrestored',this.onRestored);
    }
    static sample(time){
      const t=Math.max(0,finite(time)),age=t%2;
      return {time:t,core:smooth(t/.8),crown:smooth((t-.28)/1.5),
        wings:.82*smooth((t-.65)/1.65)+.18*smooth((t-2.65)/.55),
        awaken:smooth((t-2.65)/.10)*(1-smooth((t-2.95)/.65)),
        pulse:smooth(age/.20)*(1-smooth((age-1.25)/.55))*smooth(t-1)};
    }
    layout(w,h,box){
      const b=box||{x:0,y:38,width:w,height:h*.52};
      const unit=Math.max(1,Math.min(b.width*.385,b.height*.38,320));
      return {cx:b.x+b.width*.5,cy:b.y+b.height*.46,unit,bottom:b.y+b.height*.98,box:{...b}};
    }
    init(){
      if(this.disposed||this.lost)return false;if(this.gl&&this.program)return true;
      let gl=null,program=null,buffer=null;const shaders=[];
      try{
        if(!root.LightHolyShader)throw Error('Missing holy light shader');
        gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
        if(!gl)throw Error('WebGL unavailable');
        program=gl.createProgram();
        for(const [type,source] of [[gl.VERTEX_SHADER,root.LightHolyShader.vertex],[gl.FRAGMENT_SHADER,root.LightHolyShader.fragment]]){
          const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
          if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));
          gl.attachShader(program,shader);
        }
        gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
        buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        this.position=gl.getAttribLocation(program,'aPosition');this.uniforms={};
        for(const name of ['uResolution','uArt','uTime','uCore','uWings','uCrown','uAwaken','uPulse'])this.uniforms[name]=gl.getUniformLocation(program,name);
        gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
        this.gl=gl;this.program=program;this.buffer=buffer;return true;
      }catch(error){
        if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);
        this.error='目前無法顯示聖光，請重新整理後再試。';this.diagnostic=String(error);return false;
      }finally{if(gl)shaders.forEach(s=>gl.deleteShader(s));}
    }
    sparkleFrames(w,h,art,sample){
      const emerge=smooth((sample.wings-.5)/.35);if(!emerge)return [];
      const shared=root.FireRankSparkles;
      return shared.samples({time:sample.time,mana:999,referenceWidth:shared.referenceWidth(w,h)}).map(p=>{
        const angle=p.id*2.39996323+hash(p.seed+3)*.24,radial=.55+hash(p.seed+9)*.42;
        const x=art.cx+Math.cos(angle)*art.unit*1.24*radial;
        const top=Math.max(12,art.cy-art.unit*1.4),bottom=Math.min(h-12,art.bottom-18);
        const rise=Math.min(p.rise,Math.max(0,bottom-top-p.glow*2));
        const start=clamp(art.cy+Math.sin(angle)*art.unit*.92*radial,top+p.glow+rise,bottom-p.glow);
        return {...p,x:clamp(x,p.glow+2,w-p.glow-2),y:start-p.age*rise,
          alpha:p.alpha*emerge*.8,color:['#fff4d5','#e8ca8e','#edf4ff'][p.id%3]};
      });
    }
    dust(ctx,w,h,art,sample){
      const opacity=ctx.globalAlpha;ctx.save();ctx.globalCompositeOperation='source-over';
      for(let i=0;i<64;i++){
        const age=(sample.time*(.035+hash(i+8)*.045)+hash(i+31))%1;
        const depth=.5+hash(i+17)*.5;
        const x=art.cx+((hash(i+2)-.5)*2.6+Math.sin(age*4+i)*.045)*art.unit;
        const y=art.cy+(.75-age*2.25)*art.unit;
        if(y>art.bottom-14||y<8||x<2||x>w-2)continue;
        const alpha=smooth(age/.16)*(1-smooth((age-.75)/.25))*(.08+depth*.18)*sample.core;
        const size=(.45+hash(i+5)*.7)*depth;
        ctx.globalAlpha=alpha*opacity;ctx.fillStyle=i%3?'#ead8ab':'#bdcde7';
        ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
      }ctx.restore();
    }
    draw(ctx,w,h,{time=0,box,opacity=1}={}){
      if(this.disposed||this.lost||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||opacity<=0||!this.init())return false;
      const sample=LightHolyRenderer.sample(time),art=this.layout(w,h,box);
      if(![art.cx,art.cy,art.unit,art.bottom].every(Number.isFinite))return false;
      const scale=Math.min(root.devicePixelRatio||1,1.25,Math.sqrt(560000/(w*h)));
      const pw=Math.max(1,Math.round(w*scale)),ph=Math.max(1,Math.round(h*scale));
      const key=[w,h,art.cx,art.cy,art.unit,art.bottom,pw,ph].join(':');
      if(this.lastTime===-Infinity||sample.time<this.lastTime||sample.time-this.lastTime>=1/30-1e-6||key!==this.lastKey){
        const gl=this.gl,u=this.uniforms;
        if(this.canvas.width!==pw||this.canvas.height!==ph){this.canvas.width=this.patch.width=pw;this.canvas.height=this.patch.height=ph;}
        gl.viewport(0,0,pw,ph);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
        gl.enableVertexAttribArray(this.position);gl.vertexAttribPointer(this.position,2,gl.FLOAT,false,0,0);
        gl.uniform2f(u.uResolution,w,h);gl.uniform4f(u.uArt,art.cx,art.cy,art.unit,art.bottom);
        for(const [name,value] of [['uTime',sample.time],['uCore',sample.core],['uWings',sample.wings],['uCrown',sample.crown],['uAwaken',sample.awaken],['uPulse',sample.pulse]])gl.uniform1f(u[name],value);
        gl.drawArrays(gl.TRIANGLES,0,6);this.patchCtx.clearRect(0,0,pw,ph);this.patchCtx.drawImage(this.canvas,0,0);
        // Cache the detailed feather composite with its shader frame. Paused
        // views and intermediate host frames do not repaint thousands of barbs.
        this.patchCtx.save();this.patchCtx.scale(pw/w,ph/h);
        root.LightHolyWings.draw(this.patchCtx,art,sample);this.patchCtx.restore();
        this.lastTime=sample.time;this.lastKey=key;this.art=art;this.frame=sample;this.drawCount++;
      }
      ctx.save();ctx.globalAlpha*=clamp(opacity);ctx.globalCompositeOperation='source-over';
      ctx.drawImage(this.patch,0,0,w,h);
      this.dust(ctx,w,h,this.art,this.frame);
      root.FireRankSparkles.drawFrames(ctx,this.sparkleFrames(w,h,this.art,this.frame),ctx.globalAlpha);
      ctx.restore();return true;
    }
    dispose(){
      if(this.disposed)return;this.disposed=true;
      this.canvas.removeEventListener?.('webglcontextlost',this.onLost);this.canvas.removeEventListener?.('webglcontextrestored',this.onRestored);
      if(this.gl&&!this.lost){if(this.program)this.gl.deleteProgram(this.program);if(this.buffer)this.gl.deleteBuffer(this.buffer);}
      this.gl=null;this.program=null;this.buffer=null;this.canvas.width=this.canvas.height=this.patch.width=this.patch.height=1;
    }
  }
  root.LightHolyRenderer=LightHolyRenderer;
})(globalThis);
