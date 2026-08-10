/**
 * parallax-layers — 마우스 + 스크롤 연동 다층 깊이감
 * ───────────────────────────────────────────────────────────
 * 티어 T1 · 추가 용량 0KB · 모바일에서도 스크롤 시차는 동작
 *
 * tilt-card가 "카드 하나"를 다룬다면, 이건 "히어로 섹션 전체"를 다룹니다.
 * 배경 → 중간 → 전경 레이어가 서로 다른 속도로 움직여서 깊이를 만듭니다.
 *
 * 설계 결정 3가지:
 *  1. 레이어마다 JS로 transform을 쓰지 않습니다.
 *     컨테이너에 CSS 변수 3개(-1~1)만 쓰고 계산은 CSS calc에 맡깁니다.
 *     레이어가 3개든 10개든 프레임당 JS 쓰기는 3번뿐입니다.
 *  2. 마우스는 window 기준입니다.
 *     히어로 위에 커서를 올려야만 반응하면 대부분의 방문자는 효과를 못 봅니다.
 *  3. 가만히 있으면 잠듭니다.
 *     수렴 후 0.4초간 입력이 없으면 rAF를 멈춥니다. 히어로는 화면에
 *     오래 머무는 영역이라 이 절전이 실제로 배터리에 차이를 만듭니다.
 */

import {
  defineEffect,
  damp,
  clamp,
  round,
  createVisibleLoop,
  rafThrottle,
} from '../_core/index.js';

export const mount = defineEffect({
  name: 'parallax-layers',

  defaults: {
    /** 마우스 반응 사용 */
    mouse: true,
    /** 레이어 계수 1일 때 마우스로 움직이는 최대 거리(px) */
    mouseStrength: 26,
    /** 스크롤 반응 사용 */
    scroll: true,
    /** 레이어 계수 1일 때 스크롤로 움직이는 최대 거리(px) */
    scrollStrength: 70,
    /** 레이어 계수 1일 때 실제 translateZ 높이(px). 0이면 평면 시차만. */
    depth: 0,
    /** 원근 거리(px) */
    perspective: 1200,
    /** 따라오는 속도(감쇠 계수). 6=느긋함, 10=기본, 18=즉각적 */
    speed: 9,
    /** 'window' = 화면 어디서 움직여도 반응 / 'self' = 이 요소 위에서만 */
    pointerTarget: 'window',
    /** 수렴 후 이 시간(초) 동안 입력이 없으면 루프 정지 */
    idleSleep: 0.4,
  },

  guard: {
    motion: 'skip',
    pointer: 'any', // 모바일에서도 스크롤 시차는 유효합니다
  },

  setup({ el, opts, on, addCleanup, setVar, emit }) {
    /* --- 1. 레이어 등록 --------------------------------------------- */

    // data-fx-layer="0.6" → 계수 0.6. 0 = 고정, 1 = 최대로 움직임.
    const layers = Array.from(el.querySelectorAll('[data-fx-layer]'));
    if (!layers.length) {
      console.warn('[fx:parallax-layers] data-fx-layer를 가진 자식이 없습니다.');
    }
    for (const layer of layers) {
      const v = parseFloat(layer.dataset.fxLayer);
      layer.style.setProperty('--fx-layer', Number.isFinite(v) ? v : 0);
    }
    addCleanup(() => {
      for (const layer of layers) layer.style.removeProperty('--fx-layer');
    });

    /* --- 2. 정적 변수 ------------------------------------------------ */

    setVar('--fx-plx-perspective', `${opts.perspective}px`);
    // 마우스와 반대로 움직여야 "안쪽에 있다"는 느낌이 납니다 → 부호를 미리 뒤집습니다.
    setVar('--fx-plx-mx', `${-opts.mouseStrength}px`);
    setVar('--fx-plx-my', `${-opts.mouseStrength}px`);
    setVar('--fx-plx-sy', `${opts.scrollStrength}px`);
    setVar('--fx-plx-z', `${opts.depth}px`);

    /* --- 3. 상태 ----------------------------------------------------- */

    const s = { x: 0, y: 0, p: 0 }; // 화면에 그려진 값
    const t = { x: 0, y: 0, p: 0 }; // 목표값
    let idle = 0;

    const apply = () => {
      setVar('--fx-plx-x', round(s.x, 4));
      setVar('--fx-plx-y', round(s.y, 4));
      setVar('--fx-plx-s', round(s.p, 4));
    };

    /* --- 4. 스크롤 진행도 -------------------------------------------- */

    /**
     * 요소 중심이 화면 중앙에 오면 0,
     * 아래에서 올라오는 중이면 +1, 위로 빠져나가는 중이면 -1.
     */
    const readScroll = () => {
      if (!opts.scroll) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      const range = vh / 2 + rect.height / 2;
      t.p = clamp((center - vh / 2) / (range || 1), -1, 1);
    };

    /* --- 5. 루프 ----------------------------------------------------- */

    const loop = createVisibleLoop(
      el,
      (dt) => {
        s.x = damp(s.x, t.x, opts.speed, dt);
        s.y = damp(s.y, t.y, opts.speed, dt);
        s.p = damp(s.p, t.p, opts.speed, dt);
        apply();

        // 수렴했고 입력도 없으면 서서히 잠듭니다.
        const moving =
          Math.abs(s.x - t.x) > 0.001 ||
          Math.abs(s.y - t.y) > 0.001 ||
          Math.abs(s.p - t.p) > 0.001;

        if (moving) {
          idle = 0;
        } else {
          idle += dt;
          if (idle > opts.idleSleep) {
            s.x = t.x;
            s.y = t.y;
            s.p = t.p;
            apply();
            loop.pause();
          }
        }
      },
      { rootMargin: '200px' }
    );
    addCleanup(() => loop.destroy());

    const wake = () => {
      idle = 0;
      loop.resume();
    };

    /* --- 6. 입력 ----------------------------------------------------- */

    if (opts.mouse) {
      const onMove = (event) => {
        if (event.pointerType === 'touch') return;
        if (opts.pointerTarget === 'self') {
          const rect = el.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          t.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
          t.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
        } else {
          t.x = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
          t.y = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
        }
        wake();
      };

      const target = opts.pointerTarget === 'self' ? el : window;
      on(target, 'pointermove', onMove, { passive: true });

      // 커서가 브라우저 밖으로 나가면 중앙으로 되돌립니다.
      on(document, 'pointerleave', () => {
        t.x = 0;
        t.y = 0;
        wake();
      });
    }

    if (opts.scroll) {
      const onScroll = rafThrottle(() => {
        readScroll();
        wake();
      });
      on(window, 'scroll', onScroll, { passive: true });
      on(window, 'resize', onScroll, { passive: true });
      addCleanup(() => onScroll.cancel());
      readScroll();
      s.p = t.p; // 첫 진입에서 갑자기 미끄러지지 않도록 초기값을 맞춥니다
    }

    apply();
    emit('ready', { layers: layers.length });

    /* --- 7. 정리 ----------------------------------------------------- */

    addCleanup(() => {
      for (const prop of [
        '--fx-plx-x', '--fx-plx-y', '--fx-plx-s',
        '--fx-plx-mx', '--fx-plx-my', '--fx-plx-sy',
        '--fx-plx-z', '--fx-plx-perspective',
      ]) {
        el.style.removeProperty(prop);
      }
    });
  },
});

export default mount;
