var mongoose = require('mongoose');
var rockAvailableListenerSchema = mongoose.Schema({ email: String,
        skus: [String],
    });
var rockAvailableListener = mongoose.model('rockAvailableListener', rockAvailableListenerSchema);
module.exports = rockAvailableListener;