const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 6,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  float A = 7.0, B = 2.0; // Rotation angle is atan(B,A)
  float K = 1.0;          // Extra subdivisions
  float scale = 1.5;
  float PI = 3.14159;

  // Complex functions
  vec2 cmul(vec2 z, vec2 w) {
    return mat2(z,-z.y,z.x)*w;
  }

  vec2 cinv(vec2 z) {
    float t = dot(z,z);
    return vec2(z.x,-z.y)/t;
  }

  vec2 cdiv(vec2 z, vec2 w) {
    return cmul(z,cinv(w));
  }

  vec2 clog(vec2 z) {
    float r = length(z);
    return vec2(log(r),atan(z.y,z.x));
  }

  // Inverse hyperbolic tangent
  vec2 catanh(vec2 z) {
    return 0.5*clog(cdiv(vec2(1,0)+z,vec2(1,0)-z));
  }

  // Iq's hsv function, but just for hue.
  vec3 h2rgb(float h ) {
    vec3 rgb = clamp( abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    rgb = rgb*rgb*(3.0-2.0*rgb); // cubic smoothing
    return 0.2+0.8*rgb;
  }

  void main() {
    vec2 z = (2.0 * gl_FragCoord.xy - resolution.xy)/resolution.y;
    z *= scale;

    vec2 rot = vec2(A, B);
    z = catanh(
      cmul(vec2(cos(0.9*time), sin(0.9*time)), z)
      // cmul(vec2(cos(0.9*time), sin(0.9*time)), z) / cmul(rot,z)
      // cmul(cmul(vec2(cos(0.9*time), sin(0.9*time)), z), cmul(rot, z))
      // cmul(vec2(cos(0.9*time), sin(0.9*time)), z) * cdiv(rot, z)
    );
    // z = clog(z);
    z /= PI; // Alignment

    z.y = mod(z.y + 0.9*time, 1.0);

    // // stripes
    // z = K*cmul(rot,z);

    // IQ's versatile cosine palette.
    float val = dot(z, vec2(1));
    vec3 col = .5 + .47*cos(6.2831*val + vec3(0, 1, 2));

    // Rough gamma correction.
    gl_FragColor = vec4(sqrt(max(col, 0.)), 1);
  }
`);

// OES_standard_derivatives;

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      // time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      time: ({ playhead }) => Math.sin(playhead * Math.PI),
      loopTime: ({ time }) => time % 1,
    },
  });
};

canvasSketch(sketch, settings);
