if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }

// parameters are:
// - definition: the string content or parsed content of the swaggerfile
// - executor: function(parameters) where parameters:
// 		host (includes scheme), method, url, headers, data, contentType, secure
nabu.services.SwaggerClient = function(parameters) {
	var self = this;
	this.swagger = null;
	this.operations = {};
	this.secure = false;
	this.host = null;
	this.executor = parameters.executor;
	this.normalize = parameters.normalize;
	this.parseError = parameters.parseError;
	this.rememberHandler = parameters.remember;
	this.remembering = false;
	this.rememberPromise = null;
	this.definitionProcessors = [];
	this.language = null;
	this.bearer = parameters.bearer;
	this.toggledFeatures = [];
	this.geoPosition = null;
	this.offlineHandler = parameters.offlineHandler;
	this.requestEnrichers = [];

	// allow global registering of request enrichers
	// it is hard to pick the _exact_ spot in the service startup sequence
	// we want to allow you to pick in as early as possible
	if (application.configuration.requestEnrichers) {
		nabu.utils.arrays.merge(self.requestEnrichers, application.configuration.requestEnrichers);
	}
	
	if (!this.executor) {
		if (nabu.utils && nabu.utils.ajax) {
			this.executor = function(parameters) {
				var language = self.language;
				if (!language) {
					language = application && application.configuration && application.configuration.applicationLanguage != 'unavailable' ? application.configuration.applicationLanguage : null;
				}
				if (language) {
					parameters.language = language;
				}
				var promise = new nabu.utils.promise();
				if (parameters.map) {
					promise.map(parameters.map);
				}
				parameters.progress = promise.onprogress;
				nabu.utils.ajax(parameters).then(function(response) {
					var raw = response;
					var contentType = response.getResponseHeader("Content-Type");
					if (contentType && contentType.indexOf("application/json") >= 0) {
						response = JSON.parse(response.responseText);
						if (parameters.definition) {
							response = nabu.utils.schema.json.normalize(parameters.definition, response, self.definition.bind(self), true, self.normalize);
						}
					}
					else if (contentType && contentType.indexOf("text/html") >= 0) {
						response = response.responseText;
					}
					else if (response.status == 204) {
						response = null;
					}
					// we are never (?) interested in the original XMLHTTPRequest
					else {
						if (!response.responseText) {
							response = null;
						}
						else {
							response = response.responseText;
						}
					}
					// we want to allow you to manipulate the resulting data based on the raw response (e.g. to extract http headers)
					if (parameters.$$rawMapper) {
						response = parameters.$$rawMapper(response, raw);
					}
					// TODO: are you ever interested in anything else but the response text?
					promise.resolve(response);
				}, function(error) {
					// if we have an offline handler, call it
					if ((error.status == 502 || error.status == 503) && self.offlineHandler) {
						self.offlineHandler(error);
					}
					var requireAuthentication = error.status == 401;
					if (self.parseError) {
						var contentType = error.getResponseHeader("Content-Type");
						if (contentType && (contentType.indexOf("application/json") >= 0 || contentType.indexOf("application/problem+json") >= 0)) {
							error = JSON.parse(error.responseText);
						}
					}
					var rememberSuccess = function() {
						parameters.remember = true;
						// if we finalized the remember, our bearer token may have been updated!
						// make sure we use the correct one, the parameters might have none or an old one
						if (self.bearer) {
							parameters.bearer = self.bearer;
						}
						self.executor(parameters).then(
							function(response) {
								promise.resolve(response);
							},
							function(error) {
								promise.reject(error);
							});
					};
					var rememberFailure = function() {
						promise.reject(error);
					};
					// if we are currently not remembering, start a cycle
					if (requireAuthentication && !parameters.remember && self.rememberHandler && !self.remembering && !parameters.$$skipRemember) {
						self.remembering = true;
						self.rememberPromise = new nabu.utils.promise();
						self.rememberHandler().then(
							function() {
								self.rememberPromise.resolve();
								self.remembering = false;
								rememberSuccess();
							},
							function(error) {
								self.rememberPromise.resolve();
								self.remembering = false;
								rememberFailure(error);
							});
					}
					// if we are remembering, use the promise
					else if (requireAuthentication && !parameters.remember && self.remembering && !parameters.$$skipRemember) {
						self.rememberPromise.then(
							rememberSuccess,
							rememberFailure);
					}
					else {
						promise.reject(error);
					}
				});
				return promise;
			};
		}
		else {
			throw "No executor";
		}
	}
	
	this.remember = function() {
		if (self.rememberHandler) {
			self.remembering = true;
			self.rememberPromise = new nabu.utils.promise();
			return self.rememberHandler().then(
				function() {
					self.rememberPromise.resolve();
					self.remembering = false;
				},
				function() {
					self.rememberPromise.resolve();
					self.remembering = false;
				}
			);
		}
		else {
			var promise = new nabu.utils.promise();
			promise.reject();
			return promise;
		}
	}

	this.loadDefinition = function(definition) {
		this.swagger = typeof(definition) == "string" ? JSON.parse(definition) : definition

		if (this.swagger.swagger != "2.0") {
			throw "Only swagger 2.0 is currently supported";	
		}

		this.operations = {};
		if (this.swagger && this.swagger.paths) {
			Object.keys(self.swagger.paths).forEach(function (path) {
				Object.keys(self.swagger.paths[path]).forEach(function (method) {
					var operation = self.swagger.paths[path][method];
					self.operations[operation.operationId] = {
						id: operation.operationId,
						parameters: operation.parameters,
						path: path,
						method: method,
						responses: operation.responses,
						consumes: operation.consumes,
						produces: operation.produces,
						security: operation.security,
						tags: operation.tags,
						summary: operation.summary
					}
					// we want to add extensions as well cause this can expose additional features available
					Object.keys(self.swagger.paths[path][method]).forEach(function(key) {
						if (key.indexOf("x-") == 0) {
							self.operations[operation.operationId][key] = self.swagger.paths[path][method][key];
						}
					});
				});
			});
		}
		this.secure = this.swagger.schemes.indexOf("https") >= 0;
		this.host = this.swagger.host && parameters.useHost ? (this.secure ? "https://" : "http://") + this.swagger.host : null;
		for (var i = 0; i < this.definitionProcessors.length; i++) {
			this.definitionProcessors[i](self);
		}
	}
	
	this.addDefinitionProcessor = function(processor) {
		if (Object.keys(this.operations).length) {
			processor(self);
		}
		this.definitionProcessors.push(processor);
	}
	
	
	// load the initial definition
	if (parameters.definition) {
		this.loadDefinition(parameters.definition);
	}
	
	this.operation = function(name) {
		return self.operations[name];
	};
	
	this.parameters = function(name, parameters) {
		if (!self.operations[name]) {
			throw "Unknown operation: " + name;
		}
		var operation = self.operations[name];
		var path = operation.path;
		if (self.swagger.basePath && self.swagger.basePath != "/") {
			path = self.swagger.basePath + (path.substring(0, 1) == "/" ? "" : "/") + path;
		}
		if (path.substring(0, 1) != "/") {
			path = "/" + path;
		}
		var query = {};
		var headers = {};
		var data = null;
		var pathParameters = {};
		
		for (var i = 0; i < operation.parameters.length; i++) {
			// we don't check header parameters as they may be injected by the browser and or ajax library
			if (operation.parameters[i].required && operation.parameters[i].in != "header" && (!parameters || typeof(parameters[operation.parameters[i].name]) == "undefined" || parameters[operation.parameters[i].name] == null)) {
				throw "Missing required parameter for " + name + ": " + operation.parameters[i].name;
			}
			if (parameters && parameters.hasOwnProperty(operation.parameters[i].name)) {
				var value = parameters[operation.parameters[i].name];
				if (operation.parameters[i].schema) {
					value = this.format(operation.parameters[i].schema, value);
				}
				// for query parameters etc, they might not have a schema
				else if (operation.parameters[i].type) {
					value = this.format(operation.parameters[i], value);
				}
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
							result += encodeURIComponent(value[j]);
						}
						value = result;
					}
				}
				if (operation.parameters[i].in == "path") {
					path = path.replace(new RegExp("\{[\\s]*" + operation.parameters[i].name + "[^}]*\}"), value);
					pathParameters[operation.parameters[i].name] = value;
				}
				else if (value != null && value !== "" && typeof(value) != "undefined") {
					if (operation.parameters[i].in == "query") {
						if (value != null) {
							query[operation.parameters[i].name] = value;
						}
					}
					else if (operation.parameters[i].in == "header") {
						if (value != null) {
							headers[operation.parameters[i].name] = value;
						}
					}
					else if (operation.parameters[i].in == "body") {
						data = value;
					}
					else {
						throw "Invalid 'in': " + operation.parameters[i].in;
					}
				}
			}
		}

		Object.keys(query).forEach(function (key) {
			if (query[key] instanceof Array) {
				for (var i = 0; i < query[key].length; i++) {
					// don't include null values
					if (query[key][i] != null) {
						path += path.indexOf("?") >= 0 ? "&" : "?";
						path += encodeURIComponent(key) + "=" + encodeURIComponent(query[key][i]);
					}
				}
			}
			else if (query[key] != null) {
				path += path.indexOf("?") >= 0 ? "&" : "?";
				path += encodeURIComponent(key) + "=" + encodeURIComponent(query[key]);
			}
		});
		
		var definition = operation.responses && operation.responses[200] ? operation.responses[200].schema : null;
		if (definition && definition.$ref) {
			definition = this.definition(definition.$ref);
		}
		var result = {
			method: operation.method,
			host: self.host,
			url: path,
			data: data,
			headers: headers,
			definition: definition,
			path: pathParameters,
			query: query
		};
		// even if no security is explicitly required, it can be interesting to pass it along
		// the service might want to differentiate internally
		if (self.bearer) { // operation.security
			result.bearer = self.bearer;
		}
		if (self.geoPosition) {
			result.headers["Geo-Position"] = self.geoPosition.latitude + ";" + self.geoPosition.longitude;
		}
		self.requestEnrichers.forEach(function(x) {
			x(result);	
		});
		// if the operation only accepts octet-stream, let's do that
		if (operation.consumes && operation.consumes.length == 1 && operation.consumes[0] == "application/octet-stream") {
			result.contentType = "application/octet-stream";
		}
		if (self.toggledFeatures.length) {
			result.headers.Feature = "";
			self.toggledFeatures.forEach(function(x) {
				if (result.headers.Feature != "") {
					result.headers.Feature += ";";
				}
				result.headers.Feature += x.name + "=" + (x.enabled == true);
			});
		}
		// added solely for readability in development
		if (application && application.configuration && application.configuration.development) {
			result.headers["X-Service-Id"] = name;
		}
		if (parameters && parameters["$serviceContext"] && parameters["$serviceContext"] != "default") {
			result.headers["X-Service-Context"] = parameters["$serviceContext"];
		}
		return result;
	};
	
	this.execute = function(name, parameters, map, async) {
		var operation = self.operations[name];
		if (!operation) {
			throw "Can not resolve operation: " + name;
		}
		if (operation.executor) {
			return operation.executor(parameters, map);
		}
		else {
			var executorParameters = self.parameters(name, parameters);
			if (map) {
				executorParameters.map = map;
			}
			if (async != null) {
				executorParameters.async = async;
			}
			if (parameters && parameters.$$rawMapper) {
				executorParameters.$$rawMapper = parameters.$$rawMapper;
			}
			if (parameters && parameters.$$skipRemember) {
				executorParameters.$$skipRemember = parameters.$$skipRemember;
			}
			return self.executor(executorParameters);
		}
	};
	
	this.format = function(definition, value) {
		if (definition.$ref) {
			definition = this.definition(definition.$ref);
		}
		return nabu.utils.schema.json.format(definition, value, self.definition.bind(self));
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
	
	this.resolve = function(element, resolved) {
		if (!resolved) {
			return this.resolve(element, {});
		}
		if (typeof(element) == "string") {
			element = this.definition(element);
		}
		var self = this;
		if (element.schema && element.schema["$ref"]) {
			element = nabu.utils.objects.deepClone(element);
			if (!resolved[element.schema["$ref"]]) {
				resolved[element.schema["$ref"]] = this.resolve(this.definition(element.schema["$ref"]), resolved);
			}
			element.schema = resolved[element.schema["$ref"]];
		}
		else if (element.items && element.items["$ref"]) {
			element = nabu.utils.objects.deepClone(element);
			if (!resolved[element.items["$ref"]]) {
				resolved[element.items["$ref"]] = this.resolve(this.definition(element.items["$ref"]), resolved);
			}
			element.items = resolved[element.items["$ref"]];
		}
		// if you have an inline array (so without ref), we still want to recursively resolve any definitions withing
		else if (element.items && element.items.properties) {
			element = nabu.utils.objects.deepClone(element);
			Object.keys(element.items.properties).map(function(key) {
				element.items.properties[key] = self.resolve(element.items.properties[key], resolved);
			});
		}
		else if (element["$ref"]) {
			if (!resolved[element["$ref"]]) {
				resolved[element["$ref"]] = this.resolve(this.definition(element["$ref"]), resolved);
			}
			return resolved[element["$ref"]];
		}
		else if (element.properties) {
			element = nabu.utils.objects.deepClone(element);
			Object.keys(element.properties).map(function(key) {
				element.properties[key] = self.resolve(element.properties[key], resolved);
			});
		}
		return element;
	}
	
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


