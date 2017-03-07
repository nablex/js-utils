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
	this.response = null;
	this.parameters = parameters;
	this.succeed = function(response) {
		self.response = response;
		self.state = "success";
		for (var i = 0; i < self.successHandlers.length; i++) {
			self.successHandlers[i](response);
		}
	};
	this.resolve = function(response) {
		this.succeed(response);
	};
	this.fail = function(response) {
		self.response = response;
		self.state = "error";
		for (var i = 0; i < self.errorHandlers.length; i++) {
			self.errorHandlers[i](response);
		}
	};
	this.reject = function(response) {
		this.fail(response);
	};
	this.success = function(handler) {
		self.successHandlers.push(handler);
		// if already resolved, call immediately
		if (self.state == "success") {
			handler(self.response);
		}
		return self;
	};
	this.error = function(handler) {
		self.errorHandlers.push(handler);
		// if already resolved, call immediately
		if (self.state == "error") {
			handler(self.response);
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
				self.successHandlers[i](responses);
			}
		}
		else if (succeeded + failed == self.promises.length) {
			self.state = "error";
			for (var i = 0; i < self.errorHandlers.length; i++) {
				self.errorHandlers[i](responses);
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
			handler(self.response);
		}
		return self;
	};
	this.error = function(handler) {
		self.errorHandlers.push(handler);
		// if already resolved, call immediately
		if (self.state == "error") {
			handler(self.response);
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

nabu.services.q = function() {
	this.defer = function() {
		return new nabu.utils.promise();
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
}