import PlayClient from './PlayClient'

type PageProps = {
  searchParams: Promise<{
    match_id?: string | string[]
  }>
}

function getMatchId(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0]?.trim() ?? ''
  }

  return ''
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams
  const initialMatchId = getMatchId(params.match_id)

  return <PlayClient initialMatchId={initialMatchId} />
}
