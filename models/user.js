const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    Name: {
        type:String,
        required:true,
    },
    Email:{
        type:String,
        required:true,
    },
    Username:{
        type:String,
        required:true,
    },
    Password:{
        type:String,
        required:true,
    },
    Description:{
        type:String,
        required:true
    },
    Profilepic:{
        type:String,
        required:true
    }
});

module.exports = mongoose.model('User',userSchema);