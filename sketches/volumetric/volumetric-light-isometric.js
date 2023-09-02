const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../../utils/mouse');

const settings = {
  dimensions: [1080 * 2, 1080 * 2],
  context: 'webgl',
  animate: true,
  // duration: 8,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359
  #define TAU 6.283185

  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;
  uniform vec2  mouse;

  float TIME = 0.0;
  vec2 RUV = vec2(0.0);

  float nrand( vec2 n ) {
    return fract(sin(dot(n.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float n1rand( vec2 n ) {
    TIME *= 1.01;
    float t = fract( TIME );
    float nrnd0 = nrand( RUV + vec2(0.07*t, -0.07*t) );
    return nrnd0;
  }

  float sdBox(in vec3 p, in vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, 0.)) + min(max(d.x, max(d.y, d.z)), 0.);
  }

  float sdPlane(in vec3 p, in vec3 n, in float o) {
    return dot(p, n)-o;
  }

  float opU(in float d1, in float d2) {
    return min(d1, d2);
  }

  float opS(in float d1, in float d2) {
    return max(-d1, d2);
  }

  float map(in vec3 p) {
    vec3 q = p;
    float res = sdPlane(q, vec3(0., 1., 0.), -2.);


    vec3 size = vec3(1., 2., 0.2);
    vec3 offset = vec3(0., 0.0, 0.8);
    res = opU(res, sdBox(q + offset * -2., size));
    res = opU(res, sdBox(q + offset * -1., size));
    res = opU(res, sdBox(q + offset * 0. , size));
    res = opU(res, sdBox(q + offset * 1. , size));
    res = opU(res, sdBox(q + offset * 2. , size));

    res = opS(sdBox(q + vec3(0., 0.3, 0.), vec3(0.6, 1.7, 10)), res);

    return res;
  }

  vec3 march(in vec3 ro, in vec3 rd, in float maxD) {
    float minD=0.;
    float threshold = 0.0001;

    float d=minD;
    for(int i=0;i<32;i++){
        vec3 pos = ro + rd*d;
        float tmp = map(pos);
        if(tmp <threshold || maxD<tmp) break;
        d += tmp;
    }

    if (maxD < d) return vec3(maxD);
    return ro + rd * clamp(d, 0., maxD);
  }

  vec3 calcNormal(in vec3 p) {
  vec2 e = vec2(1.0, -1.0)*0.00001;
    return normalize(vec3(
      e.xyy*map(p+e.xyy) +
      e.yxy*map(p+e.yxy) +
      e.yyx*map(p+e.yyx) +
      e.xxx*map(p+e.xxx)
    ));
  }

  vec3 render(in vec3 ro, in vec3 rd) {
    vec3 p = ro;
    vec3 hit = march(ro, rd, 100.0);
    float d = distance(hit, p);

    float pix = 0.;

    const int n = 8;

    for (int i = 0; i < n; ++i) {

        vec3 sample = mix(p, hit, n1rand(ro.xy * 0.01));

        vec3 light = vec3(0., .1, sin(-time * 0.5) * 1.7);
        float maxD = distance(sample, light);

        if (march(sample, normalize(light - sample), maxD).x == maxD) {
            pix += d / pow(1. + maxD, 2.);
        }
    }

    pix *= 1.0 / float(n);

    return vec3(pix);
  }

  mat3 lookAt(in vec3 eye, in vec3 tar, in float r) {
    vec3 cw = normalize(tar - eye);// camera w
    vec3 cp = vec3(0, 1.0, 0.);// camera up
    vec3 cu = normalize(cross(cw, cp));// camera u
    vec3 cv = normalize(cross(cu, cw));// camera v
    return mat3(cu, cv, cw);
  }

  void main() {
    TIME = time;

    vec2 p = (gl_FragCoord.xy-0.5*resolution.xy)/min(resolution.x, resolution.y);
    RUV = p;

    float ang = 0.6;
    vec3 ro = vec3(cos(ang), 0.0, sin(ang)) * 10.; // camera pos
    ro.y = 15.;

    vec3 tar = vec3(0.); // eye target

    vec3 rd_orth = normalize(tar - ro);// ray direction via orthographic projection

    mat3 cam = lookAt(rd_orth, tar, 0.0);
    vec3 ro_orth = ro + cam * vec3(p * 10., 0.);// ray origin

    // rendering
    vec3 col = render(ro_orth, rd_orth);

    gl_FragColor = vec4(col, 1.0);
  }
`);

const sketch = ({ gl, canvas, update }) => {
  const { background, foreground } = colors();
  const mouse = createMouse(canvas);

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      mouse: () => mouse.position,
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
