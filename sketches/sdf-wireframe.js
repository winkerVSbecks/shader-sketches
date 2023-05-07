const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');
import { Pane } from 'tweakpane';

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 10,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform vec2 resolution;
  uniform vec3 cameraPos;
  uniform float lensLength;
  uniform bool rotateCamera;
  uniform float lineWidth;
  uniform vec3 tint;
  uniform vec3 rotationAxis;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square   = require('glsl-square-frame')
  #pragma glslify: sdTorus = require('glsl-sdf-primitives/sdTorus')
  #pragma glslify: combine = require('glsl-combine-smooth')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: rotate3d = require('glsl-rotate/rotate')

  vec2 doModel(vec3 p) {
    float d = sdTorus(p, vec2(0.5, .25));
    return vec2(d, 0.0);
  }

  vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
  }

  vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
  }

  const float GAMMA = 2.2;

  vec3 gamma(vec3 color, float g) {
    return pow(color, vec3(g));
  }

  vec3 linearToScreen(vec3 linearRGB) {
    return gamma(linearRGB, 1.0 / GAMMA);
  }

  vec3 sky(vec3 v) {
    vec3 grad_a = vec3(0.9, 0.85, 0.7);
    vec3 grad_b = vec3(0.5, 0.0, 1.0) * 0.5;
    float grad_t = v.y * 0.5 + 0.5;
    return mix(grad_b, grad_a, grad_t);
  }

  void main() {
    vec3 color = vec3(0.0);
    // Bootstrap a raytracing scene
    float cameraAngle  = rotateCamera ? 2. * PI * playhead : 0.0;
    vec3  rayOrigin    = rotate3d(cameraPos, rotationAxis, cameraAngle);
    vec3  rayTarget    = vec3(0, 0, 0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, lensLength);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      // Determine the point of collision
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);

      float wave = 8.0 * PI;
      color = max(color, smoothstep(lineWidth, 0.0, abs(sin(wave * pos.x))) * tint);
      // color = max(color, smoothstep(lineWidth, 0.0, abs(sin(wave * nor.y))) * tint);
      color = max(color, smoothstep(lineWidth, 0.0, abs(sin(wave * length(nor.y)))) * tint);
      color = max(color, smoothstep(lineWidth, 0.0, abs(sin(wave * pos.z))) * tint);
    }

    gl_FragColor = vec4(color, 1);
  }
`);

const sketch = ({ gl }) => {
  const PARAMS = {
    camera: { x: 3.5, y: 3, z: 3.5 },
    lensLength: 4,
    'rotate camera': true,
    tint: { r: 1, g: 1, b: 1 },
    lineWidth: 0.1,
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'camera', {});
  pane.addInput(PARAMS, 'lensLength', { min: 0, max: 5, step: 0.1 });
  pane.addInput(PARAMS, 'lineWidth', { min: 0, max: 1, step: 0.01 });
  pane.addInput(PARAMS, 'tint', {
    color: { type: 'float' },
  });
  pane.addInput(PARAMS, 'rotate camera', {});

  const rotationAxis = Random.quaternion();
  rotationAxis.pop();

  return createShader({
    gl,
    frag,
    uniforms: {
      rotationAxis,
      cameraPos: () => Object.values(PARAMS.camera),
      lightPos: () => Object.values(PARAMS.light),
      lensLength: () => PARAMS.lensLength,
      rotateCamera: () => PARAMS['rotate camera'],
      lineWidth: () => PARAMS.lineWidth,
      tint: () => Object.values(PARAMS.tint),
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
