import { combineRgb } from '@companion-module/base'

export function getPresets(self) {
	const ColorWhite = combineRgb(255, 255, 255)
	const ColorBlack = combineRgb(0, 0, 0)
	const ColorGray = combineRgb(50, 50, 50)

	// Feedback active colors — use dark text for readability
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorOrange = combineRgb(255, 140, 0)
	const ColorBlue = combineRgb(40, 80, 180)

	// Default/idle button backgrounds
	const BgDarkGreen = combineRgb(0, 60, 0)
	const BgDarkRed = combineRgb(80, 0, 0)
	const BgDarkBlue = combineRgb(0, 0, 80)

	const presets = {}

	// ── Timeline Presets ───────────────────────────────────────────

	if (self.actionData.timelines) {
		for (const tl of self.actionData.timelines) {
			if (tl.id === 0) continue

			const tlCat = `Timeline: ${tl.label}`

			// Start Timeline
			presets[`timeline_${tl.id}_start`] = {
				type: 'button',
				category: tlCat,
				name: `Start ${tl.label}`,
				style: {
					text: `START\\n${tl.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: BgDarkGreen,
				},
				feedbacks: [
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'running' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlTimeline',
								options: { action: 'start', num: tl.id, fade: 0 },
							},
						],
						up: [],
					},
				],
			}

			// Release Timeline
			presets[`timeline_${tl.id}_release`] = {
				type: 'button',
				category: tlCat,
				name: `Release ${tl.label}`,
				style: {
					text: `RELEASE\\n${tl.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: BgDarkRed,
				},
				feedbacks: [
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'released' },
						style: { bgcolor: ColorRed, color: ColorWhite },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlTimeline',
								options: { action: 'release', num: tl.id, fade: 0 },
							},
						],
						up: [],
					},
				],
			}

			// Toggle Timeline
			presets[`timeline_${tl.id}_toggle`] = {
				type: 'button',
				category: tlCat,
				name: `Toggle ${tl.label}`,
				style: {
					text: `TOGGLE\\n${tl.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorGray,
				},
				feedbacks: [
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'running' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'paused' },
						style: { bgcolor: ColorOrange, color: ColorBlack },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlTimeline',
								options: { action: 'toggle', num: tl.id, fade: 0 },
							},
						],
						up: [],
					},
				],
			}

			// Pause Timeline
			presets[`timeline_${tl.id}_pause`] = {
				type: 'button',
				category: tlCat,
				name: `Pause ${tl.label}`,
				style: {
					text: `PAUSE\\n${tl.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorGray,
				},
				feedbacks: [
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'paused' },
						style: { bgcolor: ColorOrange, color: ColorBlack },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlTimeline',
								options: { action: 'pause', num: tl.id },
							},
						],
						up: [],
					},
				],
			}

			// Resume Timeline
			presets[`timeline_${tl.id}_resume`] = {
				type: 'button',
				category: tlCat,
				name: `Resume ${tl.label}`,
				style: {
					text: `RESUME\\n${tl.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorGray,
				},
				feedbacks: [
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'running' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlTimeline',
								options: { action: 'resume', num: tl.id },
							},
						],
						up: [],
					},
				],
			}

			// Timeline Status (text variable display)
			presets[`timeline_${tl.id}_status`] = {
				type: 'button',
				category: tlCat,
				name: `${tl.label} Status`,
				style: {
					text: `${tl.label}\\n$(${self.label}:timeline_${tl.id}_state)`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				feedbacks: [
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'running' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
					{
						feedbackId: 'timelineState',
						options: { timeline: tl.id, state: 'paused' },
						style: { bgcolor: ColorOrange, color: ColorBlack },
					},
				],
				steps: [],
			}
		}
	}

	// ── Scene Presets ──────────────────────────────────────────────

	if (self.actionData.scenes) {
		for (const sc of self.actionData.scenes) {
			if (sc.id === 0) continue
			const scCat = `Scene: ${sc.label}`

			// Start Scene
			presets[`scene_${sc.id}_start`] = {
				type: 'button',
				category: scCat,
				name: `Start ${sc.label}`,
				style: {
					text: `START\\n${sc.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: BgDarkGreen,
				},
				feedbacks: [
					{
						feedbackId: 'sceneState',
						options: { scene: sc.id, state: 'started' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlScenes',
								options: { action: 'start', num: sc.id, fade: 0 },
							},
						],
						up: [],
					},
				],
			}

			// Release Scene
			presets[`scene_${sc.id}_release`] = {
				type: 'button',
				category: scCat,
				name: `Release ${sc.label}`,
				style: {
					text: `RELEASE\\n${sc.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: BgDarkRed,
				},
				feedbacks: [
					{
						feedbackId: 'sceneState',
						options: { scene: sc.id, state: 'released' },
						style: { bgcolor: ColorRed, color: ColorWhite },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlScenes',
								options: { action: 'release', num: sc.id, fade: 0 },
							},
						],
						up: [],
					},
				],
			}

			// Start & Release Others Scene
			presets[`scene_${sc.id}_start_release_others`] = {
				type: 'button',
				category: scCat,
				name: `Start & Rel Others ${sc.label}`,
				style: {
					text: `START+REL\\n${sc.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: BgDarkGreen,
				},
				feedbacks: [
					{
						feedbackId: 'sceneState',
						options: { scene: sc.id, state: 'started' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlScenes',
								options: { action: 'start_release_others', num: sc.id, fade: 0 },
							},
						],
						up: [],
					},
				],
			}

			// Toggle Scene
			presets[`scene_${sc.id}_toggle`] = {
				type: 'button',
				category: scCat,
				name: `Toggle ${sc.label}`,
				style: {
					text: `TOGGLE\\n${sc.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorGray,
				},
				feedbacks: [
					{
						feedbackId: 'sceneState',
						options: { scene: sc.id, state: 'started' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
				],
				steps: [
					{
						down: [
							{
								actionId: 'controlScenes',
								options: { action: 'toggle', num: sc.id, fade: 0 },
							},
						],
						up: [],
					},
				],
			}

			// Scene Status
			presets[`scene_${sc.id}_status`] = {
				type: 'button',
				category: scCat,
				name: `${sc.label} Status`,
				style: {
					text: `${sc.label}\\n$(${self.label}:scene_${sc.id}_state)`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				feedbacks: [
					{
						feedbackId: 'sceneState',
						options: { scene: sc.id, state: 'started' },
						style: { bgcolor: ColorGreen, color: ColorBlack },
					},
				],
				steps: [],
			}
		}
	}

	// ── Group Presets (8-button row: status + 7 levels) ───────────

	if (self.actionData.groups) {
		const groupLevels = [
			{ pct: 0, label: '0%' },
			{ pct: 15, label: '15%' },
			{ pct: 30, label: '30%' },
			{ pct: 50, label: '50%' },
			{ pct: 70, label: '70%' },
			{ pct: 85, label: '85%' },
			{ pct: 100, label: '100%' },
		]

		for (const gr of self.actionData.groups) {
			if (gr.id === 0) continue
			const grCat = `Group: ${gr.label}`

			// Status button (first in row)
			presets[`group_${gr.id}_status`] = {
				type: 'button',
				category: grCat,
				name: `${gr.label} Level`,
				style: {
					text: `${gr.label}\\n$(${self.label}:group_${gr.id}_level)%`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				feedbacks: [
					{
						feedbackId: 'groupState',
						options: { group: gr.id, operation: 'more', level: 0 },
						style: { bgcolor: BgDarkBlue },
					},
				],
				steps: [],
			}

			// Level buttons (7 increments)
			for (const gl of groupLevels) {
				presets[`group_${gr.id}_${gl.pct}`] = {
					type: 'button',
					category: grCat,
					name: `Set ${gr.label} to ${gl.label}`,
					style: {
						text: `${gr.label}\\n${gl.label}`,
						size: '14',
						color: ColorWhite,
						bgcolor: gl.pct === 0 ? BgDarkRed : BgDarkBlue,
					},
					feedbacks: [
						{
							feedbackId: 'groupState',
							options: { group: gr.id, operation: 'equal', level: gl.pct },
							style: { bgcolor: gl.pct === 0 ? ColorRed : ColorBlue, color: ColorWhite },
						},
					],
					steps: [
						{
							down: [
								{
									actionId: 'controlGroups',
									options: { num: gr.id, level: gl.pct, fade: 0 },
								},
							],
							up: [],
						},
					],
				}
			}
		}
	}

	// ── Trigger Presets ────────────────────────────────────────────

	if (self.actionData.triggers) {
		for (const tr of self.actionData.triggers) {
			if (tr.id === 0) continue

			presets[`trigger_${tr.id}_fire`] = {
				type: 'button',
				category: 'Triggers',
				name: `Fire ${tr.label}`,
				style: {
					text: `FIRE\\n${tr.label}`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorGray,
				},
				feedbacks: [],
				steps: [
					{
						down: [
							{
								actionId: 'controlTriggers',
								options: { num: tr.id, var: '', conditions: true },
							},
						],
						up: [],
					},
				],
			}
		}
	}

	// ── Global Control Presets ─────────────────────────────────────

	presets['release_all_timelines'] = {
		type: 'button',
		category: 'Global Controls',
		name: 'Release All Timelines',
		style: {
			text: 'RELEASE\\nALL TL',
			size: '14',
			color: ColorWhite,
			bgcolor: BgDarkRed,
		},
		feedbacks: [],
		steps: [
			{
				down: [
					{
						actionId: 'controlTimeline',
						options: { action: 'release', fade: 0 },
					},
				],
				up: [],
			},
		],
	}

	presets['release_all_scenes'] = {
		type: 'button',
		category: 'Global Controls',
		name: 'Release All Scenes',
		style: {
			text: 'RELEASE\\nALL SC',
			size: '14',
			color: ColorWhite,
			bgcolor: BgDarkRed,
		},
		feedbacks: [],
		steps: [
			{
				down: [
					{
						actionId: 'controlScenes',
						options: { action: 'release', fade: 0 },
					},
				],
				up: [],
			},
		],
	}

	presets['pause_all_timelines'] = {
		type: 'button',
		category: 'Global Controls',
		name: 'Pause All Timelines',
		style: {
			text: 'PAUSE\\nALL TL',
			size: '14',
			color: ColorWhite,
			bgcolor: ColorGray,
		},
		feedbacks: [],
		steps: [
			{
				down: [
					{
						actionId: 'controlTimeline',
						options: { action: 'pause' },
					},
				],
				up: [],
			},
		],
	}

	presets['resume_all_timelines'] = {
		type: 'button',
		category: 'Global Controls',
		name: 'Resume All Timelines',
		style: {
			text: 'RESUME\\nALL TL',
			size: '14',
			color: ColorWhite,
			bgcolor: ColorGray,
		},
		feedbacks: [],
		steps: [
			{
				down: [
					{
						actionId: 'controlTimeline',
						options: { action: 'resume' },
					},
				],
				up: [],
			},
		],
	}

	// ── Status Presets ─────────────────────────────────────────────

	presets['project_name'] = {
		type: 'button',
		category: 'Status',
		name: 'Project Name',
		style: {
			text: `Project\\n$(${self.label}:project_name)`,
			size: '14',
			color: ColorWhite,
			bgcolor: ColorBlack,
		},
		feedbacks: [],
		steps: [],
	}

	presets['controller_info'] = {
		type: 'button',
		category: 'Status',
		name: 'Controller Info',
		style: {
			text: `$(${self.label}:hardware_type)\\nS/N $(${self.label}:serial_number)`,
			size: '14',
			color: ColorWhite,
			bgcolor: ColorBlack,
		},
		feedbacks: [],
		steps: [],
	}

	presets['firmware_info'] = {
		type: 'button',
		category: 'Status',
		name: 'Firmware Version',
		style: {
			text: `Firmware\\n$(${self.label}:firmware_version)`,
			size: '14',
			color: ColorWhite,
			bgcolor: ColorBlack,
		},
		feedbacks: [],
		steps: [],
	}

	// Input presets
	if (self.state?.inputs) {
		for (const inp of self.state.inputs) {
			presets[`input_${inp.input}_status`] = {
				type: 'button',
				category: 'Inputs',
				name: `Input ${inp.input}`,
				style: {
					text: `Input ${inp.input}\\n$(${self.label}:input_${inp.input}_value)`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				feedbacks: [],
				steps: [],
			}
		}
	}

	presets['ws_status'] = {
		type: 'button',
		category: 'Status',
		name: 'WebSocket Status',
		style: {
			text: `WebSocket\\n$(${self.label}:ws_connected)`,
			size: '14',
			color: ColorWhite,
			bgcolor: ColorBlack,
		},
		feedbacks: [],
		steps: [],
	}

	presets['beacon_status'] = {
		type: 'button',
		category: 'Status',
		name: 'Controller Beacon',
		style: {
			text: `Beacon\\n$(${self.label}:beacon)`,
			size: '14',
			color: ColorWhite,
			bgcolor: ColorBlack,
		},
		feedbacks: [],
		steps: [],
	}

	presets['connection_status'] = {
		type: 'button',
		category: 'Status',
		name: 'Connection Status',
		style: {
			text: `Connection\\n$(${self.label}:ws_connected)`,
			size: '14',
			color: ColorWhite,
			bgcolor: ColorBlack,
		},
		feedbacks: [],
		steps: [],
	}

	// ── Remote Device Presets ──────────────────────────────────────

	if (self.state?.remoteDevices) {
		for (const [num, dev] of self.state.remoteDevices) {
			presets[`remote_device_${num}_status`] = {
				type: 'button',
				category: 'Remote Devices',
				name: `${dev.name} Status`,
				style: {
					text: `${dev.name}\\n$(${self.label}:remote_device_${num}_online)`,
					size: '14',
					color: ColorWhite,
					bgcolor: ColorBlack,
				},
				feedbacks: [],
				steps: [],
			}
		}
	}

	return presets
}
