import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export const CMS_COOKIE_NAME = 'cms_session'

const DEFAULT_OTP_CODE = '0000'
const DEFAULT_SESSION_SECRET = 'dev-secret-change-me'
const PHONE_REGEX = /^[+0-9][0-9\s-]{5,19}$/

function getSessionSecret() {
  return process.env.CMS_SESSION_SECRET || DEFAULT_SESSION_SECRET
}

function signPayload(payload: string) {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
}

function safeEquals(a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)

  if (aBuffer.length !== bBuffer.length) {
    return false
  }

  return timingSafeEqual(aBuffer, bBuffer)
}

export function normalizePhone(phone: string) {
  return phone.trim()
}

export function isPhoneFormatValid(phone: string) {
  return PHONE_REGEX.test(phone)
}

export function getExpectedOtpCode() {
  return process.env.CMS_OTP_CODE || DEFAULT_OTP_CODE
}

export function createCmsSession(phone: string) {
  const payload = Buffer.from(JSON.stringify({ phone }), 'utf8').toString('base64url')
  const signature = signPayload(payload)
  return `${payload}.${signature}`
}

export function verifyCmsSession(sessionValue: string) {
  const [payload, signature] = sessionValue.split('.')

  if (!payload || !signature) {
    return null
  }

  const expectedSignature = signPayload(payload)
  if (!safeEquals(expectedSignature, signature)) {
    return null
  }

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8')
    const parsed = JSON.parse(decoded) as { phone?: unknown }

    if (typeof parsed.phone !== 'string') {
      return null
    }

    const phone = normalizePhone(parsed.phone)
    if (!isPhoneFormatValid(phone)) {
      return null
    }

    return phone
  } catch {
    return null
  }
}

export function getCmsPhoneFromRequest(request: NextRequest) {
  const cookieValue = request.cookies.get(CMS_COOKIE_NAME)?.value
  if (!cookieValue) {
    return null
  }

  return verifyCmsSession(cookieValue)
}

export function requireCmsSession(request: NextRequest) {
  return getCmsPhoneFromRequest(request)
}
