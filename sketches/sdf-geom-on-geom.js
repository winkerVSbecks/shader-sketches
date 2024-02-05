const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');
const createMouse = require('../utils/mouse');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  uniform vec2 mouse;
  uniform vec3 background;
  uniform vec3 foreground;
  varying vec2 vUv;

  #define MAX_STEPS 100
  #define MAX_DIST 100.
  #define SURF_DIST .001
  #define TAU 6.283185
  #define PI 3.141592
  #define S smoothstep
  #define T iTime

  mat2 Rot(float a) {
      float s=sin(a), c=cos(a);
      return mat2(c, -s, s, c);
  }

  float sdBox(vec3 p, vec3 s) {
      p = abs(p)-s;
    return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
  }

  float sdCapsule( vec3 p, vec3 a, vec3 b, float r ) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
  }

  vec4 inverseStereographic(vec3 p, out float k) {
    k = 2.0/(1.0+dot(p,p));
    return vec4(k*p,k-1.0);
  }

  float sdSphere( vec3 p, float s ) {
    return length(p)-s;
  }

  float sdCircle( vec2 p, float r ) { return length(p) - r; }

  // Calculate position of a small sphere on the larger sphere's surface
  vec3 calculateSmallSphereCenter(int index, int total, float radius) {
    float phi = acos(1.0 - 2.0 * float(index + 1) / float(total + 1));
    float theta = PI * (1.0 + pow(5.0, 0.5)) * float(index);

    vec3 pos;
    pos.x = radius * sin(phi) * cos(theta);
    pos.y = radius * sin(phi) * sin(theta);
    pos.z = radius * cos(phi);

    return pos;
  }

  vec2 getSphericalUV(vec3 p) {
    float u = atan(p.y, p.x) / (2.0 * PI) + 0.5;
    float v = asin(p.z / length(p)) / PI + 0.5;
    return vec2(u, v);
  }

  // vec2 getSphericalUV(in vec3 pos) {
  //   vec3 posLocal = pos;
  //   float longitudeAngle = atan(posLocal.x/posLocal.z)/3.1415926*180.0;
  //   float latitudeAngle = acos(posLocal.y/2.)/3.1415926*180.0;
  //   return vec2(longitudeAngle,latitudeAngle);
  // }


  float smax(float a, float b, float r) {
    vec2 u = max(vec2(r + a,r + b), vec2(0));
    return min(-r, max (a, b)) + length(u);
  }

  float GetDist(vec3 p) {
    float d = sdSphere(p, 2.);// sdCapsule(p, vec3(0,0,0), vec3(1,1,1), .5);
    // vec2 uv = getSphericalUV(p);

    // // Place smaller spheres on the surface using UV coordinates
    // // p = vec3(uv * 20., d);
    // d = length(uv) - .4;
    // d = smax(d, abs(p.z) - .013, .01);
    // // d = min(d, sdSphere(p - smallSphereCenter, .25));

    // Logic to place smaller spheres on the surface
    // For example, using a loop to add smaller spheres based on some pattern
    for(int i = 0; i < 20; i++) {
      vec3 smallSphereCenter = calculateSmallSphereCenter(i, 20, 2.);
      d = min(d, sdSphere(p - smallSphereCenter, .25));
    }

    return d;
  }

  float RayMarch(vec3 ro, vec3 rd) {
    float dO=0.;

      for(int i=0; i<MAX_STEPS; i++) {
        vec3 p = ro + rd*dO;
          float dS = GetDist(p);
          dO += dS;
          if(dO>MAX_DIST || abs(dS)<SURF_DIST) break;
      }

      return dO;
  }

  vec3 GetNormal(vec3 p) {
      vec2 e = vec2(.001, 0);
      vec3 n = GetDist(p) -
          vec3(GetDist(p-e.xyy), GetDist(p-e.yxy),GetDist(p-e.yyx));

      return normalize(n);
  }

  vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
      vec3
          f = normalize(l-p),
          r = normalize(cross(vec3(0,1,0), f)),
          u = cross(f,r),
          c = f*z,
          i = c + uv.x*r + uv.y*u;
      return normalize(i);
  }

  void main () {
    vec2 p = (-1.0 + 2.0 * vUv);

    vec3 ro = vec3(0, 3, -3);
    ro.yz *= Rot(-mouse.y*PI+1.);
    ro.xz *= Rot(-mouse.x*TAU);

    vec3 rd = GetRayDir(p, ro, vec3(0,0.,0), 1.);
    vec3 col = background;

    float d = RayMarch(ro, rd);

    if(d<MAX_DIST) {
        vec3 p = ro + rd * d;
        vec3 n = GetNormal(p);
        vec3 r = reflect(rd, n);

        float dif = dot(n, normalize( vec3(1,2,3) ))*.5+.5;
        col = dif * foreground;
    }

    col = pow(col, vec3(.4545));	// gamma correction

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
      time: ({ time }) => time,
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
