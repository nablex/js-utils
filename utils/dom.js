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
	sanitize: function(element) {
		var allowedTags = ["a", "b", "i", "u", "em", "strong", "h1", "h2", "h3", "h4", "h5", "h6", "h7", "p", "strong"];
		var allowedAttributes = ["style"];
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
	
		var removeAttributes = function (element) {
			for( var i = element.attributes.length - 1; i >= 0; i-- ) {
				element.removeAttribute(element.attributes[i].name);
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
							var insertRef = child;
							for (var j = child.childNodes.length - 1; j >= 0; j--) {
								insertRef = element.insertBefore(child.childNodes[j], insertRef);
							}
							element.removeChild(child);
						}
						else if (element.childNodes[i].innerHTML.trim() == "") {
							element.removeChild(element.childNodes[i]);
						}
					}
				}
			}
		}

		var template = document.createElement("div");
		template.appendChild(element);
		recursiveStrip(template);
		return returnAsString ? template.innerHTML : template;
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
		}
		
		if (elementAcceptor(element)) {
			var css = nabu.utils.elements.css(element, rules);
			var result = "";
			for (var i = 0; i < css.length; i++) {
				if (result != "") {
					result += ";"
				}
				result += css[i].replace(/.*\{[\s]*(.*)[\s]*\}.*/, "$1");
			}
			element.setAttribute("style", result);
		}
		
		if (recursive) {
			var child = nabu.utils.elements.first(element);
			while (child) {
				nabu.utils.elements.inlineCss(child, recursive, media, elementAcceptor, rules);
				child = nabu.utils.elements.next(child);
			}
		}
	},
	cssRules: function(media) {
		var result = [];
		var sheets = document.styleSheets;
		for (var l = 0; l < sheets.length; l++) {
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