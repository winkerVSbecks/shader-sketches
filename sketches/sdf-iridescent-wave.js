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
  uniform vec3 lightPos;
  uniform float lensLength;
  uniform bool rotateCamera;
  uniform bool addSpecular;
  uniform float mixBaseAndIridescent;
  uniform vec3 tint;
  uniform vec3 rotationAxis;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square   = require('glsl-square-frame')
  #pragma glslify: sdTorus = require('glsl-sdf-primitives/sdTorus')
  #pragma glslify: sdCappedCylinder = require('glsl-sdf-primitives/sdCappedCylinder')
  #pragma glslify: combine = require('glsl-combine-smooth')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: rotate3d = require('glsl-rotate/rotate')

  vec3 opBend(in float k, in vec3 p) {
    float c = cos(k*p.x);
    float s = sin(k*p.x);
    mat2  m = mat2(c,-s,s,c);
    return vec3(m*p.xy,p.z);
  }

  float opU(float d1, float d2) {
    return min(d1,d2);
  }

  vec2 doModel(vec3 p) {
    float d = 1e10;
    float offsetX = 0.0625;
    float offsetY = 0.125;

    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        vec3 q = p - vec3(.5 * float(x), .5 * float(y), 0.0);

        float amount = (time + float(x) * offsetX + float(y) * offsetY) * PI * 2.;
        float rotation = sin(amount) * PI * 0.25;
        float bend = cos(amount) * 2.5;

        q.xyz = rotate3d(q, rotationAxis, rotation);
        q = opBend(bend, q);

        float cap = sdTorus(q, vec2(0.125, .0625));
        float stem = sdCappedCylinder(q + vec3(0, 0.1, 0), vec2(0.0625, .125));
        float mushroom = combine(cap, stem, 0.1);
        // float mushroom = opU(cap, stem);
        d = min(d, mushroom);
      }
    }

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
    vec3 bg = vec3(0.);
    // Bootstrap a raytracing scene
    float cameraAngle  = rotateCamera ? 2. * PI * playhead : 0.0;
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
      // color = nor * 0.5 + 0.5;

      // From Thomas Hooper's https://www.shadertoy.com/view/llcXWM
      vec3 eyeDirection = normalize(rayOrigin - pos);
      vec3 lightDirection = normalize(lightPos - pos);

      // basic blinn phong lighting
      float power = blinnPhongSpec(lightDirection, eyeDirection, nor, 0.5);
      vec3 baseColor = vec3(power, power, power) * tint;

      // iridescent lighting
      vec3 reflection = reflect(rayDirection, nor);
      vec3 dome = vec3(0, 1, 0);

      vec3 perturb = sin(pos * 10.);
      color = spectrum( dot(nor + perturb * .05, eyeDirection) * 2.);

      float specular = clamp(dot(reflection, lightDirection), 0., 1.);
      specular = pow((sin(specular * 20. - 3.) * .5 + .5) + .1, 32.) * specular;
      specular *= .1;
      specular += pow(clamp(dot(reflection, lightDirection), 0., 1.) + .3, 8.) * .1;

      float shadow = pow(clamp(dot(nor, dome) * .5 + 1.2, 0., 1.), 3.);
      color = color * shadow + (addSpecular ? specular : 0.0);

      // mix blinn phong lighting and iridescent lighting
      color = mix(baseColor, color, mixBaseAndIridescent);

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
    camera: { x: 3.5, y: 0, z: 3.5 },
    light: { x: 1, y: 1, z: 1 },
    lensLength: 2,
    'rotate camera': false,
    tint: { r: 0.05, g: 0.0, b: 0.97 },
    specular: false,
    mix: 0.7,
  };

  const pane = new Pane();
  pane.addInput(PARAMS, 'camera', {});
  pane.addInput(PARAMS, 'light', {});
  pane.addInput(PARAMS, 'lensLength', { min: 0, max: 5, step: 0.1 });
  pane.addInput(PARAMS, 'mix', { min: 0, max: 1, step: 0.01 });
  pane.addInput(PARAMS, 'tint', {
    color: { type: 'float' },
  });
  pane.addInput(PARAMS, 'rotate camera', {});
  pane.addInput(PARAMS, 'specular', {});

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
      addSpecular: () => PARAMS.specular,
      rotateCamera: () => PARAMS['rotate camera'],
      mixBaseAndIridescent: () => PARAMS.mix,
      tint: () => Object.values(PARAMS.tint),
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
