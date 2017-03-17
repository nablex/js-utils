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
			this.executor = function(parameters) {
				var promise = new nabu.utils.promise();
				nabu.utils.ajax(parameters).then(function(response) {
					var contentType = response.getResponseHeader("Content-Type");
					if (contentType && contentType.indexOf("application/json") >= 0) {
						response = JSON.parse(response.responseText);
					}
					promise.resolve(response);
				}, function(error) {
					var contentType = error.getResponseHeader("Content-Type");
					if (contentType && contentType.indexOf("application/json") >= 0) {
						error = JSON.parse(error.responseText);
					}
					promise.reject(error);
				});
				return promise;
			};
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
			if (operation.parameters[i].required && (!parameters || !parameters[operation.parameters[i].name])) {
				throw "Missing required parameter: " + operation.parameters[i].name;
			}
			if (parameters && parameters.hasOwnProperty(operation.parameters[i].name)) {
				var value = parameters[operation.parameters[i].name];
				console.log("ORIGINAL", value);
				if (operation.parameters[i].schema) {
					value = this.format(operation.parameters[i].schema, value);
				}
				console.log("FORMATTED", value);
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
	
	this.format = function(definition, value) {
		if (definition.$ref) {
			definition = this.definition(definition.$ref);
		}
		console.log("definition is", definition);
		if (definition.type == "string") {
			// empty strings are interpreted as null
			if (!value) {
				return null;
			}
			else {
				return typeof(value) === "string" ? value : new String(value);
			}
		}
		else if (definition.type == "number" || definition.type == "integer") {
			if (typeof(value) === "number") {
				return value;
			}
			// undefined, empty string,... just return null
			else if (!value) {
				return null;
			}
			else {
				var number = new Number(value);
				if (isNaN(number)) {
					throw "Not a number: " + value;
				}
				return number;
			}
		}
		else if (definition.type == "boolean") {
			if (typeof(value) === "boolean") {
				return value;
			}
			else {
				return !!value;
			}
		}
		else if (definition.type == "array") {
			if (!value) {
				return null;
			}
			else if (!(value instanceof Array)) {
				value = [value];
			}
			var result = [];
			for (var i = 0; i < value.length; i++) {
				result.push(this.format(definition.items, value[i]));
			}
		}
		else if (definition.type == "object") {
			var result = {};
			if (definition.properties) {
				for (var key in definition.properties) {
					var formatted = this.format(definition.properties[key], value[key]);
					// only set filled in values
					if (formatted != null) {
						result[key] = formatted;
					}
					else if (definition.required.indexOf(key) >= 0) {
						throw "Missing required element: " + key;
					}
				}
			}
			return result;
		}
		else {
			throw "Unsupported type: " + definition.type;
		}
	};
	
	this.definition = function(ref) {
		if (ref.indexOf("#/definitions/") == 0) {
			ref = ref.substring("#/definitions/".length);
		}
		var definition = this.swagger.definitions[ref];
		if (!definition) {
			throw "Could not find definition: " + ref;
		}
		return definition;
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