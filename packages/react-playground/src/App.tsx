import { useState } from 'react'
import { SwipeTabs } from 'react-swipe-tabs'
import 'react-swipe-tabs/style.css'
import './App.css'

const tabs = ['推荐', '热门', '直播', '关注', '附近', '科技', '美食']
const colors = ['#fde2e4', '#e2f0cb', '#cde7f0', '#fff1ba', '#dcd6f7', '#ffd6e0', '#b8e0d2']

export default function App() {
  const [active, setActive] = useState(0)
  // Each page has its own counter to prove state is preserved across tab switches.
  const [counters, setCounters] = useState<number[]>(() => tabs.map(() => 0))

  return (
    <div className="app">
      <SwipeTabs
        tabs={tabs}
        value={active}
        onChange={setActive}
        renderPage={({ index, active: isActive }) => (
          <div
            className="page"
            style={{ background: colors[index % colors.length] }}
          >
            <h2>
              {tabs[index]} (第 {index} 页)
            </h2>
            <p>当前激活: {isActive ? '是' : '否'}</p>
            <button
              type="button"
              className="cnt"
              onClick={() =>
                setCounters((prev) => {
                  const next = prev.slice()
                  next[index] = (next[index] ?? 0) + 1
                  return next
                })
              }
            >
              点了 {counters[index] ?? 0} 次
            </button>
            <p className="hint">试试从这页直接点最右或最左的 tab——动画只滑一屏。</p>
            {Array.from({ length: 30 }, (_, n) => (
              <div key={n} className="filler">
                {n + 1}. 可垂直滚动的内容
              </div>
            ))}
          </div>
        )}
      />
    </div>
  )
}
