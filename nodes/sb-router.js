module.exports = function(RED) {
	'use strict';


	/**
	 * SBRouterNode
	 * SB Router node
	 * @param {*} config 
	 */
	function SBRouterNode(config) {
		// Init node:
		RED.nodes.createNode(this, config);
		let node = this;

		// Node props:
		this.name = config.name;
		this.control = config.control;
		this.defaultOutput = parseInt(config.defaultOutput);

		// Router:
		this.router = {
			output: node.defaultOutput,
			outputsNum: parseInt(config.outputs),
			init: function() {
				node.status(this.getStatus());
			},
			setOutput: function(num) {
				if (Number.isInteger(num) && num >= 0 && num <= this.outputsNum) {
					this.output = (num > 0 ? num : node.defaultOutput);
					node.status(this.getStatus());
					return true;
				} else {
					return false;
				}
			},
			getStatus: function() {
				return {
					fill: 'green',
					shape: 'dot',
					text: 'Output: ' + this.output
				};
			}
		};

		// On message input event handler:
		this.on('input', function(msg, send, done) {
			if (msg.hasOwnProperty(node.control)) {
				// Received control message:
				let command = parseInt(msg[node.control]);
				if (node.router.setOutput(command)) {
					// Notify done:
					done();
				} else {
					// Invalid command.
					// Trigger Catch node:
					done('Invalid command');
				}
			} else {
				// Received regular message:
				// Prepare output data:
				let data = new Array(node.router.outputsNum);
				data[node.router.output - 1] = msg;
				// Send:
				send(data);
				// Notify done:
				done();
			}
		});

		// On node close event handler:
		this.on('close', function(done) {
			// Notify done:
			done();
		});

		// Init router:
		node.router.init();
	}

	// Register node:
	RED.nodes.registerType('sb-router', SBRouterNode);
}
