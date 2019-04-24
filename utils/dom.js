if (!nabu) { nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.utils.elements = {
	first: function(element) {
		if (element.firstChild) {
			var child = element.firstChild;
			while (child) {
				if (child.nodeType === 1) {
					return child;
				}
				child = child.nextSibling;
			}
		}
		return null;
	},
	next: function(element) {
		if (element.nextSibling) {
			var sibling = element.nextSibling;
			while (sibling) {
				if (sibling.nodeType === 1) {
					return sibling;
				}
				sibling = sibling.nextSibling;
			}
		}
		return null;
	},
	previous: function(element) {
		if (element.previousSibling) {
			var sibling = element.previousSibling;
			while (sibling) {
				if (sibling.nodeType === 1) {
					return sibling;
				}
				sibling = sibling.previousSibling;
			}
		}
		return null;
	},
	clear: function(element) {
		while(element.firstChild) {
			element.removeChild(element.firstChild);
		}
	},
	inViewport: function(element) {
		var rect = element.getBoundingClientRect();
		return rect.top >= 0
			&& rect.left >= 0
			&& rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
			&& rect.right <= (window.innerWidth || document.documentElement.clientWidth);
	},
	sanitize: function(element) {
		var allowedTags = ["a", "b", "i", "u", "em", "strong", "h1", "h2", "h3", "h4", "h5", "h6", "h7", "p", "table", "ul", 
			"li", "tr", "td", "thead", "tbody", "th", "ol", "font", "br", "span", "div"];
		var allowedAttributes = ["style", "href", "target", "rel"];
		return nabu.utils.elements.clean(element, allowedTags, null, allowedAttributes);
	},
	clean: function(element, allowedTags, tagsToRemove, allowedAttributes, attributesToRemove) {
		var returnAsString = false;
		if (typeof(element) == "string") {
			returnAsString = true;
			var div = document.createElement("div");
			div.innerHTML = element;
			element = div;
		}
	
		var removeAttributes = function (child) {
			if (allowedAttributes || attributesToRemove) {
				for (var j = child.attributes.length - 1; j >= 0; j--) {
					var attr = child.attributes.item(j);
					if (allowedAttributes && allowedAttributes.indexOf(attr.name) < 0) {
						child.removeAttribute(attr.name);
					}
					else if (attributesToRemove && attributesToRemove.indexOf(attr.name) >= 0) {
						child.removeAttribute(attr.name);
					}
				}
			}
		};

		var recursiveStrip = function (element) {
			removeAttributes(element);
			for (var i = element.childNodes.length - 1; i >= 0; i--) {
				if (element.childNodes[i].nodeType == 1) {
					if (tagsToRemove && tagsToRemove.indexOf(element.childNodes[i].nodeName.toLowerCase()) >= 0) {
						element.removeChild(element.childNodes[i]);
					}
					else {
						recursiveStrip(element.childNodes[i]);
						if (!allowedTags || allowedTags.indexOf(element.childNodes[i].nodeName.toLowerCase()) < 0) {
							var child = element.childNodes[i];
							var insertRef = child;
							for (var j = child.childNodes.length - 1; j >= 0; j--) {
								insertRef = element.insertBefore(child.childNodes[j], insertRef);
							}
							element.removeChild(child);
						}
					}
				}
			}
		}

		var template = document.createElement("div");
		if (typeof(element) == "object" && element.nodeType === 1) {
			template.appendChild(element);
		}
		else {
			template.innerHTML = element;
		}
		recursiveStrip(template);
		return returnAsString ? element.innerHTML : template;
	},
	inlineCss: function(element, recursive, media, elementAcceptor, rules) {
		if (!elementAcceptor) {
			elementAcceptor = function(x) {
				var tagName = x.tagName.toLowerCase();
				var blacklist = ["br", "strong", "i", "b", "u", "hr", "center"];
				return blacklist.indexOf(tagName) < 0;
			}
		}
		/*// https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration
		var style = window.getComputedStyle(element, null);
		// the "style" object also has a length & item() method where you can loop over all the properties
		// however, this is currently not supported in server side rendering and in the browser it lists _everything_
		// this leads to extremely bloated inline css, it is better to target a number of properties
		var result = "";
		for (var i = 0; i < properties.length; i++) {
			if (result != "") {
				result += ";"
			}
			result += properties[i] + ":" + style.getPropertyValue(properties[i]);
		}
		element.setAttribute("test", result.replace("\"", "'"));*/
		
		if (!rules) {
			rules = nabu.utils.elements.cssRules(media);
			// we want to split the rules up, if you have a rule with a "," in the selector, make multiple rules out of it
			// this prevents us from matching a rule to an element but not knowing which part actually made the match
			// and thus not being able to deduce how specific the rule is
			if (true) {
				var splitRules = [];
				rules.forEach(function(rule) {
					rule.selectorText.split(/[\\s]*,[\\s]*/g).forEach(function(part) {
						if (part.trim()) {
							splitRules.push({
								selectorText: part,
								cssText: rule.cssText
							});
						}
					});
				});
				rules = splitRules;
			}
		}

		var maxLength = function(selector) {
			var max = 0;
			var parts = selector.split(/[\s]*,[\s]*/);
			for (var i = 0; i < parts.length; i++) {
				if (parts[i].length > max) {
					max = parts[i].length;
				}
			}
			return max;
		}
		var inlineAll = function() {
			var elements = [];
			var applied = [];
			rules.forEach(function(rule) {
				try {
					var nodeList = document.body.querySelectorAll(rule.selectorText);
					for (var i = 0; i < nodeList.length; i++) {
						// basic check to see if we are dealing with a node
						if (nodeList.item(i).nodeType == 1 && nodeList.item(i).hasAttribute && !nodeList.item(i).hasAttribute("original-style")) {
							var index = elements.indexOf(nodeList.item(i));
							if (index < 0) {
								index = elements.length;
								elements.push(nodeList.item(i));
								applied.push([]);
							}
							applied[index].push({selectorText: rule.selectorText, cssText: rule.cssText});
						}
					}
				}
				catch (exception) {
					console.info("Failed to run selector", rule.selectorText, exception);
				}
			});
			elements.forEach(function(element, index) {
				if (element.hasAttribute) {
					// make sure rules are in proper order
					applied[index].sort(function(a, b) {
						return maxLength(a.selectorText) - maxLength(b.selectorText);
					});
					var result = "";
					for (var i = 0; i < applied[index].length; i++) {
						if (result != "") {
							result += ";"
						}
						result += applied[index][i].cssText.replace(/.*\{[\s]*(.*)[\s]*\}.*/, "$1");
					}
					if (!element.hasAttribute("original-style")) {
						element.setAttribute("original-style", element.getAttribute("style") ? element.getAttribute("style") : " ");
					}
					element.setAttribute("style", element.getAttribute("original-style") + ";" + result);
				}
				else {
					console.log("skipping", typeof(element), element);
				}
			});
		};
		
		if (true) {
			inlineAll();
		}
		else if (elementAcceptor(element)) {
			var css = nabu.utils.elements.css(element, rules);
			var result = "";
			for (var i = 0; i < css.length; i++) {
				if (result != "") {
					result += ";"
				}
				result += css[i].replace(/.*\{[\s]*(.*)[\s]*\}.*/, "$1");
			}
			if (!element.hasAttribute("original-style")) {
				element.setAttribute("original-style", element.getAttribute("style") ? element.getAttribute("style") : " ");
			}
			element.setAttribute("style", element.getAttribute("original-style") + ";" + result);
		}
		
		if (false && recursive) {
			var child = nabu.utils.elements.first(element);
			while (child) {
				// skip children that are already done
				if (!child.hasAttribute("original-style")) {
					nabu.utils.elements.inlineCss(child, recursive, media, elementAcceptor, rules);
				}
				child = nabu.utils.elements.next(child);
			}
		}
	},
	cssRules: function(media) {
		var result = [];
		var sheets = document.styleSheets;
		for (var l = 0; l < sheets.length; l++) {
			try {
				var rules = sheets.item(l).rules || sheets.item(l).cssRules;
				for (var i = 0; i < rules.length; i++) {
					var rule = rules.item(i);
					if (media && rule.media) {
						var isCorrectMedia = false;
						for (var j = 0; j < rule.media.length; j++) {
							if (rule.media.item(j).toString() == media) {
								isCorrectMedia = true;
								break;
							}
						}
						if (isCorrectMedia) {
							// in new browsers, there is support for getting the rules inside the media
							var mediaRules = rule.rules || rule.cssRules;
							// otherwise we cheat
							if (!mediaRules) {
								var style = document.createElement("style");
								style.setAttribute("type", "text/css");
		//						style.appendChild(document.createTextNode(rule.cssText.replace(/@media.*?\{(.*)\}[\s]*/, "$1")));
								style.innerHTML = rule.cssText.replace(/@media.*?\{[\s]*(.*)[\s]*\}[\s]*/, "$1");
								document.head.appendChild(style);
								mediaRules = document.styleSheets[document.styleSheets.length - 1].cssRules;
								document.head.removeChild(style);
							}
							if (mediaRules) {
								for (var k = 0; k < mediaRules.length; k++) {
									if (mediaRules.item(k).selectorText) {
										result.push(mediaRules.item(k));
									}
								}
							}
						}
					}
					else if (!media) {
						if (rule.selectorText) {
							result.push(rule);
						}
					}
				}
			}
			catch(exception) {
				// ignore
			}
		}
		return result;
	},
	css: function(element, rules) {
		var result = [];
		var matches = element.matches || element.webkitMatchesSelector || element.mozMatchesSelector  || element.msMatchesSelector || element.oMatchesSelector;
		if (matches) {
			for (var i = rules.length - 1; i >= 0; i--) {
				try {
					if (matches.call(element, rules[i].selectorText)) {
						result.push({ selector: rules[i].selectorText, rule: rules[i].cssText});
					}
				}
				catch(e) {
					// we delete the rule, so we don't retry it
					rules.splice(i, 1);
				}
			}
		}
		var maxLength = function(selector) {
			var max = 0;
			var parts = selector.split(/[\s]*,[\s]*/);
			for (var i = 0; i < parts.length; i++) {
				if (matches.call(element, parts[i]) && parts[i].length > max) {
					max = parts[i].length;
				}
			}
			return max;
		}
		// we sort from least specific to most specific so if we print them out, the most specific will be last and "win"
		result.sort(function(a, b) {
			return maxLength(a.selector) - maxLength(b.selector);
		});
		return result.map(function(x) { return x.rule });
	}
};