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

  void main() {
    vec2 u = vUv - vec2(0, -.25);
    vec2 p = rotate2D(u, PI * 0.25);
    p/=dot(p, p);

    vec3 color = vec3(0.0);

    float resolution = 24.0;
    p *= resolution;

    vec2 iPos = floor(p);  // integer
    vec2 fPos = fract(p);  // fraction

    // switch version
    // fPos.x +=  fract(time);
    // p = rotate2D(fPos,  PI *-0.5);
    // if (time < 1.) {
    //   color = mix(background, foreground, step(p.x, p.y));
    // } else {
    //   color = mix(background, foreground, step(p.y, p.x));
    // }


    if (time < 1.) {
      fPos.x += fract(time);
      p = rotate2D(fPos,  PI *-0.5);
      color = mix(background, foreground, step(p.x, p.y));
    } else if (time < 2.) {
      fPos.y += fract(time);
      p = rotate2D(fPos,  PI *0.5);
      color = mix(background, foreground, step(p.x-1., p.y));
    } else if (time < 3.) {
      fPos.x += fract(time);
      p = rotate2D(fPos,  PI *-0.5);
      color = mix(background, foreground, step(p.y, p.x));
    } else {
      fPos.y += fract(time);
      p = rotate2D(fPos,  PI *0.5);
      color = mix(foreground, background, step(p.x-1., p.y));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ playhead }) => lerpFrames([0, 1, 2, 3, 4], playhead),
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
