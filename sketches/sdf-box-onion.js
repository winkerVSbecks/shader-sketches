const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
};

// Your glsl code
const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;

  #define PI 3.14159265359

  float sdRoundBox( vec3 p, vec3 b, float r ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
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

  float onion( in float d, in float h ) {
    return abs(d)-h;
  }

  float map(in vec3 pos) {
    // pos.xyz = (rotation3d(vec3(-1.0, -1.0, -1.0), sin(time)*PI*2.) * vec4(pos, 1.0)).xyz;
    float t = time * 1.0;
    float r = 0.02;
    vec3 b = vec3(0.25 + .125 * cos(t), 0.25 + .125 * cos(t), 0.25 + .125 * sin(t));
    // return sdRoundBox(pos, b, r);
    // return opOnion(min(0.5, sdRoundBox(pos, b, r)), 0.01);
    float d = sdRoundBox(pos, b, r);

    d  = onion(onion(d, 0.05), 0.02);

    d = max(d, pos.y);
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
    float an = sin(0.2 * time);
    // vec3 ro = vec3(1.0 * cos(an), 1.0 * sin(an), 1.0 * sin(an));
    vec3 ro = vec3(1.);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    // camera matrix
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));

    vec3 tot = vec3(0.0);

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
    if (t < tmax) {
      vec3 pos = ro + t * rd;
      vec3 nor = calcNormal(pos);
      vec3 light = vec3(.57703);
      float dif = clamp(dot(nor, light), 0.0, 1.0);
      if (dif > 0.001)
        dif *= calcSoftshadow(pos + nor * 0.001, light, 0.001, 1.0, 32.0);
      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      // col = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
      col = vec3(0.996,0.4,0.4) * amb + vec3(0.996,0.4,0.4) * dif;
    }

    // gamma
    col = sqrt(col);
    tot += col;

    gl_FragColor = vec4(tot, 1.0);
  }
`);

// Your sketch, which simply returns the shader
const sketch = ({ gl }) => {
  // Create the shader and return it. It will be rendered by regl.
  return createShader({
    // Pass along WebGL context
    gl,
    // Specify fragment and/or vertex shader strings
    frag,
    // Specify additional uniforms to pass down to the shaders
    uniforms: {
      // Expose props from canvas-sketch
      time: ({ time }) => time,
    },
  });
};

canvasSketch(sketch, settings);
