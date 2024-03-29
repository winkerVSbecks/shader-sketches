const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const createMouse = require('../utils/mouse');
import { lerpFrames } from 'canvas-sketch-util/math';
import { Pane } from 'tweakpane';

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
  uniform vec3 cameraPos;
  uniform vec3 lightPos;
  uniform float lensLength;
  uniform bool rotateCamera;
  uniform bool addSpecular;
  uniform float mixBaseAndIridescent;
  uniform vec3 tint;
  uniform vec2 mouse;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square   = require('glsl-square-frame')
  #pragma glslify: sdBox = require('glsl-sdf-primitives/sdBox')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: rotate = require('glsl-rotate/rotate')

  vec3 twist(vec3 p) {
    float t = 2.*sin(playhead*PI);
    float c = cos(t*p.y+t);
    float s = sin(t*p.y+t);
    mat2 m = mat2(c,-s,s,c);
    return vec3(m*p.xz,p.y);
  }

  mat2 rotate2d(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  // Using some magic folding stuff described here: https://youtu.be/0RWaR7zApEo?t=181
  float sdCrystal(vec3 p) {
    float c = cos(3.1415/5.), s=sqrt(0.75-c*c); // magic values
    vec3 n = vec3(-0.5, -c, s); // magic direction to fold stuff

    p = abs(p);
    p -= 2.*min(0., dot(p, n))*n;

    p.xy = abs(p.xy);
    p -= 2.*min(0., dot(p, n))*n;

    p.xy = abs(p.xy);
    p -= 2.*min(0., dot(p, n))*n;

    float d = p.z - 1.;
    return d;
  }

  void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
  }

  float smax(float a, float b, float r) {
    vec2 u = max(vec2(r + a,r + b), vec2(0));
    return min(-r, max (a, b)) + length(u);
  }

  vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
  }

  vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
  }

  vec4 inverseStereographic(vec3 p, out float k) {
    k = 2.0/(1.0+dot(p,p));
    return vec4(k*p,k-1.0);
  }

  float fixDistance(float d, float k) {
    float sn = sign(d);
    d = abs(d);
    d = d / k * 1.82;
    d += 1.;
    d = pow(d, .5);
    d -= 1.;
    d *= 5./3.;
    d *= sn;
    return d;
  }

  float fTorus(vec4 p4) {
    float d1 = length(p4.xy) / length(p4.zw) - 1.;
    float d2 = length(p4.zw) / length(p4.xy) - 1.;
    float d = d1 < 0. ? -d1 : d2;
    d /= PI;
    return d;
  }

  vec2 doModel(vec3 p) {
    p = twist(p);

    p.xy = rotate(p.xy, -playhead * PI);
    p.yz = rotate(p.yz, playhead * PI);
    p.zx = rotate(p.zx, -playhead * PI);

    float box = sdBox(p, vec3(.9, .9, .9)) - .05;

    float k;
    vec4 p4 = inverseStereographic(p,k);

    pR(p4.zy, time * -PI / 2.);
    pR(p4.xw, time * -PI / 2.);

    // A thick walled clifford torus intersected with a sphere
    float d = fTorus(p4);
    d = abs(d);
    d -= .2;
    d = fixDistance(d, k);
    d = smax(d, length(p) - 1.85, .2);

    d = max(d, box);

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
    float cameraAngle  = rotateCamera ? 2. * PI * playhead : 0.0;
    vec3  rayOrigin    = cameraPos;
    vec3  rayTarget    = vec3(0, 0, 0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, lensLength);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      // Determine the point of collision
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);

      vec3 eyeDirection = normalize(rayOrigin - pos);
      vec3 lightDirection = normalize(lightPos - pos);

      // basic blinn phong lighting from Thomas Hooper's https://www.shadertoy.com/view/llcXWM
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

const sketch = ({ gl, canvas }) => {
  const PARAMS = {
    camera: { x: 3.5, y: 0, z: 3.5 },
    light: { x: 1, y: 1, z: 1 },
    lensLength: 1.5,
    spin: true,
    tint: { r: 0.05, g: 0.0, b: 0.97 },
    specular: false,
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
  pane.addInput(PARAMS, 'specular', {});
  pane.addInput(PARAMS, 'animateTint', {});

  const mouse = createMouse(canvas);

  return createShader({
    gl,
    frag,
    uniforms: {
      cameraPos: () => Object.values(PARAMS.camera),
      lightPos: () => Object.values(PARAMS.light),
      lensLength: () => PARAMS.lensLength,
      addSpecular: () => PARAMS.specular,
      rotateCamera: () => PARAMS['spin'],
      mixBaseAndIridescent: () => PARAMS.mix,
      tint: ({ playhead }) =>
        PARAMS.animateTint
          ? lerpFrames(
              [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1],
                [1, 0, 0],
              ],
              playhead
            )
          : Object.values(PARAMS.tint),
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      mouse: () => mouse.position,
    },
  });
};

canvasSketch(sketch, settings);
