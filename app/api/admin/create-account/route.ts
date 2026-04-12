import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function generatePassword(): string {
  const upper   = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower   = 'abcdefghjkmnpqrstuvwxyz'
  const digits  = '23456789'
  const special = '!@#$'
  const all = upper + lower + digits + special
  // Guarantee at least one of each type
  const required = [
    upper  [Math.floor(Math.random() * upper.length)],
    lower  [Math.floor(Math.random() * lower.length)],
    digits [Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ]
  for (let i = required.length; i < 12; i++) {
    required.push(all[Math.floor(Math.random() * all.length)])
  }
  // Shuffle
  return required.sort(() => Math.random() - 0.5).join('')
}

function buildWelcomeEmail(name: string, email: string, password: string, role: string): string {
  const roleLabel = role === 'hod' ? 'Head of Department' : 'Faculty'
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://od-system.vercel.app'
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:ui-sans-serif,system-ui,sans-serif">
  <div style="max-width:540px;margin:32px auto;background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#111;padding:20px 28px">
      <div style="font-size:15px;font-weight:700;color:#fff;letter-spacing:-0.02em">SRM Institute · EventOD</div>
      <div style="font-size:11px;color:#666;margin-top:2px">Account created</div>
    </div>
    <div style="padding:28px">
      <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">
        Dear <strong>${name}</strong>,<br><br>
        An EventOD account has been created for you as <strong>${roleLabel}</strong>.
        Use the credentials below to sign in for the first time.
      </p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <div style="margin-bottom:10px">
          <div style="font-size:11px;color:#888;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.06em">Email</div>
          <div style="font-size:14px;font-weight:600;color:#111">${email}</div>
        </div>
        <div>
          <div style="font-size:11px;color:#888;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.06em">Temporary password</div>
          <div style="font-size:18px;font-weight:700;font-family:monospace;color:#7c3aed;letter-spacing:0.1em">${password}</div>
        </div>
      </div>

      <p style="font-size:13px;color:#666;margin:0 0 20px;line-height:1.6">
        You will be asked to set a new password when you sign in for the first time.
      </p>

      <a href="${appUrl}/auth/login"
        style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600">
        Sign in to EventOD →
      </a>

      <p style="font-size:12px;color:#aaa;margin-top:28px;line-height:1.6">
        If you did not expect this email, please contact your institution's admin.<br>
        This is an automated message — please do not reply.
      </p>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #f0f0f0;font-size:11px;color:#bbb;text-align:center">
      EventOD · SRM Institute of Science and Technology
    </div>
  </div>
</body>
</html>`
}

export async function POST(request: NextRequest) {
  // ── Auth check — only admin can call this ──
  const serverClient = await createClient()
  const { data: { session } } = await serverClient.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await serverClient
    .from('profiles').select('role').eq('id', session.user.id).single()
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  // ── Parse body ──
  const body = await request.json()
  const { full_name, email, phone, department, role } = body

  if (!full_name?.trim() || !email?.trim() || !role) {
    return NextResponse.json({ error: 'full_name, email, and role are required' }, { status: 400 })
  }
  if (!['faculty', 'hod'].includes(role)) {
    return NextResponse.json({ error: 'role must be faculty or hod' }, { status: 400 })
  }

  const password   = generatePassword()
  const adminClient = createAdminClient()

  // ── Create auth user ──
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email:         email.trim(),
    password,
    email_confirm: true,   // skip email confirmation
    user_metadata: {
      full_name:            full_name.trim(),
      role,
      department:           department?.trim() || '',
      phone:                phone?.trim() || '',
      must_change_password: true,
    },
  })

  if (createError || !newUser?.user) {
    return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 400 })
  }

  // ── Upsert profile row ──
  await adminClient.from('profiles').upsert({
    id:         newUser.user.id,
    email:      email.trim(),
    full_name:  full_name.trim(),
    role,
    department: department?.trim() || '',
    phone:      phone?.trim() || null,
  })

  // ── Send welcome email via Resend (best-effort) ──
  const RESEND_KEY  = process.env.RESEND_API_KEY
  const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'EventOD <onboarding@resend.dev>'
  let emailSent = false

  if (RESEND_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    RESEND_FROM,
          to:      [email.trim()],
          subject: 'Your EventOD account is ready',
          html:    buildWelcomeEmail(full_name.trim(), email.trim(), password, role),
        }),
      })
      emailSent = res.ok
    } catch (e) {
      console.error('Welcome email failed:', e)
    }
  }

  return NextResponse.json({
    success:   true,
    userId:    newUser.user.id,
    password,          // returned so admin can copy & share if email fails
    emailSent,
  })
}
