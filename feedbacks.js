import { combineRgb } from '@companion-module/base'

export function getFeedbacks(self) {
	const ColorGreen = combineRgb(0, 200, 0)

	const feedbacks = {
		timelineState: {
			type: 'boolean',
			name: 'Change background color by state of timeline',
			description: 'If the selected timeline has the selected state, change the background color of the button.',
			defaultStyle: {
				bgcolor: ColorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Timeline',
					id: 'timeline',
					choices: self.actionData.timelines,
					required: true,
				},
				{
					type: 'dropdown',
					label: 'State',
					id: 'state',
					choices: [
						{ id: 'released', label: 'Released' },
						{ id: 'running', label: 'Running' },
						{ id: 'paused', label: 'Paused' },
						{ id: 'holding_at_end', label: 'Holding at End' },
						{ id: 'none', label: 'None' },
					],
					default: 'running',
					required: true,
				},
			],
			callback: async (feedback) => {
				try {
					if (!feedback.options.timeline) return false
					// Use cached state from WebSocket if available
					const cached = self.state?.timelines?.get(Number(feedback.options.timeline))
					if (cached) {
						return feedback.options.state === cached.state
					}
					// Fall back to HTTP polling if no cache
					if (!self.controller) return false
					const res = await self.controller.getTimelines()
					const timeline = res.timelines.filter((timeline) => timeline.num == feedback.options.timeline)
					if (!timeline.length) return false
					return feedback.options.state === timeline[0].state
				} catch (e) {
					self.log('error', `timelineState feedback error: ${e.message}`)
					return false
				}
			},
		},
		sceneState: {
			type: 'boolean',
			name: 'Change background color by state of scene',
			description: 'If the selected scene has the selected state, change the background color of the button.',
			defaultStyle: {
				bgcolor: ColorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					choices: self.actionData.scenes,
					required: true,
				},
				{
					type: 'dropdown',
					label: 'State',
					id: 'state',
					choices: [
						{ id: 'started', label: 'Started' },
						{ id: 'released', label: 'Released' },
						{ id: 'none', label: 'None' },
					],
					default: 'started',
					required: true,
				},
			],
			callback: async (feedback) => {
				try {
					if (!feedback.options.state || !feedback.options.scene) return false
					// Use cached state from WebSocket if available
					const cached = self.state?.scenes?.get(Number(feedback.options.scene))
					if (cached) {
						return feedback.options.state === cached.state
					}
					// Fall back to HTTP polling if no cache
					if (!self.controller) return false
					const res = await self.controller.getScenes()
					const scene = res.scenes.filter((scene) => scene.num == feedback.options.scene)
					if (!scene.length) return false
					return feedback.options.state === scene[0].state
				} catch (e) {
					self.log('error', `sceneState feedback error: ${e.message}`)
					return false
				}
			},
		},
		groupState: {
			type: 'boolean',
			name: 'Change background color by level of group',
			description: 'If the selected group has the selected brightness, change the background color of the button.',
			defaultStyle: {
				bgcolor: ColorGreen,
			},
			options: [
				{
					type: 'dropdown',
					label: 'Group',
					id: 'group',
					choices: self.actionData.groups,
					required: true,
				},
				{
					type: 'dropdown',
					label: 'Operation',
					id: 'operation',
					choices: [
						{ id: 'more', label: '>' },
						{ id: 'less', label: '<' },
						{ id: 'equal', label: '=' },
					],
					default: 'equal',
					required: true,
				},
				{
					type: 'number',
					label: 'Level',
					id: 'level',
					max: 100,
					min: 0,
					required: true,
				},
			],
			callback: async (feedback) => {
				try {
					if (feedback.options.level == null || !feedback.options.operation || !feedback.options.group) return false
					// Use cached state from WebSocket if available
					const cached = self.state?.groups?.get(Number(feedback.options.group))
					if (cached) {
						switch (feedback.options.operation) {
							case 'more':
								return cached.level > feedback.options.level
							case 'less':
								return cached.level < feedback.options.level
							case 'equal':
								return cached.level === feedback.options.level
						}
						return false
					}
					// Fall back to HTTP polling if no cache
					if (!self.controller) return false
					const res = await self.controller.getGroups()
					const group = res.groups.filter((group) => group.num == feedback.options.group)
					if (!group.length) return false
					switch (feedback.options.operation) {
						case 'more':
							return group[0].level > feedback.options.level
						case 'less':
							return group[0].level < feedback.options.level
						case 'equal':
							return group[0].level === feedback.options.level
					}
					return false
				} catch (e) {
					self.log('error', `groupState feedback error: ${e.message}`)
					return false
				}
			},
		},
		inputState: {
			type: 'boolean',
			name: 'Change background color by input state',
			description: 'If the selected input matches the specified value, change the background color of the button.',
			defaultStyle: {
				bgcolor: ColorGreen,
			},
			options: [
				{
					type: 'number',
					label: 'Input Number',
					id: 'input',
					min: 1,
					required: true,
				},
				{
					type: 'dropdown',
					label: 'Condition',
					id: 'condition',
					choices: [
						{ id: 'true', label: 'Closed / True / > 0' },
						{ id: 'false', label: 'Open / False / 0' },
					],
					default: 'true',
					required: true,
				},
			],
			callback: (feedback) => {
				if (!feedback.options.input) return false
				const inp = self.state?.inputs?.find((i) => i.input == feedback.options.input)
				if (!inp) return false
				const isActive = inp.value === true || (typeof inp.value === 'number' && inp.value > 0)
				return feedback.options.condition === 'true' ? isActive : !isActive
			},
		},
	}
	return feedbacks
}
