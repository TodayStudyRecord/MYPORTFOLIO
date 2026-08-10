/**
 * 3D 효과 마운트.
 *
 * 옵션은 HTML의 data-fx-* 속성에 들어 있고, 효과 팩의 defineEffect가
 * 그걸 알아서 읽습니다(effects/_core/effect.js). 그래서 여기서는
 * "선택자마다 mount 한 번"만 부르면 끝입니다.
 *
 * 효과를 빼고 싶으면 아래 한 줄을 지우고 HTML의 data-fx도 지우면 됩니다.
 */

import { mount as tilt } from '../effects/tilt-card/index.js';
import { mount as spotlight } from '../effects/spotlight/index.js';
import { mount as parallax } from '../effects/parallax-layers/index.js';
import { mount as preview } from '../effects/hover-preview/index.js';

/**
 * 영역 안쪽 요소에 붙는 효과(tilt/flip/magnetic/scramble)는 옵션을 부모에서 읽습니다.
 * 효과가 둘 이상인 영역은 팩 이름 접두사(data-fx-<팩>-<키>)로 실려 옵니다 —
 * 접두사 속성이 하나라도 있으면 그것만, 없으면 옛 방식(접두사 없음)을 읽습니다.
 */
function readOpts(el, prefix) {
  const out = {};
  const scoped = prefix ? 'data-fx-' + prefix + '-' : null;
  const hasScoped = scoped && [...el.attributes].some((a) => a.name.startsWith(scoped));
  for (const { name, value } of el.attributes) {
    if (!name.startsWith('data-fx-')) continue;
    if (hasScoped && !name.startsWith(scoped)) continue;
    const raw = hasScoped ? name.slice(scoped.length) : name.slice(8);
    const key = raw.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = value === 'true' ? true : value === 'false' ? false
      : value !== '' && !Number.isNaN(Number(value)) ? Number(value)
      : value.includes(',') ? value.split(',') : value;
  }
  return out;
}

function boot() {
  const MODE_KEY = 'pm:dark';
  const applyMode = (dark) => {
    document.querySelectorAll('.wf-page').forEach((p) => {
      if (dark) {
        if (!p.dataset.lightStyle) p.dataset.lightStyle = p.getAttribute('style') || '';
        const v = (n) => getComputedStyle(p).getPropertyValue(n).trim();
        p.style.background = v('--wfm-bg');
        p.style.color = v('--wfm-text');
        p.style.setProperty('--wf-bg', v('--wfm-bg'));
        p.style.setProperty('--wf-text', v('--wfm-text'));
        p.style.setProperty('--wf-surface', v('--wfm-surface'));
        p.style.setProperty('--wf-line', v('--wfm-line'));
        p.style.setProperty('--wf-muted', v('--wfm-muted'));
      } else if (p.dataset.lightStyle !== undefined) {
        p.setAttribute('style', p.dataset.lightStyle);
      }
      p.classList.toggle('is-dark', dark);
    });
    try { localStorage.setItem(MODE_KEY, dark ? '1' : '0'); } catch { /* 시크릿 모드 등 */ }
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-mode-toggle]')) return;
    applyMode(!document.querySelector('.wf-page')?.classList.contains('is-dark'));
  });
  try { if (localStorage.getItem(MODE_KEY) === '1') applyMode(true); } catch { /* 저장 불가 환경 */ }
  {
    const hideEls = [...document.querySelectorAll('[data-hide-scroll]')].map((el) => el.closest('.wf-headbar') || el);
    if (hideEls.length) {
      let lastY = window.scrollY;
      window.addEventListener('scroll', () => {
        const y = window.scrollY;
        const dy = y - lastY;
        lastY = y;
        if (Math.abs(dy) < 4) return;
        hideEls.forEach((el) => el.classList.toggle('wf-nav-hidden', dy > 0 && y > 80));
      }, { passive: true });
    }
  }
  document.querySelectorAll('[data-fx~="tilt"]').forEach((el) => {
    const targets = el.querySelectorAll('.wf-card, .wf-main__slot');
    if (targets.length) tilt([...targets], readOpts(el, 'tilt-card'));
  });
  spotlight('[data-fx~="spotlight"]');
  parallax('[data-fx~="parallax"]');
  preview('[data-fx~="preview"]');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
