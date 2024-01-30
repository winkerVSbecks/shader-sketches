const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const { mapRange } = require('canvas-sketch-util/math');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 6,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform vec2 resolution;
  uniform vec2 polarPlayhead;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 256, precision = 0.0001)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: softshadow = require('glsl-sdf-ops/softshadow', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')
  #pragma glslify: sdBox = require('glsl-sdf-primitives/sdBox')
  #pragma glslify: sdSphere = require('glsl-sdf-primitives/sdSphere')
  #pragma glslify: udBox = require('glsl-sdf-primitives/udBox')
  #pragma glslify: noise = require('glsl-noise/classic/4d')

  vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 0.7, 0.4);
    vec3 d = vec3(0.00, 0.15, 0.20);
    return a + b*sin(6.28318*(c*t+d));
  }

  mat2 rotate2d(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  vec2 doModel(vec3 p) {
    p.xy*=rotate2d(-playhead * PI);
    p.yz*=rotate2d(playhead * PI);
    p.zx*=rotate2d(-playhead * PI);

    float scale = 2.;
    vec3 q = p;
    q.y = q.y - 0.5;
    q *= scale;
    q = fract(q) - 0.5;

    vec3 id = floor(p * scale)* 0.2;
    float t = .75 - abs(noise(vec4(id.xyz, length(polarPlayhead))));
    float s = .5 * t;

    float d = udBox(q, vec3(s)) / (2.*scale);
    d = max(d, udBox(p, vec3(2.)));

    return vec2(d, 1. - t);
  }

  void main() {
    vec3 color = vec3(0.0);
    float cameraAngle  = 2. * PI * playhead;
    vec3  rayOrigin    = vec3(.57703 * 10.); //* vec3(sin(cameraAngle), 1.0, cos(cameraAngle));
    vec3  rayTarget    = vec3(0, 0, 0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, 2.0);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    if (collision.x > -0.5) {
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);

      vec3 light = vec3(.57703);
      float dif = clamp(dot(nor, light), 0.0, 1.0);

      if (dif > 0.001)
        dif *= softshadow(pos + nor * 0.001, light, 0.001, 1.0);

      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      color = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
      color *= palette(2. + 1. * collision.y);
      color *= collision.y;

      color = sqrt(color);
    }

    gl_FragColor = vec4(color, 1);
  }

`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      polarPlayhead: ({ playhead }) => {
        let angle = Math.PI * 2 * playhead;
        return [
          mapRange(Math.sin(angle), -1, 1, 0, 1),
          mapRange(Math.sin(angle), -1, 1, 0, 2),
        ];
      },
    },
  });
};

canvasSketch(sketch, settings);
