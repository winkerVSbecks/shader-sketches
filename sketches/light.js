const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8, // 24,
};

// Based on https://www.shadertoy.com/view/mlS3Rd
const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359

  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  float sdEquilateralTriangle(vec2 p) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0/k;
    if( p.x+k*p.y>0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
    p.x -= clamp( p.x, -2.0, 0.0 );
    return -length(p)*sign(p.y);
  }

  float sdPie( in vec2 p, in vec2 c, in float r ) {
    p.x = abs(p.x);
    float l = length(p) - r;
	  float m = length(p - c*clamp(dot(p,c),0.0,r) );
    return max(l,m*sign(c.y*p.x-c.x*p.y));
  }

  float sdArc(vec2 p, vec2 sc, float ra, float rb) {
    p.x = abs(p.x);
    return ((sc.y*p.x>sc.x*p.y) ? length(p-sc*ra) :
                                  abs(length(p)-ra)) - rb;
  }

  float easeInOutCubic(float t) {
    if ((t *= 2.0) < 1.0) {
      return 0.5 * t * t * t;
    } else {
      return 0.5 * ((t -= 2.0) * t * t + 2.0);
    }
  }

  float linearstep(float edge0, float edge1, float x) {
    return  clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  }

  void main () {
    vec2 p = (-1.0 + 2.0 * vUv);

    //Resolution for scaling
    // vec2 r = resolution.xy;
    //Relative position to ring light
    // vec2 p1 = (gl_FragCoord.xy - vec2(.3  + .4 * sin(time * PI),.5)*r)/r.y;
    //Relative position to square light
    // vec2 p2 = (gl_FragCoord.xy - vec2(.7,.5)*r)/r.y;

    //Compute SDF distance to ring
    // float dist1 = abs(length(p1)-.125);
    //Compute SDF distance to square
    // float dist2 = length(p2 - clamp(p2,-.125,.125));

    // float dist1 = abs(sdPie(p,vec2(sin(time),cos(time)), 0.5)-.125);

    // arc
    // float tb = PI*(0.5+0.5*cos(time*0.31+2.0));
    float te = time; //easeOutCubic(time);
    float rb = 0.15*(0.5+0.5*cos(te*0.41+3.0));
    // vec2  sc = vec2(sin(tb), cos(tb));
    float tb = PI*(0.5 + 0.5*cos(PI + te * PI * 2.));
    vec2  sc = vec2(sin(tb), cos(tb));
    float dist1 = abs(sdArc(p, sc, 0.5, rb) -.125);

    // ring
    float t = easeInOutCubic(linearstep(0.0625, 0.25, time));
    // float t = easeInOutCubic(time);
    vec2 p2 = p + vec2(0., max(0., 1.5 - 1.5 * t));
    float r = .125 + 0.275 * easeInOutCubic(linearstep(0.5, 0.625, time));
    float dist2 = abs(length(p2) - r);

    //Light intensity vectors
    vec4 i1 = vec4(background, .5);
    vec4 i2 = vec4(background, .5 * ( 1. - easeInOutCubic(linearstep(0.95, 1.0, time))));


    gl_FragColor = i1 / (i1 + dist1*4.) + i2 / (i2 + dist2*6.);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ playhead }) => playhead, // console.log(time) || time,
      background,
      foreground,
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get('hurdles');
  if (!palette.background) palette = tome.get();
  console.log(palette.name);

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) =>
      Color.contrastRatio(background, color) >= minContrast &&
      color !== background
  );

  const foreground = Random.pick(colors);

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
  };
}

canvasSketch(sketch, settings);
