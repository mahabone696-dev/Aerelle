import { lazy, Suspense, useState } from 'react'
import type { SceneVariant } from './Scene'
import { webglAvailable } from './webgl'

// Three.js is split into its own chunk and only fetched when WebGL is available.
const Scene = lazy(() => import('./Scene'))

export function LazyScene({ variant }: { variant: SceneVariant }) {
  const [ok] = useState(() => typeof window !== 'undefined' && webglAvailable())
  if (!ok) return null
  return (
    <Suspense fallback={null}>
      <Scene variant={variant} />
    </Suspense>
  )
}
