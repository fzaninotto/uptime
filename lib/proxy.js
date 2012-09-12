/*
 * Monkey-patch the http and https modules
 * to support proxies defined in the environment
 * (from HTTP_PROXY, HTTPS_PROXY, and NO_PROXY)
 *
 * Coded by macolu (https://github.com/macolu)
 */

var http  = require('http');
var https = require('https');
var url   = require('url');
var tunnel = require('tunnel');

var httpRequest = http.request;
var httpsRequest = https.request;

if (process.env.http_proxy) {
  var httpProxy = url.parse(process.env.http_proxy);

  http.request = function(options, callback) {
    if (!isProxyRequired(options.host, options.protocol)) {
      return httpRequest(options, callback);
    }

    var newOptions = clone(options);
    newOptions.agent = getProxyTunnel(httpProxy, options.protocol);
    return httpRequest(newOptions, callback);

  };
}

if (process.env.https_proxy) {
  var httpsProxy = url.parse(process.env.https_proxy);
  https.request = function(options, callback) {
    if (!isProxyRequired(options.host, options.protocol)) {
      return httpsRequest(options, callback);
    }

    var newOptions = clone(options);
    newOptions.agent = getProxyTunnel(httpsProxy, options.protocol);
    return httpsRequest(newOptions, callback);
  };
}

/**
 * Returns the correct tunnel for the given proxy and the protocol of the target url
 */
var getProxyTunnel = function(proxyUrl, targetProtocol) {

  // define the proxy object
  var proxyObject = {
    host: httpProxy.hostname,
    port: httpProxy.port,
    protocol: httpProxy.protocol
  }

  var tunnelingAgent;
  if (targetProtocol === 'http:' && proxyUrl.protocol === 'https:') {
    // create the agent
    tunnelingAgent = tunnel.httpOverHttps({
      proxy: proxyObject
    });
  } else if (targetProtocol === 'https:' && proxyUrl.protocol === 'https:') {
    // create the agent
    tunnelingAgent = tunnel.httpsOverHttps({
      proxy: proxyObject
    });
  } else if (targetProtocol === 'https:' && proxyUrl.protocol === 'http:') {
    // create the agent
    tunnelingAgent = tunnel.httpsOverHttp({
      proxy: proxyObject
    });
  } else {
    // create the default default tunnel http over http
    tunnelingAgent = tunnel.httpOverHttp({
      proxy: proxyObject
    });
   
  }

  return tunnelingAgent;
}

/**
 * Returns weather proxy should be used when requesting given host
 *
 * ie. returns false if hostname match any pattern in no_proxy environment variable
 */
var isProxyRequired = function(hostname, protocol) {
  if (!process.env.no_proxy) {
    return true;
  }

  var exclusionPatterns = process.env.no_proxy.split(',');

  if (protocol === 'http:') {
    // add the http proxy to the exclusion list
    if (process.env.http_proxy) {
      var httpProxy = url.parse(process.env.http_proxy);
      exclusionPatterns.push(httpProxy.hostname);
    }
  } else {
    // add the https proxy to the exclusion list
    if (process.env.https_proxy) {
      var httpsProxy = url.parse(process.env.https_proxy);
      exclusionPatterns.push(httpsProxy.hostname);
    }
  }
  
  for (var i in exclusionPatterns) {
    if (hostname.search(exclusionPatterns[i]) >= 0) {
      return false;
    }
  }

  return true;
};

var clone = function(obj) {
  if(obj == null || typeof(obj) != 'object') return obj;
  var temp = obj.constructor();
  for (var key in obj) {
    temp[key] = clone(obj[key]);
  }
  return temp;
}
