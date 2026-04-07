/**
 * Format a raw API state string for display.
 * e.g. "holding_at_end" → "Holding at End", "running" → "Running"
 */
export function formatState(state) {
	if (!state) return 'Unknown'
	return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
