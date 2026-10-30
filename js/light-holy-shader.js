/* Warm sacred atmosphere, halo and light core. Feather anatomy is owned by
 * LightHolyWings so the silhouette has actual layered flight feathers. */
(function(root){
  'use strict';
  const vertex=`
    attribute vec2 aPosition;
    varying vec2 vUv;
    void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}
  `;
  const fragment=`
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform vec4 uArt;
    uniform float uTime,uCore,uWings,uCrown,uAwaken,uPulse;
    uniform float uGodRays;
    // Opt-in for the SS wing study; unset uniforms retain the approved
    // static composition and every older attribute host unchanged.
    uniform float uRayMotion,uRayBurst;
    float sq(float x){return x*x;}
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){
      vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
    }
    float mist(vec2 p){return noise(p)*.65+noise(p*2.03+7.9)*.25+noise(p*4.1+19.6)*.1;}
    void main(){
      vec2 pixel=vec2(vUv.x*uResolution.x,(1.-vUv.y)*uResolution.y);
      vec2 p=(pixel-uArt.xy)/max(1.,uArt.z);p.y=-p.y;
      float safe=1.-smoothstep(uArt.w-uArt.z*.10,uArt.w+uArt.z*.10,pixel.y);
      float near=exp(-dot(p/vec2(1.15,1.4),p/vec2(1.15,1.4)));
      float lower=smoothstep(uArt.y+uArt.z*.9,uArt.w+uArt.z*.7,pixel.y);
      vec3 gold=mix(vec3(.76,.61,.30),vec3(.94,.84,.57),near*.88);
      vec3 color=mix(gold,vec3(.95,.91,.79),lower);
      float cloud=mist(p*.95+vec2(uTime*.014,-uTime*.018));
      color+=(cloud-.5)*vec3(.095,.079,.045)*safe;
      // Broad warm light descends from above; the pulse washes through air
      // rather than flashing the entire screen to featureless white.
      float above=smoothstep(-.3,.8,p.y);
      float shaft=exp(-sq(p.x/(.24+max(0.,p.y)*.23)));
      float angle=atan(p.x,p.y+2.6);
      float rays=pow(.5+.5*sin(angle*43.+sin(angle*19.)+uTime*.09),9.);
      rays*=exp(-abs(p.x)*.7)*above;
      float pulseY=2.1-mod(uTime,2.)*1.65;
      float wash=exp(-sq((p.y-pulseY)/.64))*uPulse;
      color+=vec3(.095,.091,.066)*(shaft*.4+rays*.32+wash*.20)*safe*uCrown;
      // Volumetric crepuscular rays fan out from the joined wing roots.
      // Vary width, reach and brightness so the corona never becomes a
      // uniformly striped sunburst. Existing animated studies opt out.
      if(uGodRays>0.){
        float scattered=0.;
        if(uRayMotion>0.){
          // Each opening through the imagined cloud bank has its own
          // clock and opening width. There is deliberately no common
          // angular time offset: light emerges and fades in place.
          for(int i=0;i<27;i++){
            float fi=float(i),seed=hash(vec2(fi,37.));
            // The cloud gaps keep changing even between releases. A full
            // aperture range and independent 1-2 second transitions make
            // idle light visibly breathe without a shared flash or spin.
            float tempo=mix(.42,1.05,hash(vec2(fi,91.)));
            float opening=clamp((noise(vec2(fi*7.3+13.,uTime*tempo+seed*29.))-.15)*1.45,0.,1.);
            float curtain=noise(vec2(fi*2.83-8.,uTime*(tempo*.58)+9.));
            float detail=noise(vec2(fi*11.1+4.,uTime*(tempo*1.13)+5.));
            float bend=(noise(vec2(fi*4.21,uTime*(.26+seed*.19)+2.))-.5)*.11;
            float theta=fi*6.2831853/27.+(seed-.5)*.14+bend;
            vec2 direction=vec2(cos(theta),sin(theta));
            float along=dot(p,direction),across=abs(p.x*direction.y-p.y*direction.x);
            float aperture=mix(.012,.130,smoothstep(.08,.92,opening));
            float spread=.014+max(0.,along)*aperture*(1.+uRayBurst*.24);
            float length=mix(1.25,5.5,curtain*.38+opening*.62)*(1.+uRayBurst*.15);
            // A bright soft spine and a wider scattering shoulder give
            // the shaft depth without a flat, hard-edged sunburst.
            float softness=exp(-sq(across/spread))*.76+exp(-sq(across/(spread*2.7)))*.24;
            float reach=smoothstep(.04,.34,along)*(1.-smoothstep(length*.40,length,along));
            float airDepth=.52+.48*noise(vec2(along*.78-uTime*(.16+seed*.18),fi*3.1));
            float occlusion=mix(.025,1.,smoothstep(.14,.84,opening*.78+curtain*.22));
            float brightness=mix(.38,1.05,seed)*occlusion*(.65+detail*.45);
            scattered+=softness*reach*airDepth*brightness;
          }
        }else{
          for(int i=0;i<27;i++){
            float fi=float(i),seed=hash(vec2(fi,37.));
            float theta=fi*6.2831853/27.+(seed-.5)*.14;
            vec2 direction=vec2(cos(theta),sin(theta));
            float along=dot(p,direction),across=abs(p.x*direction.y-p.y*direction.x);
            float spread=.018+max(0.,along)*mix(.023,.075,hash(vec2(fi,11.)));
            float length=mix(2.2,4.1,hash(vec2(fi,63.)));
            float softness=exp(-sq(across/spread));
            float reach=smoothstep(.08,.42,along)*(1.-smoothstep(length*.48,length,along));
            float airDepth=.76+.24*noise(vec2(along*.7,fi*3.1));
            scattered+=softness*reach*airDepth*mix(.24,.63,seed);
          }
        }
        float falloff=1.-smoothstep(uArt.w-uArt.z*.05,uArt.w+uArt.z*.55,pixel.y);
        float burst=clamp(uRayBurst,0.,1.);
        float radiance=clamp(scattered*(.78+burst*.72),0.,.65+burst*.15)*falloff*uGodRays;
        vec3 backlight=mix(vec3(1.,.971,.80),vec3(1.,.993,.94),burst*.65);
        color=mix(color,backlight,clamp(radiance,0.,.9));
        // The release illuminates the air at the roots, with the UI
        // falloff still applied. Feather detail is drawn above this.
        float releaseAir=exp(-dot(p/vec2(.88,1.08),p/vec2(.88,1.08)))*burst*.17*falloff;
        color=mix(color,vec3(1.,.993,.94),releaseAir);
      }
      // A round halo keeps an emblem-like outline behind the feather wings.
      vec2 halo=p-vec2(0.,.23);
      float radius=mix(.18,1.12,uCrown),d=length(halo)-radius;
      float arc=atan(halo.y,halo.x),sheen=.8+.2*sin(arc*2.-uTime*.23);
      float ring=exp(-sq(d/.010))*.52+exp(-sq(d/.031))*.18+exp(-sq(d/.095))*.10;
      color=mix(color,vec3(1.,.985,.86),clamp(ring*sheen*uCrown,0.,.9)*safe);
      float corona=exp(-sq(d/.18))*.045;
      color+=vec3(1.,.90,.55)*corona*uCrown*safe;
      float inner=exp(-sq((length(halo)-radius*.93)/.005))*.065*uCrown;
      color+=vec3(1.,.95,.75)*inner*safe;
      // Small white-gold lozenge at the joined roots, lit from within.
      vec2 q=p-vec2(.006*sin(uTime*.4),.008*sin(uTime*.47));
      float breath=1.+sin(uTime*.65)*.025;
      float diamond=abs(q.x)/(.125*breath)+abs(q.y)/(.30*breath);
      float gem=(1.-smoothstep(.91,1.08,diamond))*uCore;
      float facets=smoothstep(-.05,.09,q.x+q.y*.28);
      vec3 pearl=mix(vec3(.87,.78,.52),vec3(1.,.995,.92),facets);
      color=mix(color,pearl,gem*safe);
      float aura=exp(-dot(q/vec2(.32,.45),q/vec2(.32,.45)))*.12*uCore;
      color+=vec3(1.,.93,.67)*aura*safe*(1.+uAwaken*.35);
      color=clamp(color,vec3(0.),vec3(.995,.987,.958));
      gl_FragColor=vec4(color,1.);
    }
  `;
  root.LightHolyShader=Object.freeze({vertex,fragment});
})(globalThis);
