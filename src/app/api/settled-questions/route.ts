import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type OptionItem = {
  id: string
  question_id: string
  option_text: string
  display_order: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const matchId = searchParams.get('match_id')?.trim() ?? ''

  if (!matchId) {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }
  if (!UUID_LIKE_REGEX.test(matchId)) {
    return NextResponse.json({ error: 'match_id must be a valid UUID' }, { status: 400 })
  }

  // 1) Fetch settled questions
  const { data: questions, error: qErr } = await supabaseServer
    .from('questions')
    .select(
      'id, match_id, question_text, question_category, display_order, is_locked, is_settled, correct_option_id'
    )
    .eq('match_id', matchId)
    .eq('question_status', 'published')
    .eq('is_settled', true)
    .order('question_category', { ascending: true })
    .order('display_order', { ascending: true })

  if (qErr) {
    return NextResponse.json(
      {
        error: 'Failed to fetch settled questions',
        code: (qErr as any).code,
        message: qErr.message,
        details: qErr,
      },
      { status: 500 }
    )
  }

  const questionIds = (questions ?? []).map((q) => q.id)

  // 2) Fetch options for those questions
  const optionsByQuestionId = new Map<string, OptionItem[]>()

  if (questionIds.length > 0) {
    const { data: options, error: oErr } = await supabaseServer
      .from('options')
      .select('id, question_id, option_text, display_order')
      .in('question_id', questionIds)
      .order('question_id', { ascending: true })
      .order('display_order', { ascending: true })

    if (oErr) {
      return NextResponse.json(
        {
          error: 'Failed to fetch settled options',
          code: (oErr as any).code,
          message: oErr.message,
          details: oErr,
        },
        { status: 500 }
      )
    }

    for (const opt of options ?? []) {
      const list = optionsByQuestionId.get(opt.question_id) ?? []
      list.push(opt)
      optionsByQuestionId.set(opt.question_id, list)
    }
  }

  // 3) Attach options + correct_option_text
  const response = (questions ?? []).map((q) => {
    const opts = optionsByQuestionId.get(q.id) ?? []
    const correctText = opts.find((o) => o.id === q.correct_option_id)?.option_text ?? null

    return {
      ...q,
      options: opts,
      correct_option_text: correctText,
    }
  })

  return NextResponse.json({ questions: response }, { status: 200 })
}