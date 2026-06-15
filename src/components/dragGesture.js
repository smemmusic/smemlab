// Shared pointer-drag skeleton. Call from an onPointerDown handler: it wires up
// window pointermove/pointerup, gates on a movement `threshold`, divides screen
// deltas by `scale` (pass the view scale to get model-space deltas), and always
// removes its listeners on pointerup.
//
//   onStart(ev)  — fired once, when movement first crosses `threshold`.
//                  Skipped when threshold is 0 (the drag starts immediately).
//   onMove({ dx, dy, clientX, clientY, ev }) — fired on every move after start.
//                  dx/dy are (client − start) / scale.
//   onEnd({ moved, ev }) — fired on pointerup; `moved` says whether the
//                  threshold was ever crossed (vs. a plain click).
//
// The threshold is compared against the SCALED Manhattan delta, which matches
// every existing call site: a screen-px threshold uses scale 1, a model-px
// threshold uses scale = viewScale.
export function startPointerDrag(e, { threshold = 0, scale = 1, onStart, onMove, onEnd } = {}) {
  const startX = e.clientX;
  const startY = e.clientY;
  const div = scale > 0 ? scale : 1;
  let moved = threshold <= 0;

  function move(ev) {
    const dx = (ev.clientX - startX) / div;
    const dy = (ev.clientY - startY) / div;
    if (!moved) {
      if (Math.abs(dx) + Math.abs(dy) <= threshold) return;
      moved = true;
      onStart?.(ev);
    }
    onMove?.({ dx, dy, clientX: ev.clientX, clientY: ev.clientY, ev });
  }
  function up(ev) {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    onEnd?.({ moved, ev });
  }
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}
