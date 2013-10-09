// [导出]
module.exports = Proxy;

// [模块]
var net = require('net');
var events = require('events');
var util = require('util');
var crypto = require('crypto');

// [流程]
// 指定 Proxy 的上级原型为 EventEmitter
util.inherits(Proxy, events.EventEmitter);

// [函数]
function Proxy(options) {
	this.options = options;
	this.nextTunnelId = 0;
	this.localSocket = undefined;
	this.tunnelList = [];
}

Proxy.prototype.getOptions = function() {
	return this.options;
}

Proxy.prototype.setOptions = function(v) {
	this.options = v;
	return this;
}

// 功能：启动代理过程
Proxy.prototype.start = function() {
	var self = this;
	var options = self.options;
	if (!checkOptions(options)) {
		return false;
	}

	// 重置 nextTunnelId
	self.nextTunnelId = 0;

	// 取出各项配置信息
	var localPort = options.localPort;
	var enableRemoteAccess = options.enableRemoteAccess;
	var serverHost = options.serverHost;
	var serverPort = options.serverPort;
	var role = options.role;
	var key = options.key;

	// 创建本地套接字
	var localSocket = net.createServer();
	localSocket.on('listening', onLocalSocketListening);
	localSocket.on('connection', onLocalSocketConnection);
	localSocket.on('close', onLocalSocketClose);
	localSocket.on('error', onLocalSocketError);

	// 开始在本地监听
	if (enableRemoteAccess) {
		// 允许其他机器通过本机进行代理
		localSocket.listen(localPort);
	} else {
		// 不允许其他机器通过本机进行代理
		localSocket.listen(localPort, '127.0.0.1');
	}

	function checkOptions(options) {
		// TODO
		return true;
	}

	function onLocalSocketListening() {
		self.emit('start');
	}

	function onLocalSocketConnection(clientSocket) {
		// 创建到远程服务器的套接字
		var serverSocket = new net.Socket();

		// 创建前向转发和后向转发流
		var forwardStream, backwardStream;
		if (role === 'server') {
			forwardStream = crypto.createDecipher('rc4', key);
			backwardStream = crypto.createCipher('rc4', key);
		} else if (role === 'client') {
			forwardStream = crypto.createCipher('rc4', key);
			backwardStream = crypto.createDecipher('rc4', key);
		} else {
			// role 的值只能是 server 或 client，不能为其他值
			self.emit('error', new Error('invalid role value, role=' + role));
			return;
		}

		// 为了保证隧道稳定，需要订阅几个 Error 事件
		// 但是不需要进行任何处理
		clientSocket.on('error', emptyErrorHandler);
		serverSocket.on('error', emptyErrorHandler);
		forwardStream.on('error', emptyErrorHandler);
		backwardStream.on('error', emptyErrorHandler);

		// 为了保证隧道能够正确关闭，需要订阅几个事件
		clientSocket.on('close', onClientSocketClose);
		serverSocket.on('close', onServerSocketClose);

		// 创建隧道对象，并加入隧道列表
		var tunnel = {
			id: self.nextTunnelId++,
			clientSocket: clientSocket,
			serverSocket: serverSocket,
			forwardStream: forwardStream,
			backwardStream: backwardStream
		};

		self.tunnelList.push(tunnel);

		// 发出 tunnel.add 事件
		self.emit('tunnel.add', tunnel);

		// 让 serverSocket 开始连接
		serverSocket.connect(serverPort, serverHost);

		// 开始转发
		clientSocket.pipe(forwardStream);
		forwardStream.pipe(serverSocket);

		serverSocket.pipe(backwardStream);
		backwardStream.pipe(clientSocket);

		// 发出 tunnel.start 事件
		self.emit('tunnel.start', tunnel);

		// [函数]
		function onClientSocketClose() {
			// clientSocket 关闭了，那么 serverSocket 也必须关闭
			tunnel.serverSocket.end();

			// 删除隧道，然后发出 tunnel.remove 事件
			// 注意这里之所以要判断，是因为隧道可能已经被删除了
			// 例如在 onServerSocketClose() 中
			if (removeTunnel(tunnel)) {
				// 发出 tunnel.remove 事件
				self.emit('tunnel.remove', tunnel);
			}

		}

		function onServerSocketClose() {
			// serverSocket 关闭了，那么 clientSocket 也必须关闭
			tunnel.clientSocket.end();

			// 删除隧道，然后发出 tunnel.remove 事件
			// 注意这里之所以要判断，是因为隧道可能已经被删除了
			// 例如在 onClientSocketClose() 中
			if (removeTunnel(tunnel)) {
				self.emit('tunnel.remove', tunnel);
			}
		}

		function emptyErrorHandler(err) {
			// 什么也不用做
		}

		// 功能：删除指定的隧道
		function removeTunnel(tunnel) {
			var tunnelList = self.tunnelList;
			var i = tunnelList.indexOf(tunnel);
			if (i === -1) {
				//console.log('removeTunnel, tunnel not found, id=' + tunnel.id);
				return false;
			}
			
			// 如果要删除的元素不在列表头
			// 那么我们需要先将其通过交换的方式移到列表头
			if (i !== 0) {debugger;
				var tmp = tunnelList[0];
				tunnelList[0] = tunnel;
				tunnelList[i] = tmp;
			}
			// 删除
			tunnelList.shift();

			console.log('removeTunnel, tunnel removed, id=' + tunnel.id);
			return true;
		}
	}

	function onLocalSocketClose() {
		self.emit('stop');
	}

	function onLocalSocketError(err) {
		self.emit('error', err);
	}
}

Proxy.prototype.stop = function() {
	var self = this;
	// 关闭本地监听
	if (self.localSocket) {
		self.localSocket.close();
	}
	self.localSocket = undefined;

	// 关闭所有隧道连接
	if (self.tunnelList) {
		while (self.tunnelList.length) {
			var tunnel = self.tunnelList.shift();
			tunnel.clientSocket.end();
			tunnel.serverSocket.end();
		}
	}

	self.tunnelList = undefined;

	self.emit('stop');
}