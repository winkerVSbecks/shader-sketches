const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const generateSubtractiveColors = require('../utils/subtractive-color');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 c1;
  uniform vec3 c2;
  uniform vec3 c3;
  uniform vec3 c4;

  #define PI 3.14159265359

  vec2 rotate2D(vec2 _st, float _angle){
    _st -= 0.5;
    _st =  mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle)) * _st;
    _st += 0.5;
    return _st;
  }

  void main () {
    vec2 u = vUv - vec2(0, -.25);
    vec2 st = rotate2D(u, PI * 0.25);
    st/=dot(st, st);

    st *= 5.0;
    if (mod(st.x, 2.) > 1.) { st.y += .25; }
    st = fract(st);

    float dist = 1.;


    for(int i = 1; i < 10; i++) {
		  float t = 1. * float(i) / 8. - time/8.;
    	vec2 bl = step(vec2(0.02), st - vec2(t));
	    float pct = bl.x * bl.y;
	    dist -= st.x < t || st.y < t  ? 0. : 1.- pct;
    }

    dist = 1. - dist;
    // for gradient
    float step1 = 0.0;
    float step2 = 0.33;
    float step3 = 0.66;
    float step4 = 1.0;
    // float dist = length(color);// length(u);
    // vec3 c = mix(c1, c2, smoothstep(step1, step2, dist));
    // c = mix(c, c3, smoothstep(step2, step3, dist));
    // c = mix(c, c4, smoothstep(step3, step4, dist));
    vec3 c = vec3(dist) * 1. - .5*(st.x + st.y);


    // color = mix(color, background, lColor);

    gl_FragColor = vec4(c, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const colors = generateSubtractiveColors({ total: 5 });

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time,
      background: colors.pop(),
      c1: colors.pop(),
      c2: colors.pop(),
      c3: colors.pop(),
      c4: colors.pop(),
    },
  });
};

canvasSketch(sketch, settings);
