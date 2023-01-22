const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8 * 3,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #pragma glslify: random = require(glsl-random)

  #define PI 3.14159265359

  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  uniform vec3 leftC1;
  uniform vec3 leftC2;
  uniform vec3 leftC3;
  uniform vec3 leftC4;

  uniform vec3 rightC1;
  uniform vec3 rightC2;
  uniform vec3 rightC3;
  uniform vec3 rightC4;

  float smoothedge(float v) {
    return smoothstep(0.0, 1.0 / resolution.x, v);
  }

  float easeInOutCubic(float t) {
    if ((t *= 2.0) < 1.0) {
      return 0.5 * t * t * t;
    } else {
      return 0.5 * ((t -= 2.0) * t * t + 2.0);
    }
  }

  float linearstep(float edge0, float edge1, float x) {
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  }

  float circle(vec2 pos, float radius){
    return 1.- smoothedge(length(pos) - radius);
  }

  float triangle(vec2 p, float size) {
    vec2 q = abs(p);
    float d = max(q.x * 0.866025 + p.y * 0.5, -p.y * 0.5) - size * 0.5;
    return 1. - smoothedge(d);
  }

  vec3 comp(vec2 p, vec3 c1, vec3 c2, vec3 c3, vec3 c4) {
    vec3 color = background;

    color = mix(color, c1, circle(p, 0.75));
    color = mix(color, c2, circle(p, 0.5));
    color = mix(color, c3, circle(p, 0.25));
    color = mix(color, c4, triangle(p, 0.03125));
    return color;
  }

  void main () {
    vec2 p = (-1.0 + 2.0 * vUv);

    vec3 color;
    float t = mod(-2.5 + time, 3.);
    // float t = easeInOutCubic(linearstep(0.0, 0.5, fract(time)));

    if (p.x < 0.) {
      // p.x = p.x - (1. - 1. * t);
      color = comp(p, leftC1, leftC2,  leftC3,  leftC4);
    } else {
      // p.x = p.x + (1. - 1. * t);
      color = comp(p, rightC1, rightC2, rightC3, rightC4);
    }

    float v0 = 1.0 - step(easeInOutCubic(linearstep(0.0, 0.7, t)), vUv.x);
    float v1 = 1.0 - step(easeInOutCubic(linearstep(0.5, 1.0, t)), vUv.x);
    color = mix(color, foreground, v0 - v1);

    color = color + 0.125 * random(vUv);

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl, duration }) => {
  const { background, foreground, left, right } = colors();
  const state = new Array(duration).fill().map(colors);

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      background,
      foreground,
      leftC1: ({ time }) => state[Math.floor(time / 3)].left[0],
      leftC2: ({ time }) => state[Math.floor(time / 3)].left[1],
      leftC3: ({ time }) => state[Math.floor(time / 3)].left[2],
      leftC4: ({ time }) => state[Math.floor(time / 3)].left[3],
      rightC1: ({ time }) => state[Math.floor(time / 3)].right[0],
      rightC2: ({ time }) => state[Math.floor(time / 3)].right[1],
      rightC3: ({ time }) => state[Math.floor(time / 3)].right[2],
      rightC4: ({ time }) => state[Math.floor(time / 3)].right[3],
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get(); // spatial03i
  if (!palette.background) palette = tome.get();
  console.log(palette.name);

  const background = palette.background;

  const colors = palette.colors.filter((color) => color !== background);

  const left = [
    Random.pick(colors),
    Random.pick(colors),
    Random.pick(colors),
    Random.pick(colors),
  ];
  const right = [
    Random.pick(colors),
    Random.pick(colors),
    Random.pick(colors),
    Random.pick(colors),
  ];

  foreground = Random.pick(colors);

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
    left: left.map((c) => new THREE.Color(c).toArray()),
    right: right.map((c) => new THREE.Color(c).toArray()),
  };
}

canvasSketch(sketch, settings);
