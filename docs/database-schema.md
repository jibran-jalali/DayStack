# DayStack database schema

DayStack uses Supabase Postgres for auth-linked profile data, daily planning, summary tracking, meeting metadata, and reminder scheduling.

## Core tables

### `profiles`

One row per Supabase auth user.

- `id`: UUID, primary key, references `auth.users.id`
- `full_name`: nullable display name
- `created_at`: creation timestamp

Purpose:
- gives the app a stable profile record
- supports meeting tagging/search
- is created automatically from the auth trigger

### `tasks`

The main day-planning table. Every time block belongs to exactly one owner.

- `id`: UUID primary key
- `user_id`: UUID owner, references `auth.users.id`
- `title`: task title
- `task_date`: planned day
- `start_time`: planned start time
- `end_time`: planned end time
- `task_type`: `generic` or `meeting`
- `meeting_link`: nullable URL for meeting blocks
- `status`: `pending` or `completed`
- `created_at`
- `updated_at`

Rules:
- `end_time > start_time`
- blank titles are rejected
- only supported task types/statuses are allowed

### `task_participants`

Optional participant links for meeting tasks.

- `id`: UUID primary key
- `task_id`: references `tasks.id`
- `participant_id`: references `profiles.id`
- `created_at`

Purpose:
- stores tagged users for meeting blocks
- keeps meeting UI compact without changing task ownership

Current behavior:
- the task owner manages participants
- tagged users are stored/displayed cleanly
- meetings are not automatically mirrored into tagged users’ personal timelines yet

### `daily_summaries`

Stores per-day rollups used for execution score and streak logic.

- `id`: UUID primary key
- `user_id`: owner
- `summary_date`
- `total_tasks`
- `completed_tasks`
- `execution_score`
- `successful_day`
- `created_at`
- `updated_at`

Purpose:
- supports lightweight historical streak logic
- avoids recalculating the entire history every time

### `user_notification_preferences`

Per-user reminder settings for web push.

- `user_id`: UUID primary key, references `auth.users.id`
- `push_enabled`: whether web push is enabled for the user/browser flow
- `remind_at_start`
- `remind_5_min_before`
- `remind_overdue`
- `created_at`
- `updated_at`

Notes:
- a default row is created when a new user signs up
- toggles are saved even if push is currently off
- when preferences change, DayStack re-syncs future reminder rows

### `task_reminders`

Scheduled reminder jobs derived from tasks plus notification preferences.

- `id`: UUID primary key
- `task_id`: references `tasks.id`
- `user_id`: owner
- `reminder_type`: `5_minutes_before`, `at_start`, or `overdue`
- `remind_at`: UTC timestamp to send at
- `status`: `pending`, `processing`, `sent`, `skipped`, or `failed`
- `sent_at`: nullable send timestamp
- `created_at`
- `updated_at`

Purpose:
- gives DayStack an explicit queue of reminders to send
- keeps scheduling idempotent when tasks or preferences change
- makes future cron-based dispatch practical

## Relationships

- `auth.users` -> `profiles` is one-to-one
- `profiles` -> `tasks` is one-to-many
- `tasks` -> `task_participants` is one-to-many
- `profiles` -> `task_participants.participant_id` enables meeting tagging
- `profiles` -> `daily_summaries` is one-to-many
- `profiles` -> `user_notification_preferences` is one-to-one
- `tasks` -> `task_reminders` is one-to-many
- `profiles` -> `task_reminders` is one-to-many

## Execution score logic

Version 1:

```text
execution_score = (completed_tasks / total_tasks) * 100
```

Rules:
- if no tasks exist, score is `0`
- scores are rounded to whole numbers in the UI
- summaries persist the daily score for streak/history

## Streak logic

Version 1 successful day rule:

```text
successful_day = execution_score >= 70
```

Streak logic:
- consecutive successful days count toward the streak
- streaks are derived from `daily_summaries`
- the current day uses the live summary merged with persisted history

## Reminder scheduling logic

Reminder rows are generated from:

- the task start/end times
- the user’s reminder toggles
- whether push is enabled
- whether the task is still pending

Supported reminder types:

- `5_minutes_before`
- `at_start`
- `overdue`

Scheduling behavior:
- creating or updating a task re-syncs that task’s reminder rows
- completing a task clears future mutable reminder rows for that task
- changing reminder preferences re-syncs future pending tasks
- sent reminders are kept as history; mutable unsent rows are replaced

Dispatch behavior:
- test pushes are sent from an authenticated server route
- scheduled dispatch can run through `/api/reminders/dispatch`
- global cron dispatch is ready for `SUPABASE_SERVICE_ROLE_KEY` plus an optional `CRON_SECRET`

## RLS model

All user-facing tables use row level security.

Users can only:
- read and mutate their own `tasks`
- read and mutate their own `daily_summaries`
- read and mutate their own `user_notification_preferences`
- read and mutate their own `task_reminders`
- read meeting participant rows only when they own the parent task
- read `profiles` as authenticated users so participant search works

## Indexes

Important indexes included in `schema.sql`:

- `tasks_user_date_start_idx`
- `tasks_user_date_status_idx`
- `tasks_user_date_type_idx`
- `task_participants_task_participant_uidx`
- `daily_summaries_user_date_idx`
- `task_reminders_due_idx`
- `task_reminders_user_due_idx`

These keep the planner, summary reads, participant search, and reminder dispatch efficient.

## Time zone note

DayStack v1 still plans tasks as local day/time blocks rather than storing a dedicated per-user timezone. Reminder timestamps are generated from the user’s browser-local time when tasks or reminder settings change, then stored in UTC in `task_reminders`.

That is good enough for the current web MVP, but a future version should add:

- a user timezone field
- timezone-aware scheduling on the server
- more explicit cross-device reminder consistency

## Future AI planning fit

If AI planning is added later, it can layer onto the current schema without replacing it.

Likely additions:
- `plan_templates`
- `ai_plan_suggestions`
- `task_generation_runs`
- optional richer task metadata such as priority, energy, or category

The current schema is intentionally compact so planning, execution, meetings, and reminders stay understandable in v1.
