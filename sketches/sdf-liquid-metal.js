const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
import { lerpFrames } from 'canvas-sketch-util/math';

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 20,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform vec2 resolution;
  uniform float mixBaseAndIridescent;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square   = require('glsl-square-frame')
  #pragma glslify: sdBox = require('glsl-sdf-primitives/sdBox')
  #pragma glslify: sdSphere = require('glsl-sdf-primitives/sdSphere')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: rotate = require('glsl-rotate/rotate')
  #pragma glslify: smin = require('glsl-smooth-min')
  #pragma glslify: combine = require('glsl-combine-smooth')

  float wobbly(float x, float t) {
    float a = 4.;
    float b = 2.;
    return sin(a * x + b * t + 5.) + sin(b * x + a * t + 4.);
  }

  vec3 twist(vec3 p) {
    float t = 0.2 * wobbly(p.x, 2.*sin(playhead*PI));
    float c = cos(t*p.y+t);
    float s = sin(t*p.y+t);
    mat2 m = mat2(c,-s,s,c);
    return vec3(m*p.xz,p.y);
  }

  vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
  }

  vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
  }

  vec2 doModel(vec3 p) {
    p = twist(p);

    p.xy = rotate(p.xy, -playhead * PI);
    p.yz = rotate(p.yz, playhead * PI);
    p.zx = rotate(p.zx, -playhead * PI);

    float d = 1e12;

    for(int i = 0; i < 20; i++) {
      d = combine(d, sdSphere(p + vec3(i,0,0)*0.1, 1.), 0.6);
    }

    return vec2(d, 0.0);
  }

  const float GAMMA = 2.2;

  vec3 gamma(vec3 color, float g) {
    return pow(color, vec3(g));
  }

  vec3 linearToScreen(vec3 linearRGB) {
    return gamma(linearRGB, 1.0 / GAMMA);
  }

  void main() {
    vec3 bg = vec3(0.075,0.071,0.09);
    vec3 color = vec3(0.075,0.071,0.09);
    // Bootstrap a raytracing scene
    float cameraAngle  = 2. * PI * playhead;
    vec3  rayOrigin    = vec3(3.5, 0, 3.5);
    vec3  rayTarget    = vec3(0, 0, 0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, 1.25);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      // Determine the point of collision
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);

      vec3 lightPos = vec3(1, 1, 1);
      vec3 eyeDirection = normalize(rayOrigin - pos);
      vec3 lightDirection = normalize(lightPos - pos);

      // basic blinn phong lighting from Thomas Hooper's https://www.shadertoy.com/view/llcXWM
      float power = blinnPhongSpec(lightDirection, eyeDirection, nor, 0.5);
      vec3 baseColor = vec3(power, power, power);

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
      color = color * shadow;

      // mix blinn phong lighting and iridescent lighting
      color = mix(baseColor, color, 0.5);

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
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
