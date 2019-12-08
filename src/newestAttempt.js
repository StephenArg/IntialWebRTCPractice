import React, { useEffect, useState, Fragment } from 'react';
import './App.css';
import openSocket from 'socket.io-client';
import UserList from './components/UserList'

var socket = openSocket('http://localhost:8000');
var peerConnection
var myStream
var localVideo
var remoteVideo
var pcConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {"urls":"turn:numb.viagenie.ca", "username":"webrtc@live.com", "credential":"muazkh"}
  ]
  };
var targetUser
var dataChannel

function App() {
    const [myID, setMyID] = useState(null)
    const [users, setUsers] = useState([])
    const [myLocation, setMyLocation] = useState(null)
    const [showTextInput, setShowTextInput] = useState(false)
    const [streamInitialized, setStreamInitialized] = useState(false)
    const [readyToInitialize, setReadyToInitialize] = useState(false)


    useEffect(() => {

        fetch("https://geolocation-db.com/json/")
        .then(res => res.json())
        .then(data => {
            console.log(data)
            const location = data.state ? `${data.state}, ${data.country_name}` : `${data.country_name}`
            setMyLocation(location)})

        socket.on('get_id', data => {
            setMyID(data.myID)
            setUsers(data.users)
        })

    }, [])

    useEffect(() => {
        if (myID) {
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

            socket.on('incoming_offer', async(data) => {
                console.log(`Incoming offer from ${data.offersID}: ${JSON.stringify(data.offer)}`)
                targetUser = data.offersID

                myStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
                setStream()
                peerConnection = new RTCPeerConnection(pcConfig)
                myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream))
                peerConnection.ondatachannel = receiveDataChannel
                // dataChannel = peerConnection.createDataChannel('text', {
                //     ordered: true, // guarantees order
                //     maxPacketLifeTime: 3000
                //   })
                // dataChannel.onopen = () => {console.log("DataChannel Open")}
                // dataChannel.onmessage = dataChannelMessage
                peerConnection.setRemoteDescription(data.offer)
                peerConnection.ontrack = receivedStream
                peerConnection.onicecandidate = sendIceCandidate
                peerConnection.createAnswer().then((answer) => {
                    peerConnection.setLocalDescription(answer)
                    socket.emit('answer_to_user', {
                        targetUser: data.offersID,
                        answer: answer
                    })
                    document.getElementById('yourID').value = JSON.stringify(answer)
                })

                document.getElementById('otherID').value = JSON.stringify(data.offer)
                // setStreamInitialized(true)
            })

            socket.on('incoming_answer', function (data) {
                console.log(`Incoming answer: ${JSON.stringify(data)}`)
                peerConnection.setRemoteDescription(data)
                document.getElementById('otherID').value = JSON.stringify(data)
                console.log(peerConnection)
                setShowTextInput(true)
                // setStreamInitialized(true)
            })

            socket.on("incoming_candidate", function (candidate){
                console.log("candidate", candidate)
                if (peerConnection) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                }
            })
        }
    }, [myID])

    const handleUserClick = async(e) => {
        const tempTargetUser = e.target.innerText
        targetUser = tempTargetUser

        myStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        setStream()
        peerConnection = new RTCPeerConnection(pcConfig)
        myStream.getTracks().forEach(track => peerConnection.addTrack(track, myStream))
        dataChannel = peerConnection.createDataChannel('text', {
            ordered: true, // guarantees order
            maxPacketLifeTime: 3000
          })
        dataChannel.onopen = () => {console.log("DataChannel Open")}
        dataChannel.onmessage = dataChannelMessage
        peerConnection.ontrack = receivedStream
        peerConnection.onicecandidate = sendIceCandidate

        peerConnection.createOffer().then((offer) => {
            peerConnection.setLocalDescription(offer)
            socket.emit('offer_to_user', {
                targetUser: tempTargetUser,
                myID: myID,
                offer: offer
            })
            document.getElementById('yourID').value = JSON.stringify(offer)
        })

    }

    const hasUserMedia = () => { 
        //check if the browser supports the WebRTC 
        return !!(navigator.getUserMedia || navigator.webkitGetUserMedia || 
           navigator.mozGetUserMedia); 
      } 

    const sendTextMessage = () => {
        const textarea = document.getElementById('yourMessage')
        let messagesContainer = document.getElementById('messages')

        messagesContainer.textContent = messagesContainer.textContent + "Me: " + textarea.value + "\n" + "------\n"
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        dataChannel.send(textarea.value)
        textarea.value = ""
    }

    const handleTextAreaEnter = (event) => {
        if (event.key === "Enter") {
            const textarea = document.getElementById('yourMessage')
            textarea.value = textarea.value.slice(0,-1)
            sendTextMessage()
        }
    }
    
    const setStream = () => {
        localVideo = document.getElementById('myVideo'); 
        localVideo.width = 500
        localVideo.muted = true
        try {
            localVideo.srcObject = myStream;
        } catch (error) {
            localVideo.src = window.URL.createObjectURL(myStream);
        }

        setReadyToInitialize(true)
    }

    const receivedStream = (event) => {
        remoteVideo = document.getElementById('theirVideo')
        remoteVideo.width = 500

        console.log(event)
        try {
            remoteVideo.srcObject = event.streams[0];
        } catch (error) {
            remoteVideo.src = window.URL.createObjectURL(event.streams[0]);
        }
        
        console.log(localVideo.srcObject)
        console.log(remoteVideo.srcObject)
    }

    const sendIceCandidate = (event) => {
        if (event.candidate) {
            socket.emit('candidate', {candidate: event.candidate, targetUser: targetUser})
        }
    }

    const dataChannelMessage = (event) => {
        let messagesContainer = document.getElementById('messages')
        messagesContainer.textContent = messagesContainer.textContent + event.data + "\n" + "------\n"
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    const receiveDataChannel = (event) => {
        dataChannel = event.channel
        dataChannel.onopen = () => {console.log("DataChannel Open")}
        dataChannel.onmessage = dataChannelMessage
        setShowTextInput(true)
    }

    return (
        <div className="App">

            {users.length > 0 ? <UserList users={users} handleUserClick={handleUserClick}></UserList> : null}

            <button >Users</button><br />
            
            <strong>{myLocation}</strong><br/>

            <video id="myVideo" autoPlay></video>
            <spacer type="block"> </spacer>
            <video id="theirVideo" autoPlay></video>
            <br></br>
            <br></br>
            { showTextInput ? 
            <Fragment>
            <label>Enter message</label><br />
            <input id="yourMessage" type="text" style={{width: 190, height: 25, fontSize: 16}} onKeyUp={handleTextAreaEnter}></input>
            <button id="send" onClick={sendTextMessage}>Send</button>
            <pre id="messages" style={{maxHeight: 150, overflowY: "scroll"}}></pre> <br />
            </Fragment>
            : null
            }
            
            <label>Your ID:</label><br />
            <textarea id="yourID"></textarea><br />
            <label>Other ID:</label><br />
            <textarea id="otherID"></textarea><br />

        </div>
    );
}

export default App;