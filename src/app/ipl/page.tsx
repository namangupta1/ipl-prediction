import Link from 'next/link'

type MatchItem = {
  id: string
  match_number: number | null
  team_a: string | null
  team_b: string | null
  match_date: string | null
  match_state: string | null
  prize_name: string | null
  prize_image_url: string | null
}

async function getMatches(): Promise<MatchItem[]> {
  try {
    const response = await fetch('http://localhost:3000/api/matches', {
      cache: 'no-store',
    })

    if (!response.ok) {
      return []
    }

    const payload = await response.json()
    const matches = payload.matches ?? payload.data ?? []

    if (!Array.isArray(matches)) {
      return []
    }

    return matches as MatchItem[]
  } catch {
    return []
  }
}

function formatDate(dateValue: string | null) {
  if (!dateValue) return 'Date TBA'

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return dateValue

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatMatchState(state: string | null) {
  if (!state) return 'Unknown'
  return state.replaceAll('_', ' ')
}

export default async function IplPage() {
  const matches = await getMatches()

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">IPL Matches</h1>
        <p className="mt-1 text-sm text-zinc-600">Pick a match to play predictions.</p>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          No matches available right now.
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <Link
              key={match.id}
              href={`/ipl/play?match_id=${match.id}`}
              className="block rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Match #{match.match_number ?? '-'}
                    </p>
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium capitalize text-zinc-700">
                      {formatMatchState(match.match_state)}
                    </span>
                  </div>

                  <p className="mt-2 text-lg font-semibold text-zinc-900">
                    {match.team_a ?? 'TBD'} vs {match.team_b ?? 'TBD'}
                  </p>

                  <p className="mt-1 text-sm text-zinc-600">{formatDate(match.match_date)}</p>

                  <div className="mt-3 rounded-lg bg-zinc-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">Prize</p>
                    <p className="mt-1 text-sm font-medium text-zinc-800">
                      {match.prize_name ?? 'To be announced'}
                    </p>
                    <p className="mt-1 truncate text-xs text-zinc-500">
                      {match.prize_image_url ?? 'No prize image'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
