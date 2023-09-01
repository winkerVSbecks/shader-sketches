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

  float sdPlane(vec3 p, vec3 n, float h) {
    // n must be normalized
    return dot(p,n) + h;
  }

  float dot2( in vec2 v ) { return dot(v,v); }
  float dot2( in vec3 v ) { return dot(v,v); }
  float udQuad(vec3 p, vec3 a, vec3 b, vec3 c, vec3 d) {
    vec3 ba = b - a; vec3 pa = p - a;
    vec3 cb = c - b; vec3 pb = p - b;
    vec3 dc = d - c; vec3 pc = p - c;
    vec3 ad = a - d; vec3 pd = p - d;
    vec3 nor = cross( ba, ad );

    return sqrt(
      (sign(dot(cross(ba,nor),pa)) +
      sign(dot(cross(cb,nor),pb)) +
      sign(dot(cross(dc,nor),pc)) +
      sign(dot(cross(ad,nor),pd))<3.0)
      ?
      min( min( min(
      dot2(ba*clamp(dot(ba,pa)/dot2(ba),0.0,1.0)-pa),
      dot2(cb*clamp(dot(cb,pb)/dot2(cb),0.0,1.0)-pb) ),
      dot2(dc*clamp(dot(dc,pc)/dot2(dc),0.0,1.0)-pc) ),
      dot2(ad*clamp(dot(ad,pd)/dot2(ad),0.0,1.0)-pd) )
      :
      dot(nor,pa)*dot(nor,pa)/dot2(nor) );
  }

  // float cairo(vec3 p) {
  //   float a = .5;

  //   // window inner
  //   float t = 0.15;
  //   float f1 = udQuad(p, vec3(1., 1., 0), vec3(a, 0., 0), vec3(-a, 0., 0), vec3(-1., 1., 0)) - 0.1;
  //   float f2 = udQuad(p, vec3(1., -1., 0), vec3(a, 0., 0), vec3(-a, 0., 0), vec3(-1., -1., 0)) - 0.1;
  //   float d = min(f1, f2);

  //   return d;
  // }

  float cairo(vec3 p) {
    float a = .5;

    float d1 = sdCapsule(p, vec3(-1, 1., 0), vec3(-a, 0, 0), 0.15);
    float d2 = sdCapsule(p, vec3(-a, 0, 0), vec3(a, 0, 0), 0.15);
    float d3 = sdCapsule(p, vec3(a, 0, 0), vec3(1, 1, 0), 0.15);
    float d4 = sdCapsule(p, vec3(-1, -1., 0), vec3(-a, 0, 0), 0.15);
    float d5 = sdCapsule(p, vec3(a, 0, 0), vec3(1, -1, 0), 0.15);

    float d = min(d1, d2);
    d = min(d, d3);
    d = min(d, d4);
    d = min(d, d5);

    return d;
  }

  vec2 doModel(vec3 p) {
    vec3 q = p;

    vec2 id = floor(p.xy);
    float check = mod(id.x + id.y, 2.);

    q.xy = fract(p.xy);
    q.xy = -1. + 2. * q.xy;

    // rotate every other tile
    if(check == 1.) q.xy = q.yx;

    float d = cairo(q);

    return vec2(d * 0.5, 0.0);
  }

  void main() {
    vec3 color = vec3(background);

    float cameraAngle  = 0.;
    vec3 ro = vec3(0, 0, 5);
    vec3 rt = vec3(0, 0, 0);
    vec2 screenPos = square(resolution.xy);
    float lensLength = 1.0;

    ro.yz *= rot(PI*0.5 + PI * mouse.y);
    ro.xz *= rot(PI*0.5 + PI * mouse.x);

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
