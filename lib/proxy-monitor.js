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
	this.tunnelLogStreamHeap = {
		name: 'heap jack'
	};
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

	// 为了停止的时候能取消上面订阅的事件
	// 如果记录下局部函数
	self.onProxyStart = onProxyStart;
	self.onProxyError = onProxyError;
	self.onProxyStop = onProxyStop;
	self.onProxyTunnelAdd = onProxyTunnelAdd;
	self.onProxyTunnelRemove = onProxyTunnelRemove;

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
		var tunnelId = tunnel.id;
		var logFileName = 'log/' + tunnelId + '.txt';
		var tunnelLogStream = fs.createWriteStream(logFileName, {encoding: 'utf8'});

		self.tunnelLogStreamHeap[tunnelId] = tunnelLogStream;

		write(tunnelLogStream, 'proxy tunnel add, id=%s\n', tunnelId);

		// 监听 clientSocket、serverSocket、forwardStream、backwardStream 的关闭事件
		tunnel.clientSocket.on('close', onClientSocketClose);
		tunnel.serverSocket.on('close', onServerSocketClose);
		tunnel.forwardStream.on('close', onForwardStreamClose);
		tunnel.backwardStream.on('close', onBackwardStreamClose);

		function onClientSocketClose() {
			writeTunnelLog(tunnel, 'clientSocket close');
		}

		function onServerSocketClose() {
			writeTunnelLog(tunnel, 'serverSocket close');
		}

		function onForwardStreamClose() {
			writeTunnelLog(tunnel, 'forwardStream close');
		}

		function onBackwardStreamClose() {
			writeTunnelLog(tunnel, 'backwardStream close');
		}
	}

	function onProxyTunnelRemove(tunnel) {
		writeTunnelLog(tunnel, 'proxy tunnel remove, id=%s\n', tunnel.id);
		// 释放 tunnelLogStream
		var tunnelLogStream = self.tunnelLogStreamHeap[tunnel.id];
		tunnelLogStream.end();

		// 删除引用
		delete self.tunnelLogStreamHeap[tunnel.id];
	}

	function writeTunnelLog(tunnel) {
		var tunnelId = tunnel.id;
		var tunnelLogStream = self.tunnelLogStreamHeap[tunnelId];
		if (!tunnelLogStream) return;

		var args = Array.prototype.slice.call(arguments, 1);
		args.unshift(tunnelLogStream);
		write.apply(this, args);
	}
}

ProxyMonitor.prototype.stop = function() {
	var self = this;
	var proxy = self.proxy;

	if (self.proxy) {
		proxy.removeListener('start', self.onProxyStart);
		proxy.removeListener('error', self.onProxyError);
		proxy.removeListener('stop', self.onProxyStop);
		proxy.removeListener('tunnel.add', self.onProxyTunnelAdd);
		proxy.removeListener('tunnel.remove', self.onProxyTunnelRemove);
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
	var args = [self.proxyLogStream];
	args = args.concat(Array.prototype.slice.call(arguments, 0));
	write.apply(this, args);
}

function write(stream) {
	var args = Array.prototype.slice.call(arguments, 1);
	var text = util.format.apply(this, args);
	//console.log(text);
	stream.write(text);
}