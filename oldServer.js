// var express = require('express')
var io = require('socket.io')()
const port = process.env.PORT || 8000;

// var app = express()
// var server = app.listen(port, function(){
//     console.log('listening to requests on port ' + port)
// })

// var io = socket(server)

io.listen(port);
console.log('listening on port ', port);

var users = []

io.on('connection', (client) => {
    // here you can start emitting events to the client 

    console.log("websocket connected: " + client.id)
    client.emit('get_id', {myID: client.id, users: users})
    users.push(client.id)
    io.sockets.emit('new_person', users)


    client.on('offer_to_user', function(data){
        console.log(data)
        client.broadcast.to(data.targetUser).emit('incoming_offer', {offersID: data.myID, offer: data.offer})
    })

    client.on('answer_to_user', function(data){
        console.log("answer", data)
        client.broadcast.to(data.targetUser).emit('incoming_answer', data.answer)
    })


    client.on('disconnect', function(){
        users = users.filter((id) => {
            return client.id !== id
          })
        client.broadcast.emit('remove_user', users)
        console.log("websocket disconnected: " + client.id)
    })
  });