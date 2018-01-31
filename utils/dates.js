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
	}
};
