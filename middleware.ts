import { NextRequest, NextResponse } from 'next/server'

import { CMS_COOKIE_NAME } from '@/lib/cmsSession'

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/cms', request.url)
  return NextResponse.redirect(loginUrl)
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/cms') {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get(CMS_COOKIE_NAME)?.value
  if (!sessionCookie) {
    return redirectToLogin(request)
  }

  try {
    const meUrl = new URL('/api/cms/me', request.url)
    const meResponse = await fetch(meUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
      },
      cache: 'no-store',
    })

    if (meResponse.ok) {
      return NextResponse.next()
    }
  } catch {
    return redirectToLogin(request)
  }

  return redirectToLogin(request)
}

export const config = {
  matcher: ['/cms/:path*'],
}
