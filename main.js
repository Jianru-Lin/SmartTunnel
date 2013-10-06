var net = require('net');
var fs = require('fs');
var Proxy = require('./lib/proxy.js');
var ProxyMonitor = require('./lib/proxy-monitor.js');
var util = require('util');

// 加载配置文件
var option = require('./config.json');

// 创建代理对象，以及代理对象监视器
// 然后分别启动它们
var proxy = new Proxy(option);
var proxyMonitor = new ProxyMonitor(proxy);
proxyMonitor.start();
proxy.start();
