if (!nabu) { var nabu = {} };
if (!nabu.formatters) { nabu.formatters = {} };

nabu.formatters.markdown = {
	// each provider should be able to generate html from a syntax
	syntaxProviders: {
		// needs some very specific handling
		xml: function(content, parameters) {
			var result = "";
			var index = 0;
			while (index >= 0) {
				index = content.indexOf("<");
				// we have some other content at the start
				if (index > 0) {
					result += content.substring(0, index);
					content = content.substring(index);
					// it is now at the front
					index = 0;
				}
				if (index == 0) {
					// we are now in a tag, let's get the start of the tag and mark it as a variable
					var match = content.match(/^[^\s>]+/);
					result += "<span class='is-code-variable'>" + nabu.formatters.markdown.formatTextAsHtml(match[0]) + "</span>";
					content = content.substring(match[0].length);
					// let's see where the end is
					var end = content.indexOf(">");
					// we have stuff between our tag and the end
					if (end > 0) {
						var tagContent = content.substring(0, end);
						content = content.substring(end);
						end = 0;
						var strings = nabu.formatters.markdown.encodeStrings(tagContent);
						tagContent = strings.content;
						tagContent = tagContent.replace(/\b([\w]+[\s]*)=/g, "<span class='is-code-keyword'>$1=</span>")
						result += nabu.formatters.markdown.decodeStrings(tagContent, strings);
					}
					// fix the end tag
					if (end == 0) {
						result += "<span class='is-code-variable'>" + nabu.formatters.markdown.formatTextAsHtml(">") + "</span>";
						content = content.substring(1);
					}
				}
			}
			return result;
		},
		html: "xml",
		css: function(content, parameters) {
			return nabu.formatters.markdown.encodeCode(
				content, 
				null, 
				/\/\*.*\*\//s, 
				/\b(:[\w]+)[\s]*\(/g,
				/(\.[a-zA-Z]+[\w-]*)\b/g,
				nabu.formatters.markdown.keywords.css,
				parameters
			)
		},
		scss: function(content, parameters) {
			var keywords = ["@mixin", "@include"];
			nabu.utils.arrays.merge(keywords, nabu.formatters.markdown.keywords.css);
			return nabu.formatters.markdown.encodeCode(
				content, 
				/\/\/.*$/m, 
				/\/\*.*\*\//s, 
				/\b([:\w]+)[\s]*\(/g,
				/((?:\$|\.)[a-zA-Z]+[\w-]*)\b/g,
				keywords,
				parameters
			)
		},
		sql: function(content, parameters) {
			return nabu.formatters.markdown.encodeCode(
				content, 
				/--.*$/m, 
				null, 
				/\b([\w.]+)\(/g,
				null,
				nabu.formatters.markdown.keywords.sql,
				parameters
			)
		},
		glue: function(content, parameters) {
			return nabu.formatters.markdown.encodeCode(
				content, 
				/#.*$/m, 
				null, 
				/\b([\w.]+)\(/g,
				null,
				nabu.formatters.markdown.keywords.default,
				parameters
			)
		},
		python: "glue",
		java: function(content, parameters) {
			return nabu.formatters.markdown.encodeCode(
				content, 
				/\/\/.*$/m, 
				/\/\*.*\*\//s, 
				/\b([\w]+)\(/g,
				null,
				nabu.formatters.markdown.keywords.default,
				parameters
			)
		},
		javascript: "java",
		json: "java",
		text: function(content, parameters) {
			return nabu.formatters.markdown.formatTextAsHtml(content, true);
		}
	},
	keywords: {
		css: ["!default", "!important", "@media"],
		sql: ["select", "update", "delete", "insert", "create", "drop", "from", "where", "order by", "group by", "limit", "offset", "table", "index", "and", "or", "current_timestamp"],
		default: ["abstract", "continue", "for", "new", "switch", "assert", "default", "goto", "package", "synchronized", "boolean", "do", "if", "private", "this", "break", "double", "implements", "protected", "throw", "byte", "else", "import", "public", "throws", "case", "enum", "instanceof", "return", "transient", "catch",
			"extends", "int", "short", "try", "char", "final", "interface", "static", "void", "class", "finally", "long", "strictfp", "volatile", "const", "float", "native", "super", "while", "true", "false"]
	},
	encodeCode: function(content, singleLineRegex, multiLineRegex, methodRegex, variableRegex, keywords, parameters) {
		// we assume the prevalence of strings in comments is less than comments in strings...?
		var strings = nabu.formatters.markdown.encodeStrings(
			content
		);
		content = strings.content;
		
		var comments = nabu.formatters.markdown.encodeComments(
			content,
			singleLineRegex, 
			multiLineRegex
		);
		content = comments.content;

		// already do basic encoding before we generate html
		content = nabu.formatters.markdown.formatTextAsHtml(content, true);
				
		// keywords
		if (keywords && keywords.length) {
			content = content.replaceAll(new RegExp("(?:\\b|\\B)(" + keywords.join("|") + ")(?:\\b|\\B)", "g"), "<span class='is-code-keyword'>$1</span>");
		}

		// methods
		content = content.replaceAll(methodRegex, "<span class='is-code-method'>$1</span>(");

		// variables
		content = content.replaceAll(variableRegex, "<span class='is-code-variable'>$1</span>");
		
		content = nabu.formatters.markdown.decodeComments(content, comments);
		content = nabu.formatters.markdown.decodeStrings(content, strings);
		return content;
	},
	asHtml: function(blocks, parameters) {
		var html = [];
		// we used named promises with an id so we can inject the resolved value
		var promises = {};
		// the current list stack (can be mixture of ul and ol)
		var listStack = [];
		var reduceList = function(amount) {
			for (var i = (amount ? amount : listStack.length) - 1; i >= 0; i--) {
				var includeTrailing = listStack.length >= 2;
				// a nested list must be within a <li> itself!
				html.push("</" + listStack.pop() + ">" + (includeTrailing ? "</li>" : ""));
			}
		}
		var pushList = function(tag) {
			// a nested list must be within a <li> itself!
			html.push((listStack.length > 0 ? "<li>" : "") + "<" + tag + " class='is-list'>");
			listStack.push(tag);
		}
		blocks.forEach(function(block) {
			// terminate any lists before continuing
			if (block.type != "ul" && block.type != "ol" && listStack.length > 0) {
				reduceList();
			}
			var formatted = [];
			// regular content
			if (["h1", "h2", "h3", "h4", "h5", "h6", "p"].indexOf(block.type) >= 0) {
				// if we have a header, inject a local anchor
				if (block.type.indexOf("h") == 0) {
					formatted.push("<a id='" + block.content.replace(/[^\w]+/g, "-").toLowerCase() + "'/>");
				}
				formatted.push(
					"<" + block.type + " class='is-" + block.type + " is-variant-article'>"
					+ nabu.formatters.markdown.formatContentAsHtml(block.content, parameters)
					+ "</" + block.type + ">"
				);
			}
			else if (block.type == "code") {
				var result = nabu.formatters.markdown.formatCodeAsHtml(block.content, block.syntax, parameters);
				// if we get back a promise, we need to resolve it asynchronously
				// we will inject a placeholder to be replaced later
				if (result.then) {
					var id = crypto ? crypto.randomUUID() : "code-" + Math.random();
					formatted.push("<code class='is-code is-variant-article' target='" + (block.syntax ? block.syntax : "text") + "' data-resolve-id='" + id + "'>");
					promises[id] = result;
				}
				else {
					formatted.push("<code class='is-code is-variant-article' target='" + (block.syntax ? block.syntax : "text") + "'>");
					formatted.push(result);
				}
				formatted.push("</code>");
			}
			else if (block.type == "quote") {
				formatted.push(
					"<blockquote class='is-quote is-variant-article'>"
					+ nabu.formatters.markdown.formatTextAsHtml(block.content, parameters)
					+ "</blockquote>"
				);
			}
			else if (block.type == "ul" || block.type == "ol") {
				// if our depth is bigger than the current list stack, we need to add some lists
				while (block.depth > listStack.length) {
					formatted.push("<ul class='is-list'>");
					listStack.push({
						tag: "ul",
						supporting: true
					});
				}
				if (block.depth < listStack.length - 1) {
					reduceList(listStack.length - (block.depth + 1));
				}
				// we need to add one more list
				if (block.depth == listStack.length) {
					pushList(block.type);
				}
				// otherwise make sure we have the correct type of list
				else if (listStack[listStack.length - 1] != block.type) {
					reduceList(1);
					pushList(block.type);
				}
				formatted.push(
					"<li>"
					+ nabu.formatters.markdown.formatContentAsHtml(block.content, parameters)
					+ "</li>"
				);
			}
			else if (block.type == "table") {
				formatted.push("<table class='is-table is-variant-article'>");
				var headers = block.rows.filter(function(x) {
					return x.header;
				});
				var body = block.rows.filter(function(x) {
					return !x.header;
				});
				if (headers.length) {
					formatted.push("<thead>");
					headers.forEach(function(header) {
						formatted.push("<tr>");
						header.columns.forEach(function(column) {
							formatted.push(
								"<th colspan='" + (column.colspan ? column.colspan : 1) + "'>"
								+ nabu.formatters.markdown.formatContentAsHtml(column.content, parameters)
								+ "</th>"
							);
						});
						formatted.push("</tr>");
					});
					formatted.push("</thead>");
				}
				if (body.length) {
					formatted.push("<tbody>");
					body.forEach(function(row) {
						formatted.push("<tr>");
						row.columns.forEach(function(column) {
							formatted.push(
								"<td colspan='" + (column.colspan ? column.colspan : 1) + "'>"
								+ nabu.formatters.markdown.formatContentAsHtml(column.content, parameters)
								+ "</td>"
							);
						});
						formatted.push("</tr>");
					});
					formatted.push("</tbody>");
				}
				formatted.push("</table>");
			}
			else if (block.type == "block") {
				// we might want to set some custom style stuff
				formatted.push("<div class='is-" + (block.direction ? block.direction : "row") + " is-variant-article'>");
				var reverseDirection = block.direction == "column" ? "row" : "column";
				var dimensionConfiguration = block.configuration.filter(function(x) {
					return x.key == "dimensions";
				})[0];
				var dimensions = dimensionConfiguration ? dimensionConfiguration.value.split(",") : [];
				block.blocks.forEach(function(block, index) {
					var style = "";
					style += "flex-basis: 0; flex-grow: " + (index < dimensions.length ? dimensions[index] : "1") + ";";
					formatted.push("<div class='is-" + reverseDirection + " is-variant-article' style='" + style + "'>");
					var resultHtml = nabu.formatters.markdown.asHtml([block], parameters);
					formatted.push(resultHtml.content);
					nabu.utils.objects.merge(promises, resultHtml.promises);
					formatted.push("</div>");
				});
				formatted.push("</div>");
			}
			nabu.utils.arrays.merge(html, formatted);
		});
		// finish any lists we were building
		while (listStack.length) {
			reduceList();
		}
		for (var i = 0; i < html.length - 1; i++) {
			// if our current element ends with </li>
			if (html[i].indexOf("</li>") == html[i].length - "</li>".length) {
				// and the next element is a supporting <li> injected for nested lists
				if (html[i + 1].indexOf("<li><ul") == 0 || html[i + 1].indexOf("<li><ol") == 0) {
					// we remove the </li> from the previous entry and the <li> from the latter entry
					html[i] = html[i].substring(0, html[i].length - "</li>".length);
					html[i + 1] = html[i + 1].substring("<li>".length);
				}
			}
		}
		return {
			content: nabu.formatters.markdown.replaceVariables(html.join("\n"), parameters),
			promises: promises
		}
	},
	replacePromises: function(promises) {
		Object.keys(promises).forEach(function(x) {
			promises[x].then(function(result) {
				var element = document.querySelector("[data-resolve-id=\"" + x + "\"]");
				if (element && result) {
					element.innerHTML = result;
				}
			})
		})
	},
	// you can use variables with the syntax ${}. this allows you to create templates
	replaceVariables: function(html, parameters) {
		if (parameters && parameters.variables) {
			Object.keys(parameters.variables).forEach(function(key) {
				html = html.replace(new RegExp("\\$\\{" + key + "\\}", "g"), parameters.variables[key]);
			});
		}
		return html;
	},
	formatTextAsHtml: function(content, includeSpaces) {
		content = content.replace(/&/g, "&amp;");
		content = content.replace(/</g, "&lt;");
		content = content.replace(/>/g, "&gt;");
		content = content.replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
		content = content.replace(/\n/g, "<br/>");
		if (includeSpaces) {
			content = content.replace(/[ ]{2}/g, "&nbsp;&nbsp;");
		}
		return content;
	},
	// interprets inline things as html
	formatContentAsHtml: function(content, parameters) {
		// we currently don't encode, this allows for inline html annotating!
		// content = nabu.formatters.markdown.formatTextAsHtml(content);

		// replace escaped with placeholders
		content = content.replace(/\\\*/g, "::escaped-asterisk::");
		content = content.replace(/\\_/g, "::escaped-underscore::");
		content = content.replace(/\\+/g, "::escaped-plus::");
		content = content.replace(/\\~/g, "::escaped-tilde::");
		content = content.replace(/\\`/g, "::escaped-backtick::");
		content = content.replace(/\\@/g, "::escaped-at::");
		content = content.replace(/\\#/g, "::escaped-hashtag::");

		// bold + italic
		content = content.replace(/\*\*\*(.*?)\*\*\*/g, "<em>$1</em>");
		// bold
		content = content.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
		content = content.replace(/__(.*?)__/g, "<b>$1</b>");
		// italic
		content = content.replace(/\*(.*?)\*/g, "<i>$1</i>");
		content = content.replace(/_(.*?)_/g, "<i>$1</i>");
		// delete
		content = content.replace(/~~(.*?)~~/g, "<del>$1</del>");
		// CUSTOM
		// add
		content = content.replace(/\+\+(.*?)\+\+/g, "<ins>$1</ins>");
		// code
		content = content.replace(/``(.*?)``/g, "<code class='is-code is-variant-inline'>$1</code>");
		content = content.replace(/`(.*?)`/g, "<code class='is-code is-variant-inline'>$1</code>");

		// CUSTOM
		// video embeds
		content = content.replace(/!!\[(.*?)\]\((.*?)\)/g, "<video alt='$1' class='is-video is-variant-article' controls frameborder='0' allowfullscreen><source src='$2'/></video>");

		// image embeds
		content = content.replace(/!\[(.*?)\]\((.*?)\)/g, "<img alt='$1' src='$2' class='is-image is-variant-article'/>");

		// external links
		content = content.replace(/\[(.*?)\]\(((?:http|https):\/\/.*?)\)/g, "<a rel='norel nofollow noopener' href='$2' class='is-link is-variant-article is-target-external'>$1</a>");

		// fragment links: point to an embedded anchor on this page
		content = content.replace(/\[(.*?)\]\((#.*?)\)/g, "<a href='" + window.location.pathname + "$2' class='is-link is-variant-article is-target-internal'>$1</a>");

		// internal links
		content = content.replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' class='is-link is-variant-article is-target-internal'>$1</a>");

		// whitespace
		content = content.replace("\t", "&nbsp;&nbsp;&nbsp;&nbsp;");
		content = content.replace("\n", "<br/>");
		
		// CUSTOM
		// tags
		if (parameters && parameters.tagUrl) {
			content = content.replace(/(^|[\s]+)#([\w/-]+)/g, "$1<a class='is-link is-variant-tag is-target-internal' href='" + parameters.tagUrl + "$2'>$2</a>");
		}
		if (parameters && parameters.userUrl) {
			content = content.replace(/(^|[\s]+)@([\w/-]+)/g, "$1<a class='is-link is-variant-user is-target-internal' href='" + parameters.userUrl + "$2'>$2</a>");
		}

		// replace escaped with placeholders
		content = content.replace(/::escaped-asterisk::/g, "*");
		content = content.replace(/::escaped-underscore::/g, "_");
		content = content.replace(/::escaped-plus::/g, "+");
		content = content.replace(/::escaped-tilde::/g, "~");
		content = content.replace(/::escaped-backtick::/g, "`");
		content = content.replace(/::escaped-at::/g, "@");
		content = content.replace(/::escaped-hashtag::/g, "#");

		return content;
	},
	encodeStrings: function(content) {
		var index = 0;
		var match = null;
		var strings = [];
		var startIndex = 0;
		while (startIndex >= 0) {
			// if we have match, find the end
			if (match != null) {
				index = content.indexOf(match, startIndex + 1);
				if (index >= 0) {
					var string = content.substring(startIndex, index + 1);
					content = content.replace(string, "::encoded-string-" + strings.length + "::");
					strings.push(string);
					match = null;
				}
				else {
					break;
				}
			}
			// if we don't have a match anymore, find the next string
			if (match == null) {
				var singleIndex = content.indexOf("'");
				var doubleIndex = content.indexOf("\"");
				if ((singleIndex >= 0 && doubleIndex >= 0 && singleIndex < doubleIndex) || (singleIndex >= 0 && doubleIndex < 0)) {
					match = "'";
					startIndex = singleIndex;
				}
				else if ((singleIndex >= 0 && doubleIndex >= 0 && singleIndex > doubleIndex) || (singleIndex < 0 && doubleIndex >= 0)) {
					match = "\"";
					startIndex = doubleIndex;
				}
				else {
					startIndex = -1;
				}
			}
		}
		return {
			strings: strings,
			content: content
		}
	},
	decodeStrings: function(content, strings) {
		strings.strings.forEach(function(string, index) {
			content = content.replace("::encoded-string-" + index + "::", "<span class='is-code-string'>" + nabu.formatters.markdown.formatTextAsHtml(string) + "</span>");
		});
		return content;
	},
	encodeComments: function(content, singleLineRegex, multiLineRegex) {
		// we want to preprocess comments and strings, we don't want to accidently highlight stuff in there
		// multiline comments
		var multilineComments = [];
		if (multiLineRegex) {
			while (content.match(multiLineRegex)) {
				var comment = content.match(multiLineRegex)[0];
				content = content.replace(comment, "::encoded-multi-comment-" + multilineComments.length + "::");
				multilineComments.push(comment);
			}
		}
		
		var singlelineComments = [];
		if (singleLineRegex) {
			while (content.match(singleLineRegex)) {
				var comment = content.match(singleLineRegex)[0];
				content = content.replace(comment, "::encoded-single-comment-" + singlelineComments.length + "::");
				singlelineComments.push(comment);
			}
		}
		return {
			single: singlelineComments,
			multi: multilineComments,
			content: content
		}
	},
	decodeComments: function(content, comments) {
		comments.single.forEach(function(comment, index) {
			content = content.replace("::encoded-single-comment-" + index + "::", "<span class='is-code-comment is-variant-single'>" + nabu.formatters.markdown.formatTextAsHtml(comment) + "</span>");
		});
		comments.multi.forEach(function(comment, index) {
			content = content.replace("::encoded-multi-comment-" + index + "::", "<span class='is-code-comment is-variant-multi'>" + nabu.formatters.markdown.formatTextAsHtml(comment) + "</span>");
		});
		return content;
	},
	formatCodeAsHtml: function(content, syntax, parameters) {
		if (!syntax || !nabu.formatters.markdown.syntaxProviders[syntax]) {
			syntax = "text";
		}
		while (typeof(syntax) == "string" || syntax instanceof String) {
			syntax = nabu.formatters.markdown.syntaxProviders[syntax];
		}
		return syntax(content, parameters);
	},
	parse: function(content, parameters) {
		// if you pass in an element
		if (content.innerHTML) {
			content = content.innerHTML;
		}
		// we are working line based
		var lines = content.split(/\n/);
		
		// we have "block" elements like paragraph that can contain multiple lines
		// and we have "line" element like header which can only contain one line
		// the parse methods groups the lines into elements and annotates them
		var blocks = [];
		var currentBlock = null;
		// the current block wrapper
		var blockWrapper = null;
		var finalizeBlock = function() {
			if (currentBlock) {
				blocks.push(currentBlock);
				currentBlock = null;
			}
		}
		var lineBlock = function(parameters) {
			// finalize what we were working on
			finalizeBlock();
			blocks.push(parameters);
		}
		var pushBlock = function(parameters, force) {
			// there is a block of a different type ongoing
			if (currentBlock && (currentBlock.type != parameters.type || force)) {
				finalizeBlock();
				currentBlock = parameters;
			}
			else if (currentBlock && currentBlock.content == null) {
				currentBlock.content = content;
			}
			// there is a block of the same type ongoing, append this
			else if (currentBlock) {
				currentBlock.content += "\n" + parameters.content;
			}
			// set as new block
			else {
				currentBlock = parameters;
			}
		}
		// simply add content to the current block
		var pushContent = function(content) {
			// if we have no block, start a paragraph
			if (!currentBlock) {
				currentBlock = {
					type: "p",
					content: content
				}
			}
			else if (currentBlock.content == null) {
				currentBlock.content = content;
			}
			else {
				currentBlock.content += "\n" + content;
			}
		}
		// you can assign a function if you want to prevent parsing
		// this can be useful for example when you have a code block
		var parseEvaluator = null;
		for (var i = 0; i < lines.length; i++) {
			var line = lines[i].trim();
			var parseLine = true;
			// if we are for example in a code block, we don't interpret the content, this is for later processing
			if (parseEvaluator) {
				parseLine = parseEvaluator(line, lines[i]);
			}
			if (!parseLine) {
				continue;
			}
			// empty lines serve to delineate block elements, so if we are in a block element, close it
			// of we are in a line element, we do nothing, it is just visual demarcation
			else if (line.length == 0) {
				finalizeBlock();
			}
			// we have content
			else {
				// headers
				if (line.indexOf("######") == 0) {
					lineBlock({
						type: "h6",
						content: line.substring("######".length).trim()
					})
				}
				else if (line.indexOf("#####") == 0) {
					lineBlock({
						type: "h5",
						content: line.substring("#####".length).trim()
					})
				}
				else if (line.indexOf("####") == 0) {
					lineBlock({
						type: "h4",
						content: line.substring("####".length).trim()
					})
				}
				else if (line.indexOf("###") == 0) {
					lineBlock({
						type: "h3",
						content: line.substring("###".length).trim()
					})
				}
				else if (line.indexOf("##") == 0) {
					lineBlock({
						type: "h2",
						content: line.substring("##".length).trim()
					})
				}
				else if (line.indexOf("#") == 0) {
					lineBlock({
						type: "h1",
						content: line.substring("#".length).trim()
					})
				}

				// quote
				else if (line.indexOf(">") == 0) {
					pushBlock({
						type: "quote",
						content: line.substring(">".length).trim()
					})
				}

				// uber code block that can contain (unparsed) other code blocks
				else if (line.indexOf("````") == 0) {
					var syntax = line.substring("````".length).trim();
					pushBlock({
						type: "code",
						syntax: syntax.length > 0 ? syntax : null
					});
					parseEvaluator = function(content, raw) {
						// if we have the end of the code block, stop the parse evaluator
						if (content == "````") {
							finalizeBlock();
							parseEvaluator = null;
						}
						// otherwise, just append it
						else {
							pushContent(raw);
						}
					}
				}
				// regular code block
				else if (line.indexOf("```") == 0) {
					var syntax = line.substring("```".length).trim();
					pushBlock({
						type: "code",
						syntax: syntax.length > 0 ? syntax : null
					});
					parseEvaluator = function(content, raw) {
						// if we have the end of the code block, stop the parse evaluator
						if (content == "```") {
							finalizeBlock();
							parseEvaluator = null;
						}
						// otherwise, just append it
						else {
							pushContent(raw);
						}
					}
				}

				// CUSTOM
				// a way to nest blocks, to create more complex layouts
				// the amount of -- can be used to nest blocks, each start and end are matched
				// you can use > to create column layouts and ^ to create row layouts
				// so for instance content between two -> is grouped in a block marked as a column layout
				// you can nest further with for instance --> to create a nested block with column layout or --^ to create a nested block with row layout
				// combine this with say images or videos or stuff like that to create prettier layouts
				// you can add configuration to do slightly more dynamic layouting, for example:
				// -> 1,2
				// <-
				// the default configuration for columns is "dimensions" so this is basically the flex dimension of each child (any additional children have 1)
				// so in this example we want the first child to take up 1/3 of the width and the second to take up 2/3
				else if (line.match(/^[-]+(>|\^).*/)) {
					var configuration = line.replace(/^[-]+(?:>|\^)(.*)/, "$1").trim();
					line = line.replace(/^([-]+(?:>|\^)).*/, "$1").trim();
					var depth = line.length - line.replace(/^[-]+/, "").length;
					var direction = line.indexOf(">") > 0 ? "row" : "column";
					console.log("starting block", line);
					// finalize whatever block we were working on
					if (currentBlock && currentBlock.type != "block") {
						finalizeBlock();
					}
					var parent = {
						blockWrapper: blockWrapper,
						blocks: blocks,
						parseEvaluator: parseEvaluator
					}
					blockWrapper = {
						configuration: [],
						parent: parent,
						type: "block",
						direction: direction,
						depth: depth,
						blocks: []
					}
					if (configuration) {
						configuration.split(";").forEach(function(single) {
							var index = single.indexOf("=");
							var key = index > 0 ? single.substring(0, index) : null;
							var value = index > 0 ? single.substring(index + 1) : single;
							// the default configuration is "dimensions" where you can state (in flex terminology) how big something is (default is 1)
							blockWrapper.configuration.push({
								key: key == null ? "dimensions" : key,
								value: value
							})
						});
					}
					// make sure we push it to the parent blocks as well
					blocks.push(blockWrapper);
					blocks = blockWrapper.blocks;
				}
				else if (line.match(/^(<|\^)[-]+$/)) {
					var depth = line.length - line.replace(/[-]+$/, "").length;
					var direction = line.indexOf("<") == 0 ? "row" : "column";
					console.log("stopping block", line, blockWrapper, direction, depth);
					// we are finishing the current block
					if (blockWrapper && blockWrapper.direction == direction && blockWrapper.depth == depth) {
						console.log("actually stopping!");
						// inherit from potentially parent nested
						var parent = blockWrapper.parent;
						blockWrapper.parent = null;
						delete blockWrapper.parent;
						finalizeBlock();
						parseEvaluator = parent.parseEvaluator;
						blocks = parent.blocks;
						blockWrapper = parent.blockWrapper;
					}
				}

				// line, can be used for page break or the like
				else if (line == "---" || line == "___" || line == "***") {
					pushBlock({
						type: "hr"
					})
				}

				// unordered list
				else if (line.indexOf("-") == 0 || line.indexOf("+") == 0 || line.indexOf("*") == 0) {
					pushBlock({
						type: "ul",
						// the depth of the list is determined by the amount of whitespace in front of it
						depth: lines[i].indexOf(line.substring(0, 1)),
						content: line.substring(1).trim()
					}, true)
				}

				// ordered list
				else if (line.match(/^[0-9]+\..*/)) {
					pushBlock({
						type: "ol",
						// the depth of the list is determined by the amount of whitespace in front of it
						depth: lines[i].indexOf(line.substring(0, 1)),
						number: parseInt(line.replace(/^([0-9]+)\..*/, "$1")),
						content: line.replace(/^[0-9]+\.(.*)/, "$1").trim()
					}, true)
				}

				// footnotes
				else if (line.match(/^\[\^[0-9]+\].*/)) {
					pushBlock({
						type: "footnote",
						number: parseInt(line.replace(/^\[\^([0-9]+)\].*/, "$1")),
					}, true)
				}

				// CUSTOM
				// comments
				else if (line == "/*") {
					// start a new comment block
					pushBlock({
						type: "comment"
					});
					// set the evaluator to capture internal content
					parseEvaluator = function(content) {
						// if we have the end of the code block, stop the parse evaluator
						if (content == "*/") {
							parseEvaluator = null;
						}
						// otherwise, just append it
						else {
							pushContent(content);
						}
					}
				}

				// table
				else if (line.indexOf("|") == 0) {
					pushBlock({
						type: "table",
						rows: [],
						// contains column styling options
						styling: []
					});
					// every line is a new row
					// until we meet a row with ---, we assume we are doing header rows
					// we support colspans by chaining pipes, for instance
					// |test||test2||
					// |col1|col2|col3|col4|
					// in this case test would span over col1 and col2 (2 pipes at the end) and test2 would span over col3 and col4
					var tableHeader = true;
					parseEvaluator = function(line) {
						// before we do anything, we want to encode escaped | so we don't accidently hit them
						line = line.replace(/\\\|/g, "::encoded-pipe::");

						// if it does not start with a pipe, we have finalized our table and want to return to normal parsing
						if (line.indexOf("|") != 0) {
							// if we get to the end of the table without any ---, we need to retroactively unset all the header booleans
							if (tableHeader) {
								currentBlock.rows.forEach(function(row) {
									row.header = false;
								})
							}
							finalizeBlock();
							parseEvaluator = null;
							// continue regular parsing of this row
							return true;
						}
						var columns = [];
						// we need to parse the columns
						var pipeIndex = 0;
						// as long as we have pipe indexes, we have columns
						while (pipeIndex >= 0) {
							// we remove the leading pipe (there should be only one at this point)
							line = line.replace(/^[|]+/, "");
							// we get the next pipe index
							pipeIndex = line.indexOf("|");
							// if we have one, we have content
							if (pipeIndex >= 0) {
								var columnContent = line.substring(0, pipeIndex).trim();
								line = line.substring(pipeIndex);
								if (columnContent.match(/^[-]+$/)) {
									currentBlock.styling.push({
										align: "left"
									});
									tableHeader = false;
									continue;
								}
								else if (columnContent.match(/^:[-]+$/)) {
									currentBlock.styling.push({
										align: "left"
									})
									tableHeader = false;
									continue;
								}
								else if (columnContent.match(/^[-]+:$/)) {
									currentBlock.styling.push({
										align: "right"
									})
									tableHeader = false;
									continue;
								}
								else if (columnContent.match(/^:[-]+:$/)) {
									currentBlock.styling.push({
										align: "center"
									})
									tableHeader = false;
									continue;
								}
								// a content column
								else {
									// we need to calculate the colspan depending on the amount of pipes that follow
									var lengthWithPipe = line.length;
									// remove all pipes except for the last one
									line = line.replace(/^[|]*(\|.*)/, "$1");
									var colspan = lengthWithPipe - line.length;
									// decode encoded
									columnContent = columnContent.replace(/::encoded-pipe::/g, "|");
									columns.push({
										content: columnContent,
										colspan: colspan + 1
									})
								}
							}
						}
						if (columns.length > 0) {
							var row = {
								columns: columns,
								header: tableHeader
							};
							// add it to the table
							currentBlock.rows.push(row);
						}
					}
					// parse this row as well
					parseEvaluator(line);
				}

				// continuation of current block
				else {
					pushContent(line);
				}
			}
		}
		// finalize whatever we had ongoing
		finalizeBlock();
		return blocks;
	}
}