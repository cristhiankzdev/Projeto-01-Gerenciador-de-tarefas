import { getXPProfile, updateXPProfile, addXPHistory, getXPHistory } from './db.js'

// ── Constants ─────────────────────────────────────────────────────────────────
export const XP_TABLE = {
  facil:                  100n,
  media:                  200n,
  dificil:                300n,
  muito_dificil:          600n,
  extremamente_dificil:  1000n,
}

export const XP_LABELS = {
  facil:                 '⭐ Fácil',
  media:                 '⭐⭐ Média',
  dificil:               '⭐⭐⭐ Difícil',
  muito_dificil:         '⭐⭐⭐⭐ Muito Difícil',
  extremamente_dificil:  '⭐⭐⭐⭐⭐ Extremamente Difícil',
}

const MAX_LEVEL = 500

// Milestones every 5 levels
const MILESTONES = {
  5:   { label: 'Aprendiz',      icon: '🥉' },
  10:  { label: 'Comprometido',  icon: '🥈' },
  15:  { label: 'Dedicado',      icon: '🥇' },
  20:  { label: 'Experiente',    icon: '🏅' },
  25:  { label: 'Especialista',  icon: '🎖️' },
  30:  { label: 'Mestre',        icon: '🏆' },
  40:  { label: 'Veterano',      icon: '💎' },
  50:  { label: 'Lendário',      icon: '👑' },
  75:  { label: 'Mítico',        icon: '⚡' },
  100: { label: 'Imortal',       icon: '🌟' },
  200: { label: 'Transcendente', icon: '🔮' },
  500: { label: 'Supremo',       icon: '🌌' },
}

// ── State ─────────────────────────────────────────────────────────────────────
let currentUserId = null
let userTotalXP   = 0n   // BigInt
let userLevel     = 0

// ── Math functions (BigInt) ───────────────────────────────────────────────────
// XP needed to go from level n to n+1 — linear progression: 500, 550, 600, ...
export function xpForLevel(n) {
  if (n >= MAX_LEVEL) return 0n
  return 500n + 50n * BigInt(n)
}

// Total XP required to reach level L from level 0
// Sum of (500 + 50*i) for i=0..L-1 = 500*L + 25*L*(L-1)
export function xpToReachLevel(L) {
  if (L <= 0) return 0n
  if (L > MAX_LEVEL) L = MAX_LEVEL
  const l = BigInt(L)
  return 500n * l + 25n * l * BigInt(L - 1)
}

// Derive level from total XP
export function getLevelFromXP(totalXP) {
  const xp = BigInt(totalXP)
  let level = 0
  while (level < MAX_LEVEL) {
    const needed = xpToReachLevel(level + 1)
    if (xp < needed) break
    level++
  }
  return level
}

// XP already accumulated within current level
export function getXPInCurrentLevel(totalXP) {
  const xp = BigInt(totalXP)
  const level = getLevelFromXP(xp)
  if (level >= MAX_LEVEL) return xp - xpToReachLevel(MAX_LEVEL)
  return xp - xpToReachLevel(level)
}

// XP remaining to reach next level
export function getXPToNextLevel(totalXP) {
  const xp = BigInt(totalXP)
  const level = getLevelFromXP(xp)
  if (level >= MAX_LEVEL) return 0n
  return xpToReachLevel(level + 1) - xp
}

// Progress percent within current level (0–100, number)
export function getProgressPercent(totalXP) {
  const xp = BigInt(totalXP)
  const level = getLevelFromXP(xp)
  if (level >= MAX_LEVEL) return 100
  const current = getXPInCurrentLevel(xp)
  const needed  = xpForLevel(level)
  if (needed === 0n) return 100
  return Number((current * 10000n / needed)) / 100
}

// Format BigInt for display (e.g. 1500000 → "1.500.000")
function fmtXP(bigintVal) {
  return bigintVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initGamification(userId) {
  currentUserId = userId
  await loadProfile()
  renderXPBar()
  attachProgressionTable()
}

async function loadProfile() {
  try {
    const profile = await getXPProfile(currentUserId)
    userTotalXP = BigInt(profile?.total_xp ?? 0)
    userLevel   = profile?.level ?? getLevelFromXP(userTotalXP)
  } catch {
    userTotalXP = 0n
    userLevel   = 0
  }
}

// ── Award XP ──────────────────────────────────────────────────────────────────
export async function awardTaskXP(task) {
  if (!currentUserId) return
  if (task.xp_awarded) return   // prevent duplicates

  const complexity = task.complexity || 'media'
  const xpGain = XP_TABLE[complexity] ?? 200n

  const oldLevel  = userLevel
  userTotalXP    += xpGain
  userLevel       = getLevelFromXP(userTotalXP)

  // Persist
  try {
    await updateXPProfile(currentUserId, {
      total_xp: userTotalXP.toString(),
      level: userLevel,
    })
    await addXPHistory(currentUserId, {
      task_id:    task.id,
      task_title: task.title,
      complexity,
      xp_amount:  xpGain.toString(),
    })
  } catch (e) {
    console.error('XP persist error:', e)
  }

  renderXPBar()
  showXPGain(xpGain)

  if (userLevel > oldLevel) {
    setTimeout(() => showLevelUp(oldLevel, userLevel), 600)
  }
}

// ── Render XP bar ─────────────────────────────────────────────────────────────
export function renderXPBar() {
  const levelEl    = document.getElementById('xp-level-number')
  const fillEl     = document.getElementById('xp-progress-fill')
  const curEl      = document.getElementById('xp-current-info')
  const nextEl     = document.getElementById('xp-next-info')
  const badgeEl    = document.getElementById('xp-level-badge')
  const milestoneEl = document.getElementById('xp-milestone')

  if (!levelEl) return

  const pct       = getProgressPercent(userTotalXP)
  const inLevel   = getXPInCurrentLevel(userTotalXP)
  const toNext    = getXPToNextLevel(userTotalXP)
  const levelXP   = xpForLevel(userLevel)

  levelEl.textContent = userLevel
  fillEl.style.width  = `${Math.min(pct, 100).toFixed(2)}%`

  if (userLevel >= MAX_LEVEL) {
    curEl.textContent  = `${fmtXP(userTotalXP)} XP total`
    nextEl.textContent = '🌌 Nível máximo atingido!'
  } else {
    curEl.textContent  = `${fmtXP(inLevel)} / ${fmtXP(levelXP)} XP`
    nextEl.textContent = `${fmtXP(toNext)} XP para o nível ${userLevel + 1}`
  }

  // Milestone badge
  const milestone = findCurrentMilestone(userLevel)
  if (milestoneEl) {
    if (milestone) {
      milestoneEl.textContent = `${milestone.icon} ${milestone.label}`
      milestoneEl.style.display = 'flex'
    } else {
      milestoneEl.style.display = 'none'
    }
  }

  // Badge glow on milestone levels
  if (badgeEl) {
    badgeEl.classList.toggle('milestone-glow', !!MILESTONES[userLevel])
  }
}

function findCurrentMilestone(level) {
  const keys = Object.keys(MILESTONES).map(Number).sort((a, b) => b - a)
  for (const k of keys) {
    if (level >= k) return MILESTONES[k]
  }
  return null
}

// ── XP gain float animation ───────────────────────────────────────────────────
function showXPGain(xpGain) {
  const bar = document.getElementById('xp-bar-container')
  if (!bar) return
  const el = document.createElement('div')
  el.className = 'xp-gain-float'
  el.textContent = `+${fmtXP(xpGain)} XP`
  bar.appendChild(el)
  requestAnimationFrame(() => el.classList.add('fly'))
  setTimeout(() => el.remove(), 1200)
}

// ── Level-up overlay ──────────────────────────────────────────────────────────
function showLevelUp(oldLevel, newLevel) {
  const milestone = MILESTONES[newLevel]
  const overlay = document.createElement('div')
  overlay.className = 'levelup-overlay'
  overlay.innerHTML = `
    <div class="levelup-box">
      <div class="levelup-icon">${milestone?.icon ?? '🎉'}</div>
      <div class="levelup-title">Subiu de nível!</div>
      <div class="levelup-levels">${oldLevel} → <span>${newLevel}</span></div>
      ${milestone ? `<div class="levelup-milestone">${milestone.icon} ${milestone.label}</div>` : ''}
      <button class="levelup-close btn-primary">Incrível!</button>
    </div>
  `
  document.body.appendChild(overlay)
  requestAnimationFrame(() => overlay.classList.add('show'))
  overlay.querySelector('.levelup-close').addEventListener('click', () => {
    overlay.classList.remove('show')
    setTimeout(() => overlay.remove(), 400)
  })
  // Also trigger confetti if available
  if (typeof window.launchConfettiGlobal === 'function') {
    window.launchConfettiGlobal()
  }
}

// ── Progression table ─────────────────────────────────────────────────────────
function attachProgressionTable() {
  const btn = document.getElementById('xp-table-btn')
  if (!btn) return
  btn.addEventListener('click', openProgressionTable)
}

async function openProgressionTable() {
  let historyRows = ''
  try {
    const history = await getXPHistory(currentUserId, 20)
    historyRows = history.length
      ? history.map(h => {
          const label = XP_LABELS[h.complexity] ?? h.complexity
          const date  = new Date(h.created_at).toLocaleDateString('pt-BR')
          return `<tr>
            <td>${date}</td>
            <td class="hist-title">${h.task_title ?? '—'}</td>
            <td>${label}</td>
            <td class="hist-xp">+${Number(h.xp_amount).toLocaleString('pt-BR')} XP</td>
          </tr>`
        }).join('')
      : '<tr><td colspan="4" class="empty-text">Nenhum histórico ainda.</td></tr>'
  } catch {
    historyRows = '<tr><td colspan="4" class="empty-text">Erro ao carregar histórico.</td></tr>'
  }

  // Next 10 levels table
  const nextRows = []
  for (let i = 0; i < 10; i++) {
    const lvl = userLevel + i
    if (lvl > MAX_LEVEL) break
    const xpNeeded  = xpForLevel(lvl)
    const xpTotal   = xpToReachLevel(lvl)
    const isCurrent = i === 0
    nextRows.push(`<tr class="${isCurrent ? 'prog-current' : ''}">
      <td>${isCurrent ? '👉 ' : ''}Nível ${lvl}${MILESTONES[lvl] ? ' ' + MILESTONES[lvl].icon : ''}</td>
      <td>${lvl < MAX_LEVEL ? fmtXP(xpNeeded) + ' XP' : '—'}</td>
      <td>${fmtXP(xpTotal)} XP</td>
    </tr>`)
  }

  const modal = document.createElement('div')
  modal.className = 'modal-overlay open'
  modal.id = 'xp-table-modal'
  modal.innerHTML = `
    <div class="modal-box modal-box--xp">
      <div class="modal-header">
        <h3>📊 Progressão de Nível</h3>
        <button class="close-btn" id="close-xp-table"><i data-lucide="x"></i></button>
      </div>
      <div class="modal-body xp-modal-body">

        <div class="xp-stat-grid">
          <div class="xp-stat-card">
            <div class="xp-stat-icon">🏅</div>
            <div class="xp-stat-label">Nível atual</div>
            <div class="xp-stat-value">${userLevel}</div>
          </div>
          <div class="xp-stat-card">
            <div class="xp-stat-icon">⚡</div>
            <div class="xp-stat-label">XP total</div>
            <div class="xp-stat-value">${fmtXP(userTotalXP)}</div>
          </div>
          <div class="xp-stat-card">
            <div class="xp-stat-icon">🎯</div>
            <div class="xp-stat-label">Falta para Nível ${Math.min(userLevel + 1, MAX_LEVEL)}</div>
            <div class="xp-stat-value">${userLevel < MAX_LEVEL ? fmtXP(getXPToNextLevel(userTotalXP)) : '—'}</div>
          </div>
          <div class="xp-stat-card">
            <div class="xp-stat-icon">📈</div>
            <div class="xp-stat-label">Progresso</div>
            <div class="xp-stat-value">${getProgressPercent(userTotalXP).toFixed(1)}%</div>
          </div>
        </div>

        <h4 class="xp-section-title">Próximos níveis</h4>
        <div class="xp-table-wrap">
          <table class="xp-table">
            <thead><tr><th>Nível</th><th>XP p/ subir</th><th>XP acumulado</th></tr></thead>
            <tbody>${nextRows.join('')}</tbody>
          </table>
        </div>

        <h4 class="xp-section-title">Histórico de XP</h4>
        <div class="xp-table-wrap">
          <table class="xp-table">
            <thead><tr><th>Data</th><th>Tarefa</th><th>Complexidade</th><th>XP</th></tr></thead>
            <tbody>${historyRows}</tbody>
          </table>
        </div>

      </div>
    </div>
  `
  document.body.appendChild(modal)
  if (typeof lucide !== 'undefined') lucide.createIcons()

  modal.querySelector('#close-xp-table').addEventListener('click', () => modal.remove())
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
}
