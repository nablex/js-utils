/*
This file contains a basic router that allows you to go to a state using an alias.
It has the ability to optionally bind an URL to a state with or without parameters.
On initial load it can deduce the state from the URL by using routeInitial();
Note that you can toggle the usage of hashtags.

A route can be registered using the register:

router.register({
	alias: "theAliasForTheRoute",
	enter: function(anchor, parameters, previousRoute, previousParameters),
	leave: function(anchor, currentParameters, newRoute, newParameters),
	url: "/path/to/{myVar}/{myOtherVar}
});

For route authorization you can register a function that has the following spec:

function(anchor, route, parameters, previousRoute, previousParameters)

It should return either a boolean indicating whether or not the route is allowed, nothing or null if it's allowed or a structured object of an alternative route:
{ 
	alias: mandatory,
	properties: if required by the alias,
	anchor: if none is given, the original anchor is used,
	mask: if none is given, the original mask boolean is used
}

When creating a router instance you can pass in a global enter/leave method.
These global methods are called with exactly the same parameters as the route-specific enter/leaves but adds one more parameter at the end: the return of the specific enter/leave (if any)

TODO:
- differentiate the "current route" per anchor instead of globally
- allow updates of the URL only if the route is in the default anchor
*/

if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }

nabu.services.Router = function(parameters) {
	var self = this;
	this.defaultAnchor = parameters.defaultAnchor ? parameters.defaultAnchor : "main";
	this.useHash = parameters.useHash ? true : false;
	// all the routes available
	this.routes = [];
	// the current route
	this.current = {};
	this.enter = parameters.enter ? parameters.enter : null;
	this.leave = parameters.leave ? parameters.leave : null;
	this.unknown = parameters.unknown ? parameters.unknown : null;
	this.authorizer = parameters.authorizer ? parameters.authorizer : null;
	this.chosen = parameters.chosen ? parameters.chosen : null;

	this.previousUrl = null;
	this.changingHash = false;

	// listen to hash changes
/*	window.addEventListener("hashchange", function() {
		if (self.useHash) {
			if (!self.changingHash) {
				self.routeInitial();
			}
			else {
				self.changingHash = false;
			}
		}
	}, false);*/
	
	window.addEventListener("popstate", function(event) {
/*		if (!self.useHash && self.previousUrl != window.location.pathname) {
			self.routeInitial();
			self.previousUrl = window.location.pathname;
		}*/
		var state = event.state;
		var alias = state ? state.alias : null;
		var anchor = state ? state.anchor : null;
		if (!alias) {
			self.routeInitial(anchor, state ? state.parameters : null, true);
		}
		else {
			self.route(alias, state ? state.parameters : null, anchor, true);
		}
	}, false);
	
	this.get = function(alias) {
		this.sort();
		for (var i = 0; i < this.routes.length; i++) {
			if (this.routes[i].alias == alias) {
				return this.routes[i];
			}
		}
		return null;
	};
	
	this.list = function(alias) {
		this.sort();
		return this.routes;
	};

	// route to a new alias
	this.route = function(alias, parameters, anchor, mask) {
		if (!anchor) {
			anchor = self.defaultAnchor;
		}
		var chosenRoute = null;
		for (var i = 0; i < self.routes.length; i++) {
			if (self.routes[i].alias == alias && !self.routes[i].initial) {
				chosenRoute = self.routes[i];
				break;
			}
		}
		if (chosenRoute == null && self.unknown) {
			chosenRoute = self.unknown(alias, parameters, anchor);
		}
		if (chosenRoute == null) {
			throw "Unknown route: " + alias;
		}
		if (self.authorizer) {
			var result = self.authorizer(anchor, chosenRoute, parameters, self.current[anchor] ? self.current[anchor].route : null, self.current[anchor] ? self.current[anchor].parameters : null);
			if (typeof(result) == "boolean" && !result) {
				return false;
			}
			else if (typeof(result) == "object" && result) {
				return self.route(
					result.alias,
					result.parameters,
					result.anchor ? result.anchor : anchor,
					typeof(result.mask) == "undefined" ? mask : result.mask
				);
			}
		}
		if (self.chosen) {
			var alternative = self.chosen(anchor, chosenRoute, parameters, self.current[anchor] ? self.current[anchor].route : null, self.current[anchor] ? self.current[anchor].parameters : null);
			if (alternative && alternative.route) {
				chosenRoute = alternative.route;
			}
			if (alternative && alternative.parameters) {
				parameters = alternative.parameters;
			}
			if (alternative && typeof(alternative.mask) != "undefined") {
				mask = alternative.mask;
			}
		}
		var leaveReturn = null;
		if (self.current[anchor] && self.current[anchor].route.leave) {
			leaveReturn = self.current[anchor].route.leave(anchor, self.current[anchor].parameters, chosenRoute, parameters);
		}
		if (self.leave != null) {
			self.leave(anchor, self.current[anchor] ? self.current[anchor].route : null, self.current[anchor] ? self.current[anchor].parameters : null, chosenRoute, parameters, leaveReturn);
		}
		var enterReturn = chosenRoute.enter(anchor, parameters, self.current[anchor] ? self.current[anchor].route : null, self.current[anchor] ? self.current[anchor].parameters : null);
		if (self.enter != null) {
			self.enter(anchor, chosenRoute, parameters, self.current[anchor] ? self.current[anchor].route : null, self.current[anchor] ? self.current[anchor].parameters : null, enterReturn);
		}
		self.current[anchor] = {
			route: chosenRoute,
			parameters: parameters
		};
		// update the current URL if the state has a URL attached to it
		if (chosenRoute.url && !mask) {
			self.updateUrl(chosenRoute.alias, chosenRoute.url, parameters, chosenRoute.query, anchor);
		}
		else {
			self.updateState(chosenRoute.alias, parameters, chosenRoute.query, anchor);
		}
		return enterReturn;
	};
	
	this.template = function(alias, parameters) {
		var route = this.findByAlias(alias, parameters, null, false);
		return route && route.url ? this.templateUrl(route.url, parameters, route.query) : null;
	};
	
	this.templateUrl = function(url, parameters, query) {
		for (var key in parameters) {
			url = url.replace(new RegExp("{[\s]*" + key + "[\s]*:[^}]+}"), parameters[key]).replace(new RegExp("{[\s]*" + key + "[\s]*}"), parameters[key]);
		}
		url = url.replace(/[\/]{2,}/, "/");
		if (query && parameters) {
			var first = true;
			for (var i = 0; i < query.length; i++) {
				var value = parameters[query[i]];
				if (typeof(value) != "undefined" && value != null) {
					if (first) {
						url += "?";
						first = false;
					}
					else {
						url += "&";
					}
					url += query[i] + "=" + parameters[query[i]];
				}
			}
		}
		return self.useHash && url.substring(0, 2) != "#" ? "#" + url : url;
	};
	
	this.getUrl = function() {
		var url = self.useHash ? window.location.hash : window.location.pathname;
		return url ? url : "/";
	};
	
	this.updateUrl = function(alias, url, parameters, query, anchor) {
		var self = this;
		url = this.templateUrl(url, parameters, query);
		/*if (self.useHash) {
			self.changingHash = true;
			window.location.hash = url;
		}*/
		if (window.history) {
			if (!parameters) {
				parameters = {};
			}
			window.history.pushState({ alias: alias, anchor: anchor, parameters: parameters }, alias, url);
			self.previousUrl = self.getUrl();
		}
	};
	
	this.updateState = function(alias, parameters, query, anchor) {
		// if we route directly to an element, we can't replay it
		if (typeof(anchor) == "string") {
			window.history.pushState({ alias: alias, anchor: anchor, parameters: parameters }, alias, self.getUrl());
		}
	};

	this.sort = function() {
		// sort the routes based on priority
		// this allows for default routes to be defined and overwritten
		this.routes.sort(function(a, b) {
			// lowest priority has to be sorted to the back of the array so they get picked last
			return (typeof(b.priority) == "undefined" ? 0 : b.priority)
				- (typeof(a.priority) == "undefined" ? 0 : a.priority);
		});
	}

	this.findRoute = function(path, initial) {
		if (!path) {
			path = "/";
		}
		var chosenRoute = null;
		var parameters = {};
		var queryIndex = path.indexOf("?");
		var queryParameters = queryIndex >= 0 ? path.substring(queryIndex) : window.location.search;
		if (queryIndex >= 0) {
			path = path.substring(0, queryIndex);
		}
		this.sort();
		for (var i = 0; i < self.routes.length; i++) {
			if (self.routes[i].url && ((!initial && !self.routes[i].initial) || (initial && self.routes[i].initial))) {
				var urls = self.routes[i].url instanceof Array ? self.routes[i].url : [self.routes[i].url];
				var found = false;
				for (var k = 0; k < urls.length; k++) {
					var template = "^" + urls[k].replace(/\{[\s]*[^}:]+[\s]*:[\s]*([^}]+)[\s]*\}/g, "($1)").replace(/\{[\s]*[^}]+[\s]*\}/g, "([^/]+)") + "$";
					var matches = path.match(template);
					if (matches) {
						var variables = urls[k].match(template);
						if (!variables) {
							throw "Could not extract variables from: " + urls[k].url;
						}
						if (variables.length != matches.length) {
							throw "The amount of variables does not equal the amount of values";
						}
						// the first hit is the entire string
						for (var j = 1; j < variables.length; j++) {
							parameters[variables[j].substring(1, variables[j].length - 1).replace(/:.*$/, "")] = matches[j];
						}
						chosenRoute = self.routes[i];
						if (chosenRoute.query) {
							var parts = queryParameters.substring(1).split("&");
							for (var j = 0; j < parts.length; j++) {
								var values = parts[j].split("=");
								if (chosenRoute.query.indexOf(values[0]) >= 0) {
									var key = values[0];
									values.splice(0, 1);
									parameters[key] = values.join("=");
								}
							}
						}
						found = true;
						break;
					}
				}
				if (found) {
					break;
				}
			}
		}
		return chosenRoute == null ? null : {
			route: chosenRoute,
			parameters: parameters
		};
	};

	// the initial route on page load
	this.routeInitial = function(anchor, parameters, mask) {
		if (!anchor) {
			anchor = self.defaultAnchor;
		}
		var initial = null;
		// check for initial route to build framework around data
		if (self.useHash) {
			initial = self.findRoute(window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/", true);
		}
		else {
			initial = self.findRoute(window.location.pathname ? window.location.pathname : "/", true);
		}
		// look for an initial route that has no url, it is the default initial
		if (initial == null) {
			for (var i = 0; i < self.routes.length; i++) {
				if (self.routes[i].initial && !self.routes[i].url) {
					initial = {
						route: self.routes[i],
						parameters: self.routes[i].parameters
					};
					break;
				}	
			}
		}
		
		if (initial != null) {
			if (self.authorizer) {
				var result = self.authorizer("body", initial.route, initial.parameters, null, null);
				if (typeof(result) == "object" && result) {
					initial = self.findByAlias(
						result.alias,
						result.parameters,
						"body",
						true
					);
					if (initial == null) {
						throw "Coult not find initial route: " + result.alias;
					}
					else {
						initial = {
							route: initial,
							parameters: result.parameters
						}
					}
				}
			}
			initial.route.enter("body", initial.parameters, null, null);
		}
		// check for actual data route
		if (self.useHash) {
			self.current[anchor] = self.findRoute(window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/");
		}
		else {
			self.current[anchor] = self.findRoute(window.location.pathname ? window.location.pathname : "/");
		}
		if (!self.current[anchor] && self.unknown) {
			var unknown = self.unknown(null, parameters, anchor);
			if (unknown) {
				self.current[anchor] = {
					route: unknown,
					parameters: parameters
				};
			}
		}
		if (!self.current[anchor]) {
			throw "Unknown initial route";
		}
		if (self.current[anchor] != null) {
			if (self.authorizer) {
				var result = self.authorizer(anchor, self.current[anchor].route, self.current[anchor].parameters, null, null);
				if (typeof(result) == "object" && result) {
					var alternativeRoute = self.findByAlias(
						result.alias,
						result.parameters,
						result.anchor ? result.anchor : anchor,
						false
					);
					if (alternativeRoute == null) {
						throw "Could not find alternative route: " + result.alias;
					}
					self.current[anchor] = {
						route: alternativeRoute,
						parameters: result.parameters
					}
					if (!mask) {
						if (alternativeRoute.url && (typeof(alternativeRoute.mask) == "undefined" || !alternativeRoute.mask)) {
							self.updateUrl(alternativeRoute.alias, alternativeRoute.url, result.parameters);
						}
						self.updateUrl(alternativeRoute.alias, alternativeRoute.url, parameters);
					}
					else {
						self.updateState(alternativeRoute.alias, parameters);
					}
				}
			}
			if (self.chosen) {
				var alternative = self.chosen(anchor, self.current[anchor].route, parameters ? parameters : self.current[anchor].parameters, null, null);
				if (alternative && alternative.route) {
					self.current[anchor].route = alternative.route;
				}
				if (alternative && alternative.parameters) {
					if (parameters) {
						parameters = alternative.parameters;
					}
					else {
						self.current[anchor].parameters = alternative.parameters;
					}
				}
			}
			var enterReturn = self.current[anchor].route.enter(anchor, self.current[anchor].parameters, null, null);
			if (self.enter != null) {
				self.enter(anchor, self.current[anchor].route, parameters ? parameters : self.current[anchor].parameters, null, null, enterReturn);
			}
		}
		return self.current[anchor].route;
	};
	
	this.findByAlias = function(alias, parameters, anchor, initial) {
		var chosenRoute = null;
		for (var i = 0; i < self.routes.length; i++) {
			if (self.routes[i].alias == alias && (initial || !self.routes[i].initial)) {
				chosenRoute = self.routes[i];
				break;
			}
		}
		if (chosenRoute == null && self.unknown) {
			chosenRoute = self.unknown(alias, parameters, anchor);
		}
		return chosenRoute;
	};

	this.register = function(route) {
		self.routes.push(route);
		return route;
	};

	this.previousUrl = this.getUrl();
}