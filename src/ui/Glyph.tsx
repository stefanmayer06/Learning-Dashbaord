/**
 * A small, hand-drawn glyph set on a 20×20 grid with a 1.5px stroke, designed
 * to sit next to Martian Mono labels. No icon library.
 */
import type { CSSProperties } from 'react'

const paths: Record<string, string> = {
  arrow: 'M3 10h13M11.5 5.5 16 10l-4.5 4.5',
  back: 'M17 10H4M8.5 5.5 4 10l4.5 4.5',
  play: 'M6 4.2v11.6L16 10z',
  pause: 'M6.5 4.5v11M13.5 4.5v11',
  check: 'M4 10.5 8.2 14.5 16 5.5',
  cross: 'M5 5l10 10M15 5 5 15',
  lock: 'M5.5 9h9v7h-9zM7.5 9V6.5a2.5 2.5 0 0 1 5 0V9',
  reel: 'M3.5 5h13v10h-13zM8.5 7.8v4.4l3.6-2.2z',
  lab: 'M8 3.5h4M9 3.5v5L4.5 16h11L11 8.5v-5M6.6 12.5h6.8',
  quiz: 'M7.4 7.3a2.7 2.7 0 1 1 3.6 2.6c-.7.3-1 .8-1 1.5v.6M10 15v.4',
  output: 'M5 3.5h7l3 3v10H5zM12 3.5v3h3M7.5 10h5M7.5 13h3.5',
  embed: 'M7.5 6 3.5 10l4 4M12.5 6l4 4-4 4',
  recap: 'M4 5h12M4 10h12M4 15h7',
  cc: 'M3 5h14v10H3zM8.6 8.4a2 2 0 1 0 0 3.2M14 8.4a2 2 0 1 0 0 3.2',
  voice: 'M4 8v4h3l4 3.5v-11L7 8zM13.5 7.5a3.5 3.5 0 0 1 0 5M15.5 5.5a6.4 6.4 0 0 1 0 9',
  mute: 'M4 8v4h3l4 3.5v-11L7 8zM13.5 8l4 4M17.5 8l-4 4',
  expand: 'M3.5 8V3.5H8M12 3.5h4.5V8M16.5 12v4.5H12M8 16.5H3.5V12',
  transcript: 'M4 4.5h12M4 8.5h12M4 12.5h12M4 16.5h7',
  restart: 'M4.5 10a5.5 5.5 0 1 0 1.7-4M4.5 3.5V6.5h3',
  external: 'M8.5 4.5h-4v11h11v-4M11.5 3.5h5v5M16.5 3.5 9 11',
  lamp: 'M10 3v1.5M4.3 5.3l1 1M15.7 5.3l-1 1M6.5 11a3.5 3.5 0 1 1 7 0c0 1.5-1 2.2-1.5 3h-4c-.5-.8-1.5-1.5-1.5-3zM8 16.5h4',
  settings: 'M10 7.3a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4',
  ledger: 'M4 3.5h12v13H4zM7 3.5v13M9.5 7h4M9.5 10h4M9.5 13h2.5',
  seal: 'M10 2.8l1.8 1.6 2.4-.3.7 2.3 2.1 1.2-.8 2.3.8 2.3-2.1 1.2-.7 2.3-2.4-.3L10 17.2l-1.8-1.6-2.4.3-.7-2.3-2.1-1.2.8-2.3-.8-2.3 2.1-1.2.7-2.3 2.4.3z',
  plus: 'M10 4v12M4 10h12',
  minus: 'M4 10h12',
  up: 'M10 16V4M5.5 8.5 10 4l4.5 4.5',
  down: 'M10 4v12M5.5 11.5 10 16l4.5-4.5',
  dot: 'M10 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  sync: 'M15.5 8A6 6 0 0 0 4.8 6.5M4.5 12a6 6 0 0 0 10.7 1.5M15.5 3.5V8H11M4.5 16.5V12H9',
  download: 'M10 3.5v9M6 9l4 4 4-4M4 16.5h12',
  print: 'M6 7.5V3.5h8v4M6 13.5H4V7.5h12v6h-2M6 11.5h8v5H6z',
  copy: 'M7 7h9v9.5H7zM13 7V3.5H4V13h3',
  spark: 'M10 3v4M10 13v4M3 10h4M13 10h4',
}

export type GlyphName = keyof typeof paths

export function Glyph({
  name,
  size = 16,
  className,
  style,
  title,
  fill,
}: {
  name: GlyphName | string
  size?: number
  className?: string
  style?: CSSProperties
  title?: string
  fill?: boolean
}) {
  const d = paths[name] ?? paths.dot
  const filled = fill ?? (name === 'play' || name === 'dot')
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      className={className}
      style={{ flex: 'none', ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        d={d}
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  )
}

export const STEP_GLYPH: Record<string, GlyphName> = {
  reel: 'reel',
  widget: 'lab',
  quiz: 'quiz',
  deliverable: 'output',
  embed: 'embed',
  recap: 'recap',
}

export const STEP_LABEL: Record<string, string> = {
  reel: 'Reel',
  widget: 'Lab',
  quiz: 'Check',
  deliverable: 'Work output',
  embed: 'External tool',
  recap: 'Recap',
}
