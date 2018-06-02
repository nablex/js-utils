if (!nabu) { var nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }
if (!nabu.utils.misc) { nabu.utils.misc = {}; }

// the generator should generate a place holder that can (preferably) be updated in place (e.g. through reactivity) for non-resolved keys
// the cacher should be able to store and update a result in such a way that it is reflected everywhere
// the mapper (optional) should resolve the key from the resultset
// 	if no mapper is present, we assume the result array is in the same order as the ids we resolved
nabu.utils.misc.BatchResolver = function(resolver, cacher, generator, mapper, timeout) {
	if (!timeout) {
		timeout = 50;
	}
	if (!generator) {
		generator = function() { return  {} };
	}
	var toResolve = [];
	var timer = null;
	return function(key) {
		var stringified = JSON.stringify(key);
		var cached = cacher(stringified);
		if (cached) {
			return cached;
		}
		if (timer) {
			clearTimeout(timer);
			timer = null;
		}
		var result = generator(key);
		cacher(stringified, result);
		toResolve.push(key);
		setTimeout(function() {
			var keys = toResolve.splice(0, toResolve.length);
			resolver(keys).then(function(result) {
				var array = null;
				if (!(result instanceof Array)) {
					Object.keys(result).map(function(key) {
						if (result[key] instanceof Array) {
							array = result[key];
						}
					});
				}
				else {
					array = result;
				}
				// if we have a mapper, update the keys array
				if (mapper) {
					keys = array.map(mapper);
				}
				// set it all in the cache
				for (var i = 0; i < array.length; i++) {
					cacher(keys[i], array[i]);
				}
			});
		}, timeout);
		return result;
	}	
}