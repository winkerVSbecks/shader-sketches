precision highp float;

uniform float time;
uniform float playhead;
uniform vec2  resolution;

#define PI 3.14159265359

vec2 doModel(vec3 p);

#pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
#pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
#pragma glslify: camera = require('glsl-turntable-camera')

float superFormula( float phi, float m, float n1, float n2, float n3, float a, float b ){
	float t1 = abs((1.0 / a) * cos(m * phi / 4.0));
	t1 = pow(t1, n2);

	float t2 = abs((a / b) * sin(m * phi / 4.0));
	t2 = pow(t2, n3);

	float t3 = t1 + t2;

	float r = pow(t3, -1.0 / n1);

	return r;
}

float supershape(vec3 p) {
  float d = length(p);

  float theta = atan(p.y / p.x);
  float phi = asin(p.z / d);

  float r1=superFormula(theta, 8.0, 60.0, 100.0, 30.0, 1.0, 1.0);
  float r2=superFormula(phi, 2.0, 10.0, 10.0, 10.0, 1.0, 1.0);

  // float r1=SuperFormula(phi,0.75+0.25*sin(time),1.0,S1.x,S1.y,S1.z,S1.w);
	// float r2=SuperFormula(rho,1.0,1.0,S2.x,S2.y,S2.z,S2.w);//the radii

  vec3 q = r2 * vec3(r1 * cos(theta) * cos(phi), r1 * sin(theta) * cos(phi), sin(phi));
  d = d - length(q);

  return d;

}

vec2 doModel(vec3 p) {
  float id = 0.0;
  float d  = supershape(p);

  return vec2(d, id);
}

void main() {
  vec3 color = vec3(0.0);
  vec3 ro, rd;

  float rotation = 2. * PI * playhead;
  float height   = 0.0;
  float dist     = 8.0;
  camera(rotation, height, dist, resolution.xy, ro, rd);

  vec2 t = raytrace(ro, rd, 20.0, 0.005);
  if (t.x > -0.5) {
    vec3 pos = ro + rd * t.x;
    vec3 nor = normal(pos);

    color = nor * 0.5 + 0.5;
  }

  gl_FragColor = vec4(color, 1.0);
}