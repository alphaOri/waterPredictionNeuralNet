//const fs = require('fs')
const mongodb = require('mongodb')
const brain = require('brainjs')

var url = "mongodb://nodered:noderedpassword@192.168.1.19:27017/water"
var collectionHandle
/*mongodb.MongoClient.connect(url, {native_parser:true}, function(err, db) {
    if(err){
        node.error(err)
    } else {
        console.log("Connected to database.")
        collectionHandle = db.collection("daily")
    }
})*/

mongodb.MongoClient.connect('mongodb://nodered:noderedpassword@192.168.1.19:27017', function (err, client) {
  if (err) throw err;

  var db = client.db('water');

  collectionHandle = db.collection('daily')
  console.log("Connected to database.")
}) 

var net = new brain.NeuralNetwork();
 
net.train([{input: { r: 0.03, g: 0.7, b: 0.5 }, output: { black: 1 }},
           {input: { r: 0.16, g: 0.09, b: 0.2 }, output: { white: 1 }},
           {input: { r: 0.5, g: 0.5, b: 1.0 }, output: { white: 1 }}]);
 
var output = net.run({ r: 1, g: 0.4, b: 0 });  // { white: 0.99, black: 0.002 }
console.log(output)