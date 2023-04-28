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
  uniform vec4  s1;
  uniform vec4  s2;
  uniform float dist;
  uniform float height;

  vec2 doModel(vec3 p);

  #pragma glslify: renderScene = require('../utils/ray-tracing-scene.glsl', doModel = doModel)


  vec4 Setup(float t){
    t=mod(t,8.0);
    if(t<1.0)return vec4(6.75,3.0,4.0,17.0);
    if(t<2.0)return vec4(12.0,15.0,20.0,3.0);
    if(t<3.0)return vec4(5.0,2.0,6.0,6.0);
    if(t<4.0)return vec4(4.0,1.0,1.0,1.0);
    if(t<5.0)return vec4(8.0,1.0,1.0,8.0);
    if(t<6.0)return vec4(2.0,2.0,2.0,2.0);
    if(t<7.0)return vec4(5.0,1.0,1.0,1.0);
    return vec4(3.0,4.5,10.0,10.0);
  }

  float superFormula(float phi, float m, float n1, float n2, float n3, float a, float b){
    float t1 = abs((1.0 / a) * cos(m * phi / 4.0));
    t1 = pow(t1, n2);

    float t2 = abs((a / b) * sin(m * phi / 4.0));
    t2 = pow(t2, n3);

    float t3 = t1 + t2;

    float r = pow(t3, -1.0 / n1);

    return r;
  }

  #extension GL_OES_standard_derivatives : enable
  float aastep(float threshold, float value) {
    #ifdef GL_OES_standard_derivatives
      float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
      return smoothstep(threshold-afwidth, threshold+afwidth, value);
    #else
      return step(threshold, value);
    #endif
  }

  float superShape(vec3 p) {
    float d = length(p);

    float theta = atan(p.y / p.x);
    float phi = asin(p.z / d);

    float r1 = superFormula(theta, s1.x, s1.y, s1.z, s1.w, 1.0, 1.0);
    float r2 = superFormula(phi, s2.x, s2.y, s2.z, s2.w, 1.0, 1.0);

    vec3 q = r2 * vec3(r1 * cos(theta) * cos(phi), r1 * sin(theta) * cos(phi), sin(phi));
    d = d - length(q);

    return d;
  }

  vec2 doModel(vec3 p) {
    float id = 0.0;
    float d = superShape(p);
    return vec2(d, id);
  }

  void main() {
    vec3 color = renderScene(resolution, playhead, height, dist);
    color = length(color) < 0.001 ? vec3(.03, .01, .02) : .5 + .47*cos(6.2831* length(color) + vec3(0, 1, 2));
    color = smoothstep(0.0, 1.0, color);
    gl_FragColor = vec4(sqrt(max(color, 0.)), 1);
  }

`);

const shapes = [
  [
    [8.0, 60.0, 100.0, 30.0],
    [2.0, 10.0, 10.0, 10.0],
  ],
  [
    [2.0, 1, 1, 1],
    [4.0, 1, 1, 1],
  ],
  [
    [3.0, 1, 1, 1],
    [6.0, 1, 1, 1],
  ],
  [
    [2.0, 0.7, 0.3, 0.2],
    [3.0, 100, 100, 100],
  ],
  [
    [3.0, 0.5, 1.7, 1.7],
    [2.0, 10, 10, 10],
  ],
  [
    [5.7, 0.5, 1, 2.5],
    [10, 3, 0.2, 1],
  ],
  [
    [7, 0.1, 1.7, 1.7],
    [7, 0.2, 1.7, 1.7],
  ],
  [
    [8.0, 60.0, 100.0, 30.0],
    [2.0, 10.0, 10.0, 10.0],
  ],
];

const shapes1 = shapes.map((s) => s[0]);
const shapes2 = shapes.map((s) => s[1]);

const sketch = ({ gl }) => {
  const PARAMS = {
    s1: { x: 8.0, y: 60.0, z: 100.0, w: 30.0 },
    s2: { x: 2.0, y: 10.0, z: 10.0, w: 10.0 },
    distance: 4.0,
    height: 4.0,
  };

  const pane = new Pane();

  pane.addInput(PARAMS, 's1', {
    x: { min: -100, max: 100 },
    y: { min: -1000, max: 1000 },
    z: { min: -1000, max: 1000 },
    w: { min: -1000, max: 1000 },
  });
  pane.addInput(PARAMS, 's2', {
    x: { min: -100, max: 100 },
    y: { min: -1000, max: 1000 },
    z: { min: -1000, max: 1000 },
    w: { min: -1000, max: 1000 },
  });
  pane.addInput(PARAMS, 'distance', { min: 0.5, max: 10, step: 0.5 });
  pane.addInput(PARAMS, 'height', { min: 0, max: 40, step: 1 });

  gl.getExtension('OES_standard_derivatives');

  return createShader({
    gl,
    frag,
    uniforms: {
      // s1: ({ playhead }) => Object.values(PARAMS.s1),
      // s2: ({ playhead }) => Object.values(PARAMS.s2),
      s1: ({ playhead }) => {
        const t = Math.sin(playhead * Math.PI);
        return lerpFrames(shapes1, playhead);
      },
      s2: ({ playhead }) => {
        const t = Math.sin(playhead * Math.PI);
        return lerpFrames(shapes2, playhead);
      },
      dist: () => PARAMS.distance,
      height: () => PARAMS.height,
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
