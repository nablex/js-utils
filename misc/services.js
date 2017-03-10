if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }

// construct like this to have a name:
// var services.User = function User() {
// if you need custom parameters in your service input, consider a service builder that uses the $initialize.resolve to send back the actual service instance
nabu.services.ServiceManager = function(services) {
	var self = this;
	this.definitions = arguments;
	
	this.$initialize() = function() {
		var promises = [];
		for (var i = 0; i < this.definitions.length; i++) {
			var instance = new this.definitions[i](self);
			var name = this.definitions[i].name 
				? this.definitions[i].name.substring(0, 1).toLowerCase() + this.definitions[i].name.substring(1) 
				: null;
				
			if (name) {
				self[name] = instance;
			}
			else {
				console.warn("Unnamed service", this.definitions[i]);
			}
			if (instance.$initialize) {
				var result = instance.$initialize();
				if (result) {
					// we assume a promise
					if (result.then) {
						result.then(function(service) {
							if (service && name) {
								self[name] = service;
							}
						});
						promises.push(promise);
					}
					// we assume that you returned the actual service instance
					else if (name) {
						self[.name] = result;
					}
				}
			}
		}
		return new nabu.utils.promises(promises);
	}
}
