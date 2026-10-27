import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { connectApi, GOOGLE_LOGIN_URL } from '../api/client';

const ConnectPage = () => {
    const [loading, setLoading] = useState(true);
    const [sessionLoadFailed, setSessionLoadFailed] = useState(false);
    const [sessionRetry, setSessionRetry] = useState(0);
    const [authenticated, setAuthenticated] = useState(false);
    const [googleConfigured, setGoogleConfigured] = useState(false);
    const [csrfToken, setCsrfToken] = useState('');
    const [user, setUser] = useState(null);
    const [connections, setConnections] = useState([]);
    const [qrToken, setQrToken] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [manualToken, setManualToken] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [scannerError, setScannerError] = useState('');
    const scanHandlerRef = useRef(null);
    const scanInProgressRef = useRef(false);

    const refreshConnections = useCallback(async () => {
        const result = await connectApi.getConnections();
        setUser(result.user);
        setConnections(result.connections);
    }, []);

    const createQrToken = useCallback(async () => {
        const result = await connectApi.createQrToken();
        setQrToken(result.token);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function initialize() {
            try {
                const session = await connectApi.getSession();
                if (cancelled) return;

                setAuthenticated(session.authenticated);
                setGoogleConfigured(session.google_oauth_configured);
                setCsrfToken(session.csrf_token);
                setUser(session.user);

                if (session.authenticated) {
                    const [connectionResult, qrResult] = await Promise.all([
                        connectApi.getConnections(),
                        connectApi.createQrToken(),
                    ]);
                    if (cancelled) return;
                    setUser(connectionResult.user);
                    setConnections(connectionResult.connections);
                    setQrToken(qrResult.token);
                }
            } catch (requestError) {
                if (!cancelled) {
                    setError(requestError.message);
                    setSessionLoadFailed(true);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        initialize();
        return () => {
            cancelled = true;
        };
    }, [sessionRetry]);

    const handleScan = useCallback(async (token) => {
        if (scanInProgressRef.current) return;
        scanInProgressRef.current = true;
        setIsScanning(false);
        setError('');
        setMessage('');

        try {
            const result = await connectApi.scanQrCode(token);
            await refreshConnections();
            setMessage(
                result.created
                    ? `Connected with ${result.connection.connected_user.username}.`
                    : `You are already connected with ${result.connection.connected_user.username}.`,
            );
            setManualToken('');
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            scanInProgressRef.current = false;
        }
    }, [refreshConnections]);

    scanHandlerRef.current = handleScan;

    useEffect(() => {
        if (!isScanning) return undefined;

        let active = true;
        let scanner;

        async function startScanner() {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (!active) return;
                scanner = new Html5Qrcode('connect-qr-reader');
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 240, height: 240 } },
                    (decodedText) => {
                        if (active) {
                            scanHandlerRef.current?.(decodedText);
                        }
                    },
                    () => {},
                );
                if (!active && scanner.isScanning) {
                    await scanner.stop();
                    scanner.clear();
                }
            } catch (cameraError) {
                if (active) {
                    setScannerError(cameraError.message);
                    setIsScanning(false);
                }
            }
        }

        startScanner();
        return () => {
            active = false;
            if (scanner?.isScanning) {
                scanner.stop()
                    .then(() => scanner.clear())
                    .catch((stopError) => {
                        console.error('Could not stop the QR scanner cleanly.', stopError);
                    });
            }
        };
    }, [isScanning]);

    const handleLogout = async () => {
        setError('');
        try {
            await connectApi.logout();
            setAuthenticated(false);
            setUser(null);
            setConnections([]);
            setQrToken('');
            setMessage('You have been signed out.');
        } catch (requestError) {
            setError(requestError.message);
        }
    };

    const handleRefreshQr = async () => {
        setError('');
        try {
            await createQrToken();
        } catch (requestError) {
            setError(requestError.message);
        }
    };

    if (loading) {
        return (
            <main className="landingPage connectPage">
                <h1>Loading connections</h1>
                <p>Checking your account session.</p>
            </main>
        );
    }

    return (
        <main className="landingPage connectPage">
            <header className="connectHeader">
                <div>
                    <Link to="/" className="actionButton connectBackLink">
                        Back to tools
                    </Link>
                    <h1>Connect</h1>
                    <p>Scan a user QR code to connect instantly.</p>
                </div>
                {authenticated && (
                    <button
                        className="actionButton connectLogoutButton"
                        onClick={handleLogout}
                        type="button"
                    >
                        Sign out
                    </button>
                )}
            </header>

            {error && <div className="connectNotice connectError" role="alert">{error}</div>}
            {message && <div className="connectNotice connectSuccess" role="status">{message}</div>}

            {sessionLoadFailed ? (
                <section className="connectPanel connectSignIn">
                    <span className="techMeta">// CONNECTION_ERROR</span>
                    <h2>Could not load account status</h2>
                    <p>Check your connection, then retry. Your sign-in configuration has not been verified yet.</p>
                    <button
                        className="actionButton"
                        onClick={() => {
                            setError('');
                            setSessionLoadFailed(false);
                            setLoading(true);
                            setSessionRetry((retry) => retry + 1);
                        }}
                        type="button"
                    >
                        Retry
                    </button>
                </section>
            ) : !authenticated ? (
                <section className="connectPanel connectSignIn">
                    <span className="techMeta">// ACCOUNT_REQUIRED</span>
                    <h2>Sign in to connect</h2>
                    <p>Use Google to create or access your account before sharing or scanning a QR code.</p>
                    {googleConfigured ? (
                        <form
                            className="connectOAuthForm"
                            method="post"
                            action={GOOGLE_LOGIN_URL}
                        >
                            <input
                                type="hidden"
                                name="csrfmiddlewaretoken"
                                value={csrfToken}
                            />
                            <button className="actionButton" type="submit">
                                Continue with Google
                            </button>
                        </form>
                    ) : (
                        <p className="connectSetupHint">
                            Google sign-in is not configured yet. Add the Google client ID and secret
                            to the backend environment, then restart Django.
                        </p>
                    )}
                </section>
            ) : (
                <>
                    <section className="connectWelcome">
                        <span className="techMeta">// SIGNED_IN_AS</span>
                        <h2>{user?.first_name || user?.username}</h2>
                        {user?.first_name && user?.username !== user.first_name && (
                            <span className="connectUsername">@{user.username}</span>
                        )}
                    </section>

                    <div className="connectGrid">
                        <section className="connectPanel">
                            <span className="techMeta">// YOUR_QR_CODE</span>
                            <h2>Let someone scan you</h2>
                            <p>Your private QR token is signed and expires after five minutes.</p>
                            {qrToken && (
                                <div className="connectQrFrame">
                                    <QRCodeSVG
                                        value={qrToken}
                                        size={224}
                                        level="M"
                                        title="Your connect QR code"
                                    />
                                </div>
                            )}
                            <button
                                className="actionButton"
                                onClick={handleRefreshQr}
                                type="button"
                            >
                                Generate a fresh QR code
                            </button>
                        </section>

                        <section className="connectPanel">
                            <span className="techMeta">// SCAN_TO_CONNECT</span>
                            <h2>Scan someone&apos;s QR</h2>
                            {!isScanning ? (
                                <button
                                    className="actionButton"
                                    onClick={() => {
                                        setScannerError('');
                                        setIsScanning(true);
                                    }}
                                    type="button"
                                >
                                    Open camera scanner
                                </button>
                            ) : (
                                <button
                                    className="actionButton"
                                    onClick={() => setIsScanning(false)}
                                    type="button"
                                >
                                    Close scanner
                                </button>
                            )}
                            {isScanning && <div className="connectScanner" id="connect-qr-reader" />}
                            {scannerError && (
                                <p className="connectErrorText" role="alert">{scannerError}</p>
                            )}
                            <form
                                className="connectManualForm"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleScan(manualToken.trim());
                                }}
                            >
                                <label htmlFor="connect-token">Or enter a QR token</label>
                                <input
                                    id="connect-token"
                                    value={manualToken}
                                    onChange={(event) => setManualToken(event.target.value)}
                                    autoComplete="off"
                                    required
                                />
                                <button className="actionButton" type="submit">
                                    Connect
                                </button>
                            </form>
                        </section>
                    </div>

                    <section className="connectConnections">
                        <div className="connectSectionHeading">
                            <span className="techMeta">// YOUR_CONNECTIONS</span>
                            <span className="connectCount">{connections.length}</span>
                        </div>
                        {connections.length > 0 ? (
                            <ul className="connectList">
                                {connections.map(({ id, connected_user: connectedUser }) => (
                                    <li className="connectListItem" key={id}>
                                        <span className="connectAvatar" aria-hidden="true">
                                            {(connectedUser.first_name || connectedUser.username)
                                                .charAt(0)
                                                .toUpperCase()}
                                        </span>
                                        <span>
                                            <strong>
                                                {connectedUser.first_name
                                                    ? `${connectedUser.first_name} ${connectedUser.last_name}`.trim()
                                                    : connectedUser.username}
                                            </strong>
                                            <small>@{connectedUser.username}</small>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="emptyStateCard">
                                <div className="emptyStateIcon">// NO_CONNECTIONS_YET</div>
                                <h2 className="emptyStateTitle">Your network starts here</h2>
                                <p className="emptyStateText">
                                    Share your QR code or scan another user&apos;s code to connect.
                                </p>
                            </div>
                        )}
                    </section>
                </>
            )}
        </main>
    );
};

export default ConnectPage;
