////////////////////////////////////////////////////////////////////////////////
// Complex Inverse Hyperbolic Tangent
//
// Domain mapping of sums of complex atanh.
// Care needed for alignment across branch cuts.
////////////////////////////////////////////////////////////////////////////////

float A = 7.0, B = 2.0; // Rotation angle is atan(B,A)
float K = 1.0;          // Extra subdivisions
float scale = 1.5;
float PI = 3.14159;

//#define CIRCLE
#define CHECKERBOARD

// Complex functions
vec2 cmul(vec2 z, vec2 w) {
  //return vec2 (z.x*w.x-z.y*w.y, z.x*w.y+z.y*w.x);
  return mat2(z,-z.y,z.x)*w;
}

vec2 cinv(vec2 z) {
  float t = dot(z,z);
  return vec2(z.x,-z.y)/t;
}

vec2 cdiv(vec2 z, vec2 w) {
  return cmul(z,cinv(w));
}

vec2 clog(vec2 z) {
  float r = length(z);
  return vec2(log(r),atan(z.y,z.x));
}

// Inverse hyperbolic tangent
vec2 catanh(vec2 z) {
  return 0.5*clog(cdiv(vec2(1,0)+z,vec2(1,0)-z));
}

// Iq's hsv function, but just for hue.
vec3 h2rgb(float h ) {
  vec3 rgb = clamp( abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
  rgb = rgb*rgb*(3.0-2.0*rgb); // cubic smoothing
  return 0.2+0.8*rgb;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  vec2 z = (2.0*fragCoord-iResolution.xy)/iResolution.y;
  z *= scale;
  if (iMouse.x > 0.0) {
    // Get angle from mouse position
    vec2 m = (2.0*iMouse.xy-iResolution.xy)/iResolution.y;
    m *= 20.0;
    A = floor(m.x), B = floor(m.y);
  }
  //float theta = atan(B,A);
  //vec2 rot = vec2(cos(theta),sin(theta));
  vec2 rot = vec2(A,B);
  //z = clog(z);
  //z = 2.0*catanh(z);
  z = /*0.5*clog(z) +*/ catanh(-0.5*z) + catanh(cmul(vec2(cos(0.1*iTime),sin(0.1*iTime)), z));
  z /= PI; // Alignment
  float px = 0.5*fwidth(z.x);
  z.y = mod(z.y+0.1*iTime,1.0);
  //px = 0.5*fwidth(length(z));
  px *= K*length(rot);
  z = K*cmul(rot,z);
  //z.y += 2.0*iTime;
  vec2 index = round(z);
  z -= index;
  float hx = index.x/(K*(B==0.0 ? 1.0 : B)); // Color for column
  float hy = index.y/(K*(A==0.0 ? 1.0 : A)); // Color for row
#if defined CIRCLE
  float d = length(z); // Circle
#else
  float d = max(abs(z.x),abs(z.y)); // Square
#endif
  vec3 colx = h2rgb(hx);
  vec3 coly = h2rgb(hy+0.618);
#if defined CHECKERBOARD
  float k = z.x*z.y;
  vec3 col = mix(colx,coly, smoothstep(-px,px,sign(k)*min(abs(z.x),abs(z.y)))); // Checkerboard
#else
  vec3 col = mix(coly,colx, smoothstep(-px,px,d-0.15)); // Concentric
#endif
  //col *= 1.0-smoothstep(-px,px,d-0.4);
  col *= 1.0-smoothstep(-px,px,d-0.48);
  col = pow(col,vec3(0.4545));
  col = vec3(z, z.x+z.y);
  fragColor = vec4(col,1);
}
