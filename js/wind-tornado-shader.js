/* Wind rank study: advected cloud volume, not stroked spiral ribbons.
 * The host supplies the active clock and composites premultiplied transparency.
 */
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
    uniform float uTime,uFormation,uCohesion;
    uniform vec4 uField;
    // Width, centreline sway, storm-ceiling amount, and low-rank oval vortex.
    uniform vec4 uShape;
    // Embedded diffuse discharges. There is no bolt geometry or exterior glow.
    uniform vec4 uCloudFlash,uFunnelFlash;
    float sat(float x){return clamp(x,0.,1.);}
    float sq(float x){return x*x;}
    float hash(vec3 p){
      // Arithmetic hash: volume noise does not need eight sin() calls per cell.
      p=fract(p*.1031);p+=dot(p,p.yzx+33.33);
      return fract((p.x+p.y)*p.z);
    }
    float noise3(vec3 p){
      vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
      return mix(mix(mix(hash(i),hash(i+vec3(1.,0.,0.)),f.x),
                     mix(hash(i+vec3(0.,1.,0.)),hash(i+vec3(1.,1.,0.)),f.x),f.y),
                 mix(mix(hash(i+vec3(0.,0.,1.)),hash(i+vec3(1.,0.,1.)),f.x),
                     mix(hash(i+vec3(0.,1.,1.)),hash(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
    }
    mat2 turn(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
    vec2 spine(float h,float t){
      // Large S bends belong to the waist, not the broad crown. Secondary
      // bends travel at a different cadence; h=0 stays anchored to the floor.
      // Keep this base spine in sync with the surface-arc projection in host.
      float bend=4.*h*(1.-h);
      return vec2(.23*bend*sin(7.1*h-.75*t)
                    +.055*bend*sin(12.2*h+.97*t)
                    +.075*h*sin(4.2*h-.37*t),
                  .10*bend*sin(6.4*h-.58*t)
                    +.035*h*sin(3.9*h+.42*t))*uShape.y;
    }
    float stormCloud(vec3 p,float t,bool shadowSample){
      if(p.y<.32||uShape.z<=0.)return 0.;
      vec2 q=p.xz-spine(1.,t)*.45;
      float radius=length(q);
      // A storm ceiling continues beyond the camera, with a lowered central
      // wall cloud feeding the funnel. There is no cap radius or top cutoff.
      vec2 swept=turn(-t*.85+1.35*min(radius,3.)) * q;
      vec3 field=vec3(swept.x*2.6,(p.y-.8)*3.2-t*.24,swept.y*2.6)+vec3(4.7,8.1,9.2);
      float cells=noise3(field);
      float wisps=noise3(field*2.65+vec3(7.1,3.4,12.2));
      float cloudNoise=cells*.70+wisps*.30;
      float angle=atan(q.y,q.x+.000001);
      // Traveling spiral pressure folds propagate inward through the cloud
      // mass; their phase is bounded and never winds the texture into strips.
      float curl=.5+.5*sin(angle*2.+log(1.+radius)*5.2+t*1.45+cells*1.7);
      float floorY=.49+.26*smoothstep(.18,1.65,radius)
                   +.16*(cells-.5)+.11*(curl-.5);
      float volume=smoothstep(floorY-.12,floorY+.24,p.y);
      float mass=volume*(.40+1.48*smoothstep(.20,.80,cloudNoise))*(.70+.30*curl);
      // Soften the front of the ray slab so its near plane cannot read as a
      // flat wall. The ceiling remains thick behind that feathered boundary.
      mass*=1.-smoothstep(.70,1.11,abs(p.z));
      return mass*smoothstep(.30,.97,uFormation)*uShape.z;
    }
    float funnelDensity(vec3 p,float t,bool shadowSample){
      float h=(p.y+.86)/1.78;
      float height=sat(h);
      // Narrow the density around its own moving axis. The axis bend remains
      // separately controlled so C can be straight without freezing the air.
      vec2 q=(p.xz-spine(height,t))/max(.05,uShape.x);
      float radius=length(q);
      // Most slices miss the narrow lower funnel. Reject them before noise;
      // retain wider bounds only where crown or ground eddies can contribute.
      float matureEnvelope=.054+.54*pow(height,1.45)+.14*pow(height,5.);
      float looseEnvelope=.24+.28*pow(height,.65);
      float envelope=mix(looseEnvelope,matureEnvelope,uCohesion);
      float bound=envelope*1.58+.025;
      if(p.y>.57)bound=max(bound,1.0);
      if(p.y<-.63)bound=max(bound,.82);
      if(radius>bound||p.y< -1.08||p.y>1.43)return 0.;
      float angle=atan(q.y,q.x+.000001);
      // Cloud cells are swept around, stretched tangentially and lifted.
      // Sampling a rotated Cartesian field avoids an atan texture seam.
      // Keep vertical shear bounded. A height-dependent angular speed would
      // wind the cloud field into thinner stripes forever during long play.
      float rotation=-t*1.85+height*3.3+.52*sin(height*4.8-t*.57);
      vec2 spinning=turn(rotation)*q;
      vec3 flow=vec3(spinning.x*5.4,p.y*5.1-t*1.15,spinning.y*5.4);
      float broad=noise3(flow*.62+vec3(8.1,3.7,12.6));
      float detail=noise3(flow*1.73+vec3(broad*1.5,5.4,17.2));
      // Lighting needs broad self-shadowing, not another full fine-noise pass.
      float fine=detail;
      if(!shadowSample)fine=noise3(flow*4.12+vec3(21.8,-t*.22,6.3));
      float turbulence=broad*.60+detail*.25+fine*.15;
      envelope*=1.+.085*sin(height*11.-t*.83+broad*4.)+.20*(broad-.5);
      float normalized=radius/max(.035,envelope);
      // The rim is broken into irregular cloud tufts. A weaker interior lets
      // the shadowed far side show through without making a hollow wire coil.
      float edge=1.-smoothstep(.72+(turbulence-.5)*.40,1.12+(turbulence-.5)*.48,normalized);
      float shell=.48+.52*exp(-sq((normalized-.74)/.37));
      float churn=smoothstep(.29,.70,turbulence);
      float corkscrew=.5+.5*sin(angle*3.-height*13.+t*2.4+broad*5.);
      float fold=.76+.24*corkscrew;
      // Denser connected cloud cells retain the dark interior because the
      // lighting path uses extinction; density is not added white emission.
      float body=edge*shell*(.23+1.65*churn)*fold;
      float cap=.99+.17*(broad-.5)+.055*sin(angle*3.-t*.48);
      body*=smoothstep(-.035,.065,h)*(1.-smoothstep(cap-.085,cap+.085,h));
      if(uCohesion<1.){
        // Unformed wind consists of torn, rising spiral sheets. The gaps are
        // oblique and noisy, never horizontal cuts through a miniature cone.
        float strand=.5+.5*sin(angle*2.-height*10.5+t*1.55+broad*3.4);
        float torn= smoothstep(.46,.81,strand)*smoothstep(.32,.64,turbulence);
        float looseShell=exp(-sq((normalized-.73)/.30));
        float wisp=looseShell*torn*(.55+1.75*churn);
        float top=.79+.20*(broad-.5)+.095*sin(angle*2.-t*.63);
        wisp*=smoothstep(-.03,.13,h)*(1.-smoothstep(top-.22,top+.12,h));
        // E retains only a hint of central structure; D links more of the
        // sheets into a rough column, and C recovers the original funnel.
        float connection=smoothstep(.12,1.,uCohesion);
        body=mix(wisp,body,connection);
      }

      // Thin ground-level eddies curl into the base; their patchiness and
      // drifting radius avoid a complete luminous ellipse around the foot.
      float dust=0.;
      float intake=0.;
      if(p.y<-.57){
        vec2 dustFlow=turn(-t*2.25)*(p.xz/max(.05,uShape.x));
        float dustCloud=noise3(vec3(dustFlow*7.6,t*.38));
        float dustRadius=.32+.075*sin(angle*3.+t*.78)+.055*(dustCloud-.5);
        dust=exp(-sq((radius-dustRadius)/.19));
        dust*=exp(-sq((p.y+.85-radius*.035)/(.030+.032*dustCloud)));
        dust*=smoothstep(.26,.73,dustCloud)*.80;
        intake=exp(-sq(radius/.20)-sq((p.y+.81)/.085))*.43;
      }
      float form=smoothstep(0.,.16,uFormation);
      float rise=1.-smoothstep(uFormation+.01,uFormation+.19,height);
      rise=mix(rise,1.,smoothstep(.83,1.,uFormation));
      return (body+dust+intake)*form*rise;
    }
    float ringDensity(vec3 p,float t,bool shadowSample){
      // D/E retain the familiar oblique, hollow wind loop, but its cloud cells
      // and extinction lighting are the same material as the larger funnel.
      // Centreline for host particles (r ~= 1):
      // y=-.08+.63*sin(a)*r, x=.38*cos(a)*r+.19*y,
      // z=.24*y+.10*sin(2*a-t*.22).
      vec3 q=p;
      q.x-=p.y*.19;
      q.z-=p.y*.24;
      q.y+=.08;
      vec2 oval=q.xy/vec2(.38,.63);
      float radius=length(oval);
      if(radius<.48||radius>1.55||abs(q.z)>.46)return 0.;
      float angle=atan(oval.y,oval.x+.000001);
      float curl=.035*sin(angle*3.-t*.55)+.025*sin(angle*5.+t*.31);
      float thickness=.15+.025*sin(angle*2.-t*.40);
      float shell=exp(-sq((radius-1.-curl)/thickness));
      float inner=exp(-sq((radius-.80+curl*.6)/(thickness*.68)));
      float outer=exp(-sq((radius-1.16-curl*1.2)/(thickness*.76)));
      inner*=.38*smoothstep(-.45,.50,sin(angle*1.7+t*.62));
      outer*=.30*smoothstep(-.25,.65,cos(angle*2.3-t*.41));
      shell+=inner+outer;
      float depth=q.z-.10*sin(angle*2.-t*.22);
      shell*=exp(-sq(depth/.15));
      // Rotating Cartesian fields do not accumulate a texture seam or shear.
      vec2 swept=turn(-t*1.1)*oval;
      vec3 field=vec3(swept*3.,q.z*5.-t*.18)+vec3(8.1,3.7,12.6);
      float broad=noise3(field);
      float detail=noise3(field*2.3+vec3(5.4,17.2,4.7));
      float fine=detail;
      if(!shadowSample)fine=noise3(field*4.12+vec3(21.8,-t*.22,6.3));
      float turbulence=broad*.60+detail*.25+fine*.15;
      float torn=smoothstep(.24,.68,turbulence);
      float opening=.22+.78*smoothstep(-.65,.15,sin(angle+t*.28+.7));
      float form=smoothstep(0.,.8,uFormation);
      return shell*(.18+1.75*torn)*opening*form;
    }
    float density(vec3 p,float t,bool shadowSample){
      if(uShape.w>=1.)return ringDensity(p,t,shadowSample);
      float cloud=stormCloud(p,t,shadowSample);
      float funnel=funnelDensity(p,t,shadowSample);
      float volume=max(cloud,funnel)+min(cloud,funnel)*.18;
      if(uShape.w<=0.)return volume;
      return mix(volume,ringDensity(p,t,shadowSample),uShape.w);
    }
    void main(){
      vec2 screen=uField.xy+vUv*uField.zw;
      if(uFormation<=0.||screen.y< -1.20){gl_FragColor=vec4(0.);return;}
      vec3 accumulated=vec3(0.);
      float transmission=1.;
      // Fixed bounded raymarch. The slight downward view reveals crown depth
      // and makes the near ground eddy pass in front of the contact point.
      const float stepSize=2.2/32.;
      vec3 light=normalize(vec3(-.58,.74,.49));
      for(int i=0;i<32;i++){
        float z=1.1-(float(i)+.5)*stepSize;
        vec3 p=vec3(screen.x,screen.y-z*.105,z);
        float d=density(p,uTime,false);
        if(d>.012){
          float litDensity=density(p+light*.075,uTime,true);
          // Broad extinction darkens the deep folds; the density gradient
          // picks out sunward cloud tufts without an emissive white core.
          float direct=clamp(.46+(d-litDensity)*2.35,.08,1.);
          float broadLight=sat(.55-p.x*.48+p.z*.19);
          float occlusion=exp(-litDensity*1.55);
          float illumination=sat(direct*.53+broadLight*.19+occlusion*.28);
          illumination=pow(illumination,1.27);
          // Thick clouds occlude overhead light on their lower shelf. This
          // broad value change gives the storm depth instead of a white cap.
          float cloudShade=smoothstep(.68,1.12,p.y)*uShape.z;
          illumination*=1.-cloudShade*.29;
          vec3 tint=mix(vec3(.055,.105,.13),vec3(.79,.86,.84),illumination);
          float dustTint=1.-smoothstep(-.83,-.65,p.y);
          tint=mix(tint,tint*vec3(1.04,.99,.88),dustTint*.55);
          if(uCloudFlash.w+uFunnelFlash.w>0.){
            vec3 cloudDistance=(p-uCloudFlash.xyz)/vec3(.50,.25,.56);
            vec3 funnelDistance=(p-uFunnelFlash.xyz)/vec3(.23,.30,.36);
            float cloudLight=exp(-dot(cloudDistance,cloudDistance)*1.55)*uCloudFlash.w;
            float funnelLight=exp(-dot(funnelDistance,funnelDistance)*1.7)*uFunnelFlash.w;
            float internalLight=1.-exp(-(cloudLight*5.0+funnelLight*6.0));
            // Extinction and existing density keep the light inside the mist;
            // shadowed folds stay legible even at the brightest moment.
            vec3 flashTint=mix(vec3(.74,.80,.92),vec3(.99,.995,1.),sqrt(illumination));
            tint=mix(tint,flashTint,internalLight*.94);
          }
          float alpha=1.-exp(-d*stepSize*4.3);
          accumulated+=transmission*alpha*tint;
          transmission*=1.-alpha;
        }
        if(transmission<.025)break;
      }
      // Keep the volume alpha and RGB paired; screen-space compositing must
      // not turn overlapping cloud layers into an emissive white tornado.
      float alpha=1.-transmission;
      gl_FragColor=vec4(accumulated,alpha);
    }
  `;
  root.WindTornadoShader=Object.freeze({vertex,fragment});
})(globalThis);
