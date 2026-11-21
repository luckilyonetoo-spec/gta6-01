// input.js — keyboard and mouse state, read once a frame by the player and the car.
// Nothing here knows about the game: it only reports what is held and what was pressed.

SB.createInput = function createInput(canvas) {
  const keys = {};
  const pressed = {}; // keys pressed since the last frame's read
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let mousePressed = false; // a click since the last read
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    dragging = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    mousePressed = true;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  // Keep the page from selecting text while the player drags to look around.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    held(code) { return !!keys[code]; },
    // True once, the frame after the key went down. Reading it consumes it, so a
    // single press fires exactly one action even when the frame runs the world
    // in several simulation steps.
    wasPressed(code) {
      const v = !!pressed[code];
      pressed[code] = false;
      return v;
    },
    mouseDown() { return mouseDown; },
    mousePressed() {
      const v = mousePressed;
      mousePressed = false;
      return v;
    },
    // Mouse drag since the last read, in pixels; reading it clears it.
    takeMouseDelta() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    // Call at the end of every frame: single-press flags live one frame only.
    endFrame() {
      for (const k in pressed) pressed[k] = false;
      mousePressed = false;
    },
  };
};
