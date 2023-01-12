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
  // Author @patriciogv - 2015
  // https://thebookofshaders.com/09/
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

  vec2 tile(vec2 _st, float _zoom){
    _st *= _zoom;
    return fract(_st);
  }

  float box(vec2 _st, vec2 _size, float _smoothEdges){
    _size = vec2(0.5)-_size*0.5;
    vec2 aa = vec2(_smoothEdges*0.5);
    vec2 uv = smoothstep(_size,_size+aa,_st);
    uv *= smoothstep(_size,_size+aa,vec2(1.0)-_st);
    return uv.x*uv.y;
  }

  void main() {
    vec2 p = (-1.0 + 2.0 * vUv);
    vec3 color = vec3(0.0);

    // Divide the space in 4
    p = tile(p, 4.);

    // Use a matrix to rotate the space 45 degrees
    p = rotate2D(p,PI*0.25);
    color = mix(background, foreground, box(p, vec2(0.7), 0.01));

    gl_FragColor = vec4(color,1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time,
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
