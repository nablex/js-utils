if (!nabu) { var nabu = {} };
if (!nabu.services) { nabu.services = {} };

nabu.services.Cookies = function Cookies($services) {
	this.set = function(name, value, days) {
		var expires = "";
		if (days) {
			var date = new Date();
			date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
			expires = "; expires=" + date.toUTCString();
		}
		document.cookie = name + "=" + value + expires + "; path=${when(environment('cookiePath') == null, environment('serverPath'), environment('cookiePath'))}";
	};
	this.get = function(name, defaultValue) {
		name += "=";
		var cookies = document.cookie.split(';');
		for (var i = 0; i < cookies.length; i++) {
			var cookie = cookies[i];
			while (cookie.charAt(0) == ' ') {
				cookie = cookie.substring(1, cookie.length);
			}
			if (cookie.indexOf(name) == 0) {
				return cookie.substring(name.length, cookie.length);
			}
		}
		return defaultValue ? defaultValue : null;
	};
	this.unset = function(name) {
		this.set(name, "", -1);
	}
}