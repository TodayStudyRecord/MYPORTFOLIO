# `parallax-layers` — 히어로 깊이감 레이어

> **티어 T1** · 추가 용량 **0KB** · 의존성 없음 · 모바일에서도 스크롤 시차 동작

배경 → 중간 → 전경 레이어가 **마우스와 스크롤 양쪽에** 서로 다른 속도로 반응합니다.
`tilt-card`가 카드 하나를 다룬다면, 이건 **히어로 섹션 전체**를 다룹니다.

---

## 1. 붙이기 — 바닐라

```html
<link rel="stylesheet" href="./effects/_core/core.css" />
<link rel="stylesheet" href="./effects/parallax-layers/style.css" />

<section class="hero fx-hero">
  <img class="fx-hero__bg" src="./bg.jpg" alt="" data-fx-layer="0.15" />

  <div class="fx-hero__blob" data-fx-layer="0.9"
       style="background:#7c6cff; justify-self:start; align-self:start; margin:8%"></div>

  <div class="fx-hero__content" data-fx-layer="0.5">
    <h1 class="fx-hero__title">프론트엔드 개발자<br />김하늘</h1>
    <p class="fx-hero__sub">React · TypeScript · 인터랙션 디자인</p>
  </div>
</section>

<script type="module">
  import { mount } from './effects/parallax-layers/index.js';
  mount('.hero');
</script>
```

## 2. 붙이기 — React

```jsx
import { ParallaxScene, Layer } from './effects/parallax-layers/react.jsx';

export default function Hero() {
  return (
    <ParallaxScene className="fx-hero" mouseStrength={30}>
      <Layer as="img" depth={0.15} className="fx-hero__bg" src="/bg.jpg" alt="" />
      <Layer depth={0.5} className="fx-hero__content">
        <h1 className="fx-hero__title">프론트엔드 개발자<br />김하늘</h1>
        <p className="fx-hero__sub">React · TypeScript</p>
      </Layer>
    </ParallaxScene>
  );
}
```

---

## 3. 레이어 계수 — 이 효과의 전부

`data-fx-layer="0.4"` 의 숫자가 **움직임 계수**입니다.

| 값 | 의미 |
|---|---|
| `0` | 완전 고정 (기준면) |
| `0.1 ~ 0.2` | 아주 먼 배경 |
| `0.3 ~ 0.5` | 본문 / 주요 콘텐츠 |
| `0.6 ~ 0.9` | 전경 장식, 블롭, 아이콘 |
| `1` 이상 | 과장된 강조 (1.5 넘으면 어지럽습니다) |

> **핵심:** 깊이감은 절대값이 아니라 **계수의 차이**에서 나옵니다.
> `0.4 / 0.45 / 0.5`는 그냥 통째로 움직이는 것처럼 보입니다.
> `0.15 / 0.5 / 0.9`처럼 **최소 3배 차이**를 두세요.

### 음수도 됩니다

```html
<div data-fx-layer="-0.3">   <!-- 다른 레이어와 반대로 움직임 -->
```

배경과 전경을 반대로 흘리면 깊이가 극적으로 과장됩니다. 절제해서 쓰세요.

---

## 4. 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `mouse` | `true` | 마우스 반응 사용 |
| `mouseStrength` | `26` | 계수 1일 때 마우스로 움직이는 최대 거리(px) |
| `scroll` | `true` | 스크롤 반응 사용 |
| `scrollStrength` | `70` | 계수 1일 때 스크롤로 움직이는 최대 거리(px) |
| `depth` | `0` | 계수 1일 때 실제 `translateZ`(px). 0이면 평면 시차만 |
| `perspective` | `1200` | 원근 거리(px). `depth > 0`일 때만 의미 있음 |
| `speed` | `9` | 따라오는 속도. 6=느긋함, 9=기본, 18=즉각적 |
| `pointerTarget` | `'window'` | `'self'`로 바꾸면 이 요소 위에서만 반응 |
| `idleSleep` | `0.4` | 수렴 후 이 시간(초) 뒤 루프 정지 |

> **`pointerTarget`을 `'window'`로 둔 이유:** 히어로 위에 커서를 올려야만 반응하면
> 스크롤만 하고 지나가는 대부분의 방문자는 효과를 아예 못 봅니다.

---

## 5. 진짜 3D로 쓰기

기본값(`depth: 0`)은 **평면 시차**입니다. 가볍고 안전합니다.
진짜 Z축 입체를 원하면:

```js
mount('.hero', { depth: 80, perspective: 1000 });
```

레이어들이 실제로 앞뒤로 배치되어 **원근 왜곡**까지 생깁니다.
다만 `overflow: hidden`인 부모 안에서는 잘릴 수 있으니 여백을 넉넉히 주세요.

---

## 6. 성능 노트

**컨테이너에 CSS 변수 3개만 씁니다.**
레이어가 3개든 10개든 프레임당 JS 쓰기는 **3번**입니다. 곱셈은 CSS `calc`가 처리합니다.

**가만히 있으면 잠듭니다.**
수렴 후 `idleSleep`초 동안 입력이 없으면 `rAF`를 멈춥니다.
히어로는 화면에 오래 머무는 영역이라 이 절전이 실제 배터리에 차이를 만듭니다.
마우스가 움직이거나 스크롤하면 즉시 깨어납니다.

**화면 밖이면 완전 정지.**
`rootMargin: 200px` — 화면에 들어오기 직전에 미리 깨어나서 자연스럽게 이어집니다.

---

## 7. 자주 겪는 문제

**Q. 움직이지 않습니다.**
→ ① 자식에 `data-fx-layer`가 있는지 확인 (콘솔에 경고가 뜹니다).
→ ② 요소의 `data-fx-skipped`가 `reduced-motion`인지 확인.

**Q. 배경 이미지 가장자리에 빈 공간이 생깁니다.**
→ 배경은 컨테이너보다 **크게** 잡아야 합니다. `.fx-hero__bg`가 `108%`인 이유입니다.
계수를 키웠다면 그만큼 더 키우세요: 여유분 ≈ `mouseStrength × 계수 × 2`px.

**Q. 스크롤 시차가 너무 셉니다.**
→ `scrollStrength`를 40 이하로 낮추세요. 스크롤 시차는 마우스 시차보다 **훨씬 눈에 띕니다.**

**Q. 모바일에서 마우스 효과가 없습니다.**
→ 정상입니다. 터치에는 `pointermove`가 hover처럼 오지 않습니다. 스크롤 시차는 그대로 동작합니다.

**Q. 첫 스크롤에서 콘텐츠가 갑자기 튑니다.**
→ 마운트 시점에 스크롤 위치를 읽어 초기값을 맞춰두었습니다. 그래도 튄다면
이미지 로딩으로 레이아웃이 밀린 경우이니 `<img>`에 `width`/`height` 또는 `aspect-ratio`를 지정하세요.
