var People = require('../models/people.js');
var peopleViewModel = require('../viewModels/people.js');

module.exports = {

	registerRoutes: function(app) {
		app.get('/people/register', this.register);
		app.post('/people/register', this.processRegister);

		app.get('/people/:id', this.home);
		app.get('/people/:id/preferences', this.preferences);
		app.get('/inteactions/:id', this.interactions);

		app.post('/people/:id/update', this.ajaxUpdate);
	},

	register: function(req, res, next) {
		res.render('people/register');
	},

	processRegister: function(req, res, next) {
		// TODO: back-end validation (safety)
		var c = new People({
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			email: req.body.email,
			address1: req.body.address1,
			address2: req.body.address2,
			zip: req.body.zip,
			city: req.body.city,
			country: req.body.country,
			phone: req.body.phone,
		});
		c.save(function(err) {
			if(err) return next(err);
			res.redirect(303, '/people/' + c._id);
		});
	},

	home: function(req, res, next) {
		People.findById(req.params.id, function(err, people) {
			if(err) return next(err);
			if(!people) return next(); 	// pass this on to 404 handler
			people.getOrders(function(err, interactions) {
				if(err) return next(err);
				res.render('people/home', peopleViewModel(people, interactions));
			});
		});
	},

	preferences: function(req, res, next) {
		People.findById(req.params.id, function(err, people) {
			if(err) return next(err);
			if(!people) return next(); 	// pass this on to 404 handler
			people.getOrders(function(err, interactions) {
				if(err) return next(err);
				res.render('people/preferences', peopleViewModel(people, interactions));
			});
		});
	},

	interactions: function(req, res, next) {
		People.findById(req.params.id, function(err, people) {
			if(err) return next(err);
			if(!people) return next(); 	// pass this on to 404 handler
			people.getOrders(function(err, interactions) {
				if(err) return next(err);
				res.render('people/preferences', peopleViewModel(people, interactions));
			});
		});
	},

	ajaxUpdate: function(req, res) {
		People.findById(req.params.id, function(err, people) {
			if(err) return next(err);
			if(!people) return next(); 	// pass this on to 404 handler
			if(req.body.firstName){
				if(typeof req.body.firstName !== 'string' ||
					req.body.firstName.trim() === '')
					return res.json({ error: 'Invalid name.'});
				people.firstName = req.body.firstName;
			}
			// and so on....
			people.save(function(err) {
				return err ? res.json({ error: 'Unable to update people.' }) : res.json({ success: true });
			});
		});
	},
};
