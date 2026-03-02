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
  scoring?: {
    total_settled: number
    total_correct: number
    total_answered: number
    score: number
  }
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
  const phaseDiff = getPhaseOrder(a.question_category) - getPhaseOrder(b.question_category)
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

function formatStateLabel(state?: string | null) {
  if (!state) return 'Unknown'
  return state.replaceAll('_', ' ')
}

function prettyCategory(category: string) {
  return category
    .replaceAll('_', ' ')
    .replaceAll('innings 1', 'Innings 1')
    .replaceAll('innings 2', 'Innings 2')
}

function getQuestionBadge(question: QuestionItem) {
  if (question.is_settled) {
    return { label: 'Settled', className: 'badge-settled' }
  }

  if (question.is_locked) {
    return { label: 'Locked', className: 'badge-locked' }
  }

  return { label: 'Live', className: 'badge-live' }
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

  const [questions, setQuestions] = useState<QuestionItem[]>([])
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
    () => questions.filter((question) => Boolean(selectedByQuestion[question.id])).length,
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
        const answersPayload = (await answersRes.json()) as AnswersPayload

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
        for (const answer of answersPayload.answers ?? []) {
          initialSelected[answer.question_id] = answer.option_id
        }

        setSelectedByQuestion(initialSelected)
        setSaveStateByQuestion({})

        const firstUnansweredIndex = fetchedQuestions.findIndex(
          (question) => !initialSelected[question.id]
        )

        if (firstUnansweredIndex === -1) {
          setCurrentQuestionIndex(Math.max(fetchedQuestions.length - 1, 0))
        } else {
          setCurrentQuestionIndex(firstUnansweredIndex)
        }

        setIsReviewingAfterCompletion(false)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load play screen'
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
    if (question.is_locked || question.is_settled) return

    const questionId = question.id
    const previousOptionId = selectedByQuestion[questionId]

    setSelectedByQuestion((current) => ({ ...current, [questionId]: optionId }))
    setSaveStateByQuestion((current) => ({ ...current, [questionId]: 'saving' }))

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

      setSaveStateByQuestion((current) => ({ ...current, [questionId]: 'saved' }))

      const nextIndex = currentQuestionIndex + 1
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex)
      }
    } catch {
      setSelectedByQuestion((current) => {
        const next = { ...current }
        if (previousOptionId) {
          next[questionId] = previousOptionId
        } else {
          delete next[questionId]
        }
        return next
      })

      setSaveStateByQuestion((current) => ({ ...current, [questionId]: 'error' }))
    }
  }

  const onEditQuestion = (questionId: string) => {
    const index = questions.findIndex((question) => question.id === questionId)
    if (index === -1) return

    setCurrentQuestionIndex(index)
    if (allAnswered) {
      setIsReviewingAfterCompletion(true)
    }
  }

  if (!matchId) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
        <div className="card-primary p-4 text-sm text-[var(--color-danger)]">
          Match not selected. Please go back and choose a match to play.
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
        <p className="text-sm text-[var(--color-text-muted)]">Loading match...</p>
      </main>
    )
  }

  if (matchError || !match) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
        <div className="card-primary p-4 text-sm text-[var(--color-danger)]">
          {matchError || 'Failed to load match details.'}
        </div>
      </main>
    )
  }

  const currentBadge = currentQuestion ? getQuestionBadge(currentQuestion) : null

  return (
    <main className="broadcast-shell mx-auto min-h-screen w-full max-w-5xl px-4 py-8">
      <div className="broadcast-content">
        <header className="card-status motion-rise mb-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.2em] text-white/70">Matchday Feed</p>
              <h1 className="font-display mt-2 text-4xl leading-none text-white">{headerTitle}</h1>
            </div>
            <span className="badge-phase border-white/35 bg-white/12 text-white">
              {formatStateLabel(match.match_state)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="text-sm text-white/80">{formatDate(match.match_date)}</p>
            <p className="text-right text-sm text-white/80">Match #{match.match_number ?? '-'}</p>
          </div>

          <div className="mt-4 rounded-xl border border-white/20 bg-white/8 p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Prize</p>
            <p className="mt-1 text-sm font-semibold text-white">{match.prize_name ?? 'To be announced'}</p>
          </div>
        </header>

        <section className="progress-rail motion-rise mb-5 p-3" style={{ animationDelay: '70ms' }}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            <span>
              Question {questions.length === 0 ? 0 : currentQuestionIndex + 1} of {questions.length}
            </span>
            <span>
              {answeredCount} answered / {questions.length}
            </span>
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-3 md:gap-4">
          <article className="card-primary motion-rise p-4" style={{ animationDelay: '110ms' }}>
            <h2 className="font-display text-sm uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Your score</h2>
            <p className="font-display mt-2 text-4xl leading-none text-[var(--color-brand)]">{scoreData?.score ?? 0}</p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Settled: {scoreData?.total_settled ?? 0} | Correct: {scoreData?.total_correct ?? 0}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Answered in settled: {scoreData?.total_answered ?? 0}</p>
          </article>

          <article className="card-muted motion-rise p-4" style={{ animationDelay: '160ms' }}>
            <h2 className="font-display text-sm uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Leaderboard</h2>
            <p className="mt-2 text-sm text-[var(--color-text-strong)]">Leaderboard goes live as more users join this match.</p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">Your latest settled points are reflected in score.</p>
          </article>
        </section>

        {loadError ? (
          <p className="badge-error mb-4 inline-flex">{loadError}</p>
        ) : null}

        {questions.length === 0 ? (
          <div className="card-primary p-6 text-sm text-[var(--color-text-muted)]">
            No questions live right now. Come back for the next phase.
          </div>
        ) : showCompletionPanel ? (
          <section className="card-primary motion-rise p-5" style={{ animationDelay: '200ms' }}>
            <p className="font-display text-2xl text-[var(--color-success)]">You&apos;re done for this phase</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Come back when the next phase starts.</p>
            <button
              type="button"
              onClick={() => void loadData(userKey)}
              className="btn-primary mt-4 px-4 py-2 text-sm"
            >
              Refresh Feed
            </button>
          </section>
        ) : currentQuestion ? (
          <section className="card-primary motion-rise p-5" style={{ animationDelay: '210ms' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-sm uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Question {currentQuestionIndex + 1}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{prettyCategory(currentQuestion.question_category)}</p>
              </div>
              {currentBadge ? <span className={currentBadge.className}>{currentBadge.label}</span> : null}
            </div>

            <p className="mt-4 text-base font-semibold text-[var(--color-text-strong)]">{currentQuestion.question_text}</p>

            {isCurrentLocked ? (
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                {currentQuestion.is_settled
                  ? 'This question is settled. Correct answer is shown below.'
                  : 'This question has been locked by the editor.'}
              </p>
            ) : null}

            <div className="mt-4 grid gap-2">
              {currentQuestion.options.map((option) => {
                const isSelected = currentSelectedOptionId === option.id
                const isDisabled = isCurrentSaving || isCurrentLocked

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => void onOptionClick(currentQuestion, option.id)}
                    disabled={isDisabled}
                    className={`option-button ${isSelected ? 'option-button-selected' : ''} ${
                      isDisabled ? 'option-button-locked' : ''
                    }`}
                  >
                    {option.option_text}
                  </button>
                )
              })}
            </div>

            {currentSaveState === 'saving' ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">Saving...</p> : null}
            {currentSaveState === 'saved' ? <p className="mt-2 text-xs text-[var(--color-success)]">Saved.</p> : null}
            {currentSaveState === 'error' ? (
              <p className="mt-2 text-xs text-[var(--color-danger)]">Failed to save. Tap again.</p>
            ) : null}

            {currentQuestion.is_settled ? (
              <div className="card-muted mt-4 p-3 text-sm">
                <p className="font-semibold text-[var(--color-success)]">Correct: {currentQuestion.correct_option_text ?? '—'}</p>
                {currentSelectedOptionId ? (
                  <p className="mt-1 text-[var(--color-text-muted)]">
                    {currentSelectedOptionId === currentQuestion.correct_option_id
                      ? 'You were right.'
                      : 'You missed this one.'}
                  </p>
                ) : (
                  <p className="mt-1 text-[var(--color-text-muted)]">You did not answer this question.</p>
                )}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((index) => Math.max(index - 1, 0))}
                disabled={currentQuestionIndex === 0}
                className="btn-secondary px-3 py-2 text-sm"
              >
                Prev
              </button>

              <button
                type="button"
                onClick={() => setCurrentQuestionIndex((index) => Math.min(index + 1, questions.length - 1))}
                disabled={currentQuestionIndex >= questions.length - 1 || !currentSelectedOptionId || isCurrentSaving}
                className="btn-primary px-3 py-2 text-sm"
              >
                Next
              </button>
            </div>
          </section>
        ) : null}

        {sortedAllQuestions.length > 0 ? (
          <section className="card-primary motion-rise mt-6 p-5" style={{ animationDelay: '240ms' }}>
            <button
              type="button"
              onClick={() => setIsAnswersExpanded((current) => !current)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="font-display text-lg text-[var(--color-text-strong)]">View / Modify Answers</h2>
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {isAnswersExpanded ? 'Collapse' : 'Expand'}
              </span>
            </button>

            {isAnswersExpanded ? (
              <div className="mt-4 space-y-3">
                {sortedAllQuestions.map((question, index) => {
                  const selectedOptionId = selectedByQuestion[question.id]
                  const selectedOptionText = question.options.find((option) => option.id === selectedOptionId)?.option_text
                  const isLocked = question.is_locked || question.is_settled
                  const badge = getQuestionBadge(question)

                  return (
                    <div
                      key={question.id}
                      className="card-muted motion-rise flex items-start justify-between gap-4 p-3"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={badge.className}>{badge.label}</span>
                          <span className="badge-phase">{prettyCategory(question.question_category)}</span>
                        </div>

                        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{question.question_text}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Your answer: {selectedOptionText ?? 'Not answered'}
                        </p>

                        {question.is_settled ? (
                          <p className="text-xs text-[var(--color-success)]">Correct: {question.correct_option_text ?? '—'}</p>
                        ) : (
                          <p className="text-xs text-[var(--color-text-muted)]">Result pending</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onEditQuestion(question.id)}
                        disabled={isLocked}
                        className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                      >
                        Edit
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">Tap to review all answers and statuses.</p>
            )}
          </section>
        ) : null}

        <section className="card-muted motion-rise mt-6 p-5" style={{ animationDelay: '260ms' }}>
          <h2 className="font-display text-lg text-[var(--color-text-strong)]">Rules</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
            <li>Answer questions shown for the current phase.</li>
            <li>You can change an answer until the editor locks that question in CMS.</li>
            <li>Once a question is settled, the correct answer is revealed immediately.</li>
            <li>Score updates on settled questions only.</li>
            <li>If no questions are live, wait for the next phase to begin.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
