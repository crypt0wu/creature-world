// Shared mutable hover state — read by HoverTooltip via RAF, written by 3D components
export const hoverState = { label: '', active: false }

export function setHover(label) {
  hoverState.label = label
  hoverState.active = true
}

export function clearHover() {
  hoverState.label = ''
  hoverState.active = false
}
