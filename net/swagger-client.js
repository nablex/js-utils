if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }

// parameters are:
// - definition: the string content or parsed content of the swaggerfile
// - executor: function(parameters) where parameters:
// 		host (includes scheme), method, url, headers, data, contentType, secure
nabu.services.SwaggerClient = function(parameters) {
	var self = this;
	this.swagger = typeof(parameters.definition) == "string" ? JSON.parse(parameters.definition) : parameters.definition;
	this.operations = {};
	this.secure = this.swagger.schemes.indexOf("https") >= 0;
	this.host = (this.secure ? "https://" : "http://") + this.swagger.host;
	this.executor = parameters.executor;
	
	if (!this.executor) {
		if (nabu.utils && nabu.utils.ajax) {
			this.executor = nabu.utils.ajax;
		}
		else {
			throw "No executor";
		}
	}

	if (this.swagger.swagger != "2.0") {
		throw "Only swagger 2.0 is currently supported";	
	}

	Object.keys(self.swagger.paths).forEach(function (path) {
		Object.keys(self.swagger.paths[path]).forEach(function (method) {
			var operation = self.swagger.paths[path][method];
			self.operations[operation.operationId] = {
				id: operation.operationId,
				parameters: operation.parameters,
				path: path,
				method: method,
				responses: operation.responses
			}
		});
	});
	
	this.operation = function(name) {
		return self.operations[name];
	};
	
	this.parameters = function(name, parameters) {
		if (!self.operations[name]) {
			throw "Unknown operation: " + name;
		}
		var operation = self.operations[name];
		var path = operation.path;
		if (self.swagger.basePath) {
			path = self.swagger.basePath + "/" + path;
			path = path.replace(new RegExp("[/]+"), "/")
		}
		if (path.substring(0, 1) != "/") {
			path = "/" + path;
		}
		var query = {};
		var headers = {};
		var data = null;
		for (var i = 0; i < operation.parameters.length; i++) {
			if (operation.parameters[i].required && !parameters[operation.parameters[i].name]) {
				throw "Missing required parameter: " + operation.parameters[i].name;
			}
			if (parameters.hasOwnProperty(operation.parameters[i].name)) {
				var value = parameters[operation.parameters[i].name];
				if (value instanceof Array) {
					var collectionFormat = operation.parameters[i].collectionFormat ? operation.parameters[i].collectionFormat : "csv";
					// the "multi" collection format is handled by the query part (the only one who currently supports it)
					if (collectionFormat != "multi") {
						var result = "";
						for (var j = 0; j < value.length; j++) {
							if (result.length > 0) {
								if (collectionFormat == "csv") {
									result += ",";
								}
								else if (collectionFormat == "ssv") {
									result += " ";
								}
								else if (collectionFormat == "tsv") {
									result += "\t";
								}
								else if (collectionFormat == "pipes") {
									result += "|";
								}
								else {
									throw "Unsupported collection format: " + collectionFormat;
								}
							}
							result += value[j];
						}
						value = result;
					}
				}
				if (operation.parameters[i].in == "path") {
					path = path.replace(new RegExp("\{[\\s]*" + operation.parameters[i].name + "[\\s]*\}"), value);
				}
				else if (operation.parameters[i].in == "query") {
					query[operation.parameters[i].name] = value;
				}
				else if (operation.parameters[i].in == "header") {
					headers[operation.parameters[i].name] = value;
				}
				else if (operation.parameters[i].in == "body") {
					data = value;
				}
				else {
					throw "Invalid 'in': " + operation.parameters[i].in;
				}
			}
		}

		Object.keys(query).forEach(function (key) {
			if (query[key] instanceof Array) {
				for (var i = 0; i < query[key].length; i++) {
					path += path.indexOf("?") >= 0 ? "&" : "?";
					path += key + "=" + query[key][i];
				}
			}
			else {
				path += path.indexOf("?") >= 0 ? "&" : "?";
				path += key + "=" + query[key];
			}
		});
		return {
			method: operation.method,
			host: self.host,
			url: path,
			data: data,
			headers: headers
		};
	};
	
	this.execute = function(name, parameters) {
		return self.executor(
			self.parameters(name, parameters)
		);
	};

	return this;
};

// parameters should contain a list of "swaggers" definitions in either string or JSON format
nabu.services.SwaggerBatchClient = function(parameters) {
	var self = this;
	this.clients = [];

	// load all the swagger clients
	for (var i = 0; i < parameters.swaggers.length; i++) {
		this.clients.push(new nabu.services.SwaggerClient({
			definition: parameters.swaggers[i],
			executor: parameters.executor
		}));
	}
	
	// dispatch to the correct swagger client
	this.execute = function(name, parameters) {
		for (var i = 0; i < self.clients.length; i++) {
			if (self.clients[i].operations[name]) {
				return self.clients[i].execute(name, parameters);
			}
		}
		throw "Unknown operation: " + name;
	};
	
	this.parameters = function(name, parameters) {
		for (var i = 0; i < self.clients.length; i++) {
			if (self.clients[i].operations[name]) {
				return self.clients[i].parameters(name, parameters);
			}
		}
		throw "Unknown operation: " + name;	
	};
};