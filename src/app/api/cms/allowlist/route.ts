import { NextRequest, NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabaseServer'
import { isPhoneFormatValid, normalizePhone, requireCmsSession } from '@/lib/cmsSession'

type AllowlistBody = {
  phone?: unknown
  label?: unknown
}

export async function GET(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseServer
    .from('cms_allowed_phones')
    .select('phone, label, is_active, created_at')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch allowlist' }, { status: 500 })
  }

  return NextResponse.json({ phones: data ?? [] }, { status: 200 })
}

export async function POST(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: AllowlistBody

  try {
    body = (await request.json()) as AllowlistBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : ''
  const label = typeof body.label === 'string' ? body.label.trim() : null

  if (!phone || !isPhoneFormatValid(phone)) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
  }

  const { error } = await supabaseServer.from('cms_allowed_phones').upsert(
    {
      phone,
      label: label || null,
      is_active: true,
    },
    { onConflict: 'phone' }
  )

  if (error) {
    return NextResponse.json({ error: 'Failed to save phone' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}

export async function DELETE(request: NextRequest) {
  if (!requireCmsSession(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const phoneParam = request.nextUrl.searchParams.get('phone')
  const phone = phoneParam ? normalizePhone(phoneParam) : ''

  if (!phone || !isPhoneFormatValid(phone)) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('cms_allowed_phones')
    .update({ is_active: false })
    .eq('phone', phone)
    .select('phone')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to remove phone' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Phone not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true }, { status: 200 })
}
