if (!nabu) { nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.utils.arrays = {
	merge: function(original) {
		for (var i = 1; i < arguments.length; i++) {
			if (arguments[i] instanceof Array) {
				for (var j = 0; j < arguments[i].length; j++) {
					original.push(arguments[i][j]);
				}
			}
			else if (typeof arguments[i] != "undefined") {
				original.push(arguments[i]);
			}
		}
		return original;
	},
	offer: function(original) {
		for (var i = 1; i < arguments.length; i++) {
			if (arguments[i] instanceof Array) {
				for (var j = arguments[i].length - 1; j >= 0; j--) {
					original.unshift(arguments[i][j]);
				}
			}
			else if (typeof arguments[i] != "undefined") {
				original.unshift(arguments[i]);
			}
		}
		return original;
	},
	remove: function(array) {
		for (var i = 1; i < arguments.length; i++) {
			if (arguments[i] instanceof Array) {
				for (var j = 0; j < arguments[i].length; j++) {
					nabu.utils.arrays.remove(array, arguments[i][j]);
				}
			}
			else {
				var index = array.indexOf(arguments[i]);
				if (index >= 0) {
					array.splice(index, 1);
				}
			}
		}
	},
	flatten: function(array, field, includeUndefined) {
		var results = [];
		for (var i = 0; i < array.length; i++) {
			if (array[i][field] || includeUndefined) {
				results.push(array[i][field]);
			}
		}
		return results;
	},
	find: function(array, parameters, amount) {
		if (typeof amount == "undefined") {
			amount = 1;
		}
		var results = [];
		for (var i = 0; i < array.length; i++) {
			var matches = true;
			for (var key in parameters) {
				if ((parameters[key] instanceof Array && parameters[key].indexOf(array[i][key]) < 0) || (!(parameters[key] instanceof Array) && array[i][key] != parameters[key])) {
					matches = false;
					break;
				}
			}
			if (matches) {
				results.push(array[i]);
			}
			if (amount != 0 && results.length >= amount) {
				break;
			}
		}
		if (amount == 1) {
			return results.length == 0 ? null : results[0];
		}
		else {
			return results;
		}
	},
	clear: function(array) {
		array.splice(0, array.length);
	}
};
