# vue-swipe-tabs

面向 H5 移动端的 Vue 3 可滑动 `TabBar` + `TabBarView` 组件。

> English: [README.md](./README.md)

- **单屏滑动** — 跨多个 tab 点击切换时，视图**只滑一屏**就到位，而不是真的滑过中间页。
- **实时按比例联动** — 指示器走完完整的逻辑距离；文字颜色随手势在灰 ↔ 蓝之间线性混合。
- **手势支持** — 边缘回弹阻尼、阈值判定、未达阈值自动 snap-back。
- **状态保留** — 所有页面始终挂载，切换 tab 不会卸载、不丢状态。
- **TypeScript 友好** — 自带类型声明。

---

## 安装

```bash
pnpm add vue-swipe-tabs
# 或
npm i vue-swipe-tabs
# 或
yarn add vue-swipe-tabs
```

> Peer 依赖：`vue ^3.3`

## 使用

### 方式一：注册为插件

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

### 方式二：按需导入

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
      <div class="page">{{ t }} — 当前激活: {{ active }}</div>
    </template>
  </SwipeTabs>
</template>
```

### 动态插槽（推荐用于较多 tab 的场景）

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

| 属性          | 类型       | 默认值  | 说明                                                  |
| ------------- | ---------- | ------- | ----------------------------------------------------- |
| `tabs`        | `string[]` | —       | tab 标签数组（必填）                                  |
| `modelValue`  | `number`   | `0`     | 当前激活 tab 的索引（配合 `v-model`）                 |
| `duration`    | `number`   | `280`   | 动画时长（毫秒）                                      |
| `threshold`   | `number`   | `0.25`  | 滑动距离/视口宽度的比值；超过该值释放手指才会切到邻页 |

## Events

| 事件                  | 载荷类型 | 说明                                  |
| --------------------- | -------- | ------------------------------------- |
| `update:modelValue`   | `number` | 激活 tab 变化时触发（`v-model` 用）   |
| `change`              | `number` | 同上，便于不使用 `v-model` 时监听     |

## Slots

| 插槽          | 作用域参数                                | 说明                  |
| ------------- | ----------------------------------------- | --------------------- |
| `page-${i}`   | `{ index: number; active: boolean }`      | 第 *i* 页的内容       |

`active` 在以下时机**立即翻转**（而不是等动画结束）：
- 点击 tab 的瞬间
- 拖动越过中点的瞬间

这样你可以提前触发懒加载、入场动画等。

---

## 工作原理

实现上有两个关键点：

1. **"幽灵槽位"机制**：所有页面 `position:absolute; left: i*100%` 绝对定位。点击跨页跳转时，**临时**把目标页的 `left` 改成"当前 ± 1"，track 只滑一屏到该位置，落定的同一帧里把 `currentIndex` 和目标页的 `left` 都恢复到原值——视觉上无跳变，不论距离多远都只滑一屏。
2. **状态解耦**：分别用独立的 ref 表达 (a) 逻辑静止位 `currentIndex`、(b) track 的视觉位移 `visualIndex`、(c) 指示器的分数位 `indicatorPos`、(d) 用于聚焦态的"意图"索引 `pendingTarget`。点击导航、拖动跟手、CSS 过渡因此各跑各的时钟，互不打架。

完整原理见 [`../../docs/implementation.md`](../../docs/implementation.md)。

---

## 自定义样式

组件自带样式，使用时无需额外引入 CSS。如果想覆盖颜色，按 BEM 命名定位即可：

```css
.swipe-tabs__bar { background: #fafafa; }
.swipe-tabs__indicator { background: #ff5500; }
```

激活文字颜色是写在内联样式上的（为了能在拖动过程中按比例混色），如需自定义可以 fork 或用 `!important` 覆盖。后续版本可能开放 CSS 变量。

提供的 CSS 变量（在根节点 `.swipe-tabs` 上）：

| 变量                       | 作用              |
| -------------------------- | ----------------- |
| `--swipe-tabs-duration`    | 动画时长（计算属性自动注入，对应 `duration` prop） |

---

## 同款 React 版本

如果你的项目是 React，请使用 [`react-swipe-tabs`](../react-swipe-tabs/README.zh-CN.md)，API 等价、视觉一致。

---

## 许可

MIT
