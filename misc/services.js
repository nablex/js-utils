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
			if (this.definitions[i].name) {
				self[this.definitions[i].name] = instance;
			}
			else {
				console.warn("Unnamed service", this.definitions[i]);
			}
			if (instance.$initialize) {
				var promise = instance.$initialize().then(function(service) {
					if (service && this.definitions[i].name) {
						self[this.definitions[i].name] = service;
					}
				});
				if (promise) {
					promises.push(promise);
				}
			}
		}
		return new nabu.utils.promises(promises);
	}
}