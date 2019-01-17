if (!nabu) { var nabu = {} }
if (!nabu.utils) { nabu.utils = {} }
if (!nabu.utils.schema) { nabu.utils.schema = {} }
if (!nabu.utils.schema.json) { nabu.utils.schema.json = {} }

nabu.utils.schema.addAsyncValidation = function(validations, promise, mapper) {
	if (validations.promises == null) {
		validations.promises = [];
		
		var originalFilter = validations.filter;
		validations.filter = function() {
			return nabu.utils.schema.addAsyncValidation(originalFilter.apply(validations, arguments));
		}
		
		var originalMap = validations.map;
		validations.map = function() {
			return nabu.utils.schema.addAsyncValidation(originalMap.apply(validations, arguments));
		}
	}
	if (validations.defer == null) {
		validations.defer = function(promise, mapper) {
			return nabu.utils.schema.addAsyncValidation(validations, promise, mapper);
		}
	}
	if (promise != null) {
		// we add the result of the promise to the validations themselves
		promise.then(function(result) {
			result = mapper != null && result != null ? mapper(result) : result;
			if (result instanceof Array && result.length > 0) {
				nabu.utils.arrays.merge(validations, result);
			}
		});
		// we add the promise so we can wait on it after
		validations.promises.push(promise);
	}
	if (validations.then == null) {
		validations.then = function(successHandler, errorHandler, progressHandler) {
			var promise = new nabu.utils.promise();
			new nabu.utils.promises(validations.promises).then(function() {
				promise.resolve(validations);
			}, errorHandler, progressHandler);
			return promise;
		}
	}
	return validations;
};
	
// formats a value according to the definition
// will throw an exception if the value is not valid according to the schema
nabu.utils.schema.json.format = function(definition, value, resolver) {
	if (definition.$ref) {
		if (resolver) {
			definition = resolver(definition.$ref);
		}
		else {
			throw "Can not format value because definition has a reference in it and no resolver is provided";
		}
	}
	if (definition.type == "string") {
		if (definition.format == "date" && value instanceof Date) {
			// depending on how you constructed the date, the time part may be local time or not
			// e.g. new Date("2018-01-01") is interpreted as 0 UTC (so 1 CET) and getting the date component is UTC is the same day
			// if you do new Date(2018, 1, 1), it is interpreted as 0 local time (so -1 vs UTC) and transforming to UTC gets you the previous day
			return value.getFullYear() + "-" + (value.getMonth() < 9 ? "0" : "") + (value.getMonth() + 1) + "-" + (value.getDate() < 10 ? "0" : "") + value.getDate();
//			return value.toISOString().substring(0, 10);
		}
		else if (definition.format == "date-time" && value instanceof Date) {
			return value.toISOString();
		}
		// empty strings are interpreted as null
		if (!value) {
			return null;
		}
		else {
			return typeof(value) === "string" ? value : new String(value);
		}
	}
	else if (definition.type == "number" || definition.type == "integer") {
		if (typeof(value) === "number") {
			return value;
		}
		// undefined, empty string,... just return null
		else if (!value) {
			return null;
		}
		else {
			var number = new Number(value);
			if (isNaN(number)) {
				throw "Not a number: " + value;
			}
			return number;
		}
	}
	else if (definition.type == "boolean") {
		if (typeof(value) === "boolean") {
			return value;
		}
		else if (typeof(value) == "undefined" || value == null) {
			return null;
		}
		// if we don't do this, !!"false" actually results in true
		else if (typeof(value) == "string" && value.toLowerCase() === "false") {
			 return false;
		}
		else {
			return !!value;
		}
	}
	else if (definition.type == "array") {
		if (!value) {
			return null;
		}
		else if (!(value instanceof Array)) {
			value = [value];
		}
		var result = [];
		for (var i = 0; i < value.length; i++) {
			result.push(nabu.utils.schema.json.format(definition.items, value[i], resolver));
		}
		return result;
	}
	else if (definition.type == "object") {
		// if we have no value, don't create an empty object
		if (value == null) {
			return null;
		}
		var result = {};
		if (definition.properties) {
			for (var key in definition.properties) {
				var formatted = nabu.utils.schema.json.format(definition.properties[key], value[key], resolver);
				// only set filled in values
				if (formatted != null) {
					result[key] = formatted;
				}
				else if (definition.required && definition.required.indexOf(key) >= 0) {
					// if we have a required boolean that does not have a value, we set it to false
					// this is to prevent the problem where a null-valued checkbox needs to be explicitly enabled and disabled to get "false"
					// even though booleans should be false by default
					if (definition.properties[key].type == "boolean") {
						result[key] = false;
					}
					else {
						throw "Missing required element: " + key;
					}
				}
			}
		}
		return result;
	}
	else {
		throw "Unsupported type: " + definition.type;
	}
};

nabu.utils.schema.json.normalize = function(definition, value, resolver, createNew, recursivelyCreateNew) {
	if (definition.$ref) {
		if (resolver) {
			definition = resolver(definition.$ref);
		}
		else {
			throw "Can not normalize value because definition has a reference in it and no resolver is provided";
		}
	}
	if (typeof(value) == "undefined") {
		if (createNew) {
			return nabu.utils.schema.json.instance(definition, resolver);
		}
		else {
			return null;
		}
	}
	else if (definition.type == "object") {
		if (definition.properties) {
			for (key in definition.properties) {
				if (typeof(value[key]) == "undefined") {
					if (recursivelyCreateNew) {
						value[key] = nabu.utils.schema.json.instance(definition.properties[key], resolver);
					}	
				}
				else {
					value[key] = nabu.utils.schema.json.normalize(definition.properties[key], value[key], resolver, recursivelyCreateNew, recursivelyCreateNew);
				}
			}
		}
	}
	else if (definition.type == "array") {
		if (!(value instanceof Array)) {
			value = [value];
		}
		for (var i = 0; i < value.length; i++) {
			if (value[i] && definition.items) {
				value[i] = nabu.utils.schema.json.normalize(definition.items, value[i], resolver, recursivelyCreateNew, recursivelyCreateNew);
			}
		}
	}
	else if (value === "") {
		value = null;
	}
	else if (value && definition.type == "string" && (definition.format == "date" || definition.format == "date-time")) {
		value = new Date(value);
	}
	return value;
}

nabu.utils.schema.json.instance = function(definition, resolver) {
	if (definition.$ref) {
		if (resolver) {
			definition = resolver(definition.$ref);
		}
		else {
			throw "Can not normalize value because definition has a reference in it and no resolver is provided";
		}
	}
	if (definition.type == "array") {
		return [];
	}
	else if (definition.type == "object") {
		return nabu.utils.schema.json.normalize(definition, {}, resolver);
	}
	else {
		return null;
	}
}

// will validate a value by a schema definition
nabu.utils.schema.json.validate = function(definition, value, required, resolver) {
	if (definition.$ref) {
		if (resolver) {
			definition = resolver(definition.$ref);
		}
		else {
			throw "Can not normalize value because definition has a reference in it and no resolver is provided";
		}
	}
	
	if (typeof(value) == "undefined") {
		value = null;
	}
	
	var messages = [];

	var missing = function() {
		if (required) {
			messages.push({
				soft: true,
				severity: "error",
				code: "required",
				title: "%{validation:The value is required}",
				priority: 0,
				values: {
					actual: false,
					expected: true
				},
				context: []
			});
		}
	}
	
	if (!definition) {
		if (required && (typeof(value) == "undefined" || value == null || value === "")) {
			missing();
		}
		return messages;
	}
	
	// indicates that it could not be parsed as the given data type
	var type = function(type) {
		messages.push({
			severity: "error",
			code: "type",
			title: "%{validation:The value '{actual}' is not a '{expected}'}",
			priority: -1,
			values: {
				actual: value,
				expected: type
			},
			context: []
		});
	}
	var minLength = function(value, minLength) {
		if (typeof(minLength) !== "undefined" && result.length < minLength) {
			messages.push({
				severity: "error",
				code: "minLength",
				title: "%{validation:The value '{actual}' must be at least {expected} long}",
				priority: -2,
				values: {
					actual: result.length,
					expected: minLength
				},
				context: []
			});
		}
	}
	var maxLength = function(value, maxLength) {
		if (typeof(minLength) !== "undefined" && result.length > maxLength) {
			messages.push({
				severity: "error",
				code: "maxLength",
				title: "%{validation:The value '{actual}' can be at most {expected} long}",
				priority: -2,
				values: {
					actual: result.length,
					expected: maxLength
				},
				context: []
			});
		}
	}
	var pattern = function(value, pattern, patternComment) {
		if (typeof(pattern) !== "undefined" && !result.match(pattern)) {
			messages.push({
				severity: "error",
				code: "pattern",
				title: patternComment ? patternComment : "%{validation:The value '{actual}' does not match the expected pattern '{expected}'}",
				priority: patternComment ? -1 : -3,
				values: {
					actual: result,
					expected: pattern
				},
				context: []
			});
		}
	}
	var maximum = function(value, maximum, exclusiveMaximum) {
		if (typeof(value) !== "undefined" && ( (typeof(exclusiveMaximum) !== "undefined" && value >= exclusiveMaximum) || (typeof(maximum) !== "undefined" && value > maximum) )) {
			messages.push({
				severity: "error",
				code: "maximum",
				title: "%{validation:The value {actual} is bigger than the allowed maximum of {expected}}",
				priority: -2,
				values: {
					actual: value,
					expected: maximum,
					exclusive: !!exclusiveMaximum
				},
				context: []
			});
		}
	}
	var minimum = function(value, minimum, exclusiveMinimum) {
		if (typeof(value) !== "undefined" && ( (typeof(exclusiveMinimum) !== "undefined" && value <= exclusiveMinimum) || (typeof(minimum) !== "undefined" && value < minimum) )) {
			messages.push({
				severity: "error",
				code: "minimum",
				title: "%{validation:The value {actual} is smaller than the allowed minimum of {expected}}",
				priority: -2,
				values: {
					actual: value,
					expected: minimum,
					exclusive: !!exclusiveMinimum
				},
				context: []
			});
		}
	}
	var enumeration = function(value, enumeration) {
		if (enumeration && enumeration.indexOf(value) < 0) {
			messages.push({
				severity: "error",
				code: "enum",
				title: "%{validation:The value {actual} does not match one of the possible values}",
				priority: -1,
				values: {
					actual: value,
					expected: enumeration
				},
				context: []
			});
		}
	}
	var maxItems = function(value, maxItems) {
		if (typeof(maxItems) !== "undefined" && value.length > maxItems) {
			messages.push({
				severity: "error",
				code: "maxItems",
				title: "%{validation:There are {actual} entries, can be at most {expected}}",
				priority: -2,
				values: {
					actual: value.length,
					expected: maxItems
				},
				context: []
			});
		}
	}
	var minItems = function(value, minItems) {
		if (typeof(minItems) !== "undefined" && value.length < minItems) {
			messages.push({
				severity: "error",
				code: "minItems",
				title: "%{validation:There are only {actual} entries, expecting at least {expected}}",
				priority: -2,
				values: {
					actual: value.length,
					expected: minItems
				},
				context: []
			});
		}
	}
	
	// always check enumeration
	enumeration(value, definition["enum"]);
	
	// the string checks can be done on all of these
	if (definition.type == "string" || definition.type == "number" || definition.type == "integer" || !definition.type) {
		// empty strings are interpreted as null
		if (value == null || value === "") {
			missing();
		}
		else {
			var result = typeof(value) === "string" ? value : new String(value);
			minLength(result, definition.minLength);
			maxLength(result, definition.maxLength);
			pattern(result, definition.pattern, definition.patternComment);
		}
	}
	if (definition.type == "number" || definition.type == "integer") {
		var result = null;
		if (typeof(value) === "number") {
			result = value;
		}
		else if (typeof(value) != "undefined") {
			var number = new Number(value);
			if (isNaN(number)) {
				type(definition.type);
			}
			else {
				result = number;
			}
		}
		if (result != null) {
			maximum(value, definition.maximum, definition.exclusiveMaximum);
			minimum(value, definition.minimum, definition.exclusiveMinimum);
		}
		else {
			missing();
		}
	}
	else if (definition.type == "boolean") {
		if (value == null) {
			missing();
		}
	}
	else if (definition.type == "array") {
		if (value == null) {
			missing();
		}
		else {
			var result = !(value instanceof Array) ? [value] : value;
			if (!value.length) {
				missing();
			}
			else {
				maxItems(result, definition.maxItems);
				minItems(result, definition.minItems);
				
				if (definition.items) {
					for (var i = 0; i < result.length; i++) {
						var childMessages = nabu.utils.schema.json.validate(definition.items, result[i], false);
						for (var j = 0; j < childMessages.length; j++) {
							childMessages[j].context.push(i);
							messages.push(childMessages[j]);
						}
					}
				}
			}
		}
	}
	else if (definition.type == "object") {
		if (value == null) {
			missing();
		}
		else {
			if (definition.properties) {
				for (var key in definition.properties) {
					var child = value[key];
					var childMessages = nabu.utils.schema.json.validate(definition.properties[key], value[key], definition.required && definition.required.indexOf(key) >= 0);
					for (var j = 0; j < childMessages.length; j++) {
						childMessages[j].context.push(key);
						messages.push(childMessages[j]);
					}
				}
			}
		}
	}
	nabu.utils.schema.addAsyncValidation(messages);
	return messages;
};