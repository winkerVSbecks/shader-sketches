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
  uniform float layerCount;
  uniform float particleCount;
  varying vec2 vUv;

  #define PI 3.14159265359

  vec4 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return vec4(a + b*cos( 6.28318*(c*t+d) ), 1.);
  }

  vec4 wave(vec2 origin, float f, vec3 off, float index) {
    vec4 color = vec4(0.);

    for(float l = 0.; l < 200.; l++) {
      float res = 1. / particleCount;

      if (l > particleCount) break;

      // make a circle (length(p)-r) and move it along a wave
      float xStep = mix(-.5, .5, l / particleCount);
      // float yStep = sin(xStep * 4. * (off.x+0.5) * PI + 4. * PI * playhead - off.y * .125 * PI) * spread;
      float yStep = sin((xStep + index) * 4. * PI + 4. * PI * playhead - off.x * .125 * PI) * (spread - (off.y * spread));
      vec2 p = origin + vec2(xStep, yStep);
      // float r = (cos(l + f) * 2. * radius + radius) * off.z / 100.;
      float r = radius * off.z / 100.;
      // color
      // vec4 c = cos(l + length(origin)*4. + tint + vec4(0, index, 0, 0)) + 1.;
      // vec4 c = vec4(0.2, 0.2, 0.2, 1.) * index; // for black and white
      vec4 c = palette(index/layerCount,
        // vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.0), vec3(2.0, 1.0, 0.), vec3(0.50, 0.20, 0.25)
        vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5), vec3(1.0, 1.0, 1.0), vec3(0.00, 0.33, 0.67)
      ); // IQ colors
      // turn it into a ring
      float ring = (glow / 10000.) / abs(length(p) - r);

      color += ring * c;
    }

    return color;
  }

  void main() {
    vec4 color = vec4(0.);
    vec2 o = vUv - 0.5;
    float f = playhead * 2. * PI;

    for(float i = 0.; i < 200.; i++) {
      if (i > layerCount) break;
      color += wave(o, f, offset * i, i);
    }

    gl_FragColor = color;
  }

`);

const sketch = ({ gl }) => {
  const PARAMS = {
    glow: 4,
    radius: 1,
    count: 55,
    'layer count': 5,
    spread: 0.2,
    offset: { x: 1.5, y: 0.4, z: 0.1 },
    // tint: { x: 0, y: 5.5, z: 2, w: 0 },
    tint: { x: 0, y: 1, z: 2, w: 0 },
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'glow', {});
  pane.addInput(PARAMS, 'radius', {});
  pane.addInput(PARAMS, 'layer count', { step: 1 });
  pane.addInput(PARAMS, 'count', { step: 1 });
  pane.addInput(PARAMS, 'spread', { step: 0.1 });
  pane.addInput(PARAMS, 'offset', {
    x: { min: 0, max: 5, step: 0.1 },
    y: { min: 0, max: 5, step: 0.1 },
    z: { min: 0, max: 1, step: 0.1 },
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
      particleCount: () => PARAMS.count,
      layerCount: () => PARAMS['layer count'],
    },
  });
};

canvasSketch(sketch, settings);
