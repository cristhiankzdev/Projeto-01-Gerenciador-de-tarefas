import { getEvents, setEvent, deleteEvent } from './db.js'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS = ['D','S','T','Q','Q','S','S']
const EVENT_COLORS = ['#4A7FC1','#7D9B76','#D95F5F','#8B6FBA','#E8A838','#C17E4A','#E87BB0','#5BB8D4']

let userId = null
let viewYear = null
let viewMonth = null
let events = {}   // { 'YYYY-MM-DD': { color, description } }
let activePopup = null
let onAddTask = null
let onEventsChange = null

function localDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Returns the first and last Date shown in the calendar grid (including overflow days)
function gridBounds(year, month) {
  const firstOfMonth = new Date(year, month - 1, 1)
  const lastOfMonth  = new Date(year, month, 0)
  const startOffset  = firstOfMonth.getDay()                    // days from prev month
  const endOffset    = (6 - lastOfMonth.getDay()) % 7 === 0     // days from next month
    ? 0 : 6 - lastOfMonth.getDay()

  const start = new Date(firstOfMonth)
  start.setDate(start.getDate() - startOffset)

  const end = new Date(lastOfMonth)
  end.setDate(end.getDate() + endOffset)

  return { start, end }
}

export function initCalendar(uid, taskCallback = null, eventsChangeCallback = null) {
  userId = uid
  onAddTask = taskCallback
  onEventsChange = eventsChangeCallback
  const now = new Date()
  viewYear  = now.getFullYear()
  viewMonth = now.getMonth() + 1
  loadAndRender()

  document.getElementById('cal-prev').addEventListener('click', () => {
    viewMonth--
    if (viewMonth < 1) { viewMonth = 12; viewYear-- }
    loadAndRender()
  })
  document.getElementById('cal-next').addEventListener('click', () => {
    viewMonth++
    if (viewMonth > 12) { viewMonth = 1; viewYear++ }
    loadAndRender()
  })

  document.addEventListener('click', e => {
    if (activePopup && !activePopup.contains(e.target) && !e.target.closest('.cal-day')) {
      closePopup()
    }
  })
}

async function loadAndRender() {
  document.getElementById('cal-month-label').textContent =
    `${MONTHS[viewMonth - 1]} de ${viewYear}`

  const { start, end } = gridBounds(viewYear, viewMonth)

  try {
    const list = await getEvents(userId, localDate(start), localDate(end))
    events = {}
    list.forEach(e => {
      events[e.date] = { color: e.color || '#4A7FC1', description: e.description || '' }
    })
  } catch {
    events = {}
  }
  renderGrid()
}

function renderGrid() {
  const grid = document.getElementById('cal-grid')
  grid.innerHTML = ''

  // Weekday headers
  DAYS.forEach(d => {
    const h = document.createElement('div')
    h.className = 'cal-dow'
    h.textContent = d
    grid.appendChild(h)
  })

  const firstOfMonth = new Date(viewYear, viewMonth - 1, 1)
  const lastOfMonth  = new Date(viewYear, viewMonth, 0)
  const prevDays     = new Date(viewYear, viewMonth - 1, 0).getDate()
  const startOffset  = firstOfMonth.getDay()
  const endOffset    = (6 - lastOfMonth.getDay()) % 7 === 0 ? 0 : 6 - lastOfMonth.getDay()
  const today        = new Date()

  // Previous month overflow
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevDays - i
    const d = new Date(viewYear, viewMonth - 2, day)
    grid.appendChild(makeDayCell(day, localDate(d), true))
  }

  // Current month
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    const dt = new Date(viewYear, viewMonth - 1, d)
    const dateStr = localDate(dt)
    const isToday = today.getFullYear() === viewYear &&
                    today.getMonth() + 1 === viewMonth &&
                    today.getDate() === d
    grid.appendChild(makeDayCell(d, dateStr, false, isToday))
  }

  // Next month overflow
  for (let d = 1; d <= endOffset; d++) {
    const dt = new Date(viewYear, viewMonth, d)
    grid.appendChild(makeDayCell(d, localDate(dt), true))
  }
}

function makeDayCell(dayNum, dateStr, otherMonth, isToday = false) {
  const cell = document.createElement('button')
  cell.className = 'cal-day' + (otherMonth ? ' cal-other-month' : '')
  cell.dataset.date = dateStr

  const inner = document.createElement('span')
  inner.className = 'cal-day-inner'
  inner.textContent = dayNum
  cell.appendChild(inner)

  if (isToday) cell.classList.add('cal-today')

  const ev = events[dateStr]
  if (ev) {
    cell.classList.add('cal-marked')
    inner.style.background = ev.color
    if (ev.description) cell.title = ev.description
  }

  cell.addEventListener('click', e => {
    e.stopPropagation()
    openPopup(cell, dateStr)
  })

  return cell
}

const EVENT_EMOJIS = ['📅','🎂','🎉','✈️','🏠','🏥','💼','🎓','⚽','🎵','🍽️','❤️','🎮','📚','🛒','💊']

function openPopup(cell, dateStr) {
  closePopup()
  const existingEv = events[dateStr] || null
  const ev = existingEv || { color: EVENT_COLORS[0], description: '', emoji: '' }

  const popup = document.createElement('div')
  popup.className = 'cal-event-popup'
  popup.innerHTML = `
    <div class="cal-popup-choice">
      <button class="cal-choice-btn cal-choice-task">📋 Tarefa</button>
      <button class="cal-choice-btn cal-choice-event">📅 Evento</button>
    </div>
    <div class="cal-popup-event-form"${existingEv ? '' : ' hidden'}>
      <input type="text" class="cal-popup-input" placeholder="O que acontece nesse dia?" value="${ev.description}" maxlength="60">
      <div class="cal-popup-emojis">
        <button class="cal-emoji-btn${!ev.emoji ? ' selected' : ''}" data-emoji="">—</button>
        ${EVENT_EMOJIS.map(em =>
          `<button class="cal-emoji-btn${ev.emoji === em ? ' selected' : ''}" data-emoji="${em}">${em}</button>`
        ).join('')}
      </div>
      <div class="cal-popup-colors">
        ${EVENT_COLORS.map(c =>
          `<button class="cal-color-btn${ev.color === c ? ' selected' : ''}" data-color="${c}" style="background:${c}"></button>`
        ).join('')}
      </div>
      <div class="cal-popup-actions">
        <button class="cal-popup-delete">Remover</button>
        <button class="cal-popup-save">Salvar</button>
      </div>
    </div>
  `

  let selectedColor = ev.color
  let selectedEmoji = ev.emoji || ''

  popup.querySelector('.cal-choice-task').addEventListener('click', e => {
    e.stopPropagation()
    closePopup()
    if (onAddTask) onAddTask(dateStr)
  })

  popup.querySelector('.cal-choice-event').addEventListener('click', e => {
    e.stopPropagation()
    const form = popup.querySelector('.cal-popup-event-form')
    form.hidden = false
    setTimeout(() => popup.querySelector('.cal-popup-input').focus(), 10)
  })

  popup.querySelectorAll('.cal-emoji-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      popup.querySelectorAll('.cal-emoji-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedEmoji = btn.dataset.emoji
    })
  })

  popup.querySelectorAll('.cal-color-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      popup.querySelectorAll('.cal-color-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedColor = btn.dataset.color
    })
  })

  popup.querySelector('.cal-popup-save').addEventListener('click', async e => {
    e.stopPropagation()
    const description = popup.querySelector('.cal-popup-input').value.trim()
    await setEvent(userId, dateStr, { color: selectedColor, description, emoji: selectedEmoji })
    events[dateStr] = { color: selectedColor, description, emoji: selectedEmoji }
    closePopup()
    renderGrid()
    if (onEventsChange) onEventsChange()
  })

  popup.querySelector('.cal-popup-delete').addEventListener('click', async e => {
    e.stopPropagation()
    await deleteEvent(userId, dateStr)
    delete events[dateStr]
    closePopup()
    renderGrid()
    if (onEventsChange) onEventsChange()
  })

  document.body.appendChild(popup)
  activePopup = popup

  const rect = cell.getBoundingClientRect()
  const popupW = 220
  let left = rect.left + rect.width / 2 - popupW / 2
  left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8))

  const spaceBelow = window.innerHeight - rect.bottom
  if (spaceBelow < 200) {
    popup.style.bottom = (window.innerHeight - rect.top + 6) + 'px'
  } else {
    popup.style.top = (rect.bottom + 6) + 'px'
  }
  popup.style.left = left + 'px'

  if (existingEv) setTimeout(() => popup.querySelector('.cal-popup-input').focus(), 10)
}

function closePopup() {
  if (activePopup) {
    activePopup.remove()
    activePopup = null
  }
}
