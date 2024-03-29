/**
 * Somewhat based on https://www.shadertoy.com/view/4s2SRt
 */
const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  // hacky anti-aliasing
  dimensions: [1080 * 4, 1080 * 4],
  context: 'webgl',
  animate: false,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;
	uniform float playhead;
	uniform vec2 resolution;

  varying vec2 vUv;

  #define color1 vec3(0.1)
  #define color2 vec3(1.0)
  #define PI 3.141592653589793

  float groutWidth = 0.01;

  float pattern(float y) {
    if (y <= 0.4) { return 1.; }
    else if (y > 0.4 && y <= 0.6) { return 0.; }
    else if (y > 0.6 && y <= 0.7) { return 1.; }
    else if (y > 0.7 && y <= 0.9) { return 0.; }
    else if (y > 0.9 && y <= 1.) { return 1.; }
    else { return 0.; }
  }

  bool isGrout(float y, vec2 u) {
    float t = groutWidth;
    float t_2 = groutWidth * 0.3;
    return abs(y - 0.4) < t || abs(y - 0.6) < t || abs(y - 0.7) < t || abs(y - 0.9) < t || abs(y - 1.0) < t ||
      u.x < t_2 || u.y < t_2 || u.x > 1.0 - t_2 || u.y > 1.0 - t_2;
  }

  // Marble texture
  float hash(vec2 p) {
    p  = fract( p*0.6180339887 );
    p *= 25.0;
    return fract( p.x*p.y*(p.x+p.y) );
  }

  float noise(vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float a = hash(p+vec2(0,0));
    float b = hash(p+vec2(1,0));
    float c = hash(p+vec2(0,1));
    float d = hash(p+vec2(1,1));
    return mix(mix( a, b,f.x), mix( c, d,f.x),f.y);
  }

  float fbm(vec2 x, float H ) {
    float G = exp2(-H);
    float f = 1.0;
    float a = 1.0;
    float t = 0.0;
    for( int i=0; i< 12; i++ ) {
        t += a*noise(f*x);
        f *= 2.0;
        a *= G;
    }
    return t;
  }

  float pattern(vec2 p) {
    float H = 1.;
    vec2 q = vec2( fbm( p + vec2(0.0,0.0), H ),
                    fbm( p + vec2(5.2,1.3), H ) );

    vec2 r = vec2( fbm( p + 4.0*q + vec2(1.7,9.2), H ),
                    fbm( p + 4.0*q + vec2(8.3,2.8), H ) );

    return fbm( p + 4.0*r, H );
  }

  // 4 - 2 - 1 - 2 - 1
  void main() {
    vec2 st = vUv;

    // tile
    st *= vec2(10., 5.);

    // Figure out index to alternate pattern
    float index = step(1., mod(st.x, 2.0));

    // 0.0 - 1.0 within each tile
    st = fract(st);

    // Check if we're on a grout line (tile edges)
    float gw = groutWidth * 0.5;
    bool grt = abs(st.x - 1.0) < groutWidth || abs(st.y - 1.0) < groutWidth || st.x < gw || st.y < gw;

    // Shift the pattern in the Y direction
    st.y = st.y + mix(0., 0.4, index == 0. ? st.x : (1.-st.x));

    // get the pattern value (black or white)
    float value = pattern(st.y);

    // Check if we're on a grout line (slanted sub tiles)
    grt = grt || isGrout(st.y, vUv);

    // Alternate the color pattern
    if (index == 0.) {
      value = 1. - value;
    }

    vec3 color =  mix(color1, color2, value);

    float marbleValue = pattern(index == 0. ? vUv.yx : vUv.xy);
    color = mix(color, marbleValue * 1.25 * color, marbleValue);

    // grout color
    color = grt ? vec3(0.8, 0.498039, 0.196078) : color;

    // color = pow(color, vec3(0.4545));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    clearColor: 'rgb(0, 0, 0)',
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
