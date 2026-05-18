<script setup lang="ts">
import { ref } from 'vue'
import { SwipeTabs } from 'vue-swipe-tabs'
import 'vue-swipe-tabs/style.css'

const tabs = ['推荐', '热门', '直播', '关注', '附近', '科技', '美食']
const active = ref(0)

const colors = ['#fde2e4', '#e2f0cb', '#cde7f0', '#fff1ba', '#dcd6f7', '#ffd6e0', '#b8e0d2']

// Each page has its own counter to prove state is preserved across tab switches.
const counters = ref<number[]>(tabs.map(() => 0))
</script>

<template>
  <div class="app">
    <SwipeTabs v-model="active" :tabs="tabs">
      <template
        v-for="(t, i) in tabs"
        :key="i"
        #[`page-${i}`]="{ index, active: isActive }"
      >
        <div class="page" :style="{ background: colors[index % colors.length] }">
          <h2>{{ t }} (第 {{ index }} 页)</h2>
          <p>当前激活: {{ isActive ? '是' : '否' }}</p>
          <button class="cnt" @click="counters[index] = (counters[index] ?? 0) + 1">
            点了 {{ counters[index] ?? 0 }} 次
          </button>
          <p class="hint">
            试试从这页直接点最右或最左的 tab——动画只滑一屏。
          </p>
          <div class="filler" v-for="n in 30" :key="n">{{ n }}. 可垂直滚动的内容</div>
        </div>
      </template>
    </SwipeTabs>
  </div>
</template>

<style>
html, body, #app { height: 100%; margin: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; }
.app { height: 100vh; display: flex; flex-direction: column; }

.page {
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
}
.page h2 { margin: 0 0 12px; }
.page .cnt {
  padding: 8px 14px;
  border-radius: 20px;
  background: #1989fa;
  color: #fff;
  border: 0;
  font-size: 14px;
}
.page .hint { color: #555; margin: 16px 0; font-size: 13px; }
.page .filler { padding: 10px 0; border-bottom: 1px dashed rgba(0,0,0,0.1); }
</style>
