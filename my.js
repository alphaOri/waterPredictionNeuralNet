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
		console.log("Getting all records prior to today...")
        getData()
    }
})

var trainingData = []
var trainingDocs = []
var trainingDocsIndex = -1

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
	    			console.log("Got record created: "+doc.created)
	    			//console.log("Flow length: "+doc.flow.length)
	    			handleDailyDoc(doc)
	    			getData()
	    		}else {
	    			console.log("Parallelizing data...")
					trainingDocsToData()
	    			console.log("Saving to File...")
	    			trainingData.forEach(function(v) {
	    				var objectStr = JSON.stringify(v)
	    				file.write(objectStr+', '+ '\n')
	    			})
	    			file.end()
	    			file.close()
	    			//console.log("Done")
	    			console.log("Training Brain...")
	    			trainBrain()
	    		}
	    	}
	    }
	)
}

function handleDailyDoc(doc){
	console.log("Converting record to training data...")
	trainingDocsIndex++
	trainingDocs[trainingDocsIndex]={data: [], currentIndex: 0}
	currentTimestampMs = Math.floor(Math.random() * 1000)
	var gallonsSoFar = 0
	var prevFlowTimestamp = undefined
	for(let i=0; i<doc.flow.length; i++){
		var flowTimestamp = new Date(doc.flow[i].created)
		flowTimestamp = flowTimestamp.getTime() - whichDayStart.getTime()
		if(flowTimestamp < prevFlowTimestamp){
			console.warn("WARNING: flow data out of order! "+"previous: "+ doc.flow[i-1].created+" current: "+doc.flow[i].created)
		}
		while((Math.abs(flowTimestamp-currentTimestampMs)>2000)) { //while flow timestamp is more than 2 seconds away from current timestamp 
			addToTrainingDocs(gallonsSoFar, currentTimestampMs, doc.gallons)
			currentTimestampMs = currentTimestampMs+1000
		}
		gallonsSoFar = gallonsSoFar+clicksToGallons(doc.flow[i].clicks)
		currentTimestampMs = flowTimestamp
		addToTrainingDocs(gallonsSoFar, currentTimestampMs, doc.gallons)
		//console.log("FLOW: flowTimestamp: "+flowTimestamp+" currentTimestampMs: "+currentTimestampMs)
		prevFlowTimestamp = flowTimestamp
	}
	//from last flow data to midnight
	while(Math.abs(millisecondsInADay-currentTimestampMs)>2000){
		//console.log("millisecondsInADay: "+millisecondsInADay+" currentTimestampMs: "+currentTimestampMs)
		currentTimestampMs = currentTimestampMs+1000
		addToTrainingDocs(gallonsSoFar, currentTimestampMs, doc.gallons)
	}
}

function addToTrainingDocs(gallonsSoFar, timestamp, gallons) {
	var input = {gallonsSoFar: gallonsSoFar/300, timestamp: timestamp/millisecondsInADay}
	var output = {gallons: gallons/300}
	//var objectStr = JSON.stringify({input: input, output: output})
	//console.log({input: input, output: output})
	//file.write(objectStr+', '+'\n')
	trainingDocs[trainingDocsIndex].data.push({input: input, output: output})
}

function trainingDocsToData() {
	//for every second in a day
	for(let second=1; second <= 86400; second++){
		var foundOne = true
		//until no more entries found less then second timestamp
		while(foundOne == true){
			foundOne = false
			//for each doc
			for(let i=0; i<trainingDocs.length; i++){
				//check index < length of array
				if(trainingDocs[i].currentIndex<trainingDocs[i].data.length){
					//console.log("doc number: "+i+" data length: "+trainingDocs[i].data.length+" currentIndex: "+trainingDocs[i].currentIndex)
					//check next index if time < then current second timestamp
					//console.log("second: "+second+" doc timestamp: "+ trainingDocs[i].data[trainingDocs[i].currentIndex].input.timestamp)
					if(second*1000 > trainingDocs[i].data[trainingDocs[i].currentIndex].input.timestamp*millisecondsInADay){
						///store in trainingData
						trainingData.push(trainingDocs[i].data[trainingDocs[i].currentIndex])
						// and set foundOne
						foundOne = true
						// increment index
						trainingDocs[i].currentIndex++
					}
				}
			}
		}
	}
}

function clicksToGallons(clicks) {return (0.000925824*clicks + 0.0015719)}

function trainBrain() {

	var net = new brain.NeuralNetwork({hiddenLayers: [3, 4, 2]});

	console.log(net.train(trainingData, { 
		  //log: (stats) => console.log(stats), 
		  // Defaults values --> expected validation
	      iterations: 100,    // the maximum times to iterate the training data --> number greater than 0
	      errorThresh: 0.0000001,   // the acceptable error percentage from training data --> number between 0 and 1
	      log: true,           // true to use console.log, when a function is supplied it is used --> Either true or a function
	      logPeriod: 1,        // iterations between logging out --> number greater than 0
	      learningRate: 0.8,    // scales with delta to effect training rate --> number between 0 and 1
		  momentum: 0.8
	}))

	console.log(net.run({ input: { gallonsSoFar: 0, timestamp: 0.000009398148148148148 }})); //output: 0.15900049135999902
	console.log(net.run({ input: { gallonsSoFar: 0.15900049135999902, timestamp: 0.9999803009259259 }})); //output: 0.15900049135999902
	console.log(net.run({ input: { gallonsSoFar: 0, timestamp: 0.00001025462962962963 }})); // output: 0.14486435972399841
	console.log(net.run({ input: { gallonsSoFar: 0.14486435972399841, timestamp: 0.9999794444444444 }})); // output: 0.14486435972399841
	console.log(net.run({ input: { gallonsSoFar: 0, timestamp: 0.00000068287037037037 }})); // output: 0.22322169950398996
	console.log(net.run({ input: { gallonsSoFar: 0.22322169950398998, timestamp: 0.9999779861111111 }})); // 0.22322169950398996

	
	//console.log(net.run({ gallonsSoFar: 0.1, timestamp: 0.1 }));
	//console.log(net.run({ gallonsSoFar: 0.2, timestamp: 0.2 }));
	//console.log(net.run({ gallonsSoFar: 0.3, timestamp: 0.3 }));
	//console.log(net.run({ gallonsSoFar: 0.3, timestamp: 0.1 }));

}

/*trainingData = [
	{ input: { gallonsSoFar: 0.1, timestamp: 0.1 }, output: {gallons: 0.1}},
	{ input: { gallonsSoFar: 0.1, timestamp: 0.1 }, output: {gallons: 0.2}},
	{ input: { gallonsSoFar: 0.1, timestamp: 0.1 }, output: {gallons: 0.3}},
	{ input: { gallonsSoFar: 0.2, timestamp: 0.2 }, output: {gallons: 0.4}},
	{ input: { gallonsSoFar: 0.2, timestamp: 0.2 }, output: {gallons: 0.5}},
	{ input: { gallonsSoFar: 0.2, timestamp: 0.2 }, output: {gallons: 0.6}},
	{ input: { gallonsSoFar: 0.3, timestamp: 0.3 }, output: {gallons: 0.7}},
	{ input: { gallonsSoFar: 0.3, timestamp: 0.3 }, output: {gallons: 0.8}},
	{ input: { gallonsSoFar: 0.3, timestamp: 0.3 }, output: {gallons: 0.9}},

]
trainBrain()*/

