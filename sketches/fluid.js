const canvasSketch = require('canvas-sketch');
const { lerpFrames } = require('canvas-sketch-util/math');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 10,
};

// from https://glslsandbox.com/e#102445.0
const frag = glsl(/*glsl*/ `
  precision highp float;

  varying vec2 vUv;
  uniform vec2 resolution;
  uniform float time;
  uniform float playhead;
  uniform float other;

  #define PI 3.14159265359
  vec2 mouse = vec2(0.5, 0.5);

  const int   complexity      = 32;    // More points of color.
  const float mouse_factor    = 56.0;  // Makes it more/less jumpy.
  const float mouse_offset    = 0.0;   // Drives complexity in the amount of curls/cuves.  Zero is a single whirlpool.
  const float fluid_speed     = 108.0;  // Drives speed, higher number will make it slower.
  const float color_intensity = 0.8;

  vec3 hsv2rgb(float h,float s,float v) {
    return mix(vec3(1.),clamp((abs(fract(h+vec3(3.,2.,1.)/3.)*6.-3.)-1.),0.,1.),s)*v;
    // vec3 c = mix(vec3(1.),clamp((abs(fract(h+vec3(3.,2.,1.)/3.)*6.-3.)-1.),0.,1.),s)*v;
    // return .5 + .47*cos(6.2831* length(c) + vec3(0, 1, 2));
  }

  void main() {
    vec2 p = vUv - vec2(0.5);
    p *= mouse.y*8.3+.4; p /= dot( p*mouse, p/mouse*2. );  // ändrom3da tweak
    #define time time*16.
    p -= 8.*mouse;

    for(int i=1;i<complexity;i++) {
      vec2 newp=p + time*0.001;
      newp.x+=0.6/float(i)*sin(float(i)*p.y+time/fluid_speed+0.3*float(i)) + 0.5; // + mouse.y/mouse_factor+mouse_offset;
      newp.y+=0.6/float(i)*sin(float(i)*p.x+time/fluid_speed+0.3*float(i+10)) - 0.5; // - mouse.x/mouse_factor+mouse_offset;
      p=newp;
    }

    // Change the mix ratio to increase the marble feel and change the white color to a light blue color
    float mix_ratio = 0.5 * sin(3.0 * p.x) + 0.6;
    vec3 col;
    col= hsv2rgb(mix_ratio / 2. + .6, .9, .9 );
    gl_FragColor = vec4(col, 1.0);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ playhead, duration }) =>
        lerpFrames([0, duration * 0.5, 0], playhead),
      playhead: ({ playhead, duration }) => lerpFrames([0, 1, 0], playhead),
    },
  });
};

canvasSketch(sketch, settings);
