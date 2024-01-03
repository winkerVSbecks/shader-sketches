const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const { lowContrast } = require('../../utils/clrs-ramps');
const generateSubtractiveColors = require('../../utils/subtractive-color');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  // Based on http://roy.red/posts/infinite-regression/
  precision highp float;

  #define PI 3.14159265359

  uniform float time;
  uniform float playhead;
  varying vec2 vUv;
  uniform vec3 color1;
  uniform vec3 color2;
  uniform vec3 color3;
  uniform vec3 color4;
  uniform vec3 color5;
  uniform sampler2D texture;

  vec2 cMul(vec2 a, vec2 b) {return vec2( a.x*b.x -  a.y*b.y,a.x*b.y + a.y * b.x);}
  vec2 cPower(vec2 z, float n) {
    float r2 = dot(z,z);
    return pow(r2,n/2.0)*vec2(cos(n*atan(z.y,z.x)),sin(n*atan(z.y,z.x)));
  }
  vec2 cInverse(vec2 a) {return  vec2(a.x,-a.y)/dot(a,a);}
  vec2 cDiv(vec2 a, vec2 b) { return cMul( a,cInverse(b));}
  vec2 cExp(in vec2 z){return vec2(exp(z.x)*cos(z.y),exp(z.x)*sin(z.y));}
  vec2 cLog(vec2 a) {
    float b =  atan(a.y,a.x);
    if (b>0.0) b-=2.0*3.1415;
    return vec2(log(length(a)),b);
  }

  float f(float x){
    return exp2(-floor(log2(x))-2.);
  }

  float circle(vec2 z){
    return 1. - length(2.*z - 1.);
  }

  vec3 stripeColor(float p) {
    float frequency = 5.0;
    float stripes = frequency * time + frequency * p;
    float rounded = floor(stripes);
    float t = mod(rounded, 5.0);

    if (t == 4.0) {
      return color1;
    } if (t == 3.0) {
      return color2;
    } else if (t == 2.0) {
      return color3;
    } else if (t == 1.0) {
      return color4;
    } else if (t == 0.0) {
      return color5;
    }
  }

  vec3 color(vec2 z) {
    vec2 a_z = abs(z);
    float scale = f(max(a_z.x,a_z.y));
    return stripeColor( circle(fract(z*scale)) );
  }

  void main () {
    // Map the normalized pixel position to a -1.0 to +1.0 range
    // so that it's symmetric both vertically and horizontally
    vec2 p = (-1.0 + 2.0 * vUv);

    float ratio = pow(4., 4.);
    float angle = atan(log(ratio) / (2.0*PI));
    p = cLog(p);
    p = cDiv(p, cExp(vec2(0,angle)) * cos(angle));
    p = cExp(p - vec2(mod(time, 4.19) - 4., 0));

    gl_FragColor = vec4(color(p), 1.0);
  }
`);

const sketch = ({ gl }) => {
  const clrs = generateSubtractiveColors(); //lowContrast();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      color1: clrs[0],
      color2: clrs[1],
      color3: clrs[2],
      color4: clrs[3],
      color5: clrs[4],
    },
  });
};

canvasSketch(sketch, settings);
