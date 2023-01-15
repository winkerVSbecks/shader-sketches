const canvasSketch = require('canvas-sketch');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../utils/mouse');
const createRegl = require('regl');
var mat4 = require('gl-mat4');
const createCamera = require('perspective-camera');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  // duration: 2,
};

/**
 * https://tympanus.net/codrops/2019/09/24/crafting-stylised-mouse-trails-with-ogl/
 * https://github.com/regl-project/regl/blob/gh-pages/example/line.js
 * https://github.com/mattdesl/canvas-sketch/blob/24f6bb2bbdfdfd72a698a0b8a0962ad843fb7688/examples/animated-regl-dither-blob.js
 */
const vert = glsl(/* glsl */ `
  precision highp float;

  attribute vec3 position;

  attribute vec3 next;
  attribute vec3 prev;
  attribute vec2 uv;
  attribute float side;
  attribute float offsetScale;

  varying vec2 vUv;
  uniform vec2 resolution;

  uniform float DPR;
  uniform float thickness;
  uniform int miter;

  uniform mat4 projection, view, model;
  uniform float scale;
  uniform vec2 offset;
  uniform float tick;
  uniform float phase;
  uniform float freq;

  // vec4 getPosition() {
  //   vec2 aspect = vec2(resolution.x / resolution.y, 1);
  //   vec2 nextScreen = next.xy * aspect;
  //   vec2 prevScreen = prev.xy * aspect;

  //   vec2 tangent = normalize(nextScreen - prevScreen);
  //   vec2 normal = vec2(-tangent.y, tangent.x);
  //   normal /= aspect;
  //   normal *= 0.1;

  //   vec4 current = vec4(position, 1);
  //   current.xy -= normal * side;
  //   return current;
  // }


  // vec4 getPosition() {
  //     mat4 mvp = projection * view;
  //     vec4 current = mvp * vec4(position, 1);
  //     vec4 nextPos = mvp * vec4(next, 1);
  //     vec4 prevPos = mvp * vec4(prev, 1);
  //     vec2 aspect = vec2(resolution.x / resolution.y, 1);
  //     vec2 currentScreen = current.xy / current.w * aspect;
  //     vec2 nextScreen = nextPos.xy / nextPos.w * aspect;
  //     vec2 prevScreen = prevPos.xy / prevPos.w * aspect;

  //     vec2 dir1 = normalize(currentScreen - prevScreen);
  //     vec2 dir2 = normalize(nextScreen - currentScreen);
  //     vec2 dir = normalize(dir1 + dir2);

  //     vec2 normal = vec2(-dir.y, dir.x);
  //     normal /= mix(1.0, max(0.3, dot(normal, vec2(-dir1.y, dir1.x))), miter);
  //     normal /= aspect;
  //     float pixelWidthRatio = 1.0 / (resolution.y / DPR);
  //     float pixelWidth = current.w * pixelWidthRatio;
  //     normal *= pixelWidth * thickness;
  //     // current.xy -= normal * side;

  //     return current;
  // }

  vec4 getPosition() {
    float aspect = resolution.x / resolution.y;
    vec2 aspectVec = vec2(aspect, 1.0);
    mat4 projViewModel = projection * view * model;
    vec4 prevProjected = projViewModel * vec4(prev, 1.0);
    vec4 currProjected = projViewModel * vec4(position, 1.0);
    vec4 nextProjected = projViewModel * vec4(next, 1.0);
    // get 2D screen space with W divide and aspect correction
    vec2 prevScreen = prevProjected.xy / prevProjected.w * aspectVec;
    vec2 currScreen = currProjected.xy / currProjected.w * aspectVec;
    vec2 nextScreen = nextProjected.xy / nextProjected.w * aspectVec;
    float len = thickness;
    // starting point uses (next - current)
    vec2 dir = vec2(0.0);
    if (currScreen == prevScreen) {
      dir = normalize(nextScreen - currScreen);
    }
    // ending point uses (current - previous)
    else if (currScreen == nextScreen) {
      dir = normalize(currScreen - prevScreen);
    }
    // somewhere in middle, needs a join
    else {
      // get directions from (C - B) and (B - A)
      vec2 dirA = normalize((currScreen - prevScreen));
      if (miter == 1) {
        vec2 dirB = normalize((nextScreen - currScreen));
        // now compute the miter join normal and length
        vec2 tangent = normalize(dirA + dirB);
        vec2 perp = vec2(-dirA.y, dirA.x);
        vec2 miter = vec2(-tangent.y, tangent.x);
        dir = tangent;
        len = thickness / dot(miter, perp);
      } else {
        dir = dirA;
      }
    }
    vec2 normal = vec2(-dir.y, dir.x) * thickness;
    normal.x /= aspect;
    vec4 offset = vec4(normal * offsetScale, 0.0, 1.0);
    return currProjected + offset;
  }

  void main () {
    //push the point along its normal by half thickness
    gl_Position = getPosition();
    // vec2 p = position.xy + vec2(normal * thickness/2.0 * miter);
    // gl_Position = projection * vec4(p, 0.0, 1.0);
  }
`);

const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  uniform vec2 mouse;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec2 resolution;
  varying vec2 vUv;

  void main () {
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    // vec2 p = -1.0 + 2.0 * vUv;
    // vec3 color = 0.5 + 0.5 * cos(time + vUv.xyx + background - foreground);
    // gl_FragColor = vec4(color, 1.0);
    // gl_FragColor = gl_FragCoord;
  }
`);

const geometry = {
  polarCurve(buffer, howMany, polarFn) {
    const thetaMax = Math.PI * 2;
    for (let i = 0; i < howMany; i++) {
      const theta = (i / (howMany - 1)) * thetaMax;
      const radius = polarFn(theta, i);
      const x = Math.cos(theta) * radius;
      const y = Math.sin(theta) * radius;
      buffer.push(x, y, 0);
    }
    return buffer;
  },
};

const links = {
  lineMesh(buffer, howMany, index) {
    for (let i = 0; i < howMany - 1; i++) {
      const a = index + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      buffer.push(a, b, c, c, b, d);
    }
    return buffer;
  },
};

const buffer = {
  duplicate(buffer, stride, dupScale) {
    if (stride == null) stride = 1;
    if (dupScale == null) dupScale = 1;
    const out = [];
    const component = new Array(stride * 2);
    for (let i = 0, il = buffer.length / stride; i < il; i++) {
      const index = i * stride;
      for (let j = 0; j < stride; j++) {
        const value = buffer[index + j];
        component[j] = value;
        component[j + stride] = value * dupScale;
      }
      // push.apply(out, component);
      out.push(...component);
    }
    return out;
  },

  mapElement(buffer, elementIndex, stride, map) {
    for (let i = 0, il = buffer.length / stride; i < il; i++) {
      const index = elementIndex + i * stride;
      buffer[index] = map(buffer[index], index, i);
    }
    return buffer;
  },

  pushElement(buffer, elementIndex, stride) {
    const component = new Array(stride);
    const ai = elementIndex * stride;
    for (let i = 0; i < stride; i++) {
      component[i] = buffer[ai + i];
    }
    // push.apply(buffer, component);
    buffer.push(...component);
    return buffer;
  },

  unshiftElement(buffer, elementIndex, stride) {
    const component = new Array(stride);
    const ai = elementIndex * stride;
    for (let i = 0; i < stride; i++) {
      component[i] = buffer[ai + i];
    }
    // unshift.apply(buffer, component);
    buffer.unshift(...component);
    return buffer;
  },
};

const sketch = ({ gl, canvas, canvasWidth, canvasHeight }) => {
  const { background, foreground } = colors();
  const mouse = createMouse(canvas);

  const foregroundRGB = [1, 0, 0];
  const backgroundRGBA = [0.1, 0.1, 0.1, 1];
  const regl = createRegl({ gl });

  // Create a perspective camera
  const camera = createCamera({
    fov: (45 * Math.PI) / 180,
  });

  // Place our camera
  camera.translate([0, 0, 60]);
  camera.lookAt([0, 0, 0]);
  camera.update();

  const FLOAT_BYTES = Float32Array.BYTES_PER_ELEMENT;

  const POINTS = 200;
  const POINTS_TOTAL = POINTS + 2;
  const curve = geometry.polarCurve([], POINTS, (t) => Math.sin(2.5 * t) * 20);

  const positions = curve.slice();
  buffer.mapElement(positions, 2, 3, (v, a, i) => (i / POINTS - 0.5) * 20);
  buffer.pushElement(positions, 0, 3);
  buffer.unshiftElement(positions, POINTS - 1, 3);

  const offset = new Array(POINTS).fill(1).map((v, i) => (i + 1) / POINTS);

  const positionsDupSource = new Float32Array(buffer.duplicate(positions, 3));
  const positionsDup = new Float32Array(positionsDupSource);
  const offsetDup = buffer.duplicate(offset, 1, -1);
  const indices = links.lineMesh([], POINTS, 0);

  // prettier-ignore
  // var positionBuffer = regl.buffer([
  //   [ 0, -1, 0],
  //   [-1, -1, 0],
  //   [-1,  1, 0],
  //   [ 1,  1, 0],
  //   [ 1, -1, 0],
  //   [ 0, -1, 0],
  // ]);
  // var positionBuffer = regl.buffer({
  //   size: 6,
  //   data: [
  //     [0, -1, 0],
  //     [-1, -1, 0],
  //     [-1, 1, 0],
  //     [1, 1, 0],
  //     [1, -1, 0],
  //     [0, -1, 0],
  //   ]
  // });

  const positionBuffer = regl.buffer({
    usage: 'dynamic',
    type: 'float',
    length: POINTS_TOTAL * 2 * 3 * FLOAT_BYTES,
  });

  const offsetBuffer = regl.buffer({
    usage: 'static',
    type: 'float',
    length: POINTS_TOTAL * 2 * 1 * FLOAT_BYTES,
    data: offsetDup,
  });

  const elements = regl.elements({
    primitive: 'triangles',
    usage: 'static',
    type: 'uint16',
    data: indices,
  });

  const drawMesh = regl({
    vert,
    frag,
    uniforms: {
      projection: camera.projection,
      view: camera.view,
      model: mat4.identity([]),
      resolution: [canvasWidth, canvasHeight],
      time: regl.prop('time'),
      tick: ({ playhead }) => playhead,
      mouse: () => mouse.position,
      background,
      foreground,
      DPR: 1,
      thickness: 1,
      miter: 1,
      scale: 0.25,
      phase: 0.0,
      offset: [-0.7, 0.0],
      freq: 0.01,
    },
    attributes: {
      prev: {
        buffer: positionBuffer,
        offset: 0,
        stride: FLOAT_BYTES * 3,
      },
      position: {
        buffer: positionBuffer,
        offset: FLOAT_BYTES * 3 * 2,
        stride: FLOAT_BYTES * 3,
      },
      next: {
        buffer: positionBuffer,
        offset: FLOAT_BYTES * 3 * 4,
        stride: FLOAT_BYTES * 3,
      },
      offsetScale: offsetBuffer,
    },
    elements,
  });

  return ({ viewportWidth, viewportHeight, time, frame }) => {
    buffer.mapElement(positionsDup, 2, 3, (v, a, i) => {
      const start = positionsDupSource[a];
      const offset = Math.sin(frame * 0.05 + Math.floor(i / 2) * 0.1) * 5;
      return start + offset;
    });
    positionBuffer.subdata(positionsDup, 0);

    regl.poll();

    regl.clear({
      color: backgroundRGBA,
      depth: 1,
      stencil: 0,
    });

    camera.viewport = [0, 0, viewportWidth, viewportHeight];
    camera.update();

    drawMesh({
      projectionMatrix: camera.projection,
      modelViewMatrix: camera.view,
      time,
    });
  };
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
