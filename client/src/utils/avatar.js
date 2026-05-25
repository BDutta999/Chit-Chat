// Generates a deterministic color from a string (for avatar initials background).
export function colorFor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 45%)`;
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';
}

// Resolve a display name + avatar for a Room from current user's perspective.
export function roomDisplay(room, currentUserId) {
  if (!room) return { name: '', avatar: '', subtitle: '' };
  if (room.isGroup) {
    return {
      name: room.name || 'Group',
      avatar: room.avatar || '',
      subtitle: `${room.members?.length || 0} members`,
    };
  }
  const other = (room.members || []).find((m) => String(m._id) !== String(currentUserId));
  return {
    name: other?.name || 'Direct',
    avatar: other?.avatar || '',
    subtitle: other?.online ? 'online' : 'offline',
    other,
  };
}
