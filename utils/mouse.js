function createMouse(canvas, opts = {}) {
  const mouse = {
    moving: false,
    position: [0.5, 0.5],
    normalized: [0, 0],
    dispose,
  };

  window.addEventListener('mousemove', move);
  window.addEventListener('mousedown', down);
  window.addEventListener('mouseup', up);

  return mouse;

  function down() {
    mouse.moving = true;
  }

  function up() {
    mouse.moving = false;
  }

  function move(ev) {
    if (mouse.moving) {
      mouse.position = mouseEventOffset(ev, canvas);
    }
    if (opts.onMove) opts.onMove();
  }

  function dispose() {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mousedown', down);
    window.removeEventListener('mouseup', up);
  }
}

function mouseEventOffset(ev, target) {
  const out = [0, 0];

  out[0] = ev.clientX / window.innerWidth;
  out[1] = (window.innerHeight - ev.clientY - 1) / window.innerHeight;

  // target = target || ev.currentTarget || ev.srcElement;
  // const cx = ev.clientX || 0;
  // const cy = ev.clientY || 0;
  // const rect = target.getBoundingClientRect();
  // out[0] = cx - rect.left;
  // out[1] = cy - rect.top;
  return out;
}

module.exports = createMouse;
