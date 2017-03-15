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
	this.current = null;
	this.enter = parameters.enter ? parameters.enter : null;
	this.leave = parameters.leave ? parameters.leave : null;
	this.unknown = parameters.unknown ? parameters.unknown : null;
	this.authorizer = parameters.authorizer ? parameters.authorizer : null;

	this.previousUrl = window.location.pathname;
	this.changingHash = false;

	// listen to hash changes
	window.addEventListener("hashchange", function() {
		if (self.useHash) {
			if (!self.changingHash) {
				self.routeInitial();
			}
			else {
				self.changingHash = false;
			}
		}
	}, false);
	
	window.addEventListener("popstate", function(event) {
		if (!self.useHash && self.previousUrl != window.location.pathname) {
			self.routeInitial();
			self.previousUrl = window.location.pathname;
		}
	}, false);

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
			var result = self.authorizer(anchor, chosenRoute, parameters, self.current ? self.current.route : null, self.current ? self.current.parameters : null);
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
		var leaveReturn = null;
		if (self.current && self.current.route.leave) {
			leaveReturn = self.current.route.leave(anchor, self.current.parameters, chosenRoute, parameters);
		}
		if (self.leave != null) {
			self.leave(anchor, self.current.route, self.current.parameters, chosenRoute, parameters, leaveReturn);
		}
		var enterReturn = chosenRoute.enter(anchor, parameters, self.current ? self.current.route : null, self.current ? self.current.parameters : null);
		if (self.enter != null) {
			self.enter(anchor, chosenRoute, parameters, self.current ? self.current.route : null, self.current ? self.current.parameters : null, enterReturn);
		}
		self.current = {
			route: chosenRoute,
			parameters: parameters
		};
		// update the current URL if the state has a URL attached to it
		if (chosenRoute.url && !mask) {
			self.updateUrl(chosenRoute.alias, chosenRoute.url, parameters);
		}
		return true;
	};
	
	this.template = function(alias, parameters) {
		var route = this.findByAlias(alias, parameters, null, false);
		return route ? this.templateUrl(route.url, parameters) : null;
	};
	
	this.templateUrl = function(url, parameters) {
		for (var key in parameters) {
			url = url.replace(new RegExp("{[\s]*" + key + "[\s]*:[^}]+}"), parameters[key]).replace(new RegExp("{[\s]*" + key + "[\s]*}"), parameters[key]);
		}
		url = url.replace(/[\/]{2,}/, "/");
		return url;
	};
	
	this.updateUrl = function(alias, url, parameters) {
		var self = this;
		url = this.templateUrl(url, parameters);
		if (self.useHash) {
			self.changingHash = true;
			window.location.hash = "#" + url;
		}
		else if (window.history) {
			window.history.pushState({}, alias, url);
			self.previousUrl = window.location.pathname;
		}
	};

	this.findRoute = function(path, initial) {
		if (!path) {
			path = "/";
		}
		var chosenRoute = null;
		var parameters = {};
		for (var i = 0; i < self.routes.length; i++) {
			if (self.routes[i].url && ((!initial && !self.routes[i].initial) || (initial && self.routes[i].initial))) {
				var template = "^" + self.routes[i].url.replace(/\{[\s]*[^}:]+[\s]*:[\s]*([^}]+)[\s]*\}/g, "($1)").replace(/\{[\s]*[^}]+[\s]*\}/g, "([^/]+)") + "$";
				var matches = path.match(template);
				if (matches) {
					var variables = self.routes[i].url.match(template);
					if (!variables) {
						throw "Could not extract variables from: " + self.routes[i].url;
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
						var parts = window.location.search.substring(1).split("&");
						for (var i = 0; i < parts.length; i++) {
							var values = parts[i].split("=");
							if (chosenRoute.query.indexOf(values[0]) >= 0) {
								var key = values[0];
								values.splice(0, 1);
								parameters[key] = values.join("=");
							}
						}
					}
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
	this.routeInitial = function(anchor) {
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
			self.current = self.findRoute(window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/");
		}
		else {
			self.current = self.findRoute(window.location.pathname ? window.location.pathname : "/");
		}
		if (self.current != null) {
			if (self.authorizer) {
				var result = self.authorizer(anchor, self.current.route, self.current.parameters, null, null);
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
					self.current = {
						route: alternativeRoute,
						parameters: result.parameters
					}
					if (alternativeRoute.url && (typeof(alternativeRoute.mask) == "undefined" || !alternativeRoute.mask)) {
						self.updateUrl(alternativeRoute.alias, alternativeRoute.url, result.parameters);
					}
					self.updateUrl(alternativeRoute.alias, alternativeRoute.url, parameters);
				}
			}
			self.current.route.enter(anchor, self.current.parameters, null, null);
		}
		return this;
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

}
