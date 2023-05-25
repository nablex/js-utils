if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }

// if you need custom parameters in your service input, consider a service builder that uses the $initialize.resolve to send back the actual service instance
nabu.services.ServiceManager = function() {
	var self = this;
	this.$definitions = [];
	this.$instances = [];
	this.$promises = {};
	this.$optionals = {};
	
	for (var i = 0; i < arguments.length; i++) {
		this.$definitions.push(arguments[i]);
	}
	
	// we use this service both to load the actual service itself as well as get a promise for a dependency
	// especially dependencies can toggle the "optional" boolean to indicate that they could use a particular service but are not required to have it
	// if the actual service never loads, there is never a call with optional false, so we can resolve it later
	this.$promise = function(fullName, optional) {
		if (!self.$promises[fullName]) {
			self.$promises[fullName] = new nabu.utils.promise();
		}
		// if you are optionally waiting for this, we set it IF it has no value yet
		// if it is already set to true (or worse: false), we leave it
		if (optional) {
			if (!self.$optionals.hasOwnProperty(fullName)) {
				self.$optionals[fullName] = true;
			}
		}
		else {
			self.$optionals[fullName] = false;
		}
		return self.$promises[fullName];
	}
	
	this.$initialize = function() {
		var promise = new nabu.utils.promise();
		var resolver = function() {
			promise.resolve(self);
		};
		this.$register(this.$definitions).then(resolver, resolver);
		// at this point, regardless of the setup, we should have an overall view of all the services that exist
		// if any promises are still set to optional, they are likely never going to resolve, resolve them now
		Object.keys(self.$optionals).forEach(function(key) {
			if (self.$optionals[key] == true) {
				console.log("resolving optional dependency to", key);
				self.$promise(key).resolve();
			}
		})
		return promise;
	}
	
	this.$register = function(services, target, parentName) {
		if (!target) {
			target = self;
		}
		if (!(services instanceof Array)) {
			services = [services];
		}
		
		
		var promises = [];
		
		var initializeSingle = function(instance, name, promise) {
			var fullName = (parentName ? parentName + "." : "") + name;
			var result = instance.$initialize ? instance.$initialize() : null;
			if (result) {
				// we assume a promise
				if (result.then) {
					var staged = false;
					if (result.staged) {
						result.staged(function(service) {
							if (service && name) {
								target[name] = service;
								self.$instances.push(service);
								staged = true;
							}
						});
					}
					result.then(function(service) {
						if (service && name) {
							service.$initialized = new Date();
							if (!staged) {
								target[name] = service;
								self.$instances.push(service);
							}
							promise.resolve(service);
						}
						else {
							self.$instances.push(instance);
							promise.resolve(instance);
						}
					}, function(error) {
						promise.reject(error);
					});
				}
				// we assume that you returned the actual service instance
				else if (name) {
					target[name] = result;
					self.$instances.push(result);
					promise.resolve(result);
				}
			}
			else {
				target[name] = instance;
				self.$instances.push(instance);
				promise.resolve(instance);
			}
		};
		
		for (var i = 0; i < services.length; i++) {
			// deprecated because named functions do not survive minification, only here for backwards compatibility
			if (services[i] instanceof Function) {
				var instance = new services[i](self);
				var name = services[i].name 
					? services[i].name.substring(0, 1).toLowerCase() + services[i].name.substring(1) 
					: null;
				if (instance.$initialize) {
					initializeSingle(instance, name);
				}
			}
			else {
				var names = Object.keys(services[i]);
				for (var j = 0; j < names.length; j++) {
					var name = names[j].substring(0, 1).toLowerCase() + names[j].substring(1);
					var fullName = (parentName ? parentName + "." : "") + name;
					if (services[i][names[j]] instanceof Function) {
						var instance = new services[i][names[j]](self);
						var promise = self.$promise(fullName);
						promises.push(promise);
						promise.then(function(instance) {
							instance.$initialized = new Date();
						});
						initializeSingle(instance, name, promise);
					}
					else {
						target[name] = {};
						promises.push(this.$register([services[i][names[j]]], target[name], fullName));
					}
				}
			}
		}
		return new nabu.utils.promises(promises);
	}
	
	this.$clear = function() {
		var promises = [];
		for (var i = 0; i < this.$instances.length; i++) {
			if (this.$instances[i].$initialized) {
				if (this.$instances[i].$clear) {
					var result = this.$instances[i].$clear();
					this.$instances[i].$initialized = new Date();
					if (result && result.then) {
						promises.push(result);
					}
				}
			}
		}
		return new nabu.utils.promises(promises);
	}

	this.$switchLanguage = function() {
		var promises = [];
		for (var i = 0; i < this.$instances.length; i++) {
			if (this.$instances[i].$initialized) {
				if (this.$instances[i].$switchLanguage) {
					var result = this.$instances[i].$switchLanguage();
					this.$instances[i].$initialized = new Date();
					if (result && result.then) {
						promises.push(result);
					}
				}
			}
		}
		return new nabu.utils.promises(promises);
	}
}
