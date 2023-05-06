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
  uniform float rotation1;
  uniform float rotation2;

  vec2 doModel(vec3 p);

  #pragma glslify: renderScene = require('../utils/ray-tracing-scene.glsl', doModel = doModel)
  #pragma glslify: dither = require(glsl-dither/8x8)

  mat2 rotate2D(in float r) {
    // return mat2(cos(r), sin(r), -sin(r), cos(r));
    return mat2(cos(r), -sin(r), sin(r), cos(r));
  }

  float sdOctahedron(vec3 p, float s) {
     p = abs(p);
  float m = p.x+p.y+p.z-s;
  vec3 q;
       if( 3.0*p.x < m ) q = p.xyz;
  else if( 3.0*p.y < m ) q = p.yzx;
  else if( 3.0*p.z < m ) q = p.zxy;
  else return m*0.57735027;

  float k = clamp(0.5*(q.z-q.y+s),0.0,s);
  return length(vec3(q.x,q.y-s+k,q.z-k));
    // p = abs(p);
    // return (p.x+p.y+p.z-s)*0.57735027;
  }

  vec2 doModel(vec3 p) {
    float id = 0.0;
    float d = 6.0;

    for(float w = 6.; w > 0.; w -= 1.26) { //1.26
      // spikes & spin
      // p.xy*=rotate2D(1.);

      p.xz*=rotate2D(w);
      p.xy*=rotate2D(playhead);

      d = min(d, sdOctahedron(p, 1.));
    }

    return vec2(d, id);
  }

  void main() {
    vec3 color = renderScene(resolution, playhead, height, dist);
    // color = length(color) < 0.001 ? vec3(.03, .01, .02) : .5 + .47*cos(6.2831* length(color) + vec3(0, 1, 2));
    // color = smoothstep(0.0, 1.0, color);
    // gl_FragColor = vec4(sqrt(max(color, 0.)), 1);

    vec4 color1 = vec4(sqrt(max(color, 0.)), 1);
    gl_FragColor = dither(gl_FragCoord.xy, color1);
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
  pane.addInput(PARAMS, 'rotation1', { min: 0, max: 4, step: 0.01 });
  pane.addInput(PARAMS, 'rotation2', { min: 0, max: 4, step: 0.01 });

  gl.getExtension('OES_standard_derivatives');

  return createShader({
    gl,
    frag,
    uniforms: {
      rotation1: () => PARAMS.rotation1,
      rotation2: () => PARAMS.rotation2,
      dist: () => PARAMS.distance,
      height: () => PARAMS.height,
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
