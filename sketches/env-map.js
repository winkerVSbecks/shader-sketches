const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const createMouse = require('../utils/mouse');
const load = require('load-asset');
import { lerpFrames } from 'canvas-sketch-util/math';
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
  uniform bool rotateCamera;
  uniform vec3 tint;
  uniform vec2 mouse;
  uniform samplerCube envMap;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square   = require('glsl-square-frame')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: rotate = require('glsl-rotate/rotate')

  // Using some magic folding stuff described here: https://youtu.be/0RWaR7zApEo?t=181
  float sdCrystal(vec3 p) {
    float c = cos(3.1415/5.), s=sqrt(0.75-c*c);
    vec3 n = vec3(-0.5, -c, s);

    p = abs(p);
    p -= 2.*min(0., dot(p, n))*n;

    p.xy = abs(p.xy);
    p -= 2.*min(0., dot(p, n))*n;

    p.xy = abs(p.xy);
    p -= 2.*min(0., dot(p, n))*n;

    float d = p.z - 1.;
    return d;
  }

  vec2 doModel(vec3 p) {
    float d = 1e10;
    float offsetX = 0.0625;
    float offsetY = 0.125;

    float amount = playhead * PI * 2.;
    float rotation = sin(amount) * PI * 0.25;
    float bend = cos(amount) * .5;

    d = min(d, sdCrystal(p));

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
    float cameraAngle  = rotateCamera ? 2. * PI * playhead : 0.0;
    vec3  rayOrigin    = cameraPos * vec3(sin(cameraAngle), 1.0, cos(cameraAngle));
    rayOrigin.yz = rotate(rayOrigin.yz, -mouse.y * PI + 1.);
    rayOrigin.xz = rotate(rayOrigin.xz, -mouse.x * PI * 2.);
    vec3  rayTarget    = vec3(0, 0, 0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, lensLength);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    color = textureCube(envMap, rayDirection).rgb;

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      // Determine the point of collision
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);

      // From Thomas Hooper's https://www.shadertoy.com/view/llcXWM
      vec3 eyeDirection = normalize(rayOrigin - pos);
      vec3 lightDirection = normalize(lightPos - pos);

      // basic blinn phong lighting
      float power = blinnPhongSpec(lightDirection, eyeDirection, nor, 0.5);
      color = vec3(power, power, power) * tint;
    }

    gl_FragColor = vec4(color, 1);
  }
`);

const sketch = async ({ gl, canvas }) => {
  const assets = await load.all({
    posX: '../assets/posx.jpg',
    negX: '../assets/negx.jpg',
    posY: '../assets/posy.jpg',
    negY: '../assets/negy.jpg',
    posZ: '../assets/posz.jpg',
    negZ: '../assets/negz.jpg',
  });

  const PARAMS = {
    camera: { x: 3.5, y: 0, z: 3.5 },
    light: { x: 1, y: 1, z: 1 },
    lensLength: 2,
    spin: true,
    tint: { r: 0.05, g: 0.0, b: 0.97 },
    mix: 0.7,
    animateTint: true,
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'camera', {});
  pane.addInput(PARAMS, 'light', {});
  pane.addInput(PARAMS, 'lensLength', { min: 0, max: 5, step: 0.1 });
  pane.addInput(PARAMS, 'mix', { min: 0, max: 1, step: 0.01 });
  pane.addInput(PARAMS, 'tint', {
    color: { type: 'float' },
  });
  pane.addInput(PARAMS, 'spin', {});

  const mouse = createMouse(canvas);

  const shaderSketch = createShader({
    gl,
    frag,
    uniforms: {
      cameraPos: () => Object.values(PARAMS.camera),
      lightPos: () => Object.values(PARAMS.light),
      lensLength: () => PARAMS.lensLength,
      rotateCamera: () => PARAMS['spin'],
      tint: () => Object.values(PARAMS.tint),
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      mouse: () => mouse.position,
      envMap: () => cubeMap,
    },
  });

  const { regl } = shaderSketch;

  const cubeMap = regl.cube(
    assets.posX,
    assets.negX,
    assets.posY,
    assets.negY,
    assets.posZ,
    assets.negZ
  );

  return shaderSketch;
};

canvasSketch(sketch, settings);
