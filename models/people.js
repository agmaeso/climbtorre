var mongoose = require('mongoose'); 
var Interactions = require('./interactions.js');

var customerSchema = mongoose.Schema({ 
    firstName: String,
    lastName: String,
    email: String,
    address1: String,
    address2: String,
    city: String,
    zip: String,
    country: String,
    phone: String,
    twitterAddr: String,
    facebookAddr: String,
    salesNotes: [{
            date: Date,
            createdBy: Number,
            notes: String,  
    }], 
});

customerSchema.methods.getInteractions = function(){ 
    return Orders.find({ customerId: this._id });
};

var Customer = mongoose.model('Peope', customerSchema);

modules.export = Customer;