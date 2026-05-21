const mongoose = require('mongoose');

const pathSchema = mongoose.Schema({
    //owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    source:{type:String, required:true},
    destination:{type:String, required:true},
    stops:[{stopName:String,order:Number}],
    distance:{type:String},
    
})
module.exports = mongoose.model('Path',pathSchema);