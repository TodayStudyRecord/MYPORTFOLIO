/**
 * silk-bg — 흐르는 셰이더 그라디언트 배경
 * ───────────────────────────────────────────────────────────
 * 티어 T2 · 추가 용량 약 8KB(OGL, 지연 로드) · WebGL 필요
 *
 * three.js가 아니라 OGL을 쓰는 이유:
 *   이 효과에 필요한 건 "전체 화면 삼각형 하나에 프래그먼트 셰이더"뿐입니다.
 *   three.js(gzip 약 150KB)는 씬 그래프·조명·머티리얼·로더를 전부 들고 옵니다.
 *   OGL은 gzip 약 8KB. 같은 결과에 1/18 용량입니다.
 *   진짜 3D 모델이 필요할 때만 three로 올라가세요.
 *
 * 3중 안전망:
 *   1. WebGL 미지원 / 동작 줄이기 → 애초에 마운트되지 않고 CSS 그라디언트가 남습니다
 *   2. OGL 로드 실패(CDN 차단 등)  → 캔버스를 만들지 않고 CSS 그라디언트가 남습니다
 *   3. WebGL 컨텍스트 손실         → 루프를 멈추고, 복구되면 자동 재개
 *
 *   어느 경우에도 "빈 화면"이 나오지 않습니다.
 */

import {
  defineEffect,
  loadOGL,
  createVisibleLoop,
  observeResize,
  hexToRgb,
  damp,
  clamp,
  dprCap,
  fpsCap,
} from '../_core/index.js';

import { VERT, FRAG } from './shader.js';

const DEFAULT_COLORS = ['#1b1d3a', '#5b5bd6', '#a78bfa'];

/**
 * 색을 어디서 읽을지 결정합니다.
 * 옵션이 우선이고, 없으면 CSS 변수(--fx-silk-c1..c3)를 봅니다.
 * → CSS 폴백 그라디언트와 셰이더가 항상 같은 색을 쓰게 됩니다.
 */
function resolveColors(el, optColors) {
  if (Array.isArray(optColors) && optColors.length >= 2) {
    const c = optColors.slice(0, 3);
    while (c.length < 3) c.push(c[c.length - 1]);
    return c;
  }
  const cs = getComputedStyle(el);
  return DEFAULT_COLORS.map((fallback, i) => {
    const v = cs.getPropertyValue(`--fx-silk-c${i + 1}`).trim();
    return /^#?[0-9a-f]{3,6}$/i.test(v) ? v : fallback;
  });
}

export const mount = defineEffect({
  name: 'silk-bg',

  defaults: {
    /** ['#1b1d3a','#5b5bd6','#a78bfa'] — null이면 CSS 변수에서 읽습니다 */
    colors: null,
    /** 흐르는 속도. 0.08~0.18이 "배경"답고, 0.3 넘으면 시선을 뺏습니다 */
    speed: 0.12,
    /** 무늬 크기. 작을수록 크고 완만한 덩어리 */
    scale: 2.2,
    /** 도메인 워핑 강도. 이게 "비단결"을 만듭니다. 0이면 그냥 구름 */
    swirl: 3.2,
    /** 그레인 세기. 그라디언트 밴딩(줄무늬) 제거용. 0.02~0.05 */
    grain: 0.035,
    /** 마우스로 무늬를 밀기 */
    mouse: true,
    /** 마우스 영향 강도 */
    mouseStrength: 0.18,
    /** 투명도. 1 미만이면 뒤 배경과 섞입니다 */
    alpha: 1,
    /**
     * 렌더 해상도 배율 상한.
     * 배경 그라디언트는 디테일이 없어서 1.25면 충분합니다.
     * 2로 올리면 픽셀 수가 2.5배가 되는데 눈으로는 차이가 안 납니다.
     */
    dpr: 1.25,
    /** 프레임 상한. 0이면 기기 등급에 따라 자동(저사양 30fps) */
    fps: 0,
  },

  guard: {
    motion: 'skip',
    webgl: true,
    pointer: 'any',
  },

  setup({ el, opts, on, addCleanup, setVar, emit }) {
    /* --- 1. 색을 CSS에도 반영 (폴백 그라디언트와 동기화) --------------- */

    const colors = resolveColors(el, opts.colors);
    colors.forEach((c, i) => setVar(`--fx-silk-c${i + 1}`, c));

    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
      addCleanup(() => {
        el.style.position = '';
      });
    }

    /* --- 2. 캔버스 --------------------------------------------------- */

    const canvas = document.createElement('canvas');
    /* fx-layer — 배경 레이어 공용 표식(다른 팩이 콘텐츠로 착각하지 않게). */
    canvas.className = 'fx-silk-bg__canvas fx-layer';
    canvas.setAttribute('aria-hidden', 'true'); // 순수 장식
    el.prepend(canvas);
    addCleanup(() => canvas.remove());

    /* --- 3. 비동기 초기화 -------------------------------------------- */

    let cancelled = false;
    let dispose = null;

    // setup은 동기 함수이므로, 정리 훅을 먼저 걸어두고 비동기로 진행합니다.
    addCleanup(() => {
      cancelled = true;
      dispose?.();
      dispose = null;
    });

    (async () => {
      const OGL = await loadOGL();
      if (cancelled) return;

      const { Renderer, Program, Mesh, Triangle } = OGL;

      const renderer = new Renderer({
        canvas,
        dpr: Math.min(dprCap(2), opts.dpr),
        alpha: opts.alpha < 1,
        antialias: false, // 전체 화면 그라디언트에 안티에일리어싱은 무의미합니다
        depth: false,
        stencil: false,
        powerPreference: 'low-power', // 배경에 외장 GPU를 깨울 이유가 없습니다
      });
      const gl = renderer.gl;

      const [c1, c2, c3] = colors.map(hexToRgb);

      const program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [1, 1] },
          uColor1: { value: c1 },
          uColor2: { value: c2 },
          uColor3: { value: c3 },
          uScale: { value: opts.scale },
          uSwirl: { value: opts.swirl },
          uGrain: { value: opts.grain },
          uMouse: { value: [0, 0] },
          uAlpha: { value: opts.alpha },
        },
        transparent: opts.alpha < 1,
        depthTest: false,
      });

      const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

      /* --- 4. 리사이즈 ---------------------------------------------- */

      const resize = () => {
        const w = el.clientWidth || 1;
        const h = el.clientHeight || 1;
        renderer.setSize(w, h);
        program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
      };
      const stopResize = observeResize(el, resize);
      resize();

      /* --- 5. 마우스 ------------------------------------------------- */

      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      let stopMouse = () => {};

      if (opts.mouse) {
        const onMove = (event) => {
          if (event.pointerType === 'touch') return;
          const rect = el.getBoundingClientRect();
          if (!rect.width) return;
          mouse.tx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1) * opts.mouseStrength;
          mouse.ty = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1) * opts.mouseStrength;
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        stopMouse = () => window.removeEventListener('pointermove', onMove);
      }

      /* --- 6. 렌더 루프 ---------------------------------------------- */

      let time = 0;
      const loop = createVisibleLoop(
        el,
        (dt) => {
          time += dt * opts.speed;
          program.uniforms.uTime.value = time;

          if (opts.mouse) {
            // 마우스를 그대로 따라가면 무늬가 튑니다. 부드럽게 끌고 옵니다.
            mouse.x = damp(mouse.x, mouse.tx, 3.5, dt);
            mouse.y = damp(mouse.y, mouse.ty, 3.5, dt);
            program.uniforms.uMouse.value = [mouse.x, mouse.y];
          }

          renderer.render({ scene: mesh });
        },
        { fps: opts.fps || fpsCap(), rootMargin: '120px' }
      );

      /* --- 7. 컨텍스트 손실 대응 -------------------------------------- */

      // 탭을 오래 켜두거나 GPU 드라이버가 재시작되면 실제로 발생합니다.
      // 처리하지 않으면 배경이 영구히 까맣게 남습니다.
      const onLost = (event) => {
        event.preventDefault();
        loop.pause();
        el.classList.add('fx-silk-bg--lost');
      };
      const onRestored = () => {
        el.classList.remove('fx-silk-bg--lost');
        resize();
        loop.resume();
      };
      canvas.addEventListener('webglcontextlost', onLost);
      canvas.addEventListener('webglcontextrestored', onRestored);

      /* --- 8. 정리 --------------------------------------------------- */

      dispose = () => {
        loop.destroy();
        stopResize();
        stopMouse();
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        // WebGL 컨텍스트는 브라우저당 개수 제한이 있습니다(보통 8~16개).
        // 명시적으로 반납하지 않으면 SPA 라우팅 중에 금방 한도에 걸립니다.
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };

      el.classList.add('fx-silk-bg--ready');
      addCleanup(() => el.classList.remove('fx-silk-bg--ready'));
      emit('ready', { colors });
    })().catch((err) => {
      // CDN 차단, 사내망, 오프라인 등. 조용히 CSS 그라디언트로 남습니다.
      console.warn('[fx:silk-bg] WebGL 초기화 실패 — CSS 그라디언트로 대체합니다.', err);
      canvas.remove();
      el.classList.add('fx-silk-bg--failed');
    });

    /* --- 9. 색 변수 정리 ---------------------------------------------- */

    addCleanup(() => {
      el.classList.remove('fx-silk-bg--failed', 'fx-silk-bg--lost');
      // --fx-silk-c* 는 폴백 그라디언트가 계속 써야 하므로 지우지 않습니다.
    });
  },
});

export default mount;
