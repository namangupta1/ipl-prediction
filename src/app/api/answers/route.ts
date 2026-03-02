import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i



type AnswerRequestBody = {
  user_key: string
  match_id: string
  question_id: string
  option_id: string
}

function isUuidLike(value: string) {
  return UUID_LIKE_REGEX.test(value)
}

function json400(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function json404(message: string) {
  return NextResponse.json({ error: message }, { status: 404 })
}

function json409(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

function json500(message: string, details?: unknown) {
  // Keep server logs useful without leaking secrets to client
  if (details) console.error(message, details)
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function POST(request: Request) {
  let rawBody: unknown

  try {
    rawBody = await request.json()
  } catch {
    return json400('Invalid JSON body')
  }

  if (!rawBody || typeof rawBody !== 'object') {
    return json400('Request body must be an object')
  }

  const body = rawBody as Partial<AnswerRequestBody>

  const userKey = typeof body.user_key === 'string' ? body.user_key.trim() : ''
  const matchId = typeof body.match_id === 'string' ? body.match_id.trim() : ''
  const questionId =
    typeof body.question_id === 'string' ? body.question_id.trim() : ''
  const optionId =
    typeof body.option_id === 'string' ? body.option_id.trim() : ''

  const missing = []
  if (!userKey) missing.push('user_key')
  if (!matchId) missing.push('match_id')
  if (!questionId) missing.push('question_id')
  if (!optionId) missing.push('option_id')

  if (missing.length > 0) {
    return json400(`Missing or invalid fields: ${missing.join(', ')}`)
  }

  const nonUuid = [
    ['user_key', userKey],
    ['match_id', matchId],
    ['question_id', questionId],
    ['option_id', optionId],
  ].filter(([, v]) => !isUuidLike(v))

  if (nonUuid.length > 0) {
    return json400(
      `Fields must be UUID-like: ${nonUuid.map(([k]) => k).join(', ')}`
    )
  }

  // ---- Fetch match ----
  const { data: match, error: matchFetchError } = await supabaseServer
    .from('matches')
    .select('id, match_state')
    .eq('id', matchId)
    .maybeSingle()

  if (matchFetchError) {
    return json500('Failed to fetch match', matchFetchError)
  }

  if (!match) {
    return json404('Match not found')
  }

  // ---- Fetch question (single source of truth) ----
  const { data: question, error: questionFetchError } = await supabaseServer
  .from('questions')
  .select('id, match_id, question_category, question_status, is_locked,is_settled')
  .eq('id', questionId)
  .maybeSingle()

if (questionFetchError) {
  console.error('Fetch question error:', questionFetchError)
  return NextResponse.json(
    {
      error: questionFetchError.message,
      code: (questionFetchError as any).code,
      details: questionFetchError,
    },
    { status: 500 }
  )
}

if (!question) {
  return NextResponse.json({ error: 'Question not found' }, { status: 404 })
}

  if (question.match_id !== matchId) {
    return json400('question_id does not belong to match_id')
  }

  if (question.question_status !== 'published') {
    return json400('Question is not answerable in current status')
  }

  // Lock/settle enforced by CMS flags (your latest model)
  if (question.is_locked) {
    return json409('Answer locked for this question')
  }

  if (question.is_settled) {
    return json409('Question already settled')
  }

  

  // ---- Fetch option and validate it belongs to the question ----
  const { data: option, error: optionFetchError } = await supabaseServer
    .from('options')
    .select('id, question_id')
    .eq('id', optionId)
    .maybeSingle()

  if (optionFetchError) {
    return json500('Failed to fetch option', optionFetchError)
  }

  if (!option) {
    return json404('Option not found')
  }

  if (option.question_id !== questionId) {
    return json400('option_id does not belong to question_id')
  }

  // ---- Save answer (upsert) ----
  const { error: upsertError } = await supabaseServer.from('answers').upsert(
    {
      user_key: userKey,
      match_id: matchId,
      question_id: questionId,
      option_id: optionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_key,question_id' }
  )

  if (upsertError) {
    const isMissingConflictConstraint =
      upsertError.code === '42P10' ||
      /no unique or exclusion constraint/i.test(upsertError.message)

    if (isMissingConflictConstraint) {
      return json500(
        'Upsert requires a unique constraint on answers(user_key, question_id).',
        upsertError
      )
    }

    return json500('Failed to save answer', upsertError)
  }

  return NextResponse.json({ success: true }, { status: 200 })
}