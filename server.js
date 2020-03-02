var path = require('path')
var express = require('express')
var app = express()
var server = require('http').createServer(app)

var io = require('socket.io')(server)
const port = process.env.PORT || 8000;

app.use(express.static(path.join(__dirname, './build')))

// var app = express()
// var server = app.listen(port, function(){
//     console.log('listening to requests on port ' + port)
// })

// var io = socket(server)

// io.listen(port);

app.get('/', (req, res, next) => {
    console.log("here")
    res.sendFile(__dirname, './index.html')
})

var users = []

io.on('connection', (client) => {
    // here you can start emitting events to the client 

    console.log("websocket connected: " + client.id)
    console.log(process.env.PORT, process.env.STUN)
    
    client.emit('get_id', {myID: client.id, users: users})
    users.push(client.id)
    io.sockets.emit('new_person', users)


    client.on('offer_to_user', function(data){
        console.log("\noffer", data)
        client.broadcast.to(data.targetUser).emit('incoming_offer', {offersID: data.myID, offer: data.offer, location: data.location})
    })

    client.on('answer_to_user', function(data){
        console.log("\nanswer", data)
        client.broadcast.to(data.targetUser).emit('incoming_answer', {answer: data.answer, location: data.location})
    })

    client.on('candidate', function(data){
        console.log(`\ncandidate`, data.candidate, data.targetUser)
        client.broadcast.to(data.targetUser).emit('incoming_candidate', data.candidate)
    })

    client.on('renegotiation_offer_to_user', function(data){
        console.log("\nrenegotiation_offer", data)
        client.broadcast.to(data.targetUser).emit('incoming_renegotiation_offer', {offer: data.offer})
    })

    client.on('renegotiation_answer_to_user', function(data){
        console.log("\nrenegotiation_answer", data)
        client.broadcast.to(data.targetUser).emit('incoming_renegotiation_answer', {answer: data.answer})
    })


    client.on('disconnect', function(){
        users = users.filter((id) => {
            return client.id !== id
          })
        client.broadcast.emit('remove_user', users)
        console.log("websocket disconnected: " + client.id)
    })
  });

server.listen(port)
console.log('listening on port ', port);