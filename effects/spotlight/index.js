/**
 * spotlight — 커서를 따라오는 은은한 빛
 * ───────────────────────────────────────────────────────────
 * 티어 T1 · 추가 용량 0KB · 마우스 환경 전용
 *
 * 영역 위에서 커서가 움직이면 그 자리에 radial-gradient 광원이 따라붙습니다.
 * 실제 그리기는 전부 CSS(변수 + 그라디언트)가 하고, JS는 좌표만 흘려 넣습니다.
 * 그래서 프레임 비용이 사실상 0이고, 커서가 떠나면 부드럽게 꺼집니다.
 *
 * 색을 비우면 테마 강조색(--wf-accent)을 그대로 씁니다 — 테마를 바꿔도
 * 광원이 함께 물듭니다.
 */

import { defineEffect } from '../_core/index.js';

export const mount = defineEffect({
  name: 'spotlight',

  defaults: {
    /** 광원 지름(px) */
    size: 420,
    /** 광원 세기(0~1) — 그라디언트 중심의 불투명도 */
    strength: 0.22,
    /** 광원 색. 비우면 테마 강조색(--wf-accent) */
    color: '',
  },

  guard: {
    motion: 'ignore',  // 움직임이 아니라 조명 — 동작 줄이기에서도 해가 없습니다
    pointer: 'fine',   // 터치에는 "따라올 커서"가 없습니다
  },

  setup({ el, opts, on, addCleanup, setVar }) {
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
      addCleanup(() => { el.style.removeProperty('position'); });
    }

    const glow = el.ownerDocument.createElement('i');
    /* fx-layer — 배경 레이어 공용 표식. 다른 팩의 "콘텐츠를 앞으로" 규칙이
       이 광원을 콘텐츠로 착각해 흐름에 끼워 넣지 않게 합니다. */
    glow.className = 'fx-spotlight__glow fx-layer';
    glow.setAttribute('aria-hidden', 'true');
    el.appendChild(glow);
    addCleanup(() => glow.remove());

    setVar('--fx-spot-size', `${opts.size}px`);
    setVar('--fx-spot-alpha', String(opts.strength));
    if (opts.color) setVar('--fx-spot-color', opts.color);

    on(el, 'pointermove', (e) => {
      const r = el.getBoundingClientRect();
      setVar('--fx-spot-x', `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
      setVar('--fx-spot-y', `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
    });
    on(el, 'pointerenter', () => el.classList.add('is-spot-on'));
    on(el, 'pointerleave', () => el.classList.remove('is-spot-on'));
    addCleanup(() => el.classList.remove('is-spot-on'));
  },
});
