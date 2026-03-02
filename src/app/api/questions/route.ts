import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ALL_PHASE_CATEGORIES = [
  'innings_1_phase_1',
  'innings_1_phase_2',
  'innings_1_phase_3',
  'innings_2_phase_1',
  'innings_2_phase_2',
  'innings_2_phase_3',
]

const STATE_TO_CATEGORY_MAP: Record<string, string[]> = {
  upcoming: ['pre_match'],
  toss_completed: [...ALL_PHASE_CATEGORIES],
  innings_1_phase_1: [...ALL_PHASE_CATEGORIES],
  innings_1_phase_2: [...ALL_PHASE_CATEGORIES],
  innings_1_phase_3: [...ALL_PHASE_CATEGORIES],
  innings_1_completed: [...ALL_PHASE_CATEGORIES],
  innings_2_phase_1: [...ALL_PHASE_CATEGORIES],
  innings_2_phase_2: [...ALL_PHASE_CATEGORIES],
  innings_2_phase_3: [...ALL_PHASE_CATEGORIES],
  completed: [...ALL_PHASE_CATEGORIES],
}

type QuestionRow = {
  id: string
  match_id: string
  question_text: string
  question_category: string
  display_order: number
  question_status: string
  is_locked: boolean
  is_settled: boolean
  correct_option_id: string | null
}

type OptionRow = {
  id: string
  question_id: string
  option_text: string
  display_order: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('match_id')?.trim()
  const mode = searchParams.get('mode')?.trim()

  if (!matchId) {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }

  if (!UUID_LIKE_REGEX.test(matchId)) {
    return NextResponse.json({ error: 'match_id must be a valid UUID' }, { status: 400 })
  }

  try {
    const { data: match, error: matchError } = await supabaseServer
      .from('matches')
      .select('id, match_state')
      .eq('id', matchId)
      .maybeSingle<{ id: string; match_state: string }>()

    if (matchError) {
      return NextResponse.json({ error: 'Failed to fetch match' }, { status: 500 })
    }

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const allowedCategories = STATE_TO_CATEGORY_MAP[match.match_state] ?? []

    if (mode !== 'all' && allowedCategories.length === 0) {
      return NextResponse.json(
        {
          match: {
            id: match.id,
            match_state: match.match_state,
          },
          questions: [],
        },
        { status: 200 }
      )
    }

    let questionQuery = supabaseServer
      .from('questions')
      .select(
        'id, match_id, question_text, question_category, display_order, question_status, is_locked, is_settled, correct_option_id'
      )
      .eq('match_id', matchId)
      .eq('question_status', 'published')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (mode !== 'all') {
      questionQuery = questionQuery.in('question_category', allowedCategories)
    }

    const { data: questions, error: questionsError } = await questionQuery

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    const questionRows = (questions ?? []) as QuestionRow[]
    const questionIds = questionRows.map((question) => question.id)
    const optionsByQuestionId = new Map<string, OptionRow[]>()

    if (questionIds.length > 0) {
      const { data: options, error: optionsError } = await supabaseServer
        .from('options')
        .select('id, question_id, option_text, display_order')
        .in('question_id', questionIds)
        .order('question_id', { ascending: true })
        .order('display_order', { ascending: true })

      if (optionsError) {
        return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 })
      }

      for (const option of (options ?? []) as OptionRow[]) {
        const existing = optionsByQuestionId.get(option.question_id) ?? []
        existing.push(option)
        optionsByQuestionId.set(option.question_id, existing)
      }
    }

    const responseQuestions = questionRows.map((question) => {
      const options = optionsByQuestionId.get(question.id) ?? []
      const correctOption = question.correct_option_id
        ? options.find((option) => option.id === question.correct_option_id)
        : null

      return {
        id: question.id,
        match_id: question.match_id,
        question_text: question.question_text,
        question_category: question.question_category,
        display_order: question.display_order,
        question_status: question.question_status,
        is_locked: Boolean(question.is_locked),
        is_settled: Boolean(question.is_settled),
        correct_option_id: question.correct_option_id,
        correct_option_text: correctOption?.option_text ?? null,
        options,
      }
    })

    return NextResponse.json(
      {
        match: {
          id: match.id,
          match_state: match.match_state,
        },
        questions: responseQuestions,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
