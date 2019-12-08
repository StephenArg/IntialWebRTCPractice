import React from 'react'

export default function UserList(props) {
    const {users, handleUserClick} = props

    const listElements = users.map((user) => {
        return <li onClick={handleUserClick}>{user}</li>
    })

    return (
        <div>
            <ul style={{listStyleType: "none"}}>
                {listElements}
            </ul>
        </div>
    )
}
