import { NextResponse } from 'next/server'

import { CMS_COOKIE_NAME } from '@/lib/cmsSession'

export async function POST() {
  const response = NextResponse.json({ success: true }, { status: 200 })

  response.cookies.set({
    name: CMS_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(0),
  })

  return response
}
