if (!nabu) { nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.utils.string = {
	quotePattern: function(pattern) {
		var special = /([\[\]\^\$\|\(\)\\\+\*\?\{\}\=\!])/gi;
		return pattern.replace(special, '\\$1');
	}
};