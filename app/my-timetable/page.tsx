'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import type { Profile } from '@/lib/types'

const DAYS  = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const SLOTS = [
  { id: 1, label: 'Slot 1', time: '9:30 – 10:20'  },
  { id: 2, label: 'Slot 2', time: '10:20 – 11:10' },
  { id: 3, label: 'Slot 3', time: '11:20 – 12:10' },
  { id: 4, label: 'Slot 4', time: '12:10 – 1:00'  },
  { id: 5, label: 'Slot 5', time: '2:10 – 3:00'   },
  { id: 6, label: 'Slot 6', time: '3:00 – 3:50'   },
]

interface TTEntry {
  id: string
  section_id: string
  day_of_week: number
  slot_id: number
  subject_name: string
  teacher_name: string
  teacher_email: string
}
interface Section { id: string; display_name: string; department: string; year_label: string }

export default function MyTimetablePage() {
  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [entries,  setEntries]  = useState<TTEntry[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [loading,  setLoading]  = useState(true)
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || (p.role !== 'faculty' && p.role !== 'hod')) {
        router.push('/dashboard/student'); return
      }
      setProfile(p)

      // Load only this teacher's entries, matched by email
      const [{ data: ents }, { data: secs }] = await Promise.all([
        supabase
          .from('timetable_entries')
          .select('*')
          .eq('teacher_email', p.email)
          .order('day_of_week')
          .order('slot_id'),
        supabase.from('sections').select('id,display_name,department,year_label'),
      ])
      setEntries(ents || [])
      setSections(secs || [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !profile) return null

  // Group entries by day
  const byDay: Record<number, TTEntry[]> = {}
  for (const e of entries) {
    if (!byDay[e.day_of_week]) byDay[e.day_of_week] = []
    byDay[e.day_of_week].push(e)
  }

  const activeDays = [1, 2, 3, 4, 5].filter(d => byDay[d]?.length)

  return (
    <div className="page">
      <Navbar profile={profile} />
      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ marginBottom: 4 }}>My Timetable</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)' }}>
            Your classes this week · {entries.length} slot{entries.length !== 1 ? 's' : ''} assigned
          </p>
        </div>

        {/* Slot legend */}
        <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--r2)', padding: '10px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t3)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>SRM Slot Times</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 18px', fontSize: 12, color: 'var(--t2)' }}>
            {SLOTS.map(s => (
              <span key={s.id}><span style={{ color: 'var(--t4)' }}>{s.label}:</span> {s.time}</span>
            ))}
            <span style={{ color: 'var(--t4)' }}>Break 11:10–11:20 · Lunch 1:00–2:10</span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="card card-p" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 6 }}>No classes assigned yet</div>
            <div style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.6 }}>
              Your timetable will appear here once the admin assigns you to a section.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeDays.map(day => (
              <div key={day} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{DAYS[day]}</span>
                  <span className="badge badge-gray" style={{ fontSize: 10 }}>{byDay[day].length} class{byDay[day].length !== 1 ? 'es' : ''}</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Slot</th>
                        <th>Time</th>
                        <th>Subject</th>
                        <th>Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byDay[day]
                        .sort((a, b) => a.slot_id - b.slot_id)
                        .map(entry => {
                          const slot    = SLOTS.find(s => s.id === entry.slot_id)
                          const section = sections.find(s => s.id === entry.section_id)
                          return (
                            <tr key={entry.id}>
                              <td>
                                <span className="badge badge-gray" style={{ fontSize: 11 }}>{slot?.label ?? `Slot ${entry.slot_id}`}</span>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{slot?.time ?? '—'}</td>
                              <td style={{ fontWeight: 500, fontSize: 13 }}>{entry.subject_name}</td>
                              <td style={{ fontSize: 12 }}>
                                {section ? (
                                  <div>
                                    <div style={{ fontWeight: 500 }}>{section.display_name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{section.department} · {section.year_label}</div>
                                  </div>
                                ) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
