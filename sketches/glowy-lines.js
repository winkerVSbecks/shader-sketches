const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');
const eases = require('eases');
const { lerpFrames } = require('canvas-sketch-util/math');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 6,
};

const frag = glsl(/*glsl*/ `
  precision mediump float;

  uniform float time;
  uniform float playhead;
  uniform vec2 resolution;
  varying vec2 vUv;

  #define PI 3.14159

  vec3 irri(float hue) {
    return .5+ .5 *cos(( 9.*hue)+ vec3(0.,23.,21.));
  }

  float hash12(vec2 p) {
    vec3 p3  = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
  }

  vec2 line(in vec2 p, in vec2 a, in vec2 b) {
    vec2 ba = b - a;
    vec2 pa = p - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    return vec2(length(pa - h * ba),h);
  }

  vec2 sdCircle( vec2 p, float r ) {
    float d = length(p) - r;

    float t= smoothstep(0.0, 0.1, abs(d));
    return vec2(t, 0.);
  }

  void main() {
    vec3 sum = vec3(0.0);
    float valence = 0.0;
    float blend = .4;

    // // lines
    // for (float i = -2.; i <= 2.; i++) {
    //   float id = 0.5 + (i/5.) * .5;
    //   float off = (id - 0.5) * 0.25 * sin(time);

    //   vec2 start = vec2(0.25, id + off);
    //   vec2 end = vec2(0.75, id + off);
    //   vec2 d = line(vUv, start, end);

    //   float w =  1. / pow(d.x, blend);
    //   vec3 colA = irri(id + sin(time) * 0.1);
    //   // colA = .5 + .47*cos(6.2831*colA + vec3(0, 1, 2));
    //   sum += w * colA;
    //   valence += w;
    // }

    // // lines
    // for (float i = -2.; i <= 2.; i++) {
    //   float t = playhead; // sin(playhead * PI + .01 * i);

    //   float id = 0.5 + (i/5.) * .5;
    //   float off = (id - 0.5) * 0.5 * t;
    //   float offX = 0.; // abs(id - 0.5) * .5 * t;

    //   // float off = 0.125 * id * sin(playhead*3.);
    //   // vec2 start = vec2(id + off, 0.25);
    //   // vec2 end = vec2(id + off, 0.75);
    //   vec2 start = vec2(0.25 - offX, id + off);
    //   vec2 end = vec2(0.75 + offX, id + off);
    //   vec2 d = line(vUv, start, end);

    //   float w =  1. / pow(d.x, blend);
    //   vec3 colA = irri(id + t * 0.1);
    //   // colA = .5 + .47*cos(6.2831*colA + vec3(0, 1, 2));
    //   sum += w * colA;
    //   valence += w;
    // }

    // // circles
    // for (float i = 0.; i <= 4.; i++) {
    //   float t = sin(playhead * PI + .01 * i);
    //   float id = 0.125 + (i/5.) * .125;

    //   float off = (i/5.) * .125 * t;

    //   float r = id + off;
    //   vec2 d = sdCircle(vUv - vec2(0.5), r);

    //   float w =  1. / pow(d.x, blend);
    //   vec3 colA = irri(0.25 + (i/5.) * .5 + t * 0.1);
    //   // colA = .5 + .47*cos(6.2831*colA + vec3(0, 1, 2));
    //   sum += w * colA;
    //   valence += w;
    // }

    // static circles
    for (float i = 0.; i <= 4.; i++) {
      float t = sin(playhead * PI - .5 * i);
      float r = 0.125 + (i/5.) * .25;
      vec2 d = sdCircle(vUv - vec2(0.5), r);

      float w =  1. / pow(d.x, blend);
      vec3 colA = irri(0.25 + (i/5.) * .5 + t * 0.1);
      // colA = .5 + .47*cos(6.2831*colA + vec3(0, 1, 2));
      sum += w * colA;
      valence += w;
    }

    sum /= valence;
    sum = pow(sum, vec3(10.0/2.2));

    gl_FragColor = vec4(sum, 1.0);
    // gl_FragColor = vec4(sqrt(max(sum, 0.)), 1);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      // playhead: ({ playhead }) => eases.sineOut(Math.sin(playhead * Math.PI)),
      // playhead: ({ playhead }) => playhead * Math.PI,
      // playhead: ({ playhead }) => playhead,
      // playhead: ({ playhead }) => eases.circInOut(Math.sin(playhead * Math.PI)),
      playhead: ({ playhead }) => lerpFrames([0, 1, 0], playhead),
      // eases.quintInOut(Math.sin(playhead * Math.PI)),
    },
  });
};

canvasSketch(sketch, settings);
