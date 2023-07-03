const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const createMouse = require('../utils/mouse');
import { lerpFrames } from 'canvas-sketch-util/math';
import { Pane } from 'tweakpane';

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  // duration: 10,
};

const frag = glsl(/*glsl*/ `
  precision highp float;
  varying vec2 vUv;
  uniform float lensLength;
  uniform float time;

  vec2 doModel(vec3 p);

  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: raymarch = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: sdTorus = require('glsl-sdf-primitives/sdTorus')
  #pragma glslify: rotate = require('glsl-rotate/rotate')

  vec2 doModel(vec3 p) {
    // Spin the shape
    p.xy = rotate(p.xy, time);
    p.yz = rotate(p.yz, time);
    // Calculate SDF distance
    float d = sdTorus(p, vec2(0.5, 0.25));
    return vec2(d, 0.0);
  }

  void main() {
    vec3 color = vec3(0.0);
    // Bootstrap a raytracing scene
    vec3 rayOrigin = vec3(3.5, 0, 3.5);
    vec3 rayTarget = vec3(0, 0, 0);
    // map from 0 to 1 to -1. to 1.
    vec2 screenPos = vUv * 2.0 - 1.;
    vec3 rayDirection = camera(rayOrigin, rayTarget, screenPos, lensLength);

    vec2 collision = raymarch(rayOrigin, rayDirection);

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      color = vec3(0.678, 0.106, 0.176);
    }

    gl_FragColor = vec4(color, 1);
  }
`);

const sketch = ({ gl, canvas }) => {
  const PARAMS = {
    camera: { x: 3.5, y: 0, z: 3.5 },
    light: { x: 1, y: 1, z: 1 },
    spin: true,
    tint: { r: 0.05, g: 0.0, b: 0.97 },
    specular: false,
    mix: 0.7,
    animateTint: true,
  };

  const mouse = createMouse(canvas);

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      mouse: () => mouse.position,
      lensLength: () => 2,
      resolution: ({ width, height }) => [width, height],
    },
  });
};

canvasSketch(sketch, settings);
