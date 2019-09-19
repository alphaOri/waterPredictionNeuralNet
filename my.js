const mongodb = require('mongodb')
const brain = require('brainjs')
var fs = require('fs');

var file = fs.createWriteStream('trainingData.txt');
file.on('error', function(err) { console.error("Error working with file: trainingData.txt") });

//var mongoHostname = "127.0.0.1"
//var mongoPort = "27017"
//node --max-old-space-size=3000 my.js

var mongoHostname = "192.168.1.19"
var mongoPort = "27017"
var mongoDbName = "water"
var mongoDailyCollection = "daily"
var mongousername = "predictionalgorithm"
var mongopassword = "predictionpassword"

var url = "mongodb://"+mongousername+":"+mongopassword+"@"+mongoHostname+":"+mongoPort+"/"+mongoDbName
var dbHandle
var collectionHandle
mongodb.MongoClient.connect(url, {useNewUrlParser:true, useUnifiedTopology: true }, function(err, client) {
    if(err){
        console.error(err)
    } else {
        console.log("Connected to database.")
        dbHandle = client.db(mongoDbName)
        collectionHandle = dbHandle.collection(mongoDailyCollection)
        getData()
    }
})

var trainingData = []

var todayStart = new Date()
var todayEnd = new Date(todayStart)
todayStart.setHours(0,0,0,0)
todayEnd.setHours(24,0,0,0)
var whichDayStart = new Date(todayStart)
var whichDayEnd = new Date(todayEnd)
var millisecondsInADay = 86400000

var currentTimestampMs //randomize starting timestamp

function getData() {
	whichDayStart.setDate(whichDayStart.getDate()-1)
	whichDayEnd.setDate(whichDayEnd.getDate()-1)
	//console.log("start: "+whichDayStart+" end: "+whichDayEnd)

	collectionHandle.findOne({created: { $gt:whichDayStart, $lt:whichDayEnd }}, function(err, doc) {
	    	if(err){ console.error(err) } 
	    	else {
	    		if(doc){
	    			console.log("Got doc created: "+doc.created)
	    			//console.log("Flow length: "+doc.flow.length)
	    			handleDailyDoc(doc)
	    			getData()
	    			console.log("Done")
	    		}else {
	    			console.log("Saving to File")
	    			trainingData.forEach(function(v) {
	    				var objectStr = JSON.stringify(v)
	    				file.write(objectStr+', '+ '\n'); 
	    			});
	    			file.end();
	    			console.log("Training Brain")
	    			trainBrain()
	    		}
	    	}
	    }
	)
}

function handleDailyDoc(doc){
	currentTimestampMs = Math.floor(Math.random() * 1000)
	var gallonsSoFar = 0
	var prevFlowTimestamp = undefined
	for(let i=0; i<doc.flow.length; i++){
		var flowTimestamp = new Date(doc.flow[i].created)
		flowTimestamp = flowTimestamp.getTime() - whichDayStart.getTime()
		if(flowTimestamp < prevFlowTimestamp){
			console.log("previous: "+ doc.flow[i-1].created+" current: "+doc.flow[i].created)
		}
		while((Math.abs(flowTimestamp-currentTimestampMs)>2000)) { //while flow timestamp is more than 2 seconds away from current timestamp 
			addToTrainingData(gallonsSoFar, currentTimestampMs, doc.gallons)
			currentTimestampMs = currentTimestampMs+1000
		}
		gallonsSoFar = gallonsSoFar+clicksToGallons(doc.flow[i].clicks)
		currentTimestampMs = flowTimestamp
		addToTrainingData(gallonsSoFar, currentTimestampMs, doc.gallons)
		//console.log("FLOW: flowTimestamp: "+flowTimestamp+" currentTimestampMs: "+currentTimestampMs)
		prevFlowTimestamp = flowTimestamp
	}
	//from last flow data to midnight
	while(Math.abs(millisecondsInADay-currentTimestampMs)>2000){
		//console.log("millisecondsInADay: "+millisecondsInADay+" currentTimestampMs: "+currentTimestampMs)
		currentTimestampMs = currentTimestampMs+1000
		addToTrainingData(gallonsSoFar, currentTimestampMs, doc.gallons)
	}
}

function addToTrainingData(gallonsSoFar, timestamp, gallons) {
	var input = {gallonsSoFar: gallonsSoFar/1000, timestamp: timestamp/millisecondsInADay}
	var output = {gallons: gallons/1000}
	//var objectStr = JSON.stringify({input: input, output: output})
	//console.log({input: input, output: output})
	//file.write(objectStr+', '+'\n')
	trainingData.push({input: input, output: output})
}

function clicksToGallons(clicks) {return (0.000925824*clicks + 0.0015719)}

function trainBrain() {
	var net = new brain.NeuralNetwork({hiddenLayers: 5});

	net.train(trainingData, { 
		  //log: (stats) => console.log(stats), 
		  // Defaults values --> expected validation
	      iterations: 20000,    // the maximum times to iterate the training data --> number greater than 0
	      errorThresh: 0.05,   // the acceptable error percentage from training data --> number between 0 and 1
	      log: true,           // true to use console.log, when a function is supplied it is used --> Either true or a function
	      logPeriod: 1,        // iterations between logging out --> number greater than 0
	      learningRate: 0.03,    // scales with delta to effect training rate --> number between 0 and 1
	      momentum: 0.1,        // scales with next layer's change value --> number between 0 and 1
	      callback: null,       // a periodic call back that can be triggered while training --> null or function
	      callbackPeriod: 10,   // the number of iterations through the training data between callback calls --> number greater than 0
	      timeout: Infinity     // the max number of milliseconds to train for --> number greater than 0

	});

	console.log(net.run({ input: { gallonsSoFar: 0, timestamp: 0.000001 }}));
	console.log(net.run({ input: { gallonsSoFar: 0.005422257596000007, timestamp: 0.30393769675925925 }})); //output: 0.22322169950398996
	console.log(net.run({ input: { gallonsSoFar: 0.004017469735999997, timestamp: 0.11428484953703703 }})); // output: 0.14486435972399841
	//console.log(net.run({ input: { gallonsSoFar: 0, timestamp: 0.000001 }}));
	//console.log(net.run({ input: { gallonsSoFar: 0, timestamp: 0.000001 }}));
	//console.log(net.run({ input: { gallonsSoFar: 0, timestamp: 0.000001 }}));
}