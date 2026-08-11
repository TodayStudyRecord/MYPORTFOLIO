/**
 * smooth-scroll — Lenis 부드러운 스크롤
 * ───────────────────────────────────────────────────────────
 * 티어 T2 · 추가 용량 약 10KB(Lenis, CDN 지연 로드) · 상시 rAF 1개
 *
 * "요즘 포트폴리오 감성"의 큰 몫. 스크롤 입력을 관성 있는 움직임으로
 * 바꿉니다. Lenis는 자기 rAF 루프가 필요합니다 — 이 프로젝트에서 유일하게
 * 상시 루프를 허용하는 자리이므로, 사이트 전체에 **하나만** 켜세요.
 *
 * 동작 줄이기 사용자에게는 시작하지 않습니다(브라우저 기본 스크롤 유지).
 * CDN 로드에 실패해도 기본 스크롤 그대로라 잃는 것이 없습니다.
 */

import { defineEffect, loadModule } from '../_core/index.js';

const LENIS_CDN = 'https://cdn.jsdelivr.net/npm/lenis@1/+esm';

export const mount = defineEffect({
  name: 'smooth-scroll',

  defaults: {
    /** 감속 정도 0..1 — 클수록 오래 미끄러집니다 */
    lerp: 0.1,
    /** 휠 한 칸의 이동 배율 */
    wheelMultiplier: 1,
  },

  guard: {
    motion: 'skip',   // 관성 스크롤이야말로 '움직임'입니다
    pointer: 'any',
  },

  setup({ el, opts, addCleanup }) {
    const win = el.ownerDocument.defaultView ?? window;
    let lenis = null;
    let raf = 0;
    let cancelled = false;

    loadModule(LENIS_CDN)
      .then((mod) => {
        if (cancelled) return;
        const Lenis = mod.default ?? mod.Lenis;
        lenis = new Lenis({ lerp: opts.lerp, wheelMultiplier: opts.wheelMultiplier });
        const loop = (time) => { lenis.raf(time); raf = win.requestAnimationFrame(loop); };
        raf = win.requestAnimationFrame(loop);
      })
      .catch(() => { /* CDN 실패 → 기본 스크롤. 조용한 퇴화가 맞습니다. */ });

    addCleanup(() => {
      cancelled = true;
      if (raf) win.cancelAnimationFrame(raf);
      lenis?.destroy?.();
    });
  },
});

export default mount;
