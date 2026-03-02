import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'
import { requireCmsSession } from '@/lib/cmsSession'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const QUESTION_CATEGORIES = [
  'pre_match',
  'innings_1_phase_1',
  'innings_1_phase_2',
  'innings_1_phase_3',
  'innings_2_phase_1',
  'innings_2_phase_2',
  'innings_2_phase_3',
] as const

const QUESTION_STATUSES = ['draft', 'published', 'locked', 'settled'] as const
const CREATE_ALLOWED_STATUSES = ['draft', 'published'] as const

type QuestionCategory = (typeof QUESTION_CATEGORIES)[number]
type QuestionStatus = (typeof QUESTION_STATUSES)[number]

type CreateQuestionBody = {
  match_id?: unknown
  question_text?: unknown
  question_category?: unknown
  display_order?: unknown
  question_status?: unknown
  options?: unknown
}

type PatchQuestionOption = {
  id?: unknown
  option_text?: unknown
  display_order?: unknown
}

type PatchQuestionBody = {
  id?: unknown
  question_text?: unknown
  question_category?: unknown
  display_order?: unknown
  question_status?: unknown
  is_locked?: unknown
  is_settled?: unknown
  correct_option_id?: unknown
  options?: unknown
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
  created_at: string
}

type OptionRow = {
  id: string
  question_id: string
  option_text: string
  display_order: number
  is_correct: boolean | null
}

function isValidCategory(value: string): value is QuestionCategory {
  return QUESTION_CATEGORIES.includes(value as QuestionCategory)
}

function isValidStatus(value: string): value is QuestionStatus {
  return QUESTION_STATUSES.includes(value as QuestionStatus)
}

function parsePositiveInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null
  }

  return value
}

function parseRequiredText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }

  return null
}

async function fetchQuestionsWithOptions(matchId: string, category?: string) {
  let questionQuery = supabaseServer
    .from('questions')
    .select(
      'id, match_id, question_text, question_category, display_order, question_status, is_locked, is_settled, correct_option_id, created_at'
    )
    .eq('match_id', matchId)
    .order('question_category', { ascending: true })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (category) {
    questionQuery = questionQuery.eq('question_category', category)
  }

  const { data: questions, error: questionsError } = await questionQuery

  if (questionsError) {
    return { error: questionsError.message, questions: [], options: [] }
  }

  const questionIds = (questions ?? []).map((question) => question.id)

  if (questionIds.length === 0) {
    return { error: null, questions: questions ?? [], options: [] }
  }

  const { data: options, error: optionsError } = await supabaseServer
    .from('options')
    .select('id, question_id, option_text, display_order, is_correct')
    .in('question_id', questionIds)
    .order('display_order', { ascending: true })

  if (optionsError) {
    return { error: optionsError.message, questions: [], options: [] }
  }

  return { error: null, questions: questions ?? [], options: options ?? [] }
}

export async function GET(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const matchId = request.nextUrl.searchParams.get('match_id')?.trim() ?? ''
  const questionCategory =
    request.nextUrl.searchParams.get('question_category')?.trim() ?? ''

  if (!matchId) {
    return NextResponse.json({ error: 'match_id is required' }, { status: 400 })
  }

  if (!UUID_LIKE_REGEX.test(matchId)) {
    return NextResponse.json({ error: 'Invalid match_id' }, { status: 400 })
  }

  if (questionCategory && !isValidCategory(questionCategory)) {
    return NextResponse.json({ error: 'Invalid question_category' }, { status: 400 })
  }

  const { error, questions, options } = await fetchQuestionsWithOptions(
    matchId,
    questionCategory || undefined
  )

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
  }

  const optionsByQuestionId = new Map<string, OptionRow[]>()

  for (const option of options as OptionRow[]) {
    const current = optionsByQuestionId.get(option.question_id) ?? []
    current.push(option)
    optionsByQuestionId.set(option.question_id, current)
  }

  const responseQuestions = (questions as QuestionRow[]).map((question) => ({
    ...question,
    options: optionsByQuestionId.get(question.id) ?? [],
  }))

  return NextResponse.json({ questions: responseQuestions }, { status: 200 })
}

export async function POST(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateQuestionBody

  try {
    body = (await request.json()) as CreateQuestionBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const matchId = typeof body.match_id === 'string' ? body.match_id.trim() : ''
  const questionText = parseRequiredText(body.question_text)
  const questionCategory =
    typeof body.question_category === 'string' ? body.question_category.trim() : ''
  const displayOrder = parsePositiveInt(body.display_order)
  const questionStatus =
    typeof body.question_status === 'string' ? body.question_status.trim() : ''

  if (!matchId || !UUID_LIKE_REGEX.test(matchId)) {
    return NextResponse.json({ error: 'Invalid match_id' }, { status: 400 })
  }

  if (!questionText) {
    return NextResponse.json({ error: 'Invalid question_text' }, { status: 400 })
  }

  if (!isValidCategory(questionCategory)) {
    return NextResponse.json({ error: 'Invalid question_category' }, { status: 400 })
  }

  if (!displayOrder) {
    return NextResponse.json({ error: 'Invalid display_order' }, { status: 400 })
  }

  if (!(CREATE_ALLOWED_STATUSES as readonly string[]).includes(questionStatus)) {
    return NextResponse.json({ error: 'Invalid question_status' }, { status: 400 })
  }

  if (!Array.isArray(body.options) || ![2, 4].includes(body.options.length)) {
    return NextResponse.json(
      { error: 'options length must be 2 or 4' },
      { status: 400 }
    )
  }

  const parsedOptions = body.options.map((option, index) => {
    const item = option as PatchQuestionOption
    const optionText = parseRequiredText(item.option_text)
    const optionDisplayOrder = parsePositiveInt(item.display_order)

    return {
      option_text: optionText,
      display_order: optionDisplayOrder ?? index + 1,
    }
  })

  if (parsedOptions.some((option) => !option.option_text || !option.display_order)) {
    return NextResponse.json({ error: 'Invalid options payload' }, { status: 400 })
  }

  const { data: question, error: questionError } = await supabaseServer
    .from('questions')
    .insert({
      match_id: matchId,
      question_text: questionText,
      question_category: questionCategory,
      display_order: displayOrder,
      question_status: questionStatus,
    })
    .select(
      'id, match_id, question_text, question_category, display_order, question_status, is_locked, is_settled, correct_option_id, created_at'
    )
    .maybeSingle()

  if (questionError || !question) {
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
  }

  const { data: options, error: optionsError } = await supabaseServer
    .from('options')
    .insert(
      parsedOptions.map((option) => ({
        question_id: question.id,
        option_text: option.option_text,
        display_order: option.display_order,
      }))
    )
    .select('id, question_id, option_text, display_order, is_correct')
    .order('display_order', { ascending: true })

  if (optionsError) {
    return NextResponse.json({ error: 'Failed to create options' }, { status: 500 })
  }

  return NextResponse.json(
    {
      question: {
        ...question,
        options: options ?? [],
      },
    },
    { status: 201 }
  )
}

export async function PATCH(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: PatchQuestionBody

  try {
    body = (await request.json()) as PatchQuestionBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''

  if (!id || !UUID_LIKE_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const { data: existingQuestion, error: existingQuestionError } = await supabaseServer
    .from('questions')
    .select('id, is_locked, is_settled, correct_option_id')
    .eq('id', id)
    .maybeSingle<{
      id: string
      is_locked: boolean
      is_settled: boolean
      correct_option_id: string | null
    }>()

  if (existingQuestionError) {
    console.error('CMS question PATCH fetch existing question error:', existingQuestionError)
    return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 })
  }

  if (!existingQuestion) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 })
  }

  const questionUpdate: Record<string, string | number | boolean | null> = {}

  if (body.question_text !== undefined) {
    const questionText = parseRequiredText(body.question_text)

    if (!questionText) {
      return NextResponse.json({ error: 'Invalid question_text' }, { status: 400 })
    }

    questionUpdate.question_text = questionText
  }

  if (body.question_category !== undefined) {
    const questionCategory =
      typeof body.question_category === 'string' ? body.question_category.trim() : ''

    if (!isValidCategory(questionCategory)) {
      return NextResponse.json({ error: 'Invalid question_category' }, { status: 400 })
    }

    questionUpdate.question_category = questionCategory
  }

  if (body.display_order !== undefined) {
    const displayOrder = parsePositiveInt(body.display_order)

    if (!displayOrder) {
      return NextResponse.json({ error: 'Invalid display_order' }, { status: 400 })
    }

    questionUpdate.display_order = displayOrder
  }

  if (body.question_status !== undefined) {
    const questionStatus =
      typeof body.question_status === 'string' ? body.question_status.trim() : ''

    if (!isValidStatus(questionStatus)) {
      return NextResponse.json({ error: 'Invalid question_status' }, { status: 400 })
    }

    questionUpdate.question_status = questionStatus
  }

  const hasIsLocked = body.is_locked !== undefined
  const hasIsSettled = body.is_settled !== undefined
  const hasCorrectOptionId = body.correct_option_id !== undefined

  if (hasIsLocked) {
    const isLocked = parseBoolean(body.is_locked)
    if (isLocked === null) {
      return NextResponse.json({ error: 'Invalid is_locked' }, { status: 400 })
    }
    questionUpdate.is_locked = isLocked
  }

  if (hasIsSettled) {
    const isSettled = parseBoolean(body.is_settled)
    if (isSettled === null) {
      return NextResponse.json({ error: 'Invalid is_settled' }, { status: 400 })
    }
    questionUpdate.is_settled = isSettled
  }

  let nextCorrectOptionId = existingQuestion.correct_option_id
  if (hasCorrectOptionId) {
    if (body.correct_option_id === null) {
      nextCorrectOptionId = null
      questionUpdate.correct_option_id = null
    } else if (typeof body.correct_option_id === 'string') {
      const correctOptionId = body.correct_option_id.trim()
      if (!UUID_LIKE_REGEX.test(correctOptionId)) {
        return NextResponse.json({ error: 'Invalid correct_option_id' }, { status: 400 })
      }

      const { data: optionMatch, error: optionMatchError } = await supabaseServer
        .from('options')
        .select('id, question_id')
        .eq('id', correctOptionId)
        .eq('question_id', id)
        .maybeSingle<{ id: string; question_id: string }>()

      if (optionMatchError) {
        console.error('CMS question PATCH validate correct option error:', optionMatchError)
        return NextResponse.json(
          { error: 'Failed to validate correct_option_id' },
          { status: 500 }
        )
      }

      if (!optionMatch) {
        return NextResponse.json(
          { error: 'correct_option_id does not belong to this question' },
          { status: 400 }
        )
      }

      nextCorrectOptionId = correctOptionId
      questionUpdate.correct_option_id = correctOptionId
    } else {
      return NextResponse.json({ error: 'Invalid correct_option_id' }, { status: 400 })
    }
  }

  const nextIsSettled =
    hasIsSettled && typeof questionUpdate.is_settled === 'boolean'
      ? (questionUpdate.is_settled as boolean)
      : existingQuestion.is_settled

  if (nextIsSettled && !nextCorrectOptionId) {
    return NextResponse.json(
      { error: 'correct_option_id is required when is_settled=true' },
      { status: 400 }
    )
  }

  if (Object.keys(questionUpdate).length > 0) {
    const { error } = await supabaseServer
      .from('questions')
      .update(questionUpdate)
      .eq('id', id)

    if (error) {
      console.error('CMS question PATCH update error:', error)
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 })
    }
  }

  if (body.options !== undefined) {
    if (!Array.isArray(body.options) || body.options.length === 0) {
      return NextResponse.json({ error: 'Invalid options payload' }, { status: 400 })
    }

    for (const rawOption of body.options) {
      const option = rawOption as PatchQuestionOption
      const optionId = typeof option.id === 'string' ? option.id.trim() : ''
      const optionText = parseRequiredText(option.option_text)
      const optionDisplayOrder = parsePositiveInt(option.display_order)

      if (!optionText || !optionDisplayOrder) {
        return NextResponse.json({ error: 'Invalid options payload' }, { status: 400 })
      }

      if (optionId) {
        if (!UUID_LIKE_REGEX.test(optionId)) {
          return NextResponse.json({ error: 'Invalid option id' }, { status: 400 })
        }

        const { error } = await supabaseServer
          .from('options')
          .update({
            option_text: optionText,
            display_order: optionDisplayOrder,
          })
          .eq('id', optionId)
          .eq('question_id', id)

        if (error) {
          console.error('CMS question PATCH option update error:', error)
          return NextResponse.json({ error: 'Failed to update option' }, { status: 500 })
        }
      } else {
        const { error } = await supabaseServer.from('options').insert({
          question_id: id,
          option_text: optionText,
          display_order: optionDisplayOrder,
        })

        if (error) {
          console.error('CMS question PATCH option insert error:', error)
          return NextResponse.json({ error: 'Failed to add option' }, { status: 500 })
        }
      }
    }
  }

  const { data: question, error: questionError } = await supabaseServer
    .from('questions')
    .select(
      'id, match_id, question_text, question_category, display_order, question_status, is_locked, is_settled, correct_option_id, created_at'
    )
    .eq('id', id)
    .maybeSingle()

  if (questionError || !question) {
    if (questionError) {
      console.error('CMS question PATCH fetch updated question error:', questionError)
    }
    return NextResponse.json({ error: 'Failed to fetch updated question' }, { status: 500 })
  }

  const { data: options, error: optionsError } = await supabaseServer
    .from('options')
    .select('id, question_id, option_text, display_order, is_correct')
    .eq('question_id', id)
    .order('display_order', { ascending: true })

  if (optionsError) {
    return NextResponse.json({ error: 'Failed to fetch updated options' }, { status: 500 })
  }

  return NextResponse.json(
    {
      question: {
        ...question,
        options: options ?? [],
      },
    },
    { status: 200 }
  )
}
