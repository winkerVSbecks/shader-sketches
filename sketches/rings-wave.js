const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
import { Pane } from 'tweakpane';

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  // duration: 10,
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
  uniform float glow;
  uniform vec2 spread;
  uniform float radius;
  varying vec2 vUv;

  #define PI 3.14159265359

  void main() {
    vec2 F = gl_FragCoord.xy;
    vec4 O = vec4(0.);

    vec2 g = resolution.xy;
    vec2 o = (F+F-g) / g.y / .7;

    float f = time * .4 - 2.;

    for(float l = 0.; l < 55.; l++) {
      // make a circle (length(p)-r) and move it along a wave
      vec2 p = o + vec2((l / 55. - 0.5) * spread.x, sin(l + f) * spread.y);
      float r = (cos(l + f) * 2. * radius + radius);
      // color
      vec4 c = cos(l + length(o)*4. + tint) + 1.;
      // turn it into a ring
      float ring = glow / abs(length(p) - r);

      O += ring * c;
    }

    gl_FragColor = O;
  }

`);

const sketch = ({ gl }) => {
  const PARAMS = {
    glow: 0.005,
    radius: 0.02,
    spread: { x: 5, y: 0.25 },
    tint: { x: 0, y: 1, z: 2, w: 0 },
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'glow', {});
  pane.addInput(PARAMS, 'radius', {});
  pane.addInput(PARAMS, 'spread', {
    x: { min: 0, max: 10, step: 0.1 },
    y: { min: 0, max: 10, step: 0.1 },
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
      spread: () => Object.values(PARAMS.spread),
      glow: () => PARAMS.glow,
      radius: () => PARAMS.radius,
    },
  });
};

canvasSketch(sketch, settings);
