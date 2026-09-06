const DEFAULT_SENSITIVITY = 1;
const RADIANS_PER_PIXEL = .002;

export function clampSensitivity(value) {
  return Number.isFinite(value) ? Math.max(.25, Math.min(2.5, value)) : DEFAULT_SENSITIVITY;
}

/**
 * Dragging grabs the scene; pointer lock turns the visitor's head instead.
 * Deltas already measure relative motion, so neither frame time nor event
 * frequency belongs in the scale. Keep finite deltas unclamped so splitting
 * one movement across several events produces the same rotation.
 */
export function pointerLookDelta(dx, dy, { mode = 'drag', sensitivity = DEFAULT_SENSITIVITY, invertY = false } = {}) {
  const scale = RADIANS_PER_PIXEL * clampSensitivity(sensitivity) * (mode === 'locked' ? -1 : 1);
  return {
    yaw: Number.isFinite(dx) ? dx * scale || 0 : 0,
    pitch: Number.isFinite(dy) ? dy * scale * (invertY ? -1 : 1) || 0 : 0,
  };
}
