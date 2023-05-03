/**
 * Somewhat based on https://www.shadertoy.com/view/4s2SRt
 */
const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080 * 4, 1080 * 4],
  context: 'webgl',
  animate: true,
  duration: 2,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;
	uniform float playhead;
	uniform vec2 resolution;

  varying vec2 vUv;

  #define color1 vec3(0.0)
  #define color2 vec3(1.0)
  #define PI 3.141592653589793

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


  void main() {
    float value = pattern(vUv);
    vec3 color =  mix(color1, color2, value);
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
