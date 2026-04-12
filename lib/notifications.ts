import { createClient } from '@/lib/supabase/client'

export const LECTURE_SLOTS = [
  { id: 1, label: 'Slot 1', start: '09:30', end: '10:20' },
  { id: 2, label: 'Slot 2', start: '10:20', end: '11:10' },
  { id: 3, label: 'Slot 3', start: '11:20', end: '12:10' },
  { id: 4, label: 'Slot 4', start: '12:10', end: '13:00' },
  { id: 5, label: 'Slot 5', start: '14:10', end: '15:00' },
  { id: 6, label: 'Slot 6', start: '15:00', end: '15:50' },
]

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Teachers are notified if their slot overlaps with the event OR is within
// BUFFER minutes of either boundary (e.g. slot ends at 11:10, event starts
// at 11:12 → 2-min gap → still notify because student just left that class).
const OVERLAP_BUFFER_MINS = 5

export function getOverlappingSlots(eventStart: string, eventEnd: string) {
  const evStart = toMinutes(eventStart)
  const evEnd   = toMinutes(eventEnd)
  return LECTURE_SLOTS.filter(slot => {
    const slotStart = toMinutes(slot.start)
    const slotEnd   = toMinutes(slot.end)
    // Expand the slot window by BUFFER on both sides before checking overlap
    return (slotStart - OVERLAP_BUFFER_MINS) < evEnd &&
           (slotEnd   + OVERLAP_BUFFER_MINS) > evStart
  })
}

export function getDayOfWeek(dateStr: string): number {
  const d   = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  return day === 0 ? 7 : day
}

// Fire exactly when lecture ENDS
export function buildScheduledAt(eventDate: string, slotEnd: string): string {
  const [h, m] = slotEnd.split(':').map(Number)
  const dt = new Date(eventDate + 'T00:00:00')
  dt.setHours(h, m, 0, 0)
  return dt.toISOString()
}

export async function scheduleODNotifications(
  supabase: ReturnType<typeof createClient>,
  eventId: string
) {
  try {
    const { data: event } = await supabase
      .from('events').select('*').eq('id', eventId).single()

    if (!event?.start_time || !event?.end_time || !event?.event_date) return

    const overlappingSlots = getOverlappingSlots(event.start_time, event.end_time)
    if (!overlappingSlots.length) return

    const dayOfWeek = getDayOfWeek(event.event_date)
    if (dayOfWeek > 5) return

    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('full_name, reg_number, department, year_sem, section')
      .eq('event_id', eventId)
      .eq('attended', true)

    if (!registrations?.length) return

    // Group by dept + year + section
    const groups = new Map<string, {
      dept: string; year: string; section: string
      students: { name: string; reg_number: string }[]
    }>()

    for (const reg of registrations) {
      if (!reg.section) continue
      const yearLabel = reg.year_sem?.split('/')[0]?.trim() || reg.year_sem
      const key = `${reg.department}__${yearLabel}__${reg.section}`
      if (!groups.has(key)) {
        groups.set(key, { dept: reg.department, year: yearLabel, section: reg.section, students: [] })
      }
      groups.get(key)!.students.push({ name: reg.full_name, reg_number: reg.reg_number })
    }

    if (!groups.size) return

    for (const [, group] of groups) {
      const { data: sectionRow } = await supabase
        .from('sections').select('id')
        .eq('department', group.dept)
        .ilike('year_label', group.year)
        .ilike('section_code', group.section)
        .maybeSingle()

      if (!sectionRow) continue

      for (const slot of overlappingSlots) {
        const { data: existing } = await supabase
          .from('od_notifications').select('id')
          .eq('event_id', eventId)
          .eq('section_id', sectionRow.id)
          .eq('slot_id', slot.id)
          .maybeSingle()

        if (existing) continue

        const { data: ttEntry } = await supabase
          .from('timetable_entries').select('*')
          .eq('section_id', sectionRow.id)
          .eq('day_of_week', dayOfWeek)
          .eq('slot_id', slot.id)
          .maybeSingle()

        if (!ttEntry) continue

        await supabase.from('od_notifications').insert({
          event_id:           eventId,
          section_id:         sectionRow.id,
          timetable_entry_id: ttEntry.id,
          teacher_name:       ttEntry.teacher_name,
          teacher_email:      ttEntry.teacher_email,
          slot_id:            slot.id,
          student_count:      group.students.length,
          student_list:       group.students,
          // Fire at lecture END time
          scheduled_at:       buildScheduledAt(event.event_date, slot.end),
          status:             'pending',
        })
      }
    }
  } catch (err) {
    console.error('scheduleODNotifications error:', err)
  }
}
