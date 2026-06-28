import axios from 'axios';
import { io } from 'socket.io-client';

const isProd = import.meta.env.PROD;
const API_URL = isProd ? '/api' : 'http://10.197.91.148:3001/api';
const SOCKET_URL = isProd ? '' : 'http://10.197.91.148:3001';

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
