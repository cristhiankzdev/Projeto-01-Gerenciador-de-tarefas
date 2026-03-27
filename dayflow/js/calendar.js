import { getEvents, toggleEvent } from './db.js'

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAY_ABBR = ['D','S','T','Q','Q','S','S']

let userId = null
let viewYear = null
let viewMonth = null
let markedDates = new Set()

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
}

async function loadAndRender() {
  document.getElementById('cal-month-label').textContent =
    `${MONTH_NAMES[viewMonth - 1]} ${viewYear}`
  try {
    const events = await getEvents(userId, viewYear, viewMonth)
    markedDates = new Set(events.map(e => e.date))
  } catch {
    markedDates = new Set()
  }
  renderGrid()
}

function renderGrid() {
  const grid = document.getElementById('cal-grid')
  grid.innerHTML = ''

  // Weekday headers
  DAY_ABBR.forEach(d => {
    const h = document.createElement('div')
    h.className = 'cal-dow'
    h.textContent = d
    grid.appendChild(h)
  })

  const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate()
  const today = new Date()

  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div')
    blank.className = 'cal-day cal-blank'
    grid.appendChild(blank)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const cell = document.createElement('button')
    cell.className = 'cal-day'
    cell.textContent = d

    const isToday = today.getFullYear() === viewYear &&
                    today.getMonth() + 1 === viewMonth &&
                    today.getDate() === d
    if (isToday) cell.classList.add('cal-today')
    if (markedDates.has(dateStr)) cell.classList.add('cal-marked')

    cell.addEventListener('click', async () => {
      const result = await toggleEvent(userId, dateStr)
      if (result) {
        markedDates.add(dateStr)
        cell.classList.add('cal-marked')
      } else {
        markedDates.delete(dateStr)
        cell.classList.remove('cal-marked')
      }
    })

    grid.appendChild(cell)
  }
}
