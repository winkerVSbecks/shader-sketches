const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../../utils/mouse');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl2',
  animate: true,
  duration: 8,
};

// Your glsl code
const frag = glsl(/* glsl */ `#version 300 es
  precision highp float;

  out vec4 fragColor;

  #define PI 3.14159265359
  #define TAU 6.283185

  vec2 doModel(vec3 p);

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')
  #pragma glslify: smin = require('glsl-smooth-min')
  #pragma glslify: combine = require('glsl-combine-smooth')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')

  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;
  uniform vec2  mouse;
  uniform vec3  background;
  uniform vec3  foreground;

  // Geometry
  mat2 rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  float dot2(vec3 v) { return dot(v,v); }
  float dot2(vec2 v) { return dot(v,v); }
  float cro( in vec2 a, in vec2 b ) { return a.x*b.y - a.y*b.x; }

  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
  }

  float sdBox( vec2 p, vec2 b ) {
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
  }

  // 2D Bezier curve with fill
  float sdBezier( in vec2 pos, in vec2 A, in vec2 B, in vec2 C ) {
    vec2 a = B - A;
    vec2 b = A - 2.0*B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;

    float kk = 1.0/dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b))/3.0;
    float kz = kk * dot(d,a);

    float res = 0.0;
    float sgn = 0.0;

    float p  = ky - kx*kx;
    float q  = kx*(2.0*kx*kx - 3.0*ky) + kz;
    float p3 = p*p*p;
    float q2 = q*q;
    float h  = q2 + 4.0*p3;

    if( h>=0.0 )
    {   // 1 root
        h = sqrt(h);
        vec2 x = (vec2(h,-h)-q)/2.0;

        #if 0
        // When p≈0 and p<0, h-q has catastrophic cancelation. So, we do
        // h=√(q²+4p³)=q·√(1+4p³/q²)=q·√(1+w) instead. Now we approximate
        // √ by a linear Taylor expansion into h≈q(1+½w) so that the q's
        // cancel each other in h-q. Expanding and simplifying further we
        // get x=vec2(p³/q,-p³/q-q). And using a second degree Taylor
        // expansion instead: x=vec2(k,-k-q) with k=(1-p³/q²)·p³/q
        if( abs(p)<0.001 )
        {
            float k = p3/q;              // linear approx
          //float k = (1.0-p3/q2)*p3/q;  // quadratic approx
            x = vec2(k,-k-q);
        }
        #endif

        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        float t = clamp( uv.x+uv.y-kx, 0.0, 1.0 );
        vec2  q = d+(c+b*t)*t;
        res = dot2(q);
    	sgn = cro(c+2.0*b*t,q);
    }
    else
    {   // 3 roots
        float z = sqrt(-p);
        float v = acos(q/(p*z*2.0))/3.0;
        float m = cos(v);
        float n = sin(v)*1.732050808;
        vec3  t = clamp( vec3(m+m,-n-m,n-m)*z-kx, 0.0, 1.0 );
        vec2  qx=d+(c+b*t.x)*t.x; float dx=dot2(qx), sx = cro(c+2.0*b*t.x,qx);
        vec2  qy=d+(c+b*t.y)*t.y; float dy=dot2(qy), sy = cro(c+2.0*b*t.y,qy);
        if( dx<dy ) { res=dx; sgn=sx; } else {res=dy; sgn=sy; }
    }

    return sqrt( res )*sign(sgn);
  }

  float smax(float a, float b, float r) {
    vec2 u = max(vec2(r + a,r + b), vec2(0));
    return min(-r, max (a, b)) + length(u);
  }

  float windowFrame(vec3 p, float sa, float sb, float t, vec2 a, vec2 b, vec2 c) {
    float d = 0.;
    // left arc
    float d1 = sdBezier(p.xy, a, b, c);
    // right arc
    float d2 = sdBezier(p.xy, a, b * vec2(-1, 1), c * vec2(-1, 1));
    d = max(d1, -d2);
    d = max(d, sdBox(p.xy, vec2(sb, sa)));

    return d;
  }

  float cairo(vec3 p) {
    float a = .5;

    float d1 = sdCapsule(p, vec3(-1, 1., 0), vec3(-a, 0, 0), 0.15);
    float d2 = sdCapsule(p, vec3(-a, 0, 0), vec3(a, 0, 0), 0.15);
    float d3 = sdCapsule(p, vec3(a, 0, 0), vec3(1, 1, 0), 0.15);
    float d4 = sdCapsule(p, vec3(-1, -1., 0), vec3(-a, 0, 0), 0.15);
    float d5 = sdCapsule(p, vec3(a, 0, 0), vec3(1, -1, 0), 0.15);

    float d = min(d1, d2);
    d = min(d, d3);
    d = min(d, d4);
    d = min(d, d5);

    return d;
  }

  float jali(vec3 p) {
    vec3 q = p;

    vec2 id = floor(p.xy);
    float check = mod(id.x + id.y, 2.);

    q.xy = fract(p.xy);
    q.xy = -1. + 2. * q.xy;

    // rotate every other tile
    if(check == 1.) q.xy = q.yx;
    float d = cairo(q);

    return d * 0.4;
  }

  vec2 doModel(vec3 p) {
    // window vars
    float sa = 3.;
    float sb = sa-1.;
    float t = 0.1;
    vec2 a = vec2(0, sa);
    vec2 b = vec2(-sb, sa * 0.6);
    vec2 c = vec2(-sb, 1);

    float win = windowFrame(p, sa, sb, t*1.5, a, b, c);
    float wall = sdBox(p.xy, vec2(10.));
    float d = max(-win, wall);

    d = smax(d, abs(p.z) - .1, .01);

    float d1 = max(jali(p), win);
    d = min(d, d1);

    return vec2(d, 0);
  }

  void main() {
    vec3 color = vec3(background);

    vec3 ro = vec3(0, 0, 5);
    vec3 rt = vec3(0, 0, 0);
    vec2 screenPos = square(resolution.xy);
    float lensLength = 1.0;

    ro.yz *= rot(PI*0.5 + PI * mouse.y);
    ro.xz *= rot(PI*0.5 + PI * mouse.x);

    vec3 rd = camera(ro, rt, screenPos, lensLength);

    vec3 lp = vec3(0, 5, 5);

    vec2 t = raytrace(ro, rd);

    if (t.x > -0.5) {
      vec3 pos = ro + rd * t.x;
      vec3 nor = normal(pos);

      vec3 ed = normalize(ro - pos);
      vec3 ld = normalize(lp - pos);
      // basic blinn phong lighting
      float power = blinnPhongSpec(ld, ed, nor, 0.1) * 0.5;
      color = vec3(power) * foreground;
    }

    fragColor = vec4(color, 1.0);
  }
`);

export const vert = glsl(/* glsl */ `#version 300 es
  precision highp float;
  in vec3 position;

  void main () {
    gl_Position = vec4(position.xyz, 1.0);
  }
`);

const sketch = ({ gl, canvas }) => {
  const { background, foreground } = colors();
  const mouse = createMouse(canvas);

  return createShader({
    gl,
    vert,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      mouse: () => mouse.position,
      background,
      foreground,
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get();
  if (!palette.background) palette = tome.get();
  console.log(palette.name);

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) =>
      Color.contrastRatio(background, color) >= minContrast &&
      color !== background
  );

  const foreground = Random.pick(colors);

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
  };
}

canvasSketch(sketch, settings);
