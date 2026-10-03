import type { KeyboardEvent } from 'react'

/**
 * Arrow-key behaviour for a role="tablist" (←/→/Home/End move and select), to pair with a roving
 * tabIndex: `tabIndex={selected ? 0 : -1}` on each tab, so the list is a single Tab stop.
 */
export function tabListKeys<T extends string>(ids: readonly T[], current: T, select: (t: T) => void, domId: (t: T) => string) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const k = ids.indexOf(current)
    let n = -1
    if (e.key === 'ArrowRight') n = (k + 1) % ids.length
    else if (e.key === 'ArrowLeft') n = (k - 1 + ids.length) % ids.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = ids.length - 1
    if (n < 0) return
    e.preventDefault()
    select(ids[n])
    document.getElementById(domId(ids[n]))?.focus()
  }
}
