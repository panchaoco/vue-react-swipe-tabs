# SwipeTabs 实现原理

仿 Flutter `TabBar` + `TabBarView` 的 H5 移动端实现。核心目标：

- 跨多个 tab 点击切换时，TabBarView **只滑一屏**就到位，而不是真的滑过中间页
- TabBar 上的指示器、文字颜色、激活态对**点击/手势全程**实时同步、且**按滑动比例**线性变化

源文件：[src/components/SwipeTabs.vue](../src/components/SwipeTabs.vue)

---

## 一、整体结构

```
┌─ swipe-tabs (root, 设置 --swipe-tabs-duration) ────────────┐
│ ┌─ swipe-tabs__bar (可选 --dragging 类) ────────────┐ │
│ │  [tab 0] [tab 1] [tab 2] ... [tab N]        │ │
│ │  ─────────── swipe-tabs__indicator ───────────   │ │
│ └──────────────────────────────────────────────┘ │
│ ┌─ swipe-tabs__viewport (overflow:hidden) ──────────┐ │
│ │ ┌─ swipe-tabs__track (translateX) ──────────────┐ │ │
│ │ │ [page 0][page 1]...[page N]              │ │ │
│ │ │  每页 position:absolute; left: i*100%    │ │ │
│ │ └──────────────────────────────────────────┘ │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**所有 N 个页面同时挂载**，按 `left: i*100%` 绝对定位。track 通过 `translate3d(-currentIndex*100%)` 把当前页推到视口里。

这样做的好处：

- 页面状态天然保留（不卸载）
- 不需要为切换写 leave/enter 动画

---

## 二、状态机

```ts
currentIndex            // 静止时真正所处的 tab（"逻辑位置"）
visualIndex             // track 当前 translate 到的页（"视觉位置"）
phantomTarget           // 跨 tab 跳转时，目标页被"借位"挪到的目的地
pendingTarget           // 点击导航的目标 — 用于让激活态立刻翻过去
transitioning           // track 的 CSS transition 开关
animating               // 整体动画进行中标志（互斥锁）

indicatorPos            // 指示器小数位置（独立于 visualIndex）
indicatorTransitioning  // 指示器的 transition 开关

dragDx                  // 手指当前水平偏移 (px)，松手后**保留**到下一帧
dragging                // 是否处于"跟手"模式
```

关键点：**逻辑、视觉、意图三层解耦**：

| 层 | 变量 | 用途 |
|---|---|---|
| 逻辑 | `currentIndex` | 真正的 tab 索引，对外通过 `v-model` 同步 |
| 视觉 | `visualIndex` / `indicatorPos` / `dragDx` | 屏上当前看到的位置 |
| 意图 | `activeIndex` (computed) | 用户"想去的"位置，驱动激活态 UI |

---

## 三、关键技巧 1：跨多 tab 只滑一屏（Flutter Jump）

### 问题

标准做法是 `translate(-target*100%)`，从 tab 0 到 tab 6 会真的滑过 6 屏，慢且视觉杂乱。

### 解法：Phantom Slot

```ts
function pageLeft(i: number): string {
  if (
    phantomTarget.value === i &&
    Math.abs(i - currentIndex.value) > 1
  ) {
    const adjacent = i > currentIndex.value
      ? currentIndex.value + 1
      : currentIndex.value - 1
    return `${adjacent * 100}%`
  }
  return `${i * 100}%`
}
```

跨 tab 跳转时，目标页的 `left` 被**临时改成"当前页相邻"**位置。例如 0 → 6 时，page 6 暂时被挪到 `left: 100%`（紧贴 page 0）。

### 三阶段切换流程

```text
帧 A: phantomTarget = 6, transitioning = false
      → 浏览器布局：page 6 出现在 page 0 旁边（无动画）

帧 B (nextTick + 双 RAF):
      transitioning = true
      visualIndex = 1   // track 滑一屏到 page 6 的"借位"
      dragDx = 0        // 同时清掉拖动残余偏移（详见技巧 4）

      → 浏览器：transform 从 0% → -100%，按 transition 动画

帧 C (transitionend):
      settle()
      → currentIndex = 6, visualIndex = 6, phantomTarget = null
      → page 6 的 left 还原到 600%，track translateX 切到 -600%
      → 同一 paint cycle 完成，视觉零跳变
```

**为什么要双 RAF**：第一个 `await nextTick()` 让 Vue 提交 DOM；外层 RAF 让浏览器**实际渲染**那一帧（确认 transitioning 仍是 false），内层 RAF 才修改 transform。少一层都会让浏览器跳过中间状态、直接合并成一次"动画到最终位置"，phantom 借位失效。

---

## 四、关键技巧 2：指示器走完整逻辑距离

`visualIndex` 跨 tab 跳转时只动 ±1（因为 track 只滑一屏），所以**不能拿它驱动指示器**——否则 0→6 的指示器只动一格然后瞬移到目标，会抖。

解法：指示器用**独立** `indicatorPos`：

```ts
// goTo() 入口处
indicatorTransitioning.value = true
indicatorPos.value = target   // ← 直接跳到目标，让 CSS 在 duration 内插值
```

`indicatorPos` 的 CSS transition 和 track 的 transition 用同一个 `duration`，结束时刻基本一致，但**距离不同**：track 走一屏，指示器走完整距离。

---

## 五、关键技巧 3：手势 → 实时跟手 + 平滑过渡

### 跟手

`onTouchMove` 直接：

```ts
dragDx.value = next                                   // 影响 track（trackStyle 中 dragPercent）
indicatorPos.value = currentIndex - next / viewportW  // 影响指示器
```

且把 `indicatorTransitioning` 和 `transitioning` 都设为 `false`，CSS transition 关闭，1:1 跟手指。

### 边界阻尼

```ts
if (currentIndex === 0 && next > 0) next *= 0.3
if (currentIndex === lastIndex && next < 0) next *= 0.3
```

第一页右拉 / 最后一页左拉时偏移衰减到 30%，做出"撞墙感"。

### 提交 vs 回弹

`onTouchEnd` 根据 `|dragDx / viewportWidth| > threshold` 决定：

- **提交**：调 `goTo(target)`，复用主流程
- **回弹**：本地 RAF，再开 transition、清 dragDx，从手松位平滑回到原位

---

## 六、关键技巧 4：松手不抖回

### 错误版本

```ts
function onTouchEnd() {
  dragging.value = false
  dragDx.value = 0       // ❌ 立刻清零
  goTo(target)
}
```

`trackStyle` 见 `dragDx = 0` 立刻把 transform 算成 `-currentIndex*100%`，且此时 `transitioning` 还是 false → 视觉**瞬间还原到 currentIndex**。几帧后 `goTo` 才开 transition，过渡变成"从已还原的位置 → 目标"，肉眼看到一次抖动。

### 正确版本

```ts
function onTouchEnd() {
  dragging.value = false          // 关掉跟手模式（但 dragDx 不动）
  // dragDx 保持在松手时的值，trackStyle 仍然渲染在手松位
  goTo(target)
}

// goTo 内部
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    transitioning.value = true    // 开 transition
    dragDx.value = 0              // 同一 tick 清零
    visualIndex.value = adjacent  // 同一 tick 切到目标
  })
})
```

浏览器在同一 paint cycle 看到：

- transform 旧值：`calc(-currentIndex*100% + dragPercent%)` （手松位）
- transform 新值：`calc(-adjacent*100% + 0%)`
- transition：`transform 280ms ease-out`

→ 直接从"手松位"过渡到"目标位"，**中间不还原**。

---

## 七、关键技巧 5：激活态按比例线性混色

```ts
function tabColor(i: number): string {
  let t: number
  if (dragging.value) {
    const frac = currentIndex - dragDx / viewportWidth
    t = Math.max(0, 1 - Math.abs(frac - i))
  } else {
    t = activeIndex === i ? 1 : 0
  }
  // 在 #666 (102,102,102) 与 #1989fa (25,137,250) 之间线性插值
  return `rgb(${...})`
}
```

| 场景 | `t` 来源 | transition |
|---|---|---|
| 拖动中 | 离 `frac` 的距离，0~1 连续 | `.swipe-tabs__bar--dragging` 类把 CSS transition 关掉 → 完全跟手 |
| 点击切换 | 离散 0/1（由 `activeIndex` 决定） | CSS `transition: color {duration}ms` 接管 |
| 松手回弹/提交 | 同上离散 | inline color 从最后一个混合值跳到 0/1，CSS transition 自动从"混合值"平滑动到位 |

字号粗细 (`font-weight`) 不能小数化，所以拖动过半时由 `activeIndex` 一次性翻：

```ts
const activeIndex = computed(() => {
  if (dragging.value) return Math.round(indicatorPos.value)
  if (pendingTarget.value !== null) return pendingTarget.value
  return currentIndex.value
})
```

`pendingTarget` 在 `goTo()` 入口设值、`settle()` 清空，确保点击瞬间 `activeIndex` 就翻到目标，不用等动画。

---

## 八、为什么 H5-only

- 触摸事件用 `touchstart` / `touchmove` / `touchend`，没做 `pointerdown` / `mousedown` 兼容
- `touch-action: pan-y` 让浏览器自己处理纵向滚动，横向独占
- `-webkit-overflow-scrolling: touch` 是 iOS Safari 的惯性滚动开关

要兼容桌面端鼠标拖拽需加 `pointerEvents` 一套，但不在本次目标内。

---

## 九、几个易踩坑点

1. **transitionend 误触发**：监听里用 `e.propertyName === 'transform'` 过滤；嵌套元素其它属性的 transitionEnd 会冒泡。
2. **transitionend 不一定 fire**：如果设置 transition 时 transform 没变（snap-back 时 `visualIndex` 没动），事件不发；所以保留 `setTimeout(duration + 80)` 兜底。
3. **`dragDx` 必须比 `dragging` 后一帧再清**：见技巧 4。
4. **`requestAnimationFrame` 双层**：和 `await nextTick()` 一起确保"无 transition 的中间布局"真的被画了一帧，浏览器才会把后续 transform 变化识别成 transition。
5. **`v-model` watcher 引发的递归**：从外部改 `modelValue` 调 `goTo` → `goTo` 结束发 `update:modelValue` → 触发 watcher。所以 watcher 里要判断 `if (v !== currentIndex.value)` 才执行。

---

## 十、API 速查

```vue
<SwipeTabs
  v-model="active"
  :tabs="['推荐', '热门', '直播']"
  :duration="280"
  :threshold="0.25"
  @change="onTabChange"
>
  <template #page-0="{ index, active }">...</template>
  <template #page-1>...</template>
</SwipeTabs>
```

| Prop | 默认 | 说明 |
|---|---|---|
| `tabs` | — | tab 文字数组（必填） |
| `modelValue` | 0 | 当前 tab 索引 |
| `duration` | 280 | 动画时长 (ms) |
| `threshold` | 0.25 | 触发翻页的拖动距离比例 |

| Slot | Scope | 说明 |
|---|---|---|
| `page-${i}` | `{ index, active }` | 第 i 个页面内容 |

| 事件 | 说明 |
|---|---|
| `update:modelValue` | tab 变化（动画结束后） |
| `change` | 同上 |
