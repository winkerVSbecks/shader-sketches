const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
};

/**
 * Port of: https://www.shadertoy.com/view/ms3XWl
 */
const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform vec2 resolution;
  varying vec2 vUv;

  #define PI 3.14159265359

  void main() {
    vec2 F = gl_FragCoord.xy;
    vec4 O = vec4(0.);

    vec2 g = resolution.xy;
    vec2 o = (F+F-g)/g.y/.7;

    float f = time * .4-2.;

    for(float l = 0.; l < 55.; l++) {
      float a = length(o + vec2(cos(l*(cos(f*.5)*.5+.6)+f), sin(l+f)));
      float b = (sin(l+f*4.)*.04+.02);
      vec4 c = (cos(l + length(o)*4. + vec4(0,1,2,0)) + 1.);
      O += .005 / abs(a - b) * c;
    }

    gl_FragColor = O;
  }

`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
