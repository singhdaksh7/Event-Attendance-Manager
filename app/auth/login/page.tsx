'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
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

    // Get role from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const role = profile?.role ?? 'student'
    toast.success('Signed in!')

    // Small delay so toast shows, then hard redirect
    setTimeout(() => {
      if (role === 'hod')          window.location.replace('/dashboard/hod')
      else if (role === 'faculty') window.location.replace('/dashboard/faculty')
      else                         window.location.replace('/dashboard/student')
    }, 400)
  }

  return (
    <div className="page-bg min-h-screen flex items-center justify-center px-4">
      <div style={{ position:'fixed', top:'15%', left:'5%', width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'fixed', bottom:'10%', right:'5%', width:250, height:250, borderRadius:'50%', background:'radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)', pointerEvents:'none' }} />

      <div className="fade-up" style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <Link href="/" style={{ fontFamily:'var(--font-display)', fontSize:28, fontWeight:800, background:'linear-gradient(135deg,#818cf8,#2dd4bf)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:'-0.04em', textDecoration:'none' }}>
            EventOD
          </Link>
          <p style={{ fontSize:13, color:'var(--t3)', marginTop:6 }}>SRM Institute · Sign in to continue</p>
        </div>

        <div className="card-accent" style={{ padding:'2rem' }}>
          <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            <div>
              <label className="lbl">Email address</label>
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
            <button className="btn btn-primary btn-full" style={{ marginTop:6, height:46 }} type="submit" disabled={loading}>
              {loading
                ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 0.7s linear infinite' }} />
                    Signing in...
                  </span>
                : 'Sign in →'}
            </button>
          </form>
          <div className="divider" />
          <p style={{ textAlign:'center', fontSize:13, color:'var(--t3)' }}>
            No account?{' '}
            <Link href="/auth/signup" style={{ color:'var(--indigo-light)', textDecoration:'none', fontWeight:500 }}>Create one</Link>
          </p>
        </div>
        <p style={{ textAlign:'center', fontSize:11, color:'var(--t4)', marginTop:14 }}>
          Make sure you verified your email after signup before signing in.
        </p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
