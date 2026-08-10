/**
 * hover-preview — 리스트/카드 호버 시 커서를 따라 뜨는 썸네일
 * ───────────────────────────────────────────────────────────
 * 티어 T1 · 추가 용량 0KB · 포인터(마우스) 필요
 *
 * 포트폴리오 프로젝트 리스트의 표준 인터랙션입니다. 카드(.wf-card) 위에
 * 마우스를 올리면 그 카드의 이미지가 커서를 lerp로 따라다닙니다.
 * 이미지가 없는 카드에서는 아무 일도 일어나지 않습니다.
 *
 * rAF 루프는 **호버 중에만** 돕니다 — 커서가 카드를 떠나고 프리뷰가
 * 사라지면 루프도 멈춥니다. 상시 루프는 이 프로젝트가 피하는 것입니다.
 */

import { defineEffect, lerp, prefersReducedMotion } from '../_core/index.js';

export const mount = defineEffect({
  name: 'hover-preview',

  defaults: {
    /** 프리뷰 폭(px) */
    width: 240,
    /** 따라오는 속도 0..1 — 클수록 즉각적입니다 */
    speed: 0.16,
    /** 커서에서 얼마나 떨어져 뜨는지(px) */
    offsetX: 24,
    offsetY: -20,
    /** 살짝 기울이기(도). 0이면 수평 */
    rotate: 3,
    /** 프리뷰를 찾을 카드 선택자 */
    card: '.wf-card',
  },

  guard: {
    /* 터치에는 호버가 없습니다 — 마우스가 있을 때만. */
    pointer: 'fine',
    motion: 'ignore', // 커서를 따르는 것은 입력 반응이라 두되, 아래에서 lerp만 끕니다
  },

  setup({ el, opts, on, addCleanup }) {
    const doc = el.ownerDocument;
    const cards = [...el.querySelectorAll(opts.card)];
    if (!cards.length) return;

    /* 프리뷰 한 장을 영역마다 하나만 만듭니다. */
    const float = doc.createElement('div');
    float.className = 'fx-hover-preview__float';
    float.style.width = `${opts.width}px`;
    float.setAttribute('aria-hidden', 'true');
    const img = doc.createElement('img');
    img.alt = '';
    float.appendChild(img);
    doc.body.appendChild(float);
    addCleanup(() => float.remove());

    let x = 0, y = 0;        // 현재 위치(lerp 결과)
    let tx = 0, ty = 0;      // 목표 위치(커서)
    let raf = 0;
    let active = false;
    const instant = prefersReducedMotion(); // 동작 줄이기: 따라오되 관성 없이

    const step = () => {
      const k = instant ? 1 : opts.speed;
      x = lerp(x, tx, k);
      y = lerp(y, ty, k);
      float.style.transform =
        `translate(${(x + opts.offsetX).toFixed(1)}px, ${(y + opts.offsetY).toFixed(1)}px) rotate(${opts.rotate}deg)`;
      /* 목표에 붙었고 호버도 끝났으면 루프를 세웁니다. */
      if (!active && Math.abs(x - tx) < 0.5 && Math.abs(y - ty) < 0.5) { raf = 0; return; }
      raf = doc.defaultView.requestAnimationFrame(step);
    };
    const kick = () => { if (!raf) raf = doc.defaultView.requestAnimationFrame(step); };
    addCleanup(() => { if (raf) doc.defaultView.cancelAnimationFrame(raf); });

    for (const card of cards) {
      const src = card.querySelector('img')?.currentSrc || card.querySelector('img')?.src;
      if (!src) continue; // 이미지 없는 카드는 조용히 통과

      on(card, 'pointerenter', (e) => {
        img.src = src;
        active = true;
        /* 첫 프레임이 (0,0)에서 날아오지 않게 커서 위치에서 시작합니다. */
        x = tx = e.clientX; y = ty = e.clientY;
        float.classList.add('is-on');
        kick();
      });
      on(card, 'pointermove', (e) => { tx = e.clientX; ty = e.clientY; kick(); });
      on(card, 'pointerleave', () => {
        active = false;
        float.classList.remove('is-on');
      });
    }
  },
});

export default mount;
