const API_BASE_URL = (
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/V1'
).replace(/\/+$/, '');

export const BACKEND_ORIGIN = (
    import.meta.env.VITE_BACKEND_ORIGIN || new URL(API_BASE_URL).origin
).replace(/\/+$/, '');

export const GOOGLE_LOGIN_URL = `${BACKEND_ORIGIN}/accounts/google/login/`;

async function request(path, options = {}) {
    const {
        body,
        csrfToken,
        headers: suppliedHeaders,
        ...fetchOptions
    } = options;
    const headers = new Headers(suppliedHeaders);

    if (body !== undefined) {
        headers.set('Content-Type', 'application/json');
    }
    if (csrfToken) {
        headers.set('X-CSRFToken', csrfToken);
    }

    const response = await fetch(`${API_BASE_URL}/${path.replace(/^\/+/, '')}`, {
        ...fetchOptions,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.status === 204) {
        return null;
    }

    let payload;
    try {
        payload = await response.json();
    } catch (parseError) {
        if (!response.ok) {
            throw new Error(`Request failed (${response.status}).`);
        }
        throw parseError;
    }

    if (!response.ok) {
        if (payload && typeof payload.detail === 'string') {
            throw new Error(payload.detail);
        }
        const details = payload && typeof payload === 'object'
            ? Object.values(payload)
                .flat()
                .map((detail) => (
                    typeof detail === 'string' ? detail : JSON.stringify(detail)
                ))
            : [];
        throw new Error(details.join(' ') || `Request failed (${response.status}).`);
    }

    return payload;
}

async function requestWithCsrf(path, options) {
    const session = await request('connect/session/');
    return request(path, { ...options, csrfToken: session.csrf_token });
}

export const notesApi = {
    list: () => request('notes/'),
    get: (id) => request(`notes/${id}/`),
    create: (note) => requestWithCsrf('notes/', { method: 'POST', body: note }),
    update: (id, note) => requestWithCsrf(`notes/${id}/`, {
        method: 'PUT',
        body: note,
    }),
    delete: (id) => requestWithCsrf(`notes/${id}/`, { method: 'DELETE' }),
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
};

export const connectApi = {
    getSession: () => request('connect/session/'),
    getConnections: () => request('connect/connections/'),
    createQrToken: (csrfToken) => request('connect/qr-token/', {
        method: 'POST',
        csrfToken,
    }),
    scanQrCode: (token, csrfToken) => request('connect/scan/', {
        method: 'POST',
        csrfToken,
        body: { token },
    }),
    logout: (csrfToken) => request('connect/logout/', {
        method: 'POST',
        csrfToken,
    }),
};
