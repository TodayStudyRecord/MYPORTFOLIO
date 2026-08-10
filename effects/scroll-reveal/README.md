# `scroll-reveal` — 스크롤 3D 등장

> **티어 T0** · 추가 용량 **0KB** · 의존성 없음 · **모든 환경에서 동작**

스크롤해서 화면에 들어오면 요소가 3D로 등장합니다. 프리셋 5종.

---

## 1. 붙이기 — 바닐라

```html
<link rel="stylesheet" href="./effects/_core/core.css" />
<link rel="stylesheet" href="./effects/scroll-reveal/style.css" />

<section class="projects">
  <article class="reveal">…</article>
  <article class="reveal">…</article>
  <article class="reveal">…</article>
</section>

<script type="module">
  import { mount } from './effects/scroll-reveal/index.js';
  mount('.reveal', { preset: 'flip', stagger: 90 });
</script>
```

## 2. 붙이기 — React

```jsx
import { Reveal, RevealGroup } from './effects/scroll-reveal/react.jsx';

<Reveal preset="rise" stagger={0}>
  <h2>프로젝트</h2>
</Reveal>

<RevealGroup preset="flip" stagger={90} className="grid">
  <ProjectCard /> <ProjectCard /> <ProjectCard />
</RevealGroup>
```

---

## 3. 프리셋

| 프리셋 | 움직임 | 어울리는 곳 |
|---|---|---|
| `rise` **(기본)** | 아래에서 위로 | 어디에나. 고민되면 이거 |
| `depth` | 뒤에서 앞으로 (진짜 Z축) | 히어로 다음 첫 섹션 |
| `flip` | 바닥에서 카드가 일어섬 | 프로젝트 카드 그리드 |
| `swing` | 옆에서 문이 열리듯 | 타임라인 · 리스트 |
| `zoom` | 살짝 커지며 등장 | 이미지 · 썸네일 |

> **한 페이지에 프리셋 2개까지.** 3개 넘어가면 산만해서 콘텐츠가 안 읽힙니다.
> 보통 "본문 = rise, 카드 그리드 = flip" 조합이면 충분합니다.

---

## 4. 두 가지 모드 — 이 효과의 핵심 설계

### `mode: 'once'` (기본값)

`IntersectionObserver`로 **한 번 등장하고 끝.** 모든 브라우저에서 동작합니다.

### `mode: 'scrub'`

CSS `animation-timeline: view()` — **스크롤 위치에 직접 묶입니다.**
메인 스레드 JS가 **0줄**이라 스크롤이 아무리 무거워도 절대 끊기지 않습니다.

```js
mount('.hero-line', { mode: 'scrub', preset: 'depth' });
```

| | `once` | `scrub` |
|---|---|---|
| 브라우저 지원 | 100% | **약 84%** (Baseline 미달) |
| 스크롤 되감기 | 그대로 유지 | **같이 되감김** |
| 메인 스레드 비용 | IO 콜백 1회 | **0** |
| 예측 가능성 | 높음 | 스크롤 속도에 따라 달라짐 |

### 왜 기본값이 `once`인가

스크롤을 올릴 때 콘텐츠가 다시 사라지는 건 대부분의 방문자에게 성가십니다.
**채용담당자가 위로 다시 스크롤해서 확인하려는 순간 글자가 사라지면 최악입니다.**
`scrub`은 히어로 같은 연출 구간에만 쓰세요.

미지원 브라우저에서 `scrub`을 지정하면 **JS가 자동으로 `once`로 강등**합니다.
`mode: 'auto'`는 지원되면 `scrub`, 아니면 `once`입니다.

---

## 5. 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `preset` | `'rise'` | 위 표 참고 |
| `mode` | `'once'` | `'once'` / `'scrub'` / `'auto'` |
| `duration` | `700` | 등장 시간(ms). `once` 모드만 |
| `delay` | `0` | 기본 지연(ms) |
| `stagger` | `80` | 형제 간 지연 간격(ms). **0이면 동시 등장** |
| `index` | `null` | 스태거 순번 직접 지정 |
| `distance` | `28` | `rise` 이동 거리(px) |
| `rotate` | `22` | `flip`/`swing` 회전 각도(도) |
| `depth` | `140` | `depth` 후퇴 거리(px) |
| `scale` | `0.92` | `zoom`/`depth` 시작 배율 |
| `threshold` | `0.15` | 얼마나 들어와야 등장할지(0~1) |
| `rootMargin` | `'0px 0px -10% 0px'` | 감지 여유 |
| `repeat` | `false` | 화면 밖으로 나가면 다시 숨길지 |

---

## 6. 스태거 튜닝

`stagger`는 **개수에 반비례**해서 잡아야 합니다.

| 항목 수 | 권장 `stagger` | 전체 소요 |
|---|---|---|
| 2~4개 | `90 ~ 120ms` | ~0.5초 |
| 5~8개 | `60 ~ 80ms` | ~0.6초 |
| 9개 이상 | `30 ~ 45ms` | ~0.5초 |

> **전체 등장이 0.8초를 넘기지 마세요.** 마지막 카드를 기다리는 게 느껴지는 순간
> 효과가 아니라 지연이 됩니다.

**첫 화면(히어로)에는 `stagger: 0` 또는 `40` 이하.**
페이지에 들어오자마자 콘텐츠가 순차적으로 뜨면 로딩이 느린 것처럼 보입니다.

### 순번은 어떻게 정해지나

기본은 **부모 안에서의 순서**입니다. 카드 그리드처럼 부모의 자식이 전부 리빌 대상인
경우에 딱 맞습니다. 직접 지정하려면:

```html
<article class="reveal" data-fx-index="0">
```

React의 `<RevealGroup>`은 자동으로 `index`를 넣어줍니다(조건부 렌더링이 섞여도 안전).

---

## 7. ★ JS가 죽어도 콘텐츠가 사라지지 않습니다

**"숨김" 상태는 `.fx-scroll-reveal` 클래스에만 걸려 있습니다.**
이 클래스는 JS가 마운트에 성공했을 때만 붙습니다.

| 상황 | 결과 |
|---|---|
| JS 로드 실패 / 문법 에러 | 콘텐츠가 **애니메이션 없이 그냥 보입니다** |
| 동작 줄이기 ON | 콘텐츠가 **처음부터 보입니다** |
| 구형 브라우저 | 콘텐츠가 **그냥 보입니다** |

콘텐츠를 CSS로 미리 숨겨두는 리빌 라이브러리는 JS가 죽으면 **페이지 전체가 백지**가 됩니다.
GitHub Pages에 경로를 잘못 올려 JS가 404 나는 일은 학생 포트폴리오에서 매우 흔합니다.
그 사고를 구조적으로 막았습니다.

---

## 8. 수동 제어

```js
const handle = mount('.reveal');
handle.items[2].api.reveal();  // 3번째를 수동으로 등장
handle.items[2].api.reset();   // 되돌리기
handle.api.mode;               // 실제로 적용된 모드('once' 또는 'scrub')
```

```js
document.addEventListener('fx:scroll-reveal:reveal', (e) => {
  console.log('등장:', e.target, e.detail.index);
});
```

브라우저 지원 확인:

```js
import { supportsScrubMode } from './effects/scroll-reveal/index.js';
console.log(supportsScrubMode()); // true / false
```

---

## 9. 자주 겪는 문제

**Q. 첫 화면 요소가 등장하지 않습니다.**
→ `rootMargin`의 `-10%` 때문에 "조금 더 올라와야" 등장합니다.
첫 화면 요소는 `rootMargin: '0px'`로 두거나 `threshold: 0`으로 낮추세요.

**Q. 스크롤을 빠르게 내리면 여러 개가 한꺼번에 뜹니다.**
→ 정상입니다. `IntersectionObserver`는 실제 진입 시점에 반응합니다.
빠른 스크롤에서도 순차 등장을 원하면 `stagger`를 키우세요.

**Q. `flip`이 잘립니다.**
→ 회전 시 요소가 부모 밖으로 나갑니다. 부모의 `overflow: hidden`을 풀거나 `rotate`를 15 이하로 낮추세요.

**Q. `scrub` 모드가 안 먹습니다.**
→ 브라우저 미지원입니다. `handle.api.mode`를 찍어보면 `'once'`로 강등된 게 보입니다.
Firefox 132 미만이 가장 흔한 원인입니다.

**Q. 마지막 카드가 너무 늦게 뜹니다.**
→ `stagger × 개수`를 계산해보세요. 12개 × 80ms = **0.96초**입니다. 위의 스태거 표를 따르세요.
