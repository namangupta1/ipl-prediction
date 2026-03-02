'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CmsLoginPage() {
  const router = useRouter()

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkSession = async () => {
      const response = await fetch('/api/cms/me', { cache: 'no-store' })
      if (response.ok) {
        router.replace('/cms/dashboard')
      }
    }

    void checkSession()
  }, [router])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/cms/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, otp }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.error ?? 'Login failed')
        return
      }

      router.push('/cms/dashboard')
      router.refresh()
    } catch {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="broadcast-shell cms-app mx-auto flex min-h-screen w-full max-w-lg items-center px-4 py-8">
      <div className="broadcast-content card-primary motion-rise w-full p-7">
        <p className="font-display text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Control Room</p>
        <h1 className="font-display mt-2 text-4xl leading-none text-[var(--color-brand)]">CMS Login</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Use your allowlisted phone and OTP to enter live operations.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-semibold text-[var(--color-text-strong)]">
              Phone
            </label>
            <input
              id="phone"
              type="text"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="input-control w-full text-sm"
              placeholder="+91XXXXXXXXXX"
              required
            />
          </div>

          <div>
            <label htmlFor="otp" className="mb-1 block text-sm font-semibold text-[var(--color-text-strong)]">
              OTP
            </label>
            <input
              id="otp"
              type="password"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              className="input-control w-full text-sm"
              placeholder="0000"
              required
            />
          </div>

          {error ? <p className="badge-error inline-flex">{error}</p> : null}

          <button type="submit" disabled={loading} className="btn-primary w-full px-3 py-2 text-sm">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
