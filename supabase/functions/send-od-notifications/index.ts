// Supabase Edge Function: send-od-notifications
// Called by pg_cron every minute — checks for pending notifications due to fire
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!

Deno.serve(async () => {
  try {
    // Fetch all pending notifications due now (scheduled_at <= now)
    const { data: notifications, error } = await supabase
      .from('od_notifications')
      .select(`
        *,
        event:event_id(title, event_date, start_time, end_time, club_name),
        slot:slot_id(label, start_time, end_time)
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50)

    if (error) throw error
    if (!notifications?.length) return new Response('No notifications due', { status: 200 })

    let sent = 0, failed = 0

    for (const notif of notifications) {
      try {
        const ev    = notif.event as any
        const slot  = notif.slot  as any
        const students: { name: string; reg_number: string }[] = notif.student_list || []

        // Build email HTML
        const studentRows = students
          .map((s, i) => `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${i + 1}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;font-weight:500">${s.name}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;font-family:monospace;font-size:12px;color:#555">${s.reg_number}</td></tr>`)
          .join('')

        const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f9fafb;font-family:ui-sans-serif,system-ui,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:10px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#111;padding:20px 28px">
      <div style="font-size:15px;font-weight:700;color:#fff;letter-spacing:-0.02em">SRM Institute · EventOD</div>
      <div style="font-size:11px;color:#666;margin-top:2px">On Duty notification</div>
    </div>
    <div style="padding:24px 28px">
      <p style="font-size:14px;color:#444;line-height:1.7;margin:0 0 20px">
        Dear <strong>${notif.teacher_name}</strong>,<br><br>
        The following students in your <strong>${slot.label} (${slot.start_time} – ${slot.end_time})</strong> class are on OD today for the event listed below.
      </p>

      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:20px">
        <div style="font-size:13px;font-weight:700;margin-bottom:4px">${ev.title}</div>
        <div style="font-size:12px;color:#666">${ev.club_name} · ${ev.event_date}</div>
        ${ev.start_time ? `<div style="font-size:12px;color:#888;margin-top:2px">Event time: ${ev.start_time}${ev.end_time ? ' – ' + ev.end_time : ''}</div>` : ''}
      </div>

      <div style="font-size:12px;font-weight:600;color:#888;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px">
        Students on OD (${students.length})
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:500">#</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:500">Name</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:500">Register No.</th>
          </tr>
        </thead>
        <tbody>${studentRows}</tbody>
      </table>

      <p style="font-size:12px;color:#aaa;margin-top:24px;line-height:1.6">
        This notification was sent automatically by EventOD 10 minutes after the lecture started.<br>
        Students listed above have been marked present at the event venue.
      </p>
    </div>
    <div style="padding:14px 28px;border-top:1px solid #f0f0f0;font-size:11px;color:#bbb;text-align:center">
      EventOD · SRM Institute of Science and Technology
    </div>
  </div>
</body>
</html>`

        // Send via Resend
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from:    'EventOD <noreply@yourdomain.com>',
            to:      [notif.teacher_email],
            subject: `[OD Notice] ${students.length} student${students.length > 1 ? 's' : ''} on OD — ${ev.title}`,
            html,
          }),
        })

        if (!res.ok) {
          const err = await res.text()
          throw new Error(`Resend error: ${err}`)
        }

        await supabase.from('od_notifications')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', notif.id)
        sent++

      } catch (err: any) {
        await supabase.from('od_notifications')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', notif.id)
        failed++
        console.error('Failed to send to', notif.teacher_email, err.message)
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
