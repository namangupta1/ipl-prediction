import { NextRequest, NextResponse } from 'next/server'

import { requireCmsSession } from '@/lib/cmsSession'
import { supabaseServer } from '@/lib/supabaseServer'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SettleBody = {
  question_id?: unknown
  correct_option_id?: unknown
}

export async function POST(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SettleBody

  try {
    body = (await request.json()) as SettleBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const questionId =
    typeof body.question_id === 'string' ? body.question_id.trim() : ''
  const correctOptionId =
    typeof body.correct_option_id === 'string' ? body.correct_option_id.trim() : ''

  if (!UUID_LIKE_REGEX.test(questionId) || !UUID_LIKE_REGEX.test(correctOptionId)) {
    return NextResponse.json(
      { error: 'question_id and correct_option_id must be valid UUIDs' },
      { status: 400 }
    )
  }

  const { data: question, error: questionError } = await supabaseServer
    .from('questions')
    .select('id')
    .eq('id', questionId)
    .maybeSingle<{ id: string }>()

  if (questionError) {
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 })
  }

  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const { data: option, error: optionError } = await supabaseServer
    .from('options')
    .select('id, question_id')
    .eq('id', correctOptionId)
    .maybeSingle<{ id: string; question_id: string }>()

  if (optionError) {
    return NextResponse.json({ error: 'Failed to fetch option' }, { status: 500 })
  }

  if (!option) {
    return NextResponse.json({ error: 'Option not found' }, { status: 404 })
  }

  if (option.question_id !== questionId) {
    return NextResponse.json(
      { error: 'correct_option_id does not belong to question_id' },
      { status: 400 }
    )
  }

  const { error: clearError } = await supabaseServer
    .from('options')
    .update({ is_correct: false })
    .eq('question_id', questionId)

  if (clearError) {
    return NextResponse.json({ error: 'Failed to reset question options' }, { status: 500 })
  }

  const { error: setError } = await supabaseServer
    .from('options')
    .update({ is_correct: true })
    .eq('id', correctOptionId)

  if (setError) {
    return NextResponse.json({ error: 'Failed to set correct option' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
