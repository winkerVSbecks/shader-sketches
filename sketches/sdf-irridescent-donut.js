const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const { lerpFrames } = require('canvas-sketch-util/math');
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
  uniform vec3 lightPos;
  uniform float lensLength;
  uniform float roughness;
  uniform bool rotate;

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
    p = rotate3d(p, vec3(1.0, 0.0, 0.0), PI * 2. * playhead);
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

  void main() {
    vec3 color = vec3(0.0);
    vec3 bg = vec3(0.);
    // Bootstrap a raytracing scene
    float cameraAngle  = rotate ? 2. * PI * playhead : 0.0;
    vec3  rayOrigin    = cameraPos * vec3(sin(cameraAngle), 1.0, cos(cameraAngle));
    vec3  rayTarget    = vec3(0, 0, 0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, lensLength);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      // Determine the point of collision
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);
      color = nor * 0.5 + 0.5;

      vec3 eyeDirection = normalize(rayOrigin - pos);
      vec3 lightDirection = normalize(lightPos - pos);

      float power = blinnPhongSpec(lightDirection, eyeDirection, nor, 0.5);
      color = vec3(power, power, power) * color; // * vec3(0.80,0.33,0.42);

      vec3 ref = reflect(rayDirection, nor);
      vec3 dome = vec3(0, 1, 0);

      vec3 perturb = sin(pos * 10.);
      color = color * vec3(0.25) + spectrum( dot(nor + perturb * .05, eyeDirection) * 2.);

      float specular = clamp(dot(ref, lightDirection), 0., 1.);
      specular = pow((sin(specular * 20. - 3.) * .5 + .5) + .1, 32.) * specular;
      specular *= .1;
      specular += pow(clamp(dot(ref, lightDirection), 0., 1.) + .3, 8.) * .1;

      float shadow = pow(clamp(dot(nor, dome) * .5 + 1.2, 0., 1.), 3.);
      color = color * shadow + specular;

      float near = 2.8;
      float far = 8.;
      float fog = (collision.x - near) / (far - near);
      fog = clamp(fog, 0., 1.);
      color = mix(color, bg, fog);
      color = linearToScreen(color);
    }

    gl_FragColor = vec4(color, 1);
  }
`);

const sketch = ({ gl }) => {
  const PARAMS = {
    rotate: true,
    camera: { x: 3.5, y: 3, z: 3.5 },
    light: { x: 1, y: 1, z: 1 },
    lensLength: 2,
    roughness: 0.8,
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'rotate', {});
  pane.addInput(PARAMS, 'camera', {});
  pane.addInput(PARAMS, 'light', {});
  pane.addInput(PARAMS, 'lensLength', {});

  return createShader({
    gl,
    frag,
    uniforms: {
      rotate: () => PARAMS.rotate,
      cameraPos: () => Object.values(PARAMS.camera),
      lightPos: () => Object.values(PARAMS.light),
      lensLength: () => PARAMS.lensLength,
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
