'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'
import { generateSlipId } from '@/lib/qr'
import { scheduleODNotifications } from '@/lib/notifications'
import type { Profile, Event, EventRegistration } from '@/lib/types'

type ScannedEntry = { reg: EventRegistration; justMarked: boolean }

export default function ScannerPage() {
  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [event,         setEvent]         = useState<Event | null>(null)
  const [allRegs,       setAllRegs]       = useState<EventRegistration[]>([])
  const [scanned,       setScanned]       = useState<ScannedEntry[]>([])
  const [attendedCount, setAttendedCount] = useState(0)
  const [cameraState,   setCameraState]   = useState<'idle'|'starting'|'active'|'error'>('idle')
  const [cameraMsg,     setCameraMsg]     = useState('')
  const [manualInput,   setManualInput]   = useState('')
  const [processing,    setProcessing]    = useState(false)

  // These refs are ALWAYS mounted — never conditionally rendered
  const videoRef   = useRef<HTMLVideoElement>(null)
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const rafRef     = useRef<number>(0)
  const lastScanRef = useRef<number>(0)

  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const eventId  = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/auth/login'); return }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p || p.role !== 'student') { router.push('/dashboard/student'); return }
      setProfile(p)
      const { data: ev } = await supabase.from('events').select('*').eq('id', eventId).eq('organizer_id', user.id).single()
      if (!ev) { toast.error('You are not the organiser'); router.push('/dashboard/student'); return }
      setEvent(ev)
      const { data: regs } = await supabase.from('event_registrations').select('*').eq('event_id', eventId)
      setAllRegs(regs || [])
      setAttendedCount((regs || []).filter(r => r.attended).length)
    }
    load()
  }, [eventId])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  async function processQR(raw: string) {
    const now = Date.now()
    if (now - lastScanRef.current < 2500) return
    lastScanRef.current = now
    if (processing) return
    setProcessing(true)
    try {
      let parsed: any
      try { parsed = JSON.parse(raw.trim()) } catch { toast.error('Invalid QR format'); return }
      if (parsed.type !== 'attendance' || !parsed.registrationId) { toast.error('Not a valid attendance QR'); return }

      const { data: reg, error } = await supabase
        .from('event_registrations').select('*')
        .eq('id', parsed.registrationId).eq('event_id', eventId).single()
      if (error || !reg) { toast.error('Student not registered for this event'); return }

      if (reg.attended) {
        toast(`${reg.full_name} already present ✅`, { duration: 2000 })
        setScanned(prev => [{ reg, justMarked: false }, ...prev.filter(s => s.reg.id !== reg.id)])
        return
      }

      const ts = new Date().toISOString()
      const { error: updErr } = await supabase
        .from('event_registrations')
        .update({ attended: true, attended_at: ts, od_status: 'pending' })
        .eq('id', reg.id)
      if (updErr) { toast.error('Failed: ' + updErr.message); return }

      const { data: evData } = await supabase.from('events').select('faculty_id,hod_id').eq('id', eventId).single()
      await supabase.from('od_requests').insert({
        registration_id: reg.id, event_id: eventId,
        student_reg_number: reg.reg_number,
        faculty_id: evData?.faculty_id || null,
        hod_id: evData?.hod_id || null,
        slip_id: generateSlipId(),
      })

      const updated = { ...reg, attended: true, attended_at: ts, od_status: 'pending' as const }
      setScanned(prev => [{ reg: updated, justMarked: true }, ...prev])
      setAttendedCount(c => c + 1)
      toast.success(`✅ ${reg.full_name} — marked present!`)

      // Schedule teacher email notifications (runs async, non-blocking)
      scheduleODNotifications(supabase, eventId).catch(console.error)
    } finally {
      setProcessing(false)
    }
  }

  async function startCamera() {
    setCameraState('starting')
    setCameraMsg('')

    // Small tick so React flushes the render and video element is guaranteed in DOM
    await new Promise(r => setTimeout(r, 50))

    const video  = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) {
      setCameraState('error')
      setCameraMsg('Could not access camera component. Please refresh the page.')
      return
    }

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } }
        })
      } catch {
        // Fallback — any camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true })
      }

      streamRef.current = stream
      video.srcObject = stream

      // Wait for metadata so we know video dimensions before drawing
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Video element error'))
        setTimeout(() => reject(new Error('Camera stream timed out')), 8000)
      })

      await video.play()
      setCameraState('active')

      // Load jsQR lazily
      const jsQR = (await import('jsqr')).default
      const ctx  = canvas.getContext('2d', { willReadFrequently: true })!

      function tick() {
        if (!streamRef.current) return
        if (!video || !canvas) return
        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          canvas.width  = video.videoWidth  || 640
          canvas.height = video.videoHeight || 480
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          })
          if (code?.data) processQR(code.data)
        }
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

    } catch (err: any) {
      console.error('Camera error:', err)
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
      setCameraState('error')
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCameraMsg('Camera permission was denied. Please tap the camera icon in your browser address bar, allow access, then try again.')
      } else if (err?.name === 'NotFoundError') {
        setCameraMsg('No camera found on this device.')
      } else {
        setCameraMsg(err?.message || 'Unknown camera error. Try using manual input below.')
      }
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraState('idle')
  }

  if (!profile || !event) return (
    <div className="page-bg min-h-screen flex items-center justify-center">
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--t4)' }}>Loading...</div>
    </div>
  )

  const isActive = cameraState === 'active'

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
            { l: 'Registered', v: allRegs.length,                c: 'var(--t1)'         },
            { l: 'Present',    v: attendedCount,                  c: 'var(--teal-light)' },
            { l: 'Absent',     v: allRegs.length - attendedCount, c: '#fbbf24'           },
          ].map(s => (
            <div key={s.l} className="stat-card">
              <div className="stat-num" style={{ color: s.c }}>{s.v}</div>
              <div className="stat-lbl">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Camera card */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            Camera QR scanner
          </div>

          {/* Error banner */}
          {cameraState === 'error' && (
            <div style={{ fontSize: 13, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, lineHeight: 1.6 }}>
              ⚠️ {cameraMsg}
            </div>
          )}

          {/* Start / retry button — shown when idle or error */}
          {(cameraState === 'idle' || cameraState === 'error') && (
            <div style={{ textAlign: 'center', padding: '0.5rem 0 1rem' }}>
              <button className="btn btn-primary" onClick={startCamera}>
                📷 {cameraState === 'error' ? 'Try again' : 'Open camera'}
              </button>
              <p style={{ fontSize: 12, color: 'var(--t4)', marginTop: 10 }}>
                Works on Chrome, Safari, Edge — rear camera preferred
              </p>
            </div>
          )}

          {/* Starting spinner */}
          {cameraState === 'starting' && (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: 'bounce 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
              <p style={{ fontSize: 13, color: 'var(--t3)' }}>Starting camera...</p>
            </div>
          )}

          {/* ── Video element — ALWAYS in DOM, hidden when not active ──
              This is the key fix: the ref is always valid so srcObject never throws.  */}
          <div style={{
            display: isActive ? 'block' : 'none',
            position: 'relative', borderRadius: 12, overflow: 'hidden',
            background: '#000', marginBottom: isActive ? 10 : 0,
          }}>
            <video
              ref={videoRef}
              autoPlay playsInline muted
              style={{ width: '100%', display: 'block', maxHeight: 420, objectFit: 'cover' }}
            />

            {/* Scan frame overlay */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: 200, height: 200, position: 'relative' }}>
                {([
                  { top:0,    left:0,  borderWidth:'3px 0 0 3px', borderRadius:'6px 0 0 0' },
                  { top:0,    right:0, borderWidth:'3px 3px 0 0', borderRadius:'0 6px 0 0' },
                  { bottom:0, left:0,  borderWidth:'0 0 3px 3px', borderRadius:'0 0 0 6px' },
                  { bottom:0, right:0, borderWidth:'0 3px 3px 0', borderRadius:'0 0 6px 0' },
                ] as any[]).map((s, i) => (
                  <div key={i} style={{ position: 'absolute', width: 32, height: 32, borderColor: '#2dd4bf', borderStyle: 'solid', boxShadow: '0 0 8px rgba(45,212,191,0.4)', ...s }} />
                ))}
                <div style={{
                  position: 'absolute', left: 16, right: 16, height: 2,
                  background: 'linear-gradient(90deg, transparent, #2dd4bf, transparent)',
                  boxShadow: '0 0 8px #2dd4bf',
                  animation: 'scanline 2s ease-in-out infinite',
                }} />
              </div>
            </div>

            {processing && (
              <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.75)', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#2dd4bf', fontFamily: 'var(--font-mono)' }}>
                Processing...
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
              Point at student's QR code
            </div>
          </div>

          {isActive && (
            <button className="btn btn-ghost btn-sm btn-full" onClick={stopCamera}>
              Stop camera
            </button>
          )}
        </div>

        {/* Hidden canvas for jsQR pixel reading — always in DOM */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Manual input */}
        <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Manual input</div>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
            Student taps <strong style={{ color: 'var(--t2)' }}>Copy QR data</strong> on their registration page → paste here.
          </p>
          <form onSubmit={async e => { e.preventDefault(); const v = manualInput.trim(); if (v) { await processQR(v); setManualInput('') } }}
            style={{ display: 'flex', gap: 8 }}>
            <input className="inp" style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              placeholder='{"type":"attendance","registrationId":"...","regNumber":"..."}'
              value={manualInput} onChange={e => setManualInput(e.target.value)} />
            <button className="btn btn-primary btn-sm" type="submit" disabled={processing}>Mark</button>
          </form>
        </div>

        {/* Scanned list */}
        {scanned.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>
              Scanned this session ({scanned.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {scanned.map(({ reg, justMarked }) => (
                <div key={reg.id} className="card fade-in"
                  style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: 12, borderColor: justMarked ? 'rgba(45,212,191,0.3)' : 'var(--border-dim)' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: justMarked ? 'rgba(45,212,191,0.12)' : 'var(--bg-overlay)', border: `1px solid ${justMarked ? 'rgba(45,212,191,0.3)' : 'var(--border-dim)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: justMarked ? 'var(--teal-light)' : 'var(--indigo-light)', flexShrink: 0 }}>
                    {reg.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{reg.full_name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{reg.reg_number} · {reg.department}</div>
                  </div>
                  <span className={`badge ${justMarked ? 'badge-teal' : 'badge-gray'}`}>
                    {justMarked ? '✓ Marked' : 'Already present'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 16px;  opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 184px; opacity: 0; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: .4; }
          40%            { transform: scale(1);   opacity: 1;  }
        }
      `}</style>
    </div>
  )
}
