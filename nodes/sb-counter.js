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
			overflow: 0,
			countMode: parseInt(config.countMode), // 1 = increment, -1 = decrement
			factor: parseInt(config.factor),
			min: parseInt(config.min),
			max: parseInt(config.max),
			overflowMode: parseInt(config.overflowMode), // 0 = reset, 1 = stop
			init: function() {
				this.value = (this.countMode > 0 ? this.min : this.max);
				this.overflow = 0;
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
			add: function(num) {
				let val = this.value + num;
				let lim = (this.countMode > 0 ? this.max : this.min);
				let dif = (val - lim) * this.countMode;

				this.value += (dif > 0 ? (num * this.countMode - dif) * this.countMode : num);
				this.overflow += (dif > 0 ? dif : 0);
			},
			count: function() {
				this.add(this.factor * this.countMode);
				this.updateStatus();
			},
			reset: function() {
				this.init();
			},
			updateStatus: function() {
				let status = {
					fill: (this.value >= this.min && this.value <= this.max ? 'green' : 'yellow'),
					shape: (this.value > this.min && this.value < this.max ? 'dot' : 'ring'),
					text: this.value + ' (' + this.overflow + ')'
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
