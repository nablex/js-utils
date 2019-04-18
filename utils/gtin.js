if (!nabu) { nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.utils.gtin = {
	validate: function(code, gtinLength, countryCode) {
		var regexValidate = function (value) {
			var prefix = countryCode != null ? countryCode : "";
			var pattern = prefix + "[0-9]{" + (gtinLength - prefix.length) + "}";
			return new RegExp(pattern).test(code);
		};
		var moduloValidate = function(value) {
			var calculation = (value.substring(0, value.length - 1).split(/\B/).reduce(function(sum, x, index) { 
				var reverseIndex = value.toString().length - index;
				return sum + ((reverseIndex % 2 == 0 ? 3 : 1) * x);
			}, 0)) % 10;
			var result = (calculation + parseInt(value.substring(value.length - 1, value.length))) % 10;
			return result == 0;
		};
		return regexValidate(code) && moduloValidate(code);
	}
};