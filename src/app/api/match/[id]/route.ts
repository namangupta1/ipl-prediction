// import { supabaseServer } from '@/lib/supabaseServer'

// export async function GET(
//   _req: Request,
//   { params }: { params: { matchId: string } }
// ) {
//   const matchId = params?.matchId

//   if (!matchId) {
//     return Response.json({ error: 'matchId is required' }, { status: 400 })
//   }

//   const { data, error } = await supabaseServer
//     .from('matches')
//     .select('id, match_date, match_state, prize_name, prize_image_url')
//     .eq('id', matchId)
//     .maybeSingle()

//   if (error) {
//     return Response.json({ error: error.message }, { status: 500 })
//   }

//   if (!data) {
//     return Response.json({ error: 'Match not found' }, { status: 404 })
//   }

//   return Response.json({ data })
// }

type RouteContext =
  | { params: { id: string } }
  | { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: RouteContext) {
  const params = await Promise.resolve(ctx.params)

  return Response.json({
    url: req.url,
    params,
  })
}
