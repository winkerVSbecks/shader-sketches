const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 4,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;
  uniform float time;
  varying vec2 vUv;

  #define PI 3.14159265359

  vec2 rotate2D(vec2 _st, float _angle){
    _st -= 0.5;
    _st =  mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle)) * _st;
    _st += 0.5;
    return _st;
  }

  vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5); // vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 0.5	); // vec3(2.0, 1.0, 0.0); // vec3(1.0, 0.7, 0.4); // vec3(1.0, 1.0, 0.5); // vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.80, 0.90, 0.30); // vec3(0.50, 0.20, 0.25); // vec3(0.00, 0.15, 0.20); // vec3(0.80, 0.90, 0.30); // vec3(0.00, 0.10, 0.20);
    return a + b*sin(6.28318*(c*t+d));
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

    // // black and white
    // vec3 c = vec3(dist) * 1. - .6*(st.x + st.y);
    // gl_FragColor = vec4(c, 1.0);

    // with tint
    vec3 tint = palette(length(st)); //length(u)
    vec3 c = vec3(dist) * 1. - .5*(st.x + st.y);
    gl_FragColor = vec4(c * tint, 1.0);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time,
    },
  });
};

canvasSketch(sketch, settings);
