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

  varying vec2 vpos;
  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;

  #pragma glslify: c2b = require('glsl-cartesian-to-barycentric')

  void main () {
    vec2 p0 = vec2(-0.5,+0.1);
    vec2 p1 = vec2(+0.6,+0.5);
    vec2 p2 = vec2(-0.2,-0.3);
    vec3 bc = c2b(vpos, p0, p1, p2);
    if (max(bc.x,max(bc.y,bc.z)) > 1.0) discard;
    if (min(bc.x,min(bc.y,bc.z)) < 0.0) discard;
    gl_FragColor = vec4(bc*0.5+0.5,1);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    vert: `
    precision highp float;
    attribute vec2 position;
    varying vec2 vpos;
    void main () {
      vpos = position;
      gl_Position = vec4(position,0,1);
    }
  `,
    attributes: {
      position: [-4, -4, -4, +4, +4, +0],
    },
    elements: [0, 1, 2],
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
