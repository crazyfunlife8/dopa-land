import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const LINE_CLIENT_ID = Deno.env.get('LINE_CLIENT_ID')!
const LINE_CLIENT_SECRET = Deno.env.get('LINE_CLIENT_SECRET')!
const SITE_URL = Deno.env.get('SITE_URL')!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const errorRedirect = `${SITE_URL}/frontend/index.html#error=line_auth_failed`

  if (!code) return Response.redirect(errorRedirect, 302)

  try {
    // 1. 用 code 換取 LINE access token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${SUPABASE_URL}/functions/v1/line-callback`,
        client_id: LINE_CLIENT_ID,
        client_secret: LINE_CLIENT_SECRET,
      }),
    })
    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text())
      return Response.redirect(errorRedirect, 302)
    }
    const { access_token } = await tokenRes.json()

    // 2. 取得 LINE 使用者 ID
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!profileRes.ok) {
      console.error('Profile fetch failed:', await profileRes.text())
      return Response.redirect(errorRedirect, 302)
    }
    const { userId: lineUserId } = await profileRes.json()

    // 3. 找既有帳號，找不到就建新的
    const placeholderEmail = `line_${lineUserId}@line.placeholder.local`

    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('provider', 'line')
      .eq('provider_uid', lineUserId)
      .single()

    if (!existingUser) {
      const { error: createError } = await admin.auth.admin.createUser({
        email: placeholderEmail,
        email_confirm: true,
        user_metadata: { sub: lineUserId, provider: 'line' },
        app_metadata: { provider: 'line', providers: ['line'] },
      })
      // 422 = auth.users 已有此帳號（trigger 可能沒建到 public.users），繼續即可
      if (createError && createError.status !== 422) {
        console.error('Create user failed:', createError)
        return Response.redirect(errorRedirect, 302)
      }
    }

    // 4. 產生一次性登入連結，讓瀏覽器帶著 session 跳回前端
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: placeholderEmail,
      options: { redirectTo: `${SITE_URL}/frontend/index.html` },
    })
    if (linkError || !linkData?.properties?.action_link) {
      console.error('Generate link failed:', linkError)
      return Response.redirect(errorRedirect, 302)
    }

    return Response.redirect(linkData.properties.action_link, 302)
  } catch (e) {
    console.error('Unexpected error:', e)
    return Response.redirect(errorRedirect, 302)
  }
})
