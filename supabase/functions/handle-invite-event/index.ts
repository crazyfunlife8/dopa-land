import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')!
const SITE_URL = Deno.env.get('SITE_URL')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TYPE_ZH: Record<string, string> = {
  m: '顯示者', g: '生產者', mg: '顯生', p: '投射者', r: '反映者',
}

async function getLineUid(userId: string): Promise<string | null> {
  const { data } = await admin
    .from('users')
    .select('provider, provider_uid')
    .eq('id', userId)
    .single()
  if (!data || data.provider !== 'line' || !data.provider_uid) return null
  return data.provider_uid
}

async function getUserType(userId: string): Promise<string> {
  const { data } = await admin
    .from('users')
    .select('type')
    .eq('id', userId)
    .single()
  return data?.type || 'g'
}

async function pushLine(lineUid: string, text: string) {
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUid,
      messages: [{ type: 'text', text }],
    }),
  })
  if (!res.ok) {
    console.error('LINE push failed:', res.status, await res.text())
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let payload: { type: string; record: Record<string, string>; old_record?: Record<string, string> }
  try {
    payload = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const { type, record, old_record } = payload
  const appUrl = `${SITE_URL}/frontend/index.html`

  try {
    if (type === 'INSERT') {
      // 新邀請 → 通知收件人
      const toLineUid = await getLineUid(record.to_user_id)
      if (toLineUid) {
        const senderType = await getUserType(record.from_user_id)
        const label = TYPE_ZH[senderType] || '巴巴'
        await pushLine(toLineUid,
          `🎡 有一隻${label}想認識你！\n快去多巴樂園的信箱看看對方的自介，回應他 👉 ${appUrl}`)
      }
    } else if (
      type === 'UPDATE' &&
      record.status === 'accepted' &&
      old_record?.status === 'pending'
    ) {
      // 邀請被接受 → 通知原發送者
      const fromLineUid = await getLineUid(record.from_user_id)
      if (fromLineUid) {
        await pushLine(fromLineUid,
          `💌 對方接受了你的邀請！\n快去多巴樂園的信箱開始聊聊 👉 ${appUrl}`)
      }
    }

    return new Response('ok', { status: 200 })
  } catch (e) {
    console.error('Unexpected error:', e)
    return new Response('Internal error', { status: 500 })
  }
})
