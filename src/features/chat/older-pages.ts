// Older pages load when the reader reaches the top. Prepending a page does not
// move `scrollTop` when it is already 0, so the scroll listener does not fire
// again. This remembers that they parked there. The thread keeps asking while
// `isParked()` stays true; a layout that lands a page can also ask again, for
// the case where that loop has already stopped.

const TOP = 48
/** Far enough from the top that the thread has actually been at the bottom (it opens there). */
const AWAY = 64

export type PageAnchor = {
  scrollTop: number
  scrollHeight: number
  /** The oldest item. Changes when a page is prepended; a scroll position does not. */
  topId: string | undefined
  atBottom: boolean
}

export function olderPageFollow() {
  /** The thread has been away from the top, so a later visit is the reader scrolling up. */
  let armed = false
  /** Last time we knew they were at the top. Survives a listener rebind and a stale layout offset. */
  let parked = false
  let topId: string | undefined
  let height = 0

  return {
    reset() {
      armed = false
      parked = false
      topId = undefined
      height = 0
    },
    /** True while the last scroll or layout still had them at the top. */
    isParked() {
      return parked
    },
    /** A scroll. True when this gesture reached the top and a page should be fetched. */
    onScroll(scrollTop: number) {
      if (scrollTop > AWAY) armed = true
      parked = scrollTop < TOP
      return armed && parked
    },
    /**
     * A render, after the DOM has the new page. `scrollTop` is the element's
     * live value, which can still be the offset from before this scroll if the
     * last render happened at the bottom. Returns the scroll offset to apply
     * and whether to fetch again because they are still parked.
     */
    onLayout(now: PageAnchor) {
      const prepended = topId !== undefined && now.topId !== undefined && now.topId !== topId
      const delta = height > 0 ? now.scrollHeight - height : 0
      const atTop = now.scrollTop < TOP || (parked && !now.atBottom)
      let scrollTop = now.scrollTop
      if (prepended && delta > 0 && !now.atBottom) scrollTop = atTop ? 0 : now.scrollTop + delta
      parked = scrollTop < TOP
      // A prepend does not scroll, so the listener will not see this page.
      const ask = armed && parked && prepended && !now.atBottom
      topId = now.topId
      height = now.scrollHeight
      return { scrollTop, ask }
    },
  }
}
