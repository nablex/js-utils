/*
This file contains a basic router that allows you to go to a state using an alias.
It has the ability to optionally bind an URL to a state with or without parameters.
On initial load it can deduce the state from the URL by using routeInitial();
Note that you can toggle the usage of hashtags.

A route can be registered using the register:

router.register({
	alias: "theAliasForTheRoute",
	enter: function(anchor, parameters),
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

When creating a router instance you can pass in a global enter method.
These global methods are called with exactly the same parameters as the route-specific enter/leaves but adds one more parameter at the end: the return of the specific enter/leave (if any)

*/

if (!nabu) { var nabu = {}; }
if (!nabu.services) { nabu.services = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.services.Router = function(parameters) {
	var self = this;
	this.defaultAnchor = parameters.defaultAnchor ? parameters.defaultAnchor : "main";
	this.useHash = parameters.useHash ? true : false;
	// all the routes available
	this.routes = [];
	this.enter = parameters.enter ? parameters.enter : null;
	this.unknown = parameters.unknown ? parameters.unknown : null;
	this.authorizer = parameters.authorizer ? parameters.authorizer : null;
	this.chosen = parameters.chosen ? parameters.chosen : null;

	this.previousUrl = null;
	this.changingHash = false;
	this.initials = [];

	
	window.addEventListener("popstate", function(event) {
		var state = event.state;
		var alias = state ? state.alias : null;
		var anchor = state ? state.anchor : null;
		var initial = self.initials.pop();
		if (!alias) {
			self.routeInitial(anchor, state ? state.parameters : null, true);
		}
		else if (initial) {
			self.routeAll(alias, state ? state.parameters : null, anchor, false);
		}
		else {
			self.route(alias, state ? state.parameters : null, anchor, true);
		}
	}, false);
	
	this.get = function(alias) {
		var routes = this.sort();
		for (var i = 0; i < routes.length; i++) {
			if (routes[i].alias == alias) {
				return routes[i];
			}
		}
		return null;
	};
	
	this.list = function(alias) {
		return this.sort();
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
			var result = self.authorizer(anchor, chosenRoute, parameters);
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
			var alternative = self.chosen(anchor, chosenRoute, parameters);
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
		
		var enterReturn = chosenRoute.enter(anchor, parameters, mask);
		if (self.enter != null) {
			self.enter(anchor, chosenRoute, parameters, enterReturn, mask);
		}
		// update the current URL if the state has a URL attached to it
		if (chosenRoute.url && !mask) {
			self.updateUrl(chosenRoute.alias, chosenRoute.url, parameters, chosenRoute.query, anchor);
		}
		else {
			self.updateState(chosenRoute.alias, parameters, chosenRoute.query, anchor);
		}
		self.initials.push(null);
		return enterReturn;
	};
	
	this.template = function(alias, parameters) {
		var route = this.findByAlias(alias, parameters, null, false);
		return route && route.url ? this.templateUrl(route.url, parameters, route.query) : null;
	};
	
	this.bookmark = function(alias, parameters, anchor) {
		if (window.history) {
			if (!parameters) {
				parameters = {};
			}
			window.history.pushState({ alias: alias, anchor: anchor, parameters: parameters }, alias, self.template(alias, parameters));
			self.previousUrl = self.getUrl();
		}
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
		return self.useHash && url.substring(0, 1) != "#" ? "#" + url : "${server.root()}" + url.replace(/^[/]+/, "");
	};
	
	this.getUrl = function() {
		var url = self.useHash ? window.location.hash : window.location.pathname + (window.location.search ? window.location.search : "");
		if (self.useHash && url.substring(0, 1) != "#") {
			url = "#" + url;
		}
		return url ? url : "/";
	};
	
	this.updateUrl = function(alias, url, parameters, query, anchor) {
		url = self.templateUrl(url, parameters, query);
		/*if (self.useHash) {
			self.changingHash = true;
			window.location.hash = url;
		}*/
		if (window.history) {
			if (!parameters) {
				parameters = {};
			}
			try {
				window.history.pushState({ alias: alias, anchor: anchor, parameters: parameters }, alias, url);
			}
			catch (exception) {
				// ignore, probably can't serialize it, no worries
			}
			self.previousUrl = self.getUrl();
		}
	};
	
	this.updateState = function(alias, parameters, query, anchor) {
		// if we route directly to an element, we can't replay it
		if (typeof(anchor) == "string") {
			try {
				window.history.pushState({ alias: alias, anchor: anchor, parameters: parameters }, alias, self.getUrl());
			}
			catch (exception) {
				// ignore, probably can't serialize it, no worries
			}
		}
	};

	this.sort = function() {
		// sort the routes based on priority
		// this allows for default routes to be defined and overwritten
		// we clone the list because the list is generally watched
		// if you are showing all the routes in a dropdown for instance, then perform a get()
		// the actual get will trigger a sort, will change the dropdown values, etc in a loop
		var cloned = nabu.utils.objects.clone(this.routes);
		cloned.sort(function(a, b) {
			// lowest priority has to be sorted to the back of the array so they get picked last
			return (typeof(b.priority) == "undefined" ? 0 : b.priority)
				- (typeof(a.priority) == "undefined" ? 0 : a.priority);
		});
		return cloned;
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
		var routes = this.sort();
		for (var i = 0; i < routes.length; i++) {
			if (routes[i].url && ((!initial && !routes[i].initial) || (initial && routes[i].initial))) {
				var urls = routes[i].url instanceof Array ? routes[i].url : [routes[i].url];
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
						chosenRoute = routes[i];
						if (chosenRoute.query) {
							var parts = queryParameters.substring(1).split("&");
							for (var j = 0; j < parts.length; j++) {
								var values = parts[j].split("=");
								if (chosenRoute.query.indexOf(values[0]) >= 0) {
									var key = values[0];
									values.splice(0, 1);
									if (parameters[key] != null) {
										if (!(parameters[key] instanceof Array)) {
											parameters[key] = [parameters[key]];
										}
										parameters[key].push(values.join("="));
									}
									else {
										parameters[key] = values.join("=");
									}
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

	this.localizeUrl = function(url) {
		var root = "${server.root()}";
		if (url.length >= root.length && url.substring(0, root.length) == root) {
			url = "/" + url.substring(root.length);
		}
		// the root always ends on "/" for predictability, however, the url itself might not end in a "/", it is optional for the root page
		// in that case, we actually match the root minus the trailing "/", this means home
		else if (url.length == root.length - 1 && url == root.substring(0, root.length - 1)) {
			url = "/";
		}
		return url;
	};

	this.routeInitial = function(anchor, parameters, mask) {
		var initial = null;
		// check for initial route to build framework around data
		if (self.useHash) {
			initial = self.findRoute(window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/", true);
		}
		else {
			initial = self.findRoute(self.localizeUrl(window.location.pathname ? window.location.pathname : "/"), true);
		}
		var current = null;
		// check for actual data route
		if (self.useHash) {
			current = self.findRoute(window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/");
		}
		else {
			current = self.findRoute(self.localizeUrl(window.location.pathname ? window.location.pathname : "/"));
		}
		return self.routePage(initial, current, parameters, anchor, mask);
	};
	
	this.routeAll = function(alias, parameters, anchor, mask) {
		var initialRoute = null;
		var chosenRoute = null;
		var routes = this.sort();
		for (var i = 0; i < routes.length; i++) {
			if (routes[i].alias == alias) {
				if (routes[i].initial && !initialRoute) {
					initialRoute = routes[i];
				}
				else if (!routes[i].initial && !chosenRoute) {
					chosenRoute = routes[i];
				}
			}
			else if (routes[i].initial && !initialRoute && alias.match(routes[i].alias)) {
				initialRoute = routes[i];
			}
		}
		self.routePage(
			initialRoute == null ? null : { route: initialRoute, parameters: parameters}, 
			chosenRoute == null ? null : { route: chosenRoute, parameters: parameters }, 
			parameters, anchor, mask, true);
	};
		
	// the initial route on page load
	this.routePage = function(initial, current, parameters, anchor, mask, updateUrl) {
		if (!anchor) {
			anchor = self.defaultAnchor;
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
			self.initials.push(initial);
			initial.route.enter("body", initial.parameters, null, null);
		}
		if (!current && self.unknown) {
			var unknown = self.unknown(null, parameters, anchor);
			if (unknown) {
				current = {
					route: unknown,
					parameters: parameters
				};
			}
		}
		if (!current) {
			throw "Unknown initial route";
		}
		if (current != null) {
			if (self.authorizer) {
				var result = self.authorizer(anchor, current.route, current.parameters, null, null);
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
					current = {
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
				var alternative = self.chosen(anchor, current.route, parameters ? parameters : current.parameters, null, null);
				if (alternative && alternative.route) {
					current.route = alternative.route;
				}
				if (alternative && alternative.parameters) {
					if (parameters) {
						parameters = alternative.parameters;
					}
					else {
						current.parameters = alternative.parameters;
					}
				}
			}
			var enterReturn = current.route.enter(anchor, current.parameters, null, null);
			if (self.enter != null) {
				self.enter(anchor, current.route, parameters ? parameters : current.parameters, null, null, enterReturn);
				if (updateUrl) {
					self.updateUrl(current.route.alias, current.route.url, parameters);	
				}
				else {
					self.updateState(current.route.alias, parameters ? parameters : current.parameters, current.query, anchor);
				}
			}
			return enterReturn;
		}
		return null;
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
	
	this.unregister = function(route) {
		if (typeof(route) == "string") {
			route = self.routes.filter(function(x) {
				return x.alias == route;
			})[0];
		}
		if (route) {
			var index = self.routes.indexOf(route);
			if (index >= 0) {
				self.routes.splice(index, 1);
			}
		}
	};

	this.previousUrl = this.getUrl();
}

nabu.utils.router = {
	// get the anchor to render in
	anchor: function(anchor) {
		var element = typeof(anchor) === "object" ? anchor : document.getElementById(anchor);
		if (!element && anchor == "body") {
			element = document.body;
		}
		return element;
	},
	// get the current rendering target you are in
	self: function(element) {
		while (element && !element.hasAttribute("route")) {
			element = element.parentNode;
		}
		return element;
	}
}