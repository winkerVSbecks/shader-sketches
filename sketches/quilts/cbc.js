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

  void main () {
    vec2 vuv = vUv + 0.03* fbm3d(vec3(vUv, sin(playhead * PI)), 6);

    vec2 p = 2. * vuv -1.;
    vec2 uv = p;
    // repeat the pattern
    uv *= vec2(3.);
    // uv += vec2(0.5/6., 0.5/6.);
    // mirror along the x & y axis
    uv = abs(uv);
    // integer part of the value (we'll use this to identify each cell)
    vec2 id = floor(uv);
    // fractional part of the value (0-1 within each cell)
    vec2 st = fract(uv);

    vec3 color = natural;

    // circle
    if (length(st) < 1.) {
      color = cayenne;
    }

    // debug grid
    // color = mix(color, vec3(1.,0.5,1.), grid(st, 0.05));

    // // quilting
    // vec2 quv = fract(uv * vec2(2.));

    // float f = 0.05;
    // float g = 0.05;
    // float o = 0.;
    // float d = udSegment(quv, vec2(1., 0.), vec2(0., 1.), f, g, o);
    // color = mix(color, stitch, 1.0-smoothstep(0.0,0.02, abs(d)));

    // // binding seam
    // float bd = udSegment(abs(p), vec2(0., .99), vec2(.99, .99), f*.1, g*.1, o);
    // bd = min(bd, udSegment(abs(p), vec2(.99, 0.), vec2(.99, .99), f*.1, g*.1, o));
    // color = mix(color, stitch, 1.0-smoothstep(0.0,0.002, abs(bd)));

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
