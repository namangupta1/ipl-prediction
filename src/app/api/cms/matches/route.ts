import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'
import { requireCmsSession } from '@/lib/cmsSession'

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const MATCH_STATES = [
  'upcoming',
  'toss_completed',
  'innings_1_phase_1',
  'innings_1_phase_2',
  'innings_1_phase_3',
  'innings_1_completed',
  'innings_2_phase_1',
  'innings_2_phase_2',
  'innings_2_phase_3',
  'completed',
] as const

type MatchState = (typeof MATCH_STATES)[number]

type CreateMatchBody = {
  match_number?: unknown
  team_a?: unknown
  team_b?: unknown
  match_date?: unknown
  prize_name?: unknown
  prize_image_url?: unknown
}

type UpdateMatchBody = {
  id?: unknown
  match_state?: unknown
  prize_name?: unknown
  prize_image_url?: unknown
  match_date?: unknown
  team_a?: unknown
  team_b?: unknown
  match_number?: unknown
}

function isValidDateString(value: string) {
  if (!DATE_REGEX.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime())
}

function isValidMatchState(value: string): value is MatchState {
  return MATCH_STATES.includes(value as MatchState)
}

function parseOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseRequiredText(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parsePositiveInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null
  }

  return value
}

export async function GET(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseServer
    .from('matches')
    .select(
      'id, match_number, team_a, team_b, match_date, match_state, prize_name, prize_image_url, created_at, updated_at'
    )
    .order('match_date', { ascending: false })
    .order('match_number', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
  }

  return NextResponse.json({ matches: data ?? [] }, { status: 200 })
}

export async function POST(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CreateMatchBody

  try {
    body = (await request.json()) as CreateMatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const matchNumber = parsePositiveInt(body.match_number)
  const teamA = parseRequiredText(body.team_a)
  const teamB = parseRequiredText(body.team_b)
  const matchDate = typeof body.match_date === 'string' ? body.match_date.trim() : ''
  const prizeName = parseOptionalText(body.prize_name)
  const prizeImageUrl = parseOptionalText(body.prize_image_url)

  if (!matchNumber || !teamA || !teamB || !isValidDateString(matchDate)) {
    return NextResponse.json(
      { error: 'Invalid match payload' },
      { status: 400 }
    )
  }

  const { error } = await supabaseServer.from('matches').insert({
    match_number: matchNumber,
    team_a: teamA,
    team_b: teamB,
    match_date: matchDate,
    prize_name: prizeName,
    prize_image_url: prizeImageUrl,
    match_state: 'upcoming',
  })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'match_number already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: UpdateMatchBody

  try {
    body = (await request.json()) as UpdateMatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id.trim() : ''

  if (!id || !UUID_LIKE_REGEX.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const updatePayload: Record<string, string | number | null> = {}

  if (body.match_state !== undefined) {
    const state = typeof body.match_state === 'string' ? body.match_state.trim() : ''

    if (!isValidMatchState(state)) {
      return NextResponse.json({ error: 'Invalid match_state' }, { status: 400 })
    }

    updatePayload.match_state = state
  }

  if (body.match_date !== undefined) {
    const matchDate =
      typeof body.match_date === 'string' ? body.match_date.trim() : ''

    if (!isValidDateString(matchDate)) {
      return NextResponse.json({ error: 'Invalid match_date' }, { status: 400 })
    }

    updatePayload.match_date = matchDate
  }

  if (body.team_a !== undefined) {
    const teamA = parseRequiredText(body.team_a)

    if (!teamA) {
      return NextResponse.json({ error: 'Invalid team_a' }, { status: 400 })
    }

    updatePayload.team_a = teamA
  }

  if (body.team_b !== undefined) {
    const teamB = parseRequiredText(body.team_b)

    if (!teamB) {
      return NextResponse.json({ error: 'Invalid team_b' }, { status: 400 })
    }

    updatePayload.team_b = teamB
  }

  if (body.match_number !== undefined) {
    const matchNumber = parsePositiveInt(body.match_number)

    if (!matchNumber) {
      return NextResponse.json({ error: 'Invalid match_number' }, { status: 400 })
    }

    updatePayload.match_number = matchNumber
  }

  if (body.prize_name !== undefined) {
    updatePayload.prize_name = parseOptionalText(body.prize_name) ?? null
  }

  if (body.prize_image_url !== undefined) {
    updatePayload.prize_image_url = parseOptionalText(body.prize_image_url) ?? null
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('matches')
    .update(updatePayload)
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'match_number already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
