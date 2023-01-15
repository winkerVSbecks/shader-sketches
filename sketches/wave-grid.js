const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec3 accent;

  #define PI 3.14159265358979323846
  #define PIXELATED true

  vec2 rotate2D(vec2 _st, float _angle){
    _st -= 0.5;
    _st =  mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle)) * _st;
    _st += 0.5;
    return _st;
  }

  float random (vec2 st) {
    return fract(
      sin(
        dot(st.xy, vec2(12.989,78.233) * time)
      ) * 43758.543
    );
  }

  vec2 tilePattern(vec2 p, vec2 index) {
    float f0 = 0.7;
    float f1 = 1.2;
    float p0 = -2.5;
    float p1 = 5.5;

    float x = PIXELATED ? floor(p.x) : p.x;
    float y = PIXELATED ? floor(p.y) : p.y;

    return vec2(
      cos((f0 * x + 2. * cos(f1 * x + p1) + p0) * time * PI),
      sin((f0 * y + 2. * sin(f1 * y + p1) + p0) * time * PI)
    );
  }

  float grid(vec2 st, float res){
    vec2 grid = fract(st*res);
    return 1.-(step(res,grid.x) * step(res,grid.y));
  }

  void main() {
    vec2 p = (-1.0 + 2.0 * vUv);
    vec3 color = background;

    float resolution = 4.;
    p *= resolution;

    // grid
    vec2 grid_st = p*100.;
    color = grid(grid_st, 0.01) == 1. ? vec3(0.) : background;

    vec2 iPos = floor(p);  // integer
    vec2 fPos = fract(p);  // fraction
    p = tilePattern(p, vec2(random(iPos), random(iPos)));

    // color = length(p) < 0.5 ? mix(background, foreground, length(p)) : mix(foreground, accent, length(p));
    color += foreground * length(p) + accent * (1. - length(p));
    // color = vec3(length(p));

    // color = mix(background, foreground, length(floor(fract(p) + 0.5)));
    // color = mix(background, foreground, step(p.x, p.y));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground, accent } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ playhead }) => playhead,
      background,
      foreground,
      accent,
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get();
  if (!palette.background) palette = tome.get();
  console.log(palette.name);

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) =>
      Color.contrastRatio(background, color) >= minContrast &&
      color !== background
  );

  const foreground = Random.pick(colors);
  const accent = Random.pick(colors);

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
    accent: new THREE.Color(accent).toArray(),
  };
}

canvasSketch(sketch, settings);
