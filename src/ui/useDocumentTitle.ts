import { useEffect } from 'react'
import { SITE } from '../site'

/** Sets the browser tab / history title for a page: "<title> · Margin". */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE.name}` : SITE.name
  }, [title])
}
