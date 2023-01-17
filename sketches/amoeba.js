const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const glsl = require('glslify');
const tome = require('chromotome');
const THREE = require('three');
const createMouse = require('../utils/mouse');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

function colors(minContrast = 1) {
  let palette = tome.get('spatial02i');
  if (!palette.background) palette = tome.get();

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) =>
      Color.contrastRatio(background, color) >= minContrast &&
      color !== background
  );

  const stroke = palette.stroke === background ? null : palette.stroke;

  const foreground = stroke || Random.pick(colors);

  return {
    name: palette.name,
    background,
    foreground,
    shadow: stroke && Color.relativeLuminance(stroke) < 0.5 ? stroke : '#333',
    fills: colors,
  };
}

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform float loopTime;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec3 shadow;
  uniform vec2 mouse;
  varying vec2 vUv;

  #define PI 3.14159265359
  #define TAU 6.283185

  // Utils
  float mapRange(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  float EaseOutQuart(float x) { return 1.0 - pow(1.0 -x, 4.0); }

  // Operations
  mat2 rotate2d(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  float opUnion( float d1, float d2 ) { return min(d1, d2); }
  float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
  }
  float opSubtraction( float d1, float d2 ) { return max(d1, -d2); }

  float opDisplace(vec3 p, float d) {
    float d1 = sin(2. * PI * time + p.x) * sin(2. * PI * time + p.y) * sin(2. * PI * time + p.z);
    return d + d1;
  }

  vec4 unionSDF(vec4 a, vec4 b) { return a.w < b.w ? a : b; }
  vec4 subSDF(vec4 d1, vec4 d2) { return d1.w > -d2.w ? d1 : d2; }

  // float opWave () {
  //   pos.y = pos.y + 0.05 * sin(pos.x * PI * 0.1 + time * 2. * PI);
  // }

  vec3 opWave(vec3 p) {
    const float k = .5;
    float o = p.x * 0.5;

    float t = p.x * time;

    float c = cos(t);
    float s = sin(t);
    mat2  m = mat2(c,-s,s,c);
    return vec3(m*p.xy,p.z);

    // float o = p.x * PI * 0.01;

    // // float c = cos(k*p.y);
    // float c = cos(o + time * PI);
    // // float s = sin(k*p.y);
    // float s = sin(o + time * PI);
    // mat2  m = mat2(1,-s,s,1);
    // // return vec3(m*p.xz,p.y);
    // vec2 q = m*p.xz;
    // return vec3(q.x, p.y, q.y);

    // return vec3(p.x, p.y + 0.05 * sin(p.x * PI * 0.01 + time * 2. * PI), p.z);
  }

  float opTwist(vec3 p) {
    float t = iTime;
    float k = 0.55*sin(2.0*t); // or some other amount
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xz,p.y);
    return sdRoundBox(q,size,roundr);
  }


  // SDF Shapes
  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
  }

  float sdSphere( vec3 p, float s ) { return length(p)-s; }

  vec4 amoeba(vec3 pos) {
    pos = opWave(pos);

    float at = EaseOutQuart(min(1., mapRange(loopTime, 0., 0.5, 0., 1.)));
    float r = 0.0125;

    // float d = sdCapsule(pos, vec3(-.75, 0., 0.), vec3(.75, 0., 0.), 0.5);
    // d = opSubtraction(d, sdSphere(pos - vec3(-0.125, 0., .5), 0.25));
    float body = sdCapsule(pos, vec3(-.75, 0., 0.), vec3(.75, 0., 0.), 0.5);
    body = opSubtraction(body, sdSphere(pos - vec3(-0.125, 0., .5), 0.2));

    vec4 d = vec4(foreground, body);
    d = unionSDF(d, vec4(foreground, sdSphere(pos - vec3(-0.125, 0., .3), 0.25)) );

    return d;
  }

  float map(in vec3 pos) {
    return amoeba(pos).w;
  }

  // https://iquilezles.org/articles/rmshadows
  float calcSoftshadow(in vec3 ro, in vec3 rd, float tmin, float tmax, const float k) {
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 64; i++) {
      float h = map(ro + rd * t);
      res = min(res, k * h / t);
      t += clamp(h, 0.01, 0.10);
      if (res < 0.002 || t > tmax)
        break;
    }
    return clamp(res, 0.0, 1.0);
  }

  // https://iquilezles.org/articles/normalsSDF
  vec3 calcNormal(in vec3 pos) {
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    const float eps = 0.0005;
    return normalize(
        e.xyy * map(pos + e.xyy * eps) + e.yyx * map(pos + e.yyx * eps) +
        e.yxy * map(pos + e.yxy * eps) + e.xxx * map(pos + e.xxx * eps));
  }

  void main() {
    // vec3 ro = vec3(2.);
    vec3 ro = vec3(0., 0., 2.5);
    // vec3 ro = vec3(0, 2, -3);
    ro.yz *= rotate2d(mouse.y * PI + 1.);
    ro.xz *= rotate2d(mouse.x * TAU);

    vec3 ta = vec3(0.0, 0.0, 0.0);
    // camera matrix
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));


    vec2 p = (-1.0 + 2.0 * vUv);

    // create view ray
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.5 * ww);

    // raymarch
    const float tmax = 12.0;
    float t = 0.0;
    for (int i = 0; i < 256; i++) {
      vec3 pos = ro + t * rd;
      float h = map(pos);
      if (h < 0.0001 || t > tmax)
        break;
      t += h;
    }

    // shading/lighting
    vec3 col = vec3(shadow);
    vec3 tot = background;

    if (t < tmax) {
      vec3 pos = ro + t * rd;
      vec3 nor = calcNormal(pos);
      vec3 light = vec3(.57703);
      float dif = clamp(dot(nor, light), 0.0, 1.0);

      if (dif > 0.001)
        dif *= calcSoftshadow(pos + nor * 0.001, light, 0.001, 1.0, 32.0);

      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      col = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;

      // gamma
      col = sqrt(col);
      tot = mix(shadow, amoeba(pos).xyz, col);
    }

    gl_FragColor = vec4(tot, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { name, background, foreground, fills, shadow } = colors();
  console.log({ name, background, foreground });
  const mouse = createMouse();

  return createShader({
    gl,
    frag,
    uniforms: {
      background: new THREE.Color(background).toArray(),
      foreground: new THREE.Color(foreground).toArray(),
      shadow: new THREE.Color(shadow).toArray(),
      mouse: () => mouse.position,
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      loopTime: ({ time }) => time % 1,
    },
  });
};

canvasSketch(sketch, settings);
