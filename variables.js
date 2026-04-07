export function getVariables(self) {
	const variables = []

	// Per-timeline variables
	if (self.actionData.timelines) {
		for (const tl of self.actionData.timelines) {
			if (tl.id === 0) continue
			variables.push({ variableId: `timeline_${tl.id}_state`, name: `Timeline ${tl.id} (${tl.label}) State` })
			variables.push({ variableId: `timeline_${tl.id}_onstage`, name: `Timeline ${tl.id} (${tl.label}) On Stage` })
			variables.push({
				variableId: `timeline_${tl.id}_position`,
				name: `Timeline ${tl.id} (${tl.label}) Position (ms)`,
			})
		}
	}

	// Per-scene variables
	if (self.actionData.scenes) {
		for (const sc of self.actionData.scenes) {
			if (sc.id === 0) continue
			variables.push({ variableId: `scene_${sc.id}_state`, name: `Scene ${sc.id} (${sc.label}) State` })
			variables.push({ variableId: `scene_${sc.id}_onstage`, name: `Scene ${sc.id} (${sc.label}) On Stage` })
		}
	}

	// Per-group variables
	if (self.actionData.groups) {
		for (const gr of self.actionData.groups) {
			if (gr.label === 'No groups found') continue
			variables.push({ variableId: `group_${gr.id}_level`, name: `Group ${gr.id} (${gr.label}) Level` })
			variables.push({ variableId: `group_${gr.id}_name`, name: `Group ${gr.id} (${gr.label}) Name` })
		}
	}

	// Project info
	variables.push({ variableId: 'project_name', name: 'Project Name' })
	variables.push({ variableId: 'project_author', name: 'Project Author' })
	variables.push({ variableId: 'project_filename', name: 'Project Filename' })

	// System info
	variables.push({ variableId: 'hardware_type', name: 'Hardware Type' })
	variables.push({ variableId: 'serial_number', name: 'Serial Number' })
	variables.push({ variableId: 'firmware_version', name: 'Firmware Version' })
	variables.push({ variableId: 'channel_capacity', name: 'Channel Capacity' })
	variables.push({ variableId: 'ip_address', name: 'Controller IP Address' })

	// Input variables
	if (self.state?.inputs) {
		for (const inp of self.state.inputs) {
			variables.push({ variableId: `input_${inp.input}_type`, name: `Input ${inp.input} Type` })
			variables.push({ variableId: `input_${inp.input}_value`, name: `Input ${inp.input} Value` })
		}
	}

	// Per-remote device variables
	if (self.state?.remoteDevices) {
		for (const [num, dev] of self.state.remoteDevices) {
			variables.push({ variableId: `remote_device_${num}_name`, name: `Remote Device ${num} (${dev.name}) Name` })
			variables.push({ variableId: `remote_device_${num}_online`, name: `Remote Device ${num} (${dev.name}) Online` })
			variables.push({ variableId: `remote_device_${num}_type`, name: `Remote Device ${num} (${dev.name}) Type` })
		}
	}

	// Status
	variables.push({ variableId: 'beacon', name: 'Controller Beacon' })
	variables.push({ variableId: 'ws_connected', name: 'WebSocket Connected' })

	return variables
}
