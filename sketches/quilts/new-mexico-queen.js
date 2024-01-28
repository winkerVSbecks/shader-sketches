const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const generateSubtractiveColors = require('../../utils/subtractive-color');
const { mapRange } = require('canvas-sketch-util/math');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl2',
  animate: true,
  duration: 20,
};

const frag = glsl(/* glsl */ `#version 300 es
  precision highp float;

  out vec4 fragColor;

  #pragma glslify: fbm4d = require('glsl-fractal-brownian-noise/4d')

  #define PI 3.14159265359

  uniform float playhead;
  uniform vec2 polarPlayhead;
  uniform vec3 bg;
  uniform vec3 fg1;
  uniform vec3 fg2;
  uniform vec3 fg3;
  uniform vec3 fg4;
  uniform vec3 stitch;
  in vec2 vUv;

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

  struct Tile { vec3 col; int type; };

  vec3 tile1(vec2 st, vec3 c) {return st.x < st.y ? c : bg; }
  vec3 tile2(vec2 st, vec3 c) {return st.x > st.y ? c : bg; }
  vec3 tile3(vec2 st, vec3 c) {return st.x < st.y ? c : bg; }
  vec3 tile4(vec2 st, vec3 c) {return 1.-st.x > st.y ? c : bg; }
  vec3 tile5(vec2 st, vec3 c) {return 1.-st.x > st.y ? c : bg; }
  vec3 tile6(vec2 st, vec3 c) {return 1.-st.x < st.y ? c : bg; }

  vec3 tileRow(Tile t, vec2 st) {
    if (t.type == 1) return tile1(st, t.col);
    if (t.type == 2) return tile2(st, t.col);
    if (t.type == 3) return tile3(st, t.col);
    if (t.type == 4) return tile4(st, t.col);
    if (t.type == 5) return tile5(st, t.col);
    if (t.type == 6) return tile6(st, t.col);
    return bg;
  }

  void main () {
    vec2 vuv = vUv + 0.01* fbm4d(vec4(vUv, polarPlayhead), 6);

    vec2 p = 2. * vuv -1.;
    vec2 uv = p;
    // repeat the pattern
    uv *= vec2(5.5, 5.5);
    uv += vec2(0.5/6., 0.5/6.);
    // mirror along the x & y axis
    uv = abs(uv);
    // integer part of the value (we'll use this to identify each cell)
    vec2 fuv = floor(uv);
    ivec2 id = ivec2(int(fuv.x), int(fuv.y));
    // fractional part of the value (0-1 within each cell)
    vec2 st = fract(uv);

    vec3 color = bg;

    Tile row1[5] = Tile[](Tile(fg4, 1), Tile(fg1, 2), Tile(fg1, 3), Tile(fg2, 4), Tile(fg4, 5));
    Tile row2[5] = Tile[](Tile(bg, 0), Tile(fg3, 2), Tile(fg3, 3), Tile(fg4, 6), Tile(fg4, 5));
    Tile row3[5] = Tile[](Tile(fg2, 4), Tile(fg1, 2), Tile(fg1, 3), Tile(fg3, 6), Tile(fg3, 1));
    Tile row4[5] = Tile[](Tile(fg3, 2), Tile(fg3, 3), Tile(fg4, 6), Tile(fg4, 1), Tile(bg, 0));
    Tile row5[5] = Tile[](Tile(fg1, 2), Tile(fg1, 3), Tile(fg4, 6), Tile(fg4, 1), Tile(bg, 0));

    if (id.y == 0 && id.x < 5) color = tileRow(row1[id.x], st);
    if (id.y == 1 && id.x < 5) color = tileRow(row2[id.x], st);
    if (id.y == 2 && id.x < 5) color = tileRow(row3[id.x], st);
    if (id.y == 3 && id.x < 5) color = tileRow(row4[id.x], st);
    if (id.y == 4 && id.x < 5) color = tileRow(row5[id.x], st);

    // debug grid
    // color = mix(color, vec3(1.,0.5,1.), grid(st, 0.05));

    // quilting
    vec2 quv = fract(uv * vec2(2.));

    float f = 0.05;
    float g = 0.05;
    float o = 0.;
    float d = udSegment(quv, vec2(1., 0.), vec2(0., 1.), f, g, o);
    color = mix(color, stitch, 1.0-smoothstep(0.0,0.02, abs(d)));

    // binding seam
    float bd = udSegment(abs(p), vec2(0., .99), vec2(.99, .99), f*.1, g*.1, o);
    bd = min(bd, udSegment(abs(p), vec2(.99, 0.), vec2(.99, .99), f*.1, g*.1, o));
    color = mix(color, stitch, 1.0-smoothstep(0.0,0.002, abs(bd)));

    fragColor = vec4(color, 1.0);
  }
`);

const vert = glsl(/* glsl */ `#version 300 es
  precision highp float;
  in vec3 position;
  out vec2 vUv;

  void main () {
    gl_Position = vec4(position.xyz, 1.0);
    vUv = gl_Position.xy * 0.5 + 0.5;
  }
`);

const sketch = ({ gl, canvas, context }) => {
  const colors = generateSubtractiveColors({ total: 6 });
  const bg = colors.shift();
  const stitch = colors.shift();
  const [fg1, fg2, fg3, fg4] = colors;

  return createShader({
    gl,
    frag,
    vert,
    uniforms: {
      playhead: ({ playhead }) => playhead,
      polarPlayhead: ({ playhead }) => {
        let angle = Math.PI * 2 * playhead;
        return [
          mapRange(Math.sin(angle), -1, 1, 0, 2),
          mapRange(Math.sin(angle), -1, 1, 0, 2),
        ];
      },
      bg,
      fg1,
      fg2,
      fg3,
      fg4,
      stitch,
    },
  });
};

canvasSketch(sketch, settings);
