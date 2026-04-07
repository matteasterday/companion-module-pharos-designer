import WebSocket from 'ws'
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
		this._close() // Clean up any existing connection before creating a new one
		this.host = host
		this.token = token

		const protocol = this.instance.config.useSecureWebSocket ? 'wss' : 'ws'
		const url = `${protocol}://${host}/query`
		this.instance.log('debug', `WebSocket connecting to ${url}`)

		try {
			this.ws = new WebSocket(url)
		} catch (e) {
			this.instance.log('error', `WebSocket connection error: ${e.message}`)
			this._scheduleReconnect()
			return
		}

		// Connection timeout — if not connected within 10s, give up and reconnect
		this._connectionTimeout = setTimeout(() => {
			if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
				this.instance.log('warn', 'WebSocket connection timed out')
				this._close()
				this._scheduleReconnect()
			}
		}, 10000)

		this.ws.on('open', () => {
			clearTimeout(this._connectionTimeout)
			this._connectionTimeout = null
			this.instance.log('info', 'WebSocket connected')
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
			this._stopKeepAlive()
			this.instance.setVariableValues({ ws_connected: 'false' })
			if (!this.destroyed) {
				this._scheduleReconnect()
			}
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
				this.instance.log('debug', 'WebSocket send failed: ' + e.message)
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
		} else if (msg.broadcast === 'log' || msg.request === 'log') {
			this._handleLogMessage(msg.data)
		}
	}

	_handleTimelineBroadcast(data) {
		if (!data || data.num == null) return
		this.instance.state.timelines.set(data.num, {
			num: data.num,
			state: data.state,
			onstage: data.onstage,
			position: data.position,
		})
		this.instance.log('debug', `Timeline ${data.num} -> ${data.state}`)
		this.instance.setVariableValues({
			[`timeline_${data.num}_state`]: formatState(data.state),
			[`timeline_${data.num}_onstage`]: String(data.onstage),
			[`timeline_${data.num}_position`]: data.position,
		})
		this.instance.checkFeedbacks('timelineState')
	}

	_handleSceneBroadcast(data) {
		if (!data || data.num == null) return
		this.instance.state.scenes.set(data.num, {
			num: data.num,
			state: data.state,
			onstage: data.onstage,
		})
		this.instance.log('debug', `Scene ${data.num} -> ${data.state}`)
		this.instance.setVariableValues({
			[`scene_${data.num}_state`]: formatState(data.state),
			[`scene_${data.num}_onstage`]: String(data.onstage),
		})
		this.instance.checkFeedbacks('sceneState')
	}

	_handleGroupBroadcast(data) {
		if (!data || data.num == null) return
		this.instance.state.groups.set(data.num, {
			num: data.num,
			name: data.name,
			level: data.level,
		})
		this.instance.log('debug', `Group ${data.num} (${data.name}) level -> ${data.level}`)
		this.instance.setVariableValues({
			[`group_${data.num}_level`]: data.level,
			[`group_${data.num}_name`]: data.name,
		})
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
		if (!data || !data.remote_devices) return
		const values = {}
		for (const dev of data.remote_devices) {
			this.instance.state.remoteDevices.set(dev.num, {
				num: dev.num,
				name: dev.name,
				online: dev.online,
				type: dev.type,
			})
			values[`remote_device_${dev.num}_name`] = dev.name
			values[`remote_device_${dev.num}_online`] = dev.online ? 'Online' : 'Offline'
			values[`remote_device_${dev.num}_type`] = dev.type
		}
		this.instance.log('debug', `Remote devices updated: ${data.remote_devices.length} devices`)
		this.instance.setVariableValues(values)
	}

	_handleLogMessage(data) {
		if (!data || !data.log) return
		const logLevel = this.instance.config.controllerLogLevel
		if (!logLevel || logLevel === 'off') return

		// Log levels from the API: 2=Critical, 3=Terse, 4=Normal, 5=Extended, 6=Verbose, 7=Debug
		// Log categories: 16=System, 17=Project, 18=Time, 19=Output, 20=IO, 21=Trigger, 22=Controller API, 23=DALI
		const categoryNames = {
			16: 'System',
			17: 'Project',
			18: 'Time',
			19: 'Output',
			20: 'IO',
			21: 'Trigger',
			22: 'API',
			23: 'DALI',
		}
		const levelNames = { 2: 'Critical', 3: 'Terse', 4: 'Normal', 5: 'Extended', 6: 'Verbose', 7: 'Debug' }

		// Parse log entries — each starts with \u0007
		const entries = data.log.split('\u0007').filter((e) => e.length > 0)
		for (const entry of entries) {
			try {
				if (entry.length < 2) continue
				const typeCode = entry.charCodeAt(0)
				const levelCode = entry.charCodeAt(1)

				// Filter by configured level
				if (logLevel === 'warnings' && levelCode > 3) continue

				const category = categoryNames[typeCode] || `Cat${typeCode}`
				const level = levelNames[levelCode] || `Lvl${levelCode}`

				// Extract message text — skip the offset (variable hex) and timestamp (8 hex chars)
				// Find the first space after the offset+timestamp to get the message
				const rest = entry.substring(2)
				const spaceIdx = rest.indexOf(' ')
				if (spaceIdx === -1) continue
				const timestampAndMsg = rest.substring(spaceIdx + 1)
				const msgSpaceIdx = timestampAndMsg.indexOf(' ')
				const message = msgSpaceIdx !== -1 ? timestampAndMsg.substring(msgSpaceIdx + 1) : timestampAndMsg

				const companionLevel = levelCode <= 3 ? 'warn' : 'debug'
				this.instance.log(companionLevel, `[${category}/${level}] ${message.trim()}`)
			} catch (e) {
				this.instance.log('debug', `Log entry parse error: ${e.message}`)
			}
		}
	}

	_handleBinaryMessage(data) {
		// Binary message of all zeros means session timed out
		const allZeros = Buffer.isBuffer(data) && data.every((byte) => byte === 0)
		if (allZeros) {
			this.instance.log('warn', 'WebSocket session timed out (binary all-zeros), reconnecting...')
			this._close()
			this._scheduleReconnect()
		}
	}

	_startKeepAlive() {
		this._stopKeepAlive()
		this.keepAliveInterval = setInterval(() => {
			const msg = {}
			if (this.token) {
				msg.token = this.token
			}
			this._send(msg)
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

			// Re-authenticate to get a fresh token
			try {
				const authRes = await this.instance.controller.authenticate(
					this.instance.config.user,
					this.instance.config.password,
				)
				if (this.destroyed) return // destroyed while awaiting auth
				if (authRes.success) {
					this.token = this.instance.controller.token
					this.connect(this.host, this.token)
				} else {
					this.instance.log('error', 'WebSocket re-auth failed, retrying...')
					this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
					this._scheduleReconnect()
				}
			} catch (e) {
				this.instance.log('error', `WebSocket re-auth error: ${e.message}`)
				this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
				this._scheduleReconnect()
			}
		}, this.reconnectDelay)
	}

	_close() {
		this._stopKeepAlive()
		clearTimeout(this._connectionTimeout)
		this._connectionTimeout = null
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
