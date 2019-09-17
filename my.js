//const fs = require('fs')
const mongodb = require('mongodb')
const brain = require('brainjs')

//var mongoHostname = "127.0.0.1"
//var mongoPort = "27017"
var mongoHostname = "192.168.1.19"
var mongoPort = "27017"
var mongoDbName = "water"
var mongoDailyCollection = "daily"
var mongousername = "predictionalgorithm"
var mongopassword = "predictionpassword"

var url = "mongodb://"+mongousername+":"+mongopassword+"@"+mongoHostname+":"+mongoPort+"/"+mongoDbName
var dbHandle
var collectionHandle
mongodb.MongoClient.connect(url, {useNewUrlParser:true}, function(err, client) {
    if(err){
        console.error(err)
    } else {
        console.log("Connected to database.")
        dbHandle = client.db(mongoDbName)
        collectionHandle = dbHandle.collection(mongoDailyCollection)
        var start = new Date()
		var end = new Date(start.getTime())
		start.setHours(0,0,0,0)
		end.setHours(24,0,0,0)

		collectionHandle.findOne({created: { $lt:start }}, 
		    {projection: {average: 1, numavg: 1, gallons: 1, incomplete: 1}, sort: { _id: -1 }, limit: 1 }, function(err, doc) {
		    	if(err){ console.error(err) } 
		    	else {
		    		if(doc){
		    			console.log(doc)
		    		}else {
		    			console.log("no doc")
		    		}
		    	}
		    }
		)
    }
})



var net = new brain.NeuralNetwork();
 
net.train([{input: { r: 0.03, g: 0.7, b: 0.5 }, output: { black: 1 }},
           {input: { r: 0.16, g: 0.09, b: 0.2 }, output: { white: 1 }},
           {input: { r: 0.5, g: 0.5, b: 1.0 }, output: { white: 1 }}]);
 
var output = net.run({ r: 1, g: 0.4, b: 0 });  // { white: 0.99, black: 0.002 }
console.log(output)