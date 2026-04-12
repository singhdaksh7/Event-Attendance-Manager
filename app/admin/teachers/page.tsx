'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

interface Teacher {
  id: string
  emp_id: string
  full_name: string
  email: string
  designation: string
  gender: string
  mobile: string
  official_mobile: string
  department: string
}

const EMPTY_FORM = { emp_id:'', full_name:'', email:'', designation:'', gender:'', mobile:'', official_mobile:'', department:'' }

export default function TeachersPage() {
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [teachers,  setTeachers]  = useState<Teacher[]>([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<'list'|'add'|'csv'>('list')
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [editId,    setEditId]    = useState<string|null>(null)
  const [search,    setSearch]    = useState('')
  const [csvText,   setCsvText]   = useState('')
  const [csvParsed, setCsvParsed] = useState<any[]>([])
  const [csvLoading,setCsvLoading]= useState(false)
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
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
      await loadTeachers()
      setLoading(false)
    }
    load()
  }, [])

  async function loadTeachers() {
    const { data } = await supabase.from('teachers').select('*').order('full_name')
    setTeachers(data || [])
  }

  async function saveTeacher(e: React.FormEvent) {
    e.preventDefault()
    if (!form.emp_id || !form.full_name || !form.email) { toast.error('Emp ID, name and email are required'); return }
    setSaving(true)
    if (editId) {
      const { error } = await supabase.from('teachers').update(form).eq('id', editId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Teacher updated')
      setEditId(null)
    } else {
      const { error } = await supabase.from('teachers').insert(form)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Teacher added')
    }
    setForm(EMPTY_FORM)
    await loadTeachers()
    setTab('list')
    setSaving(false)
  }

  async function deleteTeacher(id: string) {
    if (!confirm('Delete this teacher?')) return
    await supabase.from('teachers').delete().eq('id', id)
    toast.success('Deleted')
    await loadTeachers()
  }

  function startEdit(t: Teacher) {
    setForm({ emp_id: t.emp_id, full_name: t.full_name, email: t.email, designation: t.designation||'', gender: t.gender||'', mobile: t.mobile||'', official_mobile: t.official_mobile||'', department: t.department||'' })
    setEditId(t.id)
    setTab('add')
  }

  // ── CSV parsing ──
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) { toast.error('CSV must have a header row and at least one data row'); return }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g,'').replace(/\s+/g,'_'))
    const errors: string[] = []
    const rows: any[] = []

    // Map common header variations
    const headerMap: Record<string, string> = {
      'emp_id': 'emp_id', 'employee_id': 'emp_id', 'empid': 'emp_id', 'id': 'emp_id',
      'full_name': 'full_name', 'name': 'full_name', 'teacher_name': 'full_name', 'faculty_name': 'full_name',
      'email': 'email', 'email_id': 'email', 'official_email': 'email',
      'designation': 'designation', 'post': 'designation', 'position': 'designation',
      'gender': 'gender', 'sex': 'gender',
      'mobile': 'mobile', 'mobile_number': 'mobile', 'phone': 'mobile', 'personal_mobile': 'mobile',
      'official_mobile': 'official_mobile', 'official_mobile_number': 'official_mobile', 'office_mobile': 'official_mobile',
      'department': 'department', 'dept': 'department',
    }

    const mappedHeaders = headers.map(h => headerMap[h] || h)

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g,''))
      const row: any = {}
      mappedHeaders.forEach((h, idx) => { row[h] = values[idx] || '' })

      if (!row.emp_id)   { errors.push(`Row ${i}: missing emp_id`);   continue }
      if (!row.full_name){ errors.push(`Row ${i}: missing full_name`); continue }
      if (!row.email)    { errors.push(`Row ${i}: missing email`);     continue }

      rows.push(row)
    }

    setCsvParsed(rows)
    setCsvErrors(errors)

    if (rows.length > 0) toast.success(`${rows.length} teachers ready to import`)
    if (errors.length > 0) toast.error(`${errors.length} rows have errors`)
  }

  async function importCSV() {
    if (!csvParsed.length) return
    setCsvLoading(true)
    let imported = 0, skipped = 0

    for (const row of csvParsed) {
      const { error } = await supabase.from('teachers').upsert({
        emp_id:          row.emp_id,
        full_name:       row.full_name,
        email:           row.email,
        designation:     row.designation || null,
        gender:          ['Male','Female','Other'].includes(row.gender) ? row.gender : null,
        mobile:          row.mobile || null,
        official_mobile: row.official_mobile || null,
        department:      row.department || null,
      }, { onConflict: 'emp_id' })

      if (error) { skipped++; console.warn(error.message) }
      else imported++
    }

    toast.success(`Imported ${imported} teachers${skipped > 0 ? `, ${skipped} skipped` : ''}`)
    setCsvParsed([]); setCsvText(''); setCsvErrors([])
    if (fileRef.current) fileRef.current.value = ''
    await loadTeachers()
    setTab('list')
    setCsvLoading(false)
  }

  const filtered = teachers.filter(t =>
    !search ||
    t.full_name.toLowerCase().includes(search.toLowerCase()) ||
    t.emp_id.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase()) ||
    (t.department || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading || !profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <Link href="/admin/timetable" style={{ fontSize:12, color:'var(--t3)', textDecoration:'none', display:'inline-block', marginBottom:8 }}>← Timetable</Link>
            <h1>Teachers</h1>
            <p style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>{teachers.length} teachers · Used in timetable entries</p>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom:20 }}>
          <button className={`tab-btn ${tab==='list'?'on':''}`} onClick={() => setTab('list')}>
            All teachers ({teachers.length})
          </button>
          <button className={`tab-btn ${tab==='add'?'on':''}`} onClick={() => { setTab('add'); setEditId(null); setForm(EMPTY_FORM) }}>
            {editId ? 'Edit teacher' : '+ Add teacher'}
          </button>
          {profile.role === 'admin' && (
            <button className={`tab-btn ${tab==='csv'?'on':''}`} onClick={() => setTab('csv')}>
              Upload CSV
            </button>
          )}
        </div>

        {/* ── LIST ── */}
        {tab === 'list' && (
          <div className="card" style={{ overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', gap:10 }}>
              <input className="inp" placeholder="Search name, emp ID, email, dept..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, height:32 }} />
              <span style={{ fontSize:12, color:'var(--t3)', flexShrink:0 }}>{filtered.length} shown</span>
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding:40, textAlign:'center', fontSize:13, color:'var(--t3)' }}>
                {teachers.length === 0 ? 'No teachers added yet. Add manually or upload CSV.' : 'No results.'}
              </div>
            ) : (
              <div style={{ overflowX:'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Emp ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Designation</th>
                      <th>Dept</th>
                      <th>Mobile</th>
                      <th>Gender</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id}>
                        <td style={{ fontFamily:'monospace', fontSize:12, color:'var(--t3)' }}>{t.emp_id}</td>
                        <td style={{ fontWeight:500 }}>{t.full_name}</td>
                        <td style={{ fontSize:12, color:'var(--t3)' }}>{t.email}</td>
                        <td style={{ fontSize:12, color:'var(--t3)' }}>{t.designation || '—'}</td>
                        <td style={{ fontSize:12, color:'var(--t3)' }}>{t.department || '—'}</td>
                        <td style={{ fontSize:12, color:'var(--t3)' }}>{t.mobile || t.official_mobile || '—'}</td>
                        <td><span className="badge badge-gray" style={{ fontSize:10 }}>{t.gender || '—'}</span></td>
                        <td style={{ display:'flex', gap:4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteTeacher(t.id)}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ADD / EDIT ── */}
        {tab === 'add' && (
          <div style={{ maxWidth:560 }}>
            <div className="card card-p">
              <h2 style={{ marginBottom:16 }}>{editId ? 'Edit teacher' : 'Add teacher'}</h2>
              <form onSubmit={saveTeacher} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label className="lbl">Employee ID *</label>
                    <input className="inp" placeholder="e.g. EMP001" value={form.emp_id} onChange={e => set('emp_id', e.target.value)} required style={{ fontFamily:'monospace' }} />
                  </div>
                  <div>
                    <label className="lbl">Full name *</label>
                    <input className="inp" placeholder="Dr. R. Kumar" value={form.full_name} onChange={e => set('full_name', e.target.value)} required />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label className="lbl">Email *</label>
                    <input className="inp" type="email" placeholder="teacher@srmist.edu.in" value={form.email} onChange={e => set('email', e.target.value)} required />
                  </div>
                  <div>
                    <label className="lbl">Designation</label>
                    <input className="inp" placeholder="e.g. Assistant Professor" value={form.designation} onChange={e => set('designation', e.target.value)} />
                  </div>
                  <div>
                    <label className="lbl">Department</label>
                    <input className="inp" placeholder="e.g. CSE" value={form.department} onChange={e => set('department', e.target.value)} />
                  </div>
                  <div>
                    <label className="lbl">Gender</label>
                    <select className="inp" value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">Select</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Mobile</label>
                    <input className="inp" type="tel" placeholder="9876543210" value={form.mobile} onChange={e => set('mobile', e.target.value)} />
                  </div>
                  <div>
                    <label className="lbl">Official mobile</label>
                    <input className="inp" type="tel" placeholder="Official number" value={form.official_mobile} onChange={e => set('official_mobile', e.target.value)} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button className="btn btn-primary" style={{ flex:1 }} type="submit" disabled={saving}>
                    {saving ? <><span className="spin"/>Saving...</> : editId ? 'Update teacher' : 'Add teacher'}
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => { setTab('list'); setEditId(null); setForm(EMPTY_FORM) }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── CSV UPLOAD ── */}
        {tab === 'csv' && (
          <div style={{ maxWidth:700 }}>
            <div className="card card-p" style={{ marginBottom:16 }}>
              <h2 style={{ marginBottom:6 }}>Upload CSV</h2>
              <p style={{ fontSize:13, color:'var(--t3)', marginBottom:16, lineHeight:1.6 }}>
                Upload a CSV file with teacher data. Required columns: <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>emp_id</code>, <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>full_name</code>, <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>email</code>. Optional: <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>designation</code>, <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>gender</code>, <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>mobile</code>, <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>official_mobile</code>, <code style={{ background:'var(--bg-2)', padding:'1px 5px', borderRadius:4, fontSize:12 }}>department</code>
              </p>

              {/* Sample CSV download */}
              <button className="btn btn-ghost btn-sm" style={{ marginBottom:16 }} onClick={() => {
                const csv = `emp_id,full_name,email,designation,gender,mobile,official_mobile,department\nEMP001,Dr. R. Kumar,rkumar@srmist.edu.in,Assistant Professor,Male,9876543210,9876543211,CSE\nEMP002,Dr. S. Sharma,ssharma@srmist.edu.in,Associate Professor,Female,9876543212,9876543213,ECE`
                const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'teachers-template.csv'; a.click()
              }}>↓ Download sample CSV</button>

              <div style={{ border:'2px dashed var(--line-2)', borderRadius:'var(--r2)', padding:'24px', textAlign:'center', marginBottom:16 }}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as any).style.borderColor = 'var(--accent-2)' }}
                onDragLeave={e => { (e.currentTarget as any).style.borderColor = 'var(--line-2)' }}
                onDrop={e => {
                  e.preventDefault()
                  ;(e.currentTarget as any).style.borderColor = 'var(--line-2)'
                  const file = e.dataTransfer.files[0]
                  if (file) { const r = new FileReader(); r.onload = ev => { const t = ev.target?.result as string; setCsvText(t); parseCSV(t) }; r.readAsText(file) }
                }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:13, color:'var(--t2)', marginBottom:8 }}>Drag & drop CSV here or</div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFileUpload} style={{ display:'none' }} />
                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Browse file</button>
              </div>

              {/* CSV errors */}
              {csvErrors.length > 0 && (
                <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'var(--r)', padding:'10px 14px', marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--danger)', marginBottom:4 }}>{csvErrors.length} row errors:</div>
                  {csvErrors.map((e, i) => <div key={i} style={{ fontSize:11, color:'#f87171' }}>{e}</div>)}
                </div>
              )}

              {/* Preview */}
              {csvParsed.length > 0 && (
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--t2)', marginBottom:8 }}>
                    Preview — {csvParsed.length} teachers ready to import
                  </div>
                  <div style={{ overflowX:'auto', marginBottom:14, border:'1px solid var(--line)', borderRadius:'var(--r)' }}>
                    <table className="tbl" style={{ minWidth:500 }}>
                      <thead><tr><th>Emp ID</th><th>Name</th><th>Email</th><th>Designation</th><th>Dept</th></tr></thead>
                      <tbody>
                        {csvParsed.slice(0, 10).map((r, i) => (
                          <tr key={i}>
                            <td style={{ fontFamily:'monospace', fontSize:11 }}>{r.emp_id}</td>
                            <td style={{ fontSize:12 }}>{r.full_name}</td>
                            <td style={{ fontSize:11, color:'var(--t3)' }}>{r.email}</td>
                            <td style={{ fontSize:11, color:'var(--t3)' }}>{r.designation || '—'}</td>
                            <td style={{ fontSize:11, color:'var(--t3)' }}>{r.department || '—'}</td>
                          </tr>
                        ))}
                        {csvParsed.length > 10 && (
                          <tr><td colSpan={5} style={{ textAlign:'center', fontSize:11, color:'var(--t4)', padding:8 }}>...and {csvParsed.length - 10} more</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button className="btn btn-primary" style={{ flex:1 }} onClick={importCSV} disabled={csvLoading}>
                      {csvLoading ? <><span className="spin"/>Importing...</> : `Import ${csvParsed.length} teachers`}
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setCsvParsed([]); setCsvText(''); setCsvErrors([]); if (fileRef.current) fileRef.current.value = '' }}>Clear</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
