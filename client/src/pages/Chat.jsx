import { useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import CreateGroupModal from '../components/CreateGroupModal.jsx';
import GroupSettingsModal from '../components/GroupSettingsModal.jsx';
import CallModal from '../components/CallModal.jsx';
import IncomingCallModal from '../components/IncomingCallModal.jsx';

export default function Chat() {
  const { user, logout } = useAuth();
  const { socket, connected } = useSocket();

  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Call state
  const [incoming, setIncoming] = useState(null); // { fromUserId, callType, from }
  const [activeCall, setActiveCall] = useState(null); // { peerId, callType, role }

  const activeRoom = rooms.find((r) => r._id === activeRoomId) || null;

  const refreshRooms = useCallback(async () => {
    const { data } = await api.get('/rooms');
    setRooms(data.rooms);
    return data.rooms;
  }, []);

  useEffect(() => { refreshRooms(); }, [refreshRooms]);

  // Join all room channels for live updates
  useEffect(() => {
    if (!socket) return;
    rooms.forEach((r) => socket.emit('room:join', r._id));
  }, [socket, rooms]);

  // Real-time wiring
  useEffect(() => {
    if (!socket) return;

    const onNew = (payload) => setRooms((rs) => [payload, ...rs.filter((r) => r._id !== payload._id)]);
    const onUpdate = (payload) => setRooms((rs) => rs.map((r) => (r._id === payload._id ? payload : r)));
    const onBump = ({ roomId, lastMessage }) =>
      setRooms((rs) => {
        const idx = rs.findIndex((r) => r._id === roomId);
        if (idx < 0) return rs;
        const updated = { ...rs[idx], lastMessage, updatedAt: new Date().toISOString() };
        return [updated, ...rs.slice(0, idx), ...rs.slice(idx + 1)];
      });
    const onIncoming = (data) => setIncoming(data);
    const onCancelled = () => setIncoming(null);

    socket.on('room:new', onNew);
    socket.on('room:update', onUpdate);
    socket.on('room:bump', onBump);
    socket.on('call:incoming', onIncoming);
    socket.on('call:cancelled', onCancelled);
    return () => {
      socket.off('room:new', onNew);
      socket.off('room:update', onUpdate);
      socket.off('room:bump', onBump);
      socket.off('call:incoming', onIncoming);
      socket.off('call:cancelled', onCancelled);
    };
  }, [socket]);

  const startCall = (peerId, callType) => setActiveCall({ peerId, callType, role: 'caller' });
  const acceptIncoming = () => {
    if (!incoming) return;
    setActiveCall({ peerId: incoming.fromUserId, callType: incoming.callType, role: 'callee' });
    setIncoming(null);
  };
  const rejectIncoming = () => {
    if (!incoming) return;
    socket?.emit('call:reject', { toUserId: incoming.fromUserId });
    setIncoming(null);
  };

  const onPickRoom = (id) => {
    setActiveRoomId(id);
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  return (
    <div className="chat-app">
      <Sidebar
        visible={showSidebar}
        rooms={rooms}
        activeRoomId={activeRoomId}
        currentUser={user}
        connected={connected}
        onPickRoom={onPickRoom}
        onCreateGroup={() => setShowCreateGroup(true)}
        onLogout={logout}
        onRoomsChanged={refreshRooms}
      />
      <ChatWindow
        room={activeRoom}
        currentUser={user}
        onBack={() => setShowSidebar(true)}
        onOpenSettings={() => setShowGroupSettings(true)}
        onStartCall={startCall}
      />

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={(room) => { setShowCreateGroup(false); setActiveRoomId(room._id); refreshRooms(); }}
        />
      )}
      {showGroupSettings && activeRoom?.isGroup && (
        <GroupSettingsModal
          room={activeRoom}
          currentUser={user}
          onClose={() => setShowGroupSettings(false)}
          onChanged={refreshRooms}
        />
      )}
      {incoming && (
        <IncomingCallModal data={incoming} onAccept={acceptIncoming} onReject={rejectIncoming} />
      )}
      {activeCall && (
        <CallModal
          call={activeCall}
          currentUser={user}
          onClose={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
