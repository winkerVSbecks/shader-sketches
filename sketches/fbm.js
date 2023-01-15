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
  duration: 12,
};

// Your glsl code
const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  #define PI 3.141592

  const mat2 m = mat2( 0.80,  0.60, -0.60,  0.80 );

  float noise( in vec2 p ) {
    return sin(p.x)*sin(p.y);
  }

  float fbm4( vec2 p ) {
      float f = 0.0;
      f += 0.5000*noise( p ); p = m*p*2.02;
      f += 0.2500*noise( p ); p = m*p*2.03;
      f += 0.1250*noise( p ); p = m*p*2.01;
      f += 0.0625*noise( p );
      return f/0.9375;
  }

  float fbm6( vec2 p ) {
      float f = 0.0;
      f += 0.500000*(0.5+0.5*noise( p )); p = m*p*2.02;
      f += 0.250000*(0.5+0.5*noise( p )); p = m*p*2.03;
      f += 0.125000*(0.5+0.5*noise( p )); p = m*p*2.01;
      f += 0.062500*(0.5+0.5*noise( p )); p = m*p*2.04;
      f += 0.031250*(0.5+0.5*noise( p )); p = m*p*2.01;
      f += 0.015625*(0.5+0.5*noise( p ));
      return f/0.96875;
  }

  vec2 fbm4_2( vec2 p ) {
      return vec2(fbm4(p), fbm4(p+vec2(7.8)));
  }

  vec2 fbm6_2( vec2 p ) {
      return vec2(fbm6(p+vec2(16.8)), fbm6(p+vec2(11.5)));
  }

  float pattern( vec2 q, out vec4 ron ) {
      q += 0.03*sin( vec2(0.27,0.23)*time + length(q)*vec2(4.1,4.3));

    vec2 o = fbm4_2( 0.9*q );

      o += 0.04*sin( vec2(0.12,0.14)*time + length(o));

      vec2 n = fbm6_2( 3.0*o );

    ron = vec4( o, n );

      float f = 0.5 + 0.5*fbm4( 1.8*q + 6.0*n );

      return mix( f, f*f*f*3.5, f*abs(n.x) );
  }

  void main () {
    vec2 p = (-1.0 + 2.0 * vUv);

    float e = 2.0/vUv.y;

    vec4 on = vec4(0.0);
    float f = pattern(p, on);

	  vec3 color = vec3(0.0);
    color = mix( background, foreground, f );
    // color = mix( color, vec3(0.9,0.9,0.9), dot(on.zw,on.zw) );
    // color = mix( color, vec3(0.4,0.3,0.3), 0.2 + 0.5*on.y*on.y );
    // color = mix( color, vec3(0.0,0.2,0.4), 0.5*smoothstep(1.2,1.3,abs(on.z)+abs(on.w)) );
    // color = clamp( color*f*2.0, 0.0, 1.0 );

    gl_FragColor = vec4(color, 1.0);
  }
`);

// Your sketch, which simply returns the shader
const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
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
