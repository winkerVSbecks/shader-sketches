const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../utils/mouse');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 6,
};

// Based on https://www.shadertoy.com/view/WdB3Dw
const frag = glsl(/* glsl */ `
  precision highp float;

  #pragma glslify: rotate = require('glsl-rotate/rotate')

  uniform float playhead;
  uniform vec2 mouse;
  varying vec2 vUv;

  #define PI 3.141592
  #define TAU 6.283185

  // Keep iteration count too low to pass through entire model,
    // giving the effect of fogged glass
  const float MAX_STEPS = 82.;
  const float FUDGE_FACTORR = .4; //.8;
  const float INTERSECTION_PRECISION = .001;
  const float MAX_DIST = 20.;

  // --------------------------------------------------------
  // Spectrum colour palette
  // IQ https://www.shadertoy.com/view/ll2GD3
  // --------------------------------------------------------

  vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
  }

  vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
  }

  mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  // --------------------------------------------------------
  // Geometry
  // --------------------------------------------------------

  float box(vec3 p, vec3 b){
    vec3 d = abs(p)-b;
    return max(d.x,max(d.y,d.z));
  }

  float octa(vec3 p, float s){
    p = abs(p);
    return (p.x+p.y+p.z-s)*-tan(5.0*PI/6.0);
  }

  float map(vec3 p) {
    p.xy = rotate(p.xy, -playhead * TAU);
    p.yz = rotate(p.yz, playhead * TAU);
    p.zx = rotate(p.zx, -playhead * TAU);

    // float d = box(p, vec3(.5));
    // float d = octa(p, 2.);
    // d = max(d, box(p,vec3(2.0-(sin(playhead * PI)*0.5+0.5)*1.0)));
    // // Onion the box
    // float t = sin(playhead * PI);
    // d = abs(abs(d)-0.4)-0.2;

    float off = 0.8*min(2.5*(sin(playhead * TAU)*0.5+0.5),1.5);
    p= abs(p)-off*0.8;
    p= abs(p)-off*1.2;
    float d = box(p,vec3(.75));

    return d;
  }

  vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
    vec3
        f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = f*z,
        i = c + uv.x*r + uv.y*u;
    return normalize(i);
  }

  void main () {
    vec2 p = (-1.0 + 2.0 * vUv);

    // vec3 ro = vec3(0, 3, -3);
    vec3 ro = vec3(4, 4, -4);
    // ro.yz *= Rot(-mouse.y*PI+1.);
    // ro.xz *= Rot(-mouse.x*TAU);

    vec3 rd = GetRayDir(p, ro, vec3(0,0.,0), 1.);
    vec3 rayPosition = ro;

    float rayLength = 0.;
    float distance = 0.;
    vec3 c;
    vec3 color = vec3(0);

    for (float i = 0.; i < MAX_STEPS; i++) {
      // Step a little slower so we can accumilate glow
      rayLength += max(INTERSECTION_PRECISION, abs(distance) * FUDGE_FACTORR);
      rayPosition = ro + rd * rayLength;

      distance = map(rayPosition);

      // Add a lot of light when we're really close to the surface
      c = vec3(max(0., .01 - abs(distance)) * .5);
      c *= vec3(1.4,2.1,1.7); // blue green tint

      // Accumulate some purple glow for every step
      c += vec3(.6,.25,.7) * FUDGE_FACTORR / 160.;
      c *= smoothstep(20., 7., length(rayPosition));

      // Fade out further away from the camera
      float rl = smoothstep(MAX_DIST, .1, rayLength);
      c *= rl;

      // Vary colour as we move through space
      c *= spectrum(rl * 6. - .6);

      color += c;

      if (rayLength > MAX_DIST) {
        break;
      }
    }

    // color = pow(color, vec3(.4545));
    color = pow(color, vec3(1. / 1.8)) * 2.;
    color = pow(color, vec3(2.)) / 2.;
    color = pow(color, vec3(1. / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl, canvas }) => {
  const mouse = createMouse(canvas);

  return createShader({
    gl,
    frag,
    uniforms: {
      playhead: ({ playhead }) => playhead,
      mouse: () => mouse.position,
    },
  });
};

canvasSketch(sketch, settings);
