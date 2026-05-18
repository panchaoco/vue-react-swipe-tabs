import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
  type PropType,
} from 'vue'
import './SwipeTabs.css'

const ACTIVE_RGB: readonly [number, number, number] = [25, 137, 250] // #1989fa
const INACTIVE_RGB: readonly [number, number, number] = [102, 102, 102] // #666

export default defineComponent({
  name: 'SwipeTabs',
  props: {
    tabs: { type: Array as PropType<string[]>, required: true },
    modelValue: { type: Number, default: 0 },
    duration: { type: Number, default: 280 },
    /** swipe distance ratio (0~1) to commit a page change */
    threshold: { type: Number, default: 0.25 },
  },
  emits: {
    'update:modelValue': (_v: number) => true,
    change: (_v: number) => true,
  },
  setup(props, { emit, slots }) {
    const viewport = ref<HTMLElement | null>(null)
    const tabBar = ref<HTMLElement | null>(null)

    // Logical current page (the resting state).
    const currentIndex = ref(props.modelValue)
    // Where the visual track is translated to (in page units). Drives the animation.
    const visualIndex = ref(props.modelValue)
    // When jumping non-adjacent, this is the destination page whose `left` we override.
    const phantomTarget = ref<number | null>(null)
    // Where a click navigation is heading. Active state flips to this immediately
    // so tab styling and the slot's `active` prop don't wait for the animation.
    const pendingTarget = ref<number | null>(null)
    const transitioning = ref(false)
    const animating = ref(false)

    // Indicator runs on its own clock so it can animate the full logical distance
    // even when the track only slides one screen (Flutter jump behavior).
    const indicatorPos = ref<number>(props.modelValue)
    const indicatorTransitioning = ref(false)

    // Drag state
    const dragging = ref(false)
    const dragDx = ref(0)
    const startX = ref(0)
    const startY = ref(0)
    const directionLocked = ref<'h' | 'v' | null>(null)
    const viewportWidth = ref(0)

    watch(
      () => props.modelValue,
      (v) => {
        if (v !== currentIndex.value) goTo(v)
      },
    )

    const trackStyle = computed(() => {
      // dragDx is the visual offset from the resting position. We keep it set even
      // *after* the finger lifts, until the next animation frame swaps it for the
      // real transition — otherwise the track would snap to visualIndex before the
      // transition starts, producing a visible flicker.
      const base = -visualIndex.value * 100
      const dragPercent = viewportWidth.value
        ? (dragDx.value / viewportWidth.value) * 100
        : 0
      return {
        transform: `translate3d(calc(${base}% + ${dragPercent}%), 0, 0)`,
        transition: transitioning.value ? `transform ${props.duration}ms ease-out` : 'none',
      }
    })

    function pageLeft(i: number): string {
      if (phantomTarget.value === i && Math.abs(i - currentIndex.value) > 1) {
        const adjacent =
          i > currentIndex.value ? currentIndex.value + 1 : currentIndex.value - 1
        return `${adjacent * 100}%`
      }
      return `${i * 100}%`
    }

    const indicatorStyle = computed(() => {
      const n = props.tabs.length || 1
      return {
        width: `${100 / n}%`,
        transform: `translate3d(${indicatorPos.value * 100}%, 0, 0)`,
        transition: indicatorTransitioning.value
          ? `transform ${props.duration}ms ease-out`
          : 'none',
      }
    })

    // The "intent" index — drives tab font-weight and slot `active` so they react
    // the moment navigation starts (click) or crosses the halfway mark (drag).
    const activeIndex = computed(() => {
      const n = props.tabs.length
      if (dragging.value) {
        return Math.max(0, Math.min(n - 1, Math.round(indicatorPos.value)))
      }
      if (pendingTarget.value !== null) return pendingTarget.value
      return currentIndex.value
    })

    // Per-tab blue intensity. While dragging, blends gray↔blue proportionally to
    // how close the drag fraction is to each tab (so the focus literally fades
    // across as you swipe). Otherwise it's a discrete 0/1 and CSS transitions
    // smooth the color change for click navigation.
    function tabColor(i: number): string {
      let t: number
      if (dragging.value) {
        const w = viewportWidth.value || 1
        const frac = currentIndex.value - dragDx.value / w
        t = Math.max(0, 1 - Math.abs(frac - i))
      } else {
        t = activeIndex.value === i ? 1 : 0
      }
      const r = Math.round(INACTIVE_RGB[0] + (ACTIVE_RGB[0] - INACTIVE_RGB[0]) * t)
      const g = Math.round(INACTIVE_RGB[1] + (ACTIVE_RGB[1] - INACTIVE_RGB[1]) * t)
      const b = Math.round(INACTIVE_RGB[2] + (ACTIVE_RGB[2] - INACTIVE_RGB[2]) * t)
      return `rgb(${r}, ${g}, ${b})`
    }

    async function goTo(target: number) {
      if (animating.value) return
      if (target === currentIndex.value) return
      if (target < 0 || target >= props.tabs.length) return

      animating.value = true
      pendingTarget.value = target
      const isJump = Math.abs(target - currentIndex.value) > 1
      phantomTarget.value = isJump ? target : null

      // Indicator animates the full logical distance independently from the track.
      // It starts wherever it currently is (could be a drag-released position) and
      // glides to `target` over the same duration as the track.
      indicatorTransitioning.value = true
      indicatorPos.value = target

      // Make sure DOM commits the page reposition BEFORE we kick off the slide.
      transitioning.value = false
      await nextTick()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          transitioning.value = true
          // Clearing dragDx in the *same* tick as enabling the transition lets the
          // browser animate from the drag-released position to the target, instead
          // of snapping back to the resting position first.
          dragDx.value = 0
          visualIndex.value = isJump
            ? target > currentIndex.value
              ? currentIndex.value + 1
              : currentIndex.value - 1
            : target
        })
      })
    }

    function settle() {
      // Snap to resting state with no animation, regardless of what triggered this.
      transitioning.value = false
      if (phantomTarget.value !== null) {
        currentIndex.value = phantomTarget.value
      } else {
        currentIndex.value = visualIndex.value
      }
      visualIndex.value = currentIndex.value
      phantomTarget.value = null
      pendingTarget.value = null
      // Indicator should already be at currentIndex from goTo; keep the state
      // consistent so a subsequent drag starts from the right place.
      indicatorPos.value = currentIndex.value
      indicatorTransitioning.value = false
      dragDx.value = 0
      animating.value = false
      emit('update:modelValue', currentIndex.value)
      emit('change', currentIndex.value)
    }

    function onTransitionEnd(e: TransitionEvent) {
      if (e.propertyName !== 'transform') return
      if (!animating.value) return
      settle()
    }

    // --- Touch / swipe ---

    function onTouchStart(e: TouchEvent) {
      if (animating.value) return
      const t = e.touches[0]
      if (!t) return
      startX.value = t.clientX
      startY.value = t.clientY
      directionLocked.value = null
      dragDx.value = 0
      viewportWidth.value = viewport.value?.offsetWidth ?? 0
      // Drag mode: indicator follows the finger directly, no transition.
      indicatorTransitioning.value = false
      indicatorPos.value = currentIndex.value
    }

    function onTouchMove(e: TouchEvent) {
      if (animating.value) return
      const t = e.touches[0]
      if (!t) return
      const dx = t.clientX - startX.value
      const dy = t.clientY - startY.value

      if (!directionLocked.value) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        directionLocked.value = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
        if (directionLocked.value === 'h') {
          dragging.value = true
          transitioning.value = false
        }
      }

      if (directionLocked.value === 'h') {
        e.preventDefault()
        let next = dx
        if (currentIndex.value === 0 && next > 0) next *= 0.3
        if (currentIndex.value === props.tabs.length - 1 && next < 0) next *= 0.3
        dragDx.value = next
        if (viewportWidth.value) {
          indicatorPos.value = currentIndex.value - next / viewportWidth.value
        }
      }
    }

    function onTouchEnd() {
      if (!dragging.value) {
        directionLocked.value = null
        return
      }
      const w = viewportWidth.value || 1
      const ratio = dragDx.value / w
      dragging.value = false
      directionLocked.value = null

      let target = currentIndex.value
      if (ratio <= -props.threshold && currentIndex.value < props.tabs.length - 1) {
        target = currentIndex.value + 1
      } else if (ratio >= props.threshold && currentIndex.value > 0) {
        target = currentIndex.value - 1
      }
      // Note: we intentionally keep dragDx until the animation RAF zeroes it in
      // the same tick that enables transition — see goTo() and the snap-back path.

      if (target !== currentIndex.value) {
        // goTo will pick up indicatorPos's current (drag-released) value and animate
        // smoothly to the target — no flash back to currentIndex first.
        goTo(target)
      } else {
        // Snap back: animate the track from the released position back to
        // currentIndex's resting position.
        animating.value = true
        indicatorTransitioning.value = true
        indicatorPos.value = currentIndex.value
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            transitioning.value = true
            dragDx.value = 0
          })
        })
        // Safety net in case transitionend never fires (no transform delta).
        window.setTimeout(() => {
          if (animating.value) settle()
        }, props.duration + 80)
      }
    }

    // --- Auto-scroll the tab bar so the active tab stays visible ---
    watch(activeIndex, async (i) => {
      await nextTick()
      const bar = tabBar.value
      if (!bar) return
      const el = bar.querySelectorAll<HTMLElement>('.swipe-tabs__tab')[i]
      if (!el) return
      const left = el.offsetLeft - (bar.clientWidth - el.clientWidth) / 2
      bar.scrollTo({ left, behavior: 'smooth' })
    })

    onBeforeUnmount(() => {
      dragging.value = false
      animating.value = false
    })

    return () => (
      <div class="swipe-tabs" style={`--swipe-tabs-duration: ${props.duration}ms`}>
        <div
          ref={tabBar}
          class={['swipe-tabs__bar', { 'swipe-tabs__bar--dragging': dragging.value }]}
          role="tablist"
        >
          {props.tabs.map((t, i) => (
            <button
              key={i}
              class={[
                'swipe-tabs__tab',
                { 'swipe-tabs__tab--active': activeIndex.value === i },
              ]}
              style={{ color: tabColor(i) }}
              role="tab"
              aria-selected={activeIndex.value === i}
              onClick={() => goTo(i)}
            >
              {t}
            </button>
          ))}
          <div class="swipe-tabs__indicator-track">
            <div class="swipe-tabs__indicator" style={indicatorStyle.value} />
          </div>
        </div>

        <div
          ref={viewport}
          class="swipe-tabs__viewport"
          onTouchstart={onTouchStart}
          onTouchmove={onTouchMove}
          onTouchend={onTouchEnd}
          onTouchcancel={onTouchEnd}
        >
          <div
            class="swipe-tabs__track"
            style={trackStyle.value}
            onTransitionend={onTransitionEnd}
          >
            {props.tabs.map((_, i) => (
              <div key={i} class="swipe-tabs__page" style={{ left: pageLeft(i) }}>
                {slots[`page-${i}`]?.({ index: i, active: activeIndex.value === i })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  },
})
