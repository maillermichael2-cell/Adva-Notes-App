import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { chatApi } from '../api/client';

function displayName(user) {
    return user.first_name
        ? `${user.first_name} ${user.last_name}`.trim()
        : user.username;
}

const ChatPage = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [socketConnected, setSocketConnected] = useState(false);
    const [error, setError] = useState('');
    const socketRef = useRef(null);
    const messageListRef = useRef(null);

    useEffect(() => {
        let active = true;

        chatApi.getConversations()
            .then((result) => {
                if (!active) return;
                setConversations(result);
                setSelectedUserId(result[0]?.user.id ?? null);
            })
            .catch((requestError) => {
                if (active) setError(requestError.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const peerId = selectedUserId;
        if (!peerId) {
            return undefined;
        }

        let active = true;
        let socket;
        let reconnectTimer;
        let retryCount = 0;

        async function openConversation() {
            setMessages([]);
            setError('');
            setSocketConnected(false);

            try {
                const history = await chatApi.getMessages(peerId);
                if (!active) return;
                setMessages(history);

                const connect = async () => {
                    if (!active) return;
                    const protocols = await chatApi.getWebSocketProtocols();
                    if (!active) return;
                    socket = new WebSocket(
                        chatApi.getWebSocketUrl(peerId),
                        protocols,
                    );
                    socketRef.current = socket;

                    socket.onopen = () => {
                        retryCount = 0;
                        setSocketConnected(true);
                        setError('');
                    };
                    socket.onmessage = (event) => {
                        try {
                            const payload = JSON.parse(event.data);
                            if (payload.type === 'error') {
                                setError(payload.message);
                            } else if (payload.type === 'message') {
                                setMessages((current) => (
                                    current.some((message) => message.id === payload.message.id)
                                        ? current
                                        : [...current, payload.message]
                                ));
                            }
                        } catch {
                            setError('Received an unreadable chat response.');
                        }
                    };
                    socket.onerror = () => {
                        setError('Chat connection interrupted. Reconnecting...');
                    };
                    socket.onclose = (event) => {
                        setSocketConnected(false);
                        if (!active) return;
                        if (event.code === 4401 || event.code === 4403) {
                            setError('You must sign in and connect with this user to chat.');
                            return;
                        }
                        retryCount += 1;
                        const delay = Math.min(1000 * (2 ** (retryCount - 1)), 10000);
                        reconnectTimer = window.setTimeout(connect, delay);
                    };
                };

                connect();
            } catch (requestError) {
                if (active) setError(requestError.message);
            }
        }

        openConversation();
        return () => {
            active = false;
            window.clearTimeout(reconnectTimer);
            socketRef.current = null;
            if (socket && socket.readyState < WebSocket.CLOSING) {
                socket.close(1000, 'Conversation changed');
            }
        };
    }, [selectedUserId]);

    useEffect(() => {
        messageListRef.current?.scrollTo({
            top: messageListRef.current.scrollHeight,
            behavior: 'smooth',
        });
    }, [messages]);

    const handleSubmit = (event) => {
        event.preventDefault();
        const message = draft.trim();
        const socket = socketRef.current;
        if (!message || !socket || socket.readyState !== WebSocket.OPEN) {
            if (!socketConnected) setError('Waiting for the chat connection. Try again shortly.');
            return;
        }

        socket.send(JSON.stringify({ message }));
        setDraft('');
        setError('');
    };

    const selectedConversation = conversations.find(
        ({ user }) => user.id === selectedUserId,
    );

    if (loading) {
        return <main className="landingPage"><h1>Loading chats...</h1></main>;
    }

    return (
        <main className="landingPage chatPage">
            <header className="chatHeader">
                <div>
                    <Link to="/" className="actionButton">Back to tools</Link>
                    <h1>Chat</h1>
                    <p>Message users you have connected with.</p>
                </div>
                <Link to="/connect" className="actionButton">Connect with someone</Link>
            </header>

            {error && <div className="connectNotice connectError" role="alert">{error}</div>}

            {conversations.length === 0 ? (
                <section className="connectPanel chatEmptyState">
                    <span className="techMeta">// NO_CONNECTIONS_YET</span>
                    <h2>Connect before you chat</h2>
                    <p>Scan someone&apos;s QR code from the Connect page to start a conversation.</p>
                    <Link to="/connect" className="actionButton">Go to Connect</Link>
                </section>
            ) : (
                <section className="chatLayout">
                    <nav className="chatContacts" aria-label="Connected users">
                        <h2>Connections</h2>
                        {conversations.map(({ user, last_message: lastMessage }) => (
                            <button
                                className={`chatContact${user.id === selectedUserId ? ' isSelected' : ''}`}
                                key={user.id}
                                onClick={() => setSelectedUserId(user.id)}
                                type="button"
                            >
                                <span className="chatAvatar" aria-hidden="true">
                                    {(user.first_name || user.username).charAt(0).toUpperCase()}
                                </span>
                                <span className="chatContactText">
                                    <strong>{displayName(user)}</strong>
                                    <small>
                                        {lastMessage?.content || `@${user.username}`}
                                    </small>
                                </span>
                            </button>
                        ))}
                    </nav>

                    <section className="chatConversation" aria-label="Conversation">
                        {selectedConversation && (
                            <header className="chatConversationHeader">
                                <div>
                                    <h2>{displayName(selectedConversation.user)}</h2>
                                    <span className="chatConnectionStatus">
                                        <span className={socketConnected ? 'statusDot isOnline' : 'statusDot'} />
                                        {socketConnected ? 'Live' : 'Connecting...'}
                                    </span>
                                </div>
                            </header>
                        )}
                        <div className="chatMessages" ref={messageListRef} aria-live="polite">
                            {messages.length === 0 ? (
                                <p className="chatNoMessages">Say hello to start the conversation.</p>
                            ) : messages.map((message) => (
                                <article
                                    className={`chatMessage${message.sender === selectedConversation?.user.id ? ' isReceived' : ' isSent'}`}
                                    key={message.id}
                                >
                                    <p>{message.content}</p>
                                    <time dateTime={message.created_at}>
                                        {new Date(message.created_at).toLocaleTimeString([], {
                                            hour: 'numeric',
                                            minute: '2-digit',
                                        })}
                                    </time>
                                </article>
                            ))}
                        </div>
                        <form className="chatComposer" onSubmit={handleSubmit}>
                            <input
                                aria-label="Message"
                                autoComplete="off"
                                maxLength={2000}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder="Write a message..."
                                value={draft}
                            />
                            <button
                                className="actionButton"
                                disabled={!socketConnected || !draft.trim()}
                                type="submit"
                            >
                                Send
                            </button>
                        </form>
                    </section>
                </section>
            )}
        </main>
    );
};

export default ChatPage;
