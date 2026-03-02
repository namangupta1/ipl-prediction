'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type AllowlistPhone = {
  phone: string
  label: string | null
  created_at: string
}

type CmsMatch = {
  id: string
  match_number: number
  team_a: string
  team_b: string
  match_date: string
  match_state: string
  prize_name: string | null
  prize_image_url: string | null
}

type EditableMatch = {
  id: string
  match_number: string
  team_a: string
  team_b: string
  match_date: string
  match_state: string
  prize_name: string
  prize_image_url: string
}

type CmsQuestionOption = {
  id: string
  question_id: string
  option_text: string
  display_order: number
  is_correct: boolean | null
}

type CmsQuestion = {
  id: string
  match_id: string
  question_text: string
  question_category: string
  display_order: number
  question_status: string
  created_at: string
  options: CmsQuestionOption[]
}

type LiveOpsMatch = {
  id: string
  match_state: string
  match_date: string
  teams: {
    team_a: string
    team_b: string
  }
}

type LiveOpsQuestion = {
  id: string
  question_text: string
  question_category: string
  display_order: number
  question_status: string
  is_locked: boolean
  is_settled: boolean
  correct_option_id: string | null
}

type EditableQuestionOption = {
  id?: string
  option_text: string
  display_order: number
}

type EditableQuestion = {
  id: string
  question_text: string
  question_category: string
  display_order: string
  question_status: string
  options: EditableQuestionOption[]
}

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
]

const QUESTION_CATEGORIES = [
  'pre_match',
  'innings_1_phase_1',
  'innings_1_phase_2',
  'innings_1_phase_3',
  'innings_2_phase_1',
  'innings_2_phase_2',
  'innings_2_phase_3',
]

const QUESTION_STATUSES = ['draft', 'published', 'locked', 'settled']
const CREATE_QUESTION_STATUSES = ['draft', 'published']

const DEFAULT_NEW_MATCH = {
  match_number: '',
  team_a: '',
  team_b: '',
  match_date: '',
  prize_name: '',
  prize_image_url: '',
}

const DEFAULT_NEW_QUESTION = {
  question_text: '',
  display_order: '1',
  question_status: 'draft',
  option_count: '2',
  options: ['', ''],
}

function toEditableMatch(match: CmsMatch): EditableMatch {
  return {
    id: match.id,
    match_number: String(match.match_number ?? ''),
    team_a: match.team_a ?? '',
    team_b: match.team_b ?? '',
    match_date: match.match_date ?? '',
    match_state: match.match_state ?? 'upcoming',
    prize_name: match.prize_name ?? '',
    prize_image_url: match.prize_image_url ?? '',
  }
}

function toEditableQuestion(question: CmsQuestion): EditableQuestion {
  return {
    id: question.id,
    question_text: question.question_text,
    question_category: question.question_category,
    display_order: String(question.display_order),
    question_status: question.question_status,
    options: (question.options ?? []).map((option) => ({
      id: option.id,
      option_text: option.option_text,
      display_order: option.display_order,
    })),
  }
}

function questionCategoryLabel(value: string) {
  return value.replaceAll('_', ' ')
}

export default function CmsDashboardPage() {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<
    'allowlist' | 'matches' | 'questions' | 'live_ops'
  >('allowlist')
  const [me, setMe] = useState('')
  const [phones, setPhones] = useState<AllowlistPhone[]>([])
  const [matches, setMatches] = useState<EditableMatch[]>([])

  const [newPhone, setNewPhone] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newMatch, setNewMatch] = useState(DEFAULT_NEW_MATCH)

  const [questions, setQuestions] = useState<CmsQuestion[]>([])
  const [questionMatchId, setQuestionMatchId] = useState('')
  const [questionCategory, setQuestionCategory] = useState(QUESTION_CATEGORIES[0])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionsError, setQuestionsError] = useState('')
  const [editingQuestion, setEditingQuestion] = useState<EditableQuestion | null>(null)
  const [opsMatchId, setOpsMatchId] = useState('')
  const [opsMatch, setOpsMatch] = useState<LiveOpsMatch | null>(null)
  const [opsQuestions, setOpsQuestions] = useState<LiveOpsQuestion[]>([])
  const [opsOptions, setOpsOptions] = useState<CmsQuestionOption[]>([])
  const [opsLoading, setOpsLoading] = useState(false)
  const [opsError, setOpsError] = useState('')
  const [settlingQuestionId, setSettlingQuestionId] = useState('')
  const [settleSelections, setSettleSelections] = useState<Record<string, string>>({})
  const [settleFeedbackByQuestion, setSettleFeedbackByQuestion] = useState<
    Record<string, { type: 'success' | 'error'; message: string }>
  >({})

  const [newQuestionText, setNewQuestionText] = useState(DEFAULT_NEW_QUESTION.question_text)
  const [newQuestionDisplayOrder, setNewQuestionDisplayOrder] = useState(
    DEFAULT_NEW_QUESTION.display_order
  )
  const [newQuestionStatus, setNewQuestionStatus] = useState(
    DEFAULT_NEW_QUESTION.question_status
  )
  const [newQuestionOptionCount, setNewQuestionOptionCount] = useState<'2' | '4'>(
    DEFAULT_NEW_QUESTION.option_count as '2' | '4'
  )
  const [newQuestionOptions, setNewQuestionOptions] = useState(DEFAULT_NEW_QUESTION.options)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingMatchId, setSavingMatchId] = useState('')
  const [savingQuestionId, setSavingQuestionId] = useState('')
  const [error, setError] = useState('')

  const matchOptions = useMemo(
    () =>
      matches.map((match) => ({
        id: match.id,
        label: `#${match.match_number || '-'} ${match.team_a || 'Team A'} vs ${match.team_b || 'Team B'}`,
      })),
    [matches]
  )

  const opsOptionsByQuestionId = useMemo(() => {
    const map = new Map<string, CmsQuestionOption[]>()

    for (const option of opsOptions) {
      const current = map.get(option.question_id) ?? []
      current.push(option)
      map.set(option.question_id, current)
    }

    return map
  }, [opsOptions])

  const groupedOpsQuestions = useMemo(() => {
    const map = new Map<string, LiveOpsQuestion[]>()

    for (const question of opsQuestions) {
      const current = map.get(question.question_category) ?? []
      current.push(question)
      map.set(question.question_category, current)
    }

    return Array.from(map.entries())
  }, [opsQuestions])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [meRes, listRes, matchesRes] = await Promise.all([
        fetch('/api/cms/me', { cache: 'no-store' }),
        fetch('/api/cms/allowlist', { cache: 'no-store' }),
        fetch('/api/cms/matches', { cache: 'no-store' }),
      ])

      if (meRes.status === 401) {
        router.replace('/cms')
        return
      }

      if (!meRes.ok || !listRes.ok || !matchesRes.ok) {
        throw new Error('Failed to load dashboard data')
      }

      const mePayload = await meRes.json()
      const listPayload = await listRes.json()
      const matchesPayload = await matchesRes.json()

      setMe(typeof mePayload.phone === 'string' ? mePayload.phone : '')
      setPhones(Array.isArray(listPayload.phones) ? listPayload.phones : [])

      const rawMatches = Array.isArray(matchesPayload.matches)
        ? (matchesPayload.matches as CmsMatch[])
        : []
      setMatches(rawMatches.map(toEditableMatch))
    } catch {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [router])

  const loadQuestions = useCallback(async () => {
    if (!questionMatchId) {
      setQuestionsError('Select a match first')
      setQuestions([])
      return
    }

    setQuestionsLoading(true)
    setQuestionsError('')
    setEditingQuestion(null)

    try {
      const url = new URL('/api/cms/questions', window.location.origin)
      url.searchParams.set('match_id', questionMatchId)
      url.searchParams.set('question_category', questionCategory)

      const response = await fetch(url.toString(), { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load questions')
      }

      const payload = await response.json()
      setQuestions(Array.isArray(payload.questions) ? payload.questions : [])
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to load questions'
      setQuestionsError(message)
      setQuestions([])
    } finally {
      setQuestionsLoading(false)
    }
  }, [questionCategory, questionMatchId])

  const loadOpsData = useCallback(async () => {
    if (!opsMatchId) {
      setOpsError('Select a match first')
      setOpsMatch(null)
      setOpsQuestions([])
      setOpsOptions([])
      return
    }

    setOpsLoading(true)
    setOpsError('')
    setSettleFeedbackByQuestion({})

    try {
      const url = new URL('/api/cms/ops', window.location.origin)
      url.searchParams.set('match_id', opsMatchId)

      const response = await fetch(url.toString(), { cache: 'no-store' })

      if (response.status === 401) {
        router.replace('/cms')
        return
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to load live ops data')
      }

      const payload = await response.json()
      const nextMatch = (payload.match ?? null) as LiveOpsMatch | null
      const nextQuestions = Array.isArray(payload.questions)
        ? (payload.questions as LiveOpsQuestion[])
        : []
      const nextOptions = Array.isArray(payload.options)
        ? (payload.options as CmsQuestionOption[])
        : []

      setOpsMatch(nextMatch)
      setOpsQuestions(nextQuestions)
      setOpsOptions(nextOptions)

      const nextSelections: Record<string, string> = {}

      for (const question of nextQuestions) {
        if (question.correct_option_id) {
          nextSelections[question.id] = question.correct_option_id
          continue
        }

        const correctFromOptionFlag = nextOptions.find(
          (option) => option.question_id === question.id && option.is_correct === true
        )

        if (correctFromOptionFlag) {
          nextSelections[question.id] = correctFromOptionFlag.id
        }
      }

      setSettleSelections(nextSelections)
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to load live ops data'
      setOpsError(message)
      setOpsMatch(null)
      setOpsQuestions([])
      setOpsOptions([])
    } finally {
      setOpsLoading(false)
    }
  }, [opsMatchId, router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!questionMatchId && matches.length > 0) {
      setQuestionMatchId(matches[0].id)
    }
  }, [matches, questionMatchId])

  useEffect(() => {
    if (!opsMatchId && matches.length > 0) {
      setOpsMatchId(matches[0].id)
    }
  }, [matches, opsMatchId])

  const onAddPhone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/cms/allowlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: newPhone, label: newLabel || undefined }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to add phone')
      }

      setNewPhone('')
      setNewLabel('')
      await load()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to add phone'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const onRemovePhone = async (phone: string) => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/cms/allowlist?phone=${encodeURIComponent(phone)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to remove phone')
      }

      await load()
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to remove phone'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const onCreateMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    try {
      const response = await fetch('/api/cms/matches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_number: Number(newMatch.match_number),
          team_a: newMatch.team_a,
          team_b: newMatch.team_b,
          match_date: newMatch.match_date,
          prize_name: newMatch.prize_name || undefined,
          prize_image_url: newMatch.prize_image_url || undefined,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to create match')
      }

      setNewMatch(DEFAULT_NEW_MATCH)
      await load()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to create match'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const onMatchFieldChange = (id: string, field: keyof EditableMatch, value: string) => {
    setMatches((current) =>
      current.map((match) => (match.id === id ? { ...match, [field]: value } : match))
    )
  }

  const onSaveMatch = async (match: EditableMatch) => {
    setSavingMatchId(match.id)
    setError('')

    try {
      const response = await fetch('/api/cms/matches', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: match.id,
          match_number: Number(match.match_number),
          team_a: match.team_a,
          team_b: match.team_b,
          match_date: match.match_date,
          match_state: match.match_state,
          prize_name: match.prize_name || null,
          prize_image_url: match.prize_image_url || null,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update match')
      }

      await load()
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Failed to update match'
      setError(message)
    } finally {
      setSavingMatchId('')
    }
  }

  const onQuestionOptionCountChange = (count: '2' | '4') => {
    setNewQuestionOptionCount(count)

    const targetLength = Number(count)
    setNewQuestionOptions((current) => {
      if (current.length === targetLength) {
        return current
      }

      if (current.length > targetLength) {
        return current.slice(0, targetLength)
      }

      return [...current, ...Array.from({ length: targetLength - current.length }, () => '')]
    })
  }

  const onCreateQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!questionMatchId) {
      setQuestionsError('Select a match first')
      return
    }

    setSaving(true)
    setQuestionsError('')

    try {
      const optionsPayload = newQuestionOptions.map((text, index) => ({
        option_text: text.trim(),
        display_order: index + 1,
      }))

      if (optionsPayload.some((option) => option.option_text.length === 0)) {
        throw new Error('All options are required')
      }

      const response = await fetch('/api/cms/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_id: questionMatchId,
          question_text: newQuestionText,
          question_category: questionCategory,
          display_order: Number(newQuestionDisplayOrder),
          question_status: newQuestionStatus,
          options: optionsPayload,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to create question')
      }

      setNewQuestionText(DEFAULT_NEW_QUESTION.question_text)
      setNewQuestionDisplayOrder(DEFAULT_NEW_QUESTION.display_order)
      setNewQuestionStatus(DEFAULT_NEW_QUESTION.question_status)
      onQuestionOptionCountChange('2')
      await loadQuestions()
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to create question'
      setQuestionsError(message)
    } finally {
      setSaving(false)
    }
  }

  const onOpenQuestionEditor = (question: CmsQuestion) => {
    setEditingQuestion(toEditableQuestion(question))
    setQuestionsError('')
  }

  const onEditQuestionField = (field: keyof EditableQuestion, value: string) => {
    setEditingQuestion((current) => {
      if (!current) {
        return current
      }

      return { ...current, [field]: value }
    })
  }

  const onEditOptionField = (index: number, value: string) => {
    setEditingQuestion((current) => {
      if (!current) {
        return current
      }

      const nextOptions = [...current.options]
      nextOptions[index] = {
        ...nextOptions[index],
        option_text: value,
      }

      return { ...current, options: nextOptions }
    })
  }

  const onAddEditOption = () => {
    setEditingQuestion((current) => {
      if (!current || current.options.length >= 4) {
        return current
      }

      const nextOptions = [
        ...current.options,
        {
          option_text: '',
          display_order: current.options.length + 1,
        },
      ]

      return { ...current, options: nextOptions }
    })
  }

  const onSaveEditedQuestion = async () => {
    if (!editingQuestion) {
      return
    }

    setSavingQuestionId(editingQuestion.id)
    setQuestionsError('')

    try {
      const optionsPayload = editingQuestion.options.map((option, index) => ({
        id: option.id,
        option_text: option.option_text.trim(),
        display_order: index + 1,
      }))

      if (optionsPayload.some((option) => option.option_text.length === 0)) {
        throw new Error('Option text cannot be empty')
      }

      const response = await fetch('/api/cms/questions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingQuestion.id,
          question_text: editingQuestion.question_text,
          question_category: editingQuestion.question_category,
          display_order: Number(editingQuestion.display_order),
          question_status: editingQuestion.question_status,
          options: optionsPayload,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update question')
      }

      setEditingQuestion(null)
      await loadQuestions()
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to update question'
      setQuestionsError(message)
    } finally {
      setSavingQuestionId('')
    }
  }

  const onTogglePublish = async (question: CmsQuestion) => {
    setSavingQuestionId(question.id)
    setQuestionsError('')

    try {
      const nextStatus = question.question_status === 'published' ? 'draft' : 'published'

      const response = await fetch('/api/cms/questions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: question.id,
          question_status: nextStatus,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update question status')
      }

      await loadQuestions()
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to update question status'
      setQuestionsError(message)
    } finally {
      setSavingQuestionId('')
    }
  }

  const onSettleQuestion = async (questionId: string) => {
    const selectedOptionId = settleSelections[questionId]

    if (!selectedOptionId) {
      setSettleFeedbackByQuestion((current) => ({
        ...current,
        [questionId]: { type: 'error', message: 'Select an option first' },
      }))
      return
    }

    setSettlingQuestionId(questionId)
    setSettleFeedbackByQuestion((current) => {
      const next = { ...current }
      delete next[questionId]
      return next
    })

    try {
      const response = await fetch('/api/cms/questions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: questionId,
          correct_option_id: selectedOptionId,
          is_settled: true,
          is_locked: true,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to update question settlement')
      }

      const payload = await response.json().catch(() => null)
      const updatedQuestion = payload?.question as LiveOpsQuestion | undefined

      if (!updatedQuestion || !updatedQuestion.is_settled) {
        throw new Error('Settlement not confirmed by server')
      }

      if (updatedQuestion.correct_option_id !== selectedOptionId) {
        throw new Error('Server did not persist selected correct option')
      }

      setOpsQuestions((current) =>
        current.map((question) =>
          question.id === questionId
            ? {
                ...question,
                is_settled: updatedQuestion.is_settled,
                is_locked: updatedQuestion.is_locked,
                correct_option_id: updatedQuestion.correct_option_id,
              }
            : question
        )
      )

      setSettleFeedbackByQuestion((current) => ({
        ...current,
        [questionId]: { type: 'success', message: 'Correct option saved' },
      }))
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Failed to settle question'
      setSettleFeedbackByQuestion((current) => ({
        ...current,
        [questionId]: { type: 'error', message },
      }))
    } finally {
      setSettlingQuestionId('')
    }
  }

  const onLogout = async () => {
    await fetch('/api/cms/logout', { method: 'POST' })
    router.replace('/cms')
    router.refresh()
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">CMS Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">Logged in as {me || 'Unknown'}</p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Logout
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('allowlist')}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            activeTab === 'allowlist'
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          Allowlist
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matches')}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            activeTab === 'matches'
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          Matches
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            activeTab === 'questions'
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          Questions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('live_ops')}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            activeTab === 'live_ops'
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          Live Ops
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {activeTab === 'allowlist' ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-900">Allowlist</h2>
          <p className="mt-1 text-sm text-zinc-600">Manage CMS phone access.</p>

          <form onSubmit={onAddPhone} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="text"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="Phone"
              required
            />
            <input
              type="text"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="Label (optional)"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              Add
            </button>
          </form>

          {loading ? (
            <p className="mt-4 text-sm text-zinc-600">Loading allowlist...</p>
          ) : phones.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No active phones in allowlist.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {phones.map((item) => (
                <div
                  key={item.phone}
                  className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{item.phone}</p>
                    <p className="text-xs text-zinc-600">{item.label || 'No label'}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void onRemovePhone(item.phone)}
                    disabled={saving}
                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : activeTab === 'matches' ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-900">Matches</h2>
          <p className="mt-1 text-sm text-zinc-600">Create and update matches manually.</p>

          <form
            onSubmit={onCreateMatch}
            className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          >
            <input
              type="number"
              min={1}
              value={newMatch.match_number}
              onChange={(event) =>
                setNewMatch((current) => ({ ...current, match_number: event.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="Match number"
              required
            />
            <input
              type="text"
              value={newMatch.team_a}
              onChange={(event) =>
                setNewMatch((current) => ({ ...current, team_a: event.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="Team A"
              required
            />
            <input
              type="text"
              value={newMatch.team_b}
              onChange={(event) =>
                setNewMatch((current) => ({ ...current, team_b: event.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="Team B"
              required
            />
            <input
              type="date"
              value={newMatch.match_date}
              onChange={(event) =>
                setNewMatch((current) => ({ ...current, match_date: event.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              required
            />
            <input
              type="text"
              value={newMatch.prize_name}
              onChange={(event) =>
                setNewMatch((current) => ({ ...current, prize_name: event.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="Prize name (optional)"
            />
            <input
              type="text"
              value={newMatch.prize_image_url}
              onChange={(event) =>
                setNewMatch((current) => ({ ...current, prize_image_url: event.target.value }))
              }
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              placeholder="Prize image URL (optional)"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 md:col-span-2 lg:col-span-3"
            >
              Create Match
            </button>
          </form>

          {loading ? (
            <p className="mt-4 text-sm text-zinc-600">Loading matches...</p>
          ) : matches.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No matches yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-zinc-600">
                    <th className="border-b border-zinc-200 px-2 py-2">#</th>
                    <th className="border-b border-zinc-200 px-2 py-2">Teams</th>
                    <th className="border-b border-zinc-200 px-2 py-2">Date</th>
                    <th className="border-b border-zinc-200 px-2 py-2">State</th>
                    <th className="border-b border-zinc-200 px-2 py-2">Prize</th>
                    <th className="border-b border-zinc-200 px-2 py-2">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((match) => (
                    <tr key={match.id} className="align-top">
                      <td className="border-b border-zinc-100 px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          value={match.match_number}
                          onChange={(event) =>
                            onMatchFieldChange(match.id, 'match_number', event.target.value)
                          }
                          className="w-20 rounded-md border border-zinc-300 px-2 py-1"
                        />
                      </td>
                      <td className="border-b border-zinc-100 px-2 py-2">
                        <div className="grid gap-2">
                          <input
                            type="text"
                            value={match.team_a}
                            onChange={(event) =>
                              onMatchFieldChange(match.id, 'team_a', event.target.value)
                            }
                            className="w-44 rounded-md border border-zinc-300 px-2 py-1"
                            placeholder="Team A"
                          />
                          <input
                            type="text"
                            value={match.team_b}
                            onChange={(event) =>
                              onMatchFieldChange(match.id, 'team_b', event.target.value)
                            }
                            className="w-44 rounded-md border border-zinc-300 px-2 py-1"
                            placeholder="Team B"
                          />
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 px-2 py-2">
                        <input
                          type="date"
                          value={match.match_date}
                          onChange={(event) =>
                            onMatchFieldChange(match.id, 'match_date', event.target.value)
                          }
                          className="w-36 rounded-md border border-zinc-300 px-2 py-1"
                        />
                      </td>
                      <td className="border-b border-zinc-100 px-2 py-2">
                        <select
                          value={match.match_state}
                          onChange={(event) =>
                            onMatchFieldChange(match.id, 'match_state', event.target.value)
                          }
                          className="w-44 rounded-md border border-zinc-300 px-2 py-1"
                        >
                          {MATCH_STATES.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border-b border-zinc-100 px-2 py-2">
                        <div className="grid gap-2">
                          <input
                            type="text"
                            value={match.prize_name}
                            onChange={(event) =>
                              onMatchFieldChange(match.id, 'prize_name', event.target.value)
                            }
                            className="w-56 rounded-md border border-zinc-300 px-2 py-1"
                            placeholder="Prize name"
                          />
                          <input
                            type="text"
                            value={match.prize_image_url}
                            onChange={(event) =>
                              onMatchFieldChange(match.id, 'prize_image_url', event.target.value)
                            }
                            className="w-56 rounded-md border border-zinc-300 px-2 py-1"
                            placeholder="Prize image URL"
                          />
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 px-2 py-2">
                        <button
                          type="button"
                          onClick={() => void onSaveMatch(match)}
                          disabled={savingMatchId === match.id}
                          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                        >
                          {savingMatchId === match.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : activeTab === 'questions' ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-900">Questions</h2>
          <p className="mt-1 text-sm text-zinc-600">Create and manage questions by match and phase.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select
              value={questionMatchId}
              onChange={(event) => setQuestionMatchId(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select match</option>
              {matchOptions.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.label}
                </option>
              ))}
            </select>

            <select
              value={questionCategory}
              onChange={(event) => setQuestionCategory(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm capitalize"
            >
              {QUESTION_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {questionCategoryLabel(category)}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void loadQuestions()}
              disabled={questionsLoading}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {questionsLoading ? 'Loading...' : 'Load questions'}
            </button>
          </div>

          <form onSubmit={onCreateQuestion} className="mt-5 rounded-lg border border-zinc-200 p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Create question</h3>
            <div className="mt-3 grid gap-3">
              <textarea
                value={newQuestionText}
                onChange={(event) => setNewQuestionText(event.target.value)}
                className="min-h-24 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Question text"
                required
              />

              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="number"
                  min={1}
                  value={newQuestionDisplayOrder}
                  onChange={(event) => setNewQuestionDisplayOrder(event.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Display order"
                  required
                />

                <select
                  value={newQuestionStatus}
                  onChange={(event) => setNewQuestionStatus(event.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  {CREATE_QUESTION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <select
                  value={newQuestionOptionCount}
                  onChange={(event) =>
                    onQuestionOptionCountChange(event.target.value as '2' | '4')
                  }
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="2">2 options</option>
                  <option value="4">4 options</option>
                </select>
              </div>

              <div className="grid gap-2">
                {newQuestionOptions.map((option, index) => (
                  <input
                    key={`new-option-${index}`}
                    type="text"
                    value={option}
                    onChange={(event) =>
                      setNewQuestionOptions((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item
                        )
                      )
                    }
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    placeholder={`Option ${index + 1}`}
                    required
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={saving || !questionMatchId}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              >
                Create Question
              </button>
            </div>
          </form>

          {questionsError ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {questionsError}
            </p>
          ) : null}

          <div className="mt-5 space-y-3">
            {questions.length === 0 ? (
              <p className="text-sm text-zinc-600">No questions loaded for selected match/phase.</p>
            ) : (
              questions.map((question) => (
                <article key={question.id} className="rounded-lg border border-zinc-200 p-4">
                  <p className="text-sm font-medium text-zinc-900">{question.question_text}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Status: {question.question_status} | Order: {question.display_order}
                  </p>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenQuestionEditor(question)}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void onTogglePublish(question)}
                      disabled={savingQuestionId === question.id}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {question.question_status === 'published' ? 'Set Draft' : 'Publish'}
                    </button>
                  </div>

                  {editingQuestion?.id === question.id ? (
                    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                      <div className="grid gap-3">
                        <textarea
                          value={editingQuestion.question_text}
                          onChange={(event) =>
                            onEditQuestionField('question_text', event.target.value)
                          }
                          className="min-h-20 rounded-md border border-zinc-300 px-3 py-2 text-sm"
                        />

                        <div className="grid gap-3 md:grid-cols-3">
                          <input
                            type="number"
                            min={1}
                            value={editingQuestion.display_order}
                            onChange={(event) =>
                              onEditQuestionField('display_order', event.target.value)
                            }
                            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          />

                          <select
                            value={editingQuestion.question_status}
                            onChange={(event) =>
                              onEditQuestionField('question_status', event.target.value)
                            }
                            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          >
                            {QUESTION_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>

                          <select
                            value={editingQuestion.question_category}
                            onChange={(event) =>
                              onEditQuestionField('question_category', event.target.value)
                            }
                            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          >
                            {QUESTION_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {questionCategoryLabel(category)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-2">
                          {editingQuestion.options.map((option, index) => (
                            <input
                              key={option.id || `editing-option-${index}`}
                              type="text"
                              value={option.option_text}
                              onChange={(event) =>
                                onEditOptionField(index, event.target.value)
                              }
                              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                              placeholder={`Option ${index + 1}`}
                            />
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={onAddEditOption}
                            disabled={editingQuestion.options.length >= 4}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                          >
                            Add option
                          </button>

                          <button
                            type="button"
                            onClick={() => void onSaveEditedQuestion()}
                            disabled={savingQuestionId === question.id}
                            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                          >
                            {savingQuestionId === question.id ? 'Saving...' : 'Save changes'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingQuestion(null)}
                            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-zinc-900">Live Ops</h2>
          <p className="mt-1 text-sm text-zinc-600">Set correct options for published questions.</p>

          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <select
              value={opsMatchId}
              onChange={(event) => setOpsMatchId(event.target.value)}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select match</option>
              {matchOptions.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void loadOpsData()}
              disabled={opsLoading}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            >
              {opsLoading ? 'Loading...' : 'Load live ops'}
            </button>
          </div>

          {opsMatch ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
              <p className="text-sm text-zinc-700">
                Match state: <span className="font-medium">{opsMatch.match_state}</span>
              </p>
              <a
                href={`/ipl/play?match_id=${opsMatch.id}`}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-white"
              >
                Open public game
              </a>
            </div>
          ) : null}

          {opsError ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {opsError}
            </p>
          ) : null}

          {opsLoading ? (
            <p className="mt-4 text-sm text-zinc-600">Loading live ops data...</p>
          ) : groupedOpsQuestions.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">No questions available for this match.</p>
          ) : (
            <div className="mt-5 space-y-5">
              {groupedOpsQuestions.map(([category, categoryQuestions]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-zinc-800">
                    {questionCategoryLabel(category)}
                  </h3>

                  <div className="mt-2 space-y-3">
                    {categoryQuestions.map((question) => {
                      const questionOptions = opsOptionsByQuestionId.get(question.id) ?? []
                      const selectedOptionId =
                        settleSelections[question.id] ?? question.correct_option_id ?? ''
                      const currentCorrectOption = question.correct_option_id
                        ? questionOptions.find((option) => option.id === question.correct_option_id)
                        : null
                      const isSettled = Boolean(question.is_settled && question.correct_option_id)
                      const feedback = settleFeedbackByQuestion[question.id]

                      return (
                        <article key={question.id} className="rounded-md border border-zinc-200 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-zinc-900">{question.question_text}</p>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                              {question.question_status}
                            </span>
                            {isSettled ? (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                Settled
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-xs text-zinc-600">
                            Display order: {question.display_order}
                          </p>
                          <p className="mt-1 text-xs text-zinc-600">
                            Current correct: {currentCorrectOption?.option_text ?? 'Not set'}
                          </p>

                          <div className="mt-3 space-y-2">
                            {questionOptions.map((option) => (
                              <label
                                key={option.id}
                                className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-800"
                              >
                                <input
                                  type="radio"
                                  name={`settle-${question.id}`}
                                  checked={selectedOptionId === option.id}
                                  onChange={() =>
                                    setSettleSelections((current) => ({
                                      ...current,
                                      [question.id]: option.id,
                                    }))
                                  }
                                />
                                <span>{option.option_text}</span>
                              </label>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => void onSettleQuestion(question.id)}
                              disabled={!selectedOptionId || settlingQuestionId === question.id}
                              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                            >
                              {settlingQuestionId === question.id
                                ? 'Saving...'
                                : 'Set correct option'}
                            </button>

                            {feedback?.message ? (
                              <p
                                className={`text-xs ${
                                  feedback.type === 'success'
                                    ? 'text-emerald-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {feedback.message}
                              </p>
                            ) : null}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  )
}
