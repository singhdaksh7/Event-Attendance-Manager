'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // Get role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const role = profile?.role ?? 'student'

    // Wait for session to be fully written to cookies
    await new Promise(r => setTimeout(r, 500))

    // Verify session is actually there before redirecting
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      toast.error('Session failed to save. Please try again.')
      setLoading(false)
      return
    }

    toast.success('Signed in!')

    // First-login gate — admin-created accounts must set their own password
    if (data.user.user_metadata?.must_change_password) {
      window.location.href = '/auth/change-password'
      return
    }

    if      (role === 'hod')     window.location.href = '/dashboard/hod'
    else if (role === 'faculty') window.location.href = '/dashboard/faculty'
    else if (role === 'admin')   window.location.href = '/admin/accounts'
    else                         window.location.href = '/dashboard/student'
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', backgroundImage:'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.08) 0%, transparent 55%)' }}>
      <header className="nav">
        <Link href="/" className="nav-logo">Event<span>OD</span></Link>
      </header>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <div className="fade-up" style={{ width:'100%', maxWidth:360 }}>
          <div style={{ marginBottom:28, textAlign:'center' }}>
            <h1 style={{ fontSize:22, fontWeight:600, letterSpacing:'-0.03em', marginBottom:6 }}>Welcome back</h1>
            <p style={{ fontSize:13, color:'var(--t3)' }}>Sign in to your EventOD account</p>
          </div>

          <div className="card card-p">
            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label className="lbl">Email</label>
                <input className="inp" type="email" placeholder="you@srmist.edu.in"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required autoFocus autoComplete="email" />
              </div>
              <div>
                <label className="lbl">Password</label>
                <input className="inp" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password" />
              </div>
              <button className="btn btn-primary btn-full btn-lg" style={{ marginTop:4 }} type="submit" disabled={loading}>
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <span className="spin" /> Signing in...
                    </span>
                  : 'Sign in →'}
              </button>
            </form>

            <hr />

            <p style={{ textAlign:'center', fontSize:13, color:'var(--t3)' }}>
              No account?{' '}
              <Link href="/auth/signup" style={{ color:'var(--accent-2)', textDecoration:'none', fontWeight:500 }}>
                Create one
              </Link>
            </p>
          </div>

          <p style={{ textAlign:'center', fontSize:11, color:'var(--t4)', marginTop:14, lineHeight:1.6 }}>
            Make sure you verified your email after signup.
          </p>
        </div>
      </div>
    </div>
  )
}
