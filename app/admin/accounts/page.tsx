'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

interface ManagedAccount {
  id: string
  email: string
  full_name: string
  role: 'faculty' | 'hod'
  department: string
  phone?: string
  created_at: string
}

const EMPTY_FORM = { full_name: '', email: '', phone: '', department: '', role: 'faculty' as 'faculty' | 'hod' }

export default function AdminAccountsPage() {
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [accounts, setAccounts] = useState<ManagedAccount[]>([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'list' | 'create'>('list')
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [created,  setCreated]  = useState<{ password: string; emailSent: boolean; name: string; email: string } | null>(null)
  const router   = useRouter()
  const supabase = createClient()
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || p.role !== 'admin') { router.push('/dashboard/student'); return }
      setProfile(p)
      await loadAccounts()
      setLoading(false)
    }
    load()
  }, [])

  async function loadAccounts() {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, department, phone, created_at')
      .in('role', ['faculty', 'hod'])
      .order('created_at', { ascending: false })
    setAccounts((data || []) as ManagedAccount[])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim() || !form.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    setCreating(true)
    setCreated(null)

    const res = await fetch('/api/admin/create-account', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const json = await res.json()

    if (!res.ok) {
      toast.error(json.error || 'Failed to create account')
      setCreating(false)
      return
    }

    setCreated({
      password:   json.password,
      emailSent:  json.emailSent,
      name:       form.full_name,
      email:      form.email,
    })
    toast.success('Account created!')
    setForm(EMPTY_FORM)
    await loadAccounts()
    setCreating(false)
  }

  async function deleteAccount(id: string, name: string) {
    if (!confirm(`Delete account for ${name}? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/delete-account`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: id }),
    })
    if (res.ok) {
      toast.success('Account deleted')
      await loadAccounts()
    } else {
      const j = await res.json()
      toast.error(j.error || 'Failed to delete')
    }
  }

  if (loading || !profile) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="loading-dots">
        {[0,1,2].map(i => <div key={i} className="loading-dot" style={{ animationDelay:`${i*0.2}s` }} />)}
      </div>
    </div>
  )

  const faculty = accounts.filter(a => a.role === 'faculty')
  const hods    = accounts.filter(a => a.role === 'hod')

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1>Account Management</h1>
            <p style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>
              Create and manage faculty & HOD login accounts
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => { setTab('create'); setCreated(null) }}>
            + Create account
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 28 }}>
          <div className="stat"><div className="stat-n">{faculty.length}</div><div className="stat-l">Faculty</div></div>
          <div className="stat"><div className="stat-n">{hods.length}</div><div className="stat-l">HODs</div></div>
          <div className="stat"><div className="stat-n">{accounts.length}</div><div className="stat-l">Total</div></div>
        </div>

        <div className="tabs" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab === 'list' ? 'on' : ''}`} onClick={() => setTab('list')}>
            All accounts ({accounts.length})
          </button>
          <button className={`tab-btn ${tab === 'create' ? 'on' : ''}`} onClick={() => { setTab('create'); setCreated(null) }}>
            + Create account
          </button>
        </div>

        {/* ── LIST ── */}
        {tab === 'list' && (
          <div>
            {accounts.length === 0 ? (
              <div className="card empty-state">
                <div className="empty-state-icon">👤</div>
                No faculty or HOD accounts yet. Create the first one.
              </div>
            ) : (
              <>
                {/* Faculty */}
                {faculty.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Faculty ({faculty.length})
                    </div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                      <table className="tbl">
                        <thead>
                          <tr><th>Name</th><th>Email</th><th>Department</th><th>Phone</th><th>Created</th><th></th></tr>
                        </thead>
                        <tbody>
                          {faculty.map(a => (
                            <tr key={a.id}>
                              <td style={{ fontWeight: 500 }}>{a.full_name}</td>
                              <td style={{ fontSize: 12, color: 'var(--t3)' }}>{a.email}</td>
                              <td style={{ fontSize: 12, color: 'var(--t3)' }}>{a.department || '—'}</td>
                              <td style={{ fontSize: 12, color: 'var(--t3)' }}>{a.phone || '—'}</td>
                              <td style={{ fontSize: 11, color: 'var(--t4)' }}>
                                {new Date(a.created_at).toLocaleDateString('en-IN')}
                              </td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteAccount(a.id, a.full_name)}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* HOD */}
                {hods.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Heads of Department ({hods.length})
                    </div>
                    <div className="card" style={{ overflow: 'hidden' }}>
                      <table className="tbl">
                        <thead>
                          <tr><th>Name</th><th>Email</th><th>Department</th><th>Phone</th><th>Created</th><th></th></tr>
                        </thead>
                        <tbody>
                          {hods.map(a => (
                            <tr key={a.id}>
                              <td style={{ fontWeight: 500 }}>{a.full_name}</td>
                              <td style={{ fontSize: 12, color: 'var(--t3)' }}>{a.email}</td>
                              <td style={{ fontSize: 12, color: 'var(--t3)' }}>{a.department || '—'}</td>
                              <td style={{ fontSize: 12, color: 'var(--t3)' }}>{a.phone || '—'}</td>
                              <td style={{ fontSize: 11, color: 'var(--t4)' }}>
                                {new Date(a.created_at).toLocaleDateString('en-IN')}
                              </td>
                              <td>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteAccount(a.id, a.full_name)}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CREATE ── */}
        {tab === 'create' && (
          <div style={{ maxWidth: 500 }}>
            {/* Generated credentials card */}
            {created && (
              <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--r2)', padding: '20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>✅</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>Account created for {created.name}</span>
                </div>

                <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{created.email}</div>
                </div>

                <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--r)', padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>Temporary password</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.08em', color: 'var(--accent-2)' }}>
                      {created.password}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                      navigator.clipboard.writeText(created.password)
                      toast.success('Password copied!')
                    }}>Copy</button>
                  </div>
                </div>

                {created.emailSent ? (
                  <div style={{ fontSize: 12, color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>✓</span> Welcome email sent to {created.email}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#fbbf24' }}>
                    ⚠ Email not sent (RESEND_API_KEY not configured). Share the password manually.
                  </div>
                )}
              </div>
            )}

            <div className="card card-p">
              <h2 style={{ marginBottom: 4 }}>Create account</h2>
              <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>
                A temporary password is generated and emailed to the user. They must change it on first login.
              </p>

              {/* Role toggle */}
              <div style={{ marginBottom: 18 }}>
                <label className="lbl">Role</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['faculty', 'hod'] as const).map(r => (
                    <button key={r} type="button" onClick={() => set('role', r)}
                      style={{ padding: '10px', borderRadius: 'var(--r)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', transition: 'all 0.12s', border: `1px solid ${form.role === r ? 'var(--accent-2)' : 'var(--line-2)'}`, background: form.role === r ? 'rgba(124,58,237,0.12)' : 'var(--bg-1)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: form.role === r ? '#a78bfa' : 'var(--t2)' }}>
                        {r === 'hod' ? 'HOD' : 'Faculty'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>
                        {r === 'hod' ? 'Final OD authority' : 'Approves events & OD'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="lbl">Full name *</label>
                  <input className="inp" placeholder="Dr. R. Kumar" value={form.full_name}
                    onChange={e => set('full_name', e.target.value)} required autoFocus />
                </div>
                <div>
                  <label className="lbl">Official email *</label>
                  <input className="inp" type="email" placeholder="faculty@srmist.edu.in"
                    value={form.email} onChange={e => set('email', e.target.value)} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="lbl">Department</label>
                    <input className="inp" placeholder="e.g. CSE" value={form.department}
                      onChange={e => set('department', e.target.value)} />
                  </div>
                  <div>
                    <label className="lbl">Phone</label>
                    <input className="inp" type="tel" placeholder="9876543210" value={form.phone}
                      onChange={e => set('phone', e.target.value)} />
                  </div>
                </div>
                <button className="btn btn-primary btn-full btn-lg" style={{ marginTop: 4 }} type="submit" disabled={creating}>
                  {creating ? <><span className="spin" />Creating account...</> : `Create ${form.role === 'hod' ? 'HOD' : 'Faculty'} account →`}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
