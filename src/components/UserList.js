import React from 'react'

export default function UserList(props) {
    const {users, handleUserClick} = props

    const listElements = users.map((user) => {
        return <li key={user} onClick={handleUserClick} style={{cursor: "pointer"}}>{user}</li>
    })

    return (
        <div>
            <ul style={{listStyleType: "none"}}>
                {listElements}
            </ul>
        </div>
    )
}
