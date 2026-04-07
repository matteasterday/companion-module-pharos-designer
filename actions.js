export function getActions(self) {
	return {
		controlTimeline: {
			name: 'Control Timeline',
			options: [
				{
					id: 'info-text-fade',
					type: 'static-text',
					label: 'Important',
					value: 'The fade time set in Companion will always overwrite the default fade time',
				},
				{
					id: 'action',
					type: 'dropdown',
					label: 'Action',
					choices: [
						{ id: 'start', label: 'Start' },
						{ id: 'start_release_others', label: 'Start & Release Others' },
						{ id: 'release', label: 'Release' },
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'pause', label: 'Pause' },
						{ id: 'resume', label: 'Resume' },
						{ id: 'set_rate', label: 'Set rate' },
						{ id: 'set_position', label: 'Set position' },
					],
					default: 'start',
					required: true,
				},
				{
					type: 'dropdown',
					id: 'num',
					label: 'Timeline',
					choices: self.actionData.timelines,
					default: 0,
				},
				{
					id: 'rate',
					type: 'number',
					label: 'Rate (0.1 to 1 is default timeline rate)',
					isVisibleExpression: '$(options:action) === "set_rate"',
					min: 0,
					max: 10,
					default: 1,
					step: 0.1,
					required: true,
				},
				{
					id: 'position',
					type: 'textinput',
					label: 'Position (Fraction of timeline e.g. 0.5 or 10:100)',
					isVisibleExpression: '$(options:action) === "set_position"',
					required: true,
				},
				{
					id: 'fade',
					type: 'number',
					label: 'Fade (seconds)',
					min: 0,
				},
			],
			callback: (event) => {
				const { action, num, fade, rate, position } = event.options
				const options = { num, fade }
				if (action === 'set_rate') options.rate = rate
				if (action === 'set_position') options.position = position
				self.log('debug', `controlTimeline: ${action} ${JSON.stringify(options)}`)
				self.controlTimeline(action, options)
			},
		},
		controlGroups: {
			name: 'Control Groups',
			options: [
				{
					id: 'info-text-fade',
					type: 'static-text',
					label: 'Important',
					value: 'The fade time set in Companion will always overwrite the default fade time',
				},
				{
					type: 'dropdown',
					id: 'num',
					label: 'Groups',
					choices: self.actionData.groups,
					default: 0,
				},
				{
					id: 'level',
					type: 'number',
					label: 'Master Intensity  (0-1)',
					default: 0,
					max: 1,
					min: 0,
				},
				{
					id: 'fade',
					type: 'number',
					label: 'Fade (seconds)',
					min: 0,
					required: false,
				},
			],
			callback: (event) => {
				const { num, level, fade } = event.options
				const options = { num, level, fade }
				self.log('debug', `controlGroup: ${JSON.stringify(options)}`)
				self.controlGroup('master_intensity', options)
			},
		},
		controlScenes: {
			name: 'Control Scenes',
			options: [
				{
					id: 'info-text-fade',
					type: 'static-text',
					label: 'Important',
					value: 'The fade time set in Companion will always overwrite the default fade time',
				},
				{
					id: 'action',
					type: 'dropdown',
					label: 'Action',
					choices: [
						{ id: 'start', label: 'Start' },
						{ id: 'start_release_others', label: 'Start & Release Others' },
						{ id: 'release', label: 'Release' },
						{ id: 'toggle', label: 'Toggle' },
					],
					default: 'start',
				},
				{
					type: 'dropdown',
					id: 'num',
					label: 'Scenes',
					choices: self.actionData.scenes,
					default: 0,
				},
				{
					id: 'fade',
					type: 'number',
					label: 'Fade (seconds)',
					min: 0,
				},
			],
			callback: (event) => {
				const { action, num, fade } = event.options
				self.controlScene(action, { num, fade })
			},
		},
		controlTriggers: {
			name: 'Control Triggers',
			options: [
				{
					type: 'dropdown',
					id: 'num',
					label: 'Trigger',
					choices: self.actionData.triggers,
					default: 0,
				},
				{
					id: 'var',
					type: 'textinput',
					label: 'String to pass to trigger',
					default: '',
				},
				{
					id: 'conditions',
					type: 'checkbox',
					label: 'Test conditions before firing',
					default: true,
				},
			],
			callback: (event) => {
				const { num, var: varStr, conditions } = event.options
				const options = { num, var: varStr, conditions }
				self.log('debug', `controlTrigger: ${JSON.stringify(options)}`)
				self.controlTrigger('fire', options)
			},
		},
		refreshInputs: {
			name: 'Refresh Inputs',
			options: [],
			callback: () => {
				self.refreshInputs()
			},
		},
	}
}
