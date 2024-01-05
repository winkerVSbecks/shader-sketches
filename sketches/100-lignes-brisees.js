const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const generateSubtractiveColors = require('../utils/subtractive-color');

const paletteCount = 8;
const cycleDuration = 3;

const settings = {
  dimensions: [1080, 1080 * 2],
  context: 'webgl',
  animate: true,
  duration: paletteCount * cycleDuration,
};

/**
 * 100 lignes brisées by Vera Molnar
 * https://www.bernardchauveau.com/en/original-editions/684-vera-molnar-100-lignes-brisees-.html
 */
const frag = glsl(/* glsl */ `
  precision highp float;

  #pragma glslify: random = require(glsl-random)

  #define PI 3.14159265359

  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 curtain;
  uniform vec3 foreground;


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

  mat2 rotate2d(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  vec2 tile(vec2 p, float zoom){
    p *= zoom;
    return fract(p);
  }

  float linearstep(float edge0, float edge1, float x) {
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  }

  float box(vec2 p, vec2 pos, vec2 size) {
    vec2 r = abs(p + pos) - size;
    return step( max(r.x,r.y),0.0);
  }

  vec3 comp(vec2 p, vec3 fg, vec3 bg, vec2 id) {
    p = (-1.0 + 2.0 * p);

    vec3 color = bg;
    float t = .1 + .2 * id.y; // thickness
    float w = .2 + (.8 - t) * id.y; // width of the U
    float s = .6 + (.4) * id.y; // height of the U
    float o = 1. - s + t; // offset within the box

    if (mod(id.x, 4.) == 3.) {
      color = mix(color, fg, box(p, vec2(-o, 0.), vec2(s+t, w+t)));
      color = mix(color, bg, box(p, vec2(-o, 0.), vec2(s, w)));
    } else if (mod(id.x, 4.) == 0.) {
      color = mix(color, fg, box(p, vec2(0., o), vec2(w+t, s+t)));
      color = mix(color, bg, box(p, vec2(0., o), vec2(w, s)));
    } else if (mod(id.x, 4.) == 1.) {
      color = mix(color, fg, box(p, vec2(o, 0), vec2(s+t, w+t)));
      color = mix(color, bg, box(p, vec2(o, 0), vec2(s, w)));
    } else if (mod(id.x, 4.) == 2.) {
      color = mix(color, fg, box(p, vec2(0., -o), vec2(w+t, s+t)));
      color = mix(color, bg, box(p, vec2(0., -o), vec2(w, s)));
    }

    return color;
  }

  void main () {
    vec2 p = (-1.0 + 2.0 * vUv);
    p *= vec2(5., 10.);
    vec2 id = floor(mod(p, vec2(4., 10.)));
    id.x += id.y;
    id.y /= 10.;
    id.y = clamp(id.y, 0., 1.);
    vec2 st = fract(p);

    vec3 color;
    float t = mod(-2.5 + time, 3.);

    if (vUv.y > 0.5) {
      color = max(color, comp(st, foreground, background, vec2(id.x, 1. - id.y)));
    } else {
      color = max(color, comp(st, background, foreground, vec2(id.x, id.y)));
    }

    float v0 = 1.0 - step(easeInOutCubic(linearstep(0.0, 0.7, t)), vUv.y);
    float v1 = 1.0 - step(easeInOutCubic(linearstep(0.5, 1.0, t)), vUv.y);
    color = mix(color, curtain, v0 - v1);

    color = color + 0.125 * random(vUv);

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl, duration }) => {
  const { background, curtain, foregrounds } = colors();
  const state = new Array(paletteCount).fill().map(colors);

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      background,
      curtain,
      foreground: ({ time }) => foregrounds[Math.floor(time / cycleDuration)],
    },
  });
};

function colors(minContrast = 1) {
  const colors = generateSubtractiveColors({ total: 10 });
  const background = colors.pop();
  const curtain = colors.pop();

  // let palette = tome.get(); // spatial03i
  // if (!palette.background) palette = tome.get();

  // const background = palette.background;

  // const colors = palette.colors.filter((color) => color !== background);

  // const options = [
  //   Random.pick(colors),
  //   Random.pick(colors),
  //   Random.pick(colors),
  //   Random.pick(colors),
  // ];

  // const curtain = Random.pick(colors);

  return {
    background, //: new THREE.Color(background).toArray(),
    curtain, //: new THREE.Color(curtain).toArray(),
    foregrounds: colors, //: colors.map((c) => new THREE.Color(c).toArray()),
  };
}

canvasSketch(sketch, settings);
