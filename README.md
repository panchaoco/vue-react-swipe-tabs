<div align="center">

# Swipe Tabs

Mobile-friendly swipeable `TabBar` + `TabBarView` — for both **Vue 3** and **React**.

[![English](https://img.shields.io/badge/English-active-2c3e50?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/简体中文-readme-lightgrey?style=for-the-badge)](./README.zh-CN.md)

</div>

---

## What's inside

A pnpm monorepo with two parallel libraries — same algorithm, same visuals, same CSS, different framework idioms.

| Package | Framework | Docs |
| --- | --- | --- |
| [`vue-swipe-tabs`](./packages/vue-swipe-tabs/) | Vue 3 (TSX) | [README](./packages/vue-swipe-tabs/README.md) · [中文](./packages/vue-swipe-tabs/README.zh-CN.md) |
| [`react-swipe-tabs`](./packages/react-swipe-tabs/) | React 18 / 19 (TSX) | [中文](./packages/react-swipe-tabs/README.zh-CN.md) |

Both ship:
- **Single-screen jumps** — clicking a far tab slides the view by one screen, no matter how many tabs sit between current and target.
- **Live, proportional UI** — the indicator slides the full logical distance; the tab text color blends gray ↔ blue in real time as you drag.
- **Swipe gestures** — edge resistance, threshold-based commit, snap-back when below threshold.
- **State preserved** across tab switches (all pages mounted, repositioned, not unmounted).
- **TypeScript** declarations.

---

## Quick start

### Vue 3

```bash
pnpm add vue-swipe-tabs
```

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

Full API: [packages/vue-swipe-tabs/README.md](./packages/vue-swipe-tabs/README.md)

### React

```bash
pnpm add react-swipe-tabs
```

```tsx
import { useState } from 'react'
import { SwipeTabs } from 'react-swipe-tabs'
import 'react-swipe-tabs/style.css'

const tabs = ['推荐', '热门', '直播', '关注', '附近']

export default function App() {
  const [active, setActive] = useState(0)
  return (
    <SwipeTabs
      tabs={tabs}
      value={active}
      onChange={setActive}
      renderPage={({ index, active }) => (
        <div className="page">{tabs[index]} — active: {String(active)}</div>
      )}
    />
  )
}
```

Full API: [packages/react-swipe-tabs/README.zh-CN.md](./packages/react-swipe-tabs/README.zh-CN.md)

---

## How it works

Two ideas drive the implementation:

1. **Phantom slot.** Pages are absolutely positioned at `left: i*100%`. On a non-adjacent jump, the target page's `left` is *temporarily* set to "current ± 1", the track slides one screen, then both the `currentIndex` and the page's `left` reset to their natural values in a single paint cycle. Result: a one-screen slide regardless of distance, zero visual jump on settle.
2. **Decoupled state.** Separate fields drive (a) the logical resting position, (b) the visual track translation, (c) the indicator's fractional position, and (d) the "intent" index used for tab focus. This lets click navigation, drag tracking, and CSS transitions all run on the right clock without fighting each other.

Full write-up (Chinese, with diagrams): [docs/implementation.md](./docs/implementation.md)

---

## Development

Requires Node `^20.19 || >=22.12` and pnpm.

```bash
pnpm install                    # install all workspace deps

pnpm dev                        # run the Vue playground (vite dev)
pnpm dev:react                  # run the React playground

pnpm build                      # build both libraries
pnpm build:vue                  # build only vue-swipe-tabs
pnpm build:react                # build only react-swipe-tabs

pnpm build:playground           # build the Vue playground (consumes built lib)
pnpm build:playground:react     # build the React playground
pnpm preview                    # preview the Vue playground build
pnpm preview:react              # preview the React playground build
```

Workspace layout:

```
packages/
├── vue-swipe-tabs/      # Vue 3 library
├── react-swipe-tabs/    # React library
├── playground/          # Vue demo / smoke test
└── react-playground/    # React demo / smoke test
```

The playgrounds depend on the library packages via `workspace:*`, so they always exercise the actually-built `dist/` — not the source. Run `pnpm build:<framework>` after editing a library before testing in its playground.

---

## License

MIT
