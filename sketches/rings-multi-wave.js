const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
import { Pane } from 'tweakpane';

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8,
};

/**
 * Based on: https://www.shadertoy.com/view/ms3XWl
 */
const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform vec2 resolution;
  uniform vec4 tint;
  uniform vec3 offset;
  uniform float glow;
  uniform float spread;
  uniform float radius;
  uniform float count;
  varying vec2 vUv;

  #define PI 3.14159265359

  vec4 wave(vec2 origin, float f, vec3 off, float index) {
    vec4 color = vec4(0.);

    for(float l = 0.; l < 200.; l++) {
      float res = 1. / count;

      if (l > count) break;

      // make a circle (length(p)-r) and move it along a wave
      float xStep = mix(-.5, .5, l / count) - off.x;
      float yStep = sin(l + f) * (spread - off.y);
      vec2 p = origin + vec2(xStep, yStep);
      float r = (cos(l + f) * 2. * radius + radius) * off.z / 100.;
      // color
      vec4 c = cos(l + length(origin)*4. + tint + vec4(0, index, 0, 0)) + 1.;
      // turn it into a ring
      float ring = (glow / 10000.) / abs(length(p) - r);

      color += ring * c;
    }

    return color;
  }

  void main() {
    vec4 color = vec4(0.);
    vec2 o = vUv - 0.5;
    // float f = time * .4 - 2.;
    float f = playhead * 2. * PI;

    for(float i = 0.; i < 4.; i++) {
      color += wave(o, f, offset * i, i);
    }

    gl_FragColor = color;
  }

`);

const sketch = ({ gl }) => {
  const PARAMS = {
    glow: 5,
    radius: 1,
    count: 55,
    spread: 0.25,
    offset: { x: 0, y: 0, z: 0 },
    tint: { x: 0, y: 1, z: 2, w: 0 },
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'glow', {});
  pane.addInput(PARAMS, 'radius', {});
  pane.addInput(PARAMS, 'count', {});
  pane.addInput(PARAMS, 'spread');
  pane.addInput(PARAMS, 'offset', {
    x: { min: 0, max: 1, step: 0.05 },
    y: { min: 0, max: 1, step: 0.05 },
    z: { min: 0, max: 1, step: 0.05 },
  });
  pane.addInput(PARAMS, 'tint', {});

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      tint: () => Object.values(PARAMS.tint),
      offset: () => Object.values(PARAMS.offset),
      spread: () => PARAMS.spread,
      glow: () => PARAMS.glow,
      radius: () => PARAMS.radius,
      count: () => PARAMS.count,
    },
  });
};

canvasSketch(sketch, settings);
