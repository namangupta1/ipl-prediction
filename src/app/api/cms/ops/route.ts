import { NextRequest, NextResponse } from 'next/server'

import { requireCmsSession } from '@/lib/cmsSession'
import { supabaseServer } from '@/lib/supabaseServer'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type OpsMatchRow = {
  id: string
  match_state: string
  team_a: string
  team_b: string
  match_date: string
}

type OpsQuestionRow = {
  id: string
  question_text: string
  question_category: string
  display_order: number
  question_status: string
  is_locked: boolean
  is_settled: boolean
  correct_option_id: string | null
}

type OpsOptionRow = {
  id: string
  question_id: string
  option_text: string
  display_order: number
  is_correct: boolean | null
}

export async function GET(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const matchId = request.nextUrl.searchParams.get('match_id')?.trim() ?? ''

  if (!matchId) {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }

  if (!UUID_LIKE_REGEX.test(matchId)) {
    return NextResponse.json({ error: 'Invalid match_id' }, { status: 400 })
  }

  const { data: match, error: matchError } = await supabaseServer
    .from('matches')
    .select('id, match_state, team_a, team_b, match_date')
    .eq('id', matchId)
    .maybeSingle<OpsMatchRow>()

  if (matchError) {
    return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 })
  }

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  const { data: questions, error: questionsError } = await supabaseServer
    .from('questions')
    .select(
      'id, question_text, question_category, display_order, question_status, is_locked, is_settled, correct_option_id'
    )
    .eq('match_id', matchId)
    .order('question_category', { ascending: true })
    .order('display_order', { ascending: true })

  if (questionsError) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }

  const questionIds = (questions ?? []).map((question) => question.id)

  let options: OpsOptionRow[] = []

  if (questionIds.length > 0) {
    const { data: optionsData, error: optionsError } = await supabaseServer
      .from('options')
      .select('id, question_id, option_text, display_order, is_correct')
      .in('question_id', questionIds)
      .order('question_id', { ascending: true })
      .order('display_order', { ascending: true })

    if (optionsError) {
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 })
    }

    options = (optionsData ?? []) as OpsOptionRow[]
  }

  return NextResponse.json(
    {
      match: {
        id: match.id,
        match_state: match.match_state,
        teams: {
          team_a: match.team_a,
          team_b: match.team_b,
        },
        match_date: match.match_date,
      },
      questions: (questions ?? []) as OpsQuestionRow[],
      options,
    },
    { status: 200 }
  )
}
