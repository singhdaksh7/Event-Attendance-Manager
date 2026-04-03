'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { generateSlipId } from '@/lib/qr'
import type { Profile, Event, EventRegistration } from '@/lib/types'

export default function ScannerPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [scanned, setScanned] = useState<{ reg: EventRegistration; justMarked: boolean }[]>([])
  const [allRegs, setAllRegs] = useState<EventRegistration[]>([])
  const [scanning, setScanning] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [attendedCount, setAttendedCount] = useState(0)
  const [lastScanTime, setLastScanTime] = useState(0)   // debounce rapid scans
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const eventId = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || p.role !== 'student') { router.push('/dashboard/student'); return }
      setProfile(p)
      const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).eq('organizer_id', user.id).single()
      if (!ev) { toast.error('You are not the organiser of this event'); router.push('/dashboard/student'); return }
      setEvent(ev)
      const { data: regs } = await supabase.from('event_registrations').select('*').eq('event_id', eventId)
      setAllRegs(regs || [])
      setAttendedCount((regs || []).filter(r => r.attended).length)
    }
    load()
  }, [eventId])

  const processQR = useCallback(async (raw: string) => {
    // Debounce: ignore duplicate scans within 2 seconds
    const now = Date.now()
    if (now - lastScanTime < 2000) return
    setLastScanTime(now)

    // Parse QR data
    let registrationId = ''
    let regNumber = ''
    try {
      const parsed = JSON.parse(raw.trim())
      if (parsed.type !== 'attendance' || !parsed.registrationId) {
        toast.error('Invalid QR — not an attendance code')
        return
      }
      registrationId = parsed.registrationId
      regNumber      = parsed.regNumber
    } catch {
      toast.error('Cannot read QR code data')
      return
    }

    // Fetch the registration
    const { data: reg, error } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('id', registrationId)
      .eq('event_id', eventId)
      .single()

    if (error || !reg) {
      toast.error('Student not registered for this event')
      return
    }

    if (reg.attended) {
      toast(`${reg.full_name} already marked present ✅`, { duration: 2000 })
      setScanned(prev => [{ reg, justMarked: false }, ...prev.filter(s => s.reg.id !== reg.id)])
      return
    }

    // Mark attendance
    const now2 = new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('event_registrations')
      .update({ attended: true, attended_at: now2, od_status: 'pending' })
      .eq('id', reg.id)

    if (updateErr) {
      toast.error('Failed to mark attendance: ' + updateErr.message)
      return
    }

    // Auto-create OD request
    const { data: evData } = await supabase
      .from('events').select('faculty_id, hod_id').eq('id', eventId).single()

    const { error: odErr } = await supabase.from('od_requests').insert({
      registration_id:    reg.id,
      event_id:           eventId,
      student_reg_number: reg.reg_number,
      faculty_id:         evData?.faculty_id || null,
      hod_id:             evData?.hod_id     || null,
      slip_id:            generateSlipId(),
    })

    if (odErr) console.warn('OD insert error:', odErr.message)

    const updatedReg = { ...reg, attended: true, attended_at: now2, od_status: 'pending' as const }
    setScanned(prev => [{ reg: updatedReg, justMarked: true }, ...prev])
    setAttendedCount(c => c + 1)
    toast.success(`✅ ${reg.full_name} marked present!`)
  }, [eventId, supabase, lastScanTime])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanning(true)
      setCameraError('')

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0) await processQR(codes[0].rawValue)
          } catch {}
        }, 500)
      } else {
        setCameraError('Auto QR detection not supported in this browser. Use the manual input field below.')
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. Use manual input below.')
    }
  }

  function stopCamera() {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    setScanning(false)
  }

  useEffect(() => () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current)
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }, [])

  if (!profile || !event) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t4)' }}>Loading scanner...</div>
    </div>
  )

  return (
    <div className="page-bg min-h-screen">
      <Navbar profile={profile} />
      <div className="container-app" style={{ paddingTop: '2rem', paddingBottom: '4rem', maxWidth: 600 }}>
        <Link href="/dashboard/student" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>← Dashboard</Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Attendance Scanner</h1>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: '1.75rem' }}>{event.title} · {event.venue}</p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: '1.5rem' }}>
          {[
            { l: 'Total registered', v: allRegs.length,                      c: 'var(--t1)' },
            { l: 'Present',          v: attendedCount,                        c: 'var(--teal-light)' },
            { l: 'Absent',           v: allRegs.length - attendedCount,       c: '#fbbf24' },
          ].map(s => (
            <div key={s.l} className="stat-card">
              <div className="stat-num" style={{ color: s.c }}>{s.v}</div>
              <div className="stat-lbl">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Camera scanner */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Camera scanner</div>

          {!scanning ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              {cameraError && (
                <div style={{ fontSize: 12, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, lineHeight: 1.5 }}>
                  ⚠️ {cameraError}
                </div>
              )}
              <button className="btn btn-primary" onClick={startCamera}>📷 Open camera</button>
              <p style={{ fontSize: 12, color: 'var(--t4)', marginTop: 10 }}>Opens rear camera to scan student QR codes</p>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', aspectRatio: '4/3', marginBottom: 10 }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {/* Scan overlay */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: 160, height: 160, position: 'relative' }}>
                    {/* Corners */}
                    {[
                      { top: 0, left: 0, borderWidth: '3px 0 0 3px', borderRadius: '4px 0 0 0' },
                      { top: 0, right: 0, borderWidth: '3px 3px 0 0', borderRadius: '0 4px 0 0' },
                      { bottom: 0, left: 0, borderWidth: '0 0 3px 3px', borderRadius: '0 0 0 4px' },
                      { bottom: 0, right: 0, borderWidth: '0 3px 3px 0', borderRadius: '0 0 4px 0' },
                    ].map((s, i) => (
                      <div key={i} style={{ position: 'absolute', width: 28, height: 28, borderColor: '#2dd4bf', borderStyle: 'solid', ...s }} />
                    ))}
                    {/* Scan line */}
                    <div className="scan-line" style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,#2dd4bf,transparent)', animation: 'scan-line 2s ease-in-out infinite', boxShadow: '0 0 6px #2dd4bf' }} />
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Point at student's QR code
                </div>
              </div>
              <button className="btn btn-ghost btn-sm btn-full" onClick={stopCamera}>Stop camera</button>
            </div>
          )}
        </div>

        {/* Manual input */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Manual QR input</div>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
            Students can also tap "Copy QR data" on their registration page and paste it here.
          </p>
          <form onSubmit={async e => {
            e.preventDefault()
            const val = manualInput.trim()
            if (!val) return
            await processQR(val)
            setManualInput('')
          }} style={{ display: 'flex', gap: 8 }}>
            <input
              className="inp"
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              placeholder='{"type":"attendance","registrationId":"...","regNumber":"..."}'
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
            />
            <button className="btn btn-primary btn-sm" type="submit">Mark present</button>
          </form>
        </div>

        {/* Recent scans */}
        {scanned.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              Scanned this session ({scanned.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scanned.map(({ reg, justMarked }) => (
                <div key={reg.id} className={`card fade-in`} style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 12, borderColor: justMarked ? 'rgba(45,212,191,0.25)' : 'var(--border-dim)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: justMarked ? 'rgba(45,212,191,0.12)' : 'var(--bg-overlay)', border: `1px solid ${justMarked ? 'rgba(45,212,191,0.3)' : 'var(--border-dim)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: justMarked ? 'var(--teal-light)' : 'var(--indigo-light)', flexShrink: 0 }}>
                    {reg.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{reg.full_name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{reg.reg_number} · {reg.department}</div>
                  </div>
                  <span className={`badge ${justMarked ? 'badge-teal' : 'badge-gray'}`}>
                    {justMarked ? '✓ Marked now' : 'Already present'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes scan-line {
          0%, 100% { transform: translateY(-64px); opacity: 0; }
          15%, 85%  { opacity: 1; }
          50%       { transform: translateY(64px); }
        }
      `}</style>
    </div>
  )
}
