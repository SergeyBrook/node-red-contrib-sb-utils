module.exports = function(RED) {
	'use strict';


	/**
	 * SBQueueNode
	 * SB Queue node
	 * @param {*} config 
	 */
	function SBQueueNode(config) {
		// Init node:
		RED.nodes.createNode(this, config);
		let node = this;

		// Node props:
		this.name = config.name;
		this.control = config.control;
		this.enableEvents = config.enableEvents;
		this.autopeekFirst = config.autopeekFirst;
		this.autopeekNext = config.autopeekNext;
		this.initEvent = config.initEvent;

		// Queue:
		this.queue = {
			store: [],
			lastState: 'empty',
			lastLength: 0,
			warnLength: parseInt(config.warnLength), // 0 = No warning.
			maxLength: parseInt(config.maxLength), // 0 = No limit.
			keepNewest: config.keepNewest,
			init: function() {
				if (node.initEvent) {
					node.send([null, this.getStateEvent('init')]);
				}
			},
			add: function(item) {
				let id = null;
				if (this.maxLength > 0 && this.store.length >= this.maxLength) {
					// Queue is full:
					if (this.keepNewest) {
						// Keep newest item:
						// Get messsage id of head (string):
						id = this.getItemId(0);
						// Remove head (oldest item):
						this.store.shift();
						// Add new item to tail:
						this.store.push(item);
					} else {
						// Drop newest item:
						// Get id of new item (string):
						id = this.getMsgId(item);
					}
				} else {
					// Add new item to tail:
					this.store.push(item);
				}
				return this.getRemoveEvent('overflow', id);
			},
			pull: function() {
				let item = null;
				if (this.store.length > 0) {
					// Get and remove head:
					item = this.store.shift();
				}
				return item;
			},
			peek: function() {
				let item = null;
				if (this.store.length > 0) {
					// Get head:
					item = this.store[0];
				}
				return item;
			},
			drop: function() {
				let id = null;
				if (this.store.length > 0) {
					// Get messsage id of head (string):
					id = this.getItemId(0);
					// Remove head:
					this.store.shift();
				}
				return this.getRemoveEvent('drop', id);
			},
			flush: function() {
				let items = null;
				if (this.store.length > 0) {
					// Get all:
					items = this.store;
					// Clear all:
					this.store = [];
				}
				return items;
			},
			reset: function() {
				let ids = null;
				if (this.store.length > 0) {
					// Get all messsages id in queue (array):
					ids = this.store.map(this.getMsgId);
					// Clear all:
					this.store = [];
				}
				return this.getRemoveEvent('reset', ids);
			},
			clear: function() {
				// Clear all:
				this.store = [];
			},
			getLength: function() {
				return this.store.length;
			},
			getStatus: function() {
				let status = {
					text: this.store.length + ' (w:' + this.warnLength + ', m:' + this.maxLength + ')',
					state: 'normal',
					shape: 'dot',
					fill: 'green'
				}
				if (this.store.length == 0) {
					status.state = 'empty';
					status.shape = 'ring';
				} else {
					if (this.warnLength > 0 && this.store.length >= this.warnLength) {
						status.state = 'warning';
						status.fill = 'yellow';
					}
					if (this.maxLength > 0 && this.store.length >= this.maxLength) {
						status.state = 'full';
						status.fill = 'red';
					}
				}
				return status;
			},
			getMsgId(value, index, array) {
				return (value.hasOwnProperty('_msgid') ? value._msgid : 'undefined');
			},
			getItemId: function(index) {
				let id = 'undefined';
				if (this.store.length > index) {
					id = this.getMsgId(this.store[index]);
				}
				return id;
			},
			getRemoveEvent: function(reason, id) {
				let event = null;
				if (node.enableEvents && id) {
					event = {
						_msgid: RED.util.generateId(),
						name: 'remove',
						reason: reason,
						id: (typeof id == 'string' ? [id] : id)
					};
				}
				return event;
			},
			getStateEvent: function(reason) {
				let event = null;
				let status = this.getStatus();
				if (node.enableEvents && (reason || status.state != this.lastState)) {
					event = {
						_msgid: RED.util.generateId(),
						name: 'state',
						reason: reason || 'change',
						state: status.state,
						prevState: this.lastState,
						length: this.store.length,
						prevLength: this.lastLength,
						warnLength: this.warnLength,
						maxLength: this.maxLength
					};
				}
				this.lastLength = this.store.length;
				this.lastState = status.state;
				return event;
			}
		};

		// Commands:
		this.commands = [
			'pull', // Get `msg` from queue head and remove from queue.
			'peek', // Get `msg` from queue head but do not remove from queue.
			'drop', // Remove `msg` from queue head.
			'flush', // Get all `msg`s from queue and clear queue.
			'reset', // Remove all `msg`s from queue.
			'get-state', // Get queue state.
			'void' // Do nothing.
		];

		// On message input event handler:
		this.on('input', function(msg, send, done) {
			// Data - sent to first output:
			let data = null;
			// Event - sent to second output:
			let event = [];
			// Error:
			let error = null;

			if (msg.hasOwnProperty(node.control)) {
				// Received control message:
				let command = (typeof msg[node.control] == 'string' ? msg[node.control].toLowerCase() : '');

				if (node.commands.includes(command)) {
					// Process command:
					switch (command) {
						case 'pull':
							data = node.queue.pull();
							break;
						case 'peek':
							data = node.queue.peek();
							break;
						case 'drop':
							// Drop and add 'remove' event:
							event.push(node.queue.drop());
							// Auto-peek next:
							data = (node.autopeekNext ? node.queue.peek() : null);
							break;
						case 'flush':
							data = node.queue.flush();
							break;
						case 'reset':
							// Reset and add 'remove' event:
							event.push(node.queue.reset());
							break;
						case 'get-state':
							// Add 'state' event:
							event.push(node.queue.getStateEvent(command));
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
				// Add message and add 'remove' event:
				event.push(node.queue.add(msg));
				// Auto-peek first:
				data = (node.queue.getLength() == 1 && node.autopeekFirst ? msg : null);
			}

			// Update node status:
			node.status(node.queue.getStatus());
			// Add 'state' event:
			event.push(node.queue.getStateEvent());

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
			// Clear all:
			node.queue.clear();
			// Notify done:
			done();
		});

		// Init queue:
		node.queue.init();
		// Set node status:
		node.status(node.queue.getStatus());
	}

	// Register node:
	RED.nodes.registerType('sb-queue', SBQueueNode);
}
