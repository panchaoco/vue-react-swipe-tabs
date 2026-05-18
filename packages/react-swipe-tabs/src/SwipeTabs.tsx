import {
  useEffect,
  useReducer,
  useRef,
  type CSSProperties,
  type ReactNode,
  type TransitionEvent,
} from 'react'
import './SwipeTabs.css'

const ACTIVE_RGB: readonly [number, number, number] = [25, 137, 250] // #1989fa
const INACTIVE_RGB: readonly [number, number, number] = [102, 102, 102] // #666

export interface SwipeTabsProps {
  tabs: string[]
  /** Controlled active index. Omit for uncontrolled (initial = `defaultValue`). */
  value?: number
  /** Initial active index in uncontrolled mode. */
  defaultValue?: number
  /** Called after navigation settles (on click, programmatic, or swipe commit). */
  onChange?: (v: number) => void
  /** Page slide duration in ms. */
  duration?: number
  /** swipe distance ratio (0~1) to commit a page change */
  threshold?: number
  /** Renders the body of page `index`. */
  renderPage: (info: { index: number; active: boolean }) => ReactNode
}

interface State {
  // Logical current page (the resting state).
  currentIndex: number
  // Where the visual track is translated to (in page units). Drives the animation.
  visualIndex: number
  // When jumping non-adjacent, this is the destination page whose `left` we override.
  phantomTarget: number | null
  // Where a click navigation is heading. Active state flips to this immediately
  // so tab styling and the renderPage's `active` arg don't wait for the animation.
  pendingTarget: number | null
  transitioning: boolean
  animating: boolean
  // Indicator runs on its own clock so it can animate the full logical distance
  // even when the track only slides one screen (Flutter jump behavior).
  indicatorPos: number
  indicatorTransitioning: boolean
  // Drag state
  dragging: boolean
  dragDx: number
  startX: number
  startY: number
  directionLocked: 'h' | 'v' | null
  viewportWidth: number
}

export function SwipeTabs({
  tabs,
  value,
  defaultValue = 0,
  onChange,
  duration = 280,
  threshold = 0.25,
  renderPage,
}: SwipeTabsProps) {
  const initial = value ?? defaultValue
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  // All component state lives in a single mutable ref — mirrors the Vue ref()
  // style 1:1 and lets event handlers (attached imperatively in useEffect) read
  // the freshest values without dependency-array gymnastics.
  const stateRef = useRef<State>({
    currentIndex: initial,
    visualIndex: initial,
    phantomTarget: null,
    pendingTarget: null,
    transitioning: false,
    animating: false,
    indicatorPos: initial,
    indicatorTransitioning: false,
    dragging: false,
    dragDx: 0,
    startX: 0,
    startY: 0,
    directionLocked: null,
    viewportWidth: 0,
  })
  const s = stateRef.current

  // Latest props/callbacks for stable handler closures.
  const propsRef = useRef({ tabs, duration, threshold, onChange })
  propsRef.current = { tabs, duration, threshold, onChange }

  const viewport = useRef<HTMLDivElement | null>(null)
  const tabBar = useRef<HTMLDivElement | null>(null)

  // External `value` → animate to it. Skip the first render (state already
  // initialized) and any time it already matches.
  const prevValueRef = useRef(value)
  useEffect(() => {
    if (value === undefined) return
    if (value === prevValueRef.current) return
    prevValueRef.current = value
    if (value !== s.currentIndex) goTo(value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function pageLeft(i: number): string {
    if (s.phantomTarget === i && Math.abs(i - s.currentIndex) > 1) {
      const adjacent = i > s.currentIndex ? s.currentIndex + 1 : s.currentIndex - 1
      return `${adjacent * 100}%`
    }
    return `${i * 100}%`
  }

  // Per-tab blue intensity. While dragging, blends gray↔blue proportionally to
  // how close the drag fraction is to each tab (so the focus literally fades
  // across as you swipe). Otherwise it's a discrete 0/1 and CSS transitions
  // smooth the color change for click navigation.
  function tabColor(i: number, activeIndex: number): string {
    let t: number
    if (s.dragging) {
      const w = s.viewportWidth || 1
      const frac = s.currentIndex - s.dragDx / w
      t = Math.max(0, 1 - Math.abs(frac - i))
    } else {
      t = activeIndex === i ? 1 : 0
    }
    const r = Math.round(INACTIVE_RGB[0] + (ACTIVE_RGB[0] - INACTIVE_RGB[0]) * t)
    const g = Math.round(INACTIVE_RGB[1] + (ACTIVE_RGB[1] - INACTIVE_RGB[1]) * t)
    const b = Math.round(INACTIVE_RGB[2] + (ACTIVE_RGB[2] - INACTIVE_RGB[2]) * t)
    return `rgb(${r}, ${g}, ${b})`
  }

  function goTo(target: number) {
    const { tabs } = propsRef.current
    if (s.animating) return
    if (target === s.currentIndex) return
    if (target < 0 || target >= tabs.length) return

    s.animating = true
    s.pendingTarget = target
    const isJump = Math.abs(target - s.currentIndex) > 1
    s.phantomTarget = isJump ? target : null

    // Indicator animates the full logical distance independently from the track.
    s.indicatorTransitioning = true
    s.indicatorPos = target

    // Commit phantomTarget + transition:none to DOM BEFORE we kick off the slide,
    // otherwise the browser collapses the two states into a single instant jump.
    s.transitioning = false
    forceRender()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        s.transitioning = true
        // Clearing dragDx in the *same* tick as enabling the transition lets the
        // browser animate from the drag-released position to the target, instead
        // of snapping back to the resting position first.
        s.dragDx = 0
        s.visualIndex = isJump
          ? target > s.currentIndex
            ? s.currentIndex + 1
            : s.currentIndex - 1
          : target
        forceRender()
      })
    })
  }

  function settle() {
    s.transitioning = false
    if (s.phantomTarget !== null) {
      s.currentIndex = s.phantomTarget
    } else {
      s.currentIndex = s.visualIndex
    }
    s.visualIndex = s.currentIndex
    s.phantomTarget = null
    s.pendingTarget = null
    s.indicatorPos = s.currentIndex
    s.indicatorTransitioning = false
    s.dragDx = 0
    s.animating = false
    forceRender()
    propsRef.current.onChange?.(s.currentIndex)
  }

  function handleTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== 'transform') return
    if (e.target !== e.currentTarget) return // ignore bubbles from user page content
    if (!s.animating) return
    settle()
  }

  // === Touch handlers — attached via addEventListener so onTouchMove can call
  // preventDefault. React makes touch event handlers passive by default since
  // v17, which strips the ability to block native scrolling. ===

  function onTouchStart(e: globalThis.TouchEvent) {
    if (s.animating) return
    const t = e.touches[0]
    if (!t) return
    s.startX = t.clientX
    s.startY = t.clientY
    s.directionLocked = null
    s.dragDx = 0
    s.viewportWidth = viewport.current?.offsetWidth ?? 0
    // Drag mode: indicator follows the finger directly, no transition.
    s.indicatorTransitioning = false
    s.indicatorPos = s.currentIndex
    forceRender()
  }

  function onTouchMove(e: globalThis.TouchEvent) {
    if (s.animating) return
    const t = e.touches[0]
    if (!t) return
    const dx = t.clientX - s.startX
    const dy = t.clientY - s.startY

    if (!s.directionLocked) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      s.directionLocked = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (s.directionLocked === 'h') {
        s.dragging = true
        s.transitioning = false
      }
    }

    if (s.directionLocked === 'h') {
      e.preventDefault()
      const { tabs } = propsRef.current
      let next = dx
      if (s.currentIndex === 0 && next > 0) next *= 0.3
      if (s.currentIndex === tabs.length - 1 && next < 0) next *= 0.3
      s.dragDx = next
      if (s.viewportWidth) {
        s.indicatorPos = s.currentIndex - next / s.viewportWidth
      }
      forceRender()
    }
  }

  function onTouchEnd() {
    if (!s.dragging) {
      s.directionLocked = null
      return
    }
    const { tabs, threshold, duration } = propsRef.current
    const w = s.viewportWidth || 1
    const ratio = s.dragDx / w
    s.dragging = false
    s.directionLocked = null

    let target = s.currentIndex
    if (ratio <= -threshold && s.currentIndex < tabs.length - 1) {
      target = s.currentIndex + 1
    } else if (ratio >= threshold && s.currentIndex > 0) {
      target = s.currentIndex - 1
    }
    // Note: we intentionally keep dragDx until the animation RAF zeroes it in
    // the same tick that enables transition — see goTo() and the snap-back path.

    if (target !== s.currentIndex) {
      goTo(target)
    } else {
      // Snap back: animate the track from the released position back to
      // currentIndex's resting position.
      s.animating = true
      s.indicatorTransitioning = true
      s.indicatorPos = s.currentIndex
      forceRender()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          s.transitioning = true
          s.dragDx = 0
          forceRender()
        })
      })
      // Safety net in case transitionend never fires (no transform delta).
      window.setTimeout(() => {
        if (s.animating) settle()
      }, duration + 80)
    }
  }

  // Wire up touch listeners imperatively (passive: false for touchmove).
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      s.dragging = false
      s.animating = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // === Render-time computations ===

  // The "intent" index — drives tab font-weight and the renderPage `active`
  // arg so they react the moment navigation starts (click) or crosses the
  // halfway mark (drag).
  const n = tabs.length
  const activeIndex = s.dragging
    ? Math.max(0, Math.min(n - 1, Math.round(s.indicatorPos)))
    : s.pendingTarget !== null
      ? s.pendingTarget
      : s.currentIndex

  // Auto-scroll the tab bar so the active tab stays visible.
  useEffect(() => {
    const bar = tabBar.current
    if (!bar) return
    const el = bar.querySelectorAll<HTMLElement>('.swipe-tabs__tab')[activeIndex]
    if (!el) return
    const left = el.offsetLeft - (bar.clientWidth - el.clientWidth) / 2
    bar.scrollTo({ left, behavior: 'smooth' })
  }, [activeIndex])

  const dragPercent = s.viewportWidth ? (s.dragDx / s.viewportWidth) * 100 : 0
  const trackStyle: CSSProperties = {
    transform: `translate3d(calc(${-s.visualIndex * 100}% + ${dragPercent}%), 0, 0)`,
    transition: s.transitioning ? `transform ${duration}ms ease-out` : 'none',
  }
  const indicatorStyle: CSSProperties = {
    width: `${100 / (n || 1)}%`,
    transform: `translate3d(${s.indicatorPos * 100}%, 0, 0)`,
    transition: s.indicatorTransitioning ? `transform ${duration}ms ease-out` : 'none',
  }
  const rootStyle = { '--swipe-tabs-duration': `${duration}ms` } as CSSProperties

  return (
    <div className="swipe-tabs" style={rootStyle}>
      <div
        ref={tabBar}
        className={'swipe-tabs__bar' + (s.dragging ? ' swipe-tabs__bar--dragging' : '')}
        role="tablist"
      >
        {tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            className={
              'swipe-tabs__tab' + (activeIndex === i ? ' swipe-tabs__tab--active' : '')
            }
            style={{ color: tabColor(i, activeIndex) }}
            role="tab"
            aria-selected={activeIndex === i}
            onClick={() => goTo(i)}
          >
            {t}
          </button>
        ))}
        <div className="swipe-tabs__indicator-track">
          <div className="swipe-tabs__indicator" style={indicatorStyle} />
        </div>
      </div>

      <div ref={viewport} className="swipe-tabs__viewport">
        <div
          className="swipe-tabs__track"
          style={trackStyle}
          onTransitionEnd={handleTransitionEnd}
        >
          {tabs.map((_, i) => (
            <div key={i} className="swipe-tabs__page" style={{ left: pageLeft(i) }}>
              {renderPage({ index: i, active: activeIndex === i })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SwipeTabs
