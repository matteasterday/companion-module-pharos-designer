## Pharos Designer Controller

This module controls Pharos Designer controllers via their HTTP and WebSocket APIs. Requires API v6 or newer selected in your Designer project (Project > Project Properties > Controller API).

### Supported Controllers

Works with all Pharos Designer controllers, including:

- LPC-1 / LPC-2
- LPC X
- VLC / VLC+

### Configuration

- **Target IP** - The IP address of your Pharos controller
- **User / Password** - Web API credentials (if security is enabled on the controller)
- **Enable WebSocket** - When enabled (default), the module maintains a persistent WebSocket connection for real-time feedback updates. Disable this for older firmware or if the controller has limited available connections (LPC supports 8 simultaneous connections, LPC X and VLC support 16).
- **Controller log forwarding** - Forward controller log messages to the Companion log. Off by default. "Warnings only" forwards Critical and Terse messages. "All messages" forwards everything (can be very noisy).

### Actions

- **Control Timeline** - Start, release, toggle, pause, resume, set rate, or set position
- **Control Groups** - Set master intensity level with optional fade
- **Control Scenes** - Start, release, or toggle
- **Control Triggers** - Fire a trigger with optional string variable and condition testing

### Feedbacks

All feedbacks update in real-time via WebSocket (when enabled), or fall back to HTTP polling.

- **Timeline State** - Change button style based on timeline state (running, paused, holding at end, released, none)
- **Scene State** - Change button style based on scene state (started, released, none)
- **Group Level** - Change button style based on group master intensity level (greater than, less than, or equal to a value)

### Variables

Dynamic variables are created for each timeline, scene, and group in your project:

- `timeline_{num}_state` - Current state of the timeline
- `timeline_{num}_onstage` - Whether the timeline is affecting output
- `timeline_{num}_position` - Playback position in milliseconds
- `scene_{num}_state` - Current state of the scene
- `scene_{num}_onstage` - Whether the scene is affecting output
- `group_{num}_level` - Master intensity level (0-100)
- `group_{num}_name` - Group name
- `project_name` - Project name loaded on the controller
- `project_author` - Project author
- `project_filename` - Project filename
- `hardware_type` - Controller hardware type (e.g., LPC X)
- `serial_number` - Controller serial number
- `firmware_version` - Controller firmware version
- `channel_capacity` - Controller channel capacity
- `ip_address` - Controller IP address
- `input_{num}_type` - Input type (Analog, Digital, Contact Closure)
- `input_{num}_value` - Input current value
- `remote_device_{num}_name` - Remote device name
- `remote_device_{num}_online` - Remote device status (Online/Offline)
- `remote_device_{num}_type` - Remote device type (e.g., EDN 20)
- `beacon` - Controller beacon state (On/Off)
- `ws_connected` - WebSocket connection status (true/false)

### Presets

Pre-built button configurations are available for each item in your project:

- **Timelines** - Start, release, toggle, pause, resume, and status display buttons
- **Scenes** - Start, release, toggle, and status display buttons
- **Groups** - Full (100%), off (0%), and level status display buttons
- **Triggers** - Fire buttons

- **Remote Devices** - Online/offline status display for each remote device (EDN, etc.)
- **Status** - WebSocket connection, controller beacon, connection status

Presets include appropriate feedbacks and variables so buttons reflect the current controller state.

### WebSocket

When WebSocket is enabled, the module subscribes to real-time state broadcasts from the controller. This means button feedbacks and variables update instantly when the controller state changes, without polling. The module automatically reconnects if the connection is lost.

Note: Each WebSocket connection uses one of the controller's available HTTP connections (8 on LPC, 16 on LPC X/VLC).
