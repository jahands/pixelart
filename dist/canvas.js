/**
 * @type HTMLCanvasElement
 */
const canvas = document.getElementById("canvas")
const guide = document.getElementById("guide")
const colorInput = document.getElementById("colorInput")
const toggleGuide = document.getElementById("toggleGuide")
const clearButton = document.getElementById("clearButton")
const drawingContext = canvas.getContext("2d")

const CELL_SIDE_COUNT = 20
const cellPixelLength = canvas.width / CELL_SIDE_COUNT
const colorHistory = {}

// Set default color
colorInput.value = "#009578"

// Initialize the canvas background
drawingContext.fillStyle = "#ffffff"
drawingContext.fillRect(0, 0, canvas.width, canvas.height)

// Setup the guide
{
  guide.style.width = `${canvas.width}px`
  guide.style.height = `${canvas.height}px`
  guide.style.gridTemplateColumns = `repeat(${CELL_SIDE_COUNT}, 1fr)`
  guide.style.gridTemplateRows = `repeat(${CELL_SIDE_COUNT}, 1fr)`;

  [...Array(CELL_SIDE_COUNT ** 2)].forEach(() =>
    guide.insertAdjacentHTML("beforeend", "<div></div>")
  )
}

// Utils
function isCell(obj) {
  return obj
    && typeof obj.color === 'string'
    && typeof obj.x === 'number'
    && typeof obj.y === 'number'
}

function isCellArray(obj) {
  return Array.isArray(obj) && obj.every(isCell)
}

// Set up websocket
const pathname = window.location.pathname
const lastSegment = pathname.split("/").pop()
const wsUri = `wss://${window.location.host}/api/websocket/${lastSegment}`
console.log('wsUri:', wsUri)
let socket = new WebSocket(wsUri)

function onWsMessage(e) {
  const data = JSON.parse(e.data)
  if (isCellArray(data)) {
    for (const cell of data) {
      const { x, y, color } = cell
      fillCell(x, y, color)
    }
  } else if (isCell(data)) {
    const { x, y, color } = data
    fillCell(x, y, color)
  }

}

async function onClose() {
  // Sleep for 1 seconds and try to reconnect
  await new Promise(resolve => setTimeout(resolve, 1000))
  if (socket) {
    socket.close()
    socket.removeEventListener("close", onClose)
    socket.removeEventListener("message", onWsMessage)
    socket = null
  }
  socket = new WebSocket(wsUri)
  socket.addEventListener("close", onClose)
  socket.addEventListener("message", onWsMessage)
}

socket.addEventListener("close", onClose)
socket.addEventListener("message", onWsMessage)

function sendToServer(cell) {
  socket.send(JSON.stringify(cell))
}

function handleCanvasMousedown(e) {
  // Ensure user is using their primary mouse button
  if (e.button !== 0) {
    return
  }
  console.log(window.location.pathname)

  const canvasBoundingRect = canvas.getBoundingClientRect()
  const x = e.clientX - canvasBoundingRect.left
  const y = e.clientY - canvasBoundingRect.top
  const cellX = Math.floor(x / cellPixelLength)
  const cellY = Math.floor(y / cellPixelLength)
  const currentColor = colorHistory[`${cellX}_${cellY}`]

  if (e.ctrlKey) {
    if (currentColor) {
      colorInput.value = currentColor
    }
  } else {
    fillCell(cellX, cellY)
    sendToServer({ x: cellX, y: cellY, color: colorInput.value })
  }
}

function handleClearButtonClick() {
  const yes = confirm("Are you sure you wish to clear the canvas?")

  if (!yes) return

  drawingContext.fillStyle = "#ffffff"
  drawingContext.fillRect(0, 0, canvas.width, canvas.height)
}

function handleToggleGuideChange() {
  guide.style.display = toggleGuide.checked ? null : "none"
}

function fillCell(cellX, cellY, color = colorInput.value) {
  const startX = cellX * cellPixelLength
  const startY = cellY * cellPixelLength

  drawingContext.fillStyle = color
  drawingContext.fillRect(startX, startY, cellPixelLength, cellPixelLength)
  colorHistory[`${cellX}_${cellY}`] = colorInput.value
}

canvas.addEventListener("mousedown", handleCanvasMousedown)
clearButton.addEventListener("click", handleClearButtonClick)
toggleGuide.addEventListener("change", handleToggleGuideChange)
