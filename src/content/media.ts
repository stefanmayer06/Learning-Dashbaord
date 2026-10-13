/**
 * What an embed step plays and where it lives, so talks and podcasts are
 * labelled as such rather than as "tools".
 */
import type { Step } from './schema'

export type EmbedStepT = Extract<Step, { type: 'embed' }>
export type EmbedMedia = 'video' | 'audio' | 'tool'

export function embedMedia(step: EmbedStepT): EmbedMedia {
  if (step.provider === 'youtube' || step.provider === 'nih-videocast') return 'video'
  if (step.provider === 'apple-podcasts') return 'audio'
  return 'tool'
}

/** The URL loaded in the frame. */
export function embedUrl(step: EmbedStepT) {
  switch (step.provider) {
    case 'quirk':
      return `https://algassert.com/quirk#circuit=${encodeURIComponent(step.src)}`
    case 'youtube':
      return `https://www.youtube-nocookie.com/embed/${step.src}?rel=0&modestbranding=1`
    case 'apple-podcasts':
      return `https://embed.podcasts.apple.com/gb/episode/${step.src}`
    case 'nih-videocast':
      return `https://videocast.nih.gov/embed/${step.src}`
    case 'iframe':
      return step.src
  }
}

/** The page to open in a new tab — the host's own page, so it can be saved or played on another device. */
export function openUrl(step: EmbedStepT) {
  switch (step.provider) {
    case 'youtube':
      return `https://www.youtube.com/watch?v=${step.src}`
    case 'apple-podcasts':
      return `https://podcasts.apple.com/gb/episode/${step.src}`
    case 'nih-videocast':
      return `https://videocast.nih.gov/watch/${step.src}`
    default:
      return embedUrl(step)
  }
}

/** The kind a step is shown as: its type, except that embedded talks and podcasts are named as such. */
export function stepKind(step: Step): string {
  if (step.type !== 'embed') return step.type
  const media = embedMedia(step)
  return media === 'video' ? 'external-video' : media === 'audio' ? 'podcast' : 'embed'
}
