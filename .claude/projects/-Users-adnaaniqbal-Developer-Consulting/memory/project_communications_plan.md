---
name: Unified Communications Platform
description: Plan for integrating phone (Twilio), SMS, email inbox, and auto-task creation into BuildKit CRM
type: project
---

Unified communications hub planned for BuildKit CRM — phone calls, SMS, and email all in one place.

**Why:** Adnaan wants all customer communications (calls, texts, emails) centralized so any rep can reply to any thread, and incoming messages auto-create follow-up tasks for the assigned rep.

**Key requirements:**
1. Phone integration via Twilio (calls + SMS from a shared number)
2. Shared inbox — any rep can see/reply to any conversation
3. Incoming emails auto-create tasks for assigned sales rep
4. Incoming calls/texts auto-create follow-up tasks
5. All communications logged per lead/deal/project
6. Real-time notifications on new messages

**How to apply:** When implementing communications features, prioritize the shared inbox pattern over individual user mailboxes. Use Twilio for phone/SMS. Auto-task creation on every inbound communication is non-negotiable.
