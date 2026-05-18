<div align="center">

# Swipe Tabs

H5 移动端可滑动 `TabBar` + `TabBarView` 组件 — 同时提供 **Vue 3** 与 **React** 双实现。

[![English](https://img.shields.io/badge/English-readme-lightgrey?style=for-the-badge)](./README.md)
[![简体中文](https://img.shields.io/badge/简体中文-active-c0392b?style=for-the-badge)](./README.zh-CN.md)

</div>

---

## 包含什么

一个 pnpm monorepo，下挂两个平行库——算法一致、视觉一致、CSS 一致，只是框架习惯不同。

| 包 | 框架 | 文档 |
| --- | --- | --- |
| [`vue-swipe-tabs`](./packages/vue-swipe-tabs/) | Vue 3 (TSX) | [English](./packages/vue-swipe-tabs/README.md) · [中文](./packages/vue-swipe-tabs/README.zh-CN.md) |
| [`react-swipe-tabs`](./packages/react-swipe-tabs/) | React 18 / 19 (TSX) | [中文](./packages/react-swipe-tabs/README.zh-CN.md) |

两个版本共同的特性：

- **单屏滑动** — 跨多个 tab 点击切换时，视图**只滑一屏**就到位，不管之间隔了多少页。
- **实时按比例联动** — 指示器走完完整的逻辑距离；文字颜色随手势在灰 ↔ 蓝之间线性混合。
- **手势支持** — 边缘回弹阻尼、阈值判定、未达阈值自动 snap-back。
- **状态保留** — 所有页面始终挂载，切换 tab 不会卸载、不丢状态。
- **TypeScript 友好** — 自带类型声明。

---

## 快速上手

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
      <div class="page">{{ t }} — 激活: {{ active }}</div>
    </template>
  </SwipeTabs>
</template>
```

完整 API：[packages/vue-swipe-tabs/README.zh-CN.md](./packages/vue-swipe-tabs/README.zh-CN.md)

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
        <div className="page">{tabs[index]} — 激活: {String(active)}</div>
      )}
    />
  )
}
```

完整 API：[packages/react-swipe-tabs/README.zh-CN.md](./packages/react-swipe-tabs/README.zh-CN.md)

---

## 工作原理

实现上有两个关键点：

1. **"幽灵槽位"机制**：所有页面 `position:absolute; left: i*100%` 绝对定位。点击跨页跳转时，**临时**把目标页的 `left` 改成"当前 ± 1"，track 只滑一屏到该位置，落定的同一帧里把 `currentIndex` 和目标页的 `left` 都恢复到原值——视觉上无跳变，不论距离多远都只滑一屏。
2. **状态解耦**：分别用独立字段表达 (a) 逻辑静止位 `currentIndex`、(b) track 的视觉位移 `visualIndex`、(c) 指示器的分数位 `indicatorPos`、(d) 用于聚焦态的"意图"索引 `pendingTarget`。点击导航、拖动跟手、CSS 过渡因此各跑各的时钟，互不打架。

完整原理（含示意图）：[docs/implementation.md](./docs/implementation.md)

---

## 本地开发

需要 Node `^20.19 || >=22.12` 与 pnpm。

```bash
pnpm install                    # 安装所有 workspace 依赖

pnpm dev                        # 启动 Vue playground
pnpm dev:react                  # 启动 React playground

pnpm build                      # 构建两个库
pnpm build:vue                  # 只构建 vue-swipe-tabs
pnpm build:react                # 只构建 react-swipe-tabs

pnpm build:playground           # 构建 Vue playground（消费构建后的库）
pnpm build:playground:react     # 构建 React playground
pnpm preview                    # 预览 Vue playground 构建产物
pnpm preview:react              # 预览 React playground 构建产物
```

Workspace 结构：

```
packages/
├── vue-swipe-tabs/      # Vue 3 库
├── react-swipe-tabs/    # React 库
├── playground/          # Vue demo / 冒烟测试
└── react-playground/    # React demo / 冒烟测试
```

两个 playground 通过 `workspace:*` 依赖各自的库包，所以它们消费的始终是真正打包后的 `dist/`——不是源码。改完库之后记得先 `pnpm build:<framework>`，再去 playground 里验证。

---

## 许可

MIT
