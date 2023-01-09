const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const glsl = require('glslify');
const tome = require('chromotome');
const THREE = require('three');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8,
};

const palettes = [
  'spatial02',
  'spatial03i',
  'ducci_f',
  'rohlfs_2',
  'ducci_d',
  'revolucion',
  'butterfly',
  'floratopia',
  'ducci_i',
  'spatial02i',
];

function colors(minContrast = 3) {
  let palette = tome.get(Random.pick(palettes));
  if (!palette.background) palette = tome.get();

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) => Color.contrastRatio(background, color) >= minContrast
  );

  const stroke = palette.stroke === background ? null : palette.stroke;

  const foreground = stroke || Random.pick(colors);

  return {
    name: palette.name,
    background,
    foreground,
  };
}

const frag = glsl(/*glsl*/ `
  precision highp float;

  struct Block {
    vec3 loc;
    vec3 nLoc;
    int shape;
    int nShape;
    vec3 col;
  };

  uniform float time;
  uniform float playhead;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform float size;
  varying vec2 vUv;

  uniform Block block1;
  uniform Block block2;
  uniform Block block3;
  uniform Block block4;
  uniform Block block5;
  uniform Block block6;
  uniform Block block7;
  uniform Block block8;


  #define PI 3.14159265359

  // Utils
  float mapRange(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  float EaseOutQuart(float x) { return 1.0 - pow(1.0 -x, 4.0); }

  // Operations
  mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
  }

  float opUnion( float d1, float d2 ) { return min(d1, d2); }
  float opSmoothUnion( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
  }

  // SDF Shapes
  float sdBox( vec3 p, vec3 b, float r ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  float sdCylinder(vec3 p, float ra, float rb, float h) {
    p.yz = rotate2d(PI / 2.) * p.yz;
    vec2 d = vec2( length(p.xz)-2.0*ra+rb, abs(p.y) - h );
    return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - rb;
  }

  float sdHexPrism( vec3 p, vec2 h, float r ) {
    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
    vec2 d = vec2(
        length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x), h.x))*sign(p.y-h.x),
        p.z-h.y );
    return min(max(d.x,d.y),0.0) + length(max(d,0.0)) - r;
  }

  float sdTriPrism( vec3 p, vec2 h, float r ) {
    vec3 q = abs(p);
    return max(q.z-h.y,max(q.x*0.866025+p.y*0.5,-p.y)-h.x*0.5) - r;
  }

  float block(in int type, in vec3 pos) {
    float r = 0.0125;

    if (type == 0) return sdBox(pos, vec3(size), r);
    else if (type == 1) return sdCylinder(pos, size, r, size);
    else if (type == 2) return sdHexPrism(pos, vec2(size), r);
    else if (type == 3) return sdTriPrism(pos, vec2(size), r);
    return 0.;
  }

  float map(in vec3 pos) {
    float cycleTime = fract(time);
    // float at = EaseOutQuart(cycleTime);
    float at = EaseOutQuart(min(1., mapRange(cycleTime, 0., 0.75, 0., 1.)));

    float d = 1e10;
    float r = 0.0125;

    // float angle = playhead * 2. * PI;
    // pos.xz = rotate2d(angle) * pos.xz;

    d = block(block1.shape, pos + mix(block1.loc, block1.nLoc, at));
    d = min(d, block(block2.shape, pos + mix(block2.loc, block2.nLoc, at)));
    d = min(d, block(block3.shape, pos + mix(block3.loc, block3.nLoc, at)));
    d = min(d, block(block4.shape, pos + mix(block4.loc, block4.nLoc, at)));
    d = min(d, block(block5.shape, pos + mix(block5.loc, block5.nLoc, at)));
    d = min(d, block(block6.shape, pos + mix(block6.loc, block6.nLoc, at)));
    d = min(d, block(block7.shape, pos + mix(block7.loc, block7.nLoc, at)));
    d = min(d, block(block8.shape, pos + mix(block8.loc, block8.nLoc, at)));

    return d;
  }

  // https://iquilezles.org/articles/rmshadows
  float calcSoftshadow(in vec3 ro, in vec3 rd, float tmin, float tmax, const float k) {
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 64; i++) {
      float h = map(ro + rd * t);
      res = min(res, k * h / t);
      t += clamp(h, 0.01, 0.10);
      if (res < 0.002 || t > tmax)
        break;
    }
    return clamp(res, 0.0, 1.0);
  }

  // https://iquilezles.org/articles/normalsSDF
  vec3 calcNormal(in vec3 pos) {
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    const float eps = 0.0005;
    return normalize(
        e.xyy * map(pos + e.xyy * eps) + e.yyx * map(pos + e.yyx * eps) +
        e.yxy * map(pos + e.yxy * eps) + e.xxx * map(pos + e.xxx * eps));
  }

  void main() {
    vec3 ro = vec3(1.5, 1.5, 1.5);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    // camera matrix
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));


    vec2 p = (-1.0 + 2.0 * vUv);

    // create view ray
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.5 * ww);

    // raymarch
    const float tmax = 5.0;
    float t = 0.0;
    for (int i = 0; i < 256; i++) {
      vec3 pos = ro + t * rd;
      float h = map(pos);
      if (h < 0.0001 || t > tmax)
        break;
      t += h;
    }

    // shading/lighting
    vec3 col = vec3(0.0);
    if (t < tmax) {
      vec3 pos = ro + t * rd;
      vec3 nor = calcNormal(pos);
      vec3 light = vec3(.57703);
      float dif = clamp(dot(nor, light), 0.0, 1.0);

      if (dif > 0.001)
        dif *= calcSoftshadow(pos + nor * 0.001, light, 0.001, 1.0, 32.0);

      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      col = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
    }

    // gamma
    col = sqrt(col);
    vec3 tot = mix(background, foreground, col);

    gl_FragColor = vec4(tot, 1.0);
  }
`);

const randomComponent = () =>
  Random.pick([-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]);
const randomDepth = () => Random.pick([-0.5, 0, 0.5]);
const randomLocation = () => [
  randomComponent(),
  randomComponent(),
  randomDepth(),
];
const randomShape = () => Random.rangeFloor(0, 4);

const sketch = ({ gl }) => {
  const { name, background, foreground } = colors();
  console.log({ name, background, foreground });

  const blocks = new Array(8).fill(0).map(() => ({
    locations: new Array(8).fill(0).map(randomLocation),
    shape: randomShape(),
  }));

  blocks.forEach((block) => {
    block.locations.push(block.locations[0]);
  });

  return createShader({
    gl,
    frag,
    uniforms: {
      background: new THREE.Color(background).toArray(),
      foreground: new THREE.Color(foreground).toArray(),
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      size: 0.25,

      'block1.loc': ({ time }) => blocks[0].locations[Math.floor(time)],
      'block1.nLoc': ({ time }) => blocks[0].locations[Math.floor(time) + 1],
      'block1.shape': blocks[0].shape,
      'block1.nShape': 0,
      'block1.col': new THREE.Color(foreground).toArray(),

      'block2.loc': ({ time }) => blocks[1].locations[Math.floor(time)],
      'block2.nLoc': ({ time }) => blocks[1].locations[Math.floor(time) + 1],
      'block2.shape': blocks[1].shape,
      'block2.nShape': 0,
      'block2.col': new THREE.Color(foreground).toArray(),

      'block3.loc': ({ time }) => blocks[2].locations[Math.floor(time)],
      'block3.nLoc': ({ time }) => blocks[2].locations[Math.floor(time) + 1],
      'block3.shape': blocks[2].shape,
      'block3.nShape': 0,
      'block3.col': new THREE.Color(foreground).toArray(),

      'block4.loc': ({ time }) => blocks[3].locations[Math.floor(time)],
      'block4.nLoc': ({ time }) => blocks[3].locations[Math.floor(time) + 1],
      'block4.shape': blocks[3].shape,
      'block4.nShape': 0,
      'block4.col': new THREE.Color(foreground).toArray(),

      'block5.loc': ({ time }) => blocks[4].locations[Math.floor(time)],
      'block5.nLoc': ({ time }) => blocks[4].locations[Math.floor(time) + 1],
      'block5.shape': blocks[4].shape,
      'block5.nShape': 0,
      'block5.col': new THREE.Color(foreground).toArray(),

      'block6.loc': ({ time }) => blocks[5].locations[Math.floor(time)],
      'block6.nLoc': ({ time }) => blocks[5].locations[Math.floor(time) + 1],
      'block6.shape': blocks[5].shape,
      'block6.nShape': 0,
      'block6.col': new THREE.Color(foreground).toArray(),

      'block7.loc': ({ time }) => blocks[6].locations[Math.floor(time)],
      'block7.nLoc': ({ time }) => blocks[6].locations[Math.floor(time) + 1],
      'block7.shape': blocks[6].shape,
      'block7.nShape': 0,
      'block7.col': new THREE.Color(foreground).toArray(),

      'block8.loc': ({ time }) => blocks[7].locations[Math.floor(time)],
      'block8.nLoc': ({ time }) => blocks[7].locations[Math.floor(time) + 1],
      'block8.shape': blocks[7].shape,
      'block8.nShape': 0,
      'block8.col': new THREE.Color(foreground).toArray(),
    },
  });
};

canvasSketch(sketch, settings);
