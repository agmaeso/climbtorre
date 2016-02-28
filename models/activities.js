var mongoose = require('mongoose');

var activitySchema = mongoose.Schema({ name: String,
	description: String,
	location: [Number],  //lng, lat
	history: {
		event: String,
		notes: String,
		email: String,
		date: Date,
	},
	updateId: String,
	approved: Boolean,
});
var Activity = mongoose.model('Activity', activitySchema); module.exports = Activity;