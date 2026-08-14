import React from 'react'
import { MAP_SHARPEN_FILTER_ID } from '@/lib/invite/mapStyles'

/**
 * The sharpen kernel the map styles reference.
 *
 * Zero-sized and hidden: it exists only so `filter: url(#...)` has something to
 * resolve. Rendered alongside each styled map rather than globally, so a map
 * never depends on some other part of the page having been mounted first.
 */
export default function MapSharpenFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <filter id={MAP_SHARPEN_FILTER_ID} x="0" y="0" width="100%" height="100%">
          {/* Sums to 1, so brightness is unchanged and only edges gain. */}
          <feConvolveMatrix
            order="3"
            kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"
            divisor="1"
            preserveAlpha="true"
          />
        </filter>
      </defs>
    </svg>
  )
}
