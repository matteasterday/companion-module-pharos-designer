import WebSocket from 'ws'
import { InstanceStatus } from '@companion-module/base'
import { formatState } from './utils.js'

export class PharosWebSocket {
	constructor(instance) {
		this.instance = instance
		this.ws = null
		this.keepAliveInterval = null
		this.reconnectTimer = null
		this.reconnectDelay = 1000
		this.maxReconnectDelay = 30000
		this.destroyed = false
	}

	connect(host, token) {
		if (this.destroyed) return
		this._close()
		this.host = host
		this.token = token

		const url = `ws://${host}/query`
		this.instance.log('debug', `WebSocket connecting to ${url}`)

		try {
			this.ws = new WebSocket(url)
		} catch (e) {
			this.instance.log('error', `WebSocket connection error: ${e.message}`)
			this._scheduleReconnect()
			return
		}

		this.ws.on('open', () => {
			this.instance.log('info', 'WebSocket connected')
			this.instance.pharosConnected = true
			this.instance.updateStatus(InstanceStatus.Ok)
			this.reconnectDelay = 1000
			this._subscribe('timeline')
			this._subscribe('scene')
			this._subscribe('group')
			this._subscribe('beacon')
			this._subscribe('remote_device')
			if (this.instance.config.controllerLogLevel && this.instance.config.controllerLogLevel !== 'off') {
				this._subscribe('log')
			}
			this._startKeepAlive()
			this.instance.setVariableValues({ ws_connected: 'true' })
		})

		this.ws.on('message', (data, isBinary) => {
			if (isBinary) {
				this._handleBinaryMessage(data)
				return
			}
			this._onMessage(data.toString())
		})

		this.ws.on('close', () => {
			this.instance.log('info', 'WebSocket disconnected')
			this.instance.pharosConnected = false
			if (!this.destroyed) {
				this.instance.updateStatus(InstanceStatus.ConnectionFailure, 'WebSocket disconnected')
			}
			this._stopKeepAlive()
			this.instance.setVariableValues({ ws_connected: 'false' })
			if (!this.destroyed) {
				this._scheduleReconnect()
			}
		})

		this.ws.on('pong', () => {
			this._pongReceived = true
		})

		this.ws.on('error', (err) => {
			this.instance.log('error', `WebSocket error: ${err.message}`)
		})
	}

	_subscribe(channel) {
		const msg = { subscribe: channel }
		if (this.token) {
			msg.token = this.token
		}
		this._send(msg)
		this.instance.log('debug', `Subscribed to ${channel}`)
	}

	_send(obj) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			try {
				this.ws.send(JSON.stringify(obj))
			} catch (e) {
				this.instance.log('debug', `WebSocket send failed: ${e.message}`)
			}
		}
	}

	_onMessage(raw) {
		let msg
		try {
			msg = JSON.parse(raw)
		} catch {
			this.instance.log('debug', `WebSocket non-JSON message: ${raw}`)
			return
		}

		if (msg.broadcast === 'timeline') {
			this._handleTimelineBroadcast(msg.data)
		} else if (msg.broadcast === 'scene') {
			this._handleSceneBroadcast(msg.data)
		} else if (msg.broadcast === 'group') {
			this._handleGroupBroadcast(msg.data)
		} else if (msg.broadcast === 'beacon') {
			this._handleBeaconBroadcast(msg.data)
		} else if (msg.broadcast === 'remote_device') {
			this._handleRemoteDeviceBroadcast(msg.data)
		} else if (msg.request === 'log' || msg.broadcast === 'log') {
			this._handleLogMessage(msg.data)
		} else {
			this.instance.log('debug', `WebSocket unhandled message: ${JSON.stringify(msg).substring(0, 200)}`)
		}
	}

	_handleTimelineBroadcast(data) {
		if (!data || data.num == null) return
		const prev = this.instance.state.timelines.get(data.num)
		const name = data.name ?? prev?.name ?? ''
		this.instance.state.timelines.set(data.num, {
			num: data.num,
			name,
			state: data.state || 'none',
			onstage: data.onstage ?? false,
			position: data.position ?? 0,
		})
		this.instance.log('debug', `Timeline ${data.num} -> ${data.state}`)
		const values = {
			[`timeline_${data.num}_state`]: formatState(data.state || 'none'),
			[`timeline_${data.num}_onstage`]: String(data.onstage ?? false),
			[`timeline_${data.num}_position`]: data.position ?? 0,
		}
		if (data.name != null) values[`timeline_${data.num}_name`] = data.name
		this.instance.setVariableValues(values)
		this.instance.checkFeedbacks('timelineState')
	}

	_handleSceneBroadcast(data) {
		if (!data || data.num == null) return
		const prev = this.instance.state.scenes.get(data.num)
		const name = data.name ?? prev?.name ?? ''
		this.instance.state.scenes.set(data.num, {
			num: data.num,
			name,
			state: data.state || 'none',
			onstage: data.onstage ?? false,
		})
		this.instance.log('debug', `Scene ${data.num} -> ${data.state}`)
		const values = {
			[`scene_${data.num}_state`]: formatState(data.state || 'none'),
			[`scene_${data.num}_onstage`]: String(data.onstage ?? false),
		}
		if (data.name != null) values[`scene_${data.num}_name`] = data.name
		this.instance.setVariableValues(values)
		this.instance.checkFeedbacks('sceneState')
	}

	_handleGroupBroadcast(data) {
		if (!data || data.num == null) return
		const prev = this.instance.state.groups.get(data.num)
		const name = data.name ?? prev?.name ?? ''
		this.instance.state.groups.set(data.num, {
			num: data.num,
			name,
			level: data.level ?? 0,
		})
		this.instance.log('debug', `Group ${data.num} (${name}) level -> ${data.level}`)
		const values = {
			[`group_${data.num}_level`]: data.level ?? 0,
		}
		if (data.name != null) values[`group_${data.num}_name`] = data.name
		this.instance.setVariableValues(values)
		this.instance.checkFeedbacks('groupState')
	}

	_handleBeaconBroadcast(data) {
		if (!data) return
		this.instance.state.beacon = data.on
		this.instance.log('debug', `Beacon -> ${data.on}`)
		this.instance.setVariableValues({
			beacon: data.on ? 'On' : 'Off',
		})
	}

	_handleRemoteDeviceBroadcast(data) {
		if (!data) return
		const values = {}
		// Handle both array format and individual device format
		const devices = data.remote_devices || (data.num != null ? [data] : [])
		for (const dev of devices) {
			this.instance.state.remoteDevices.set(dev.num, {
				num: dev.num,
				name: dev.name || dev.type || '',
				online: dev.online ?? false,
				type: dev.type || '',
			})
			values[`remote_device_${dev.num}_name`] = dev.name || dev.type || ''
			values[`remote_device_${dev.num}_online`] = dev.online ? 'Online' : 'Offline'
			values[`remote_device_${dev.num}_type`] = dev.type || ''
		}
		if (devices.length > 0) {
			this.instance.log('debug', `Remote devices updated: ${devices.length} devices`)
			this.instance.setVariableValues(values)
			this.instance.updateVariableDefinitions()
		}
	}

	_handleLogMessage(data) {
		if (!data || !data.log) return
		const logLevel = this.instance.config.controllerLogLevel
		if (!logLevel || logLevel === 'off') return

		// Raw log mode — dump unprocessed data for debugging
		if (logLevel === 'raw') {
			this.instance.log('warn', `[RAW LOG] ${JSON.stringify(data.log)}`)
			return
		}

		// Log levels from the API: 2=Critical, 3=Terse, 4=Normal, 5=Extended, 6=Verbose, 7=Debug
		// Log categories: 16=System, 17=Project, 18=Time, 19=Output, 20=IO, 21=Trigger, 22=Controller API, 23=DALI
		const categoryNames = {
			16: 'System',
			17: 'Project',
			18: 'Time',
			19: 'Output',
			20: 'IO',
			21: 'Trigger',
			22: 'Controller API',
			23: 'DALI',
		}
		const levelNames = { 2: 'Critical', 3: 'Terse', 4: 'Normal', 5: 'Extended', 6: 'Verbose', 7: 'Debug' }

		// Parse log entries — each starts with \u0007
		const entries = data.log.split('\u0007').filter((e) => e.length > 0)
		for (const entry of entries) {
			if (entry.length < 2) continue
			const typeCode = entry.charCodeAt(0)
			const levelCode = entry.charCodeAt(1)

			const category = categoryNames[typeCode] || `Cat${typeCode}`
			const level = levelNames[levelCode] || `Lvl${levelCode}`

			// Extract message text: after category+level bytes, format is:
			// <hex UTC offset><space><8 hex timestamp chars><message text><\n>
			const rest = entry.substring(2)
			const spaceIdx = rest.indexOf(' ')
			if (spaceIdx === -1 || rest.length < spaceIdx + 9) continue
			// Skip offset (variable hex), space, and 8-char hex timestamp
			const message = rest.substring(spaceIdx + 9)

			// User opted in to see these — use warn for critical/terse, info for everything else
			const companionLevel = levelCode <= 3 ? 'warn' : 'info'
			this.instance.log(companionLevel, `[${level}/${category}] ${message.trim()}`)
		}
	}

	_handleBinaryMessage(data) {
		// Binary message of all zeros means session timed out
		const allZeros = Buffer.isBuffer(data) && data.length > 0 && data.every((byte) => byte === 0)
		if (allZeros) {
			this.instance.log('warn', 'WebSocket session timed out (binary all-zeros), reconnecting...')
			this._close()
			this.instance.pharosConnected = false
			this.instance.updateStatus(InstanceStatus.ConnectionFailure, 'Session timed out')
			this.instance.setVariableValues({ ws_connected: 'false' })
			this._scheduleReconnect()
		}
	}

	async _refreshAfterReconnect() {
		try {
			const inst = this.instance
			const [groupsRes, scenesRes, timelinesRes, triggersRes] = await Promise.all([
				inst.controller.getGroups(),
				inst.controller.getScenes(),
				inst.controller.getTimelines(),
				inst.controller.getTriggers(),
			])
			if (this.destroyed) return

			if (groupsRes.success && scenesRes.success && timelinesRes.success && triggersRes.success) {
				inst.filteredGroups = groupsRes.groups?.filter((g) => g.num != null) || []
				inst.actionData.groups = inst.filteredGroups.map((g) => ({ id: g.num, label: g.name }))
				if (!inst.actionData.groups.length) inst.actionData.groups = [{ id: 0, label: 'No groups found' }]
				inst.actionData.scenes = scenesRes.scenes?.map((s) => ({ id: s.num, label: s.name })) || []
				if (!inst.actionData.scenes.length) inst.actionData.scenes = [{ id: 0, label: 'No scenes found' }]
				inst.actionData.timelines = timelinesRes.timelines?.map((t) => ({ id: t.num, label: t.name })) || []
				if (!inst.actionData.timelines.length) inst.actionData.timelines = [{ id: 0, label: 'No timelines found' }]
				inst.actionData.triggers = triggersRes.triggers?.map((t) => ({ id: t.num, label: t.name })) || []
				if (!inst.actionData.triggers.length) inst.actionData.triggers = [{ id: 0, label: 'No triggers found' }]

				for (const tl of timelinesRes.timelines || []) {
					inst.state.timelines.set(tl.num, {
						num: tl.num,
						name: tl.name || '',
						state: tl.state || 'none',
						onstage: tl.onstage ?? false,
						position: tl.position ?? 0,
					})
				}
				for (const sc of scenesRes.scenes || []) {
					inst.state.scenes.set(sc.num, {
						num: sc.num,
						name: sc.name || '',
						state: sc.state || 'none',
						onstage: sc.onstage ?? false,
					})
				}
				for (const gr of inst.filteredGroups) {
					inst.state.groups.set(gr.num, {
						num: gr.num,
						name: gr.name,
						level: gr.level ?? 0,
					})
				}

				inst.updateActions()
				inst.updateFeedbacks()
				inst.updateVariableDefinitions()
				inst.updatePresets()
				inst._seedVariableValues()
				inst.log('debug', 'Refreshed controller data after reconnect')
			}
		} catch (e) {
			this.instance.log('warn', `Failed to refresh data after reconnect: ${e.message}`)
		}
	}

	_startKeepAlive() {
		this._stopKeepAlive()
		this._pongReceived = true
		this.keepAliveInterval = setInterval(() => {
			// Check if previous ping was answered
			if (!this._pongReceived) {
				this.instance.log('warn', 'WebSocket ping timeout — connection dead, reconnecting...')
				this._close()
				this.instance.pharosConnected = false
				this.instance.updateStatus(InstanceStatus.ConnectionFailure, 'Connection lost')
				this.instance.setVariableValues({ ws_connected: 'false' })
				if (!this.destroyed) {
					this._scheduleReconnect()
				}
				return
			}
			// Send application-level keepalive — always use the controller's latest token
			// since the HTTP polling refreshes it before the 4.5-minute TTL expires
			const currentToken = this.instance.controller?.token || this.token
			if (currentToken) {
				this.token = currentToken
			}
			const msg = {}
			if (this.token) {
				msg.token = this.token
			}
			this._send(msg)
			// Send WebSocket-level ping
			this._pongReceived = false
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.ping()
			}
		}, 10000)
	}

	_stopKeepAlive() {
		if (this.keepAliveInterval) {
			clearInterval(this.keepAliveInterval)
			this.keepAliveInterval = null
		}
	}

	_scheduleReconnect() {
		if (this.destroyed || this.reconnectTimer) return
		this.instance.log('debug', `WebSocket reconnecting in ${this.reconnectDelay / 1000}s...`)
		this.reconnectTimer = setTimeout(async () => {
			this.reconnectTimer = null
			if (this.destroyed) return

			try {
				const authRes = await this.instance.controller.authenticate(
					this.instance.config.user,
					this.instance.config.password,
				)
				if (this.destroyed) return
				if (authRes.success) {
					this.token = this.instance.controller.token
					await this._refreshAfterReconnect()
					if (this.destroyed) return
					this.connect(this.host, this.token)
				} else {
					this.instance.log('error', `WebSocket re-auth failed: ${authRes.error || 'unknown error'}, retrying...`)
					this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
					this._scheduleReconnect()
				}
			} catch (e) {
				if (this.destroyed) return
				this.instance.log('error', `WebSocket re-auth error: ${e.message}`)
				this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
				this._scheduleReconnect()
			}
		}, this.reconnectDelay)
	}

	_close() {
		this._stopKeepAlive()
		if (this.ws) {
			this.ws.removeAllListeners()
			if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
				this.ws.close()
			}
			this.ws = null
		}
	}

	destroy() {
		this.destroyed = true
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this._close()
		this.instance.log('debug', 'WebSocket destroyed')
	}
}
