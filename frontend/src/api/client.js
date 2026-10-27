const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/V1'
).replace(/\/+$/, '');

export const BACKEND_ORIGIN = (
    import.meta.env.VITE_BACKEND_ORIGIN || new URL(API_BASE_URL).origin
).replace(/\/+$/, '');

export const GOOGLE_LOGIN_URL = `${BACKEND_ORIGIN}/accounts/google/login/`;

let accessToken = null;
let refreshRequest = null;

function createRequestError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}

async function readResponse(response) {
    if (response.status === 204) {
        return null;
    }

    let payload;
    try {
        payload = await response.json();
    } catch (parseError) {
        if (!response.ok) {
            throw createRequestError(`Request failed (${response.status}).`, response.status);
        }
        throw parseError;
    }

    if (!response.ok) {
        if (payload && typeof payload.detail === 'string') {
            throw createRequestError(payload.detail, response.status);
        }
        const details = payload && typeof payload === 'object'
            ? Object.values(payload)
                .flat()
                .map((detail) => (
                    typeof detail === 'string' ? detail : JSON.stringify(detail)
                ))
            : [];
        throw createRequestError(
            details.join(' ') || `Request failed (${response.status}).`,
            response.status,
        );
    }

    return payload;
}

async function refreshAccessToken() {
    if (!refreshRequest) {
        refreshRequest = fetch(`${API_BASE_URL}/connect/token/refresh/`, {
            method: 'POST',
            credentials: 'include',
        })
            .then(readResponse)
            .then((payload) => {
                accessToken = payload.access;
                return accessToken;
            })
            .finally(() => {
                refreshRequest = null;
            });
    }

    return refreshRequest;
}

async function request(path, options = {}, retryAfterRefresh = true) {
    const {
        body,
        csrfToken,
        authenticated = true,
        headers: suppliedHeaders,
        ...fetchOptions
    } = options;
    const headers = new Headers(suppliedHeaders);

    if (authenticated && !accessToken) {
        try {
            await refreshAccessToken();
        } catch (error) {
            if (error.status === 401) {
                throw createRequestError('You must sign in to continue.', 401);
            }
            throw error;
        }
    }

    if (body !== undefined) {
        headers.set('Content-Type', 'application/json');
    }
    if (csrfToken) {
        headers.set('X-CSRFToken', csrfToken);
    }
    if (authenticated) {
        headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE_URL}/${path.replace(/^\/+/, '')}`, {
        ...fetchOptions,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 401 && authenticated && retryAfterRefresh) {
        accessToken = null;
        try {
            await refreshAccessToken();
        } catch (error) {
            if (error.status === 401) {
                throw createRequestError('Your sign-in has expired. Please sign in again.', 401);
            }
            throw error;
        }
        return request(path, options, false);
    }

    return readResponse(response);
}

export const notesApi = {
    list: () => request('notes/'),
    get: (id) => request(`notes/${id}/`),
    create: (note) => request('notes/', { method: 'POST', body: note }),
    update: (id, note) => request(`notes/${id}/`, {
        method: 'PUT',
        body: note,
    }),
    delete: (id) => request(`notes/${id}/`, { method: 'DELETE' }),
};

export const chatApi = {
    getConversations: () => request('chat/conversations/'),
    getMessages: (peerId) => request(`chat/conversations/${peerId}/messages/`),
    getWebSocketUrl: (peerId) => {
        const url = new URL(API_BASE_URL);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        url.pathname = `/ws/chat/${peerId}/`;
        url.search = '';
        return url.toString();
    },
    getWebSocketProtocols: async () => {
        if (!accessToken) {
            await refreshAccessToken();
        }
        return ['bearer', accessToken];
    },
};

export const connectApi = {
    getSession: async () => {
        let session = await request('connect/session/', { authenticated: false });

        if (session.authenticated) {
            const tokens = await request('connect/token/', {
                method: 'POST',
                csrfToken: session.csrf_token,
                authenticated: false,
            });
            accessToken = tokens.access;
            return session;
        }

        try {
            await refreshAccessToken();
        } catch (error) {
            if (error.status !== 401) {
                throw error;
            }
        }

        if (accessToken) {
            session = await request('connect/session/');
        }
        return session;
    },
    getConnections: () => request('connect/connections/'),
    createQrToken: () => request('connect/qr-token/', { method: 'POST' }),
    scanQrCode: (token) => request('connect/scan/', {
        method: 'POST',
        body: { token },
    }),
    logout: async () => {
        await request('connect/logout/', { method: 'POST' });
        accessToken = null;
    },
};
