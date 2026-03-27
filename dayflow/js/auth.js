import { supabase } from './supabase.js'

// ── Auth functions ────────────────────────────────────────────────────────────

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(translateError(error.message))
  return data
}

export async function signUp(email, password, name) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(translateError(error.message))
  if (data.user) {
    await supabase.from('profiles').insert({ id: data.user.id, name })
  }
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
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

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      const tab = btn.dataset.tab
      document.getElementById('login-form').style.display = tab === 'login' ? 'flex' : 'none'
      document.getElementById('register-form').style.display = tab === 'register' ? 'flex' : 'none'
      document.getElementById('login-error').textContent = ''
      document.getElementById('register-error').textContent = ''
    })
  })

  // Password toggles
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target)
      input.type = input.type === 'password' ? 'text' : 'password'
      btn.textContent = input.type === 'password' ? '👁️' : '🙈'
    })
  })

  // Login
  loginForm.addEventListener('submit', async e => {
    e.preventDefault()
    const btn = document.getElementById('login-btn')
    const errorEl = document.getElementById('login-error')
    errorEl.textContent = ''
    errorEl.className = 'form-error'
    setLoading(btn, true)
    try {
      await signIn(
        document.getElementById('login-email').value.trim(),
        document.getElementById('login-password').value
      )
      window.location.href = 'app.html'
    } catch (err) {
      errorEl.textContent = err.message
    } finally {
      setLoading(btn, false)
    }
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
