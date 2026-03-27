import { getEvents, setEvent, deleteEvent } from './db.js'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS = ['D','S','T','Q','Q','S','S']
const EVENT_COLORS = ['#4A7FC1','#7D9B76','#D95F5F','#8B6FBA','#E8A838','#C17E4A','#E87BB0','#5BB8D4']

let userId = null
let viewYear = null
let viewMonth = null
let events = {}   // { 'YYYY-MM-DD': { color, description } }
let activePopup = null

export function initCalendar(uid) {
  userId = uid
  const now = new Date()
  viewYear = now.getFullYear()
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
  try {
    const list = await getEvents(userId, viewYear, viewMonth)
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

  const firstDay  = new Date(viewYear, viewMonth - 1, 1).getDay()
  const daysInMonth  = new Date(viewYear, viewMonth, 0).getDate()
  const prevDays  = new Date(viewYear, viewMonth - 1, 0).getDate()
  const today = new Date()

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const cell = document.createElement('div')
    cell.className = 'cal-day cal-other-month'
    cell.textContent = prevDays - i
    grid.appendChild(cell)
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const cell = document.createElement('button')
    cell.className = 'cal-day'
    cell.dataset.date = dateStr

    const inner = document.createElement('span')
    inner.className = 'cal-day-inner'
    inner.textContent = d
    cell.appendChild(inner)

    const isToday = today.getFullYear() === viewYear &&
                    today.getMonth() + 1 === viewMonth &&
                    today.getDate() === d
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

    grid.appendChild(cell)
  }

  // Next month leading days
  const total = firstDay + daysInMonth
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7)
  for (let d = 1; d <= remaining; d++) {
    const cell = document.createElement('div')
    cell.className = 'cal-day cal-other-month'
    cell.textContent = d
    grid.appendChild(cell)
  }
}

function openPopup(cell, dateStr) {
  closePopup()
  const ev = events[dateStr] || { color: EVENT_COLORS[0], description: '' }

  const popup = document.createElement('div')
  popup.className = 'cal-event-popup'
  popup.innerHTML = `
    <input type="text" class="cal-popup-input" placeholder="O que acontece nesse dia?" value="${ev.description}" maxlength="60">
    <div class="cal-popup-colors">
      ${EVENT_COLORS.map(c =>
        `<button class="cal-color-btn${ev.color === c ? ' selected' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`
      ).join('')}
    </div>
    <div class="cal-popup-actions">
      <button class="cal-popup-delete">Remover</button>
      <button class="cal-popup-save">Salvar</button>
    </div>
  `

  let selectedColor = ev.color

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
    await setEvent(userId, dateStr, { color: selectedColor, description })
    events[dateStr] = { color: selectedColor, description }
    closePopup()
    renderGrid()
  })

  popup.querySelector('.cal-popup-delete').addEventListener('click', async e => {
    e.stopPropagation()
    await deleteEvent(userId, dateStr)
    delete events[dateStr]
    closePopup()
    renderGrid()
  })

  // Append to body and position with fixed coords to avoid clipping
  document.body.appendChild(popup)
  activePopup = popup

  const rect = cell.getBoundingClientRect()
  const popupW = 210
  let left = rect.left + rect.width / 2 - popupW / 2
  left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8))

  // Show above if there's not enough space below
  const spaceBelow = window.innerHeight - rect.bottom
  if (spaceBelow < 180) {
    popup.style.bottom = (window.innerHeight - rect.top + 6) + 'px'
  } else {
    popup.style.top = (rect.bottom + 6) + 'px'
  }
  popup.style.left = left + 'px'

  setTimeout(() => popup.querySelector('.cal-popup-input').focus(), 10)
}

function closePopup() {
  if (activePopup) {
    activePopup.remove()
    activePopup = null
  }
}
