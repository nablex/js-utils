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
	
	this.$register = function(services, target) {
		if (!target) {
			target = self;
		}
		if (!(services instanceof Array)) {
			services = [services];
		}
		
		var promises = [];
		
		var initializeSingle = function(instance, name) {
			var result = instance.$initialize ? instance.$initialize() : null;
			if (result) {
				// we assume a promise
				if (result.then) {
					result.then(function(service) {
						if (service && name) {
							service.$initialized = new Date();
							target[name] = service;
						}
					});
					promises.push(result);
				}
				// we assume that you returned the actual service instance
				else if (name) {
					target[name] = result;
				}
			}
			else {
				target[name] = instance;
			}
		};
		
		for (var i = 0; i < services.length; i++) {
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
					if (services[i][names[j]] instanceof Function) {
						var instance = new services[i][names[j]](self);
						instance.$initialized = new Date();
						initializeSingle(instance, name);
					}
					else {
						target[name] = {};
						promises.push(this.$register([services[i][names[j]]], target[name]));
					}
				}
			}
		}
		return new nabu.utils.promises(promises);
	}
	
	this.$clear = function(target) {
		if (!target) {
			target = self;
		}
		var promises = [];
		for (var key in target) {
			if (target[key].$initialized) {
				if (key.substring(0, 1) != "$" && target[key].$clear) {
					var result = target[key].$clear();
					target[key].$initialized = new Date();
					if (result && result.then) {
						promises.push(result);
					}
				}
			}
			else if (target[key] instanceof Object) {
				this.$clear(target[key]);
			}
		}
		return new nabu.utils.promises(promises);
	}
}
