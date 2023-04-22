const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  // duration: 2,
};

const frag = glsl(/*glsl*/ `
  precision mediump float;

  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  #define AA 4
  #define drawEdge .875
  #define torus .9
  #define tri .3
  #define corner .01
  #define pi 3.141592653589793
  #define sqrt3 1.7320508075688772

  float random(vec2 v2) {
    return fract(sin(dot(v2, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec2 opRevolution(in vec3 p, float w) {
    return vec2(length(p.xy) - w, p.z);
  }

  mat2 rot(float a) {
    float s = sin(a),
          c = cos(a);
    return mat2(c, -s, s, c);
  }

  float sdEquilateralTriangle(in vec2 p, in float r ) {
    p.x = abs(p.x) - r;
    p.y = p.y + r / sqrt3;
    if (p.x + sqrt3 * p.y > 0.)
        p = vec2(p.x - sqrt3 * p.y, -sqrt3 * p.x - p.y) * .5;
    p.x -= clamp(p.x, -2. * r, 0.);
    return -length(p) * sign(p.y);
  }

  float map(in vec3 pos) {
    pos.xz *= rot(time * .5);
    vec2 revolution = opRevolution(pos, torus);
    vec2 rotated = revolution * rot(pi * .5 - atan(pos.y, pos.x) * .33333333 + time);

    float d = sdEquilateralTriangle(rotated, tri) - corner;

    return d;
  }

  vec3 calcNormal(in vec3 pos) {
    const float ep = .01;
    vec2 e = vec2(1., -1.) * .5773;
    return normalize(e.xyy * map(pos + e.xyy * ep) +
            e.yyx * map(pos + e.yyx * ep) +
            e.yxy * map(pos + e.yxy * ep) +
            e.xxx * map(pos + e.xxx * ep));
  }

  vec3 draw(vec2 st) {
    vec3 color = vec3(0.);
    vec3 normal = vec3(0.);
    float needAA = 0.;
    vec2 p = st / resolution.y;

    vec3 ro = vec3(0., 0., -8.);
    vec3 rd = normalize(vec3(p, 5.));

    float t = 5.0;
    for (int i = 0; i < 30; i++) {
        vec3 p = ro + t * rd;
        float mapped = map(p);
        if (abs(mapped) < 0.001 || t > 20.) break;
        t += .9 * mapped;
    }

    if (t < 10.) {
        vec3 pos = ro + t * rd;
        normal = calcNormal(pos);
        normal.xy += random(pos.xy) * .05 - .025;
        normal = normalize(normal);
        float height = atan(normal.y, normal.x);
        color = cos((height + vec3(0., .33, .67) * pi) * 2.) * .5 + .5;
        color *= smoothstep(.95, .25, abs(normal.z));
    }

    return color;
  }

  vec4 aaTrace(vec2 st) {
    vec3 tot = vec3(0.);
    for (int m = 0; m < AA; m++)
    for (int n = 0; n < AA; n++) {
        vec2 o = vec2(float(m), float(n)) / float(AA) - .5;
        tot += draw(st + o * 2.);
    }
    tot /= float(AA * AA);

    tot = pow(tot, vec3(.45)) * 1.25;
    tot = pow(tot, vec3(1.25));

    return vec4(tot, 1.);
  }

  void main() {
    vec4 col = vec4(0., 0., 0., 1.);
    vec2 st = (-resolution.xy + 2.0 * gl_FragCoord.xy);
    float dc = length(st / resolution.y);
    if (dc < drawEdge) {
      col = aaTrace(st);
    }

    gl_FragColor = col;
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
      loopTime: ({ time }) => time % 1,
    },
  });
};

canvasSketch(sketch, settings);
