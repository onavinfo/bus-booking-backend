const mongodb = require('mongodb');
const { get } = require('mongoose');

const MongoClient = mongodb.MongoClient;

const MONGO_URL = "mongodb+srv://puridivya314_db_user:lYYsoCBMYqhyrquy@cluster0.sxtloss.mongodb.net/"

let _db;

const mongoConnect = (callback) =>{
    MongoClient.connect(MONGO_URL)
    .then(client =>{
         _db = client.db('busData');
        callback();
    })
    .catch((err)=>{
        console.log(err);
    });
};

const getDB = () =>{
    if(!_db) {
        throw new Error('Mongo not connected');
    }
    return _db;
}

exports.mongoConnect = mongoConnect;
exports.getDB = getDB;