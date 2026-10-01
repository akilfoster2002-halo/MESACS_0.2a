/* =====================================================================
   WANO'S SKY — the one from the website's demo (koro-landing,
   src/shared/sky.js), brought over shader for shader: a dome that
   follows the camera, a gradient from horizon to zenith, a sun with a
   disc, a close glow and a wide bloom, and a few stars where the sky is
   dark enough for them. The mood is the demo island's: golden hour with
   a third of dusk in it (MOODS.gold mixed toward MOODS.dusk by 0.34, the
   sun 12 degrees up in the south-west).

   ON A BALL, "UP" IS WHEREVER YOU ARE STANDING. The demo's dome assumes
   +Y is up for everyone; here the dome is turned every frame so its +Y
   is the line from the middle of the planet through the camera. The sun
   is set in that frame too, so it sits at the same height over every
   horizon on Wano, which is how a small world ought to look.

   planet.js builds it (SKYDOME.build) on the hub only, ticks it, and
   matches its own sun and fill lights to it (SKYDOME.light).
   ===================================================================== */
window.SKYDOME = (function(){
  const C = h => new THREE.Color(h);
  // MOODS.gold and MOODS.dusk from koro-landing, mixed as the demo mixes them
  const GOLD = { zenith:'#2f5fae', mid:'#7fa3d6', horizon:'#ffd4a0', ground:'#6a7ba0', sunColor:'#fff1d6',
                 hemiSky:'#cfe0ff', hemiGround:'#5e4a3c', sun:'#ffe2bd' };
  const DUSK = { zenith:'#10133d', mid:'#4a2f86', horizon:'#ff8a5c', ground:'#2a1d3e', sunColor:'#ffc98f',
                 hemiSky:'#9d86e6', hemiGround:'#3a1f33', sun:'#ffa878' };
  const MIX = 0.34;
  const mood = {};
  for(const k in GOLD) mood[k] = C(GOLD[k]).lerp(C(DUSK[k]), MIX);
  Object.assign(mood, { sunElev:12, sunAz:205, sunSize:1.4 + (1.5-1.4)*MIX, sunGlow:0.6, stars:0 + 0.6*MIX*0.5 });

  const NOISE = `
    float kHash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
    float kHash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }`;

  let dome = null;
  const sunLocal = new THREE.Vector3();
  function sunDir(out){
    const e = THREE.MathUtils.degToRad(mood.sunElev), a = THREE.MathUtils.degToRad(mood.sunAz);
    return out.set(Math.sin(a)*Math.cos(e), Math.sin(e), Math.cos(a)*Math.cos(e)).normalize();
  }

  function build(group, radius){
    const mat = new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false, depthTest:false, fog:false,
      uniforms:{
        uZenith:{ value:mood.zenith }, uMid:{ value:mood.mid }, uHorizon:{ value:mood.horizon }, uGround:{ value:mood.ground },
        uSunDir:{ value:sunDir(sunLocal) }, uSunColor:{ value:mood.sunColor },
        uSunSize:{ value:mood.sunSize }, uSunGlow:{ value:mood.sunGlow }, uStars:{ value:mood.stars }, uTime:{ value:0 },
      },
      vertexShader:`
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader:`
        uniform vec3 uZenith, uMid, uHorizon, uGround, uSunDir, uSunColor;
        uniform float uSunSize, uSunGlow, uStars, uTime;
        varying vec3 vDir;
        ${NOISE}
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
          col = mix(col, uZenith, smoothstep(0.22, 0.95, h));
          col = mix(col, uGround, smoothstep(0.0, -0.35, h));
          if (uStars > 0.0) {
            vec3 p = d * 260.0;
            float r = kHash3(floor(p));
            vec3 f = fract(p) - 0.5;
            float star = smoothstep(0.08, 0.0, length(f)) * step(0.985, r);
            float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r * 4.0) + r * 60.0);
            col += vec3(1.0, 0.95, 0.9) * star * tw * uStars * smoothstep(0.35, 0.8, h) * 2.2;
          }
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          float ang = acos(clamp(sd, -1.0, 1.0));
          float size = radians(uSunSize);
          float disc = smoothstep(size, size * 0.92, ang);
          col = mix(col, uSunColor * 3.0, disc);
          col += uSunColor * (pow(sd, 90.0) * 0.9 + pow(sd, 10.0) * 0.35 + pow(sd, 2.5) * 0.12) * uSunGlow;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    // inside the camera's far plane, wherever the camera is
    dome = new THREE.Mesh(new THREE.SphereGeometry(radius || 1500, 48, 24), mat);
    dome.frustumCulled = false; dome.renderOrder = -10;
    dome.userData.sky = true;
    group.add(dome);
    return dome;
  }

  const Y = new THREE.Vector3(0, 1, 0), up = new THREE.Vector3(), w = new THREE.Vector3();
  /* Follow the camera and stand up where it is. Returns the sun's direction
     in the world, for whoever wants to point a light along it. */
  function tick(dt, camera){
    if(!dome || !dome.parent) return null;
    dome.position.copy(camera.position);
    up.copy(camera.position).normalize();
    dome.quaternion.setFromUnitVectors(Y, up);
    dome.material.uniforms.uTime.value += dt || 0;
    return w.copy(sunLocal).applyQuaternion(dome.quaternion);
  }
  /* The sun and the fill, in the sky's colours. */
  let was = null;
  function light(sun, hemi){
    if(!was) was = { sun:sun && sun.color.clone(), sky:hemi && hemi.color.clone(), ground:hemi && hemi.groundColor && hemi.groundColor.clone() };
    if(sun) sun.color.copy(mood.sun);
    if(hemi){ hemi.color.copy(mood.hemiSky); if(hemi.groundColor) hemi.groundColor.copy(mood.hemiGround); }
  }
  /* and back as they were, for every room that is not Wano */
  function restore(sun, hemi){
    if(!was) return;
    if(sun && was.sun) sun.color.copy(was.sun);
    if(hemi && was.sky) hemi.color.copy(was.sky);
    if(hemi && was.ground && hemi.groundColor) hemi.groundColor.copy(was.ground);
    was = null;
  }
  function clear(){ if(dome && dome.parent) dome.parent.remove(dome); dome = null; }

  return { build, tick, light, restore, clear, mood, get dome(){ return dome; } };
})();
