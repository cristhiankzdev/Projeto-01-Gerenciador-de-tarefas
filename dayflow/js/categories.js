import { getCategories, createCategory, updateCategory, deleteCategory, countTasksByCategory } from './db.js'

const EMOJIS = ['💼','🏠','❤️','📚','🎯','🎨','🏋️','🍕','✈️','🎮','💰','🌱','🎵','🔧','🐾','🌸','⚡','🎁','🏆','🎭','🔬','💡','🌊','🎪']
const COLORS = ['#4A7FC1','#7D9B76','#D95F5F','#8B6FBA','#C17E4A','#E8A838','#E87BB0','#5BB8D4','#8BC34A','#FF7043','#78909C','#A1887F']

let _userId = null
let _onChanged = null

export function initCategories(userId, onChanged) {
  _userId = userId
  _onChanged = onChanged

  const modal = document.getElementById('categories-modal')
  const closeBtn = document.getElementById('close-categories-modal')

  const manageBtn = document.getElementById('manage-cats-btn')
  manageBtn?.addEventListener('click', () => {
    modal.classList.add('open')
    renderCategoriesList()
  })

  closeBtn?.addEventListener('click', () => modal.classList.remove('open'))
  modal?.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('open')
  })

  document.getElementById('add-category-btn')?.addEventListener('click', () => {
    showCategoryForm()
  })
}

async function renderCategoriesList() {
  const list = document.getElementById('categories-list')
  list.innerHTML = '<p class="loading-text">Carregando...</p>'
  const cats = await getCategories(_userId)
  if (!cats.length) {
    list.innerHTML = '<p class="empty-text">Nenhuma categoria ainda.</p>'
    return
  }
  list.innerHTML = cats.map(c => `
    <div class="category-item" data-id="${c.id}">
      <span class="category-badge" style="background:${c.color}22;color:${c.color}">${c.emoji}</span>
      <span class="category-name">${c.name}</span>
      <div class="category-item-actions">
        <button class="icon-btn edit-cat-btn" data-id="${c.id}" title="Editar">✏️</button>
        <button class="icon-btn delete-cat-btn" data-id="${c.id}" data-name="${c.name}" title="Excluir">🗑️</button>
      </div>
    </div>
  `).join('')

  list.querySelectorAll('.edit-cat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cat = cats.find(c => c.id === btn.dataset.id)
      if (cat) showCategoryForm(cat)
    })
  })

  list.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', () =>
      confirmDeleteCategory(btn.dataset.id, btn.dataset.name)
    )
  })
}

function showCategoryForm(cat = null) {
  const form = document.getElementById('category-form')
  let selectedEmoji = cat?.emoji ?? EMOJIS[0]
  let selectedColor = cat?.color ?? COLORS[0]

  form.innerHTML = `
    <h4 style="font-family:Fraunces,serif;margin-bottom:12px">${cat ? 'Editar categoria' : 'Nova categoria'}</h4>
    <div class="form-group">
      <label>Nome</label>
      <input type="text" id="cat-name-input" value="${cat?.name ?? ''}" placeholder="Ex: Trabalho, Academia...">
    </div>
    <div class="form-group">
      <label>Emoji</label>
      <div class="emoji-grid">
        ${EMOJIS.map(e => `<button type="button" class="emoji-btn${selectedEmoji === e ? ' selected' : ''}" data-emoji="${e}">${e}</button>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Cor</label>
      <div class="color-grid">
        ${COLORS.map(c => `<button type="button" class="color-btn${selectedColor === c ? ' selected' : ''}" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
      </div>
    </div>
    <div class="form-row" style="margin-top:16px">
      <button type="button" class="btn-secondary" id="cancel-cat-form">Cancelar</button>
      <button type="button" class="btn-primary" id="save-cat-form">Salvar</button>
    </div>
  `
  form.style.display = 'block'

  form.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedEmoji = btn.dataset.emoji
    })
  })

  form.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'))
      btn.classList.add('selected')
      selectedColor = btn.dataset.color
    })
  })

  form.querySelector('#cancel-cat-form').addEventListener('click', () => {
    form.style.display = 'none'
  })

  form.querySelector('#save-cat-form').addEventListener('click', async () => {
    const name = document.getElementById('cat-name-input').value.trim()
    if (!name) {
      document.getElementById('cat-name-input').focus()
      return
    }
    if (cat) {
      await updateCategory(cat.id, { name, emoji: selectedEmoji, color: selectedColor })
    } else {
      await createCategory({ user_id: _userId, name, emoji: selectedEmoji, color: selectedColor })
    }
    form.style.display = 'none'
    renderCategoriesList()
    _onChanged?.()
  })

  form.querySelector('#cat-name-input').focus()
}

async function confirmDeleteCategory(id, name) {
  const count = await countTasksByCategory(id)
  const msg = count > 0
    ? `${count} tarefa(s) serão movidas para "Sem categoria". Confirmar exclusão de "${name}"?`
    : `Excluir a categoria "${name}"?`
  if (confirm(msg)) {
    await deleteCategory(id)
    document.getElementById('category-form').style.display = 'none'
    renderCategoriesList()
    _onChanged?.()
  }
}
