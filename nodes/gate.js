module.exports = function(RED) {
	'use strict';


	/**
	 * SBGateNode
	 * SB Gate node
	 * @param {*} config 
	 */
	function SBGateNode(config) {
		// Init node:
		RED.nodes.createNode(this, config);
		let node = this;

		// Node props:
		this.name = config.name;
		this.control = config.control;
		this.enableEvents = config.enableEvents;
		this.initOpen = config.initOpen;
		this.initEvent = config.initEvent;

		// Gate:
		this.gate = {
			opened: false,
			init: function() {
				if (node.initOpen) {
					this.open();
				} else {
					this.close();
				}
				if (node.initEvent) {
					node.send([null, this.getEvent('init')]);
				}
			},
			open: function() {
				let event = null;
				if (!this.opened) {
					this.opened = true;
					event = this.getEvent('open');
				}
				node.status(this.getStatus());
				return event;
			},
			close: function() {
				let event = null;
				if (this.opened) {
					this.opened = false;
					event = this.getEvent('close');
				}
				node.status(this.getStatus());
				return event;
			},
			toggle: function() {
				this.opened = !this.opened;
				node.status(this.getStatus());
				return this.getEvent('toggle');
			},
			isOpen: function() {
				return this.opened;
			},
			getStatus: function() {
				return {
					fill: 'green',
					shape: (this.opened ? 'dot' : 'ring'),
					text: (this.opened ? 'Open' : 'Close')
				};
			},
			getEvent: function(reason) {
				let result = null;
				if (node.enableEvents && reason) {
					result = {
						_msgid: RED.util.generateId(),
						name: 'state',
						reason: reason,
						state: (this.opened ? 'opened' : 'closed'),
						opened: this.opened,
						closed: !this.opened
					};
				}
				return result;
			}
		};

		// Commands:
		this.commands = [
			'open', // Open gate.
			'close', // Close gate.
			'toggle', // Toggle gate.
			'get-state', // Get gate state.
			'void' // Do nothing.
		];

		// On message input event handler:
		this.on('input', function(msg, send, done) {
			// Data - sent to first output:
			let data = null;
			// Event - sent to second output:
			let event = null;
			// Error:
			let error = null;

			if (msg.hasOwnProperty(node.control)) {
				// Received control message:
				let command = (typeof msg[node.control] == 'string' ? msg[node.control].toLowerCase() : '');

				if (node.commands.includes(command)) {
					// Process command:
					switch (command) {
						case 'open':
							// Open gate and add 'state' event:
							event = node.gate.open();
							break;
						case 'close':
							// Close gate and add 'state' event:
							event = node.gate.close();
							break;
						case 'toggle':
							// Toggle gate and add 'state' event:
							event = node.gate.toggle();
							break;
						case 'get-state':
							// Add 'state' event:
							event = node.gate.getEvent(command);
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
				if (node.gate.isOpen()) {
					data = msg;
				}
			}

			if (error) {
				// Trigger Catch node:
				done(error);
			} else {
				// Send:
				send([data, event]);
				// Notify done:
				done();
			}
		});

		// On node close event handler:
		this.on('close', function(done) {
			// Notify done:
			done();
		});

		// Init gate:
		node.gate.init();
	}

	// Register node:
	RED.nodes.registerType('sb-gate', SBGateNode);
}
