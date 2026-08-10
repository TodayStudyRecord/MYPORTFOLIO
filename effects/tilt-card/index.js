/**
 * tilt-card — 포인터 3D 틸트 + 글레어 + 깊이 레이어
 * ───────────────────────────────────────────────────────────
 * 티어 T1 · 추가 용량 0KB(외부 의존성 없음) · 마우스 전용
 *
 * 프로젝트 카드 하나당 체감 임팩트가 가장 큰 효과입니다.
 * WebGL 없이 CSS 3D transform만으로 만들어서 저사양에서도 60fps가 나옵니다.
 *
 * 구현 포인트 3가지:
 *  1. 감쇠(damp) 보간 — 포인터를 그대로 따라가면 딱딱합니다.
 *     프레임레이트 독립 감쇠를 써서 144Hz에서도 같은 속도로 따라옵니다.
 *  2. getBoundingClientRect 캐싱 — pointermove마다 호출하면 매 프레임 리플로우입니다.
 *     enter 시 1회 읽고 scroll/resize에서만 무효화합니다.
 *  3. will-change는 상호작용 중에만 — 카드 20장에 항상 걸어두면 GPU 메모리를 먹습니다.
 */

import { defineEffect, damp, clamp, round, createLoop } from '../_core/index.js';

export const mount = defineEffect({
  name: 'tilt-card',

  defaults: {
    /** 최대 기울기(도). 12~16이 자연스럽고, 20을 넘으면 촌스러워집니다. */
    maxTilt: 12,
    /** 원근 거리(px). 작을수록 왜곡이 심해집니다. 카드 폭의 1.5~2배 권장. */
    perspective: 900,
    /** hover 시 확대 배율. 1.02~1.04가 적당합니다. */
    scale: 1.02,
    /** 따라오는 속도(감쇠 계수). 클수록 즉각적, 작을수록 부드럽습니다. */
    speed: 12,
    /** 빛 반사(글레어) 표시 여부 */
    glare: true,
    /** 글레어 최대 불투명도 */
    maxGlare: 0.35,
    /**
     * 글레어를 띄울 Z 높이(px).
     * 0 = 카드 표면. data-fx-depth 레이어보다 위에 얹고 싶으면
     * 가장 큰 depth보다 큰 값을 주세요(원근 보정은 자동입니다).
     */
    glareZ: 0,
    /** 기울기 방향 반전 */
    reverse: false,
    /** 'both' | 'x'(좌우 움직임만 = rotateY) | 'y'(상하 움직임만 = rotateX) */
    axis: 'both',
    /** 키보드 포커스 시에도 확대(기울기는 주지 않습니다 — 방향 감각 혼란 방지) */
    focusScale: true,
  },

  guard: {
    motion: 'skip',    // 동작 줄이기 사용자는 완전히 끕니다
    pointer: 'fine',   // hover 기반이므로 터치 기기에서는 켜지 않습니다
  },

  setup({ el, opts, on, addCleanup, setVar, emit }) {
    /* --- 1. DOM 준비 ------------------------------------------------ */

    // 글레어를 absolute로 얹으려면 부모가 static이면 안 됩니다.
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
      addCleanup(() => {
        el.style.position = '';
      });
    }

    // data-fx-depth="40" 을 가진 자식들을 깊이 레이어로 등록합니다.
    const layers = Array.from(el.querySelectorAll('[data-fx-depth]'));
    for (const layer of layers) {
      layer.style.setProperty('--fx-depth', parseFloat(layer.dataset.fxDepth) || 0);
    }
    addCleanup(() => {
      for (const layer of layers) layer.style.removeProperty('--fx-depth');
    });

    let glareEl = null;
    if (opts.glare) {
      glareEl = document.createElement('div');
      glareEl.className = 'fx-tilt-card__glare';
      glareEl.setAttribute('aria-hidden', 'true'); // 장식용 — 스크린 리더는 무시
      el.appendChild(glareEl);
      addCleanup(() => glareEl.remove());
    }

    /* --- 2. 정적 CSS 변수 ------------------------------------------- */

    setVar('--fx-tilt-perspective', `${opts.perspective}px`);
    if (glareEl) {
      setVar('--fx-tilt-glare-z', `${opts.glareZ}px`);
      // Z로 띄운 만큼 원근 때문에 커집니다. 역보정해서 카드를 정확히 덮게 합니다.
      setVar(
        '--fx-tilt-glare-scale',
        round((opts.perspective - opts.glareZ) / opts.perspective, 4)
      );
    }

    /* --- 3. 상태 ---------------------------------------------------- */

    // s = 현재 화면에 그려진 값, t = 포인터가 가리키는 목표값
    const s = { rx: 0, ry: 0, sc: 1, g: 0, nx: 0, ny: 0 };
    const t = { rx: 0, ry: 0, sc: 1, g: 0, nx: 0, ny: 0 };

    let rect = null;
    let hovering = false;
    let focused = false;

    // 스크롤/리사이즈가 나면 캐시한 사각형이 틀어집니다.
    const invalidate = () => {
      rect = null;
    };
    on(window, 'scroll', invalidate, { passive: true });
    on(window, 'resize', invalidate, { passive: true });

    /* --- 4. 렌더 ---------------------------------------------------- */

    const apply = () => {
      setVar('--fx-tilt-rx', `${round(s.rx, 2)}deg`);
      setVar('--fx-tilt-ry', `${round(s.ry, 2)}deg`);
      setVar('--fx-tilt-scale', round(s.sc, 4));
      // 깊이 레이어가 쓰는 -1~1 단위값
      setVar('--fx-tilt-nx', round(s.nx, 3));
      setVar('--fx-tilt-ny', round(s.ny, 3));
      if (glareEl) {
        setVar('--fx-tilt-px', `${round(50 + s.nx * 50, 1)}%`);
        setVar('--fx-tilt-py', `${round(50 + s.ny * 50, 1)}%`);
        setVar('--fx-tilt-glare-o', round(s.g, 3));
      }
    };

    const KEYS = ['rx', 'ry', 'sc', 'g', 'nx', 'ny'];
    const settled = () => KEYS.every((k) => Math.abs(s[k] - t[k]) < 0.002);

    const loop = createLoop((dt) => {
      for (const k of KEYS) s[k] = damp(s[k], t[k], opts.speed, dt);
      apply();

      // 목표에 충분히 가까워지고 상호작용도 끝났으면 루프를 완전히 끕니다.
      if (!hovering && !focused && settled()) {
        for (const k of KEYS) s[k] = t[k];
        apply();
        loop.stop();
        el.dataset.fxTilting = '0'; // will-change 해제 신호
      }
    });
    addCleanup(() => loop.stop());

    const wake = () => {
      el.dataset.fxTilting = '1';
      loop.start();
    };

    /* --- 5. 입력 ---------------------------------------------------- */

    const setFromPointer = (event) => {
      if (!rect) rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      // 카드 중심을 (0,0), 모서리를 ±1로 정규화
      const nx = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      const ny = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
      const dir = opts.reverse ? -1 : 1;

      t.nx = nx;
      t.ny = ny;
      // 좌우 움직임 → Y축 회전, 상하 움직임 → X축 회전(부호 반대여야 자연스럽습니다)
      t.ry = opts.axis === 'y' ? 0 : dir * nx * opts.maxTilt;
      t.rx = opts.axis === 'x' ? 0 : dir * -ny * opts.maxTilt;
      t.g = opts.maxGlare;
    };

    on(el, 'pointerenter', (event) => {
      // 하이브리드 노트북에서 손가락 터치로 들어온 경우는 무시합니다.
      if (event.pointerType === 'touch') return;
      hovering = true;
      rect = el.getBoundingClientRect();
      t.sc = opts.scale;
      setFromPointer(event);
      wake();
      emit('enter');
    });

    on(el, 'pointermove', (event) => {
      if (!hovering || event.pointerType === 'touch') return;
      setFromPointer(event);
    });

    on(el, 'pointerleave', () => {
      if (!hovering) return;
      hovering = false;
      t.rx = 0;
      t.ry = 0;
      t.nx = 0;
      t.ny = 0;
      t.g = 0;
      t.sc = focused ? opts.scale : 1;
      emit('leave');
    });

    // 키보드 사용자에게도 "선택됨"이 보이도록 — 확대만, 기울기는 없음
    if (opts.focusScale) {
      on(el, 'focusin', () => {
        focused = true;
        t.sc = opts.scale;
        wake();
      });
      on(el, 'focusout', () => {
        focused = false;
        if (!hovering) t.sc = 1;
      });
    }

    /* --- 6. 정리 ---------------------------------------------------- */

    addCleanup(() => {
      for (const prop of [
        '--fx-tilt-rx', '--fx-tilt-ry', '--fx-tilt-scale',
        '--fx-tilt-nx', '--fx-tilt-ny',
        '--fx-tilt-px', '--fx-tilt-py', '--fx-tilt-glare-o',
        '--fx-tilt-perspective', '--fx-tilt-glare-z', '--fx-tilt-glare-scale',
      ]) {
        el.style.removeProperty(prop);
      }
      delete el.dataset.fxTilting;
    });

    apply();
  },
});

export default mount;
