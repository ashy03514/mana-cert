/* Registered rank growth. Source images keep their own texture coordinates.
 * Four feather banks unfold with rigid motion; no alpha-envelope warping. */
(function(root){
  'use strict';
  const vertex=`attribute vec2 aPosition;attribute vec2 aUv;varying vec2 vUv;
    uniform vec2 uResolution;void main(){vUv=aUv;gl_Position=vec4(aPosition.x/uResolution.x*2.-1.,1.-aPosition.y/uResolution.y*2.,0.,1.);}`;
  const fragment=`precision highp float;
    varying vec2 vUv;uniform sampler2D uYoung,uMature;
    uniform float uProgress,uOpacity,uSide,uGlow,uRadius,uExposure,uClock,uYoungOffset,uMatureOffset;
    uniform vec2 uRankScale;
    vec4 safe(sampler2D image,vec2 p,float offset,float scale){
      // Invert the same fixed per-image registration used by the preview and
      // feather birth points. Neither source changes scale during the wipe.
      p=vec2(.5,.72-offset)+(p-vec2(.5,.72))/scale;
      if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||(p.x-.5)*uSide<0.)return vec4(0.);
      return texture2D(image,p);
    }
    // Registered coordinate: x is distance from the fixed wing root; y is in
    // the original S canvas. The four smooth masks form a partition of unity.
    vec4 banks(vec2 p){
      float shoulder=1.-smoothstep(.08,.19,p.x);
      float tail=smoothstep(.65,.79,p.y)*(1.-shoulder);
      float primary=smoothstep(.21,.32,p.x)*(1.-smoothstep(.46,.66,p.y))*(1.-shoulder-tail);
      return vec4(shoulder,primary,max(0.,1.-shoulder-tail-primary),tail);
    }
    // Each bank moves as a whole. Inverse rigid transforms preserve the
    // aspect and length of every feather within that bank throughout growth.
    vec2 unfold(vec2 p,float progress,float angle,vec2 pivot,vec2 travel){
      float amount=1.-progress,c=cos(angle*amount),s=sin(angle*amount);
      vec2 q=p-pivot-travel*amount;
      return pivot+vec2(c*q.x-s*q.y,s*q.x+c*q.y);
    }
    float arriving(float start,float end,float reach){
      float front=mix(start,end,clamp(reach,0.,1.));
      return smoothstep(front-.055,front+.055,uProgress);
    }
    vec4 phases(float reach){return vec4(arriving(.08,.77,reach),arriving(.13,.86,reach),
      arriving(.19,.88,reach),arriving(.38,.93,reach));}
    float glints(vec2 p){
      vec2 grid=p*48.,cell=floor(grid);
      float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
      vec2 center=vec2(.25+seed*.5,.5+sin(seed*31.+uClock*1.1)*.16);
      float point=exp(-dot(fract(grid)-center,fract(grid)-center)*95.);
      return point*smoothstep(.63,.9,seed)*(.5+.5*sin(uClock*7.+seed*29.));
    }
    vec4 read(vec2 d){
      vec2 uv=vUv+d,p=vec2(abs(uv.x-.5),uv.y);
      vec4 weights=banks(p);
      // Shoulder settles first; flight feathers appear along their own length,
      // secondary feathers follow, then the longer trailing feathers open.
      float reach=length(vec2(p.x,(p.y-.72)*.78))/.60;
      vec4 phase=phases(reach);
      vec2 a=unfold(p,phase.x, .012,vec2(.025,.70),vec2(0.,0.));
      vec2 b=unfold(p,phase.y,-.048,vec2(.17,.48),vec2(-.018,.016));
      vec2 c=unfold(p,phase.z,-.030,vec2(.14,.55),vec2(-.014,.012));
      vec2 e=unfold(p,phase.w, .040,vec2(.10,.67),vec2(-.008,-.018));
      vec4 mature=safe(uMature,vec2(.5+uSide*a.x,a.y),uMatureOffset,uRankScale.y)*weights.x*phase.x
        +safe(uMature,vec2(.5+uSide*b.x,b.y),uMatureOffset,uRankScale.y)*weights.y*phase.y
        +safe(uMature,vec2(.5+uSide*c.x,c.y),uMatureOffset,uRankScale.y)*weights.z*phase.z
        +safe(uMature,vec2(.5+uSide*e.x,e.y),uMatureOffset,uRankScale.y)*weights.w*phase.w;
      // New feathers are born in light. Their normal shadow/color detail only
      // returns after the host has finished forming the complete S silhouette.
      mature.rgb=mix(mature.rgb,vec3(1.,.995,.96)*mature.a,uExposure*.94);
      // Retain the outgoing feather bed beneath the advancing light.
      vec4 young=safe(uYoung,uv,uYoungOffset,uRankScale.x);
      // Keep the juvenile feather bed underneath the arriving mature banks.
      // A reveal front must never erase the old tips before the longer ones
      // have reached them, otherwise the silhouette appears to shrink midway.
      float retire=arriving(.77,.94,reach);
      vec4 color=mature+young*(1.-mature.a)*(1.-retire);
      float seam=dot(weights,phase*(1.-phase))*4.;
      float flicker=.86+.14*sin(uClock*4.1+p.y*23.+p.x*17.);
      color.rgb=mix(color.rgb,vec3(1.,.99,.91)*color.a,min(1.,seam*(.86*flicker+glints(p))));
      return color;
    }
    // The broad halo does not need four rigid feather samples per tap. Its
    // registered alpha approximation keeps the soft pass affordable on mobile.
    float halo(vec2 d){
      vec2 uv=vUv+d,p=vec2(abs(uv.x-.5),uv.y);float reach=length(vec2(p.x,(p.y-.72)*.78))/.60;
      vec4 weights=banks(p),phase=phases(reach);
      float target=safe(uMature,uv,uMatureOffset,uRankScale.y).a,a=target*dot(weights,phase);
      if(uGlow>2.5){
        float surface=max(target,safe(uYoung,uv,uYoungOffset,uRankScale.x).a);
        return surface*dot(weights,phase*(1.-phase))*4.*(.86+.14*sin(uClock*4.1+p.y*23.+p.x*17.)+glints(p)*1.6);
      }
      if(uGlow>1.5)return a;
      return a+safe(uYoung,uv,uYoungOffset,uRankScale.x).a*(1.-a)*(1.-arriving(.77,.94,reach));
    }
    void main(){
      if(uGlow<.5){gl_FragColor=read(vec2(0.))*uOpacity;return;}
      vec2 d=vec2(uRadius,uRadius*1.5);float a=halo(vec2(0.))*.20;
      a+=(halo(vec2(d.x,0.))+halo(vec2(-d.x,0.))+halo(vec2(0.,d.y))+halo(vec2(0.,-d.y)))*.12;
      a+=(halo(d)+halo(-d)+halo(vec2(d.x,-d.y))+halo(vec2(-d.x,d.y)))*.08;
      a*=uOpacity;gl_FragColor=vec4(vec3(1.,.97,.83)*a,a);
    }`;
  class LightAngelLayeredGrowthRenderer extends root.LightAngelMotionRenderer{
    draw(ctx,w,h,options={}){
      const exposure=Number.isFinite(options.growthExposure)?Math.max(0,Math.min(1,options.growthExposure)):(options.growth<1?1:0);
      const transition=options.growthTransition;
      const valid=transition&&['A','S','SS'].includes(transition.from)&&['A','S','SS'].includes(transition.to)&&Number.isFinite(transition.progress);
      const pair=valid?{from:transition.from,to:transition.to,progress:Math.max(0,Math.min(1,transition.progress))}:null;
      // A paused scrub may change exposure while leaving shape/time untouched.
      const key=pair?pair.from+':'+pair.to+':'+pair.progress:'';
      if((exposure!==this.growthExposure||key!==this.layerPairKey)&&options.motionTime===this.lastTime)this.lastTime=-Infinity;
      this.growthExposure=exposure;this.layerPair=pair;this.layerPairKey=key;
      return super.draw(ctx,w,h,options);
    }
    initGrowth(){
      if(this.growthProgram)return;
      const gl=this.gl;this.growthProgram=this.makeProgram(vertex,fragment);
      this.layerAttributes={position:gl.getAttribLocation(this.growthProgram,'aPosition'),uv:gl.getAttribLocation(this.growthProgram,'aUv')};
      this.layerUniforms={};for(const key of ['uResolution','uYoung','uMature','uProgress','uOpacity','uSide','uGlow','uRadius','uExposure','uClock','uYoungOffset','uMatureOffset','uRankScale'])this.layerUniforms[key]=gl.getUniformLocation(this.growthProgram,key);
    }
    paintGrowingWings(art,s,state,profile){
      this.initGrowth();const gl=this.gl,u=this.layerUniforms,a=this.layerAttributes;
      const pair=this.layerPair||(state.growth<=1?{from:'A',to:'S',progress:state.growth}:{from:'S',to:'SS',progress:state.growth-1});
      const progress=Math.max(0,Math.min(1,pair.progress));
      const exposure=this.growthExposure??0;
      const scale=root.LightAngelMotion.wingScale,wingWidth=art.width*scale.SS;
      this.layerState={...pair,progress,exposure,mode:'registered-feather-banks',banks:4};
      // A fixed rectangular UV grid and gentle common articulation. Rank
      // transitions never remap a column to another image's outer silhouette.
      for(const mesh of this.meshes){
        for(let i=0;i<mesh.vertices.length;i+=4){
          const uv=mesh.vertices.subarray(i+2,i+4),point=root.LightAngelMotion.point(uv[0],uv[1],s.time,mesh.side,'A');
          // Formal ranks keep their authored breathing/release strength with
          // continuous pose interpolation, independent of color/exposure. The
          // standalone study retains its approved gentle common articulation.
          if(this.layerPair){
            const from=pair.from==='A'?point:root.LightAngelMotion.point(uv[0],uv[1],s.time,mesh.side,pair.from);
            const to=pair.to==='A'?point:root.LightAngelMotion.point(uv[0],uv[1],s.time,mesh.side,pair.to);
            point.x=from.x+(to.x-from.x)*progress;point.y=from.y+(to.y-from.y)*progress;
          }
          mesh.vertices[i]=art.cx+point.x*wingWidth;mesh.vertices[i+1]=art.cy+point.y*wingWidth;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,mesh.vertices);
      }
      gl.useProgram(this.growthProgram);gl.uniform2f(u.uResolution,this.logicalWidth,this.logicalHeight);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[pair.from]);gl.uniform1i(u.uYoung,0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[pair.to]);gl.uniform1i(u.uMature,1);
      gl.uniform1f(u.uYoungOffset,pair.from==='A'?.10:0);gl.uniform1f(u.uMatureOffset,pair.to==='A'?.10:0);
      gl.uniform2f(u.uRankScale,scale[pair.from]/scale.SS,scale[pair.to]/scale.SS);
      gl.uniform1f(u.uProgress,progress);gl.uniform1f(u.uExposure,exposure);gl.uniform1f(u.uClock,s.time);gl.enable(gl.BLEND);
      const passes=[[.017,1,s.visible*.30*profile.glow,gl.ONE_MINUS_SRC_COLOR]];
      if(exposure>0&&progress>0)passes.push([.033,2,s.visible*.65*exposure,gl.ONE_MINUS_SRC_COLOR]);
      passes.push([0,0,s.visible,gl.ONE_MINUS_SRC_ALPHA],[.003,1,s.visible*.09*profile.glow,gl.ONE_MINUS_SRC_COLOR]);
      if(progress>0&&progress<1)passes.push([.018,3,s.visible*.82,gl.ONE_MINUS_SRC_COLOR]);
      if(exposure>0&&progress>0)passes.push([.007,2,s.visible*.23*exposure,gl.ONE_MINUS_SRC_COLOR]);
      for(const [radius,glow,opacity,mode] of passes){
        gl.blendFunc(gl.ONE,mode);gl.uniform1f(u.uRadius,radius);gl.uniform1f(u.uGlow,glow);gl.uniform1f(u.uOpacity,opacity);
        for(const mesh of this.meshes){
          gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);
          gl.enableVertexAttribArray(a.position);gl.vertexAttribPointer(a.position,2,gl.FLOAT,false,16,0);
          gl.enableVertexAttribArray(a.uv);gl.vertexAttribPointer(a.uv,2,gl.FLOAT,false,16,8);
          gl.uniform1f(u.uSide,mesh.side);gl.drawElements(gl.TRIANGLES,mesh.indexCount,gl.UNSIGNED_SHORT,0);
        }
      }
      gl.activeTexture(gl.TEXTURE0);
    }
  }
  root.LightAngelLayeredGrowthRenderer=LightAngelLayeredGrowthRenderer;
})(globalThis);
