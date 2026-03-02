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

function stateBadgeClass(state: string | null) {
  if (!state) return 'badge-phase'
  if (state === 'completed') return 'badge-settled'
  if (state === 'upcoming') return 'badge-live'
  return 'badge-phase'
}

export default async function IplPage() {
  const matches = await getMatches()

  return (
    <main className="broadcast-shell mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
      <div className="broadcast-content">
        <header className="card-status motion-rise mb-6 p-5">
          <p className="font-display text-xs uppercase tracking-[0.2em] text-white/70">IPL Broadcast</p>
          <h1 className="font-display mt-2 text-4xl leading-none text-white">Pick Your Matchday</h1>
          <p className="mt-3 max-w-xl text-sm text-white/80">
            Track live phases, lock predictions, and settle answers with confidence.
          </p>
        </header>

        {matches.length === 0 ? (
          <div className="card-primary p-6 text-sm text-[var(--color-text-muted)]">No matches available right now.</div>
        ) : (
          <div className="space-y-4">
            {matches.map((match, index) => (
              <Link
                key={match.id}
                href={`/ipl/play?match_id=${match.id}`}
                className="card-primary motion-rise block p-5 hover:border-[rgba(13,122,238,0.5)]"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                    Match #{match.match_number ?? '-'}
                  </p>
                  <span className={stateBadgeClass(match.match_state)}>{formatMatchState(match.match_state)}</span>
                </div>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-display text-3xl leading-none text-[var(--color-text-strong)]">
                      {match.team_a ?? 'TBD'}
                    </p>
                    <p className="font-display mt-1 text-xl text-[var(--color-text-muted)]">vs {match.team_b ?? 'TBD'}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Match Date</p>
                    <p className="font-display text-xl text-[var(--color-brand)]">{formatDate(match.match_date)}</p>
                  </div>
                </div>

                <div className="card-muted mt-4 flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Prize Pool</p>
                    <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                      {match.prize_name ?? 'To be announced'}
                    </p>
                  </div>

                  <span className="btn-primary px-3 py-1.5 text-xs">Play now</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
