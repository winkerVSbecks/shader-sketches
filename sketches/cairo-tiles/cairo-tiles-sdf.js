const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../../utils/mouse');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 4,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359
  #define TAU 6.283185

  vec2 doModel(vec3 p);

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')
  #pragma glslify: smin = require('glsl-smooth-min')
  #pragma glslify: combine = require('glsl-combine-smooth')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')

  uniform float time;
  uniform float playhead;
  uniform vec2  resolution;
  uniform vec2  mouse;
  uniform vec3  background;
  uniform vec3  foreground;

  mat2 rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
  }

  float sdCappedCylinder(vec3 p, vec3 a, vec3 b, float r) {
    vec3  ba = b - a;
    vec3  pa = p - a;
    float baba = dot(ba,ba);
    float paba = dot(pa,ba);
    float x = length(pa*baba-ba*paba) - r*baba;
    float y = abs(paba-baba*0.5)-baba*0.5;
    float x2 = x*x;
    float y2 = y*y*baba;
    float d = (max(x,y)<0.0)?-min(x2,y2):(((x>0.0)?x2:0.0)+((y>0.0)?y2:0.0));
    return sign(d)*sqrt(abs(d))/baba;
  }

  float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
  }

  vec2 doModel(vec3 p) {
    vec3 q = p;

    vec2 id = floor(p.xy);
    float check = mod(id.x + id.y, 2.);

    q.z = q.z + sin(time * PI + (q.x + q.y) * PI * 0.01) * 0.1;
    q.xy = fract(p.xy);
    q.xy = -1. + 2. * q.xy;

    // rotate every other tile
    if(check == 1.) q.xy = q.yx;

    q.xy = abs(q.xy);

    // float k = sin(PI * time); // 0 - 1
    // float a = (k*.25+.5);
    float a = .5;

    float d1 = sdCapsule(q, vec3(a, 0., 0.), vec3(1., 1., 0.), 0.15);
    float d2 = sdCapsule(q, vec3(0., 0., 0.), vec3(a, 0., 0.), 0.15);

    float d = smin(d1, d2, 0.01) * 0.2;

    return vec2(d, 0.0);
  }

  void main() {
    vec3 color = vec3(background);

    float cameraAngle  = 0.;
    vec3 ro = vec3(1, 5, 5);
    vec3 rt = vec3(0, 0, 0);
    vec2 screenPos = square(resolution.xy);
    float lensLength = 1.0;

    ro.yz *= rot(mouse.y * PI+1.);
    ro.xz *= rot(mouse.x * TAU);

    vec3 rd = camera(ro, rt, screenPos, lensLength);

    // vec2 t = raytrace(ro, rd, 100.0, 0.1);
    vec2 t = raytrace(ro, rd);
    vec3 lp = vec3(1, 1, 1);

    if (t.x > -0.5) {
      vec3 pos = ro + rd * t.x;
      vec3 nor = normal(pos);
      // color = (nor * 0.5 + 0.5) * foreground;

      vec3 ed = normalize(ro - pos);
      vec3 ld = normalize(lp - pos);

      // basic blinn phong lighting
      float power = blinnPhongSpec(ld, ed, nor, 0.1);
      color = vec3(power) * foreground;
    }

    gl_FragColor = vec4(color, 1.0);
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
