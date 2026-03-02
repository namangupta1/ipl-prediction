import { supabaseServer } from '@/lib/supabaseServer'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const matchId = url.searchParams.get('match_id')

  if (!matchId) {
    return Response.json({ error: 'match_id is required' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('matches')
    .select('id, match_number, team_a, team_b, match_date, match_state, prize_name, prize_image_url')
    .eq('id', matchId)
    .maybeSingle()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data) return Response.json({ error: 'Match not found' }, { status: 404 })

  return Response.json({ data })
}