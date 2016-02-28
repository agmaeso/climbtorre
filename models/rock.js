/*
Ver http://www.escalamadrid.com/terminologia/ - terminos de escalada en ingles y francés
 */

var mongoose = require('mongoose');

var lineSchema = mongoose.Schema({ 
	name: String,
	category: String,
	length: Number,
	pitches: Number,
	condition: String,
	description: String,
	duration: Number,
	materialRequired: String,
	priceInCents: Number,
	tags: [String],
	available: Boolean,
	requiresWaiver: Boolean,
	maximumGuests: Number,
	notes: String,
	created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now}
});

// Pone las fechas de cuando se guarden o actualicen las vías
lineSchema.pre('save', function(next){
    now = new Date();
    this.updated_at = now;
    if(!this.created_at) {
        this.created_at = now
    }
    next();
});

var rockSchema = mongoose.Schema({ 
	name: String,
	sku: String,
	quality: String,
	description: String,
	location: {type:[Number], required: true}, //[Long,Lat]
	maturity: String,
	available: Boolean,
	causeUnav: String,
	created_at: {type: Date, default: Date.now},
    updated_at: {type: Date, default: Date.now},
	childs: [lineSchema]
});

//Pone las fechas de cuando se guarden o actualicen las vías
rockSchema.pre('save', function(next){
    now = new Date();
    this.updated_at = now;
    if(!this.created_at) {
        this.created_at = now
    }
    next();
});

// Indexa este schema en formato 2dsphere (critico para hacer luego consultas por proximidad)
rockSchema.index({location: '2dsphere'});

/*
pathSchema.methods.getDisplayPrice = function() {
	return (this.priceInCents / 100).toFixed(2)+'€'; 
};
*/

module.exports = [mongoose.model('Line',lineSchema), mongoose.model('Rock',rockSchema)]; 
//module.exports = mongoose.model('Rock',rockSchema); 

