import React, {useEffect, useState} from 'react';
import './App.css';
import openSocket from 'socket.io-client';
import UserList from './components/UserList'
import Peer from 'simple-peer'

var socket = openSocket('http://localhost:8000');

function App() {
  const [myID, setMyID] = useState(null)
  const [users, setUsers] = useState([])
  const [streamInitialized, setStreamInitialized] = useState(false)
  const [readyToInitialize, setReadyToInitialize] = useState(false)
  const [targetUser, setTargetUser] = useState(null)
  const [peer, setPeer] = useState(null)


  useEffect(() => {

    socket.on('get_id', data => {
      setMyID(data.myID)
      setUsers(data.users)
    })

    if (hasUserMedia()) { 
      navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
      || navigator.mozGetUserMedia
    } else { 
        alert("WebRTC is not supported"); 
    }
    
    navigator.getUserMedia({ video: true, audio: true }, function (stream) { 
        setStream(stream)
      }, function (err) {console.error(err)})

  }, [])

  useEffect(() => {
    if (peer && !streamInitialized && readyToInitialize) {
      console.log("withinEffect")
      peer.on('signal', function(data){
        console.log("working", data)
        if (data.type === 'offer') {
          socket.emit('offer_to_user', {
            targetUser: targetUser,
            myID: myID,
            offer: data
          })
          document.getElementById('yourID').value = JSON.stringify(data)
      } else if (data.type === 'answer'){
          socket.emit('answer_to_user', {
            targetUser: targetUser,
            answer: data
          })
          document.getElementById('yourID').value = JSON.stringify(data)
      }
      })

      peer.on('data', function(data){
        // eslint-disable-next-line
        document.getElementById('messages').textContent = document.getElementById('messages').textContent + data + "\n" + "------\n"
      })

      peer.on('stream', function(stream){
        console.log("streamCalled", peer)
        console.log(stream)
        let video2 = document.getElementById('theirVideo');
        video2.width = 500
            
        //inserting our stream to the video tag     
        try {
        video2.srcObject = stream;
      } catch (error) {
        video2.src = window.URL.createObjectURL(stream);
      }
      })

      setStreamInitialized(true)
    }
    // eslint-disable-next-line
  }, [peer, streamInitialized, readyToInitialize])

  useEffect(() => {
    if(myID){
      socket.on('new_person', data => {
        setUsers(data.filter((userID => {
          return userID !== myID
        })))
      })
  
      socket.on('remove_user', (data) => {
        setUsers(data.filter((userID => {
          return userID !== myID
        })))
      })

      if(peer) {
      socket.on('incoming_offer', (data) => {
        console.log(`Incoming offer from ${data.offersID}: ${JSON.stringify(data.offer)} :: ${peer}`)
        document.getElementById('otherID').value = JSON.stringify(data.offer)
        // generate peerconnection. enter offer into remoteDescription. send back answer
        setTargetUser(data.offersID)

        
        peer.signal(data.offer)
        
        })
      }

      socket.on('incoming_answer', function(data){
        console.log(`Incoming answer: ${JSON.stringify(data)}`)
        document.getElementById('otherID').value = JSON.stringify(data)
      })

    }
    // eslint-disable-next-line
  }, [myID, peer, streamInitialized])

  const showUsers = () => {
    console.log(users)
  }

  const handleUserClick = async(e) => {
    setPeer(null)
    setStreamInitialized(false)
    setTargetUser(e.target.innerText)

    if (hasUserMedia()) { 
      navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia
      || navigator.mozGetUserMedia
    } else { 
        alert("WebRTC is not supported"); 
    }
  
    navigator.getUserMedia({ video: true, audio: true }, function (stream) { 
        setStream(stream, true)
      }, function (err) {console.error(err)})
    
  }

  const hasUserMedia = () => { 
    //check if the browser supports the WebRTC 
    return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || 
       navigator.mozGetUserMedia); 
  } 

  const setStream = (stream, initiate=false) => {

      setPeer(new Peer({
        initiator: initiate,
        trickle: false,
        stream: stream
      }))

    let video = document.getElementById('myVideo'); 
    video.width = 500
    try {
        video.srcObject = stream;
    } catch (error) {
        video.src = window.URL.createObjectURL(stream);
    }

    setReadyToInitialize(true)
  }


  return (
    <div className="App">

      {users.length > 0 ? <UserList users={users} handleUserClick={handleUserClick}></UserList> : null}

      <button onClick={showUsers}>Console.log users</button><br/>

      <label>Your ID:</label><br/>
      <textarea id="yourID"></textarea><br/>
      <label>Other ID:</label><br/>
      <textarea id="otherID"></textarea><br/>
      <button id="connect" onClick={hasUserMedia}>Connect </button><br/>

      <label>Enter message</label><br/>
      <textarea id="yourMessage"></textarea>
      <button id="send" onClick={hasUserMedia}>Send</button>
      <pre id="messages"></pre>
      <br></br>
      <br></br>
      <video id="myVideo" autoPlay></video><br/>
      <video id="theirVideo" autoPlay></video>

    </div>
  );
}

export default App;
