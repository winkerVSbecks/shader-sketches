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
  // duration: 2,
};

// https://www.shadertoy.com/view/MtSGRt
const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  uniform vec2 mouse;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec2 resolution;
  varying vec2 vUv;

  float atime;

  struct Ray {
    vec3 org;
    vec3 dir;
  };

  vec3 backgroundColor(vec3 dir) {
      float a = atan(dir.y, dir.x);
      float f = dir.z;
      vec3 nadir = vec3(.1,.3,.5);
      vec3 ground = vec3(.1,.6,.2);
      vec3 sky = vec3(1.);
      vec3 zenith = vec3(.0, .0, .2);
      vec3 col = f < 0. ? mix(nadir, ground, f+1.) : mix(sky, zenith, pow(f,.25));
      return col * (5.+sin(a*2.))/6.*2.5;
  }

  vec4 box(vec3 p, float w) {
      p = abs(p);
      float dx = p.x-w;
      float dy = p.y-w;
      float dz = p.z-w;
      float m = max(p.x-w, max(p.y-w, p.z-w));
      return vec4(m,dx,dy,dz);
  }

  mat3 rotateX(float a) {
      return mat3(1.,0.,0.,
                  0.,cos(a), -sin(a),
                  0.,sin(a), cos(a));
  }

  mat3 rotateY(float a) {
      return mat3(cos(a), 0., -sin(a),
                  0.,1.,0.,
                  sin(a), 0., cos(a));
  }

  mat3 rotation;
  float jitter;

  vec4 map(vec3 p) {
      for (int i = 0; i < 5; i++) {
          p = abs(p*rotation + vec3(0.1, .0, .0));
          p.y -= .8;
          p.x -= .06;
          p.z -= jitter;
          p.xy = p.yx;
      }
      return box(p, .6);
  }

  vec3 normal(vec3 pos) {
    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
        map(pos+eps.xyy).x - map(pos-eps.xyy).x,
        map(pos+eps.yxy).x - map(pos-eps.yxy).x,
        map(pos+eps.yyx).x - map(pos-eps.yyx).x );
    return normalize(nor);
  }

  vec3 render(Ray ray) {
      float dist = 0.;
      vec3 pos;
      for (int i = 0; i < 60; i++){
          pos = ray.org + dist*ray.dir;
          dist+=map(pos).x;
      }
      vec4 m = map(pos);
      if (m.x < 0.01){
          vec3 n = normal(pos);
          vec3 l = normalize(vec3(1.,2.,5.));
          vec3 diffuse = clamp(dot(n, l),0., 1.)*vec3(1.);
          vec3 r = reflect(ray.dir, n);
          vec3 refl = backgroundColor(r);
          float dx = m.y;
          float dy = m.z;
          float dz = m.w;
          float start = 0.00;
          float end = 0.05;
          float f = smoothstep(start, end, abs(dx-dy));
          f *= smoothstep(start, end, abs(dx-dz));
          f *= smoothstep(start, end, abs(dz-dy));
          f = 1. - f;
          float rf = 1.-abs(dot(ray.dir, n));
          rf = pow(rf,3.);
          float flash = 1.-fract(atime);
          flash = sqrt(flash);
          return diffuse*(1.-rf)*.8 + flash*f*vec3(2.9, 1.4, 1.2) + refl*rf*1.3;
      }

      return backgroundColor(ray.dir)*0.2;
  }

  Ray createRay(vec3 center, vec3 lookAt, vec3 up, vec2 uv, float fov, float aspect) {
    Ray ray;
    ray.org = center;
    vec3 dir = normalize(lookAt - center);
    up = normalize(up - dir*dot(dir,up));
    vec3 right = cross(dir, up);
    uv = 2.*uv - vec2(1.);
    fov = fov * 3.1415/180.;
    ray.dir = dir + tan(fov/2.) * right * uv.x + tan(fov/2.) / aspect * up * uv.y;
    ray.dir = normalize(ray.dir);
    return ray;
  }

  void main () {
    // vec2 p = -1.0 + 2.0 * vUv;
    vec2 p = gl_FragCoord.xy / resolution.xy;

    vec3 cameraPos = vec3(7.*sin(time/3.),7.*cos(time/3.),-4.*sin(time/8.));
    vec3 lookAt = vec3(0.);
    vec3 up = vec3(0.,0.,1.);
    float aspect = resolution.x/resolution.y;
      float t = floor(time);
      float f = fract(time);
      t += 1. - exp(-f*9.);
      atime = t;
      rotation = rotateX(atime*1.9)*rotateY(atime*1.4);
      jitter = sin(time*80.)*.1*pow((1.-fract(time)),4.);

    Ray ray = createRay(cameraPos, lookAt, up, p, 90., aspect);
      vec3 col = render(ray);
      float vig = p.x*(1.-p.x)*p.y*(1.-p.y)*4.;
      vig = pow(vig,0.3);
      col *= vig;


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
