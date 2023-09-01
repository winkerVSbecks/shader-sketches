const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../../utils/mouse');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl2',
  animate: false,
  duration: 8,
};

const frag = glsl(/* glsl */ `#version 300 es
  precision highp float;

  #define PI 3.14159265359
  #define TAU 6.283185
  #define sampleCount 2 // use 200 for stills

  out vec4 fragColor;

  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')

  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;
  uniform vec2  mouse;
  uniform vec3  background;
  uniform vec3  foreground;

  mat2 rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  float TIME = 0.0;
  vec2 RUV = vec2(0.0);

  float nrand( vec2 n ) {
    return fract(sin(dot(n.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float n1rand( vec2 n ) {
    TIME *= 1.01;
    float t = fract( TIME );
    float nrnd0 = nrand( RUV + vec2(0.07*t, -0.07*t) );
    return nrnd0;
  }

  float sdPlane(in vec3 p, in vec3 n, in float o) {
    return dot(p, n)-o;
  }

  float dot2(vec3 v) { return dot(v,v); }
  float dot2(vec2 v) { return dot(v,v); }
  float cro( in vec2 a, in vec2 b ) { return a.x*b.y - a.y*b.x; }

  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
  }

  float sdVerticalCapsule( vec3 p, float h, float r ) {
    p.y -= clamp( p.y, 0.0, h );
    return length( p ) - r;
  }

  float sdBox( vec2 p, vec2 b ) {
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
  }

  float udQuad(vec3 p, vec3 a, vec3 b, vec3 c, vec3 d) {
    vec3 ba = b - a; vec3 pa = p - a;
    vec3 cb = c - b; vec3 pb = p - b;
    vec3 dc = d - c; vec3 pc = p - c;
    vec3 ad = a - d; vec3 pd = p - d;
    vec3 nor = cross( ba, ad );

    return sqrt(
      (sign(dot(cross(ba,nor),pa)) +
      sign(dot(cross(cb,nor),pb)) +
      sign(dot(cross(dc,nor),pc)) +
      sign(dot(cross(ad,nor),pd))<3.0)
      ?
      min( min( min(
      dot2(ba*clamp(dot(ba,pa)/dot2(ba),0.0,1.0)-pa),
      dot2(cb*clamp(dot(cb,pb)/dot2(cb),0.0,1.0)-pb) ),
      dot2(dc*clamp(dot(dc,pc)/dot2(dc),0.0,1.0)-pc) ),
      dot2(ad*clamp(dot(ad,pd)/dot2(ad),0.0,1.0)-pd) )
      :
      dot(nor,pa)*dot(nor,pa)/dot2(nor) );
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

  // 3D Bezier curve
  float sdBezier(in vec3 p, in vec3 v1, in vec3 v2, in vec3 v3) {
    vec3 c1 = p - v1;
    vec3 c2 = 2.0 * v2 - v3 - v1;
    vec3 c3 = v1 - v2;

    float t3 = dot(c2, c2);
    float t2 = dot(c3, c2) * 3.0 / t3;
    float t1 = (dot(c1, c2) + 2.0 * dot(c3, c3)) / t3;
    float t0 = dot(c1, c3) / t3;

    float t22 = t2 * t2;
    vec2 pq = vec2(t1 - t22 / 3.0, t22 * t2 / 13.5 - t2 * t1 / 3.0 + t0);
    float ppp = pq.x * pq.x * pq.x, qq = pq.y * pq.y;

    float p2 = abs(pq.x);
    float r1 = 1.5 / pq.x * pq.y;

    if (qq * 0.25 + ppp / 27.0 > 0.0) {
        float r2 = r1 * sqrt(3.0 / p2), root;
        if (pq.x < 0.0) root = sign(pq.y) * cosh(acosh(r2 * -sign(pq.y)) / 3.0);
        else root = sinh(asinh(r2) / 3.0);
        root = clamp(-2.0 * sqrt(p2 / 3.0) * root - t2 / 3.0, 0.0, 1.0);
        return length(p - mix(mix(v1, v2, root), mix(v2, v3, root), root));
    }

    else {
        float ac = acos(r1 * sqrt(-3.0 / pq.x)) / 3.0;
        vec2 roots = clamp(2.0 * sqrt(-pq.x / 3.0) * cos(vec2(ac, ac - 4.18879020479)) - t2 / 3.0, 0.0, 1.0);
        vec3 p1 = p - mix(mix(v1, v2, roots.x), mix(v2, v3, roots.x), roots.x);
        vec3 p2 = p - mix(mix(v1, v2, roots.y), mix(v2, v3, roots.y), roots.y);
        return sqrt(min(dot(p1, p1), dot(p2, p2)));
    }
  }

  float clipShape(vec3 q, float sa, float sb, float t, vec2 a, vec2 b, vec2 c) {
    vec2 p = q.xy;

    float d = 0.;
    // left arc
    float d1 = sdBezier(p, a, b, c);
    // right arc
    float d2 = sdBezier(p, a, b * vec2(-1, 1), c * vec2(-1, 1));

    d = p.y > 0. ? max(d1, -d2) : 1.;
    d = min(d, sdBox(p+vec2(0, 1.), vec2(sb, sa-1.)));

    vec2 w = vec2(d, abs(q.z) - t);
    return min(max(w.x,w.y),0.0) + length(max(w,0.0));
  }

  float windowFrame(vec3 p, float sa, float sb, float t, vec3 a, vec3 b, vec3 c) {
    float d = 0.;
    // left arc
    float d1 = sdBezier(p, a, b, c) - t;
    // right arc
    float d2 = sdBezier(p, a, b * vec3(-1, 1, 1), c * vec3(-1, 1, 1)) - t;
    d = min(d1, d2);
    // verticals
    d = min(d, sdVerticalCapsule(p - vec3(-sb, -sa, 0), sa + 1., t));
    d = min(d, sdVerticalCapsule(p - vec3(sb, -sa, 0), sa + 1., t));
    // horizontal
    p.xy = p.yx;
    d = min(d, sdVerticalCapsule(p - vec3(-sa, -sb, 0), sb * 2., t));

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
    vec3 a = vec3(0, sa, 0);
    vec3 b = vec3(-sb, sa * 0.6, 0);
    vec3 c = vec3(-sb, 1, 0);

    float d = sdPlane(p, vec3(0., 1., 0.), -3.5);

    // Window frame
    float win = windowFrame(p, sa, sb, t*1.5, a, b, c);
    // Jali
    float clip = clipShape(p, sa, sb, t, a.xy, b.xy, c.xy);
    float jal = max(jali(p), clip);
    // Wall
    float wall = udQuad(p, vec3(-100,-100,0), vec3(100,-100,0), vec3(100,100,0), vec3(-100,100,0));
    wall = max(-clip, wall);
    // combine
    d = min(d, min(win, jal));
    // d = min(d, jal);
    d = min(d, wall);

    return vec2(d * 0.8, 0);
  }

  vec3 march(in vec3 ro, in vec3 rd, in float maxD) {
    float minD=0.;
    float threshold = 0.0001;

    float d=minD;
    for(int i=0;i<90;i++){
        vec3 pos = ro + rd*d;
        float tmp = doModel(pos).x;
        if(tmp <threshold || maxD<tmp) break;
        d += tmp;
    }

    if (maxD < d) return vec3(maxD);
    return ro + rd * clamp(d, 0., maxD);
  }

  void main() {
    TIME = time;
    RUV = (gl_FragCoord.xy-0.5*resolution.xy)/min(resolution.x, resolution.y);

    vec3 color = vec3(0);
    float pix_value = 0.0;

    vec3 ro = vec3(8, 4, 10);
    vec3 rt = vec3(0, 0, 0);

    ro.yz *= rot(-PI*0.5 + PI * mouse.y);
    ro.xz *= rot(-PI*0.5 + PI * mouse.x);

    vec2 screenPos = square(resolution);
    float lensLength = 2.;

    vec3 rd = camera(ro, rt, screenPos, lensLength);
    vec3 hit = march(ro, rd, 100.0);
    vec3 p = ro;
    float d = distance(hit, p);

    for (int i = 0; i < sampleCount; i++) {
      vec3 lSample = mix(p, hit, n1rand(ro.xy * 0.01));
      vec3 light = vec3(2. * sin(TAU * playhead), 0., -2.);
      float maxD = distance(lSample, light);

      if (march(lSample, normalize(light - lSample), maxD).x == maxD) {
        pix_value += d / pow(1. + maxD, 2.);
      }
    }

    pix_value *= 1.0 / float(sampleCount);
    color = vec3(pix_value) * background;

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
    frag,
    vert,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time + 0.1,
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
