const canvasSketch = require('canvas-sketch');
const { lerpFrames } = require('canvas-sketch-util/math');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 10,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  varying vec2 vUv;
  uniform float time;
  uniform float other;

  float tau = atan(1.0) * 8.0;

  vec3 hue(float x) {
    return other + clamp(2.0 * cos(vec3(tau * x) + (tau * vec3(0,2,1) / 3.0)), -1.0, 1.0) * 0.5 + 0.5;
  }

  void main() {
    vec3 color = hue(vUv.x * vUv.y * time);
    color = .5 + .47*cos(6.2831* length(color) + vec3(0, 1, 2));
    gl_FragColor = vec4(sqrt(max(color, 0.)), 1);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ playhead, duration }) =>
        lerpFrames([0, duration * 0.5, 0], playhead),
      other: ({ playhead }) => lerpFrames([0, 0, 1], playhead),
    },
  });
};

canvasSketch(sketch, settings);
