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

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-turntable-camera')
  #pragma glslify: udTriangle = require('glsl-sdf-primitives/udTriangle')
  #pragma glslify: c2b = require('glsl-cartesian-to-barycentric')

  vec3 p0 = vec3(-0.5,+0.1, 0.);
  vec3 p1 = vec3(+0.6,+0.5, 0.);
  vec3 p2 = vec3(-0.2,-0.3, 0.);

  vec3 renderScene(vec2 resolution, float playhead, float height, float dist) {
    vec3 color = vec3(0.0);
    vec3 ro, rd;

    float rotation = 2. * PI * playhead;
    camera(rotation, height, dist, resolution.xy, ro, rd);

    vec2 t = raytrace(ro, rd, 20.0, 0.005);
    if (t.x > -0.5) {
      vec3 pos = ro + rd * t.x;
      // vec3 nor = normal(pos);
      // color = nor * 0.5 + 0.5;

      vec3 bc = c2b(pos.xy, p0.xy, p1.xy, p2.xy);
      if (max(bc.x,max(bc.y,bc.z)) > 1.0) discard;
      if (min(bc.x,min(bc.y,bc.z)) < 0.0) discard;
      color = bc*0.5+0.5;
      // color = .5 + .47*cos(6.2831* length(bc) + vec3(0, 1, 2));
    }

    return color;
  }

  vec2 doModel(vec3 p) {
    float d = udTriangle(p, p0, p1, p2);
    return vec2(d, 0.0);
  }

  void main() {
    vec3 color = renderScene(resolution, playhead, height, dist);
    gl_FragColor = vec4(sqrt(max(color, 0.)), 1);
  }

`);

const sketch = ({ gl }) => {
  const PARAMS = {
    distance: 1.0,
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
