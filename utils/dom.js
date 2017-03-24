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
	clean: function(element, allowedTags, tagsToRemove) {
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
					if (tagsToRemove.indexOf(element.childNodes[i].nodeName.toLowerCase()) >= 0) {
						element.removeChild(element.childNodes[i]);
					}
					else {
						recursiveStrip(element.childNodes[i]);
						if (allowedTags.indexOf(element.childNodes[i].nodeName.toLowerCase()) < 0) {
							var child = element.childNodes[i];
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
	}
};
