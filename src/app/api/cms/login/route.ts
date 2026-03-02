import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'
import {
  CMS_COOKIE_NAME,
  createCmsSession,
  getExpectedOtpCode,
  isPhoneFormatValid,
  normalizePhone,
} from '@/lib/cmsSession'

type LoginBody = {
  phone?: unknown
  otp?: unknown
}

export async function POST(request: NextRequest) {
  let body: LoginBody

  try {
    body = (await request.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : ''
  const otp = typeof body.otp === 'string' ? body.otp.trim() : ''

  if (!phone || !otp || !isPhoneFormatValid(phone)) {
    return NextResponse.json({ error: 'Invalid phone or otp' }, { status: 401 })
  }

  if (otp !== getExpectedOtpCode()) {
    return NextResponse.json({ error: 'Invalid phone or otp' }, { status: 401 })
  }

  const { data, error } = await supabaseServer
    .from('cms_allowed_phones')
    .select('phone')
    .eq('phone', phone)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to validate phone' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Invalid phone or otp' }, { status: 401 })
  }

  const sessionValue = createCmsSession(phone)
  const response = NextResponse.json({ success: true, phone }, { status: 200 })

  response.cookies.set({
    name: CMS_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  })

  return response
}
