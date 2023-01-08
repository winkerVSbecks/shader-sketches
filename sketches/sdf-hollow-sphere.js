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

  // r = sphere's radius
  // h = cutting's plane's position
  // t = thickness
  float sdCutHollowSphere(vec3 p, float r, float h, float t) {
    vec2 q = vec2(length(p.xz), p.y);

    float w = sqrt(r * r - h * h);

    return ((h * q.x < w * q.y) ? length(q - vec2(w, h)) : abs(length(q) - r)) -
          t;
  }

  #define PI 3.14159265359

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

  float map(in vec3 pos) {
    // pos.xy = (mat2(3, 4, -4, 3) / 5.0) * pos.xy;
    // pos.xy = rotate2d( sin(time)*PI*.25 ) * pos.xy;
    pos.xyz = (rotation3d(vec3(-1.0, -1.0, -1.0), sin(time)*PI*1.5) * vec4(pos, 1.0)).xyz;
    float r = 0.25;
    float h = 0.2 + 0.2 * cos(time * 1.0);
    // float h = 0.2;
    float t = 0.01;
    return sdCutHollowSphere(pos, r, h, t);
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
    vec3 ro = vec3(1.0 * cos(an), 0.0, 1.0 * sin(an));
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
      col = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
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
