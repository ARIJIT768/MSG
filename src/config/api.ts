import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = 'https://msg-3vgj.onrender.com/api';
const SOCKET_URL = 'https://msg-3vgj.onrender.com';

// Configure Axios
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Configure Socket.io
export const socket = io(SOCKET_URL, {
  autoConnect: false // We connect manually when user logs in
});
