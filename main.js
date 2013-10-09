var net = require('net');
var fs = require('fs');
var Authorize = require('./lib/authorize.js');
var Proxy = require('./lib/proxy.js');
var ProxyMonitor = require('./lib/proxy-monitor.js');
var util = require('util');
var path = require('path');

// 加载配置文件
// 默认加载 config.json
// 但是如果用户在命令行里指定了要加载的配置文件
// 则加载用户指定的配置文件
var config = require(configFilePath());

if (config.role === 'client') {
	console.log('client mode');
	startClientMode();
} else if (config.role === 'server') {
	console.log('server mode');
	startServerMode();
}

function startClientMode() {
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

		startProxy({
			role: role,
			enableRemoteAccess: enableRemoteAccess,
			localPort: localPort,
			serverHost: serverHost,
			serverPort: serverPort,
			key: key
		});
	}
}

function startServerMode() {
	var role = config.role;
	var enableRemoteAccess = config.enableRemoteAccess;
	var localPort = config.localPort;
	var serverHost = config.serverHost;
	var serverPort = config.serverPort;
	var key = config.key;

	startProxy({
		role: role,
		enableRemoteAccess: enableRemoteAccess,
		localPort: localPort,
		serverHost: serverHost,
		serverPort: serverPort,
		key: key
	});
}

function startProxy(options) {
	// 创建代理对象，以及代理对象监视器
	// 然后分别启动它们
	var proxy = new Proxy(options);
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

function configFilePath() {
	var filePath = './config.json';
	for (var i = 1, len = process.argv.length; i < len; ++i) {
		var v = process.argv[i];
		if (/.json$/.test(v)) {
			filePath = v;
			break;
		}
	}
	filePath = path.resolve(__dirname, filePath);
	console.log('config file: ' + filePath);
	return filePath;
}