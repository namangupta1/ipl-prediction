'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getUserKey } from '@/lib/userKey'

type MatchData = {
  id: string
  match_number?: number
  team_a?: string
  team_b?: string
  match_date?: string
  match_state?: string
  prize_name?: string | null
  prize_image_url?: string | null
}


type OptionItem = {
  id: string
  question_id: string
  option_text: string
  display_order: number
}

type QuestionItem = {
  id: string
  question_text: string
  question_category: string
  display_order: number
  is_locked: boolean
  is_settled: boolean
  correct_option_id: string | null
  correct_option_text: string | null
  options: OptionItem[]
}

type AnswersPayload = {
  answers?: Array<{
    question_id: string
    option_id: string
    updated_at?: string
  }>
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const PHASE_ORDER: Record<string, number> = {
  pre_match: 1,
  innings_1_phase_1: 2,
  innings_1_phase_2: 3,
  innings_1_phase_3: 4,
  innings_2_phase_1: 5,
  innings_2_phase_2: 6,
  innings_2_phase_3: 7,
}

function getPhaseOrder(category: string) {
  return PHASE_ORDER[category] ?? 999
}

function sortQuestionsByPhaseAndIndex(a: QuestionItem, b: QuestionItem) {
  const phaseDiff =
    getPhaseOrder(a.question_category) - getPhaseOrder(b.question_category)
  if (phaseDiff !== 0) return phaseDiff

  const indexDiff = a.display_order - b.display_order
  if (indexDiff !== 0) return indexDiff

  return a.question_text.localeCompare(b.question_text)
}

function formatDate(dateValue?: string | null) {
  if (!dateValue) return 'Date TBA'
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return String(dateValue)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function prettyCategory(category: string) {
  return category.replaceAll('_', ' ').replaceAll('innings 1', 'Innings 1').replaceAll('innings 2', 'Innings 2')
}

export default function PlayPage() {
  const searchParams = useSearchParams()
  const matchId = searchParams.get('match_id')?.trim() ?? ''

  const [userKey, setUserKey] = useState('')
  const [match, setMatch] = useState<MatchData | null>(null)

const [scoreData, setScoreData] = useState<{
  total_settled: number
  total_correct: number
  total_answered: number
  score: number
} | null>(null)

  // current phase questions
  const [questions, setQuestions] = useState<QuestionItem[]>([])
  // all questions (for View/Modify answers)
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>([])

  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string>>({})
  const [saveStateByQuestion, setSaveStateByQuestion] = useState<Record<string, SaveState>>({})

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isReviewingAfterCompletion, setIsReviewingAfterCompletion] = useState(false)
  const [isAnswersExpanded, setIsAnswersExpanded] = useState(false)

  const [loading, setLoading] = useState(true)
  const [matchError, setMatchError] = useState('')
  const [loadError, setLoadError] = useState('')

  const headerTitle = useMemo(() => {
    if (!match) return 'IPL Match'
    return `${match.team_a ?? 'Team A'} vs ${match.team_b ?? 'Team B'}`
  }, [match])

  const sortedAllQuestions = useMemo(
    () => [...allQuestions].sort(sortQuestionsByPhaseAndIndex),
    [allQuestions]
  )

  const answeredCount = useMemo(
    () => questions.filter((q) => Boolean(selectedByQuestion[q.id])).length,
    [questions, selectedByQuestion]
  )

  const allAnswered = questions.length > 0 && answeredCount === questions.length
  const showCompletionPanel = allAnswered && !isReviewingAfterCompletion

  const currentQuestion = questions[currentQuestionIndex] ?? null
  const currentSaveState = currentQuestion
    ? (saveStateByQuestion[currentQuestion.id] ?? 'idle')
    : 'idle'
  const currentSelectedOptionId = currentQuestion
    ? selectedByQuestion[currentQuestion.id]
    : undefined

  const isCurrentSaving = currentSaveState === 'saving'
  const isCurrentLocked = Boolean(currentQuestion?.is_locked || currentQuestion?.is_settled)

  const loadData = useCallback(
    async (activeUserKey: string) => {
      if (!matchId) return

      setLoading(true)
      setMatchError('')
      setLoadError('')

      try {
        const [matchRes, questionsRes, allQuestionsRes, answersRes] = await Promise.all([
          fetch(`/api/match?match_id=${encodeURIComponent(matchId)}`, { cache: 'no-store' }),
          fetch(`/api/questions?match_id=${encodeURIComponent(matchId)}`, { cache: 'no-store' }),
          fetch(`/api/questions?match_id=${encodeURIComponent(matchId)}&mode=all`, { cache: 'no-store' }),
          fetch(
            `/api/my-answers?match_id=${encodeURIComponent(matchId)}&user_key=${encodeURIComponent(activeUserKey)}`,
            { cache: 'no-store' }
          ),
        ])

        if (!matchRes.ok) {
          const payload = await matchRes.json().catch(() => null)
          setMatchError(payload?.error ?? 'Failed to load match details.')
          return
        }

        const matchPayload = await matchRes.json()
        setMatch((matchPayload.data ?? matchPayload.match) as MatchData)

        if (!questionsRes.ok) {
          const payload = await questionsRes.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load questions')
        }
        if (!allQuestionsRes.ok) {
          const payload = await allQuestionsRes.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load all questions')
        }
        if (!answersRes.ok) {
          const payload = await answersRes.json().catch(() => null)
          throw new Error(payload?.error ?? 'Failed to load your answers')
        }

        const questionsPayload = await questionsRes.json()
        const allQuestionsPayload = await allQuestionsRes.json()
        const answersPayload = await answersRes.json()

setScoreData(answersPayload.scoring ?? null)

        const fetchedQuestions = Array.isArray(questionsPayload.questions)
          ? (questionsPayload.questions as QuestionItem[])
          : []
        fetchedQuestions.sort(sortQuestionsByPhaseAndIndex)
        setQuestions(fetchedQuestions)

        const fetchedAllQuestions = Array.isArray(allQuestionsPayload.questions)
          ? (allQuestionsPayload.questions as QuestionItem[])
          : []
        fetchedAllQuestions.sort(sortQuestionsByPhaseAndIndex)
        setAllQuestions(fetchedAllQuestions)

        const initialSelected: Record<string, string> = {}
        for (const a of answersPayload.answers ?? []) {
          initialSelected[a.question_id] = a.option_id
        }
        setSelectedByQuestion(initialSelected)
        setSaveStateByQuestion({})

        const firstUnansweredIndex = fetchedQuestions.findIndex((q) => !initialSelected[q.id])
        if (firstUnansweredIndex === -1) {
          setCurrentQuestionIndex(Math.max(fetchedQuestions.length - 1, 0))
        } else {
          setCurrentQuestionIndex(firstUnansweredIndex)
        }

        setIsReviewingAfterCompletion(false)
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load play screen'
        setLoadError(message)
      } finally {
        setLoading(false)
      }
    },
    [matchId]
  )

  useEffect(() => {
    if (!matchId) {
      setLoading(false)
      return
    }

    const key = getUserKey()
    if (!key) {
      setLoading(false)
      setLoadError('Unable to initialize user key.')
      return
    }

    setUserKey(key)
    void loadData(key)
  }, [loadData, matchId])

  useEffect(() => {
    if (questions.length === 0) {
      setCurrentQuestionIndex(0)
      return
    }
    if (currentQuestionIndex > questions.length - 1) {
      setCurrentQuestionIndex(questions.length - 1)
    }
  }, [currentQuestionIndex, questions])

  const onOptionClick = async (question: QuestionItem, optionId: string) => {
    if (!matchId || !userKey || isCurrentSaving) return

    // lock from CMS
    if (question.is_locked || question.is_settled) return

    const questionId = question.id
    const previousOptionId = selectedByQuestion[questionId]

    setSelectedByQuestion((c) => ({ ...c, [questionId]: optionId }))
    setSaveStateByQuestion((c) => ({ ...c, [questionId]: 'saving' }))

    try {
      const response = await fetch('/api/answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_key: userKey,
          match_id: matchId,
          question_id: questionId,
          option_id: optionId,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Failed to save answer')
      }

      setSaveStateByQuestion((c) => ({ ...c, [questionId]: 'saved' }))

      // auto-advance
      const nextIndex = currentQuestionIndex + 1
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex)
      }
    } catch {
      setSelectedByQuestion((c) => {
        const next = { ...c }
        if (previousOptionId) next[questionId] = previousOptionId
        else delete next[questionId]
        return next
      })
      setSaveStateByQuestion((c) => ({ ...c, [questionId]: 'error' }))
    }
  }

  const onEditQuestion = (questionId: string) => {
    const index = questions.findIndex((q) => q.id === questionId)
    if (index === -1) return

    setCurrentQuestionIndex(index)
    if (allAnswered) setIsReviewingAfterCompletion(true)
  }

  if (!matchId) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Match not selected. Please go back and choose a match to play.
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
        <p className="text-sm text-zinc-600">Loading match...</p>
      </main>
    )
  }

  if (matchError || !match) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {matchError || 'Failed to load match details.'}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
      {/* Header */}
      <header className="mb-6 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-zinc-900">{headerTitle}</h1>
          <p className="text-sm text-zinc-600">{formatDate(match.match_date)}</p>
          {match.match_state ? (
            <p className="text-xs text-zinc-500">Match state: {match.match_state}</p>
          ) : null}
        </div>

        <div className="mt-3 rounded-lg bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Prize</p>
          <p className="mt-1 text-sm font-medium text-zinc-800">
            {match.prize_name ?? 'To be announced'}
          </p>
          {match.prize_image_url ? (
            <img
              src={match.prize_image_url}
              alt={match.prize_name ?? 'Prize image'}
              className="mt-3 h-28 w-full rounded-md border border-zinc-200 object-cover"
            />
          ) : (
            <p className="mt-2 text-xs text-zinc-500">No prize image</p>
          )}
        </div>
      </header>

      {/* Score + Leaderboard placeholders */}
      <section className="mb-6 grid grid-cols-2 gap-3 md:gap-4">
        <article className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-500">Your score</h2>
          <p className="mt-2 text-2xl font-semibold text-zinc-900">
  {scoreData?.score ?? 0} points
</p>
<p className="mt-1 text-sm text-zinc-600">
  {scoreData
    ? `${scoreData.total_correct} / ${scoreData.total_settled} correct`
    : 'Updated after settlement'}
</p>
        </article>

        <article className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-500">Leaderboard</h2>
          <p className="mt-2 text-sm text-zinc-700">
            Leaderboard will appear after more entries.
          </p>
        </article>
      </section>

      {loadError ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      {/* Main Question Panel */}
      {questions.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          No questions live right now. Come back for the next phase.
        </div>
      ) : showCompletionPanel ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-base font-semibold text-emerald-800">✅ You&apos;re done for this phase</p>
          <p className="mt-1 text-sm text-emerald-700">
            Come back when the next phase starts.
          </p>
          <button
            type="button"
            onClick={() => void loadData(userKey)}
            className="mt-4 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Refresh
          </button>
        </section>
      ) : currentQuestion ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {prettyCategory(currentQuestion.question_category)}
              </p>
            </div>

            {(currentQuestion.is_locked || currentQuestion.is_settled) ? (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700">
                🔒 Locked
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                Live
              </span>
            )}
          </div>

          <p className="mt-3 text-base font-medium text-zinc-900">
            {currentQuestion.question_text}
          </p>

          <div className="mt-4 grid gap-2">
            {currentQuestion.options.map((option) => {
              const isSelected = currentSelectedOptionId === option.id
              const disabled = isCurrentSaving || isCurrentLocked
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void onOptionClick(currentQuestion, option.id)}
                  disabled={disabled}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                  } ${disabled ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {option.option_text}
                </button>
              )
            })}
          </div>

          {/* Save status */}
          {currentSaveState === 'saving' ? (
            <p className="mt-2 text-xs text-zinc-500">Saving...</p>
          ) : null}
          {currentSaveState === 'saved' ? (
            <p className="mt-2 text-xs text-emerald-600">Saved ✅</p>
          ) : null}
          {currentSaveState === 'error' ? (
            <p className="mt-2 text-xs text-red-600">Failed to save. Tap again.</p>
          ) : null}

          {/* Settled reveal */}
          {currentQuestion.is_settled ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">
                ✅ Correct: {currentQuestion.correct_option_text ?? '—'}
              </p>
              {currentSelectedOptionId ? (
                <p className="mt-1">
                  {currentSelectedOptionId === currentQuestion.correct_option_id
                    ? 'You were right ✅'
                    : 'You missed ❌'}
                </p>
              ) : (
                <p className="mt-1 text-emerald-700">You did not answer this question.</p>
              )}
            </div>
          ) : null}

          {/* Navigation */}
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentQuestionIndex((i) => Math.max(i - 1, 0))}
              disabled={currentQuestionIndex === 0}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>

            <button
              type="button"
              onClick={() => setCurrentQuestionIndex((i) => Math.min(i + 1, questions.length - 1))}
              disabled={
                currentQuestionIndex >= questions.length - 1 ||
                !currentSelectedOptionId ||
                isCurrentSaving
              }
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>
      ) : null}

      {/* View/Modify Answers */}
      {sortedAllQuestions.length > 0 ? (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <button
            type="button"
            onClick={() => setIsAnswersExpanded((c) => !c)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-sm font-medium text-zinc-700">View/Modify Answers</h2>
            <span className="text-xs font-medium text-zinc-600">
              {isAnswersExpanded ? 'Collapse' : 'Expand'}
            </span>
          </button>

          {isAnswersExpanded ? (
            <div className="mt-3 space-y-3">
              {sortedAllQuestions.map((q) => {
                const selectedOptionId = selectedByQuestion[q.id]
                const selectedOptionText =
                  q.options.find((o) => o.id === selectedOptionId)?.option_text

                const isLocked = q.is_locked || q.is_settled

                return (
                  <div
                    key={q.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-zinc-900">{q.question_text}</p>
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                          {prettyCategory(q.question_category)}
                        </span>

                        {q.is_settled ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                            Settled
                          </span>
                        ) : q.is_locked ? (
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                            Locked
                          </span>
                        ) : (
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            Live
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-zinc-600">
                        Your answer: {selectedOptionText ?? 'Not answered'}
                      </p>

                      {q.is_settled ? (
                        <p className="mt-1 text-xs text-emerald-700">
                          ✅ Correct: {q.correct_option_text ?? '—'}{' '}
                          {selectedOptionId
                            ? selectedOptionId === q.correct_option_id
                              ? '(you were right)'
                              : '(you were wrong)'
                            : '(not answered)'}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-zinc-500">Result pending</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onEditQuestion(q.id)}
                      disabled={isLocked}
                      className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">Tap to view or modify your answers.</p>
          )}
        </section>
      ) : null}

      {/* Rules */}
      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-medium text-zinc-700">Rules</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Answer questions shown for the current phase.</li>
          <li>You can change an answer until the editor locks that question in CMS.</li>
          <li>Once a question is settled, the correct answer will be shown here.</li>
          <li>Score and leaderboard will be updated after settlement (Phase 1 placeholder).</li>
          <li>If no questions are live, wait for the next phase to begin.</li>
        </ul>
      </section>
    </main>
  )
}