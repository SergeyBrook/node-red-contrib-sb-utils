module.exports = function(RED) {
	'use strict';


	/**
	 * SBWatchdogNode
	 * SB Watchdog node
	 * @param {*} config 
	 */
	function SBWatchdogNode(config) {
		// Init node:
		RED.nodes.createNode(this, config);
		let node = this;

		// Node props:
		this.name = config.name;
		this.control = config.control;
		this.enableEvents = config.enableEvents;
		this.initOn = config.initOn;
		this.initEvent = config.initEvent;

		// Watchdog:
		this.watchdog = {
			delay: 1 * 60 * 1000, // Just in case `init` not called, set to 1 minute.
			on: false,
			id: 0,
			init: function(delay, units) {
				this.setDelay(delay, units);
				if (node.initOn) {
					this.turnOn();
				} else {
					this.turnOff();
				}
				if (node.initEvent) {
					node.send([null, null, this.getEvent('init')]);
				}
			},
			setDelay: function(delay, units) {
				this.delay = parseInt(delay);
				// Apply units:
				switch (units) {
					case 'milliseconds': // do nothing
						break;
					case 'days':
						this.delay *= 24;
					case 'hours':
						this.delay *= 60;
					case 'minutes':
						this.delay *= 60;
					default: // seconds
						this.delay *= 1000;
				}
			},
			turnOn: function() {
				let event = null;
				if (!this.on) {
					this.on = true;
					this.id = setTimeout(this.onTimeout, this.delay);
					event = this.getEvent('on');
				}
				node.status(this.getStatus());
				return event;
			},
			turnOff: function() {
				let event = null;
				if (this.on) {
					this.on = false;
					clearTimeout(this.id);
					event = this.getEvent('off');
				}
				node.status(this.getStatus());
				return event;
			},
			toggle: function() {
				if (this.on) {
					clearTimeout(this.id);
				} else {
					this.id = setTimeout(this.onTimeout, this.delay);
				}
				this.on = !this.on;
				node.status(this.getStatus());
				return this.getEvent('toggle');
			},
			reset: function() {
				if (this.on) {
					// Clear current timeout:
					clearTimeout(this.id);
					// Set new timeout:
					this.id = setTimeout(this.onTimeout, this.delay);
				}
			},
			getStatus: function() {
				return {
					fill: 'green',
					shape: (this.on ? 'dot' : 'ring'),
					text: (this.on ? 'On (' : 'Off (') + this.delay / 1000 + ' sec)'
				};
			},
			getEvent: function(reason) {
				let result = null;
				if (node.enableEvents && reason) {
					result = {
						_msgid: RED.util.generateId(),
						name: 'state',
						reason: reason,
						state: (this.on ? 'on' : 'off'),
						on: this.on,
						off: !this.on,
						delay: this.delay
					};
				}
				return result;
			},
			onTimeout: function() {
				if (node.watchdog.on) {
					let trigger = {
						_msgid: RED.util.generateId(),
						delay: node.watchdog.delay
					};
					// Send trigger:
					node.send([null, trigger, null]);
					// Set new timeout:
					node.watchdog.id = setTimeout(node.watchdog.onTimeout, node.watchdog.delay);
				}
			}
		};

		// Commands:
		this.commands = [
			'on', // Turn watchdog on.
			'off', // Turn watchdog off.
			'toggle', // Toggle watchdog.
			'get-state', // Get watchdog state.
			'void' // Do nothing.
		];

		// On message input event handler:
		this.on('input', function(msg, send, done) {
			// Data - sent to first output:
			let data = null;
			// Event - sent to third output:
			let event = null;
			// Error:
			let error = null;

			if (msg.hasOwnProperty(node.control)) {
				// Received control message:
				let command = (typeof msg[node.control] == 'string' ? msg[node.control].toLowerCase() : '');

				if (node.commands.includes(command)) {
					// Process command:
					switch (command) {
						case 'on':
							// Turn on watchdog and add 'state' event:
							event = node.watchdog.turnOn();
							break;
						case 'off':
							// Turn off watchdog and add 'state' event:
							event = node.watchdog.turnOff();
							break;
						case 'toggle':
							// Toggle watchdog and add 'state' event:
							event = node.watchdog.toggle();
							break;
						case 'get-state':
							// Add 'state' event:
							event = node.watchdog.getEvent(command);
							break;
						case 'void':
							// Do nothing.
							break;
					}
				} else {
					// Invalid command:
					error = 'Invalid command';
				}
			} else {
				// Received regular message:
				data = msg;
				// Reset watchdog:
				node.watchdog.reset();
			}

			if (error) {
				// Trigger Catch node:
				done(error);
			} else {
				// Send:
				send([data, null, event]);
				// Notify done:
				done();
			}
		});

		// On node close event handler:
		this.on('close', function(done) {
			// Turn off watchdog:
			node.watchdog.turnOff();
			// Notify done:
			done();
		});

		// Init watchdog:
		node.watchdog.init(config.delay, config.units);
	}

	// Register node:
	RED.nodes.registerType('sb-watchdog', SBWatchdogNode);
}
