import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('matches')
      .select(
        'id, match_number, team_a, team_b, match_date, match_state, prize_name, prize_image_url'
      )
      .order('match_date', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      )
    }

    return NextResponse.json({ matches: data ?? [] }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
