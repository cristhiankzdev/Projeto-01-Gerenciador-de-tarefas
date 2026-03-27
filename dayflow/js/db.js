import { supabase } from './supabase.js'

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, categories(name, emoji, color)')
    .eq('user_id', userId)
    .neq('archived', true)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function archiveTask(id) {
  const { error } = await supabase
    .from('tasks')
    .update({ archived: true })
    .eq('id', id)
  if (error) throw error
}

export async function getArchivedTasks(userId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, categories(name, emoji, color)')
    .eq('user_id', userId)
    .eq('archived', true)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createTask(task) {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select('*, categories(name, emoji, color)')
    .single()
  if (error) throw error
  return data
}

export async function updateTask(id, updates) {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select('*, categories(name, emoji, color)')
    .single()
  if (error) throw error
  return data
}

export async function deleteTask(id) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function getCategories(userId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createCategory(category) {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id, updates) {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id) {
  await supabase.from('tasks').update({ category_id: null }).eq('category_id', id)
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export async function countTasksByCategory(id) {
  const { count } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
  return count ?? 0
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function getNote(userId) {
  const { data } = await supabase
    .from('notes')
    .select('content')
    .eq('user_id', userId)
    .single()
  return data?.content ?? ''
}

export async function saveNote(userId, content) {
  const { error } = await supabase
    .from('notes')
    .upsert({ user_id: userId, content, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single()
  return data
}

export async function updateProfile(userId, name) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, name })
  if (error) throw error
}

// ── Events (calendar marks) ────────────────────────────────────────────────────

export async function getEvents(userId, year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end   = `${year}-${String(month).padStart(2, '0')}-31`
  const { data, error } = await supabase
    .from('events')
    .select('date, label, color, description')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end)
  if (error) throw error
  return data ?? []
}

export async function setEvent(userId, date, { color = '#4A7FC1', description = '' } = {}) {
  const { data, error } = await supabase
    .from('events')
    .upsert({ user_id: userId, date, color, description }, { onConflict: 'user_id,date' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEvent(userId, date) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('user_id', userId)
    .eq('date', date)
  if (error) throw error
}
