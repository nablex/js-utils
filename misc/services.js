if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }

// construct like this to have a name:
// var services.User = function User() {
nabu.services.ServiceManager = function() {
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
				var promise = instance.$initialize();
				if (promise) {
					promises.push(promise);
				}
			}
		}
		return new nabu.utils.promises(promises);
	}
}