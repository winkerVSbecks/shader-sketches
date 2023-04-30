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

  #define PI 3.14159265359

  float tau = atan(1.0) * 8.0;

  vec3 hue(float x) {
    return other + clamp(2.0 * cos(vec3(tau * x) + (tau * vec3(0,2,1) / 3.0)), -1.0, 1.0) * 0.5 + 0.5;
  }

  vec2 rotate2D(vec2 _st, float _angle){
    _st -= 0.5;
    _st =  mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle)) * _st;
    _st += 0.5;
    return _st;
  }

  void main() {
    vec2 u = vUv - vec2(0, -.25);
    vec2 st = rotate2D(u, PI * 0.25);
    st/=dot(st, st);

    st *= 5.0;
    if (mod(st.x, 2.) > 1.) { st.y += .25; }
    st = fract(st);

    vec3 color = hue(st.x * st.y * time);
    color = .5 + .47*cos(6.2831* length(color) + vec3(0, 1, 2));
    // gl_FragColor = vec4(sqrt(max(color, 0.)), 1);
    gl_FragColor = vec4(color, 1);
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
