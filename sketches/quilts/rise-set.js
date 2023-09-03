const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const tome = require('chromotome');
const THREE = require('three');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 20,
};

// nowak
// rohlfs_1R
// cc245

const frag = glsl(/* glsl */ `
  precision highp float;

  #pragma glslify: fbm3d = require('glsl-fractal-brownian-noise/3d')
  #pragma glslify: map = require('glsl-map')

  #define PI 3.14159265359
  #define darkBlue vec3(0.247,0.384,0.475)
  #define natural vec3(0.929,0.894,0.796)
  #define wheat vec3(0.937,0.62,0.157)
  #define cayenne vec3(0.91,0.357,0.188)
  #define indigoLinen vec3(0.776,0.675,0.443)

  uniform float playhead;
  uniform vec3 stitch;
  varying vec2 vUv;

  float grid(vec2 st, float res){
    return 1.-(step(res, st.x) * step(res, st.y));
  }

  // from https://www.shadertoy.com/view/Ntyczt
  float udSegment(vec2 p, vec2 a, vec2 b, float filled, float gap, float offset) {
    vec2 ba = b-a;
    vec2 pa = p-a;
    float h =clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );

    // Here's where the magic happens
    h -= offset;
    float s = floor(h / (filled + gap)) * (filled + gap);
    h = s + clamp(h - s, gap * 0.5, gap * 0.5 + filled);
    h += offset;

    return length(pa-h*ba);
  }

  float edgeStrip = 3.5/60.;

  float edges(vec2 p, float width) {
    vec2 bl = step(vec2(width), p);
    float pct = bl.x * bl.y;
    vec2 tr = step(vec2(width), 1.0-p);
    pct *= tr.x * tr.y;
    return pct;
  }

  void main () {
    // shift the uv coordinates account for the edge strips
    vec2 p = vUv + 0.03* fbm3d(vec3(vUv, sin(playhead * PI)), 6);

    vec2 uv = map(p, vec2(edgeStrip), vec2(1.-edgeStrip), vec2(0.), vec2(1.));
    uv.x = clamp(uv.x, 0., 1.);
    uv.y = clamp(uv.y, 0., 1.);

    // repeat the pattern
    uv *= vec2(3.);
    // integer part of the value (we'll use this to identify each cell)
    vec2 id = floor(uv);
    // fractional part of the value
    // move origin to centre of cell
    vec2 st = 2. * fract(uv) - 1.;

    vec3 color = natural;

    // blue circle
    if (length(st) < 1.) {
      // draw top or bottom half of the circle based on the id
      float clip = mod(id.x, 2.) == 0. ? -1. : 1.;
      color = mix(darkBlue, color, sign(st.y) * clip);
    }

    // wheat circle
    if (length(st) < .5) {
      color = wheat;
    }

    // red circle
    if (length(st) < .5) {
      // draw top or bottom half of the circle based on the id
      float clip = mod(id.x, 2.) == 0. ? 1. : -1.;
      color = mix(cayenne, color, sign(st.y) * clip);
    }

    // debug grid
    // color = mix(color, vec3(1.,0.5,1.), grid(fract(uv), 0.01));

    vec2 p2 = vUv + 0.01 * fbm3d(vec3(vUv, sin(playhead * PI)), 6);

    // edge strips
    color = mix(natural, color, edges(p2, edgeStrip));

    // binding
    color = mix(cayenne, color, edges(p2, 0.01));

    // quilting
    vec2 quv = fract(p2 * vec2(24.));
    float f = 0.125;
    float g = 0.125;
    float o = 0.;
    float d = udSegment(quv, vec2(0., 0.), vec2(0., 1.), f, g, o);
    color = mix(color, indigoLinen, 1.0-smoothstep(0.0,0.02, abs(d)));

    // binding seam
    f *= 0.05;
    g *= 0.05;
    float s = 0.005;
    float e = 0.995;
    float bd = udSegment(p2, vec2(s, s), vec2(e, s), f, g, o);
    bd = min(bd, udSegment(p2, vec2(e, s), vec2(e, e), f, g, o));
    bd = min(bd, udSegment(p2, vec2(s, e), vec2(e, e), f, g, o));
    bd = min(bd, udSegment(p2, vec2(s, s), vec2(s, e), f, g, o));
    color = mix(color, indigoLinen, 1.0-smoothstep(0.0,0.001, abs(bd)));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
