var net = require('net');
var fs = require('fs');
var Authorize = require('./lib/Authorize.js');
var Proxy = require('./lib/proxy.js');
var ProxyMonitor = require('./lib/proxy-monitor.js');
var util = require('util');

// 加载配置文件
var config = require('./config.json');

// 首先获取向服务器发送授权请求
var authorize = new Authorize(config.authorize);
authorize.once('failure', onAuthorizeFailure);
authorize.once('success', onAuthorizeSuccess);
authorize.start();

function onAuthorizeFailure(failure) {
	// 授权失败那就什么也不做
	console.log('authorize failure: ' + failure.reason);
}

function onAuthorizeSuccess(result) {
	// 授权成功，那就开始启动代理
	console.log('authorize success');

	var role = config.role;
	var enableRemoteAccess = config.enableRemoteAccess;
	var localPort = config.localPort;
	var serverHost = result.serverHost;
	var serverPort = result.serverPort;
	var key = result.key;

	// 创建代理对象，以及代理对象监视器
	// 然后分别启动它们
	var proxy = new Proxy({
		role: role,
		enableRemoteAccess: enableRemoteAccess,
		localPort: localPort,
		serverHost: serverHost,
		serverPort: serverPort,
		key: key
	});
	var proxyMonitor = new ProxyMonitor(proxy);
	proxyMonitor.start();
	memleakWatch(proxy);
	proxy.start();

	function memleakWatch(proxy) {
		proxy.on('tunnel.add', function() {
			var len = proxy.tunnelList.length;
			console.log('tunnel add, len=' + len);
		});

		proxy.on('tunnel.remove', function() {
			var len = proxy.tunnelList.length;
			console.log('tunnel remove, len=' + len);
		});

	}
}