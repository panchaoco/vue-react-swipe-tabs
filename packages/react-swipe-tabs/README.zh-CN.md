<div align="center">

# react-swipe-tabs

[![简体中文](https://img.shields.io/badge/简体中文-active-c0392b?style=for-the-badge)](./README.zh-CN.md)

</div>

面向 H5 移动端的 React 可滑动 `TabBar` + `TabBarView` 组件。

- **单屏滑动** — 跨多个 tab 点击切换时，视图**只滑一屏**就到位，而不是真的滑过中间页。
- **实时按比例联动** — 指示器走完完整的逻辑距离；文字颜色随手势在灰 ↔ 蓝之间线性混合。
- **手势支持** — 边缘回弹阻尼、阈值判定、未达阈值自动 snap-back。
- **状态保留** — 所有页面始终挂载，切换 tab 不会卸载、不丢状态。
- **TypeScript 友好** — 自带类型声明，支持受控/非受控两种模式。

---

## 安装

```bash
pnpm add react-swipe-tabs
# 或
npm i react-swipe-tabs
# 或
yarn add react-swipe-tabs
```

> Peer 依赖：`react ^18 || ^19`、`react-dom ^18 || ^19`

## 使用

### 受控（推荐，配合 `useState`）

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
        <div className="page">
          {tabs[index]} — 当前激活: {String(active)}
        </div>
      )}
    />
  )
}
```

> **注意**：必须显式 `import 'react-swipe-tabs/style.css'`。React 没有 SFC 的 scoped 样式机制，库的 CSS 单独以 side-effect 形式提供。

### 非受控（使用 `defaultValue`）

```tsx
<SwipeTabs
  tabs={tabs}
  defaultValue={0}
  onChange={(i) => console.log('切到', i)}
  renderPage={({ index }) => <YourPage index={index} />}
/>
```

### 大量 tab 时的写法

```tsx
const tabs = ['推荐', '热门', '直播', '关注', '附近', '科技', '美食']

<SwipeTabs
  tabs={tabs}
  value={active}
  onChange={setActive}
  renderPage={({ index, active }) => (
    <YourPage name={tabs[index]} index={index} active={active} />
  )}
/>
```

---

## Props

| 属性            | 类型                                                              | 默认值  | 说明                                                  |
| --------------- | ----------------------------------------------------------------- | ------- | ----------------------------------------------------- |
| `tabs`          | `string[]`                                                        | —       | tab 标签数组（必填）                                  |
| `value`         | `number`                                                          | —       | 受控模式下的当前激活索引；省略则进入非受控           |
| `defaultValue`  | `number`                                                          | `0`     | 非受控模式的初始索引                                  |
| `onChange`      | `(index: number) => void`                                         | —       | 切换落定后回调（动画结束、状态稳定后）                |
| `duration`      | `number`                                                          | `280`   | 动画时长（毫秒）                                      |
| `threshold`     | `number`                                                          | `0.25`  | 滑动距离/视口宽度的比值；超过该值释放手指才会切到邻页 |
| `renderPage`    | `(info: { index: number; active: boolean }) => ReactNode`         | —       | 渲染第 `index` 页的内容（必填）                       |

### 受控 / 非受控

| 模式    | 触发条件                          | 行为                                                                                  |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------- |
| 受控    | 传了 `value` prop                 | 由父组件持有索引；当 `value` 变化时组件会动画到目标页，落定后再次 `onChange` 通知父组件 |
| 非受控  | 没传 `value`，可选 `defaultValue` | 索引由组件内部维护，每次切换都通过 `onChange` 通知                                    |

### `renderPage` 的 `active` 时机

`renderPage` 中收到的 `active` 在以下时机**立即翻转**（而不是等动画结束）：
- 点击 tab 的瞬间
- 拖动越过中点的瞬间

这样你可以提前触发懒加载、入场动画等。

---

## 工作原理

实现上有两个关键点（与 Vue 版完全一致的算法）：

1. **"幽灵槽位"机制**：所有页面 `position:absolute; left: i*100%` 绝对定位。点击跨页跳转时，**临时**把目标页的 `left` 改成"当前 ± 1"，track 只滑一屏到该位置，落定的同一帧里把 `currentIndex` 和目标页的 `left` 都恢复到原值——视觉上无跳变，不论距离多远都只滑一屏。
2. **状态解耦**：分别用独立字段表达 (a) 逻辑静止位 `currentIndex`、(b) track 的视觉位移 `visualIndex`、(c) 指示器的分数位 `indicatorPos`、(d) 用于聚焦态的"意图"索引 `pendingTarget`。点击导航、拖动跟手、CSS 过渡因此各跑各的时钟，互不打架。

### React 实现要点

| 关注点                     | 实现方式                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 动画状态                   | 全部放在单个 `useRef<State>` 对象里，配合 `useReducer` 触发强制重渲。等价于 Vue 的 `ref()` 反应式语义，避免事件处理函数里出现 stale closure。                                       |
| `touchmove.preventDefault` | React 17+ 起合成事件中的 `onTouchMove` 默认 `passive: true`，`preventDefault()` 会无效。组件用 `useEffect + addEventListener('touchmove', fn, { passive: false })` 手动挂载触摸监听。 |
| `transitionend` 冒泡       | 监听器加了 `e.target !== e.currentTarget` 保护，用户页面内容里如果有 transform 过渡冒泡上来不会触发 settle。                                                                       |

---

## 自定义样式

CSS 通过 `import 'react-swipe-tabs/style.css'` 引入，按 BEM 命名覆盖即可：

```css
.swipe-tabs__bar { background: #fafafa; }
.swipe-tabs__indicator { background: #ff5500; }
```

激活文字颜色是写在内联样式上的（为了能在拖动过程中按比例混色），如需自定义可以 fork 或用 `!important` 覆盖。后续版本可能开放 CSS 变量。

提供的 CSS 变量（在根节点 `.swipe-tabs` 上）：

| 变量                       | 作用              |
| -------------------------- | ----------------- |
| `--swipe-tabs-duration`    | 动画时长（自动注入，对应 `duration` prop） |

---

## 同款 Vue 版本

如果你的项目是 Vue 3，请使用 [`vue-swipe-tabs`](../vue-swipe-tabs/README.zh-CN.md)，API 等价、视觉一致。

---

## 许可

MIT
