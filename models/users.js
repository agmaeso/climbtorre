var mongoose = require('mongoose');

var userSchema = mongoose.Schema({
	authId: String,  // esquema+id_thirdparty, p.ej. 'facebook:0a5Wsd5r'
	name: String,
	email: String,
	role: String,  // people or collaborator
	created: Date,
});

var User = mongoose.model('User', userSchema);
module.exports = User;
