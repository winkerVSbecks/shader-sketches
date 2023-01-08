const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');
const THREE = require('three');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec3 diffusion;
  uniform vec3 rotationAxis;
  uniform float offsetX;
  uniform float offsetY;
  uniform vec3 boxSize;
  varying vec2 vUv;

  #define PI 3.14159265359


  void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
  }

  float smin(float a, float b, float k){
    float f = clamp(0.5 + 0.5 * ((a - b) / k), 0., 1.);
    return (1. - f) * a + f  * b - f * (1. - f) * k;
  }

  float smax(float a, float b, float k) {
    return -smin(-a, -b, k);
  }

  float sdRoundBox(vec3 p, vec3 b, float r) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  float sdSphere( vec3 p, float s ) {
  return length(p)-s;
  }

  // r = sphere's radius
  // h = cutting's plane's position
  // t = thickness
  float sdCutHollowSphere(vec3 p, float r, float h, float t) {
    vec2 q = vec2(length(p.xz), p.y);
    float w = sqrt(r * r - h * h);
    return ((h * q.x < w * q.y) ? length(q - vec2(w, h)) : abs(length(q) - r)) -
          t;
  }

  mat4 rotation3d(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat4(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                                0.0,                                0.0,                                1.0
    );
  }

  vec3 opBend(in float k, in vec3 p) {
    float c = cos(k*p.x);
    float s = sin(k*p.x);
    mat2  m = mat2(c,-s,s,c);
    return vec3(m*p.xy,p.z);
  }

  mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
  }

  float map(in vec3 pos) {
    float d = 1e10;

    float r = 0.25;
    float h = .0;
    float t = 0.01;

    d = min(d, sdSphere(pos, r));

    // pos = (rotation3d(vec3(0., 1., 0.), PI * .0625) * vec3(pos, 1.0)).xyz;
    pos.xz = rotate2d(PI * .125) * pos.xz;

    for (int l = 0; l < 4; l++) {
      for (int theta = 0; theta < 4; theta++) {
        float k = float(theta);
        float idx = k / 4.;
        vec3 q = pos + vec3(cos(2. * PI * idx), 0.0, sin(2. * PI * idx)) * (.125 + 0.125 * float(l));

        float rotation = -0.5 * PI + 0.5 * PI * k;
        q = (rotation3d(vec3(0., 0., 1.), rotation) * vec4(q, 1.0)).xyz;

        float rotation2 = PI * 0.25;
        float start = PI * 0.2;

        if (theta == 1) {
          rotation2 = PI * 0.2;
          start =  PI * 0.25;
        }

        if (theta == 3) {
          rotation2 = PI * 0.75;
          start = PI * 0.7;
        }

        q = (
          rotation3d(
            vec3(sin(2. * PI * idx), 0.0, cos(2. * PI * idx)),
            mix(start, rotation2, sin(time* PI + PI * .125 * float(l)))
          ) * vec4(q, 1.0)
        ).xyz;

        float bend = cos(time * PI) * .2;
        q = opBend(bend, q);
        d = min(d, sdCutHollowSphere(q, r + 0.125 * float(l), h, t));
      }
    }

    return d;
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
    vec3 ro = vec3(0.0, 2.0, 2.0);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    // camera matrix
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));

    vec2 p = (-1.0 + 2.0 * vUv);

    // create view ray
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.5 * ww);

    // raymarch
    const float tmax = 5.0;
    float t = 0.0;
    for (int i = 0; i < 256; i++) {
      vec3 pos = ro + t * rd;
      float h = map(pos);
      if (h < 0.0001 || t > tmax)
        break;
      t += h;
    }

    // shading/lighting
    vec3 col = vec3(0.0);
    vec3 pos = ro + t * rd;
    if (t < tmax) {
      vec3 nor = calcNormal(pos);
      vec3 light = vec3(.57703);
      float dif = clamp(dot(nor, light), 0.0, 1.0);

      if (dif > 0.001)
        dif *= calcSoftshadow(pos + nor * 0.001, light, 0.001, 1.0, 32.0);

      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      col = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
    }

    vec3 tint = mix(diffusion, foreground, length(pos));
    if (length(pos) <= 0.26) { tint = vec3(0.922,0.871,0.769); }
    vec3 tot = mix(background, tint, col);

    gl_FragColor = vec4(tot, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const background = '#433d5f';
  const foreground = '#67875c';
  const diffusion = '#f3cb4d';

  const rotationAxis = Random.quaternion();
  rotationAxis.pop();
  const offset = Random.range(-0.125, 0.125);

  return createShader({
    gl,
    frag,
    uniforms: {
      background: new THREE.Color(background).toArray(),
      foreground: new THREE.Color(foreground).toArray(),
      diffusion: new THREE.Color(diffusion).toArray(),
      rotationAxis,
      time: ({ time }) => time,
      offsetX: offset,
      offsetY: offset,
      boxSize: [0.25, 0.00625 / 4.0, 0.25],
    },
  });
};

canvasSketch(sketch, settings);
