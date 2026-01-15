# MACt Chatbot - Master Task Template

Use this template for all development tasks. Copy and fill in the sections.

---

## Task Header

```markdown
# TASK MACT #[NUMBER]: [Task Title]

**Project:** MACt Chatbot
**Created:** [Date]
**Type:** FEATURE | BUG | REFACTOR | DOCS | CHORE
**Priority:** HIGH | MEDIUM | LOW
```

---

## Template

````markdown
# TASK MACT #[NUMBER]: [Task Title]

**Project:** MACt Chatbot
**Created:** [Date]
**Type:** [Type]
**Priority:** [Priority]

---

## Why

[1-2 sentences explaining why this task matters]

---

## Current State

- [What exists now]
- [Current problems or limitations]

## Target State

- [What should exist after completion]
- [Expected improvements]

## Success Looks Like

- [Specific, measurable acceptance criteria]
- [What can be verified when done]

---

## Implementation

### Phase 1: [Phase Name]

[Detailed steps for this phase]

### Phase 2: [Phase Name]

[Detailed steps for this phase]

---

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `path/to/file` | Description |
| MODIFY | `path/to/file` | Description |
| DELETE | `path/to/file` | Description |

---

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3
- [ ] No build errors
- [ ] Committed and pushed to GitHub

---

## Git Commit

```
type(scope): description

- Detail 1
- Detail 2

TASK MACT #[NUMBER]
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code refactoring
- `chore`: Maintenance tasks
- `style`: Formatting changes
- `test`: Adding tests

---

## Notes

[Any additional context, links, or considerations]

---

## Review Gate

Before starting implementation, ensure:
- [ ] Requirements are clear
- [ ] Approach is approved
- [ ] Dependencies identified
````

---

## Example Usage

```markdown
# TASK MACT #001: Add Email Notifications

**Project:** MACt Chatbot
**Created:** January 16, 2026
**Type:** FEATURE
**Priority:** HIGH

---

## Why

Agents need to be notified when new conversations require attention.

---

## Current State

- No notification system exists
- Agents must manually check inbox

## Target State

- Email sent when handoff requested
- Email sent for new high-priority conversations

## Success Looks Like

- Emails arrive within 1 minute of trigger
- Email contains conversation link
- Configurable in settings

---

## Implementation

### Phase 1: Email Service Setup

1. Add Resend SDK
2. Create email templates
3. Add API endpoint

### Phase 2: Trigger Integration

1. Hook into handoff flow
2. Add notification settings UI

---

## Files Summary

| Action | File | Purpose |
|--------|------|---------|
| CREATE | `src/lib/email.ts` | Email service |
| CREATE | `src/app/api/notifications/route.ts` | Notification endpoint |
| MODIFY | `src/app/settings/notifications/page.tsx` | Settings UI |

---

## Acceptance Criteria

- [ ] Email sends on handoff request
- [ ] Settings page controls notifications
- [ ] No build errors
- [ ] Committed and pushed

---

## Git Commit

```
feat(notifications): Add email notifications for handoffs

- Add Resend integration
- Create notification settings UI
- Trigger email on handoff request

TASK MACT #001
```
```

---

## Quick Reference

### Priority Levels

| Priority | Response Time | Examples |
|----------|---------------|----------|
| HIGH | Same day | Production bugs, security issues |
| MEDIUM | This week | New features, improvements |
| LOW | When available | Nice-to-haves, minor polish |

### Task Types

| Type | Description |
|------|-------------|
| FEATURE | New functionality |
| BUG | Fix broken behavior |
| REFACTOR | Improve code structure |
| DOCS | Documentation updates |
| CHORE | Maintenance, dependencies |
