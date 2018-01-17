/*
Contains a promise implementation that has been retroactively made compatible with Q
A "q" service is also provided that can be used to call it much like you would $q in angular
*/

if (!nabu) { var nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }
if (!nabu.services) { nabu.services = {}; }

nabu.utils.when = function(promises) {
	return new nabu.utils.promises(promises);
};

nabu.utils.promise = function(parameters) {
	var self = this;
	this.state = null;
	this.successHandlers = [];
	this.errorHandlers = [];
	this.progressHandlers = [];
	this.stagedHandlers = [];
	this.stagedResult = null;
	this.response = null;
	this.parameters = parameters;
	this.mapper = [];
	this.succeed = function(response) {
		if (!self.state) {
			if (self.mapper.length) {
				for (var i = 0; i < self.mapper.length; i++) {
					response = self.mapper[i](response);
				}
			}
			self.response = response;
			self.state = "success";
			for (var i = 0; i < self.successHandlers.length; i++) {
				if (self.successHandlers[i] instanceof Function) {
					self.successHandlers[i](response);
				}
				else if (self.successHandlers[i].resolve) {
					self.successHandlers[i].resolve(response);
				}
			}
		}
	};
	this.stage = function(stagedResult) {
		if (!self.stagedResult) {
			self.stagedResult = stagedResult;
			for (var i = 0; i < self.stagedHandlers.length; i++) {
				if (self.stagedHandlers[i] instanceof Function) {
					self.stagedHandlers[i](response);
				}
				else if (self.stagedHandlers[i].resolve) {
					self.stagedHandlers[i].resolve(stagedResult);
				}
			}
		}
	};
	this.staged = function(handler) {
		self.stagedHandlers.push(handler);
		// if already staged, call immediately
		if (self.stagedResult != null) {
			if (handler instanceof Function) {
				handler(self.stagedResult);
			}
			else if (handler.resolve) {
				handler.resolve(self.stagedResult);
			}
		}
		return self;
	};
	this.resolve = function(response) {
		this.succeed(response);
	};
	this.fail = function(response) {
		if (!self.state) {
			self.response = response;
			self.state = "error";
			for (var i = 0; i < self.errorHandlers.length; i++) {
				if (self.errorHandlers[i] instanceof Function) {
					self.errorHandlers[i](response);
				}
				else if (self.errorHandlers[i].reject) {
					self.errorHandlers[i].reject(response);
				}
			}
		}
	};
	this.reject = function(response) {
		this.fail(response);
	};
	this.success = function(handler) {
		self.successHandlers.push(handler);
		// if already resolved, call immediately
		if (self.state == "success") {
			if (handler instanceof Function) {
				handler(self.response);
			}
			else if (handler.resolve) {
				handler.resolve(self.response);
			}
		}
		return self;
	};
	this.error = function(handler) {
		self.errorHandlers.push(handler);
		// if already resolved, call immediately
		if (self.state == "error") {
			if (handler instanceof Function) {
				handler(self.response);
			}
			else if (handler.reject) {
				handler.reject(self.response);
			}
		}
		return self;
	};
	this.onprogress = function(event) {
		if (self.progressHandlers) {
			for (var i = 0; i < self.progressHandlers.length; i++) {
				self.progressHandlers[i](event, self.parameters);
			}
		}
	};
	this.progress = function(progressHandler) {
		self.progressHandlers.push(progressHandler);
	};
	this.then = function(successHandler, errorHandler, progressHandler, cancelHandler) {
		if (successHandler) {
			self.success(successHandler);
		}
		if (errorHandler) {
			self.error(errorHandler);
		}
		if (progressHandler) {
			self.progress(progressHandler);
		}
		return self;
	};
	this.map = function(mapper) {
		if (mapper instanceof Array) {
			nabu.utils.arrays.merge(self.mapper, mapper);
		}
		else if (mapper instanceof Function) {
			self.mapper.push(mapper);
		}
	}
};
nabu.utils.promises = function(promises) {
	var self = this;
	this.promises = promises ? promises : [];
	this.resolution = null;
	this.successHandlers = [];
	this.errorHandlers = [];
	this.progressHandlers = [];
	this.state = null;
	
	this.resolver = function() {
		if (self.state == null) {
			var failed = 0;
			var succeeded = 0;
			var responses = [];
			for (var i = 0; i < self.promises.length; i++) {
				if (self.promises[i].state == "success") {
					succeeded++;
					responses.push(self.promises[i].response);
				}
				else if (self.promises[i].state == "error") {
					failed++;
					responses.push(self.promises[i].response);
				}
			}
			if (succeeded == self.promises.length) {
				self.state = "success";
				for (var i = 0; i < self.successHandlers.length; i++) {
					if (self.successHandlers[i] instanceof Function) {
						self.successHandlers[i](responses);
					}
					else if (self.successHandlers[i].resolve) {
						self.successHandlers[i].resolve(responses);
					}
				}
			}
			else if (succeeded + failed == self.promises.length) {
				self.state = "error";
				for (var i = 0; i < self.errorHandlers.length; i++) {
					if (self.errorHandlers[i] instanceof Function) {
						self.errorHandlers[i](responses);
					}
					else if (self.errorHandlers[i].reject) {
						self.errorHandlers[i].reject(responses);
					}
				}
			}
		}
	};
	
	this.onprogress = function(event, parameters) {
		if (self.progressHandlers) {
			for (var i = 0; i < self.progressHandlers.length; i++) {
				self.progressHandlers[i](event, parameters);
			}
		}
	};

	for (var i = 0; i < this.promises.length; i++) {
		this.promises[i]
			.success(this.resolver)
			.error(this.resolver)
			.progress(this.onprogress);
	}
	this.progress = function(progressHandler) {
		self.progressHandlers.push(progressHandler);
	};
	this.success = function(handler) {
		self.successHandlers.push(handler);
		// if already resolved, call immediately
		if (self.state == "success") {
			if (handler instanceof Function) {
				handler(self.response);
			}
			else if (handler.resolve) {
				handler.resolve(self.response);
			}
		}
		return self;
	};
	this.error = function(handler) {
		self.errorHandlers.push(handler);
		// if already resolved, call immediately
		if (self.state == "error") {
			if (handler instanceof Function) {
				handler(self.response);
			}
			else if (handler.reject) {
				handler.reject(self.response);
			}
		}
		return self;
	};
	this.then = function(successHandler, errorHandler, progressHandler) {
		if (successHandler) {
			self.success(successHandler);
		}
		if (errorHandler) {
			self.error(errorHandler);
		}
		if (progressHandler) {
			self.progress(progressHandler);
		}
		return self;
	};
	this.resolver();
}

nabu.services.Q = function Q() {
	this.defer = function(promise, result) {
		// if you pass in a promise, we build on that, this only makes sense if you send back a different result, otherwise use the original promise
		if (promise && typeof(result) != "undefined") {
			var newPromise = new nabu.utils.promise();
			newPromise.stage(result);
			promise.then(function(object) {
				newPromise.resolve(result);
			}, newPromise);
			return newPromise;
		}
		else {
			return new nabu.utils.promise();
		}
	};
	this.all = function() {
		var array = [];
		for (var i = 0; i < arguments.length; i++) {
			if (arguments[i] instanceof Array) {
				for (var j = 0; j < arguments[i].length; j++) {
					array.push(arguments[i][j]);
				}
			}
			else {
				array.push(arguments[i]);
			}
		}
		return new nabu.utils.promises(array);
	};
	this.resolve = function(result) {
		var promise = this.defer();
		promise.resolve(result);
		return promise;
	};
	this.reject = function(result) {
		var promise = this.defer();
		promise.reject(result);
		return promise;
	};
}