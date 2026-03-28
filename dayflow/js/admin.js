import { supabase } from './supabase.js'
import { signOut } from './auth.js'

// ── Auth guard ────────────────────────────────────────────────────────────────
const { data: { session } } = await supabase.auth.getSession()
if (!session) {
  window.location.href = 'index.html'
}

const { data: profile } = await supabase
  .from('profiles')
  .select('is_admin')
  .eq('id', session.user.id)
  .single()

if (!profile?.is_admin) {
  window.location.href = 'app.html'
}

// ── Load users ────────────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById('users-tbody')
  tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Carregando...</td></tr>'

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, name, email, provider, is_admin, created_at')
    .order('created_at', { ascending: false })

  if (error || !users) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Erro ao carregar usuários.</td></tr>'
    return
  }

  // Stats
  document.getElementById('stat-total').textContent = users.length
  document.getElementById('stat-google').textContent = users.filter(u => u.provider === 'google').length
  document.getElementById('stat-email').textContent = users.filter(u => u.provider !== 'google').length

  // Table
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">Nenhum usuário encontrado.</td></tr>'
    return
  }

  tbody.innerHTML = users.map(u => {
    const name = u.name || '—'
    const email = u.email || '—'
    const createdAt = u.created_at
      ? new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—'
    const providerBadge = u.provider === 'google'
      ? `<span class="provider-badge google">🌐 Google</span>`
      : `<span class="provider-badge email">✉️ E-mail</span>`
    const adminBadge = u.is_admin ? `<span class="admin-badge">Admin</span>` : '—'

    return `
      <tr>
        <td>${name}</td>
        <td>${email}</td>
        <td>${providerBadge}</td>
        <td>${createdAt}</td>
        <td>${adminBadge}</td>
      </tr>
    `
  }).join('')
}

// ── Events ────────────────────────────────────────────────────────────────────
document.getElementById('admin-logout-btn').addEventListener('click', signOut)
document.getElementById('refresh-btn').addEventListener('click', loadUsers)

document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'))
    document.getElementById(`section-${btn.dataset.section}`).classList.add('active')
  })
})

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('section-users').classList.add('active')
loadUsers()
