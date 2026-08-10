# spotlight — 커서를 따라오는 은은한 빛

영역 위에서 커서가 움직이면 그 자리에 radial-gradient 광원이 따라붙습니다.
그리기는 전부 CSS(변수 + 그라디언트), JS는 좌표만 흘려 넣습니다 — 프레임 비용 ≈ 0.

## 바닐라

```html
<section class="fx-spotlight" data-fx="spotlight" data-fx-size="480" data-fx-strength="0.25">
  <h1>Hello</h1>
</section>
<script type="module">
  import { mount } from './effects/spotlight/index.js';
  mount('.fx-spotlight');
</script>
```

## 옵션

| 키 | 기본 | 설명 |
|---|---|---|
| `size` | 420 | 광원 지름(px) |
| `strength` | 0.22 | 광원 세기(0~1) |
| `color` | `''` | 비우면 테마 강조색(`--wf-accent`) |

터치 환경·포인터 없음에서는 마운트하지 않습니다(guard: pointer fine).
