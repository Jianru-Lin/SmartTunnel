// [导出]
module.exports = Authorize;

// [模块]
var events = require('events');
var util = require('util');

// [流程]
util.inherits(Authorize, events.EventEmitter);

// [函数]
function Authorize(options) {
	this.options = options;
}

Authorize.prototype.getOptions = function() {
	return this.options;
}

Authorize.prototype.setOptions = function(v) {
	this.options = v;
}

Authorize.prototype.start = function() {
	var self = this;
	self.emit('start');
	self.emit('success', {
		serverHost: "15.185.109.87",
		serverPort: 8888,
		key: "1a52173707ec6b114ffc8b33be3043eca43f2eb4"
	});
	self.emit('stop');
}

Authorize.prototype.stop = function() {
}