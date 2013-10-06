// [导出]
module.exports = ProxyMonitor;

// [模块]
var events = require('events');
var util = require('util');
var fs = require('fs');

// [流程]
util.inherits(ProxyMonitor, events.EventEmitter);

if (!fs.existsSync('log')) {
	fs.mkdirSync('log');
}

// [函数]
function ProxyMonitor(proxy) {
	this.proxy = proxy;
	this.proxyLogStream = undefined;
}

ProxyMonitor.prototype.getProxy = function() {
	return this.proxy;
}

ProxyMonitor.prototype.setProxy = function(v) {
	this.proxy = v;
	return this;
}

ProxyMonitor.prototype.start = function() {
	var self = this;

	var proxy = self.proxy;
	if (!proxy) return;

	// 创建文件流
	self.proxyLogStream = fs.createWriteStream('log/proxy.txt', {encoding: 'utf8'});

	// 发出 start 事件
	self.emit('start');

	// 订阅 proxy 的各项事件，开始运作
	proxy.on('start', onProxyStart);
	proxy.on('error', onProxyError);
	proxy.on('stop', onProxyStop);
	proxy.on('tunnel.add', onProxyTunnelAdd);
	proxy.on('tunnel.remove', onProxyTunnelRemove);
	proxy.on('tunnel.start', onProxyTunnelStart);
	proxy.on('tunnel.stop', onProxyTunnelStop);

	// 为了停止的时候能取消上面订阅的事件
	// 如果记录下局部函数
	self.onProxyStart = onProxyStart;
	self.onProxyError = onProxyError;
	self.onProxyStop = onProxyStop;
	self.onProxyTunnelAdd = onProxyTunnelAdd;
	self.onProxyTunnelRemove = onProxyTunnelRemove;
	self.onProxyTunnelStart = onProxyTunnelStart;
	self.onProxyTunnelStop = onProxyTunnelStop;

	// 事件处理
	function onProxyStart() {
		self.log('proxy start\n');
	}

	function onProxyError(err) {
		self.log('proxy error: %s\n', err.toString());
	}

	function onProxyStop() {
		self.log('proxy stop\n');
	}

	function onProxyTunnelAdd(tunnel) {
		self.log('proxy tunnel add, id=%s\n', tunnel.id);
	}

	function onProxyTunnelRemove(tunnel) {
		self.log('proxy tunnel remove, id=%s\n', tunnel.id);
	}

	function onProxyTunnelStart(tunnel) {
		self.log('proxy tunnel start, id=%s\n', tunnel.id);
	}

	function onProxyTunnelStop(tunnel) {
		self.log('proxy tunnel stop, id=%s\n', tunnel.id);
	}
}

ProxyMonitor.prototype.stop = function() {
	var self = this;
	var proxy = self.proxy;

	if (self.proxy) {debugger;
		proxy.removeListener('start', self.onProxyStart);
		proxy.removeListener('error', self.onProxyError);
		proxy.removeListener('stop', self.onProxyStop);
		proxy.removeListener('tunnel.add', self.onProxyTunnelAdd);
		proxy.removeListener('tunnel.remove', self.onProxyTunnelRemove);
		proxy.removeListener('tunnel.start', self.onProxyTunnelStart);
		proxy.removeListener('tunnel.stop', self.onProxyTunnelStop);
	}

	self.proxy = undefined;

	if (self.proxyLogStream) {
		self.proxyLogStream.end();
	}

	self.proxyLogStream = undefined;

	self.emit('stop');
}


ProxyMonitor.prototype.log = function() {
	var self = this;
	var text = util.format.apply(this, arguments);
	self.proxyLogStream.write(text);
}