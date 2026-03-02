import { NextRequest, NextResponse } from 'next/server'

import { getCmsPhoneFromRequest } from '@/lib/cmsSession'

export async function GET(request: NextRequest) {
  const phone = getCmsPhoneFromRequest(request)

  if (!phone) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ phone }, { status: 200 })
}
