import { useRef, useState } from 'react';

export default function MessageInput({ onSend, onTyping }) {
  const [text, setText] = useState('');
  const typingRef = useRef(false);
  const stopTimerRef = useRef(null);

  const fireTypingStop = () => {
    if (typingRef.current) {
      typingRef.current = false;
      onTyping?.(false);
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (!typingRef.current) {
      typingRef.current = true;
      onTyping?.(true);
    }
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(fireTypingStop, 1500);
  };

  const submit = (e) => {
    e?.preventDefault?.();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
    clearTimeout(stopTimerRef.current);
    fireTypingStop();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="msg-input" onSubmit={submit}>
      <textarea
        rows={1}
        placeholder="Type a message…"
        value={text}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onBlur={fireTypingStop}
      />
      <button type="submit" disabled={!text.trim()}>Send</button>
    </form>
  );
}
