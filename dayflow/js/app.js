import { getSession, signOut } from './auth.js'
import { getTasks, createTask, updateTask, deleteTask, getCategories, getNote, saveNote, getProfile, updateProfile, archiveTask, getArchivedTasks } from './db.js'
import { launchConfetti } from './confetti.js'
import { initCategories } from './categories.js'
import { initCalendar } from './calendar.js'

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null
let categories = []
let tasks = []
let activeCategoryFilter = 'all'
let editingTask = null
let editingDate = null
let modalSteps = []
let notesDebounce = null

const TIPS = [
  'Cada pequeno passo te aproxima do seu grande objetivo.',
  'Hoje é uma nova oportunidade para fazer algo incrível.',
  'A consistência é a chave do sucesso. Continue!',
  'Você é mais forte do que imagina. Vai em frente!',
  'Foque no progresso, não na perfeição.',
  'Um dia de cada vez. Você consegue!',
  'Suas tarefas de hoje constroem seu amanhã.',
  'Pequenas conquistas diárias criam grandes resultados.',
  'Organize seu dia e conquiste seus sonhos.',
  'Cada tarefa concluída é uma vitória. Celebre!',
  'O segredo é começar. Você já está no caminho certo.',
  'Produtividade com leveza: é assim que se chega longe.',
  'Cuide de você enquanto cuida das suas tarefas.',
  'Um passo de cada vez leva ao topo.',
  'Seu esforço de hoje será sua recompensa de amanhã.',
]

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── Date helpers ──────────────────────────────────────────────────────────────
function localDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getGridDates() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i - 2)
    return d
  })
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const session = await getSession()
  if (!session) {
    window.location.href = 'index.html'
    return
  }
  currentUser = session.user

  const profile = await getProfile(currentUser.id)
  document.getElementById('user-name').textContent =
    profile?.name ?? currentUser.email.split('@')[0]

  await loadCategories()

  initCategories(currentUser.id, async () => {
    await loadCategories()
    await loadAndRenderTasks()
  })

  renderGrid()
  await loadAndRenderTasks()
  renderDailyTip()
  await initNotes()
  initCalendar(currentUser.id)

  document.getElementById('logout-btn').addEventListener('click', signOut)
  document.getElementById('archive-btn').addEventListener('click', openArchiveModal)
  initTaskModal()
  initSettingsModal()
}

// ── Daily tip ─────────────────────────────────────────────────────────────────
function renderDailyTip() {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const dayOfYear = Math.floor((Date.now() - start) / 86400000)
  document.getElementById('daily-tip-text').textContent = TIPS[dayOfYear % TIPS.length]
}

// ── Categories ────────────────────────────────────────────────────────────────
async function loadCategories() {
  categories = await getCategories(currentUser.id)
  renderCategoryPills()
}

function renderCategoryPills() {
  const container = document.getElementById('category-pills')
  container.innerHTML = [
    `<button class="pill${activeCategoryFilter === 'all' ? ' active' : ''}" data-cat="all">Todas</button>`,
    ...categories.map(c =>
      `<button class="pill${activeCategoryFilter === c.id ? ' active' : ''}" data-cat="${c.id}" style="--cat-color:${c.color}">${c.emoji} ${c.name}</button>`
    ),
  ].join('')

  container.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      activeCategoryFilter = btn.dataset.cat
      renderCategoryPills()
      renderTasksInGrid()
    })
  })
}

// ── Grid ──────────────────────────────────────────────────────────────────────
function renderGrid() {
  const dates = getGridDates()
  const grid = document.getElementById('day-grid')
  grid.innerHTML = dates.map((date, i) => {
    const isToday = i === 2
    const isPast = i < 2
    const dateStr = localDateStr(date)
    return `
      <div class="day-column${isToday ? ' today' : ''}${isPast ? ' past' : ''}" data-date="${dateStr}">
        <div class="day-header">
          ${isToday ? '<span class="today-badge">Hoje</span>' : ''}
          <span class="day-name">${DAY_NAMES[date.getDay()]}</span>
          <span class="day-number">${date.getDate()}</span>
          <span class="day-month">${MONTH_NAMES[date.getMonth()]}</span>
        </div>
        <button class="add-task-btn" data-date="${dateStr}" title="Adicionar tarefa">＋</button>
        <div class="task-list" id="tasks-${dateStr}"></div>
      </div>
    `
  }).join('')

  grid.querySelectorAll('.add-task-btn').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(null, btn.dataset.date))
  })

  // Drag & drop — drop zones
  grid.querySelectorAll('.day-column').forEach(col => {
    const list = col.querySelector('.task-list')
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over') })
    col.addEventListener('dragleave', e => {
      if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over')
    })
    col.addEventListener('drop', async e => {
      e.preventDefault()
      col.classList.remove('drag-over')
      const taskId = e.dataTransfer.getData('taskId')
      const newDate = col.dataset.date
      if (!taskId) return
      const task = tasks.find(t => t.id === taskId)
      if (!task || task.date === newDate) return
      const updated = await updateTask(taskId, { date: newDate })
      const i = tasks.findIndex(t => t.id === taskId)
      if (i !== -1) tasks[i] = updated
      renderTasksInGrid()
      showToast(`Tarefa movida para ${DAY_NAMES[new Date(newDate + 'T12:00:00').getDay()]}`)
    })
  })
}

// ── Tasks loading ─────────────────────────────────────────────────────────────
async function loadAndRenderTasks() {
  const dates = getGridDates()
  tasks = await getTasks(currentUser.id, localDateStr(dates[0]), localDateStr(dates[4]))
  renderTasksInGrid()
}

function renderTasksInGrid() {
  document.querySelectorAll('.task-list').forEach(el => (el.innerHTML = ''))
  const filtered = activeCategoryFilter === 'all'
    ? tasks
    : tasks.filter(t => t.category_id === activeCategoryFilter)

  // Group by date to get stagger index
  const byDate = {}
  filtered.forEach(task => {
    if (!byDate[task.date]) byDate[task.date] = []
    byDate[task.date].push(task)
  })

  Object.values(byDate).forEach(group => {
    group.forEach((task, idx) => {
      const container = document.getElementById(`tasks-${task.date}`)
      if (!container) return
      container.appendChild(createTaskElement(task, idx))
    })
  })
}

// ── Task element ──────────────────────────────────────────────────────────────
function createTaskElement(task, idx) {
  const div = document.createElement('div')
  const cat = task.categories
  const emoji = cat?.emoji ?? '📌'
  const dotClass = { alta: 'p-alta', media: 'p-media', baixa: 'p-baixa' }[task.priority] ?? 'p-media'

  div.className = `task-card${task.completed ? ' completed' : ''}`
  div.dataset.id = task.id
  div.style.animationDelay = `${idx * 0.05}s`

  if (task.type === 'steps' && Array.isArray(task.steps) && task.steps.length) {
    const steps = task.steps
    const current = task.current_step ?? 0
    const total = steps.length
    const progress = task.completed ? 100 : Math.round((current / total) * 100)

    div.innerHTML = `
      <div class="tc-row">
        <span class="tc-emoji">${emoji}</span>
        <span class="tc-title${task.completed ? ' done' : ''}">${task.title}</span>
        <div class="tc-progress">
          <div class="tc-prog-bar"><div class="tc-prog-fill" style="width:${progress}%"></div></div>
          <span class="tc-prog-label">${task.completed ? total : current}/${total}</span>
        </div>
        <span class="tc-dot ${dotClass}"></span>
        <button class="tc-expand-btn" title="Ver etapas">▾</button>
        <button class="tc-arrow move-next" title="Próximo dia">→</button>
      </div>
      <div class="tc-steps-list" hidden>
        ${steps.map((s, i) => {
          const isDone = task.completed || i < current
          const isActive = !task.completed && i === current
          return `<div class="tc-step-item${isDone ? ' done' : isActive ? ' active-step' : ' pending'}">
            <span class="tc-step-icon">${isDone ? '✓' : isActive ? '→' : '○'}</span>
            <span>${s.title}</span>
          </div>`
        }).join('')}
      </div>
    `

    const tcRow = div.querySelector('.tc-row')
    if (!task.completed) {
      tcRow.addEventListener('click', e => {
        if (e.target.closest('.tc-arrow, .tc-expand-btn')) return
        advanceStep(task)
      })
    } else {
      tcRow.addEventListener('click', e => {
        if (e.target.closest('.tc-arrow, .tc-expand-btn')) return
        openTaskModal(task)
      })
    }

    div.querySelector('.tc-expand-btn').addEventListener('click', e => {
      e.stopPropagation()
      const list = div.querySelector('.tc-steps-list')
      list.hidden = !list.hidden
      e.currentTarget.textContent = list.hidden ? '▾' : '▴'
    })

  } else {
    div.innerHTML = `
      <div class="tc-row">
        <span class="tc-emoji">${emoji}</span>
        <span class="tc-title${task.completed ? ' done' : ''}">${task.title}</span>
        <span class="tc-dot ${dotClass}"></span>
        ${task.completed ? '<button class="tc-archive-btn" title="Arquivar">📦</button>' : ''}
        <button class="check-btn${task.completed ? ' checked' : ''}" title="${task.completed ? 'Desmarcar' : 'Concluir'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path class="check-path" d="M5 13l4 4L19 7"/>
          </svg>
        </button>
        ${!task.completed ? '<button class="tc-arrow move-next" title="Próximo dia">→</button>' : ''}
      </div>
    `

    div.querySelector('.check-btn').addEventListener('click', e => {
      e.stopPropagation()
      toggleComplete(task, e.currentTarget)
    })

    div.querySelector('.tc-row').addEventListener('click', e => {
      if (e.target.closest('.check-btn, .tc-arrow, .tc-archive-btn')) return
      openTaskModal(task)
    })

    div.querySelector('.tc-archive-btn')?.addEventListener('click', async e => {
      e.stopPropagation()
      await archiveTask(task.id)
      tasks = tasks.filter(t => t.id !== task.id)
      renderTasksInGrid()
      showToast('Tarefa arquivada')
    })
  }

  div.querySelector('.move-next')?.addEventListener('click', e => { e.stopPropagation(); moveTaskDay(task, 1) })

  // Drag & drop
  div.draggable = true
  div.addEventListener('dragstart', e => {
    e.dataTransfer.setData('taskId', task.id)
    div.classList.add('dragging')
  })
  div.addEventListener('dragend', () => div.classList.remove('dragging'))

  return div
}

// ── Toggle complete ────────────────────────────────────────────────────────────
async function toggleComplete(task, btn) {
  const newCompleted = !task.completed
  if (newCompleted) {
    btn.classList.add('checked')
    const rect = btn.getBoundingClientRect()
    launchConfetti(rect.left + rect.width / 2, rect.top)
  }
  const updated = await updateTask(task.id, {
    completed: newCompleted,
    completed_at: newCompleted ? new Date().toISOString() : null,
  })
  const i = tasks.findIndex(t => t.id === task.id)
  if (i !== -1) tasks[i] = updated
  renderTasksInGrid()
}

// ── Advance step ──────────────────────────────────────────────────────────────
async function advanceStep(task) {
  const steps = task.steps ?? []
  const nextStep = (task.current_step ?? 0) + 1
  const isComplete = nextStep >= steps.length

  const cardEl = document.querySelector(`.task-card[data-id="${task.id}"]`)
  cardEl?.classList.add('step-advance')
  setTimeout(() => cardEl?.classList.remove('step-advance'), 350)

  if (isComplete) {
    const rect = cardEl?.getBoundingClientRect()
    launchConfetti(
      rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      rect?.top ?? window.innerHeight / 3
    )
  }

  const updated = await updateTask(task.id, {
    current_step: nextStep,
    completed: isComplete,
    completed_at: isComplete ? new Date().toISOString() : null,
  })
  const i = tasks.findIndex(t => t.id === task.id)
  if (i !== -1) tasks[i] = updated
  renderTasksInGrid()
}

// ── Move task ─────────────────────────────────────────────────────────────────
async function moveTaskDay(task, direction) {
  const d = new Date(task.date + 'T12:00:00')
  d.setDate(d.getDate() + direction)
  const newDate = localDateStr(d)
  const oldDate = task.date

  const updated = await updateTask(task.id, { date: newDate })
  const i = tasks.findIndex(t => t.id === task.id)
  if (i !== -1) tasks[i] = updated
  renderTasksInGrid()

  showToast(`Tarefa movida para ${DAY_NAMES[d.getDay()]}`, () => {
    updateTask(task.id, { date: oldDate }).then(reverted => {
      const j = tasks.findIndex(t => t.id === task.id)
      if (j !== -1) tasks[j] = reverted
      renderTasksInGrid()
    })
  })
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, undoFn = null) {
  const container = document.getElementById('toast-container')
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.innerHTML = `
    <span>${message}</span>
    ${undoFn ? '<button class="toast-undo">Desfazer</button>' : ''}
  `
  container.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))

  let timer = setTimeout(() => remove(), 5000)

  if (undoFn) {
    toast.querySelector('.toast-undo').addEventListener('click', () => {
      clearTimeout(timer)
      undoFn()
      remove()
    })
  }

  function remove() {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }
}

// ── Task modal ────────────────────────────────────────────────────────────────
function initTaskModal() {
  const modal = document.getElementById('task-modal')
  const closeBtn = document.getElementById('close-task-modal')
  const cancelBtn = document.getElementById('cancel-task-btn')
  const typeToggle = document.getElementById('task-type-toggle')
  const addStepBtn = document.getElementById('add-step-btn')
  const stepInput = document.getElementById('step-input')

  closeBtn.addEventListener('click', closeModal)
  cancelBtn.addEventListener('click', closeModal)
  modal.addEventListener('click', e => { if (e.target === modal) closeModal() })

  typeToggle.addEventListener('change', () => {
    document.getElementById('steps-section').style.display = typeToggle.checked ? 'block' : 'none'
  })

  addStepBtn.addEventListener('click', addStep)
  stepInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addStep() } })

  document.getElementById('save-task-btn').addEventListener('click', saveTask)
  document.getElementById('delete-task-btn').addEventListener('click', () => confirmDeleteTask(editingTask))

  // Inline category creation
  document.getElementById('add-cat-inline-btn').addEventListener('click', () => {
    const form = document.getElementById('cat-inline-form')
    form.style.display = form.style.display === 'none' ? 'flex' : 'none'
    if (form.style.display === 'flex') renderInlineCatForm()
  })
}

// ── Inline category form ───────────────────────────────────────────────────────
const INLINE_EMOJIS = ['💼','🏠','❤️','📚','🎯','🎨','🏋️','🍕','✈️','🎮','💰','🌱']
const INLINE_COLORS = ['#4A7FC1','#7D9B76','#D95F5F','#8B6FBA','#C17E4A','#E8A838','#E87BB0','#5BB8D4']

function renderInlineCatForm() {
  const form = document.getElementById('cat-inline-form')
  let selEmoji = INLINE_EMOJIS[0]
  let selColor = INLINE_COLORS[0]

  form.innerHTML = `
    <input type="text" id="cat-inline-name" placeholder="Nome da categoria" maxlength="30">
    <div class="cat-inline-emoji-row">
      ${INLINE_EMOJIS.map(e => `<button type="button" class="cat-inline-emoji-btn${e === selEmoji ? ' selected' : ''}" data-emoji="${e}">${e}</button>`).join('')}
    </div>
    <div class="cat-inline-color-row">
      ${INLINE_COLORS.map(c => `<button type="button" class="cat-inline-color-btn${c === selColor ? ' selected' : ''}" data-color="${c}" style="background:${c}"></button>`).join('')}
    </div>
    <div class="cat-inline-actions">
      <button type="button" class="btn-secondary" id="cat-inline-cancel" style="padding:6px 12px;font-size:13px">Cancelar</button>
      <button type="button" class="btn-primary" id="cat-inline-save" style="padding:6px 14px;font-size:13px">Salvar</button>
    </div>
  `

  form.querySelectorAll('.cat-inline-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.cat-inline-emoji-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selEmoji = btn.dataset.emoji
    })
  })
  form.querySelectorAll('.cat-inline-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.cat-inline-color-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selColor = btn.dataset.color
    })
  })

  form.querySelector('#cat-inline-cancel').addEventListener('click', () => {
    form.style.display = 'none'
  })

  form.querySelector('#cat-inline-save').addEventListener('click', async () => {
    const name = document.getElementById('cat-inline-name').value.trim()
    if (!name) { document.getElementById('cat-inline-name').focus(); return }
    const { createCategory } = await import('./db.js')
    const newCat = await createCategory({ user_id: currentUser.id, name, emoji: selEmoji, color: selColor })
    categories.push(newCat)
    renderCategoryPills()
    // Rebuild select and select new cat
    const catSelect = document.getElementById('task-category')
    const opt = document.createElement('option')
    opt.value = newCat.id
    opt.textContent = `${newCat.emoji} ${newCat.name}`
    catSelect.appendChild(opt)
    catSelect.value = newCat.id
    form.style.display = 'none'
    showToast(`Categoria "${name}" criada!`)
  })

  document.getElementById('cat-inline-name').focus()
}

function addStep() {
  const input = document.getElementById('step-input')
  const val = input.value.trim()
  if (!val) return
  modalSteps.push({ title: val, completed: false })
  input.value = ''
  input.focus()
  renderModalSteps()
}

function openTaskModal(task = null, date = null) {
  editingTask = task
  editingDate = date ?? task?.date ?? localDateStr(new Date())
  modalSteps = task?.steps ? JSON.parse(JSON.stringify(task.steps)) : []

  document.getElementById('modal-title').textContent = task ? 'Editar Tarefa' : 'Nova Tarefa'
  document.getElementById('delete-task-btn').style.display = task ? 'block' : 'none'
  const archiveModalBtn = document.getElementById('archive-task-btn')
  archiveModalBtn.style.display = task?.completed ? 'block' : 'none'

  const catSelect = document.getElementById('task-category')
  catSelect.innerHTML = `<option value="">📌 Sem categoria</option>` +
    categories.map(c =>
      `<option value="${c.id}"${task?.category_id === c.id ? ' selected' : ''}>${c.emoji} ${c.name}</option>`
    ).join('')

  document.getElementById('task-title-input').value = task?.title ?? ''
  document.getElementById('task-priority').value = task?.priority ?? 'media'
  document.getElementById('task-notes').value = task?.notes ?? ''

  const isSteps = task?.type === 'steps'
  document.getElementById('task-type-toggle').checked = isSteps
  document.getElementById('steps-section').style.display = isSteps ? 'block' : 'none'

  renderModalSteps()
  document.getElementById('task-modal').classList.add('open')
  setTimeout(() => document.getElementById('task-title-input').focus(), 50)
}

function renderModalSteps() {
  const list = document.getElementById('steps-list')
  if (!modalSteps.length) {
    list.innerHTML = '<p class="empty-text" style="font-size:13px">Adicione pelo menos 2 etapas.</p>'
    return
  }
  list.innerHTML = modalSteps.map((s, i) => `
    <div class="step-row">
      <span class="step-num">${i + 1}.</span>
      <span class="step-text">${s.title}</span>
      <button type="button" class="remove-step icon-btn" data-idx="${i}">✕</button>
    </div>
  `).join('')
  list.querySelectorAll('.remove-step').forEach(btn => {
    btn.addEventListener('click', () => {
      modalSteps.splice(Number(btn.dataset.idx), 1)
      renderModalSteps()
    })
  })
}

async function saveTask() {
  const titleInput = document.getElementById('task-title-input')
  const title = titleInput.value.trim()
  if (!title) {
    titleInput.focus()
    titleInput.classList.add('input-error')
    titleInput.addEventListener('input', () => titleInput.classList.remove('input-error'), { once: true })
    return
  }

  const isSteps = document.getElementById('task-type-toggle').checked
  if (isSteps && modalSteps.length < 2) {
    showToast('Adicione pelo menos 2 etapas para continuar.')
    return
  }

  const data = {
    user_id: currentUser.id,
    title,
    category_id: document.getElementById('task-category').value || null,
    priority: document.getElementById('task-priority').value,
    notes: document.getElementById('task-notes').value.trim() || null,
    date: editingDate,
    type: isSteps ? 'steps' : 'simple',
    steps: isSteps ? modalSteps : null,
    current_step: editingTask?.current_step ?? 0,
  }

  if (editingTask) {
    const updated = await updateTask(editingTask.id, data)
    const i = tasks.findIndex(t => t.id === editingTask.id)
    if (i !== -1) tasks[i] = updated
  } else {
    const created = await createTask(data)
    tasks.push(created)
  }

  closeModal()
  renderTasksInGrid()
}

async function confirmDeleteTask(task) {
  if (!task) return
  if (!confirm(`Excluir a tarefa "${task.title}"?`)) return
  await deleteTask(task.id)
  tasks = tasks.filter(t => t.id !== task.id)
  closeModal()
  renderTasksInGrid()
}

function closeModal() {
  document.getElementById('task-modal').classList.remove('open')
  editingTask = null
  modalSteps = []
}

// ── Settings modal ─────────────────────────────────────────────────────────────
function initSettingsModal() {
  const modal = document.getElementById('settings-modal')
  document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-name-input').value =
      document.getElementById('user-name').textContent
    modal.classList.add('open')
  })
  document.getElementById('close-settings-modal').addEventListener('click', () => modal.classList.remove('open'))
  document.getElementById('cancel-settings-btn').addEventListener('click', () => modal.classList.remove('open'))
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open') })

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const name = document.getElementById('settings-name-input').value.trim()
    if (!name) return
    await updateProfile(currentUser.id, name)
    document.getElementById('user-name').textContent = name
    modal.classList.remove('open')
    showToast('Perfil atualizado!')
  })
}

// ── Notes ─────────────────────────────────────────────────────────────────────
async function initNotes() {
  const content = await getNote(currentUser.id)
  const textarea = document.getElementById('notes-textarea')
  textarea.value = content
  const indicator = document.getElementById('notes-saved')

  textarea.addEventListener('input', () => {
    clearTimeout(notesDebounce)
    notesDebounce = setTimeout(async () => {
      await saveNote(currentUser.id, textarea.value)
      indicator.style.opacity = '1'
      setTimeout(() => (indicator.style.opacity = '0'), 2000)
    }, 800)
  })
}

// ── Archive modal ─────────────────────────────────────────────────────────────
async function openArchiveModal() {
  const modal = document.getElementById('archive-modal')
  const list  = document.getElementById('archive-list')
  modal.classList.add('open')
  list.innerHTML = '<p class="loading-text">Carregando...</p>'

  const archived = await getArchivedTasks(currentUser.id)

  if (!archived.length) {
    list.innerHTML = '<p class="empty-text">Nenhuma tarefa arquivada.</p>'
    return
  }

  list.innerHTML = ''
  archived.forEach(task => {
    const cat = task.categories
    const item = document.createElement('div')
    item.className = 'archive-item'
    item.innerHTML = `
      <span class="archive-emoji">${cat?.emoji ?? '📌'}</span>
      <div class="archive-info">
        <span class="archive-title">${task.title}</span>
        <span class="archive-date">${task.date}</span>
      </div>
      <button class="archive-delete-btn" data-id="${task.id}" title="Excluir permanentemente">🗑️</button>
    `
    item.querySelector('.archive-delete-btn').addEventListener('click', async () => {
      await deleteTask(task.id)
      item.remove()
      if (!list.children.length) list.innerHTML = '<p class="empty-text">Nenhuma tarefa arquivada.</p>'
    })
    list.appendChild(item)
  })

  document.getElementById('close-archive-modal').onclick = () => modal.classList.remove('open')
  modal.onclick = e => { if (e.target === modal) modal.classList.remove('open') }
}

// ── Start ─────────────────────────────────────────────────────────────────────
init()
