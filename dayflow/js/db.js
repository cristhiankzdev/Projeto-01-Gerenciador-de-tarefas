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
    .select('name, birth_date, avatar_url')
    .eq('id', userId)
    .single()
  return data
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates })
  if (error) throw error
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl + '?t=' + Date.now()
}

// ── Events (calendar marks) ────────────────────────────────────────────────────

export async function getEvents(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('events')
    .select('date, label, color, description')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
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
