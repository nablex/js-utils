/*
This file contains a basic router that allows you to go to a state using an alias.
It has the ability to optionally bind an URL to a state with or without parameters.
On initial load it can deduce the state from the URL by using routeInitial();
Note that you can toggle the usage of hashtags.

A route can be registered using the register:

router.register({
	alias: "theAliasForTheRoute",
	enter: function(anchor, parameters, mask),
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
	this.useParents = parameters.useParents ? true : false;

	this.previousUrl = null;
	this.changingHash = false;
	this.initials = [];
	
	this.parents = [];
	this.urlRewriter = parameters.urlRewriter;
	
	window.addEventListener("popstate", function(event) {
		var state = event.state;
		var alias = state ? state.alias : null;
		var anchor = state ? state.anchor : null;
		// we want to prevent accidental hash changes from triggering a reroute
		// for a client integration they had <a> elements that updated the hashtag but this always triggered a popstate
		if (alias || !self.initials.length) {
			var initial = self.initials.pop();
			if (!alias) {
				self.routeInitial(anchor, state ? state.parameters : null, true);
			}
			else if (initial && !self.useParents) {
				self.routeAll(alias, state ? state.parameters : null, anchor, false);
			}
			else {
				self.route(alias, state ? state.parameters : null, anchor, true, false, true);
			}
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
	this.route = function(alias, parameters, anchor, mask, initial, back, ignoreParents) {
		// we do it this way to preserve backwards compatibility
		var anchorEmpty = !anchor;
		if (!anchor) {
			anchor = self.defaultAnchor;
		}
		var chosenRoute = null;
		var routes = self.sort();
		for (var i = 0; i < routes.length; i++) {
			if (routes[i].alias == alias) {
				chosenRoute = routes[i];
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
					result.anchor ? result.anchor : (anchorEmpty ? null : anchor),
					typeof(result.mask) == "undefined" ? mask : result.mask
				);
			}
		}
		
		// if we are using parents, we need the correct anchor for the chosen
		if (self.useParents && chosenRoute.parent != null && anchorEmpty) {
			var parent = self.get(chosenRoute.parent);
			if (parent && parent.defaultAnchor) {
				anchor = parent.defaultAnchor;
			}
		}
		
		var parentUrl = null;
		var parentEnter = null;
		// TODO: allow for async parents by having the routeParent return (optionally) a promise and wait on that to render the child
		// if we are in need of a parent construct for this route, build it (or reuse it)
		if (self.useParents) {
			var parentAlias = chosenRoute.parent;
			// if it is an initial route and we don't have a parent, we want to search for a generic initial skeleton (both for backwards compatibility and less explicit configuration)
			// note that if we are doing a non-masked route on a bookmarkable url (so we are about to update the url), we _force_ the existence of a parent as well
			// this to allow us to be consistent when the bookmarkable url is refreshed upon
			if (!parentAlias && (initial || (!mask && chosenRoute.url))) {
				var initialRoute = self.getInitial(anchor, parameters, mask);
				// if we are opening that route, don't use it!
				if (initialRoute && initialRoute.route.alias != alias) {
					parentAlias = initialRoute.route.alias;
				}
				// if we don't have a parent, no hard feelings, but we assume that we need to mount in the body then
				else {
					anchor = "body";
					self.parents.splice(0);
				}
			}
			if (parentAlias) {
				var routeParent = this.routeParent(parentAlias, parameters);
				var parentAnchor = routeParent.anchor;
				parentUrl = routeParent.url;
				parentEnter = routeParent.enter;
				// if we didn't specify an anchor to route in, use the parent anchor
				if (anchorEmpty) {
					anchor = parentAnchor;
				}
			}
			// if we have no explicit parent, we need to route in the currently available parent, that means _its_ default anchor (if any)
			else {
				if (anchorEmpty && self.parents.length > 0 && self.parents[self.parents.length - 1].defaultAnchor) {
					anchor = self.parents[self.parents.length - 1].defaultAnchor;
				}
				// if we have no noteworthy parents, root in body
				else if (anchorEmpty && self.parents.length == 0) {
					anchor = "body";
				}
			}
		}
		
		// the chosen might set a spinner or some such
		// if we go for an alternative with a different parent, that could pose a problem however!
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
		
		var enterReturn = chosenRoute.enter(anchor, parameters, mask, parentEnter);
		if (self.enter != null) {
			self.enter(anchor, chosenRoute, parameters, enterReturn, mask);
		}
		// update the current URL if the state has a URL attached to it (don't update if initial, we use keep using that url)
		if (chosenRoute.url && !mask && !initial && !back && !chosenRoute.initial) {
			self.updateUrl(chosenRoute.alias, parentUrl == null ? chosenRoute.url : parentUrl.replace(/[/]+$/, "") + "/" + chosenRoute.url.replace(/^[/]+/, ""), parameters, chosenRoute.query, anchor);
		}
		// the state is already correct if initial
		else if (!initial && !back && !chosenRoute.initial) {
			self.updateState(chosenRoute.alias, parameters, chosenRoute.query, anchor);
		}
		// you have to push the initial state, apparently you need to push state twice, otherwise you don't get event.state in the popstate option
		// that would mean, if you go to a initial page, then one link deep and "back", it doesn't work...
		else if (initial) {
			self.updateState(chosenRoute.alias, parameters, chosenRoute.query, anchor);
		}
		self.initials.push(null);
		return enterReturn;
	};
	
	this.routeParent = function(alias, parameters) {
		var parentRoute = this.get(alias);
		if (!parentRoute) {
			throw "Could not find parent route: " + alias;
		}

		// parents can also make use of query parameters, however they will not be present in the "parameters" object unless the children have the same parameters
		// so in this case, if the parent requires query parameters, we explicitly get them
		// we don't merge them into the parameters object by reference but instead we merge the parameters into the query params
		if (parentRoute.query) {
			var queryParameters = self.getQueryParameters(parentRoute.query);
			nabu.utils.objects.merge(queryParameters, parameters);
			parameters = queryParameters;
		}
		
		var alreadyRouted = false;		
		// first check if we have the parent routed in the current stack
		for (var i = this.parents.length - 1; i >= 0; i--) {
			if (this.parents[i].alias == alias) {
				// remove the other parents after this
				if (i < this.parents.length - 1) {
					this.parents.splice(i + 1);
				}
				alreadyRouted = true;
				break;
			}
		}
		
		var parentEnter = null;
		
		
		var calculateUrl = function() {
			// check if we have a parent with its own rendered url, this will already incorporate the urls from its parent so should be fine
			for (var i = self.parents.length - 1; i >= 0; i--) {
				if (self.parents[i].renderedUrl) {
					return self.parents[i].renderedUrl;
				}
			}
			return null;
		}
		var url = calculateUrl();
		
		// if we have a parent route with a url, check that it still matches the current parent that is routed, otherwise we may have to remove it
		// for example if you have a parent url with an id in it, if the id changes the parent has to be rerendered
		if (parentRoute.url && !parentRoute.initial) {
			var renderedUrl = this.localizeUrl(this.templateUrl(parentRoute.url, parameters, parentRoute.query));
			// "unroute" so to speak
			if (alreadyRouted && renderedUrl != url) {
				this.parents.splice(this.parents.length - 1, 1);
				alreadyRouted = false;
				
				// recalculate the url, we bumped a parent
				url = calculateUrl();
			}
		}
		
		// this particular parent is not yet routed, check if it itself has a parent
		if (!alreadyRouted) {
			// if we have no parent, we are assumed to route in the body
			var anchor = parentRoute.parent != null ? self.routeParent(parentRoute.parent, parameters).anchor : "body";
			if (anchor == "body") {
				// clear all the parents, we are starting over
				self.parents.splice(0);
			}
			try {
				// always mask parent routes
				parentEnter = parentRoute.enter(anchor, parameters, true);
				// TODO: might need to differentiate if we want the same parent but with different parameters!
				
				// we have a url, do some cloning shizzle...?
				if (parentRoute.url && !parentRoute.initial) {
					parentRoute = nabu.utils.objects.clone(parentRoute);
					// the template is always global, relocalize it for this purpose...
					var renderedUrl = this.localizeUrl(this.templateUrl(parentRoute.url, parameters, parentRoute.query));
					if (url != null) {
						url = url.replace(/[/]+$/, "") + "/" + renderedUrl.replace(/^[/]+/, "");
					}
					else {
						url = renderedUrl;
					}
					parentRoute.renderedUrl = url;
				}
				self.parents.push(parentRoute);
			}
			catch (exception) {
				if (anchor != "body" && !document.querySelector("#" + anchor)) {
					console.log("The anchor '" + anchor + "' is unavailable for routing parent '" + parentRoute.alias + "', parents can currently not be nested in asynchronous grandparents, check if parent '" + parentRoute.parent + "' has an asynchronous action");
				}
				throw exception;
			}
		}
		
		// because we are routing new content, whatever parents were routed in the "default" tag of the current parent will be overwritten on route
		return {
			anchor: parentRoute.defaultAnchor ? parentRoute.defaultAnchor : self.defaultAnchor,
			url : url,
			enter: parentEnter
		}
	};
	
	this.template = function(alias, parameters) {
		var route = this.findByAlias(alias, parameters, null, false);
		if (self.useParents) {
			var url = null;
			var routeToCheck = route;
			while (routeToCheck) {
				if (routeToCheck.url) {
					url = routeToCheck.url + (url == null ? "" : "/" + url);
				}
				if (routeToCheck.parent) {
					routeToCheck = self.get(routeToCheck.parent);
				}
				else {
					break;
				}
			}
			return url ? this.templateUrl(url, parameters, route.query) : null;
		}
		else {
			return route && route.url ? this.templateUrl(route.url, parameters, route.query) : null;
		}
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
			url = url.replace(new RegExp("{[\s]*" + key.replace("$", "\\$") + "[\s]*:[^}]+}"), parameters[key]).replace(new RegExp("{[\s]*" + key.replace("$", "\\$") + "[\s]*}"), parameters[key]);
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
		if (this.urlRewriter && this.urlRewriter.outgoing) {
			url = this.urlRewriter.outgoing(url);
		}
		// replace any straggling variables with the key word "default"
		url = url.replace(/\{[^}]+}/, "default");
		return self.useHash && url.substring(0, 1) != "#" ? "#" + url : (application && application.configuration ? application.configuration.root : "/") + url.replace(/^[/]+/, "");
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

	this.getPath = function() {
		var path = null;
		if (self.useHash) {
			path = window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/";
		}
		else {
			path = self.localizeUrl(window.location.pathname ? window.location.pathname : "/");
		}
		if (!path) {
			path = "/";
		}
		if (this.urlRewriter && this.urlRewriter.incoming) {
			path = this.urlRewriter.incoming(path);
		}
		return path;
	}
	
	// the query should be an array of string
	this.getQueryParameters = function(query) {
		var path = this.getPath();
		var queryIndex = path.indexOf("?");
		var queryParameters = queryIndex >= 0 ? path.substring(queryIndex) : window.location.search;
		var parts = queryParameters.substring(1).split("&");
		var parameters = {};
		for (var j = 0; j < parts.length; j++) {
			var index = parts[j].indexOf("=");
			var key = null, value = null;
			if (index >= 0) {
				key = decodeURIComponent(parts[j].substring(0, index));
				value = decodeURIComponent(parts[j].substring(index + 1));
			}
			else {
				key = decodeURIComponent(parts[j]);
				value = null;
			}
			var values = parts[j].split("=");
			if (query.indexOf(key) >= 0) {
				if (parameters[key] != null) {
					if (!(parameters[key] instanceof Array)) {
						parameters[key] = [parameters[key]];
					}
					parameters[key].push(value);
				}
				else {
					parameters[key] = value;
				}
			}
		}
		return parameters;
	}

	this.findRoute = function(path, initial) {
		if (!path) {
			path = "/";
		}
		if (this.urlRewriter && this.urlRewriter.incoming) {
			path = this.urlRewriter.incoming(path);
		}
		var chosenRoute = null;
		var parameters = {};
		var queryIndex = path.indexOf("?");
		var queryParameters = queryIndex >= 0 ? path.substring(queryIndex) : window.location.search;
		if (queryIndex >= 0) {
			path = path.substring(0, queryIndex);
		}
		// we strip trailing slashes
		path = path.replace(/[/]+$/, "");
		if (path == "") {
			path = "/";
		}
		var routes = this.sort();
		for (var i = 0; i < routes.length; i++) {
			if (routes[i].url && ((!initial && !routes[i].initial) || (initial && routes[i].initial))) {
				var urls = routes[i].url instanceof Array ? routes[i].url : [routes[i].url];
				var found = false;
				
				var parentUrl = null;
				// we resolve the parent url which should be prepended if available
				if (this.useParents && routes[i].parent) {
					var tmp = routes[i];
					while (tmp && tmp.parent) {
						tmp = routes.filter(function(x) {
							return x.alias == tmp.parent;
						})[0];
						if (tmp && tmp.url) {
							parentUrl = parentUrl == null ? tmp.url : tmp.url.replace(/[/]+$/, "") + "/" + parentUrl.replace(/^[/]+/, "");
						}
					}
				}
				
				for (var k = 0; k < urls.length; k++) {
					var urlToMatch = urls[k];
					if (parentUrl != null) {
						urlToMatch = parentUrl.replace(/[/]+$/, "") + "/" + urlToMatch.replace(/^[/]+/, "")
					}
					var template = "^" + urlToMatch.replace(/\{[\s]*[^}:]+[\s]*:[\s]*([^}]+)[\s]*\}/g, "($1)").replace(/\{[\s]*[^}]+[\s]*\}/g, "([^/]+)") + "$";
					var matches = path.match(template);
					if (matches) {
						var variables = urlToMatch.match(template);
						if (!variables) {
							throw "Could not extract variables from: " + urlToMatch;
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
								var index = parts[j].indexOf("=");
								var key = null, value = null;
								if (index >= 0) {
									key = decodeURIComponent(parts[j].substring(0, index));
									value = decodeURIComponent(parts[j].substring(index + 1));
								}
								else {
									key = decodeURIComponent(parts[j]);
									value = null;
								}
								var values = parts[j].split("=");
								if (chosenRoute.query.indexOf(key) >= 0) {
									if (parameters[key] != null) {
										if (!(parameters[key] instanceof Array)) {
											parameters[key] = [parameters[key]];
										}
										parameters[key].push(value);
									}
									else {
										parameters[key] = value;
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
		var root = (application && application.configuration && application.configuration.root ? application.configuration.root : "/");
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
	
	this.getInitial = function(anchor, parameters, mask) {
		var initial = null;
		// check for initial route to build framework around data
		if (self.useHash) {
			initial = self.findRoute(window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/", true);
		}
		else {
			initial = self.findRoute(self.localizeUrl(window.location.pathname ? window.location.pathname : "/"), true);
		}
		return initial;
	};

	this.routeInitial = function(anchor, parameters, mask) {
		var current = null;
		// check for actual data route
		if (self.useHash) {
			current = self.findRoute(window.location.hash && window.location.hash.length > 1 ? window.location.hash.substring(1) : "/");
		}
		else {
			current = self.findRoute(self.localizeUrl(window.location.pathname ? window.location.pathname : "/"));
		}
		if (self.useParents) {
			return self.route(current ? current.route.alias : "unknown", current ? current.parameters : parameters, anchor, mask, true);
		}
		else {
			var initial = self.getInitial(anchor, parameters, mask);
			return self.routePage(initial, current, parameters, anchor, mask);
		}
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
						throw "Could not find initial route: " + result.alias;
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

