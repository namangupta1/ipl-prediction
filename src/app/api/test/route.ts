import { supabaseServer } from '@/lib/supabaseServer'

export async function GET() {
  const { data, error } = await supabaseServer
    .from('matches')
    .select('*')

  return Response.json({ data, error })
}