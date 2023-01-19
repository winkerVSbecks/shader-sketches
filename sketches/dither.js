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
  // duration: 1,
};

// https://www.shadertoy.com/view/3l2fz3
// https://www.shadertoy.com/view/ll2SWW
const frag = glsl(/* glsl */ `
  precision highp float;

  #define PIXEL_SIZE 4.0
  #define PI 3.14159265359

  uniform float time;
  varying vec2 vUv;
  uniform vec2 resolution;
  uniform vec3 background;
  uniform vec3 foreground;

  bool getValue(float brightness, vec2 pos) {
    // do the simple math first
    if (brightness > 16.0/17.0) return false;
    if (brightness < 01.0/17.0) return true;

    vec2 pixel = floor(mod((pos.xy+0.5)/PIXEL_SIZE, 4.0));
    int x = int(pixel.x);
    int y = int(pixel.y);
    bool result = false;

    // compute the 16 values by hand, store when it's a match
    if (x == 0 && y == 0) result = brightness < 16.0/17.0;
    else if (x == 2 && y == 2) result = brightness < 15.0/17.0;
    else if (x == 2 && y == 0) result = brightness < 14.0/17.0;
    else if (x == 0 && y == 2) result = brightness < 13.0/17.0;
    else if (x == 1 && y == 1) result = brightness < 12.0/17.0;
    else if (x == 3 && y == 3) result = brightness < 11.0/17.0;
    else if (x == 3 && y == 1) result = brightness < 10.0/17.0;
    else if (x == 1 && y == 3) result = brightness < 09.0/17.0;
    else if (x == 1 && y == 0) result = brightness < 08.0/17.0;
    else if (x == 3 && y == 2) result = brightness < 07.0/17.0;
    else if (x == 3 && y == 0) result = brightness < 06.0/17.0;
    else if (x == 0 && y == 1) result =	brightness < 05.0/17.0;
    else if (x == 1 && y == 2) result = brightness < 04.0/17.0;
    else if (x == 2 && y == 3) result = brightness < 03.0/17.0;
    else if (x == 2 && y == 1) result = brightness < 02.0/17.0;
    else if (x == 0 && y == 3) result = brightness < 01.0/17.0;

    return result;
  }

  mat2 rot(in float a) {
    return mat2(cos(a),sin(a),-sin(a),cos(a));
  }

  float de(vec3 p) {
    float de = 0.0;
    // sphere
    de += length(p) - 5.0;
    // wobble
    de += (sin(p.x*3.0424+time * 1.9318)*.5+.5)*0.3;
    de += (sin(p.y*2.0157+time * 1.5647)*.5+.5)*0.4;
    return de;
  }

  // normal function
  vec3 normal(vec3 p) {
    vec3 e = vec3(0.0, 0.001, 0.0);
    return normalize(vec3(
      de(p+e.yxx)-de(p-e.yxx),
      de(p+e.xyx)-de(p-e.xyx),
      de(p+e.xxy)-de(p-e.xxy)));
  }

  void main () {
    vec2 uv = (-1.0 + 2.0 * vUv);
	  uv.y *= resolution.y / resolution.x;

    vec3 from = vec3(-50, 0, 0);
    vec3 dir = normalize(vec3(uv*0.2, 1.0));
    dir.xz *= rot(PI * .5);

    float mindist = 100000.0;
    float totDist = 0.0;
    bool set = false;
    vec3 norm = vec3(0);

    vec3 light = normalize(vec3(1.0, -3.0, 2.0));

    for (int steps = 0 ; steps < 100 ; steps++) {
      if (set) continue;
      vec3 p = from + totDist * dir;
      float dist = max(min(de(p), 1.0), 0.0);

      mindist = min(dist, mindist);

      totDist += dist;
      if (dist < 0.01) {
        set = true;
        norm = normal(p);
      }
    }

    if (set) {
      gl_FragColor = vec4(vec3(getValue( dot(light, norm)*.5+.5, gl_FragCoord.xy)), 1.0);
    } else {
      // add an edge around the object
      if (mindist < 0.25) gl_FragColor = vec4(vec3(0.0), 1.0);
      else {
        // do some whatever background with dithering as well
        vec2 pos = gl_FragCoord.xy - resolution.xy * 0.5;

        vec2 dir = vec2(0.0, 1.0)*rot(sin(time*0.4545)*0.112);
        float value = sin(dot(pos, dir)*0.048-time*1.412)*0.5+0.5;

        gl_FragColor = vec4(vec3(getValue(value, pos)), 1.0);
      }
    }
  }
`);

// Your sketch, which simply returns the shader
const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
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
