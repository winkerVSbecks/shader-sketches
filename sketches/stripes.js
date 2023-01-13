/**
 * Somewhat based on https://www.shadertoy.com/view/4s2SRt
 */
const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 6,
  fps: 50,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;
  uniform float tiling;
	uniform float direction;
	uniform float warpScale;
	uniform float warpTiling;

  varying vec2 vUv;

  #define color1 vec3(0.169,0.267,0.557)
  #define color2 vec3(0.992,0.071,0.235)
  #define PI 3.141592653589793

  void main() {
    vec2 pos;
    // Blend the direction between x and y
	  pos.x = mix(vUv.x, vUv.y, direction);
	  pos.y = mix(vUv.y, 1.0 - vUv.x, direction);

	  pos.x += sin(pos.y * warpTiling * PI * 2.0) * warpScale;
	  pos.x *= tiling;

	  float value = floor(fract(pos.x) + 0.5);
    vec3 color = mix(color1, color2, value);

    gl_FragColor = vec4(color, 1.0);
  }
`);

// Your sketch, which simply returns the shader
const sketch = ({ gl }) => {
  // gl.getExtension('OES_standard_derivatives');

  // Create the shader and return it
  return createShader({
    clearColor: 'rgb(0, 0, 0)',
    // Pass along WebGL context
    gl,
    // Specify fragment and/or vertex shader strings
    frag,
    // Specify additional uniforms to pass down to the shaders
    uniforms: {
      tiling: 2, //tiling: 10, // 1-500
      direction: 0.5, //direction: 0.5, // 0-1
      warpScale: 0, //warpScale: 0.1, // 0-1
      warpTiling: 0, //warpTiling: 2, // 1-10
    },
  });
};

canvasSketch(sketch, settings);
