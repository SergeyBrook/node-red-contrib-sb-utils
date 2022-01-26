module.exports = function(RED) {
	'use strict';


	/**
	 * SBPulseNode
	 * SB Pulse node
	 * @param {*} config 
	 */
	function SBPulseNode(config) {
		// Init node:
		RED.nodes.createNode(this, config);
		let node = this;

		// Node props:
		this.name = config.name;
		this.control = config.control;
		this.enableEvents = config.enableEvents;

		// Pulse:
		this.pulse = {
			tmid: 0,
			msgid: '',
			request: 0,
			sent: 0,
			state: 0, // 0 = READY, 1 = BUSY.
			stateNames: [
				'ready',
				'busy'
			],
			stateMessages: [
				config.readyMessage,
				config.busyMessage
			],
			signal: 0, // 0 = OFF, 1 = ON.
			signalNames: [
				'off',
				'on'
			],
			signalLengths: [
				parseInt(config.lengthOff),
				parseInt(config.lengthOn)
			],
			signalValues: [
				RED.util.evaluateNodeProperty(config.valueOff, config.valueOffType, node, null),
				RED.util.evaluateNodeProperty(config.valueOn, config.valueOnType, node, null)
			],
			init: function() {
				this.request = 0;
				this.sent = 0;
				this.state = 0;
				this.signal = 0;
				this.updateStatus();
			},
			begin: function(num, msgid) {
				if (Number.isInteger(num) && num >= 0) {
					this.request = num;
					this.msgid = msgid;
					this.sent = 0;
					this.signal = 0;
					this.tmid = setTimeout(this.onTimeout, 0);
					return true;
				}
				return false;
			},
			end: function() {
				this.request = 0;
				this.sent = 0;
				this.setReady();
				this.updateStatus();
			},
			setBusy: function() {
				if (this.state == 0) {
					this.state = 1;
					this.sendStateEvent('change');
				}
			},
			setReady: function() {
				if (this.state == 1) {
					this.state = 0;
					this.sendStateEvent('change');
				}
			},
			isReady: function() {
				return (this.state == 0);
			},
			sendOut: function(output, data) {
				if (output >= 0 && output < config.outputs) {
					// Outputs data:
					let outputs = new Array(config.outputs);
					outputs[output] = data;
					// Send outputs:
					node.send(outputs);
				}
			},
			sendSignal: function(output) {
				let signal = {
					_msgid: this.msgid,
					name: this.signalNames[this.signal],
					payload: this.signalValues[this.signal],
					duration: this.signalLengths[this.signal],
					count: this.sent,
					total: this.request
				};
				this.sendOut(output, signal);
			},
			sendStateEvent: function(reason) {
				if (node.enableEvents) {
					let event = {
						_msgid: RED.util.generateId(),
						name: 'state',
						reason: reason,
						state: this.stateNames[this.state],
						control: this.stateMessages[this.state]
					};
					this.sendOut(config.outputs - 1, event);
				}
			},
			sendDropEvent: function(msg, reason) {
				if (node.enableEvents) {
					let event = {
						_msgid: RED.util.generateId(),
						name: 'drop',
						reason: reason,
						data: msg
					};
					this.sendOut(config.outputs - 1, event);
				}
			},
			onTimeout: function() {
				// Outputs: 0 = Signal ON, 1 = Signal OFF
				let output = node.pulse.signal;

				if (node.pulse.signal == 0) {
					// End of OFF signal:
					if (node.pulse.sent < node.pulse.request) {
						// Send next ON signal:
						node.pulse.sent += 1;
						node.pulse.signal = 1;
						node.pulse.sendSignal(output);
						node.pulse.updateStatus();
						node.pulse.tmid = setTimeout(node.pulse.onTimeout, node.pulse.signalLengths[node.pulse.signal]);
					} else {
						// All sent - just end:
						node.pulse.end();
					}
				} else {
					// End of ON signal - send complementary OFF signal:
					node.pulse.signal = 0;
					node.pulse.sendSignal(output);
					node.pulse.updateStatus();
					node.pulse.tmid = setTimeout(node.pulse.onTimeout, node.pulse.signalLengths[node.pulse.signal]);
				}
			},
			updateStatus: function() {
				let status = {
					fill: (this.isReady() ? 'green' : 'yellow'),
					shape: (this.signal == 0 ? 'ring' : 'dot'),
					text: (this.isReady() ? 'Ready' : (this.sent + ': ' + this.signalNames[this.signal] + ' - ' + (this.signalLengths[this.signal] / 1000) + ' sec'))
				};
				// Set status:
				node.status(status);
			}
		};

		// On message input event handler:
		this.on('input', function(msg, send, done) {
			if (node.pulse.isReady()) {
				node.pulse.setBusy();
				if (msg.hasOwnProperty(node.control)) {
					// Received control message:
					let command = parseInt(msg[node.control]);
					let msgid = msg._msgid || RED.util.generateId();
					if (node.pulse.begin(command, msgid)) {
						// Notify done:
						done();
					} else {
						// Invalid command.
						node.pulse.setReady();
						// Trigger Catch node:
						done('Invalid command');
					}
				} else {
					// Invalid command.
					node.pulse.setReady();
					// Trigger Catch node:
					done('Invalid command');
				}
			} else {
				// The node is busy - drop message:
				// Send drop event:
				node.pulse.sendDropEvent(msg, 'busy');
				// Notify done:
				done();
			}
		});

		// On node close event handler:
		this.on('close', function(done) {
			// Notify done:
			done();
		});

		// Init pulse:
		node.pulse.init();
	}

	// Register node:
	RED.nodes.registerType('sb-pulse', SBPulseNode);
}
