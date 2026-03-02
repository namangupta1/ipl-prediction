import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuidLike(value: string) {
  return UUID_LIKE_REGEX.test(value)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const matchId = searchParams.get('match_id')?.trim() ?? ''
  const userKey = searchParams.get('user_key')?.trim() ?? ''

  if (!isUuidLike(matchId) || !isUuidLike(userKey)) {
    return NextResponse.json(
      { error: 'Invalid match_id or user_key' },
      { status: 400 }
    )
  }

  try {
    // Fetch answers
    const { data: answers, error: answersError } = await supabaseServer
      .from('answers')
      .select('question_id, option_id')
      .eq('match_id', matchId)
      .eq('user_key', userKey)

    if (answersError) {
      return NextResponse.json(
        { error: 'Failed to fetch answers' },
        { status: 500 }
      )
    }

    // Fetch settled questions with correct answers
    const { data: questions, error: questionsError } = await supabaseServer
      .from('questions')
      .select('id, is_settled, correct_option_id')
      .eq('match_id', matchId)
      .eq('is_settled', true)

    if (questionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch settled questions' },
        { status: 500 }
      )
    }

    const answerMap = new Map(
      (answers ?? []).map((a) => [a.question_id, a.option_id])
    )

    let totalSettled = 0
    let totalCorrect = 0

    for (const q of questions ?? []) {
      totalSettled++
      const userOption = answerMap.get(q.id)
      if (userOption && userOption === q.correct_option_id) {
        totalCorrect++
      }
    }

    return NextResponse.json(
      {
        answers: answers ?? [],
        scoring: {
          total_settled: totalSettled,
          total_correct: totalCorrect,
          total_answered: answers?.length ?? 0,
          score: totalCorrect,
        },
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}