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
  #pragma glslify: beckmann = require('glsl-specular-beckmann')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: combine = require('glsl-combine-smooth')

  vec2 doModel(vec3 p) {
    float a = sdTriPrism(p + .5 * sin(playhead * PI), vec2(0.5, 0.25));
    float b = sdTriPrism(p - .5 * sin(playhead * PI), vec2(0.5, 0.25));
    float c = sdTriPrism(p + vec3(.75, -.75, -0.25) * sin(playhead * PI), vec2(0.5, 0.25));
    float d = combine(a, b, 0.8);
    d = combine(d, c, 0.8);
    d = combine(d, sdTriPrism(p, vec2(0.5, 0.25)), 0.8);
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
      vec3 lightDirection = normalize(lightPos - pos);
      // vec3 n = normalize(nor);
      // float power = beckmann(lightDirection, eyeDirection, n, roughness);
      float power = blinnPhongSpec(lightDirection, eyeDirection, nor, roughness);

      color = vec3(power, power, power) * vec3(0.80,0.33,0.42);
    }

    gl_FragColor = vec4(color, 1);
  }

`);

const sketch = ({ gl }) => {
  const PARAMS = {
    rotate: true,
    camera: { x: 3.5, y: 3, z: 3.5 },
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
