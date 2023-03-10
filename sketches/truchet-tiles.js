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

   vec2 tilePattern(vec2 p, float index){

    if(index <= 0.25) {
      //  Rotate cell 1 by 90 degrees
      p = rotate2D(p, PI*0.5);
    } else if(index <= 0.5) {
      //  Rotate cell 2 by -90 degrees
      p = rotate2D(p, PI*-0.5);
    } else if(index <= 0.75) {
      //  Rotate cell 3 by 180 degrees
      p = rotate2D(p, PI);
    }

    return p;
  }

  void main() {
    vec2 p = (-1.0 + 2.0 * vUv);
    vec3 color = vec3(0.0);

    float resolution = 4.;
    p *= resolution;

    vec2 iPos = floor(p);  // integer
    vec2 fPos = fract(p);  // fraction
    p = tilePattern(fPos, random(iPos));

    // step(st.x,st.y) just makes a b&w triangles
    // but you can use whatever design you want.
    color = mix(background, foreground, step(p.x, p.y));

    gl_FragColor = vec4(color,1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => Math.floor(time * 6) / 6,
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
