import { supabase } from './supabase.js'

const API = 'https://www.googleapis.com/calendar/v3'

// ── Token ─────────────────────────────────────────────────────────────────────

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.provider_token ?? null
}

// ── Check provider ─────────────────────────────────────────────────────────────

export async function isGoogleUser() {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.app_metadata?.provider === 'google'
}

// ── API helper ────────────────────────────────────────────────────────────────

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error?.message ?? `HTTP ${res.status}`)
  }
  return res.status === 204 ? null : res.json()
}

// ── Event builders ────────────────────────────────────────────────────────────

// Google Calendar colorId by priority
const PRIORITY_COLOR = { alta: '11', media: '5', baixa: '2' }

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function buildEvent(summary, description, dateStr, priority, completed) {
  return {
    summary: completed ? `✓ ${summary}` : summary,
    description: description || '',
    colorId: PRIORITY_COLOR[priority] ?? '5',
    start: { date: dateStr },
    end:   { date: nextDay(dateStr) },
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function gcalCreate(task) {
  const token = await getToken()
  if (!token) return null

  try {
    if (task.type === 'steps' && task.steps?.length) {
      // One event per step
      const ids = []
      for (const [i, step] of task.steps.entries()) {
        const done = task.completed || i < (task.current_step ?? 0)
        const ev = await call('POST', '/calendars/primary/events', buildEvent(
          `Etapa ${i + 1}: ${step.title}`,
          `Tarefa: ${task.title}${task.notes ? '\n' + task.notes : ''}`,
          task.date, task.priority, done
        ), token)
        ids.push(ev.id)
      }
      return { steps: ids }
    } else {
      const ev = await call('POST', '/calendars/primary/events',
        buildEvent(task.title, task.notes, task.date, task.priority, task.completed),
        token)
      return { main: ev.id }
    }
  } catch (e) {
    console.warn('[GCal] create failed:', e.message)
    return null
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function gcalUpdate(task) {
  const token = await getToken()
  const ids = task.google_event_ids
  if (!token || !ids) return

  try {
    if (task.type === 'steps' && task.steps?.length && ids.steps) {
      for (const [i, step] of task.steps.entries()) {
        if (!ids.steps[i]) continue
        const done = task.completed || i < (task.current_step ?? 0)
        await call('PATCH', `/calendars/primary/events/${ids.steps[i]}`, buildEvent(
          `Etapa ${i + 1}: ${step.title}`,
          `Tarefa: ${task.title}${task.notes ? '\n' + task.notes : ''}`,
          task.date, task.priority, done
        ), token)
      }
    } else if (ids.main) {
      await call('PATCH', `/calendars/primary/events/${ids.main}`,
        buildEvent(task.title, task.notes, task.date, task.priority, task.completed),
        token)
    }
  } catch (e) {
    console.warn('[GCal] update failed:', e.message)
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function gcalDelete(task) {
  const token = await getToken()
  const ids = task.google_event_ids
  if (!token || !ids) return

  try {
    const list = ids.steps ?? (ids.main ? [ids.main] : [])
    for (const id of list) {
      if (id) await call('DELETE', `/calendars/primary/events/${id}`, null, token)
    }
  } catch (e) {
    console.warn('[GCal] delete failed:', e.message)
  }
}
