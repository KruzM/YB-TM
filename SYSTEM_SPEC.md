# Yecny Bookkeeping Platform Specification

This document captures the consolidated requirements for the Yecny Bookkeeping (YB) internal platform, combining task, client, project, and document management with role-based access and auditability. It is derived from meeting notes, onboarding forms, and the existing YB database.

## 1. Platform Overview
- Replace Monday.com and disparate tools with a unified system running on Raspberry Pi (backend + frontend) with path for public deployment.
- Core modules: Task Management, Client Management, Project Management, Document Management, Internal + Client Portal, Recurring Task Engine, Audit Logs, and relational linking of accounts, contacts, and clients.
- Security first: secure login, strict session handling, role-based dashboards, URL access control, and audit trails.

## 2. Security & Authentication
- Secure token + cookie authentication with auto-logout after 60 minutes of inactivity.
- Tab re-open must not restore authenticated state (bank-style session handling).
- Roles: Admin, Manager, Bookkeeper, Client with role-specific dashboards and permissions.
- Enforce redirect to login for unauthenticated or unauthorized routes.
- Audit logs for task events, client changes, document actions, and purge actions.

## 3. Backend Infrastructure
- SQLite during development with migration support (Alembic) and path to production DB.
- API coverage: tasks, recurring tasks, subtasks, clients, contacts, accounts, documents.
- Deployment target: Raspberry Pi via VS Code remote environment; migratable to public domain later.

## 4. Task Management
- Task fields: status (new/in progress/waiting on client/completed/etc.), due date, assigned employee, linked client, optional subtasks, priority, task type, notes.
- Views: employee daily list, client-specific list, admin overview — all filtered from a single canonical task table.
- Daily employee dashboard: one-off tasks due today, recurring tasks due today, quick-list + calendar (day/week/month), click-through details & activity log, "Waiting on Client" queue.
- Recurring tasks: monthly/quarterly/annual/custom rules (e.g., first Monday of next month), allow subtasks, generate defaults when a new client is created (Complete bank feeds, Reconcile accounts, Send questions, Send reports).
- Support billable time entry and email-follow-up reference on tasks.
- Dedicated client entry for "Admin Tasks" with Tier "P".

## 5. Client Management
- Client list columns: company name, primary contact, email, phone, CPA, assigned manager/bookkeeper, billing frequency, tier.
- Search/filter/group by company, primary contact, tier (monthly/quarterly/annual/consulting/etc.), manager, billing frequency.
- Client view sections:
  - Profile: legal name, tax structure, address, entity type, ownership %, primary contact, CPA, bookkeeping frequency.
  - Contacts: single source of truth contacts linkable to multiple clients.
  - Accounts: banking/credit/loan/asset accounts with naming standard (e.g., "WF checking 2356"), active/inactive flags, linkable to recurring task subtasks.
  - Intercompany linking for related-entity groups.
  - Documents: uploaded and missing docs, statement tracking by month/year.
  - Recurring tasks: auto-generated templates and custom schedules.

## 6. Document Management
- Upload flow asks for document type (Statement/Tax/Misc), select account (scoped to client), month, and year.
- System auto-renames (e.g., "May 2025 – WF Checking 9072.pdf"), stores in correct folder, logs upload, and updates missing/received status.
- Retention: hold 6 months after client departure; auto-delete after 7 years; purge requires two-admin authorization.

## 7. Client Portal (Future Phase)
- Client abilities: log in, upload statements, view missing statements, submit simple requests (ticket-style), and view bookkeeping progress dashboard.
- Clients cannot modify tasks.

## 8. Admin Features
- Manage users, roles, clients, tasks, accounts, recurring task templates.
- Full audit logs, two-admin purge approval, ability to deactivate users, permissions editor.

## 9. Database Structure (High-Level)
- Users: id, role, name, email, password hash, permissions.
- Clients: id, legal name, DBA, primary contact (FK), CPA, bookkeeping frequency, billing frequency, manager, tier, intercompany_group_id.
- Contacts: id, name, phone, email; linkable to multiple clients.
- Accounts: id, client_id, bank name, type, last4, active/inactive.
- Tasks: id, client_id, assigned_user, due date, recurring_id (nullable), status, priority, task type, notes.
- Subtasks: parent_task_id, name, status.
- Recurring_Tasks: schedule type, first run date, rule logic, default generation for new clients.
- Documents: id, client_id, account_id, type, month, year, filename, stored_path, uploaded_by, uploaded_date.
- Intake form fields feed into client creation (start date, QBO status, accounts, loans, vehicles, assets, reporting frequency, legal name, entity/tax structure, owners %, payment methods, income categories, personal vs business spending, payroll details, primary phone/contact, bank logins, service selections).

## 10. Hosting & Deployment
- Run on Raspberry Pi during development; support migration to public URL (e.g., wytaskmanagement.com) with straightforward environment migration.

## 11. Long-Term Features (Future)
- Bookkeeping app integration (checks/expenses/transfers), potential bank API integration, ability to initiate bank transfers, expanding toward full accounting suite.

## 12. Design Principles
- Clean, simple UI minimizing overwhelm; forms drive data entry and backend persistence.
- Unified data to avoid duplication; centralized task database with filtered views.
- Employee-friendly daily dashboard (including iPad-style simplified view).
