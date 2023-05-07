const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const { lerpFrames } = require('canvas-sketch-util/math');
const glsl = require('glslify');
import { Pane } from 'tweakpane';

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 10,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform vec2 resolution;
  uniform vec3 cameraPos;
  uniform vec3 lightPos;
  uniform float lensLength;
  uniform float roughness;
  uniform bool rotate;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square   = require('glsl-square-frame')
  #pragma glslify: sdTriPrism = require('glsl-sdf-primitives/sdTriPrism')
  #pragma glslify: sdSphere = require('glsl-sdf-primitives/sdSphere')
  #pragma glslify: beckmann = require('glsl-specular-beckmann')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: combine = require('glsl-combine-smooth')

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

  float sdRoundBox( vec3 p, vec3 b, float r ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  // https://iquilezles.org/articles/rmshadows
  float calcSoftshadow(in vec3 ro, in vec3 rd, float tmin, float tmax, const float k) {
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 64; i++) {
      float h = doModel(ro + rd * t).x;
      res = min(res, k * h / t);
      t += clamp(h, 0.01, 0.10);
      if (res < 0.002 || t > tmax)
        break;
    }
    return clamp(res, 0.0, 1.0);
  }

  vec2 doModel(vec3 p) {
    float d = 1e10;
    float r = 0.0125;
    float offsetX = .0625;
    float offsetY = .0625;

    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec3 q = p - vec3(.75 * float(x), .75 * float(y), .0 * float(y));

        float amount = (time + float(x) * offsetX + float(y) * offsetY) * PI * 2.;
        float rotation = sin(amount) * PI * 0.25;
        float bend = cos(amount) * .5;

        q.xyz = (rotation3d(vec3(1,0,1), rotation) * vec4(q, 1.0)).xyz;
        q = opBend(bend, q);
        // d = combine(d, sdRoundBox(q, vec3(0.25, 0.00625 / 4.0, 0.25), r), 0.6);
        d = min(d, sdRoundBox(q, vec3(0.25, 0.00625 / 4., 0.25), r));
      }
    }

    // d = combine(d, sdTriPrism(p, vec2(0.5, 0.25)), 0.8);
    return vec2(d, 0.0);
  }

  void main() {
    vec3 color = vec3(0.0);
    // Bootstrap a raytracing scene
    float cameraAngle  = rotate ? 2. * PI * playhead : 0.0;
    vec3  rayOrigin    = cameraPos * vec3(sin(cameraAngle), 1.0, cos(cameraAngle));
    vec3  rayTarget    = vec3(0, 0, 0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, lensLength);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      // Determine the point of collision
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);
      color = nor * 0.5 + 0.5;

      vec3 eyeDirection = normalize(rayOrigin - pos);
      vec3 lightDirection = normalize(lightPos + vec3(0, sin(PI * playhead), 0) - pos);
      float power = blinnPhongSpec(lightDirection, eyeDirection, nor, roughness);
      color = vec3(power, power, power) * vec3(0.80,0.33,0.42);

      float dif = clamp(dot(nor, lightDirection), 0.0, 1.0);
      if (dif > 0.001)
        dif *= calcSoftshadow(pos + nor * 0.001, lightDirection, 0.001, 1.0, 32.0);

      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      color = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
    }

    gl_FragColor = vec4(color, 1);
  }

`);

const sketch = ({ gl }) => {
  const PARAMS = {
    rotate: false,
    camera: { x: 3.5, y: 0, z: 3.5 },
    light: { x: 1, y: 1, z: 1 },
    lensLength: 2,
    roughness: 0.8,
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'rotate', {});
  pane.addInput(PARAMS, 'camera', {});
  pane.addInput(PARAMS, 'light', {});
  pane.addInput(PARAMS, 'lensLength', {});
  pane.addInput(PARAMS, 'roughness', {});

  return createShader({
    gl,
    frag,
    uniforms: {
      rotate: () => PARAMS.rotate,
      cameraPos: () => Object.values(PARAMS.camera),
      lightPos: () => Object.values(PARAMS.light),
      lensLength: () => PARAMS.lensLength,
      roughness: () => PARAMS.roughness,
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
