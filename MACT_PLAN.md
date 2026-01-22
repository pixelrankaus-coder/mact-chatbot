# MACt Chatbot — Ralph Wiggum Plan

## Overview
Polish the chat inbox with auto-resolve functionality and add team login system.

---

## Tasks

### Task 043: Auto-Resolve Chats After 24h
```json
{
  "category": "feature",
  "description": "Auto-resolve inactive chats and clean up inbox",
  "status": "passing",
  "steps": [
    "Add 'resolved_at' and 'last_activity_at' columns to conversations table if not exists",
    "Create API route: /api/conversations/auto-resolve that marks chats as resolved if last_activity_at > 24h",
    "Update conversations query to filter by status (default: active only)",
    "Add 'Resolved' tab to inbox sidebar showing resolved chats",
    "When customer replies to resolved chat, set status back to 'active'",
    "Add cron-compatible endpoint that can be called hourly"
  ],
  "verification": [
    "Inbox only shows active chats by default",
    "Resolved tab shows old chats",
    "API endpoint /api/conversations/auto-resolve works"
  ]
}
```

### Task 044: Team Login System (Supabase Auth)
```json
{
  "category": "feature",
  "description": "Add authentication for team members",
  "status": "passing",
  "steps": [
    "Create team_members table: id, email, name, role (admin/agent), avatar_url, created_at",
    "Set up Supabase Auth with email/password",
    "Create /login page with email/password form",
    "Create auth middleware to protect routes",
    "Add session management (login, logout)",
    "Protect these routes: /inbox, /customers, /settings, /conversations"
  ],
  "verification": [
    "Cannot access /inbox without logging in",
    "Login page works with valid credentials",
    "Logout clears session and redirects to login"
  ]
}
```

### Task 045: Team Management UI
```json
{
  "category": "feature",
  "description": "Admin UI to manage team members",
  "status": "passing", 
  "steps": [
    "Create /settings/team page (admin only)",
    "List all team members with role badges",
    "Add 'Invite Member' form: email, name, role",
    "Send invite email via Supabase Auth",
    "Add 'Remove Member' button with confirmation",
    "Add 'Change Role' dropdown"
  ],
  "verification": [
    "Admin can see /settings/team page",
    "Can add new team member",
    "Can remove team member",
    "Non-admins cannot access team management"
  ]
}
```

### Task 046: Chat Assignment System
```json
{
  "category": "feature",
  "description": "Assign chats to team members",
  "status": "passing",
  "steps": [
    "Add 'assigned_to' column to conversations table (references team_members.id)",
    "Add 'Assign' dropdown in chat header showing team members",
    "Add 'My Chats' filter in inbox sidebar",
    "Add 'Unassigned' filter in inbox sidebar",
    "Show assigned agent avatar/name on chat list item",
    "When AI requests handoff, mark chat as 'needs_assignment'"
  ],
  "verification": [
    "Can assign chat to team member from dropdown",
    "'My Chats' filter shows only chats assigned to current user",
    "'Unassigned' filter shows chats with no assignment",
    "Assignment shows on chat list"
  ]
}
```

---

## Activity Log

- **Task 043 COMPLETE** (2026-01-23): Auto-resolve chats after 24h
  - Added `resolved_at` and `last_activity_at` fields to database types
  - Created `/api/conversations/auto-resolve` endpoint (POST to resolve, GET to preview)
  - Updated messages route to track `last_activity_at` on every message
  - Resolved conversations auto-reactivate when visitor sends new message
  - Updated `useConversations` hook with status filtering options
  - Build verified: ✓

- **Task 044 COMPLETE** (2026-01-23): Team Login System
  - Login page with Supabase Auth already existed
  - Agents table serves as team_members (id, email, name, role, etc.)
  - Created middleware.ts to protect routes (/inbox, /customers, /settings, /orders, /ai-agent)
  - Unauthenticated users redirected to /login
  - Added logout functionality to Account settings page
  - Installed @supabase/ssr for server-side auth
  - Build verified: ✓

- **Task 045 COMPLETE** (2026-01-23): Team Management UI
  - /settings/team page already fully implemented
  - Lists all team members with role badges (owner/admin/agent)
  - Add Agent form with email, name, password, role
  - Remove Member button with confirmation dialog
  - Change Role dropdown in edit dialog
  - Role-based access control (admins can't edit owners)
  - Build verified: ✓

- **Task 046 COMPLETE** (2026-01-23): Chat Assignment System
  - `assigned_to` column already exists in conversations table
  - Added Assign dropdown in chat header showing all team members
  - Added "My Chats" filter showing only current user's assigned chats
  - Added "Unassigned" filter showing chats without assignment
  - Assigned agent avatar/name shown on chat list items
  - Dropdown shows online status, checkmark for current assignment
  - Build verified: ✓

---

## Success Criteria

- All 4 tasks have status: "passing"
- No TypeScript/build errors
- All verification points confirmed
- Changelog updated to v2.10.0

When all tasks are complete, output: COMPLETE
