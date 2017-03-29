if (!nabu) { nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.utils.stage = function(object, parameters) {
	if (!parameters) {
		parameters = {};
	}
	if (!parameters.observer) {
		// defaults to the vuejs observer
		parameters.observer = function(context) {
			if (context.__ob__ && context.__ob__.dep && context.__ob__.dep.notify) {
				context.__ob__.dep.notify();
			}
		}
	}
	if (object instanceof Array) {
		// default merge true
		if (typeof(parameters.added) == "undefined") {
			parameters.added = true;
		}
		// default merge removed
		if (typeof(parameters.removed) == "undefined") {
			parameters.removed = true;
		}
		// default merge removed
		if (typeof(parameters.spliced) == "undefined") {
			parameters.spliced = true;
		}

		var shim = [];
		shim.$original = object;
		shim.$changed = function() {
			var changed = (shim.pushed && shim.pushed.length)
				|| (shim.unshifted && shim.unshifted.length)
				|| (shim.popped && shim.popped.length)
				|| (shim.shifted && shim.shifted.length)
				|| (shim.spliced && shim.spliced.length);
			// if no changes exist at this level, go deep
			if (!changed) {
				for (var i = 0; i < shim.length; i++) {
					changed = changed || (!!shim[i].$changed && shim[i].$changed());
					if (changed) {
						break;
					} 
				}
			}
			return changed;
		}
		var initialize = function() {
			for (var i = 0; i < object.length; i++) {
				if (!parameters.shallow && (object[i] instanceof Array || typeof(object[i]) == "object")) {
					shim.push(nabu.utils.stage(object[i], parameters));
				}
				else {
					shim.push(object[i]);
				}
			}
			shim.pushed = [];
			shim.unshifted = [];
			shim.popped = [];
			shim.shifted = [];
			shim.spliced = [];
		};
		initialize();
		if (parameters.added) {
			// wrap the push
			var oldPush = shim.push;
			shim.push = function() {
				shim.pushed.push.apply(shim.pushed, arguments);
				oldPush.apply(shim, arguments);
				if (shim.__ob__) {
					shim.__ob__.observeArray(arguments);
				}
				parameters.observer(shim);
			};
			// wrap the unshift
			var oldUnshift = shim.unshift;
			shim.unshift = function() {
				shim.unshifted.push.apply(shim.unshifted, arguments);
				oldUnshift.apply(shim, arguments);
				if (shim.__ob__) {
					shim.__ob__.observeArray(arguments);
				}
				parameters.observer(shim);
			};
		}
		if (parameters.removed) {
			// wrap the pop
			var oldPop = shim.pop;
			shim.pop = function() {
				var popped = oldPop.apply(shim);
				if (popped) {
					shim.popped.push(popped);
					parameters.observer(this);
				}
			};
			// wrap the shift
			var oldShift = shim.shift;
			shim.shift = function() {
				shim.shifted.push(oldShift.apply(shim));
				parameters.observer(this);
			};
		}
		if (parameters.spliced) {
			// splice is slightly tricker so use with caution
			var oldSplice = shim.splice;
			shim.oldSplice = oldSplice;
			shim.splice = function(index, length) {
				var args = [];
				for (var i = 2; i < arguments.length; i++) {
					args.push(arguments[i]);
				}
				shim.spliced.push({
					starting: shim[index],
					added: args,
					removed: oldSplice.apply(shim, arguments)
				});
				if (args.length && shim.__ob__) {
					shim.__ob__.observeArray(arguments);
				}
				parameters.observer(this);
			};
		}
		else {
			var oldSplice = shim.splice;
			shim.splice = function(index, length) {
				var removed = oldSplice.apply(shim, arguments);
				for (var i = 0; i < removed.length; i++) {
					var index = object.indexOf(removed[i].$original ? removed[i].$original : removed[i]);
					if (index >= 0) {
						oldSplice.apply(object, [index, 1]);
					}
				}
			}
			shim.spliceSuperficial = function(index, length) {
				oldSplice.apply(shim, arguments);
			}
		}
		shim.$commit = function() {
			// first perform the "add" methods, to have more reference points for splicing
			if (shim.pushed) {
				for (var i = 0; i < shim.pushed.length; i++) {
					object.push(shim.pushed[i]);
				}
			}
			if (shim.unshifted) {
				for (var i = 0; i < shim.unshifted.length; i++) {
					object.unshift(shim.unshifted[i]);
				}
			}
			if (shim.spliced) {
				for (var i = 0; i < shim.spliced.length; i++) {
					var index = object.indexOf(shim.spliced[i].starting.$original ? shim.spliced[i].starting.$original : shim.spliced[i].starting);
					if (index >= 0) {
						// splice in the new stuff
						if (parameters.added) {
							object.splice.bind(object, index, 0).apply(object, shim.spliced[i].added);
						}
						// remove old stuff
						if (parameters.removed) {
							for (var j = 0; j < shim.spliced[i].removed.length; j++) {
								index = object.indexOf(shim.spliced[i].removed[j].$original ? shim.spliced[i].removed[j].$original : shim.spliced[i].removed[j]);
								if (index >= 0) {
									object.splice(index, 1);
								}
								else {
									console.log("Can not find spliced element", shim.spliced[i].removed[j]);
								}
							}
						}
					}
					else {
						console.log("Can not find splice start point", shim.spliced[i].starting);
					}
				}
			}
			if (shim.popped) {
				for (var i = 0; i < shim.popped.length; i++) {
					var index = object.indexOf(shim.popped[i].$original ? shim.popped[i].$original : shim.popped[i]);
					if (index >= 0) {
						object.splice(index, 1);
					}
					else {
						console.log("Can not find popped element", shim.shifted[i]);
					}
				}
			}
			if (shim.shifted) {
				for (var i = 0; i < shim.shifted.length; i++) {
					// new elements don't have an $original
					var index = object.indexOf(shim.shifted[i].$original ? shim.shifted[i].$original : shim.shifted[i]);
					if (index >= 0) {
						object.splice(index, 1);
					}
					else {
						console.log("Can not find shifted element", shim.shifted[i]);
					}
				}
			}
			// apply the merge where possible
			for (var i = 0; i < shim.length; i++) {
				if (shim[i].$commit) {
					shim[i].$commit();
				}
			}
			// after commit do a rollback to resync
			shim.$rollback();
		};
		shim.$rollback = function() {
			// reset elements
			if (shim.spliceSuperficial) {
				shim.spliceSuperficial(0, shim.length);
			}
			else {
				shim.splice(0, shim.length);
			}
			// reinitialize
			initialize();
		};
		return shim;
	}
	else if (typeof(object) == "object") {
		// create a new object to hold updates
		var shim = {};
		shim.$original = object;
		shim.$rollback = function() {
			for (var key in object) {
				var ignoreField = parameters.ignoreFields && parameters.ignoreFields.indexOf(key) >= 0;
				// recursively shim
				if (!ignoreField && object[key] != null && (object[key] instanceof Array || typeof(object[key]) == "object")) {
					shim[key] = nabu.utils.stage(object[key], parameters);
				}
				else {
					shim[key] = object[key];
				}
			}
		}
		shim.$changed = function() {
			var changed = false;
			for (var key in shim) {
				if (shim[key] && shim[key].$changed) {
					changed = shim[key].$changed();
				}
				// skip hidden fields for comparison
				else if (key.substring(0, 1) != "$") {
					changed = object[key] != shim[key];
				}
				if (changed) {
					break;
				}
			}
			return changed;
		}
		// sync it
		shim.$rollback();
		shim.$commit = function() {
			// merge the new stuff in
			for (var key in shim) {
				// don't merge back inserted
				if (key.substring(0, 1) == "$") {
					continue;
				}
				if (shim[key] != null && shim[key].$commit && (shim[key] instanceof Array || typeof(shim[key]) == "object")) {
					shim[key].$commit();
				}
				else {
					object[key] = shim[key];
				}
			}
			// after commit do a rollback to resync
			shim.$rollback();
		}
		return shim;
	}
	else {
		throw "Can only shim arrays of objects or objects";
	}
};

if (Vue && Vue.mixin) {
	Vue.mixin({
		computed: {
			$stage: function() { return nabu.utils.stage }
		}
	});
}
