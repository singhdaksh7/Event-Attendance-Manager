'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [checking,  setChecking]  = useState(true)
  const [userName,  setUserName]  = useState('')
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/auth/login'); return }

      const mustChange = session.user.user_metadata?.must_change_password
      if (!mustChange) {
        // Already changed — redirect to correct dashboard
        const { data: p } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
        const role = p?.role
        router.push(role === 'hod' ? '/dashboard/hod' : role === 'faculty' ? '/dashboard/faculty' : role === 'admin' ? '/admin/accounts' : '/dashboard/student')
        return
      }
      setUserName(session.user.user_metadata?.full_name || session.user.email || '')
      setChecking(false)
    }
    check()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (password !== confirm) { toast.error('Passwords do not match'); return }

    setLoading(true)

    // Update password
    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) { toast.error(pwError.message); setLoading(false); return }

    // Clear the must_change_password flag
    const { error: metaError } = await supabase.auth.updateUser({
      data: { must_change_password: false },
    })
    if (metaError) console.error('Flag clear failed:', metaError)

    toast.success('Password updated! Redirecting...')

    // Redirect to appropriate dashboard
    await new Promise(r => setTimeout(r, 800))
    const { data: { session } } = await supabase.auth.getSession()
    const { data: p } = await supabase.from('profiles').select('role').eq('id', session!.user.id).single()
    const role = p?.role
    window.location.href = role === 'hod' ? '/dashboard/hod' : role === 'faculty' ? '/dashboard/faculty' : '/dashboard/student'
  }

  if (checking) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-dots">
        {[0,1,2].map(i => <div key={i} className="loading-dot" style={{ animationDelay:`${i*0.2}s` }} />)}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 55%)' }}>
      <header className="nav">
        <Link href="/" className="nav-logo">Event<span>OD</span></Link>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div className="fade-up" style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ marginBottom: 28, textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 20 }}>
              🔑
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 6 }}>Set your password</h1>
            <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6 }}>
              Welcome, <strong style={{ color: 'var(--t2)' }}>{userName}</strong>.<br />
              Choose a secure password for your account.
            </p>
          </div>

          <div className="card card-p">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="lbl">New password</label>
                <input className="inp" type="password" placeholder="At least 8 characters"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8} autoFocus autoComplete="new-password" />
              </div>
              <div>
                <label className="lbl">Confirm password</label>
                <input className="inp" type="password" placeholder="Repeat your password"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  required autoComplete="new-password" />
                {confirm && password !== confirm && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</div>
                )}
                {confirm && password === confirm && confirm.length >= 8 && (
                  <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>✓ Passwords match</div>
                )}
              </div>
              <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 4 }}
                type="submit" disabled={loading || password !== confirm || password.length < 8}>
                {loading ? <><span className="spin" /> Saving...</> : 'Set password & continue →'}
              </button>
            </form>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--t4)', marginTop: 14, lineHeight: 1.6 }}>
            Your temporary password will no longer work after this.
          </p>
        </div>
      </div>
    </div>
  )
}
