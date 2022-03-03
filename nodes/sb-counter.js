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
			countMode: parseInt(config.countMode), // 1 = Increment, -1 = Decrement.
			factor: parseInt(config.factor),
			min: parseInt(config.min),
			max: parseInt(config.max),
			overflowMode: parseInt(config.overflowMode), // 0 = Reset, 1 = Stop.
			overflowSent: false,
			init: function() {
				this.value = (this.countMode > 0 ? this.min : this.max);
				this.overflow = 0;
				this.overflowSent = false;
				this.updateStatus();
			},
			count: function() {
				this.add(this.factor * this.countMode);
				this.updateStatus();
				if (node.enableOnCount) {
					this.send('count');
				}
			},
			reset: function() {
				this.init();
				if (node.enableOnReset) {
					this.send('reset');
				}
			},
			add: function(num) {
				let sig = num / Math.abs(num); // Get sign (+/-) regardles of count mode.
				let val = this.value + num; // Calculate new value.
				let lim = (sig > 0 ? this.max : this.min); // Get limit to check against (max for positive, min for negative values).
				let dif = (val - lim) * sig; // Get normalized value-limit difference (negative = within limit, positive = overflow).

				this.value = (dif > 0 ? lim : val);
				this.overflow += (dif > 0 ? dif * sig : 0);

				this.handleOverflow();
			},
			handleOverflow: function() {
				if (this.overflow !== 0) {
					if (!this.overflowSent) {
						this.send('overflow');
						this.overflowSent = true;
					}

					switch (this.overflowMode) {
						case 0:
							// Reset.
							this.init();
							break;
						case 1:
							// Stop.
							this.updateStatus();
							break;
						default:
							// Do nothing.
							break;
					}
				}
			},
			send: function(reason) {
				let msg = {
					_msgid: RED.util.generateId(),
					name: 'counter',
					reason: reason,
					mode: (this.countMode > 0 ? 'increment' : 'decrement'),
					payload: this.value,
					overflow: this.overflow,
					min: this.min,
					max: this.max
				};
				// Send counter:
				node.send([null, msg]);
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
			if (msg.hasOwnProperty(node.control)) {
				// Received control message:
				let command = (typeof msg[node.control] == 'string' ? msg[node.control].toLowerCase() : '');

				if (node.commands.includes(command)) {
					// Process command:
					switch (command) {
						case 'get':
							node.counter.send(command);
							break;
						case 'reset':
							node.counter.reset();
							break;
						case 'void':
							// Do nothing.
							break;
					}

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
				// Pass trough the message:
				send([msg, null]);
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
