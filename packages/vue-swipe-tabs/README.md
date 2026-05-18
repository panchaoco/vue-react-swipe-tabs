<div align="center">

# vue-swipe-tabs

[![English](https://img.shields.io/badge/English-active-2c3e50?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/简体中文-readme-lightgrey?style=for-the-badge)](./README.zh-CN.md)

</div>

Mobile-friendly swipeable `TabBar` + `TabBarView` for Vue 3 (H5).

- **Single-screen jumps** — clicking a far tab slides the view by **one screen**, no matter how many tabs are between current and target.
- **Live, proportional UI** — the indicator slides the full logical distance; the tab text color blends gray ↔ blue in real time as you drag.
- **Swipe gestures** with edge resistance, threshold-based commit, and snap-back.
- **State preserved** across tab switches (all pages mounted, repositioned, not unmounted).
- **TypeScript** declarations included.

---

## Install

```bash
npm i vue-swipe-tabs
# or
pnpm add vue-swipe-tabs
# or
yarn add vue-swipe-tabs
```

> Peer: `vue ^3.3`

## Usage

### As a plugin

```ts
// main.ts
import { createApp } from 'vue'
import SwipeTabsPlugin from 'vue-swipe-tabs'
import App from './App.vue'

createApp(App).use(SwipeTabsPlugin).mount('#app')
```

```vue
<template>
  <SwipeTabs v-model="active" :tabs="['推荐', '热门', '直播', '关注', '附近']">
    <template #page-0>...</template>
    <template #page-1>...</template>
    <template #page-2>...</template>
    <template #page-3>...</template>
    <template #page-4>...</template>
  </SwipeTabs>
</template>
```

### Or import the component directly

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { SwipeTabs } from 'vue-swipe-tabs'

const tabs = ['推荐', '热门', '直播', '关注', '附近']
const active = ref(0)
</script>

<template>
  <SwipeTabs v-model="active" :tabs="tabs">
    <template v-for="(t, i) in tabs" :key="i" #[`page-${i}`]="{ active }">
      <div class="page">{{ t }} — active: {{ active }}</div>
    </template>
  </SwipeTabs>
</template>
```

### Dynamic slot pattern (recommended for many tabs)

```vue
<SwipeTabs v-model="active" :tabs="tabs">
  <template
    v-for="(t, i) in tabs"
    :key="i"
    #[`page-${i}`]="{ index, active }"
  >
    <YourPage :name="t" :index="index" :active="active" />
  </template>
</SwipeTabs>
```

---

## Props

| Prop          | Type       | Default | Description                                              |
| ------------- | ---------- | ------- | -------------------------------------------------------- |
| `tabs`        | `string[]` | —       | Tab labels (required)                                    |
| `modelValue`  | `number`   | `0`     | Active tab index (`v-model`)                             |
| `duration`    | `number`   | `280`   | Animation duration in ms                                 |
| `threshold`   | `number`   | `0.25`  | Swipe distance ratio (0–1) needed to commit a page change |

## Events

| Event                | Payload  | Description                              |
| -------------------- | -------- | ---------------------------------------- |
| `update:modelValue`  | `number` | Fires when the active tab changes        |
| `change`             | `number` | Same as above                            |

## Slots

| Slot          | Scope                                | Description                  |
| ------------- | ------------------------------------ | ---------------------------- |
| `page-${i}`   | `{ index: number; active: boolean }` | Content of the *i*-th page   |

The `active` slot prop flips **the moment** navigation starts (click) or crosses the halfway point (drag) — not when the animation ends — so you can lazy-load or trigger entry animations promptly.

---

## How it works

Two ideas drive the implementation:

1. **Phantom slot**: pages are absolutely positioned at `left: i*100%`. On a non-adjacent jump, the target page's `left` is *temporarily* set to "current ± 1", the track slides one screen, then both the `currentIndex` and the page's `left` reset to their natural values in a single paint cycle. Result: a one-screen slide regardless of distance, zero visual jump on settle.
2. **Decoupled state**: separate refs drive (a) the logical resting position, (b) the visual track translation, (c) the indicator's fractional position, and (d) the "intent" index used for tab focus. This lets click navigation, drag tracking, and CSS transitions all run on the right clock without fighting each other.

See [`docs/implementation.md`](./docs/implementation.md) for the full write-up (Chinese).

---

## Styling

The component ships scoped styles by default — no extra CSS import needed when using `<SwipeTabs />`.

If you want to override colors, target the BEM-ish class names:

```css
.swipe-tabs__bar { background: #fafafa; }
.swipe-tabs__indicator { background: #ff5500; }
```

The active text color is set inline so it can blend during drag. To customize it, fork the component or override with `!important` on a CSS rule. A future version may expose CSS custom properties for these.

---

## Development

```bash
npm install
npm run dev         # demo app at http://localhost:5173
npm run build       # builds the library to dist/
npm run build:demo  # builds the demo app
```

## License

MIT
