if (!nabu) { nabu = {}; }
if (!nabu.services) { nabu.services = {}; }
if (!nabu.services.iterators) { nabu.services.iterators = {}; }

/*
Parameters:
	- totalSize: the total size of the window
	- scrollSize: if you want to move the window, how much do you move it by, if nothing is set, it will move the window fully, for example a window of 2 would shift by 2.
	- loadNext: a handler to load the next data, it should expect these parameters:
		- items: the current items known by the list
		- amount: the amount of new items to be loaded
		- resultHandler: a function that should be called with an array of the new items once they are loaded
	- loop: whether or not to loop
	- initialOffset: for the initial items to be loaded, how much to offset them by, the offset should be within the scope of the items already present in the list
*/
nabu.services.iterators.Window = function(parameters) {
	var self = this;
	this.totalSize = parameters.totalSize;
	this.scrollSize = parameters.scrollSize ? parameters.scrollSize: this.totalSize;
	this.loadNext = parameters.loadNext;
	this.hasMore = true;
	this.loop = parameters.loop;
	this.initialOffset = parameters.initialOffset ? parameters.initialOffset : 0;

	this.next = function(items, selected) {

		// function to lazily load new items
		var loadNext = function(amount) {
			self.loadNext(items, amount, function(result) {
				// we assume there is nothing more
				if (result.length < amount) {
					self.hasMore = false;
				}
				// if we loaded less than the scroll size, we still need to merge some from the original
				if (amount < self.scrollSize) {
					nabu.utils.arrays.merge(selected, items.slice(items.length - amount, items.length));
				}
				// add the result to the items
				nabu.utils.arrays.merge(items, result);

				// merge the rest from the result
				nabu.utils.arrays.merge(selected, result.slice(0, Math.min(result.length, self.scrollSize - amount)));
			});
		};

		// nothing selected yet, select first
		if (selected.length == 0) {
			if (items.length < self.initialOffset + self.totalSize && self.loadNext) {
				loadNext(self.totalSize + self.initialOffset - items.length);
			}
			else {
				nabu.utils.arrays.merge(selected, items.slice(self.initialOffset, Math.min(self.totalSize + self.initialOffset, items.length)));
			}
		}
		else {
			var loopFunction = function(amountOfNewItems) {
				// make sure we don't include the same item twice
				amountOfNewItems = Math.min(self.scrollSize - amountOfNewItems, items.length - amountOfNewItems);
				var amountToRetain = Math.min(selected.length, self.totalSize - amountOfNewItems);
				// remove the items that do not need to be retained
				selected.splice(0, selected.length - amountToRetain);
				// merge the beginning
				nabu.utils.arrays.merge(selected, items.slice(0, amountOfNewItems));
			}
			// get index of last selected item
			var index = items.indexOf(selected[selected.length - 1]);
			if (index < 0) {
				throw "Could not find selected item in list";
			}
			// there are not enough elements
			else if (index + self.scrollSize >= items.length - 1 && self.loadNext) {
				loadNext(self.scrollSize - (items.length - 1 - index));
			}
			else if (index < items.length - 1) {
				var amountOfNewItems = Math.min(self.scrollSize, items.length - index - 1);
				var amountToRetain = Math.min(selected.length, self.totalSize - amountOfNewItems);
				// remove the items that do not need to be retained
				selected.splice(0, selected.length - amountToRetain);
				// merge the new items
				nabu.utils.arrays.merge(selected, items.slice(index + 1, index + 1 + amountOfNewItems));
				// if we did not add enough elements and loop is turned on, loop back to beginning
				if (amountOfNewItems < self.scrollSize && self.loop) {
					loopFunction(amountOfNewItems);
				}
			}
			else if (self.loop) {
				loopFunction(0);
			}
		}
	};
	this.previous = function(items, selected) {
		// no use in trying to select previous if nothing is selected yet
		if (selected.length > 0) {
			var loopFunction = function(amountOfNewItems) {
				amountOfNewItems = Math.min(self.scrollSize - amountOfNewItems, items.length - amountOfNewItems);
				var amountToRetain = Math.min(selected.length, self.totalSize - amountOfNewItems);
				// remove remaining items
				selected.splice(amountToRetain, selected.length - amountToRetain);
				// merge the new items
				nabu.utils.arrays.offer(selected, items.slice(items.length - amountOfNewItems, items.length));
			}
			// get index of first selected item
			var index = items.indexOf(selected[0]);
			if (index < 0) {
				throw "Could not find selected item in list";
			}
			// only do it if there are elements left
			else if (index > 0) {
				var amountOfNewItems = Math.min(self.scrollSize, index);
				var amountToRetain = Math.min(selected.length, self.totalSize - amountOfNewItems);
				// remove remaining items
				selected.splice(amountToRetain, selected.length - amountToRetain);
				// merge the new items
				nabu.utils.arrays.offer(selected, items.slice(index - amountOfNewItems, index));
				if (amountOfNewItems < self.scrollSize && self.loop) {
					loopFunction(amountOfNewItems);
				}
			}
			else if (self.loop) {
				loopFunction(0);
			}
		}
	};
	this.hasNext = function(items, selected) {
		if (self.loop && selected.length != items.length) {
			return true;
		}
		return selected.length == 0
			? items.length > 0
			: items.indexOf(selected[selected.length - 1]) < items.length - 1;
	};
	this.hasPrevious = function(items, selected) {
		if (self.loop && selected.length != items.length) {
			return true;
		}
		return selected.length > 0 && items.indexOf(selected[0]) > 0;
	};
	this.autosize = function(items, selected, amountOfChildren) {
		this.totalSize = amountOfChildren;
		// remove the last from selected
		if (this.totalSize < selected.length) {
			selected.splice(this.totalSize);
		}
		else if (this.totalSize > selected.length) {
			var index = items.indexOf(selected[selected.length - 1]);
			nabu.utils.arrays.merge(selected, items.slice(index + 1, index + 1 + Math.min((this.totalSize - selected.length), items.length - index)));
		}
	}
}
