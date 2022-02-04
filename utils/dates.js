if (!nabu) { nabu = {}; }
if (!nabu.utils) { nabu.utils = {}; }

nabu.utils.dates = {
	dayOfWeek: function(date) {
		// starts on sunday
		var day = date.getDay() - 1;
		if (day < 0) {
			day = 6;
		}
		return day;
	}, 
	months: function() {
		var months = [];
		months.push("%{date:January}");
		months.push("%{date:February}");
		months.push("%{date:March}");
		months.push("%{date:April}");
		months.push("%{date:May}");
		months.push("%{date:June}");
		months.push("%{date:July}");
		months.push("%{date:August}");
		months.push("%{date:September}");
		months.push("%{date:October}");
		months.push("%{date:November}");
		months.push("%{date:December}");
		return months;
	},
	days: function() {
		var days = [];
		days.push("%{date:Monday}");
		days.push("%{date:Tuesday}");
		days.push("%{date:Wednesday}");
		days.push("%{date:Thursday}");
		days.push("%{date:Friday}");
		days.push("%{date:Saturday}");
		days.push("%{date:Sunday}");
		return days;
	},
	addDuration: function(duration, date) {
		// laziness
		var value = duration;
		var factor = value.indexOf("-") == 0 ? -1 : 1;
		// drop the leading -
		if (factor < 0) {
			value = value.substring(1);
		}
		// the total duration in ms
		var duration = 0;
		var result = date ? date : new Date();
		// not supported atm
		result.setMilliseconds(0);
		// skip P
		value = value.substring(1);
		// separate date part from time part
		var parts = value.split("T");
		// check for years
		var index = parts[0].indexOf("Y");
		if (index >= 0) {
			result.setYear(result.getFullYear() + (factor * parseInt(parts[0].substring(0, index))));
			parts[0] = parts[0].substring(index + 1);
		}
		index = parts[0].indexOf("M");
		if (index >= 0) {
			result.setMonth(result.getMonth() + (factor * parseInt(parts[0].substring(0, index))));
			parts[0] = parts[0].substring(index + 1);
		}
		index = parts[0].indexOf("D");
		if (index >= 0) {
			result.setDate(result.getDate() + (factor * parseInt(parts[0].substring(0, index))));
			parts[0] = parts[0].substring(index + 1);
		}
		if (parts.length >= 2) {
			index = parts[1].indexOf("H");
			if (index >= 0) {
				result.setHours(result.getHours() + (factor * parseInt(parts[1].substring(0, index))));
				parts[1] = parts[1].substring(index + 1);
			}
			index = parts[1].indexOf("M");
			if (index >= 0) {
				result.setMinutes(result.getMinutes() + (factor * parseInt(parts[1].substring(0, index))));
				parts[1] = parts[1].substring(index + 1);
			}
			index = parts[1].indexOf("S");
			if (index >= 0) {
				result.setSeconds(result.getSeconds() + (factor * parseInt(parts[1].substring(0, index))));
				parts[1] = parts[1].substring(index + 1);
			}
		}
		return result;
	}
};
