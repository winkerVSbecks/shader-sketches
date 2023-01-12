const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  // Based on http://roy.red/posts/infinite-regression/
  precision highp float;

  uniform float time;
  varying vec2 vUv;

  //'Smaller and Smaller'
  float f(float x){
    return exp2(-floor(log2(x)));
  }

  float circle(vec2 z){
    return 1. - length(2.*z - 1.);
  }

  vec3 color(vec2 z) {
    vec2 a_z = abs(z);
    float scale = f(max(a_z.x,a_z.y));
    return vec3(circle(fract(z*scale)));
  }

  void main () {
    // Map the normalized pixel position to a -1.0 to +1.0 range
    // so that it's symmetric both vertically and horizontally
    vec2 p = (-1.0 + 2.0 * vUv);
    gl_FragColor = vec4(color(p), 1.0);
  }
`);

// Your sketch, which simply returns the shader
const sketch = ({ gl }) => {
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
    },
  });
};

canvasSketch(sketch, settings);
