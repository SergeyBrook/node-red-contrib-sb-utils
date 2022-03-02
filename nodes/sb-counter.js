module.exports = function(RED) {
	'use strict';


	/**
	 * SBCounterNode
	 * SB Counter node
	 * @param {*} config 
	 */
	function SBCounterNode(config) {
		// Init node:
		RED.nodes.createNode(this, config);
		let node = this;

		// Node props:
		this.name = config.name;
		this.control = config.control;
		this.enableOnReset = config.enableOnReset;
		this.enableOnCount = config.enableOnCount;

		// Counter:
		this.counter = {
			value: 0,
			mode: parseInt(config.mode), // 1 = increment, -1 = decrement
			factor: parseInt(config.factor),
			min: parseInt(config.min), // > -(2^53) (Number.MIN_SAFE_INTEGER)
			max: parseInt(config.max), // < 2^53 (Number.MAX_SAFE_INTEGER)
			init: function() {
				this.value = (this.mode > 0 ? this.min : this.max);
				this.updateStatus();
			},
			get: function(reason) {
				return {
					_msgid: RED.util.generateId(),
					name: 'counter',
					reason: reason,
					payload: this.value
				}
			},
			count: function() {
				this.value += this.factor * this.mode;
				this.updateStatus();
			},
			reset: function() {
				this.init();
			},
			updateStatus: function() {
				let status = {
					fill: (this.value >= this.min && this.value <= this.max ? 'green' : 'yellow'),
					shape: (this.value > this.min && this.value < this.max ? 'dot' : 'ring'),
					text: this.value
				};
				// Set status:
				node.status(status);
			}
		};

		// Commands:
		this.commands = [
			'get', // Get counter value.
			'reset', // Reset counter.
			'void' // Do nothing.
		];

		// On message input event handler:
		this.on('input', function(msg, send, done) {
			// Counter - sent to second output:
			let cnt = null;

			if (msg.hasOwnProperty(node.control)) {
				// Received control message:
				let command = (typeof msg[node.control] == 'string' ? msg[node.control].toLowerCase() : '');

				if (node.commands.includes(command)) {
					// Process command:
					switch (command) {
						case 'get':
							cnt = node.counter.get(command);
							break;
						case 'reset':
							node.counter.reset();
							cnt = (node.enableOnReset ? node.counter.get(command) : null);
							break;
						case 'void':
							// Do nothing.
							break;
					}

					// Send counter (or nothing):
					send([null, cnt]);
					// Notify done:
					done();
				} else {
					// Invalid command:
					// Trigger Catch node:
					done('Invalid command');
				}
			} else {
				// Received regular message:
				// Count the messsage:
				node.counter.count();
				// Pass trough the message (and optionally, send counter):
				cnt = (node.enableOnCount ? node.counter.get('count') : null);
				send([msg, cnt]);
				// Notify done:
				done();
			}
		});

		// On node close event handler:
		this.on('close', function(done) {
			// Notify done:
			done();
		});

		// Init counter:
		node.counter.init();
	}

	// Register node:
	RED.nodes.registerType('sb-counter', SBCounterNode);
}
