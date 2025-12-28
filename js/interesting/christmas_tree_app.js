import * as THREE from 'https://esm.sh/three@0.160.0';
import { EffectComposer } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function makeColor(r, g, b) {
  return new THREE.Color(r / 255, g / 255, b / 255);
}

function buildTreeTargets(count, rng) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  const greenA = makeColor(32, 170, 98);
  const greenB = makeColor(14, 104, 64);
  const gold = makeColor(255, 215, 120);
  const red = makeColor(255, 105, 130);
  const blue = makeColor(120, 195, 255);

  for (let i = 0; i < count; i++) {
    const u = rng();
    const v = rng();
    const w = rng();

    const yN = Math.pow(u, 0.65); // denser near bottom
    const height = 1.35;
    const y = yN * height - 0.62;

    const theta = v * Math.PI * 2 + yN * 6.2;
    const radius = (1 - yN) * (0.78 + 0.14 * (rng() - 0.5));
    const r = radius * Math.pow(w, 0.35);

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    pos[i * 3 + 0] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;

    // Ornaments
    let c;
    const ornament = rng();
    if (ornament < 0.07) c = red;
    else if (ornament < 0.12) c = gold;
    else if (ornament < 0.16) c = blue;
    else c = greenA.clone().lerp(greenB, yN);

    col[i * 3 + 0] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }

  return { pos, col };
}

function buildCakeTargets(count, rng) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  const cream = makeColor(255, 245, 235);
  const pink = makeColor(255, 160, 200);
  const berry = makeColor(255, 95, 125);
  const mint = makeColor(145, 230, 210);
  const lemon = makeColor(255, 240, 140);

  for (let i = 0; i < count; i++) {
    const a = rng();
    const b = rng();
    const c = rng();

    // 3% candle particles above the cake
    const isCandle = a < 0.03;
    if (isCandle) {
      const theta = b * Math.PI * 2;
      const r = 0.06 * Math.sqrt(c);
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const y = 0.55 + 0.55 * rng();
      pos[i * 3 + 0] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const flame = rng();
      const flameCol = flame < 0.5 ? lemon : berry;
      col[i * 3 + 0] = flameCol.r;
      col[i * 3 + 1] = flameCol.g;
      col[i * 3 + 2] = flameCol.b;
      continue;
    }

    // Cake body: soft cylinder
    const height = 0.9;
    const yN = b;
    const y = yN * height - 0.55;

    const theta = c * Math.PI * 2;
    const radius = 0.62;
    const rr = radius * Math.sqrt(rng());
    const x = Math.cos(theta) * rr;
    const z = Math.sin(theta) * rr;

    pos[i * 3 + 0] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;

    // Colors: layers + sprinkles
    const sprinkle = rng();
    let base = cream.clone().lerp(pink, 0.55);
    // Add subtle layered bands
    const band = Math.floor((yN * 6)) % 2;
    if (band === 1) base = base.clone().lerp(pink, 0.25);

    if (sprinkle < 0.08) base = berry;
    else if (sprinkle < 0.12) base = mint;
    else if (sprinkle < 0.15) base = lemon;

    col[i * 3 + 0] = base.r;
    col[i * 3 + 1] = base.g;
    col[i * 3 + 2] = base.b;
  }

  return { pos, col };
}

function createRng(seed = 1337) {
  // Mulberry32
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeParticleMaterial() {
  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uSize: { value: 1.6 },
    uGlow: { value: 1.0 }
  };

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uSize;

      attribute vec3 color;
      attribute float aSeed;

      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vColor = color;

        // Soft twinkle per particle
        float tw = sin(uTime * (1.2 + aSeed * 1.6) + aSeed * 20.0);
        vTwinkle = 0.55 + 0.45 * tw;

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float size = uSize * uPixelRatio;
        // Perspective scaling (keep points reasonably small)
        size *= (14.0 / -mvPosition.z);
        size *= (0.7 + 0.8 * vTwinkle);

        // Safety clamp to avoid giant squares on some GPUs
        size = clamp(size, 1.0, 36.0);

        gl_PointSize = size;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uGlow;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vec2 uv = gl_PointCoord.xy - 0.5;
        float d = length(uv);

        // Core + halo
        // NOTE: smoothstep requires edge0 < edge1; we invert to get a soft disc.
        float core = 1.0 - smoothstep(0.0, 0.32, d);
        float halo = (1.0 - smoothstep(0.0, 0.7, d)) * 0.55;

        // Cut hard outside to prevent square corners
        if (d > 0.72) discard;

        float alpha = (core + halo) * (0.55 + 0.55 * vTwinkle) * uGlow;
        vec3 col = vColor;

        // Subtle warm highlight in center
        col += vec3(0.12, 0.08, 0.05) * core;

        gl_FragColor = vec4(col, alpha);
      }
    `
  });
}

function showOverlayError(container, message) {
  if (!container) return;
  const overlay = document.createElement('div');
  overlay.className = 'w-full h-full flex items-center justify-center p-6';
  overlay.innerHTML = `
    <div class="max-w-xl w-full bg-base-200/70 border border-white/40 rounded-[24px] p-5 text-base-content">
      <div class="font-extrabold mb-2">渲染失败</div>
      <div class="text-sm opacity-80 whitespace-pre-wrap"></div>
    </div>
  `;
  overlay.querySelector('div.text-sm').textContent = message;
  container.innerHTML = '';
  container.appendChild(overlay);
}

function initChristmasTreeApp() {
  const mount = document.getElementById('christmas-tree-root');
  if (!mount) return;

  // Clear old content
  mount.innerHTML = '';

  let mode = 'tree';
  const btn = document.getElementById('christmas-toggle');
  const setButtonText = () => {
    if (!btn) return;
    btn.textContent = mode === 'tree' ? '切换为生日蛋糕' : '切换为圣诞树';
  };

  try {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.26);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 50);
    camera.position.set(0, 0.4, 3.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    mount.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.25, 0.55, 0.12);
    composer.addPass(bloomPass);

    const count = 8000;
    const rng = createRng(20251225);
    const tree = buildTreeTargets(count, rng);
    const cake = buildCakeTargets(count, rng);

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);

    positions.set(tree.pos);
    colors.set(tree.col);
    for (let i = 0; i < count; i++) seeds[i] = rng();

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const material = makeParticleMaterial();
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Background stars
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 900;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const srng = createRng(424242);
    for (let i = 0; i < starCount; i++) {
      const r = 2.8 + srng() * 5.0;
      const th = srng() * Math.PI * 2;
      const ph = Math.acos(2 * srng() - 1);
      starPos[i * 3 + 0] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.cos(ph) * 0.6;
      starPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const s = 0.6 + srng() * 0.4;
      starCol[i * 3 + 0] = s;
      starCol[i * 3 + 1] = s;
      starCol[i * 3 + 2] = s;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.3,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.5
    });
    const stars = new THREE.Points(starsGeo, starMat);
    scene.add(stars);

    let width = 1;
    let height = 1;
    const resize = () => {
      const rect = mount.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const pr = Math.min(2, window.devicePixelRatio || 1);
      renderer.setPixelRatio(pr);
      renderer.setSize(width, height, false);
      composer.setPixelRatio(pr);
      composer.setSize(width, height);
      material.uniforms.uPixelRatio.value = pr;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    // Morph
    let currentMode = 'tree';
    let morphT = 1;
    let morphing = false;
    const fromPos = new Float32Array(count * 3);
    const toPos = new Float32Array(count * 3);
    const fromCol = new Float32Array(count * 3);
    const toCol = new Float32Array(count * 3);

    function startMorph(nextMode) {
      if (nextMode === currentMode) return;
      fromPos.set(geometry.attributes.position.array);
      fromCol.set(geometry.attributes.color.array);

      if (nextMode === 'tree') {
        toPos.set(tree.pos);
        toCol.set(tree.col);
        bloomPass.strength = 1.35;
        bloomPass.radius = 0.55;
        bloomPass.threshold = 0.12;
      } else {
        toPos.set(cake.pos);
        toCol.set(cake.col);
        bloomPass.strength = 1.05;
        bloomPass.radius = 0.42;
        bloomPass.threshold = 0.1;
      }

      morphT = 0;
      morphing = true;
      currentMode = nextMode;
    }

    const clock = new THREE.Clock();
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      material.uniforms.uTime.value = t;

      const orbit = 0.18;
      camera.position.x = Math.sin(t * 0.22) * orbit;
      camera.position.z = 3.05 + Math.cos(t * 0.22) * orbit;
      camera.lookAt(0, 0.15, 0);

      points.rotation.y = t * 0.12;
      stars.rotation.y = -t * 0.02;

      if (morphing) {
        morphT += 1 / 72;
        const p = easeInOutCubic(clamp01(morphT));
        const pa = geometry.attributes.position.array;
        const ca = geometry.attributes.color.array;
        for (let i = 0; i < count * 3; i++) {
          pa[i] = fromPos[i] + (toPos[i] - fromPos[i]) * p;
          ca[i] = fromCol[i] + (toCol[i] - fromCol[i]) * p;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
        if (morphT >= 1) morphing = false;
      }

      composer.render();
    };

    // Initial
    bloomPass.strength = 1.35;
    bloomPass.radius = 0.55;
    bloomPass.threshold = 0.12;
    animate();
    setButtonText();

    const onToggle = () => {
      mode = mode === 'tree' ? 'cake' : 'tree';
      setButtonText();
      startMorph(mode);
    };
    if (btn) btn.addEventListener('click', onToggle);

    const cleanup = () => {
      if (btn) btn.removeEventListener('click', onToggle);
      cancelAnimationFrame(raf);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      starMat.dispose();
      starsGeo.dispose();
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };

    // In case the page is hot-reloaded or navigated away
    window.addEventListener('beforeunload', cleanup, { once: true });
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    showOverlayError(mount, msg + '\n\n请检查：浏览器是否支持 WebGL；以及网络是否能访问 esm.sh / jsDelivr。');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChristmasTreeApp);
} else {
  initChristmasTreeApp();
}
