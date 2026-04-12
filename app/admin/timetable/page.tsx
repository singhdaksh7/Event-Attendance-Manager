'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const YEARS = ['1st Year','2nd Year','3rd Year','4th Year']
const SLOTS = [
  { id:1, label:'Slot 1', time:'9:30 – 10:20'  },
  { id:2, label:'Slot 2', time:'10:20 – 11:10' },
  { id:3, label:'Slot 3', time:'11:20 – 12:10' },
  { id:4, label:'Slot 4', time:'12:10 – 1:00'  },
  { id:5, label:'Slot 5', time:'2:10 – 3:00'   },
  { id:6, label:'Slot 6', time:'3:00 – 3:50'   },
]

interface Dept    { id:string; name:string; specialisations:string[] }
interface Section { id:string; department:string; specialisation:string; year_label:string; section_code:string; display_name:string }
interface TTEntry { id:string; section_id:string; day_of_week:number; slot_id:number; subject_name:string; teacher_name:string; teacher_email:string }

export default function TimetablePage() {
  const [profile,    setProfile]    = useState<Profile | null>(null)
  const [tab,        setTab]        = useState<'depts'|'sections'|'timetable'>('depts')
  const [depts,      setDepts]      = useState<Dept[]>([])
  const [sections,   setSections]   = useState<Section[]>([])
  const [entries,    setEntries]    = useState<TTEntry[]>([])
  const [selSection, setSelSection] = useState('')
  const [selDay,     setSelDay]     = useState(0)
  const [loading,    setLoading]    = useState(true)

  // Dept form
  const [deptForm,  setDeptForm]  = useState({ name:'', specInput:'' })
  const [deptSpecs, setDeptSpecs] = useState<string[]>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [editDept,  setEditDept]  = useState<Dept | null>(null)

  // Section form
  const [secForm,    setSecForm]    = useState({ department:'', specialisation:'', year_label:'', section_code:'' })
  const [secLoading, setSecLoading] = useState(false)

  // TT form
  const [ttForm,    setTtForm]    = useState({ section_id:'', day_of_week:'1', slot_id:'1', subject_name:'', teacher_name:'', teacher_email:'', teacher_id:'' })
  const [ttLoading, setTtLoading] = useState(false)
  const [editEntry, setEditEntry] = useState<TTEntry | null>(null)
  const [teachers,  setTeachers]  = useState<{id:string;full_name:string;email:string;designation:string;department:string}[]>([])

  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || p.role !== 'admin') { router.push('/dashboard/student'); return }
      setProfile(p)
      await loadAll()
      setLoading(false)
    }
    load()
  }, [])

  async function loadAll() {
    const [d, s, t, tc] = await Promise.all([
      supabase.from('departments').select('*').order('name'),
      supabase.from('sections').select('*').order('department').order('year_label').order('section_code'),
      supabase.from('timetable_entries').select('*'),
      supabase.from('teachers').select('id,full_name,email,designation,department').order('full_name'),
    ])
    setDepts(d.data || [])
    setSections(s.data || [])
    setEntries(t.data || [])
    setTeachers(tc.data || [])
  }

  // ── Dept handlers ──
  function addSpec() {
    const s = deptForm.specInput.trim()
    if (!s || deptSpecs.includes(s)) return
    setDeptSpecs(p => [...p, s])
    setDeptForm(f => ({ ...f, specInput:'' }))
  }

  async function saveDept(e: React.FormEvent) {
    e.preventDefault()
    if (!deptForm.name.trim()) return
    setDeptLoading(true)
    if (editDept) {
      await supabase.from('departments').update({ name: deptForm.name.trim(), specialisations: deptSpecs }).eq('id', editDept.id)
      toast.success('Department updated')
      setEditDept(null)
    } else {
      const { error } = await supabase.from('departments').insert({ name: deptForm.name.trim(), specialisations: deptSpecs })
      if (error) { toast.error(error.message); setDeptLoading(false); return }
      toast.success('Department added')
    }
    setDeptForm({ name:'', specInput:'' }); setDeptSpecs([])
    await loadAll(); setDeptLoading(false)
  }

  async function deleteDept(id: string) {
    if (!confirm('Delete department?')) return
    await supabase.from('departments').delete().eq('id', id)
    toast.success('Deleted'); await loadAll()
  }

  // ── Section handlers ──
  const secSpecOptions = depts.find(d => d.name === secForm.department)?.specialisations || []

  async function addSection(e: React.FormEvent) {
    e.preventDefault()
    if (!secForm.department || !secForm.year_label || !secForm.section_code) return
    setSecLoading(true)
    const { error } = await supabase.from('sections').insert({
      department:     secForm.department,
      specialisation: secForm.specialisation || '',
      year_label:     secForm.year_label,
      section_code:   secForm.section_code.toUpperCase(),
    })
    if (error) { toast.error(error.message); setSecLoading(false); return }
    toast.success('Section added')
    setSecForm({ department:'', specialisation:'', year_label:'', section_code:'' })
    await loadAll(); setSecLoading(false)
  }

  async function deleteSection(id: string) {
    if (!confirm('Delete section and all its timetable entries?')) return
    await supabase.from('sections').delete().eq('id', id)
    toast.success('Deleted'); await loadAll()
  }

  // ── TT handlers ──
  async function saveTTEntry(e: React.FormEvent) {
    e.preventDefault()
    if (!ttForm.section_id || !ttForm.subject_name || !ttForm.teacher_id) {
      toast.error('Select section, subject and teacher'); return
    }
    setTtLoading(true)
    const teacher = teachers.find(t => t.id === ttForm.teacher_id)
    const payload = {
      section_id:    ttForm.section_id,
      day_of_week:   parseInt(ttForm.day_of_week),
      slot_id:       parseInt(ttForm.slot_id),
      subject_name:  ttForm.subject_name,
      teacher_name:  teacher?.full_name || '',
      teacher_email: teacher?.email || '',
      teacher_id:    ttForm.teacher_id,
    }
    if (editEntry) {
      await supabase.from('timetable_entries').update(payload).eq('id', editEntry.id)
      toast.success('Updated'); setEditEntry(null)
    } else {
      const { error } = await supabase.from('timetable_entries').upsert(payload, { onConflict:'section_id,day_of_week,slot_id' })
      if (error) { toast.error(error.message); setTtLoading(false); return }
      toast.success('Saved')
    }
    setTtForm(f => ({ ...f, slot_id:'1', subject_name:'', teacher_name:'', teacher_email:'' }))
    await loadAll(); setTtLoading(false)
  }

  const visibleEntries = entries.filter(e =>
    (!selSection || e.section_id === selSection) &&
    (!selDay     || e.day_of_week === selDay)
  )

  if (loading || !profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10 }}>
          <div>
            <h1>Timetable Manager</h1>
            <p style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>Departments → Sections → Timetable</p>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Link href="/admin/timetable-import"><button className="btn btn-primary btn-sm">↑ Import Excel</button></Link>
            <Link href="/admin/notifications"><button className="btn btn-ghost btn-sm">Notifications →</button></Link>
          </div>
        </div>

        {/* Slot reference */}
        <div style={{ background:'var(--bg-1)', border:'1px solid var(--line)', borderRadius:'var(--r2)', padding:'10px 16px', marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:'var(--t3)', letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:6 }}>SRM Slots</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'4px 18px', fontSize:12, color:'var(--t2)' }}>
            {SLOTS.map(s => <span key={s.id}><span style={{ color:'var(--t4)' }}>{s.label}:</span> {s.time}</span>)}
            <span style={{ color:'var(--t4)' }}>Break 11:10–11:20 · Lunch 1:00–2:10</span>
          </div>
        </div>

        <div className="tabs" style={{ marginBottom:20 }}>
          {(['depts','sections','timetable'] as const).map(t => (
            <button key={t} className={`tab-btn ${tab===t?'on':''}`} onClick={() => setTab(t)}>
              {t === 'depts' ? `Departments (${depts.length})` : t === 'sections' ? `Sections (${sections.length})` : `Timetable (${entries.length})`}
            </button>
          ))}
        </div>

        {/* ── DEPARTMENTS ── */}
        {tab === 'depts' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:20, alignItems:'start' }}>
            <div className="card card-p">
              <h2 style={{ marginBottom:16 }}>{editDept ? 'Edit department' : 'Add department'}</h2>
              <form onSubmit={saveDept} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="lbl">Department name *</label>
                  <input className="inp" placeholder="e.g. CSE" value={deptForm.name} onChange={e => setDeptForm(f=>({...f,name:e.target.value}))} required />
                </div>
                <div>
                  <label className="lbl">Specialisations</label>
                  <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                    <input className="inp" placeholder="e.g. Core" value={deptForm.specInput} onChange={e => setDeptForm(f=>({...f,specInput:e.target.value}))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpec() } }} style={{ flex:1 }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addSpec}>Add</button>
                  </div>
                  {deptSpecs.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {deptSpecs.map(s => (
                        <span key={s} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', background:'var(--bg-3)', borderRadius:20, fontSize:12 }}>
                          {s}
                          <button type="button" onClick={() => setDeptSpecs(p=>p.filter(x=>x!==s))}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--t3)', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-primary" style={{ flex:1 }} type="submit" disabled={deptLoading}>
                    {deptLoading ? <><span className="spin"/>Saving...</> : editDept ? 'Update' : '+ Add'}
                  </button>
                  {editDept && <button type="button" className="btn btn-ghost" onClick={() => { setEditDept(null); setDeptForm({name:'',specInput:''}); setDeptSpecs([]) }}>Cancel</button>}
                </div>
              </form>
            </div>

            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', fontSize:13, fontWeight:500 }}>All departments</div>
              {depts.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--t3)' }}>No departments yet.</div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>Dept</th><th>Specialisations</th><th></th></tr></thead>
                  <tbody>
                    {depts.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight:600 }}>{d.name}</td>
                        <td>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                            {d.specialisations.length === 0
                              ? <span style={{ fontSize:11, color:'var(--t4)' }}>None</span>
                              : d.specialisations.map(s => (
                                <span key={s} className="badge badge-gray" style={{ fontSize:10 }}>{s}</span>
                              ))}
                          </div>
                        </td>
                        <td style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            setEditDept(d); setDeptForm({ name:d.name, specInput:'' }); setDeptSpecs([...d.specialisations])
                          }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteDept(d.id)}>Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── SECTIONS ── */}
        {tab === 'sections' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:20, alignItems:'start' }}>
            <div className="card card-p">
              <h2 style={{ marginBottom:16 }}>Add section</h2>
              <form onSubmit={addSection} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="lbl">Department *</label>
                  <select className="inp" value={secForm.department} onChange={e => setSecForm(f=>({...f,department:e.target.value,specialisation:''}))} required>
                    <option value="">Select department</option>
                    {depts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                {secSpecOptions.length > 0 && (
                  <div>
                    <label className="lbl">Specialisation</label>
                    <select className="inp" value={secForm.specialisation} onChange={e => setSecForm(f=>({...f,specialisation:e.target.value}))}>
                      <option value="">None / Core</option>
                      {secSpecOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="lbl">Year *</label>
                  <select className="inp" value={secForm.year_label} onChange={e => setSecForm(f=>({...f,year_label:e.target.value}))} required>
                    <option value="">Select year</option>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="lbl">Section code *</label>
                  <input className="inp" placeholder="e.g. A or B" value={secForm.section_code} onChange={e => setSecForm(f=>({...f,section_code:e.target.value}))} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={secLoading}>
                  {secLoading ? <><span className="spin"/>Adding...</> : '+ Add section'}
                </button>
              </form>
            </div>

            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', fontSize:13, fontWeight:500 }}>All sections ({sections.length})</div>
              {sections.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--t3)' }}>No sections yet.</div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>Section</th><th>Dept</th><th>Spec</th><th>Year</th><th></th></tr></thead>
                  <tbody>
                    {sections.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight:600, fontFamily:'monospace', fontSize:13 }}>{s.section_code}</td>
                        <td style={{ fontSize:12 }}>{s.department}</td>
                        <td style={{ fontSize:12, color:'var(--t3)' }}>{s.specialisation || '—'}</td>
                        <td style={{ fontSize:12, color:'var(--t3)' }}>{s.year_label}</td>
                        <td><button className="btn btn-danger btn-sm" onClick={() => deleteSection(s.id)}>Del</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TIMETABLE ── */}
        {tab === 'timetable' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:20, alignItems:'start' }}>
            <div className="card card-p">
              <h2 style={{ marginBottom:4 }}>{editEntry ? 'Edit entry' : 'Add entry'}</h2>
              <p style={{ fontSize:12, color:'var(--t3)', marginBottom:16 }}>Which teacher has which class</p>
              <form onSubmit={saveTTEntry} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div>
                  <label className="lbl">Section *</label>
                  <select className="inp" value={ttForm.section_id} onChange={e => setTtForm(f=>({...f,section_id:e.target.value}))} required>
                    <option value="">Select section</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label className="lbl">Day *</label>
                    <select className="inp" value={ttForm.day_of_week} onChange={e => setTtForm(f=>({...f,day_of_week:e.target.value}))}>
                      {DAYS.map((d,i) => <option key={i+1} value={i+1}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="lbl">Slot *</label>
                    <select className="inp" value={ttForm.slot_id} onChange={e => setTtForm(f=>({...f,slot_id:e.target.value}))}>
                      {SLOTS.map(s => <option key={s.id} value={s.id}>{s.label} ({s.time})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="lbl">Subject *</label>
                  <input className="inp" placeholder="e.g. Data Structures" value={ttForm.subject_name} onChange={e => setTtForm(f=>({...f,subject_name:e.target.value}))} required />
                </div>
                <div>
                  <label className="lbl">Teacher *</label>
                  {teachers.length === 0 ? (
                    <div style={{ padding:'10px 12px', background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:'var(--r)', fontSize:12, color:'var(--t3)' }}>
                      No teachers found. <Link href="/admin/teachers" style={{ color:'var(--accent-2)' }}>Add teachers first →</Link>
                    </div>
                  ) : (
                    <select className="inp" value={ttForm.teacher_id} onChange={e => setTtForm(f=>({...f,teacher_id:e.target.value}))} required>
                      <option value="">Select teacher</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}{t.designation ? ` · ${t.designation}` : ''}{t.department ? ` (${t.department})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {ttForm.teacher_id && (() => {
                    const t = teachers.find(tc => tc.id === ttForm.teacher_id)
                    return t ? <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>{t.email}</div> : null
                  })()}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn btn-primary" style={{ flex:1 }} type="submit" disabled={ttLoading}>
                    {ttLoading ? <><span className="spin"/>Saving...</> : editEntry ? 'Update' : 'Save entry'}
                  </button>
                  {editEntry && <button type="button" className="btn btn-ghost" onClick={() => setEditEntry(null)}>Cancel</button>}
                </div>
              </form>
            </div>

            <div className="card" style={{ overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ fontSize:13, fontWeight:500, flex:1 }}>Entries ({visibleEntries.length})</span>
                <select className="inp" value={selSection} onChange={e => setSelSection(e.target.value)} style={{ width:160, height:32 }}>
                  <option value="">All sections</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
                <select className="inp" value={selDay} onChange={e => setSelDay(parseInt(e.target.value))} style={{ width:120, height:32 }}>
                  <option value={0}>All days</option>
                  {DAYS.map((d,i) => <option key={i+1} value={i+1}>{d}</option>)}
                </select>
              </div>
              {visibleEntries.length === 0 ? (
                <div style={{ padding:32, textAlign:'center', fontSize:13, color:'var(--t3)' }}>No entries. Add one.</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table className="tbl">
                    <thead><tr><th>Section</th><th>Day</th><th>Slot</th><th>Subject</th><th>Teacher</th><th></th></tr></thead>
                    <tbody>
                      {visibleEntries.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontSize:12, fontWeight:500 }}>{sections.find(s=>s.id===e.section_id)?.display_name || '—'}</td>
                          <td style={{ fontSize:12, color:'var(--t3)' }}>{DAYS[e.day_of_week-1]}</td>
                          <td><span className="badge badge-gray" style={{ fontSize:10 }}>{SLOTS.find(s=>s.id===e.slot_id)?.label}</span></td>
                          <td style={{ fontSize:12 }}>{e.subject_name}</td>
                          <td style={{ fontSize:12 }}>
                            <div>{e.teacher_name}</div>
                            <div style={{ fontSize:11, color:'var(--t3)' }}>{e.teacher_email}</div>
                          </td>
                          <td style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => {
                              setEditEntry(e)
                              setTtForm({ section_id:e.section_id, day_of_week:String(e.day_of_week), slot_id:String(e.slot_id), subject_name:e.subject_name, teacher_name:e.teacher_name, teacher_email:e.teacher_email, teacher_id:(e as any).teacher_id || '' })
                            }}>Edit</button>
                            <button className="btn btn-danger btn-sm" onClick={async () => {
                              await supabase.from('timetable_entries').delete().eq('id', e.id)
                              toast.success('Deleted'); await loadAll()
                            }}>Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
