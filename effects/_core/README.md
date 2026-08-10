# `_core` — 공통 엔진

> **이 폴더는 필수입니다.** 효과 폴더 하나만 복사해도 `_core`는 같이 가져가야 합니다.
> 대신 이거 하나만 있으면 효과를 몇 개 붙이든 추가 비용이 거의 0입니다.

---

## 왜 이런 게 필요한가

3D 효과 8개를 각자 따로 만들면, 8개 전부에 아래를 중복해서 짜야 합니다.

| 반복되는 문제 | 빠뜨렸을 때 생기는 일 |
|---|---|
| `prefers-reduced-motion` 체크 | 전정기관 장애 사용자에게 멀미 유발 |
| 화면 밖에서 루프 정지 | 안 보이는 캔버스가 60fps로 배터리를 먹음 |
| 탭 백그라운드 처리 | 다른 탭 보는 중에도 GPU가 돌아감 |
| WebGL 지원 확인 | 구형 기기에서 빈 화면 |
| 이벤트 리스너 해제 | React 라우팅 시 메모리 누수 |
| 옵션 파싱 | HTML만 고쳐서 커스터마이징 불가 |

`_core`는 이 6가지를 한 번만 구현하고 모든 효과가 공유합니다.

---

## 파일 구성

```
_core/
├─ effect.js    ★ mount/destroy 계약 — 이 라이브러리의 심장
├─ guard.js       "지금 켜도 되는가" 판정 (접근성/성능/기능 지원)
├─ observer.js    rAF 루프 + 가시성 자동 일시정지
├─ loader.js      OGL/three/model-viewer 지연 로드
├─ math.js        clamp / lerp / damp / hexToRgb …
├─ core.css       공용 CSS 토큰 + 마운트 상태 클래스
├─ react.js       React 어댑터 (바닐라는 안 씀)
└─ index.js       배럴
```

---

## 핵심 계약

모든 효과는 **정확히 같은 모양**입니다.

```js
const handle = mount(target, options);

handle.destroy();          // 완전 원복
handle.update({ ... });    // 옵션 바꾸고 재시작
handle.items               // 요소별 개별 핸들 배열
handle.active              // 현재 켜져 있는지
```

### `target`으로 넣을 수 있는 것

```js
mount('.project-card')                       // 선택자 → 매칭되는 전부
mount(document.querySelector('#hero'))       // 단일 요소
mount(document.querySelectorAll('.card'))    // NodeList
mount([el1, el2])                            // 배열
```

요소가 1개든 20개든 반환 모양이 같아서 분기가 필요 없습니다.

---

## 옵션이 정해지는 순서

**나중 것이 이깁니다.**

```
효과의 defaults  →  HTML의 data-fx-*  →  JS 인자
```

```html
<!-- 디자이너/학생이 HTML만 고쳐서 조절 가능 -->
<div class="card" data-fx-max-tilt="18" data-fx-glare="false">…</div>
```

```js
// 코드로 넘기면 data 속성보다 우선
mount('.card', { maxTilt: 8 });
```

`camelCase` 옵션은 `data-fx-kebab-case`로 씁니다 (`maxTilt` → `data-fx-max-tilt`).
값은 자동으로 타입 변환됩니다: `"12"` → 숫자, `"false"` → 불리언, `"#a,#b"` → 배열, `"[1,2]"` → JSON.

> `defaults`에 없는 키는 **무시됩니다.** 오타가 조용히 넘어가지 않게 하려는 의도입니다.

---

## 가드 (`guard.js`)

효과 정의에 선언만 하면 됩니다.

```js
defineEffect({
  name: 'silk-bg',
  guard: {
    motion: 'skip',    // 'skip' = 동작 줄이기면 끔 | 'ignore' = 효과가 직접 처리
    pointer: 'any',    // 'fine' = 마우스 있을 때만 (hover 기반 효과)
    minWidth: 0,       // 이 폭 미만이면 끔
    webgl: true,       // WebGL 필요
    minTier: 'low',    // 'low' | 'mid' | 'high' 최소 기기 등급
  },
  setup(ctx) { /* … */ },
});
```

### 꺼졌을 때 무슨 일이 일어나나

```html
<!-- 효과가 꺼지면 DOM에 이유가 남습니다 -->
<div class="fx fx-inert" data-fx-skipped="reduced-motion">
```

`data-fx-skipped` 값: `reduced-motion` · `coarse-pointer` · `viewport-too-narrow` · `no-webgl` · `device-tier`

> **디버깅 팁:** 3D가 안 보이면 devtools에서 요소를 열어 `data-fx-skipped`를 먼저 보세요.
> 90%는 여기서 원인이 나옵니다.

### 실행 중 재평가

사용자가 페이지를 열어둔 채 OS 접근성 설정을 켜거나 창을 좁히면 **즉시 반영**됩니다.
새로고침이 필요 없습니다.

### 가드 강제 해제 (탈출구)

```js
mount('.card', { guard: false });   // 모든 검사 무시. 데모/캡처용으로만.
```

---

## 성능 규칙 (`observer.js`)

```js
import { createVisibleLoop } from '../_core/index.js';

const loop = createVisibleLoop(el, (dt, elapsed) => {
  // dt = 초 단위 시간차 → 60Hz든 144Hz든 같은 속도
  render(elapsed);
}, { fps: 0 });   // fps: 0 = 주사율 그대로, 30 = 절반으로 제한

ctx.addCleanup(() => loop.destroy());
```

자동으로 처리되는 것:

- 요소가 화면 밖 → `rAF` 완전 정지 (일시정지가 아니라 취소)
- 탭이 백그라운드 → 정지
- 탭 복귀 시 튀는 `dt`를 0.1초로 클램프
- fps 제한 시 건너뛴 시간을 누적해서 넘김 → **느려지지 않고 프레임만 줄어듦**

기기 등급별 자동 조절:

```js
import { dprCap, fpsCap } from '../_core/index.js';

const dpr = dprCap(2);      // 저사양 1.5 / 중간 2 / 고사양 최대 2
const fps = fpsCap();       // 저사양 30 / 그 외 무제한
```

---

## 지연 로드 (`loader.js`)

```js
import { loadOGL, prefetch } from '../_core/index.js';

const { Renderer, Program, Mesh } = await loadOGL();   // 이 순간에만 8KB 요청
```

동시에 여러 효과가 호출해도 **네트워크 요청은 1회**입니다.

### 버전 고정 / 오프라인

```js
import { setCDN } from './effects/_core/loader.js';

setCDN({
  ogl: 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm',  // 정확한 버전
  // ogl: '/vendor/ogl.js',                              // 사내망/오프라인
});
```

> 실제 배포에서는 메이저 범위(`@1`) 대신 **정확한 버전**을 박는 것을 권장합니다.
> CDN이 마이너 업데이트를 밀면 어느 날 갑자기 깨질 수 있습니다.

### 미리 받아두기

```js
prefetch(loadOGL);   // requestIdleCallback으로 유휴 시간에 미리 다운로드
```

---

## 직접 효과 만들기

`setup`은 정리 함수만 잘 등록하면 나머지는 `_core`가 처리합니다.

```js
// effects/my-effect/index.js
import { defineEffect, damp, createVisibleLoop } from '../_core/index.js';

export const mount = defineEffect({
  name: 'my-effect',
  defaults: { strength: 1 },
  guard: { motion: 'skip', pointer: 'fine' },

  setup({ el, opts, on, addCleanup, setVar, emit }) {
    let x = 0, target = 0;

    // on(): destroy 시 자동으로 removeEventListener 됩니다
    on(el, 'pointermove', (e) => { target = e.clientX; });

    const loop = createVisibleLoop(el, (dt) => {
      x = damp(x, target, 10, dt);
      setVar('--my-x', `${x}px`);
    });

    addCleanup(() => loop.destroy());
    emit('ready');
  },
});

export default mount;
```

`setup`에서 쓸 수 있는 것:

| 이름 | 설명 |
|---|---|
| `el` | 효과가 붙은 요소 |
| `opts` | 병합 완료된 옵션 |
| `on(target, type, fn, opts)` | 자동 해제되는 리스너 |
| `addCleanup(fn)` | 해제 시 실행할 함수 |
| `setVar('--x', v)` | `el`에 CSS 변수 설정 |
| `emit('ready', detail)` | `fx:<name>:ready` 커스텀 이벤트 발행 |

---

## React 어댑터 (`react.js`)

```jsx
import { useFx } from './effects/_core/react.js';
import { mount } from './effects/tilt-card/index.js';

function Card() {
  const ref = useFx(mount, { maxTilt: 14 });
  return <div ref={ref} className="card">…</div>;
}
```

이미 처리된 함정 2가지:

1. **StrictMode 이중 마운트** — `defineEffect`가 중복 마운트를 막습니다.
2. **매 렌더마다 새로 생기는 options 객체** — `ref`에 담아 deps에서 제외했습니다.
   값을 실제로 바꾸려면 `deps`에 원시값을 명시하세요: `useFx(mount, { maxTilt }, [maxTilt])`

---

## CSS 토큰 (`core.css`)

`:root`에서 덮어쓰면 8개 효과가 한꺼번에 따라옵니다.

```css
:root {
  --fx-accent: #ff5a3c;      /* 내 포트폴리오 색으로 */
  --fx-radius: 24px;
  --fx-duration: 320ms;
}
```

다크 모드는 `prefers-color-scheme`과 `html[data-theme]` 둘 다 지원합니다.
(테마 토글 버튼이 있으면 `data-theme`가 이깁니다)
