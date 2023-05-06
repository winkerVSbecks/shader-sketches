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
  uniform vec2  resolution;
  uniform float dist;
  uniform float height;

  vec2 doModel(vec3 p);

  #pragma glslify: renderScene = require('../utils/ray-tracing-scene.glsl', doModel = doModel)
  #pragma glslify: sdSphere = require('glsl-sdf-primitives/sdSphere')
  #pragma glslify: dither = require(glsl-dither/8x8)
  #pragma glslify: smin = require(glsl-smooth-min)


  vec2 doModel(vec3 p) {
    // Take two sphere volumes
    float a = sdSphere(p + .5 * sin(playhead * PI), 0.5);
    float b = sdSphere(p - .5 * sin(playhead * PI), 0.25);
    float d = smin(a, b, 0.8);
    return vec2(d, 0.0);
  }

  void main() {
    vec3 color = renderScene(resolution, playhead, height, dist);
    color = length(color) < 0.001 ? vec3(.03, .01, .02) : .5 + .47*cos(6.2831* length(color) + vec3(0, 1, 2));

    vec4 texture = vec4(sqrt(max(color, 0.)), 1);
    gl_FragColor = dither(gl_FragCoord.xy, texture);
  }

`);

const sketch = ({ gl }) => {
  const PARAMS = {
    distance: 5.0,
    height: 0.0,
    rotation1: 0.0,
    rotation2: 0.0,
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'distance', { min: 0.5, max: 10, step: 0.5 });
  pane.addInput(PARAMS, 'height', { min: 0, max: 40, step: 1 });

  gl.getExtension('OES_standard_derivatives');

  return createShader({
    gl,
    frag,
    uniforms: {
      dist: () => PARAMS.distance,
      height: () => PARAMS.height,
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
