if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }

// construct like this to have a name:
// var services.User = function User() {
// if you need custom parameters in your service input, consider a service builder that uses the $initialize.resolve to send back the actual service instance
nabu.services.ServiceManager = function() {
	var self = this;
	this.$definitions = [];
	for (var i = 0; i < arguments.length; i++) {
		this.$definitions.push(arguments[i]);
	}
	
	this.$initialize = function() {
		return this.$register(this.$definitions);
	}
	
	this.$register = function(services) {
		if (!(services instanceof Array)) {
			services = [services];
		}
		var promises = [];
		
		var initializeSingle = function(instance, name) {
			var result = instance.$initialize();
			if (result) {
				// we assume a promise
				if (result.then) {
					result.then(function(service) {
						if (service && name) {
							self[name] = service;
						}
					});
					promises.push(result);
				}
				// we assume that you returned the actual service instance
				else if (name) {
					self[name] = result;
				}
			}
		};
		
		for (var i = 0; i < services.length; i++) {
			var instance = new services[i](self);
			var name = services[i].name 
				? services[i].name.substring(0, 1).toLowerCase() + services[i].name.substring(1) 
				: null;
			if (name) {
				self[name] = instance;
			}
			else {
				console.warn("Unnamed service", services[i]);
			}
			if (instance.$initialize) {
				initializeSingle(instance, name);	
			}
		}
		return new nabu.utils.promises(promises);
	}
	
	this.$clear = function() {
		var promises = [];
		for (var key in self) {
			if (key.substring(0, 1) != "$" && self[key].$clear) {
				var result = self[key].$clear();
				if (result && result.then) {
					promises.push(result);
				}
			}
		}
		return new nabu.utils.promises(promises);
	}
}
