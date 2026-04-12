export type Role = 'student' | 'faculty' | 'hod' | 'admin'
export type EventStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'completed'
export type EventType = 'technical' | 'hackathon' | 'cultural' | 'sports' | 'other'
export type ODStatus = 'not_generated' | 'pending' | 'faculty_approved' | 'hod_approved' | 'rejected'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  reg_number?: string
  department: string
  phone?: string
  created_at: string
}

export interface Event {
  id: string
  title: string
  description?: string
  event_type: EventType
  venue: string
  event_date: string
  start_time?: string
  end_time?: string
  club_name: string
  organizer_id: string
  faculty_id?: string
  hod_id?: string
  status: EventStatus
  qr_token?: string           // short token — QR image generated client-side
  faculty_remarks?: string
  created_at: string
  organizer?: Profile
  faculty?: Profile
  hod?: Profile
}

export interface EventRegistration {
  id: string
  event_id: string
  student_id?: string
  full_name: string
  reg_number: string
  department: string
  year_sem: string
  section?: string
  phone?: string
  email?: string
  role_in_event: string
  attendance_qr_data?: string  // compact JSON string stored in DB (not base64)
  attended: boolean
  attended_at?: string
  od_status: ODStatus
  registered_at: string
  event?: Event
}

export interface ODRequest {
  id: string
  registration_id: string
  event_id: string
  student_reg_number: string
  faculty_status: ApprovalStatus
  faculty_id?: string
  faculty_remarks?: string
  faculty_acted_at?: string
  hod_status: ApprovalStatus
  hod_id?: string
  hod_remarks?: string
  hod_acted_at?: string
  slip_id: string
  created_at: string
  registration?: EventRegistration
  event?: Event
}
