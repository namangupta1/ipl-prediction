import { Suspense } from 'react'
import PlayClient from './PlayClient'

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-zinc-600">
          Loading match…
        </div>
      }
    >
      <PlayClient />
    </Suspense>
  )
}