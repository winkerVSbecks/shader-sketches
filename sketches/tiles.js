const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

// Setup our sketch
const settings = {
  context: 'webgl',
  animate: true,
};

const frag = glsl(/* glsl */ `
  // Author @patriciogv - 2015
  // https://thebookofshaders.com/09/
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  float circle(in vec2 _st, in float _radius){
    vec2 l = _st-vec2(0.5);
    return 1.- smoothstep(
        _radius-(_radius*0.01),
        _radius+(_radius*0.01),
        dot(l,l)*4.0
    );
  }

  void main() {
    vec2 p = (-1.0 + 2.0 * vUv);
    vec3 color = vec3(0.0);

      p *= 3.0;      // Scale up the space by 3
      p = fract(p); // Wrap around 1.0

      // Now we have 9 spaces that go from 0-1

      color = mix(background, foreground,  length(p));
      //color = vec3(circle(st,0.5));

    gl_FragColor = vec4(color,1.0);
  }
`);

// Your sketch, which simply returns the shader
const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  // Create the shader and return it. It will be rendered by regl.
  return createShader({
    // Pass along WebGL context
    gl,
    // Specify fragment and/or vertex shader strings
    frag,
    // Specify additional uniforms to pass down to the shaders
    uniforms: {
      // Expose props from canvas-sketch
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
