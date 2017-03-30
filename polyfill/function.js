if (!Function.name) {
	Object.defineProperty(Function.prototype, "name", {
		get: function() {
			var matches = ("" + this).match(/^\s*function\s+([^\(\s]*)\s*/);
			return matches ? matches[1] : null;
		},
		configurable: true
	});
}