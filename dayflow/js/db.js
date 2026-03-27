import { supabase } from './supabase.js'

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*, categories(name, emoji, color)')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('created_at')
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
