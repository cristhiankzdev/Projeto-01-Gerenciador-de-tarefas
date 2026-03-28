import { supabase } from './supabase.js'

// ── Auth functions ────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateError(error.message))
  if (!data.session) throw new Error('Confirme seu e-mail antes de entrar.')
  return data
}

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(translateError(error.message))
  if (data.user) {
    // upsert handles the case where the DB trigger already created the profile
    await supabase.from('profiles').upsert({ id: data.user.id, name, email }, { onConflict: 'id' })
  }
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/app.html',
      scopes: 'https://www.googleapis.com/auth/calendar.events',
    }
  })
  if (error) throw new Error('Erro ao conectar com Google. Tente novamente.')
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/app.html',
  })
  if (error) throw new Error(translateError(error.message))
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}

function translateError(msg) {
  const map = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Este e-mail já está cadastrado.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
    'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
    'Unable to validate email address: invalid format': 'Formato de e-mail inválido.',
    'signup is disabled': 'Cadastro desabilitado. Contate o suporte.',
    'Database error saving new user': 'Erro ao salvar dados. Contate o suporte.',
    'Email rate limit exceeded': 'Limite de envio atingido. Tente mais tarde.',
    'over_email_send_rate_limit': 'Muitas tentativas. Aguarde alguns minutos.',
  }
  if (msg?.startsWith('For security purposes, you can only request this after')) {
    return 'Aguarde alguns minutos antes de tentar novamente.'
  }
  return map[msg] || 'Ocorreu um erro. Tente novamente.'
}

// ── UI Initialization (runs on index.html) ────────────────────────────────────

const loginForm = document.getElementById('login-form')
if (loginForm) {
  // Redirect if already logged in
  getSession().then(session => {
    if (session) window.location.href = 'app.html'
  })

  // Google OAuth
  document.getElementById('google-btn').addEventListener('click', async () => {
    const btn = document.getElementById('google-btn')
    btn.disabled = true
    btn.textContent = 'Aguarde...'
    try {
      await signInWithGoogle()
    } catch (err) {
      btn.disabled = false
      btn.innerHTML = '<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt=""> Continuar com Google'
      document.getElementById('login-error').textContent = err.message
    }
  })

  // Login
  loginForm.addEventListener('submit', async e => {
    e.preventDefault()
    const btn = document.getElementById('login-btn')
    const errorEl = document.getElementById('login-error')
    errorEl.textContent = ''
    errorEl.className = 'form-error'
    setLoading(btn, true)
    let result
    try {
      result = await signIn(
        document.getElementById('login-email').value.trim(),
        document.getElementById('login-password').value
      )
    } catch (err) {
      errorEl.textContent = err.message
      setLoading(btn, false)
      return
    }
    const ADMIN_EMAILS = ['tenenteoliveirapmal@gmail.com']
    let dest = 'app.html'
    try {
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', result.user.id).single()
      if (prof?.is_admin || ADMIN_EMAILS.includes(result.user.email)) dest = 'admin.html'
    } catch {
      if (ADMIN_EMAILS.includes(result.user.email)) dest = 'admin.html'
    }
    window.location.href = dest
  })

  // Register
  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault()
    const btn = document.getElementById('register-btn')
    const errorEl = document.getElementById('register-error')
    errorEl.textContent = ''
    errorEl.className = 'form-error'
    const password = document.getElementById('reg-password').value
    const confirm = document.getElementById('reg-confirm').value
    if (password !== confirm) {
      errorEl.textContent = 'As senhas não coincidem.'
      return
    }
    if (password.length < 6) {
      errorEl.textContent = 'A senha deve ter pelo menos 6 caracteres.'
      return
    }
    setLoading(btn, true)
    try {
      await signUp(
        document.getElementById('reg-email').value.trim(),
        password,
        document.getElementById('reg-name').value.trim()
      )
      errorEl.className = 'form-error success'
      errorEl.textContent = '✅ Conta criada! Verifique seu e-mail para confirmar.'
    } catch (err) {
      errorEl.textContent = err.message
    } finally {
      setLoading(btn, false)
    }
  })

  // Forgot password
  document.getElementById('forgot-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim()
    const errorEl = document.getElementById('login-error')
    errorEl.textContent = ''
    errorEl.className = 'form-error'
    if (!email) {
      errorEl.textContent = 'Digite seu e-mail no campo acima primeiro.'
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.textContent = 'Formato de e-mail inválido.'
      return
    }
    try {
      await resetPassword(email)
      errorEl.className = 'form-error success'
      errorEl.textContent = '✅ E-mail de recuperação enviado!'
    } catch (err) {
      errorEl.textContent = err.message
    }
  })
}

function setLoading(btn, loading) {
  btn.querySelector('.btn-text').hidden = loading
  btn.querySelector('.btn-spinner').hidden = !loading
  btn.disabled = loading
}
