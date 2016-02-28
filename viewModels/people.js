var People = require('../models/people.js');

// convenience function for joining fields
function smartJoin(arr, separator){
	if(!separator) separator = ' ';
	return arr.filter(function(elt) {
		return elt!==undefined &&
			elt!==null &&
			elt.toString().trim() !== '';
	}).join(separator);
}

var _ = require('underscore');

// get a people view model
// NOTE: readers of the book will notice that this function differs from the version
// in the book.  Unfortunately, the version in the book is incorrect (Mongoose does not
// offer an asynchronous version of .findById).  My apologies to my readers.
function getPeopleViewModel(people, interactions){
	var vm = _.omit(people, 'salesNotes');
	return _.extend(vm, {
		name: smartJoin([vm.firstName, vm.lastName]),
		fullAddress: smartJoin([
			people.address1,
			people.address2,
			people.zip + ', ' + people.city + ' (' + people.country + ')',
		], '<br>'),
		interactions: interactions.map(function(interaction){
			return {
				date: interaction.date,
				reference: interaction.reference,
				status: interaction.status,
				url: '/interactions/' + interaction.orderNumber,
			};
		}),
	});
}

module.exports = getCustomerViewModel;
