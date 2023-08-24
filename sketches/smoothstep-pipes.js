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
  duration: 8,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  const float count = 12.0;
  float step = 1.0 / count;
  float span = step * 0.5; //.05;
  float thickness = 0.01;

  void main () {
    vec2 uv = -0.5 + vUv;
    vec3 color = background;

    for (float i = -count; i < count; i += 1.0) {
      float dir = mod(i, 2.0) == 0.0 ? 1.0 : -1.0;
      float shift = mix(sin(time*PI), 2., .25);
      float fork = smoothstep(0. - dir * shift, dir * shift, uv.x);
      float off = -i * step;
      float m = smoothstep(thickness, 0.0, abs(abs(uv.y - off - step*2.*time) - span * fork));
      if (m > 0.2) {
        color = m * foreground;
      }
    }

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  const res = 0.1;
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      // time: ({ playhead }) => Math.sin(playhead * Math.PI),
      time: ({ playhead }) => playhead,
      res,
      count: 1 / res,
      background,
      foreground,
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

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
  };
}

canvasSketch(sketch, settings);
