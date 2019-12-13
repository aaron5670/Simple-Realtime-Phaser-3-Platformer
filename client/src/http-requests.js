import {URL, PORT} from './settings'

/*================================================
| Get own socketId
*/
export const GET_SocketId = () => (
    fetch(`${URL}:${PORT}/test`)
        .then(response => response.json())
        .then(data => console.log(data))
        .catch(error => console.log(error))
);

/*================================================
| Get all online players
*/
export const GET_Players = () => (
    fetch(`${URL}:${PORT}/players`)
        .then(response => response.json())
        .catch(error => console.log(error))
);
