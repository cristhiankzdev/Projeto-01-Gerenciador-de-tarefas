export function launchConfetti(originX, originY) {
  const canvas = document.getElementById('confetti-canvas')
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.display = 'block'

  const colors = ['#C17E4A', '#7D9B76', '#D95F5F', '#E8A838', '#8B6FBA', '#4A7FC1']
  const particles = Array.from({ length: 40 }, () => ({
    x: originX ?? canvas.width / 2,
    y: originY ?? canvas.height / 3,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 8 - 4,
    size: Math.random() * 8 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    opacity: 1,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }))

  const duration = 1500
  const start = Date.now()
  let frame

  function draw() {
    const elapsed = Date.now() - start
    if (elapsed > duration) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.style.display = 'none'
      cancelAnimationFrame(frame)
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.vy += 0.3
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed
      p.opacity = Math.max(0, 1 - elapsed / duration)
      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.fillStyle = p.color
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      }
      ctx.restore()
    })
    frame = requestAnimationFrame(draw)
  }

  cancelAnimationFrame(frame)
  draw()
}
