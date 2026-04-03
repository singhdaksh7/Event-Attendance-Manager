# EventOD — SRM Institute On Duty Management System

A full-stack Next.js 14 + Supabase app for event registration and OD management.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS
- **Backend**: Supabase (Auth, PostgreSQL, RLS)
- **Deployment**: Vercel

## Setup

### 1. Supabase Setup
1. Go to [supabase.com](https://supabase.com) → New project
2. Open SQL Editor → paste contents of `supabase/schema.sql` → Run
3. Copy your **Project URL** and **Anon Key** from Settings → API

### 2. Environment Variables
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL and keys
```

### 3. Local Dev
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to Vercel
```bash
npx vercel --yes
# Add env vars in Vercel dashboard → Settings → Environment Variables
```

## User Roles & Flow

| Role | What they do |
|---|---|
| **Student (Club Head)** | Create event → assign faculty + HOD → get event QR after approval → scan student QRs at venue |
| **Student (Participant)** | Scan event QR → fill details → get personal attendance QR → show at venue |
| **Faculty** | Approve/reject events → approve OD requests → forwards to HOD |
| **HOD** | Final OD approval → student can download/print OD slip |

## Flow
```
Club Head creates event
    → Faculty approves
    → Event QR generated
    → Students scan QR → register → get personal QR
    → Club Head scans at venue → marks attendance + OD request auto-created
    → Faculty approves OD
    → HOD approves OD
    → Student downloads printable OD slip
```

## Routes
| Route | Description |
|---|---|
| `/` | Landing page |
| `/auth/login` | Login |
| `/auth/signup` | Signup (choose role) |
| `/dashboard/student` | Student dashboard |
| `/dashboard/faculty` | Faculty dashboard |
| `/dashboard/hod` | HOD dashboard |
| `/events/create` | Create new event |
| `/events/[id]` | Event details + attendees |
| `/events/[id]/qr` | Event QR code (club head) |
| `/events/[id]/scanner` | Attendance scanner (club head) |
| `/register/[eventId]` | Public registration page (after scanning QR) |
| `/od/[registrationId]` | Printable OD slip |
