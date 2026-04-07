'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

// SRM slot times → slot DB id
const SLOT_MAP: Record<string, number> = {
  '9:30':  1, '09:30': 1,
  '10:20': 2,
  '11:20': 3,
  '12:10': 4,
  '14:10': 5, '2:10': 5,
  '15:00': 6, '3:00': 6,
}

const DAY_MAP: Record<string, number> = {
  MON:1, TUE:2, WED:3, THU:4, FRI:5,
  MONDAY:1, TUESDAY:2, WEDNESDAY:3, THURSDAY:4, FRIDAY:5,
}

// Slots in order
const SLOT_COLS = [1,2,3,4,5,6]

interface ParsedEntry {
  day: number
  dayName: string
  slot_id: number
  subject_code: string
  subject_name: string
  teacher_name: string
  teacher_email: string
  matched_teacher_id: string | null
  warning?: string
}

interface ParseResult {
  section_info: {
    department: string
    specialisation: string
    year_label: string
    section_code: string
  }
  entries: ParsedEntry[]
  unmatched_teachers: string[]
  raw_subject_map: Record<string, { name: string; teacher: string }>
}

interface Section { id:string; department:string; specialisation:string; year_label:string; section_code:string; display_name:string }
interface Teacher { id:string; full_name:string; email:string; designation:string; department:string }

export default function TimetableImportPage() {
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [sections,  setSections]  = useState<Section[]>([])
  const [teachers,  setTeachers]  = useState<Teacher[]>([])
  const [loading,   setLoading]   = useState(true)
  const [step,      setStep]      = useState<'upload'|'map'|'preview'|'done'>('upload')
  const [parsed,    setParsed]    = useState<ParseResult | null>(null)
  const [selectedSection, setSelectedSection] = useState('')
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({}) // parsed teacher name → teacher DB id
  const [importing, setImporting]  = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || (p.role !== 'faculty' && p.role !== 'hod')) { router.push('/dashboard/student'); return }
      setProfile(p)
      const [s, t] = await Promise.all([
        supabase.from('sections').select('*').order('display_name'),
        supabase.from('teachers').select('*').order('full_name'),
      ])
      setSections(s.data || [])
      setTeachers(t.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Try to auto-match a teacher name from Excel to DB
  function findTeacher(name: string): Teacher | null {
    if (!name) return null
    const n = name.toLowerCase().replace(/^(dr\.|mr\.|ms\.|prof\.)\s*/i, '').trim()
    return teachers.find(t => {
      const tn = t.full_name.toLowerCase().replace(/^(dr\.|mr\.|ms\.|prof\.)\s*/i, '').trim()
      return tn === n || tn.includes(n) || n.includes(tn)
    }) || null
  }

  async function handleFile(file: File) {
    if (!file) return
    const XLSX = await import('xlsx')
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // ── 1. Extract section info from header rows ──
    let department = '', specialisation = '', year_label = '', section_code = ''

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const line = rows[i].join(' ').toUpperCase()

      // "Department- CSE- DSBS" or "Department-CSE"
      const deptMatch = line.match(/DEPARTMENT[-:\s]+([A-Z\s\-]+)/i)
      if (deptMatch) {
        const parts = deptMatch[1].split(/[-\s]+/).filter(Boolean)
        department = parts[0] || ''
        specialisation = parts.slice(1).join(' ') || ''
      }

      // "YEAR / SEM / SEC : III /VI / B" or "YEAR/SEM/SEC: 3/6/B"
      const yearMatch = line.match(/YEAR\s*[\/\s]+SEM\s*[\/\s]+SEC\s*[:=\s]+([IVX\d]+)\s*[\/\s]+([IVX\d]+)\s*[\/\s]+([A-Z])/i)
      if (yearMatch) {
        const y = yearMatch[1]
        section_code = yearMatch[3].toUpperCase()
        // Convert roman or number to year label
        const romanMap: Record<string,string> = { I:'1st Year', II:'2nd Year', III:'3rd Year', IV:'4th Year', '1':'1st Year', '2':'2nd Year', '3':'3rd Year', '4':'4th Year' }
        year_label = romanMap[y.trim()] || `${y} Year`
      }
    }

    // ── 2. Find the timetable grid ──
    // Look for the row with TIME or day names
    let gridStartRow = -1
    let slotColumns: number[] = [] // column indices for slots 1-6

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowStr = row.join(' ').toUpperCase()
      if (rowStr.includes('9:30') || rowStr.includes('TIME') || rowStr.match(/10:20|11:20|12:10/)) {
        gridStartRow = i
        // Map column indices to slot IDs
        row.forEach((cell: any, colIdx: number) => {
          const cellStr = String(cell).trim()
          // Match time like "9:30 - 10:20" or "9:30"
          const timeMatch = cellStr.match(/(\d{1,2}:\d{2})/)
          if (timeMatch) {
            const slotId = SLOT_MAP[timeMatch[1]]
            if (slotId) slotColumns[colIdx] = slotId
          }
        })
        break
      }
    }

    if (gridStartRow === -1 || slotColumns.filter(Boolean).length === 0) {
      toast.error('Could not find timetable grid. Check the Excel format.')
      return
    }

    // ── 3. Parse day rows ──
    const timetableEntries: Record<string, string> = {} // "dayNum_slotId" → subject_code

    for (let i = gridStartRow + 1; i < rows.length; i++) {
      const row = rows[i]
      const dayCell = String(row[0]).trim().toUpperCase().replace(/\./g, '')
      const dayNum = DAY_MAP[dayCell]
      if (!dayNum) continue

      // For each slot column, extract the subject code
      slotColumns.forEach((slotId, colIdx) => {
        if (!slotId) return
        const cell = String(row[colIdx] || '').trim()
        // Subject codes match pattern like 21CSC303J, 21EEO304T etc.
        // Also skip BREAK letters (B,R,E,A,K) and LUNCH (L,U,N,C,H)
        if (cell && cell.length > 3 && /\d/.test(cell) && !cell.includes('Lab') && !cell.includes('Placement')) {
          // Handle merged cells like "21CSC304J Lab C-12" - take just the code
          const codeMatch = cell.match(/([A-Z]{2,}\d{4,}[A-Z]?)/)
          if (codeMatch) {
            timetableEntries[`${dayNum}_${slotId}`] = codeMatch[1]
          }
        }
      })
    }

    // ── 4. Find subject-teacher table ──
    // Look for "SUBJECT CODE" header row
    let subjectTableRow = -1
    for (let i = gridStartRow; i < rows.length; i++) {
      const rowStr = rows[i].join(' ').toUpperCase()
      if (rowStr.includes('SUBJECT CODE') && rowStr.includes('FACULTY')) {
        subjectTableRow = i
        break
      }
    }

    const subjectMap: Record<string, { name: string; teacher: string }> = {}

    if (subjectTableRow !== -1) {
      const headerRow = rows[subjectTableRow]
      // Find column indices
      let codeCol = 0, nameCol = 1, facultyCol = -1
      headerRow.forEach((h: any, idx: number) => {
        const hs = String(h).toUpperCase()
        if (hs.includes('SUBJECT CODE')) codeCol = idx
        if (hs.includes('SUBJECT NAME')) nameCol = idx
        if (hs.includes('FACULTY') || hs.includes('TEACHER')) facultyCol = idx
      })

      for (let i = subjectTableRow + 1; i < rows.length; i++) {
        const row = rows[i]
        const code    = String(row[codeCol] || '').trim()
        const name    = String(row[nameCol] || '').trim()
        const faculty = facultyCol >= 0 ? String(row[facultyCol] || '').trim() : ''
        if (code && code.length > 3 && /\d/.test(code)) {
          subjectMap[code] = { name: name || code, teacher: faculty }
        }
      }
    }

    // ── 5. Build final entries ──
    const entries: ParsedEntry[] = []
    const unmatchedSet = new Set<string>()
    const initTeacherMap: Record<string, string> = {}

    for (const [key, code] of Object.entries(timetableEntries)) {
      const [dayStr, slotStr] = key.split('_')
      const day    = parseInt(dayStr)
      const slotId = parseInt(slotStr)
      const dayNames = ['','Mon','Tue','Wed','Thu','Fri']
      const sub = subjectMap[code]

      const teacherName  = sub?.teacher || ''
      const subjectName  = sub?.name    || code
      const matched      = findTeacher(teacherName)

      if (teacherName && !matched) unmatchedSet.add(teacherName)
      if (teacherName && matched) initTeacherMap[teacherName] = matched.id

      entries.push({
        day, dayName: dayNames[day], slot_id: slotId,
        subject_code: code, subject_name: subjectName,
        teacher_name: teacherName, teacher_email: matched?.email || '',
        matched_teacher_id: matched?.id || null,
        warning: teacherName && !matched ? `Teacher "${teacherName}" not found in DB` : undefined,
      })
    }

    entries.sort((a,b) => a.day - b.day || a.slot_id - b.slot_id)

    setParsed({
      section_info: { department, specialisation, year_label, section_code },
      entries,
      unmatched_teachers: Array.from(unmatchedSet),
      raw_subject_map: subjectMap,
    })
    setTeacherMap(initTeacherMap)

    // Auto-select matching section
    const matchSec = sections.find(s =>
      s.department.toLowerCase() === department.toLowerCase() &&
      s.year_label === year_label &&
      s.section_code.toUpperCase() === section_code.toUpperCase()
    )
    if (matchSec) setSelectedSection(matchSec.id)

    setStep(unmatchedSet.size > 0 ? 'map' : 'preview')
    toast.success(`Parsed ${entries.length} timetable entries`)
  }

  async function doImport() {
    if (!selectedSection) { toast.error('Select a section first'); return }
    if (!parsed) return
    setImporting(true)
    let count = 0

    for (const entry of parsed.entries) {
      const teacherId = entry.matched_teacher_id || teacherMap[entry.teacher_name] || null
      const teacher   = teachers.find(t => t.id === teacherId)
      if (!teacher) continue // skip entries with no teacher matched

      const { error } = await supabase.from('timetable_entries').upsert({
        section_id:    selectedSection,
        day_of_week:   entry.day,
        slot_id:       entry.slot_id,
        subject_name:  entry.subject_name,
        teacher_name:  teacher.full_name,
        teacher_email: teacher.email,
        teacher_id:    teacher.id,
      }, { onConflict: 'section_id,day_of_week,slot_id' })

      if (!error) count++
    }

    setImportedCount(count)
    setImporting(false)
    setStep('done')
    toast.success(`Imported ${count} timetable entries!`)
  }

  const DAYS = ['','Mon','Tue','Wed','Thu','Fri']
  const SLOT_LABELS = ['','9:30–10:20','10:20–11:10','11:20–12:10','12:10–1:00','2:10–3:00','3:00–3:50']

  if (loading || !profile) return null

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop:32, paddingBottom:60 }}>
        <div style={{ marginBottom:20 }}>
          <Link href="/admin/timetable" style={{ fontSize:12, color:'var(--t3)', textDecoration:'none', display:'inline-block', marginBottom:8 }}>← Timetable</Link>
          <h1>Import Timetable from Excel</h1>
          <p style={{ fontSize:13, color:'var(--t3)', marginTop:4 }}>Upload SRM format timetable Excel/PDF — auto-parses section, slots, subjects and teachers</p>
        </div>

        {/* Steps indicator */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:28 }}>
          {[
            { k:'upload',  n:'1', l:'Upload file' },
            { k:'map',     n:'2', l:'Map teachers' },
            { k:'preview', n:'3', l:'Preview & import' },
            { k:'done',    n:'4', l:'Done' },
          ].map((s, i, arr) => (
            <div key={s.k} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, background: step === s.k ? 'var(--accent)' : ['upload','map','preview','done'].indexOf(step) > i ? 'rgba(16,185,129,0.2)' : 'var(--bg-3)', color: step === s.k ? '#fff' : ['upload','map','preview','done'].indexOf(step) > i ? '#34d399' : 'var(--t3)', border: step === s.k ? 'none' : '1px solid var(--line)' }}>
                  {['upload','map','preview','done'].indexOf(step) > i ? '✓' : s.n}
                </div>
                <span style={{ fontSize:12, color: step === s.k ? 'var(--t1)' : 'var(--t3)', fontWeight: step === s.k ? 600 : 400 }}>{s.l}</span>
              </div>
              {i < arr.length-1 && <div style={{ width:24, height:1, background:'var(--line)' }} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: UPLOAD ── */}
        {step === 'upload' && (
          <div style={{ maxWidth:560 }}>
            <div className="card card-p">
              <h2 style={{ marginBottom:6 }}>Upload timetable file</h2>
              <p style={{ fontSize:13, color:'var(--t3)', marginBottom:20, lineHeight:1.6 }}>
                Supports <strong>.xlsx</strong> and <strong>.xls</strong> format. The file should be in SRM standard format with:
                department/section info at top, timetable grid with slot times, and subject-teacher table below.
              </p>

              <div
                style={{ border:'2px dashed var(--line-2)', borderRadius:'var(--r2)', padding:'32px', textAlign:'center', cursor:'pointer', transition:'border-color 0.15s' }}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as any).style.borderColor='var(--accent-2)' }}
                onDragLeave={e => { (e.currentTarget as any).style.borderColor='var(--line-2)' }}
                onDrop={async e => {
                  e.preventDefault()
                  ;(e.currentTarget as any).style.borderColor='var(--line-2)'
                  const file = e.dataTransfer.files[0]
                  if (file) await handleFile(file)
                }}
                onClick={() => fileRef.current?.click()}
              >
                <div style={{ fontSize:32, marginBottom:10 }}>📊</div>
                <div style={{ fontSize:14, fontWeight:500, marginBottom:4 }}>Drop Excel file here</div>
                <div style={{ fontSize:12, color:'var(--t3)', marginBottom:16 }}>or click to browse</div>
                <span className="badge badge-gray">.xlsx / .xls</span>
              </div>

              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

              <div style={{ marginTop:16, padding:'12px 14px', background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:'var(--r)', fontSize:12, color:'var(--t3)', lineHeight:1.7 }}>
                <strong style={{ color:'var(--t2)' }}>Expected format:</strong><br />
                • Header rows with Department and Year/Sem/Sec info<br />
                • Timetable grid: Days (MON-FRI) × Slots with subject codes<br />
                • Subject table below with: Subject Code | Subject Name | Faculty Name
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: MAP UNMATCHED TEACHERS ── */}
        {step === 'map' && parsed && (
          <div style={{ maxWidth:680 }}>
            <div className="card card-p" style={{ marginBottom:16 }}>
              <h2 style={{ marginBottom:4 }}>Map unmatched teachers</h2>
              <p style={{ fontSize:13, color:'var(--t3)', marginBottom:20 }}>
                These teacher names from the Excel couldn't be auto-matched to your teachers database. Select the correct teacher for each.
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {parsed.unmatched_teachers.map(name => (
                  <div key={name} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--bg-2)', border:'1px solid var(--line)', borderRadius:'var(--r)' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{name}</div>
                      <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>from Excel — not found in DB</div>
                    </div>
                    <select className="inp" style={{ width:260, height:34 }}
                      value={teacherMap[name] || ''}
                      onChange={e => setTeacherMap(m => ({ ...m, [name]: e.target.value }))}>
                      <option value="">Skip this teacher</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name} · {t.email}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button className="btn btn-primary" style={{ flex:1 }} onClick={() => {
                  // Apply mappings to entries
                  if (parsed) {
                    const updated = parsed.entries.map(e => ({
                      ...e,
                      matched_teacher_id: e.matched_teacher_id || teacherMap[e.teacher_name] || null,
                    }))
                    setParsed({ ...parsed, entries: updated })
                  }
                  setStep('preview')
                }}>Continue to preview →</button>
                <button className="btn btn-ghost" onClick={() => setStep('preview')}>Skip mapping</button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: PREVIEW ── */}
        {step === 'preview' && parsed && (
          <div>
            {/* Section selector */}
            <div className="card card-p" style={{ marginBottom:16, maxWidth:680 }}>
              <h2 style={{ marginBottom:4 }}>Confirm section</h2>
              <p style={{ fontSize:13, color:'var(--t3)', marginBottom:12 }}>
                Parsed from file: <strong style={{ color:'var(--t1)' }}>{parsed.section_info.department} {parsed.section_info.specialisation} {parsed.section_info.year_label} {parsed.section_info.section_code}</strong>
              </p>
              <div>
                <label className="lbl">Map to section in database *</label>
                <select className="inp" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} required>
                  <option value="">Select section</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.display_name}</option>)}
                </select>
                {!selectedSection && <div style={{ fontSize:11, color:'#f87171', marginTop:4 }}>⚠ Section not auto-matched. Please select manually.</div>}
              </div>
            </div>

            {/* Preview table */}
            <div className="card" style={{ overflow:'hidden', marginBottom:16 }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:13, fontWeight:500 }}>
                  {parsed.entries.filter(e => e.matched_teacher_id || teacherMap[e.teacher_name]).length} of {parsed.entries.length} entries will be imported
                </span>
                <span style={{ fontSize:11, color:'var(--t3)' }}>
                  {parsed.entries.filter(e => !e.matched_teacher_id && !teacherMap[e.teacher_name]).length} skipped (no teacher match)
                </span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Day</th><th>Slot</th><th>Subject code</th><th>Subject name</th><th>Teacher</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {parsed.entries.map((e, i) => {
                      const tid = e.matched_teacher_id || teacherMap[e.teacher_name]
                      const teacher = teachers.find(t => t.id === tid)
                      const willImport = !!teacher
                      return (
                        <tr key={i} style={{ opacity: willImport ? 1 : 0.4 }}>
                          <td style={{ fontWeight:500, fontSize:12 }}>{e.dayName}</td>
                          <td><span className="badge badge-gray" style={{ fontSize:10 }}>Slot {e.slot_id}<br/><span style={{ fontSize:9, color:'var(--t4)' }}>{SLOT_LABELS[e.slot_id]}</span></span></td>
                          <td style={{ fontFamily:'monospace', fontSize:11, color:'var(--t3)' }}>{e.subject_code}</td>
                          <td style={{ fontSize:12 }}>{e.subject_name}</td>
                          <td style={{ fontSize:12 }}>
                            {teacher ? (
                              <div>
                                <div style={{ fontWeight:500 }}>{teacher.full_name}</div>
                                <div style={{ fontSize:10, color:'var(--t3)' }}>{teacher.email}</div>
                              </div>
                            ) : (
                              <span style={{ fontSize:11, color:'var(--t3)' }}>{e.teacher_name || '—'}</span>
                            )}
                          </td>
                          <td>
                            {willImport
                              ? <span className="badge badge-green" style={{ fontSize:10 }}>✓ Import</span>
                              : <span className="badge badge-gray" style={{ fontSize:10 }}>Skip</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display:'flex', gap:8, maxWidth:680 }}>
              <button className="btn btn-primary btn-lg" style={{ flex:1 }} onClick={doImport} disabled={importing || !selectedSection}>
                {importing ? <><span className="spin"/>Importing...</> : `Import timetable →`}
              </button>
              <button className="btn btn-ghost btn-lg" onClick={() => setStep('map')}>← Back</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: DONE ── */}
        {step === 'done' && (
          <div style={{ maxWidth:480 }}>
            <div className="card card-p" style={{ textAlign:'center' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:22 }}>✓</div>
              <h2 style={{ marginBottom:6 }}>Import complete!</h2>
              <p style={{ fontSize:13, color:'var(--t3)', marginBottom:24, lineHeight:1.6 }}>
                Successfully imported <strong style={{ color:'var(--t1)' }}>{importedCount} timetable entries</strong> for the selected section.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <Link href="/admin/timetable"><button className="btn btn-primary btn-full">View timetable →</button></Link>
                <button className="btn btn-ghost btn-full" onClick={() => { setStep('upload'); setParsed(null); setSelectedSection(''); setTeacherMap({}); if (fileRef.current) fileRef.current.value = '' }}>
                  Import another file
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
