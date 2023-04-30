const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const { lerpFrames } = require('canvas-sketch-util/math');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  #define PI 3.14159265358979323846

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

  float easeInOutCubic(float t) {
    if ((t *= 2.0) < 1.0) {
        return 0.5 * t * t * t;
    } else {
        return 0.5 * ((t -= 2.0) * t * t + 2.0);
    }
  }

  float linearstep(float begin, float end, float t) {
    return clamp((t - begin) / (end - begin), 0.0, 1.0);
  }

  void main() {
    vec2 u = vUv - vec2(0, -.25);
    vec2 p = rotate2D(u, PI * .5);
    p/=dot(p, p);

    vec3 color = vec3(0.0);

    float resolution = 12.0;
    p *= resolution;
    p = fract(p);

    float v0 = 1.0 - step(easeInOutCubic(linearstep(0.0, 0.7, time)), p.x);
    float v1 = 1.0 - step(easeInOutCubic(linearstep(0.3, 1.0, time)), p.x);
    color = mix(foreground, background, v0 - v1);

    gl_FragColor = vec4(color,1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      // time: ({ playhead }) => lerpFrames([0, 1, 2, 3, 4], playhead),
      time: ({ playhead }) => lerpFrames([0, 1], playhead),
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
