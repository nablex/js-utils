if (!nabu) { nabu = {}; }
if (!nabu.services) { nabu.services = {}; }
if (!nabu.services.iterators) { nabu.services.iterators = {}; }

nabu.services.iterators.Static = function() {
	this.hasNext = function() {
		return false;
	}
	this.hasPrevious = function() {
		return false;
	}
	this.next = function(items, selected) {
		if (selected.length == 0) {
			nabu.utils.arrays.merge(selected, items);
		}
	}
	this.previous = function(items, selected) {
		// do nothing
	}
};
