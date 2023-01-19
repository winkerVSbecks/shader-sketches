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
  duration: 8,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #define PIXEL_SIZE 4.0
  #define PI 3.14159265359

  uniform float time;
  uniform float duration;
  uniform float playhead;
  varying vec2 vUv;
  uniform vec2 resolution;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec3 boxSize;

  float cycle = duration / 5.;

  struct Block {
    vec3 p1;
    vec3 p2;
    vec3 p3;
    vec3 p4;
  };

  Block oBlock = Block(
    vec3(0.25, 0.25, 0.),
    vec3(-0.25, 0.25, 0.),
    vec3(0.25, -0.25, 0.),
    vec3(-0.25, -0.25, 0.)
  );

  Block zBlock = Block(
    vec3(0.0, 0.25, 0.0),
    vec3(-0.5, 0.25, 0.0),
    vec3(0.5, -0.25, 0.0),
    vec3(0.0, -0.25, 0.0)
  );

  Block tBlock = Block(
    vec3(0.0, 0.25, 0.0),
    vec3(-0.5, 0.25, 0.0),
    vec3(0.5, 0.25, 0.0),
    vec3(0.0, -0.25, 0.0)
  );

  Block lBlock = Block(
    vec3(0.0, 0.25, 0.0),
    vec3(-0.5, 0.25, 0.0),
    vec3(0.5, 0.25, 0.0),
    vec3(-0.5, -0.25, 0.0)
  );

  Block iBlock = Block(
    vec3(0.5, 0.0, 0.0),
    vec3(0.0, 0.0, 0.0),
    vec3(1.0, 0.0, 0.0),
    vec3(-0.5, 0.0, 0.0)
  );

  vec3 p1 = iBlock.p1;
  vec3 p2 = iBlock.p2;
  vec3 p3 = iBlock.p3;
  vec3 p4 = iBlock.p4;

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


  float EaseOutQuad(float x) {
    return 1.0 - (1.0-x) * (1.0 -x );
  }

  float EaseOutQuart(float x) { return 1.0 - pow(1.0 -x, 4.0); }

  float mapRange(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  float sdRoundBox( vec3 p, vec3 b, float r ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  mat4 rotation3d(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat4(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                                0.0,                                0.0,                                1.0
    );
  }

  float opUnion( float d1, float d2 ) { return min(d1, d2); }

  float block(in vec3 pos, in float r) {
    float d1 = sdRoundBox(pos + p1, boxSize, r);
    float d2 = sdRoundBox(pos + p2, boxSize, r);
    float d3 = sdRoundBox(pos + p3, boxSize, r);
    float d4 = sdRoundBox(pos + p4, boxSize, r);

    return opUnion(opUnion(d1, d2), opUnion(d3, d4));
  }

  float de(vec3 pos) {
    float scale = 8.;
    pos = pos/scale;
    float d = 1e10;
    float r = 0.0125;

    float angle = playhead * 2. * PI;
    pos.xyz = (rotation3d(vec3(0., 1., 0.), angle) * vec4(pos, 1.0)).xyz;
    d = block(pos, r);

    return d * scale;
  }

  // float de(vec3 p) {
  //   float de = 0.0;
  //   // sphere
  //   de += length(p) - 5.0;
  //   // wobble
  //   de += (sin(p.x*3.0424+time * 1.9318)*.5+.5)*0.3;
  //   de += (sin(p.y*2.0157+time * 1.5647)*.5+.5)*0.4;
  //   return de;
  // }

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

    float cycleTime = fract(time / cycle);
    float at = EaseOutQuart(min(1., mapRange(cycleTime, 0., 0.5, 0., 1.)));

    if (time < duration * 0.2) {
      p1 = mix(iBlock.p1, oBlock.p1, at);
      p2 = mix(iBlock.p2, oBlock.p2, at);
      p3 = mix(iBlock.p3, oBlock.p3, at);
      p4 = mix(iBlock.p4, oBlock.p4, at);
    } else if (time < duration * 0.4) {
      p1 = mix(oBlock.p1, zBlock.p1, at);
      p2 = mix(oBlock.p2, zBlock.p2, at);
      p3 = mix(oBlock.p3, zBlock.p3, at);
      p4 = mix(oBlock.p4, zBlock.p4, at);
    } else if (time < duration * 0.6) {
      p1 = mix(zBlock.p1, tBlock.p1, at);
      p2 = mix(zBlock.p2, tBlock.p2, at);
      p3 = mix(zBlock.p3, tBlock.p3, at);
      p4 = mix(zBlock.p4, tBlock.p4, at);
    } else if (time < duration * 0.8) {
      p1 = mix(tBlock.p1, lBlock.p1, at);
      p2 = mix(tBlock.p2, lBlock.p2, at);
      p3 = mix(tBlock.p3, lBlock.p3, at);
      p4 = mix(tBlock.p4, lBlock.p4, at);
    } else if (time < duration * 1.0) {
      p1 = mix(lBlock.p1, iBlock.p1, at);
      p2 = mix(lBlock.p2, iBlock.p2, at);
      p3 = mix(lBlock.p3, iBlock.p3, at);
      p4 = mix(lBlock.p4, iBlock.p4, at);
    }

    vec3 from = vec3(-50, 0, 0);
    vec3 dir = normalize(vec3(uv*0.2, 1.0));
    dir.xz *= rot(PI * .5);

    vec2 mouse = vec2(1., 0.);

    mat2 rotxz = rot(mouse.x*5.0);
    mat2 rotxy = rot(0.3 - mouse.y*5.0);

    from.xy *= rotxy;
    from.xz *= rotxz;
    dir.xy  *= rotxy;
    dir.xz  *= rotxz;

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
      if (mindist < 0.125) gl_FragColor = vec4(vec3(0.0), 1.0);
      else {
        // do some whatever background with dithering as well
        vec2 pos = gl_FragCoord.xy - resolution.xy * 0.5;

        // vec2 dir = vec2(0.0, 1.0)*rot(sin(time*0.4545)*0.112);
        // float value = sin(dot(pos, dir)*0.048-time*1.412)*0.5+0.5;

        vec2 dir = vec2(0.0, 1.0) * rot(0.112);
        float value = sin(dot(pos, dir) * 0.0048 - time*1.412)*0.5 + 0.5;

        gl_FragColor = vec4(vec3(getValue(value, pos)), 1.0);
        // gl_FragColor = vec4(1.0);
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
      playhead: ({ playhead }) => playhead,
      duration: ({ duration }) => duration,
      boxSize: [0.25, 0.25, 0.25],
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
