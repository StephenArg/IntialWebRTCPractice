import React, { useEffect, useState, Fragment } from 'react';
import './App.css';
import openSocket from 'socket.io-client';
import UserList from './components/UserList'
// const port = process.env.PORT || 8000;

// console.log(`ws://${window.location.hostname}:${port}`)
var socket = openSocket(window.location.origin.replace(/^http/, 'ws'));
var peerConnection
var myStream
var streamSenders = []
var localVideo
var remoteVideo
var pcConfig = {
    'iceServers': [
      {'urls': 'stun:stun.l.google.com:19302'},
      {"urls":"turn:numb.viagenie.ca", "username":"webrtc@live.com", "credential":"muazkh"}
  ]
  };
var constraints = { video: true, audio: true };
var targetUser
var dataChannel
var myLocation
var allowRenegotionation = false

function App() {
    const [myID, setMyID] = useState(null)
    const [users, setUsers] = useState([])
    const [remoteLocation, setRemoteLocation] = useState(null)
    const [showTextInput, setShowTextInput] = useState(false)
    const [screenShareBtnText, setScreenShareBtnText] = useState("Start ScreenShare")
    // const [allowRenegotionation, setAllowRenegotiation] = useState(false)
    const [streamInitialized, setStreamInitialized] = useState(false)
    const [readyToInitialize, setReadyToInitialize] = useState(false)


    useEffect(() => {

        fetch("https://geolocation-db.com/json/")
        .then(res => res.json())
        .then(data => {
            console.log(data)
            const location = data.state ? `${data.state}, ${data.country_name}` : `${data.country_name}`
            myLocation = location})

        socket.on('get_id', data => {
            console.log("Connected to websocket")
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
                setRemoteLocation(data.location)

                myStream = await navigator.mediaDevices.getUserMedia(constraints);
                setStream()
                peerConnection = new RTCPeerConnection(pcConfig)
                myStream.getTracks().forEach((track) => {
                    let sender = peerConnection.addTrack(track, myStream)
                    streamSenders.push(sender)
                })
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
                peerConnection.onnegotiationneeded = handleNegotiation
                generateAnswer(false)

                document.getElementById('otherID').value = JSON.stringify(data.offer)
                // setStreamInitialized(true)
            })

            socket.on('incoming_answer', function (data) {
                setRemoteLocation(data.location)
                console.log(`Incoming answer: ${JSON.stringify(data.answer)}`)
                peerConnection.setRemoteDescription(data.answer)
                document.getElementById('otherID').value = JSON.stringify(data.answer)
                console.log(peerConnection)
                setShowTextInput(true)
                setTimeout(() => {
                    allowRenegotionation = true
                }, 2000)
                // setStreamInitialized(true)
            })

            socket.on("incoming_candidate", function (candidate){
                console.log("candidate", candidate)
                if (peerConnection) {
                    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                }
            })

            socket.on("incoming_renegotiation_offer", function(data){
                console.log(data)
                console.log(peerConnection)
                peerConnection.setRemoteDescription(data.offer)
                generateAnswer(true, data)
                document.getElementById('otherID').value = JSON.stringify(data.offer)
            })

            socket.on("incoming_renegotiation_answer", function(data){
                console.log(data)
                peerConnection.setRemoteDescription(data.answer)
                document.getElementById('otherID').value = JSON.stringify(data.answer)
            })
        }
    }, [myID])

    const generateOffer = (renegotiation = false, data = false) => {
        let socketRoute
        if (renegotiation && allowRenegotionation) {
            socketRoute = 'renegotiation_offer_to_user'
        } else if (!renegotiation) {
            socketRoute = 'offer_to_user'
        }

        console.log("genOffer", renegotiation, allowRenegotionation, socketRoute)

        if (socketRoute) {
            peerConnection.createOffer().then((offer) => {
                peerConnection.setLocalDescription(offer)
                socket.emit(socketRoute, {
                    targetUser: targetUser,
                    myID: myID,
                    offer: offer,
                    location: myLocation
                })
                document.getElementById('yourID').value = JSON.stringify(offer)
            })
        }
    }

    const generateAnswer = (renegotiation = false, data = false) => {
        let socketRoute
        if (renegotiation && allowRenegotionation) {
            socketRoute = 'renegotiation_answer_to_user'
        } else if (!renegotiation) {
            socketRoute = 'answer_to_user'
        }

        console.log("genAnswer", renegotiation, allowRenegotionation, socketRoute)

        if (socketRoute) {
            peerConnection.createAnswer().then((answer) => {
                peerConnection.setLocalDescription(answer)
                socket.emit(socketRoute, {
                    targetUser: targetUser,
                    answer: answer,
                    location: myLocation
                })
                document.getElementById('yourID').value = JSON.stringify(answer)
            })
            setTimeout(() => {
                allowRenegotionation = true
            }, 2000)
        }
    } 

    const handleUserClick = async(e) => {
        // const tempTargetUser = e.target.innerText
        targetUser = e.target.innerText

        myStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream()
        peerConnection = new RTCPeerConnection(pcConfig)
        myStream.getTracks().forEach((track) => {
            let sender = peerConnection.addTrack(track, myStream)
            streamSenders.push(sender)
        })
        dataChannel = peerConnection.createDataChannel('text', {
            ordered: true, // guarantees order
            maxPacketLifeTime: 3000
          })
        dataChannel.onopen = () => {console.log("DataChannel Open")}
        dataChannel.onmessage = dataChannelMessage
        peerConnection.ontrack = receivedStream
        peerConnection.onicecandidate = sendIceCandidate
        peerConnection.onnegotiationneeded = handleNegotiation

        generateOffer()

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
            textarea.value = textarea.value
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

    // const handleTrack = (event) => {
    //     remoteVideo = document.getElementById('theirVideo')
    //     remoteVideo.width = 500
    //     console.log(event)
    //     if (event.streams && event.streams[0]) {
    //         remoteVideo.srcObject = event.streams[0];
    //     } else {
    //         let inboundStream = new MediaStream(event.track[0]);
    //         remoteVideo.srcObject = inboundStream;
    //     }
    // }

    const handleNegotiation = async (event) => {
        console.log("here", event)
        generateOffer(true, event)
    }

    const handleScreenShare = async () => {
        
        if (screenShareBtnText === "Start ScreenShare") {
            let tempMyStream = await navigator.mediaDevices.getDisplayMedia()
            myStream.getTracks().forEach((track) => {
                track.stop()
            })
            myStream = tempMyStream
            setScreenShareBtnText("Start Video")
        } else {
            let tempMyStream = await navigator.mediaDevices.getUserMedia(constraints);
            myStream.getTracks().forEach((track) => {
                track.stop()
            })
            myStream = tempMyStream
            setScreenShareBtnText("Start ScreenShare")
        }
        console.log(myStream.getTracks())
        console.log(peerConnection)

        localVideo = document.getElementById('myVideo'); 
        localVideo.width = 500
        localVideo.muted = true
        try {
            localVideo.srcObject = myStream;
        } catch (error) {
            localVideo.src = window.URL.createObjectURL(myStream);
        }
    

        streamSenders.forEach((sender) => {
            peerConnection.removeTrack(sender)
        })

        streamSenders = []

        myStream.getTracks().forEach((track) => {
           let sender = peerConnection.addTrack(track, myStream)
           streamSenders.push(sender)
        })

        console.log(peerConnection)

    }

    return (
        <div className="App">

            {users.length > 0 ? <UserList users={users} handleUserClick={handleUserClick}></UserList> : null}

            <button onClick={handleScreenShare}>{screenShareBtnText}</button><br />
            
            {remoteLocation && targetUser ? 
            <Fragment>
                <strong id="remote-user">Connected to: {targetUser}</strong><br/>
                <strong id="remote-location">Location: {remoteLocation}</strong><br/>
            </Fragment> : null
            }

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