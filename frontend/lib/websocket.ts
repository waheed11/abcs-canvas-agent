export function connectWebSocket(url: string, onMessage: (data: any) => void) {
  const socket = new WebSocket(url);

  socket.onopen = () => {
    console.log('Connected to WebSocket:', url);
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('Error parsing WebSocket message', e);
    }
  };

  socket.onclose = () => {
    console.log('Disconnected from WebSocket:', url);
  };

  return socket;
}
