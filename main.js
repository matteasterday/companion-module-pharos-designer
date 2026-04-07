import { InstanceBase, runEntrypoint, InstanceStatus, Regex } from '@companion-module/base'
import { getActions } from './actions.js'
import { getVariables } from './variables.js'
import { getFeedbacks } from './feedbacks.js'
import { getPresets } from './presets.js'
import { UpgradeScripts } from './upgrades.js'

import { DesignerClient } from 'pharos-controllers'
import { formatState } from './utils.js'
import { PharosWebSocket } from './websocket.js'

class PharosInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.startup(config)
	}

	// When module gets deleted
	async destroy() {
		this._stopInputPolling()
		if (this.pharosWs) {
			this.pharosWs.destroy()
			this.pharosWs = null
		}
		if (this.controller !== undefined) {
			this.controller.logout().catch(() => {})
			delete this.controller
		}
		this.updateStatus(InstanceStatus.Disconnected)
		this.log('debug', 'destroy')
	}

	startup(config) {
		this.log('debug', 'startup')
		// Clean up existing connections (e.g. config change)
		this._stopInputPolling()
		if (this.pharosWs) {
			this.pharosWs.destroy()
			this.pharosWs = null
		}
		if (this.controller) {
			this.controller.logout().catch(() => {})
		}
		this.config = config
		this.actionData = {
			groups: [{ id: 0, label: 'No groups found' }],
			scenes: [{ id: 0, label: 'No scenes found' }],
			timelines: [{ id: 0, label: 'No timelines found' }],
			triggers: [{ id: 0, label: 'No triggers found' }],
		}
		this.state = {
			timelines: new Map(),
			scenes: new Map(),
			groups: new Map(),
			remoteDevices: new Map(),
			beacon: false,
			project: null,
			system: null,
			inputs: [],
		}
		this.pharosConnected = false
		this.updateActions() // export actions
		this.updateVariableDefinitions() // export variable definitions
		if (this.config.host) {
			this.updateStatus(InstanceStatus.Connecting)
		}
		this._initGeneration = (this._initGeneration || 0) + 1
		this.initController(this._initGeneration).catch((e) => this.log('error', `Init failed: ${e.message}`))
	}

	async initController(gen) {
		const self = this

		if (this.config.host) {
			this.controller = new DesignerClient(this.config.host)
			const authRes = await this.controller.authenticate(this.config.user, this.config.password)
			if (gen !== this._initGeneration) return
			if (authRes.error) this.log('debug', authRes.error)
			if (!authRes.success) {
				if (self.lastStatus != InstanceStatus.UnknownError) {
					self.updateStatus(InstanceStatus.UnknownError, 'Network error')
					self.lastStatus = InstanceStatus.UnknownError
					self.log('error', 'A network error occured while trying to authenticate')
				}
				this.pharosConnected = false
			} else if (authRes.success) {
				self.connect_time = Date.now()
				if (self.lastStatus != InstanceStatus.Ok) {
					self.updateStatus(InstanceStatus.Ok, 'Connected')
					self.log('info', 'Controller connected')
					self.lastStatus = InstanceStatus.Ok
				}
				this.pharosConnected = true
				this.groupsResponse = await this.controller.getGroups()
				if (gen !== this._initGeneration) return
				this.scenesResponse = await this.controller.getScenes()
				if (gen !== this._initGeneration) return
				this.timelinesResponse = await this.controller.getTimelines()
				if (gen !== this._initGeneration) return
				this.triggersResponse = await this.controller.getTriggers()
				if (gen !== this._initGeneration) return
				if (
					this.groupsResponse.success &&
					this.scenesResponse.success &&
					this.timelinesResponse.success &&
					this.triggersResponse.success
				) {
					this.log('debug', 'Storing variables...')
					// Normalize groups — API omits num for "All Fixtures" group (treat as 0)
					this.filteredGroups = this.groupsResponse.groups.map((group) => ({
						...group,
						num: group.num ?? 0,
					}))
					// mapping the data to select option arrays
					this.actionData.groups = this.filteredGroups.map((group) => ({ id: group.num, label: group.name }))
					if (!this.actionData.groups.length) this.actionData.groups = [{ id: 0, label: 'No groups found' }]

					this.actionData.scenes =
						this.scenesResponse.scenes?.map((scene) => ({ id: scene.num, label: scene.name })) || []
					if (!this.actionData.scenes.length) this.actionData.scenes = [{ id: 0, label: 'No scenes found' }]

					this.actionData.timelines =
						this.timelinesResponse.timelines?.map((timeline) => ({
							id: timeline.num,
							label: timeline.name,
						})) || []
					if (!this.actionData.timelines.length) this.actionData.timelines = [{ id: 0, label: 'No timelines found' }]

					this.actionData.triggers =
						this.triggersResponse.triggers?.map((trigger) => ({
							id: trigger.num,
							label: trigger.name,
						})) || []
					if (!this.actionData.triggers.length) this.actionData.triggers = [{ id: 0, label: 'No triggers found' }]
					// Seed state cache from HTTP response
					for (const tl of this.timelinesResponse.timelines || []) {
						this.state.timelines.set(tl.num, {
							num: tl.num,
							state: tl.state || 'none',
							onstage: tl.onstage || false,
							position: tl.position || 0,
						})
					}
					for (const sc of this.scenesResponse.scenes || []) {
						this.state.scenes.set(sc.num, {
							num: sc.num,
							state: sc.state || 'none',
							onstage: sc.onstage || false,
						})
					}
					for (const gr of this.filteredGroups || []) {
						this.state.groups.set(gr.num, {
							num: gr.num,
							name: gr.name,
							level: gr.level || 0,
						})
					}

					// Fetch controller info (project, system, inputs)
					await this._fetchControllerInfo()
					if (gen !== this._initGeneration) return

					// update actions, feedbacks, variables, and presets after data has been recieved
					this.updateActions()
					this.updateFeedbacks()
					this.updateVariableDefinitions()
					this.updatePresets()
					this._seedVariableValues()

					// Start WebSocket for real-time updates (if enabled)
					if (this.config.useWebSocket !== false) {
						this.pharosWs = new PharosWebSocket(this)
						this.pharosWs.connect(this.config.host, this.controller.token)
					}

					// Start input polling (if configured)
					this._startInputPolling()
				} else {
					if (self.lastStatus != InstanceStatus.UnknownError) {
						self.updateStatus(InstanceStatus.UnknownError, 'Network error')
						self.lastStatus = InstanceStatus.UnknownError
						self.log('error', 'Populating the groups/timelines/scenes failed')
					}
				}
			}
		}
	}

	async configUpdated(config) {
		this.init(config)
	}

	// Return config fields for web config
	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Information',
				value:
					'This module requires API v6 in your Designer 2 project.<br/>API v6 is available from Pharos Designer Version 2.9 upwards and can be selected under Project > Project Properties > Controller API.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 12,
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'user',
				label: 'User',
				width: 6,
			},
			{
				type: 'textinput',
				id: 'password',
				label: 'Password',
				width: 6,
			},
			{
				type: 'checkbox',
				id: 'useWebSocket',
				label: 'Enable WebSocket (real-time feedback)',
				width: 12,
				default: true,
				tooltip:
					'When enabled, the module maintains a WebSocket connection for real-time button feedback updates. Disable to use HTTP polling instead (for older firmware or limited connections — LPC supports 8, LPC X and VLC support 16).',
			},
			{
				type: 'dropdown',
				id: 'controllerLogLevel',
				label: 'Controller log forwarding',
				width: 6,
				default: 'off',
				choices: [
					{ id: 'off', label: 'Off' },
					{ id: 'warnings', label: 'Warnings only (Critical + Terse)' },
					{ id: 'all', label: 'All messages (Debug)' },
				],
				tooltip:
					'Forward controller log messages to the Companion log for this module. Useful for debugging. "All messages" can be very noisy on a busy controller.',
			},
			{
				type: 'number',
				id: 'inputPollInterval',
				label: 'Input polling interval (seconds)',
				width: 6,
				default: 0,
				min: 0,
				tooltip:
					'How often to poll the controller for input state changes (contact closures, analog values, etc.). Set to 0 to disable. Minimum 5 seconds when enabled. Useful for triggering Companion actions from controller inputs.',
			},
		]
	}

	updateFeedbacks() {
		this.setFeedbackDefinitions(getFeedbacks(this))
	}

	updateActions() {
		this.setActionDefinitions(getActions(this))
	}

	updateVariableDefinitions() {
		this.setVariableDefinitions(getVariables(this))
	}

	updatePresets() {
		this.setPresetDefinitions(getPresets(this))
	}

	_seedVariableValues() {
		const values = {}
		for (const [num, tl] of this.state.timelines) {
			values[`timeline_${num}_state`] = formatState(tl.state)
			values[`timeline_${num}_onstage`] = String(tl.onstage)
			values[`timeline_${num}_position`] = tl.position
		}
		for (const [num, sc] of this.state.scenes) {
			values[`scene_${num}_state`] = formatState(sc.state)
			values[`scene_${num}_onstage`] = String(sc.onstage)
		}
		for (const [num, gr] of this.state.groups) {
			values[`group_${num}_level`] = gr.level
			values[`group_${num}_name`] = gr.name
		}
		// Project info
		if (this.state.project) {
			values['project_name'] = this.state.project.name
			values['project_author'] = this.state.project.author
			values['project_filename'] = this.state.project.filename
		}
		// System info
		if (this.state.system) {
			values['hardware_type'] = this.state.system.hardware_type
			values['serial_number'] = this.state.system.serial_number
			values['firmware_version'] = this.state.system.firmware_version
			values['channel_capacity'] = this.state.system.channel_capacity
			values['ip_address'] = this.state.system.ip_address
		}
		// Inputs
		for (const inp of this.state.inputs) {
			values[`input_${inp.input}_type`] = inp.type
			values[`input_${inp.input}_value`] = String(inp.value)
		}
		for (const [num, dev] of this.state.remoteDevices) {
			values[`remote_device_${num}_name`] = dev.name
			values[`remote_device_${num}_online`] = dev.online ? 'Online' : 'Offline'
			values[`remote_device_${num}_type`] = dev.type
		}
		values['beacon'] = this.state.beacon ? 'On' : 'Off'
		values['ws_connected'] = String(!!this.pharosWs)
		this.setVariableValues(values)
	}

	async refreshInputs() {
		if (!this.controller || !this.pharosConnected) return
		const input = await this._fetchApi('/api/input')
		if (input && input.gpio) {
			this.state.inputs = []
			const values = {}
			for (const inp of input.gpio) {
				this.state.inputs.push({
					input: inp.input,
					type: inp.type,
					value: inp.value,
				})
				values[`input_${inp.input}_type`] = inp.type
				values[`input_${inp.input}_value`] = String(inp.value)
			}
			this.setVariableValues(values)
			this.checkFeedbacks('inputState')
		}
	}

	_startInputPolling() {
		this._stopInputPolling()
		let interval = this.config.inputPollInterval || 0
		if (interval > 0 && interval < 5) interval = 5
		if (interval <= 0) return
		this.log('debug', `Input polling every ${interval}s`)
		this.inputPollTimer = setInterval(() => {
			this.refreshInputs()
		}, interval * 1000)
	}

	_stopInputPolling() {
		if (this.inputPollTimer) {
			clearInterval(this.inputPollTimer)
			this.inputPollTimer = null
		}
	}

	async _fetchApi(endpoint) {
		try {
			const res = await fetch(`http://${this.config.host}${endpoint}`, {
				headers: { Authorization: `Bearer ${this.controller.token}` },
			})
			if (!res.ok) return null
			return await res.json()
		} catch (e) {
			this.log('debug', `Failed to fetch ${endpoint}: ${e.message}`)
			return null
		}
	}

	async _fetchControllerInfo() {
		const [project, system, input, remoteDevices] = await Promise.all([
			this._fetchApi('/api/project'),
			this._fetchApi('/api/system'),
			this._fetchApi('/api/input'),
			this._fetchApi('/api/remote_device'),
		])

		if (project) {
			this.state.project = {
				name: project.name || '',
				author: project.author || '',
				filename: project.filename || '',
				unique_id: project.uniqueId || '',
			}
		}

		if (system) {
			this.state.system = {
				hardware_type: system.hardware_type || '',
				serial_number: system.serial_number || '',
				firmware_version: system.firmware_version || '',
				channel_capacity: system.channel_capacity || 0,
				ip_address: system.ip_address || '',
				memory_total: system.memory_total || '',
				memory_available: system.memory_available || '',
				storage_size: system.storage_size || '',
				last_boot_time: system.last_boot_time || '',
				reset_reason: system.reset_reason || '',
			}
		}

		if (input && input.gpio) {
			this.state.inputs = []
			for (const inp of input.gpio) {
				this.state.inputs.push({
					input: inp.input,
					type: inp.type,
					value: inp.value,
				})
			}
		}

		if (remoteDevices && remoteDevices.remote_devices) {
			for (const dev of remoteDevices.remote_devices) {
				this.state.remoteDevices.set(dev.num, {
					num: dev.num,
					name: dev.name || '',
					online: dev.online ?? false,
					type: dev.type || '',
				})
			}
		}
	}

	async controlTimeline(action, options) {
		try {
			const res = await this.controller.controlTimeline(action, options)
			if (!res.success) {
				this.log('warn', `controlTimeline failed: ${res.error || 'unknown error'}`)
			}
			this.checkFeedbacks('timelineState')
		} catch (e) {
			this.log('error', `controlTimeline failed: ${e.message}`)
		}
	}

	async controlGroup(action, options) {
		try {
			const res = await this.controller.controlGroup(action, options)
			if (!res.success) {
				this.log('warn', `controlGroup failed: ${res.error || 'unknown error'}`)
			}
			this.checkFeedbacks('groupState')
		} catch (e) {
			this.log('error', `controlGroup failed: ${e.message}`)
		}
	}

	async controlScene(action, options) {
		try {
			const res = await this.controller.controlScene(action, options)
			if (!res.success) {
				this.log('warn', `controlScene failed: ${res.error || 'unknown error'}`)
			}
			this.checkFeedbacks('sceneState')
		} catch (e) {
			this.log('error', `controlScene failed: ${e.message}`)
		}
	}

	async controlTrigger(action, options) {
		try {
			const res = await this.controller.controlTrigger(action, options)
			if (!res.success) {
				this.log('warn', `controlTrigger failed: ${res.error || 'unknown error'}`)
			}
			this.log('debug', `controlTrigger success: ${res.success}`)
		} catch (e) {
			this.log('error', `controlTrigger failed: ${e.message}`)
		}
	}
}

runEntrypoint(PharosInstance, UpgradeScripts)
