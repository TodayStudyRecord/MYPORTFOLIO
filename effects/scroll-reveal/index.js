/**
 * scroll-reveal — 스크롤 진입 시 3D 등장
 * ───────────────────────────────────────────────────────────
 * 티어 T0 · 추가 용량 0KB · 모든 환경에서 동작
 *
 * 두 가지 모드가 있고, 이게 이 효과의 핵심 설계입니다.
 *
 *  once  (기본)  IntersectionObserver로 한 번 등장하고 끝.
 *                모든 브라우저에서 동작. 예측 가능. 포트폴리오에 안전.
 *
 *  scrub (선택)  CSS animation-timeline: view() — 스크롤 위치에 직접 묶입니다.
 *                메인 스레드 JS가 0줄이라 스크롤이 절대 끊기지 않습니다.
 *                단 2026년 7월 기준 글로벌 지원율 약 84%(Baseline 미달)이며,
 *                스크롤을 되감으면 애니메이션도 되감깁니다.
 *
 * 기본값을 'once'로 둔 이유:
 *   스크롤을 올릴 때 콘텐츠가 다시 사라지는 건 대부분의 방문자에게 성가십니다.
 *   채용담당자가 위로 다시 스크롤해서 확인하려는 순간 글자가 사라지면 최악입니다.
 *   'scrub'은 히어로 같은 연출 구간에만 쓰세요.
 *
 * ★ 중요한 안전장치
 *   "숨김" 상태는 .fx-scroll-reveal 클래스에만 걸려 있습니다.
 *   이 클래스는 JS가 마운트에 성공했을 때만 붙습니다.
 *   → JS가 실패하거나 가드에 걸리면 콘텐츠는 그냥 정상적으로 보입니다.
 *   콘텐츠를 CSS로 미리 숨겨두는 리빌 라이브러리는 JS가 죽으면
 *   페이지 전체가 백지가 됩니다. 그 사고를 구조적으로 막았습니다.
 */

import { defineEffect, observeVisibility } from '../_core/index.js';

const SUPPORTS_VIEW_TIMELINE =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('animation-timeline', 'view()');

const PRESETS = ['rise', 'depth', 'flip', 'swing', 'zoom'];

export const mount = defineEffect({
  name: 'scroll-reveal',

  defaults: {
    /** 'rise' | 'depth' | 'flip' | 'swing' | 'zoom' */
    preset: 'rise',
    /** 'once' | 'scrub' | 'auto'(지원되면 scrub, 아니면 once) */
    mode: 'once',

    /** 등장에 걸리는 시간(ms). once 모드에서만 유효 */
    duration: 700,
    /** 기본 지연(ms) */
    delay: 0,
    /** 형제 요소 간 지연 간격(ms). 0이면 동시 등장 */
    stagger: 80,
    /** 스태거 순번을 직접 지정(null이면 부모 안에서의 순서로 자동 계산) */
    index: null,

    /** rise 프리셋: 아래에서 올라오는 거리(px) */
    distance: 28,
    /** flip / swing 프리셋: 회전 각도(도) */
    rotate: 22,
    /** depth 프리셋: 뒤로 물러난 거리(px) */
    depth: 140,
    /** zoom / depth 프리셋: 시작 배율 */
    scale: 0.92,
    /** 원근 거리(px) */
    perspective: 1000,

    /** once 모드: 화면에 얼마나 들어와야 등장할지(0~1) */
    threshold: 0.15,
    /** once 모드: 감지 여유. 아래쪽 -10%는 "조금 더 올라와야" 등장하게 합니다 */
    rootMargin: '0px 0px -10% 0px',
    /** once 모드: 화면 밖으로 나가면 다시 숨길지 */
    repeat: false,

    /** scrub 모드: 애니메이션 구간 */
    rangeStart: 'entry 10%',
    rangeEnd: 'cover 40%',
  },

  guard: {
    // 동작 줄이기 사용자는 효과를 끕니다.
    // → .fx-scroll-reveal이 사라지므로 콘텐츠가 처음부터 그냥 보입니다.
    motion: 'skip',
    pointer: 'any',
  },

  setup({ el, opts, addCleanup, setVar, emit }) {
    /* --- 1. 프리셋 검증 ----------------------------------------------- */

    const preset = PRESETS.includes(opts.preset) ? opts.preset : 'rise';
    if (preset !== opts.preset) {
      console.warn(
        `[fx:scroll-reveal] 알 수 없는 preset "${opts.preset}". ` +
          `사용 가능: ${PRESETS.join(', ')}`
      );
    }
    el.dataset.fxPreset = preset;

    /* --- 2. 모드 결정 ------------------------------------------------- */

    let mode = opts.mode;
    if (mode === 'auto') mode = SUPPORTS_VIEW_TIMELINE ? 'scrub' : 'once';
    if (mode === 'scrub' && !SUPPORTS_VIEW_TIMELINE) {
      // 이 브라우저는 scroll-driven animation을 모릅니다. 조용히 once로 내려갑니다.
      mode = 'once';
    }
    el.dataset.fxMode = mode;

    /* --- 3. 스태거 순번 ----------------------------------------------- */

    // 부모 안에서의 순서를 기본 순번으로 씁니다.
    // 카드 그리드처럼 "부모의 자식이 전부 리빌 대상"인 경우가 압도적으로 흔합니다.
    let index = opts.index;
    if (index === null || index === undefined) {
      const attr = el.dataset.fxIndex;
      if (attr !== undefined) index = parseInt(attr, 10);
    }
    if (!Number.isFinite(index)) {
      const siblings = el.parentElement ? el.parentElement.children : [];
      index = Math.max(0, Array.prototype.indexOf.call(siblings, el));
    }

    /* --- 4. CSS 변수 -------------------------------------------------- */

    setVar('--fx-reveal-duration', `${opts.duration}ms`);
    setVar('--fx-reveal-delay', `${opts.delay + index * opts.stagger}ms`);
    setVar('--fx-reveal-distance', `${opts.distance}px`);
    setVar('--fx-reveal-rotate', `${opts.rotate}deg`);
    setVar('--fx-reveal-depth', `${-Math.abs(opts.depth)}px`);
    setVar('--fx-reveal-scale', opts.scale);
    setVar('--fx-reveal-perspective', `${opts.perspective}px`);

    if (mode === 'scrub') {
      setVar('--fx-reveal-start', opts.rangeStart);
      setVar('--fx-reveal-end', opts.rangeEnd);
    }

    /* --- 5. 감지 (once 모드만) ---------------------------------------- */

    if (mode === 'once') {
      let revealed = false;

      const stop = observeVisibility(el, {
        threshold: opts.threshold,
        rootMargin: opts.rootMargin,
        onEnter: () => {
          if (revealed && !opts.repeat) return;
          revealed = true;
          el.classList.add('is-revealed');
          emit('reveal', { index });
          // 다시 숨기지 않을 거라면 감시를 즉시 끊습니다(리스너 누수 방지).
          if (!opts.repeat) stop();
        },
        onLeave: () => {
          if (!opts.repeat) return;
          el.classList.remove('is-revealed');
        },
      });

      addCleanup(() => stop());

      /*
       * 페이지 로드 시 이미 화면 안에 있는 요소는
       * IntersectionObserver가 즉시 콜백을 주므로 별도 처리가 필요 없습니다.
       * 다만 stagger가 크면 첫 화면 콘텐츠가 늦게 뜨므로,
       * 히어로에는 stagger를 0~40ms로 낮추는 것을 권장합니다.
       */
    }

    /* --- 6. 정리 ------------------------------------------------------ */

    addCleanup(() => {
      el.classList.remove('is-revealed');
      delete el.dataset.fxPreset;
      delete el.dataset.fxMode;
      for (const prop of [
        '--fx-reveal-duration', '--fx-reveal-delay', '--fx-reveal-distance',
        '--fx-reveal-rotate', '--fx-reveal-depth', '--fx-reveal-scale',
        '--fx-reveal-perspective', '--fx-reveal-start', '--fx-reveal-end',
      ]) {
        el.style.removeProperty(prop);
      }
    });

    return {
      /** 수동으로 등장시키기 */
      reveal: () => el.classList.add('is-revealed'),
      /** 수동으로 되돌리기 */
      reset: () => el.classList.remove('is-revealed'),
      mode,
      index,
    };
  },
});

/** 이 브라우저가 CSS 스크롤 기반 애니메이션을 지원하는지 */
export const supportsScrubMode = () => SUPPORTS_VIEW_TIMELINE;

export default mount;
