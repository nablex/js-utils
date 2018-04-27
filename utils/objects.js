if (!nabu) { nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.utils.objects = {
	clone: function(original) {
		if (original instanceof Array) {
			return original.map(function(single) {
				return nabu.utils.objects.clone(single);
			});
		}
		else {
			var copy = {};
			nabu.utils.objects.merge(copy, original);
			return copy;
		}
	},
	retain: function(original, values) {
		for (var key in original) {
			if (values.indexOf(key) < 0) {
				delete original[key];
			}
		}
		return original;
	},
	remove: function(original, values) {
		for (var key in original) {
			if (values.indexOf(key) >= 0) {
				delete original[key];
			}
		}
		return original;
	},
	merge: function(original) {
		if (original instanceof Array) {
			var args = [];
			// the arguments aren't really an array, can't use default merge stuff
			for (var i = 1; i < arguments.length; i++) {
				args.push(arguments[i]);
			}
			// for each entry in the original, perform a merge
			for (var i = 0; i < original.length; i++) {
				args.unshift(original[i]);
				nabu.utils.objects.merge.apply(null, args);
				args.shift();
			}
		}
		else {
			for (var i = 1; i < arguments.length; i++) {
				if (arguments[i]) {
					var overwrite = typeof(arguments[i].$overwrite) == "undefined" ? true : arguments[i].$overwrite;
					for (var key in arguments[i]) {
						if (key == "$overwrite") {
							continue;
						}
						if (arguments[i][key] instanceof Array) {
							if (overwrite) {
								original[key] = arguments[i][key];
							}
							else {
								if (!original[key]) {
									original[key] = [];
								}
								nabu.utils.arrays.merge(original[key], arguments[i][key]);
							}
						}
						// typeof(null) is object
						else if (typeof arguments[i][key] == "object" && arguments[i][key] != null && !(arguments[i][key] instanceof Date)) {
							if (!original[key]) {
								original[key] = arguments[i][key];
							}
							else {
								nabu.utils.objects.merge(original[key], arguments[i][key]);
							}
						}
						else if (typeof arguments[i][key] != "undefined") {
							if (!original[key] || overwrite) {
								original[key] = arguments[i][key];
							}
						}
					}
				}
			}
		}
	},
	get: function(original, path, separator) {
		if (!separator) {
			separator = "/";
		}
		var parts = path.split(separator);
		for (var i = 0; i < parts.length; i++) {
			original = original[parts[i]];
			if (!original) {
				break;
			}
		}
		return original ? original : null;
	}
};