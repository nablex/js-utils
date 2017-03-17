if (!nabu) { var nabu = {} }
if (!nabu.utils) { nabu.utils = {} }
if (!nabu.utils.schema) { nabu.utils.schema = {} }
if (!nabu.utils.schema.json) { nabu.utils.schema.json = {} }

// formats a value according to the definition
// will throw an exception if the value is not valid according to the schema
nabu.utils.schema.json.format = function(definition, value) {
	if (definition.$ref) {
		definition = this.definition(definition.$ref);
	}
	if (definition.type == "string") {
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
			result.push(nabu.utils.schema.json.format(definition.items, value[i]));
		}
	}
	else if (definition.type == "object") {
		var result = {};
		if (definition.properties) {
			for (var key in definition.properties) {
				var formatted = nabu.utils.schema.json.format(definition.properties[key], value[key]);
				// only set filled in values
				if (formatted != null) {
					result[key] = formatted;
				}
				else if (definition.required.indexOf(key) >= 0) {
					throw "Missing required element: " + key;
				}
			}
		}
		return result;
	}
	else {
		throw "Unsupported type: " + definition.type;
	}
};

// will validate a value by a schema definition
nabu.utils.schema.json.validate = function(definition, value, required) {
	if (typeof(value) == "undefined") {
		value = null;
	}
	
	var messages = [];
	
	var missing = function() {
		if (required) {
			messages.push({
				severity: "error",
				code: "required",
				values: {
					actual: false,
					expected: true
				},
				context: []
			});
		}
	}
	// indicates that it could not be parsed as the given data type
	var type = function(type) {
		messages.push({
			severity: "error",
			code: "type",
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
				values: {
					actual: result.length,
					expected: maxLength
				},
				context: []
			});
		}
	}
	var pattern = function(value, pattern) {
		if (typeof(pattern) !== "undefined" && !result.match(pattern)) {
			messages.push({
				severity: "error",
				code: "pattern",
				values: {
					actual: result.length,
					expected: pattern
				},
				context: []
			});
		}
	}
	var maximum = function(value, maximum) {
		if (typeof(maximum) !== "undefined" && value > maximum) {
			messages.push({
				severity: "error",
				code: "maximum",
				values: {
					actual: value,
					expected: maximum
				},
				context: []
			});
		}
	}
	var exclusiveMaximum = function(value, exclusiveMaximum) {
		if (typeof(maximum) !== "undefined" && value >= exclusiveMaximum) {
			messages.push({
				severity: "error",
				code: "exclusiveMaximum",
				values: {
					actual: value,
					expected: exclusiveMaximum
				},
				context: []
			});
		}
	}
	var minimum = function(value, minimum) {
		if (typeof(minimum) !== "undefined" && value < minimum) {
			messages.push({
				severity: "error",
				code: "minimum",
				values: {
					actual: value,
					expected: minimum
				},
				context: []
			});
		}
	}
	var exclusiveMinimum = function(value, exclusiveMinimum) {
		if (typeof(minimum) !== "undefined" && value <= exclusiveMinimum) {
			messages.push({
				severity: "error",
				code: "exclusiveMinimum",
				values: {
					actual: value,
					expected: exclusiveMinimum
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
	if (definition.type == "string" || definition.type == "number" || definition.type == "integer") {
		// empty strings are interpreted as null
		if (!value) {
			missing();
		}
		else {
			var result = typeof(value) === "string" ? value : new String(value);
			minLength(result, definition.minLength);
			maxLength(result, definition.maxLength);
			pattern(result, definition.pattern);
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
			maximum(value, definition.maximum);
			exclusiveMaximum(value, definition.exclusiveMaximum);
			minimum(value, definition.minimum);
			exclusiveMinimum(value, definition.exclusiveMinimum);
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
	// it's the first if
	else if (definition.type != "string") {
		throw "Unsupported type: " + definition.type;
	}
	return messages;
};