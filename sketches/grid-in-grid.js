const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 12,
};

// Based on https://thebookofshaders.com/edit.php#10/ikeda-simple-grid.frag
// by Patricio Gonzalez Vivo, 2015 - http://patriciogonzalezvivo.com/
const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec2 resolution;

  float random(in float x){ return fract(sin(x)*43758.5453); }
  float random(in vec2 st){ return fract(sin(dot(st.xy ,vec2(12.9898,78.233))) * 43758.5453); }

  float grid(vec2 st, float res){
    vec2 grid = fract(st*res);
    return 1.-(step(res,grid.x) * step(res,grid.y));
  }

  float box(in vec2 st, in vec2 size){
    size = vec2(0.5) - size*0.5;
    vec2 uv = smoothstep(size,
                        size+vec2(0.001),
                        st);
    uv *= smoothstep(size,
                    size+vec2(0.001),
                    vec2(1.0)-st);
    return uv.x*uv.y;
  }

  float cross(in vec2 st, vec2 size){
    return  clamp(box(st, vec2(size.x*0.5,size.y*0.125)) +
            box(st, vec2(size.y*0.125,size.x*0.5)),0.,1.);
  }


  float EaseInOutQuad(float x) {
    float inValue = 2.0 * x  *x;
    float outValue = 1.0- pow(-2.0 * x + 2.0,2.0) / 2.0;
    float inStep = step(inValue,0.5) * inValue;
    float outStep = step(0.5 , outValue ) * outValue;

    return inStep + outStep;
  }
  float EaseInOutQuart(float x) {
    float inValue = 8.0 * x * x * x * x;
    float outValue = 1.0 - pow(-2.0 * x + 2.0, 4.0) / 2.0;
    return step(inValue , 0.5) * inValue + step(0.5,outValue) * outValue;
  }
  float EaseInOutQuint(float x) {
    float inValue = 16.0 * x * x * x * x * x;
    float outValue = 1.0 - pow(-2.0 * x + 2.0, 5.0) / 2.0;
    return step(inValue , 0.5) * inValue + step(0.5,outValue) * outValue;
  }
  float EaseInOutExpo(float x) {
    float inValue = pow(2.0, 20.0 * x - 10.0) / 2.0;
    float outValue = (2.0 - pow(2.0, -20.0 * x + 10.0)) / 2.0;
    return step(inValue , 0.5) * inValue + step(0.5,outValue) * outValue;
  }


  void main(){
    vec2 st = gl_FragCoord.st/resolution.xy;
    st.x *= resolution.x/resolution.y;

    vec3 color = background;
    float t = EaseInOutExpo(time);

    vec2 grid_st = st*300. * t;
    color += 1.0 * foreground * grid(grid_st, 0.01);

    t = EaseInOutQuint(time);
    color += 0.5 * foreground * grid(grid_st, 0.02);

    t = EaseInOutQuart(time);
    color += 0.25 * foreground * grid(grid_st, 0.1);

    gl_FragColor = vec4(color , 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ playhead }) => Math.sin(playhead * Math.PI),
      background,
      foreground,
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get();
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
