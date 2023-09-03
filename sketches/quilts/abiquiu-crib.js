const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');

const settings = {
  dimensions: [50 * 30, 38 * 30],
  context: 'webgl',
  animate: true,
  duration: 2,
};

// wheat:'D6B17C
// sienna: #AB4D4D
// terracotta: #BD563D
// peach: #EDC2AD
// natural: #EDE0D0
// flaxLinen: #C6BDAA
// batting: #F5F5F5

// https://m.media-amazon.com/images/I/81iYv-QbRCL.jpg
const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359
  #define wheat vec3(0.839, 0.694, 0.486)
  #define sienna vec3(0.671, 0.302, 0.302)
  #define terracotta vec3(0.741, 0.337, 0.239)
  #define peach vec3(0.929, 0.761, 0.678)
  #define natural vec3(0.929, 0.878, 0.816)
  #define flaxLinen vec3(0.776, 0.741, 0.667)
  #define batting vec3(0.961, 0.961, 0.961)

  uniform float playhead;
  uniform vec2 resolution;
  varying vec2 vUv;

  float grid(vec2 st, float res){
    return 1.-(step(res, st.x) * step(res, st.y));
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
  }

  void main () {
    vec2 uv = vUv;
    // move the y origin to middle
    uv.y = -1. + 2. * vUv.y;
    // shift the pattern by half a cell to align to the edges
    uv.y += .5 / 9.5;
    // repeat the pattern
    uv *= vec2(25, 9.5);

    // integer part of the value (we'll use this to identify each cell)
    // x -> 0 to 25 and y -> -9 to 10
    vec2 id = floor(uv);
    id.y = abs(id.y); // mirror along the x axis

    // fractional part of the value (0-1 within each cell)
    vec2 st = fract(uv);

    vec3 color = wheat;

    if ((id.y == 0. || id.y == 2.0) && mod(id.x, 8.) == 4.) {
      color = natural;
    }

    if (id.y == 3.0 && mod(id.x, 8.0) == 0.) {
      color = natural;
    }

    if (id.y == 6.0) {
      color = sienna;
    }

    if (id.y == 8.0 && mod(id.x - 2., 4.) != 0.) {
      color = peach;
    }

    // square wave
    float y = 1.5*( sign( sin((id.x -2.) * PI * 2. / 8.) )+1. ) + 1.;
    color = abs(id.y) == y ? terracotta : color;

    // vertical stripes of terracotta
    float absy = abs(id.y);
    if ((absy > 0. && absy <= 4.) && mod(id.x-2., 4.0) == 0.) {
      color = terracotta;
    }

    // quilting
    vec2 quv = vec2(fract(vUv.x * 25. * 12.), fract(vUv.y * 19. * 5.));

    // dashed lines
    if (fract(quv.x) > 0.5) {
      color = mix(color, batting, 1.-step(0.05, quv.y));
    }

    // binding
    vec2 buv = 2. * vUv - 1.;
    float d = sdBox(buv, vec2(1.));
    color = mix(color, sienna, 1.0-step(0.01, abs(d)));

    // binding seam
    float sd = sdBox(buv, vec2(.994));
    vec3 seam = color - vec3(0.2);
    color = mix(color, seam, 1.0-step(0.001, abs(sd)));


    // debug grid
    // color = mix(color, vec3(1.,0.5,1.), grid(st, 0.05));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);

// --------------------------------------------------
// Expanded version
// --------------------------------------------------
// float grid(vec2 st, float res){
//   return 1.-(step(res, st.x) * step(res, st.y));
// }

// float sdBox(vec2 p, vec2 b) {
//   vec2 d = abs(p)-b;
//   return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
// }

// void main () {
//   vec2 uv = vUv;
//   // move the y origin to middle
//   uv.y = -1. + 2. * vUv.y;
//   // shift the pattern by half a cell to align to the edges
//   uv.y += .5 / 9.5;
//   // repeat the pattern
//   uv *= vec2(25, 9.5);

//   // integer part of the value (we'll use this to identify each cell)
//   // x -> 0 to 25 and y -> -9 to 10
//   vec2 id = floor(uv);

//   // fractional part of the value (0-1 within each cell)
//   vec2 st = fract(uv);

//   vec3 color = flaxLinen;

//   if (mod(id.y, 1.0) == 0.) {
//     color = mod(id.x - 2., 8.) < 4. ? wheat : terracotta;
//   }

//   if (mod(id.y, 2.0) == 0.) {
//     color = mod(id.x, 8.) == 4. ? natural : wheat;
//   }

//   if (mod(id.y, 3.0) == 0.) {
//     color = mod(id.x, 8.0) == 0. ? natural : wheat;
//   }

//   if (mod(id.y, 4.0) == 0.) {
//     color = mod(id.x + 2., 8.) < 4. ? wheat : terracotta;
//   }

//   if (mod(id.y, 5.0) == 0.) {
//     color = wheat;
//   }

//   if (mod(id.y, 6.0) == 0.) {
//     color = sienna;
//   }

//   if (mod(id.y, 7.0) == 0.) {
//     color = wheat;
//   }

//   if (mod(id.y, 8.0) == 0.) {
//     color = mod(id.x - 2., 4.) == 0. ? wheat : peach;
//   }

//   if (mod(id.y, 9.0) == 0.) {
//     color = wheat;
//   }

//   // vertical stripes of terracotta
//   float absy = abs(id.y);
//   if ((absy > 0. && absy <= 4.) && mod(id.x-2., 4.0) == 0.) {
//     color = terracotta;
//   }

//   // center horizontal strip
//   if (mod(id.y, 0.0) == 0.) {
//     color = mod(id.x + 4., 8.) == 0. ? natural : wheat;
//   }

//   // quilting
//   float qy = fract(vUv.y * 19. * 5.);
//   float qx = fract(vUv.x * 25. * 12.);

//   // dashed lines
//   if (fract(qx) > 0.5) {
//     color = mix(color, batting, 1.-step(0.05, qy));
//   }

//   // binding
//   vec2 euv = vec2(
//     (2. * gl_FragCoord.x-resolution.x)/resolution.x,
//     (2. * gl_FragCoord.y-resolution.y)/resolution.y
//   );
//   float d = sdBox(euv, vec2(1.));
//   color = mix(color, sienna, 1.0-step(0.01, abs(d)));

//   // binding seam
//   float sd = sdBox(euv, vec2(.994));
//   vec3 seam = color - vec3(0.2);
//   color = mix(color, seam, 1.0-step(0.001, abs(sd)));

//   // debug grid
//   // color = mix(color, vec3(1.,0.5,1.), grid(st, 0.05));

//   gl_FragColor = vec4(color, 1.0);
// }
