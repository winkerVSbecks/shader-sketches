mat2 rotate2D(in float r){
  return mat2(cos(r), sin(r), -sin(r), cos(r));
}

float sdOctahedron( vec3 p, float s) {
  p = abs(p);
  return (p.x+p.y+p.z-s)*0.57735027;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec3 camera = vec3(0,0,99),p,u,v;
    vec3 color;

    for(float w,d,i=0.;i++<80.;) {
        v=u;
        u=camera;
        camera+=(gl_FragCoord.rgb*2.- iResolution.xyx)/iResolution.x*d + vec3(sin(i),cos(i),0);

        // Repeat it multiple times (each one renders one tetraheadron)
        for(d=w=6.;w>0.;w-=1.26) {
          p=camera;
          // spikes & spin
          p.xz*=rotate2D(iTime+w);
          p.xy*=rotate2D(1.);

          //d = min(d, dot(p+.3, sign(p)*.3)-9.);

          d = min(d, sdOctahedron(p+sin(p)*.3, 25.));

          color = vec3(d);
          //d=min(d, dot(p+sin(p)*.3, sign(p)*.3)-9.);
          //sin(p)* ripples
        }
    }

    // calculate normals
    fragColor = vec4(cross(camera-u,camera-v)+.5, 1.0);
    //fragColor = vec4(color, 1.0);
}