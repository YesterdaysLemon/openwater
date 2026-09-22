export const noiseGLSL = /* glsl */`
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise2(vec2 p) {
 vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
 return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) { float n=0.0,a=.5; for(int i=0;i<5;i++){n+=a*noise2(p);p=mat2(.8,-.6,.6,.8)*p*2.03+17.4;a*=.5;} return n; }
`;
export const skyGLSL = /* glsl */`
uniform vec3 sunDirection;
uniform float uCloud;
uniform float uNight;
uniform float uWarmth;
uniform float time;
uniform sampler2D uSky;
vec3 skyColor(vec3 rd, bool clouds) {
 float h = max(rd.y,0.0);
 float haze = pow(1.0-h,5.0);
 vec3 zenith = mix(vec3(.095,.31,.58),vec3(.13,.21,.34),uWarmth);
 vec3 horizon = mix(vec3(.64,.76,.81),vec3(.94,.48,.22),uWarmth);
 zenith=mix(zenith,vec3(.005,.012,.035),uNight);
 horizon=mix(horizon,vec3(.055,.105,.16),uNight);
 vec3 col=mix(zenith,horizon,haze*.92);
 float sun=max(dot(rd,sunDirection),0.0);
 vec3 sunTint=mix(vec3(1.0,.91,.73),vec3(1.0,.49,.18),uWarmth);
 sunTint=mix(sunTint,vec3(.52,.68,1.0),uNight);
 col+=sunTint*pow(sun,24.0)*.25*(1.0-uCloud*.8);
 col+=sunTint*min(pow(sun,1800.0)*5.0,5.0)*(1.0-uCloud*.92);
 col=mix(col,vec3(.22,.28,.33)*(1.0-uNight*.9),smoothstep(.65,1.0,uCloud)*.8);
 if(clouds && rd.y>0.005) {
   vec2 cp=rd.xz/(rd.y+.14)*2.1 + vec2(time*.004,0.0);
   float n=fbm(cp);
   float detail=fbm(cp*3.1+5.0);
   float cloud=smoothstep(.72-uCloud*.5,.86-uCloud*.55,n+detail*.12);
   cloud*=smoothstep(0.0,.12,rd.y);
   vec3 lit=mix(vec3(1.1,1.12,1.1),vec3(1.25,.78,.46),uWarmth);
   lit=mix(lit,vec3(.1,.14,.21),uNight);
   vec3 shade=mix(vec3(.42,.51,.59),vec3(.12,.17,.22),smoothstep(.5,1.0,uCloud));
   shade=mix(shade,vec3(.015,.025,.055),uNight);
   vec3 cc=mix(shade,lit,smoothstep(.33,.76,n*.65+detail*.35));
   col=mix(col,cc,cloud*.96);
 }
 if(uNight>.1 && rd.y>.05) {
  vec2 st=rd.xz/(rd.y+.3)*420.0;
  float star=pow(hash21(floor(st)),95.0)*pow(max(0.0,1.0-length(fract(st)-.5)*2.0),5.0);
  col+=star*uNight*(1.0-uCloud)*.7;
 }
 vec2 skyUV=vec2(atan(rd.z,rd.x)/6.2831853+.5,asin(clamp(rd.y,-1.0,1.0))/3.14159265+.5);
 vec3 photo=texture2D(uSky,skyUV).rgb*.64;
 photo=mix(photo,photo*vec3(1.22,.74,.46),uWarmth*.8);
 photo=mix(photo,vec3(dot(photo,vec3(.2126,.7152,.0722)))*vec3(.29,.36,.43),smoothstep(.5,.95,uCloud));
 photo=mix(photo,photo*vec3(.012,.025,.065),uNight);
 col=mix(col,photo,.88);
 col+=sunTint*min(pow(sun,2200.0)*3.0,3.0)*(1.0-uCloud*.85);
 return col;
}
`;
export const waveGLSL = /* glsl */`
uniform float time;
uniform float uSwell;
uniform float uWind;
vec3 waves(vec2 p, out vec3 normal, out float crest) {
 vec3 offset=vec3(0.0);vec3 dx=vec3(1,0,0),dz=vec3(0,0,1);crest=0.0;
 for(int i=0;i<12;i++) {
  float fi=float(i), angle=.58+sin(fi*1.913)*1.22;
  vec2 d=vec2(cos(angle),sin(angle));
  float k=.14*pow(1.36,fi), a=.43*pow(.66,fi)*uSwell;
  float phase=k*dot(d,p)-sqrt(9.81*k)*time*(.65+uWind*.026)+fi*2.43;
  float s=sin(phase),c=cos(phase),q=.7;
  offset+=vec3(q*a*d.x*c,a*s,q*a*d.y*c);
  dx+=vec3(-q*a*k*d.x*d.x*s,a*k*d.x*c,-q*a*k*d.x*d.y*s);
  dz+=vec3(-q*a*k*d.x*d.y*s,a*k*d.y*c,-q*a*k*d.y*d.y*s);
  crest+=a*k*s;
 }
 normal=normalize(cross(dz,dx));
 return vec3(p.x,0.0,p.y)+offset;
}
`;
