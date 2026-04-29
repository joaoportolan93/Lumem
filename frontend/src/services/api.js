import axios from 'axios';

// URL da API: usa variável de ambiente ou o ip da máquina host (porta 8000)
const API_BASE_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:8000`;

const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add auth token to every request
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle token refresh on 401
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refresh = localStorage.getItem('refresh');
                if (refresh) {
                    const response = await axios.post(`${API_BASE_URL}/api/auth/refresh/`, {
                        refresh: refresh
                    });
                    localStorage.setItem('access', response.data.access);
                    originalRequest.headers.Authorization = `Bearer ${response.data.access}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                localStorage.removeItem('access');
                localStorage.removeItem('refresh');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Auth endpoints
export const login = (data) => api.post('/api/auth/login/', data);
export const register = (data) => api.post('/api/auth/register/', data);
export const googleLogin = (data) => api.post('/api/auth/google/', data);
export const logout = async () => {
    const refresh = localStorage.getItem('refresh');
    try {
        // Import dinâmico para evitar dependência circular com notifications.js
        const { unregisterPushToken } = await import('./notifications');
        await unregisterPushToken(); // remover token FCM antes de encerrar sessão
        await api.post('/api/auth/logout/', { refresh });
    } finally {
        localStorage.removeItem('access');
        localStorage.removeItem('refresh');
    }
};

export const requestPasswordResetCode = (data) => api.post('/api/auth/password-reset/request/', data);
export const verifyAndResetPassword = (data) => api.post('/api/auth/password-reset/verify/', data);

// Profile endpoints
export const getProfile = () => api.get('/api/profile/');

export const getUser = (userId) => api.get(`/api/users/${userId}/`);

export const updateUser = (userId, data) => api.put(`/api/users/${userId}/`, data);

export const patchUser = (userId, data) => api.patch(`/api/users/${userId}/`, data);

export const uploadAvatar = (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/api/users/avatar/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

// Dreams (Publicacao) endpoints
export const getDreams = (tab = 'following', communityId = null, page = 1) => {
    let url = `/api/dreams/?tab=${tab}&page=${page}`;
    if (communityId) {
        url += `&community_id=${communityId}`;
    }
    return api.get(url);
};

export const viewDream = (id) => api.post(`/api/dreams/${id}/view/`);


export const getMyDreams = () => api.get('/api/dreams/?tab=mine');

export const getMyCommunityPosts = () => api.get('/api/dreams/?tab=my_community_posts');

export const getUserPosts = (userId) => api.get(`/api/dreams/?tab=user_posts&user_id=${userId}`);

export const getUserCommunityPosts = (userId) => api.get(`/api/dreams/?tab=user_community_posts&user_id=${userId}`);

export const getUserMediaPosts = (userId) => api.get(`/api/dreams/?tab=user_media&user_id=${userId}`);

export const getMyMediaPosts = () => api.get('/api/dreams/?tab=user_media');

export const createDream = (data) => api.post('/api/dreams/', data);

export const getDream = (id) => api.get(`/api/dreams/${id}/`);

export const updateDream = (id, data) => api.patch(`/api/dreams/${id}/`, data);

export const deleteDream = (id) => api.delete(`/api/dreams/${id}/`);

export const likeDream = (id) => api.post(`/api/dreams/${id}/like/`);

export const saveDream = (id) => api.post(`/api/dreams/${id}/save/`);

// Follow endpoints
export const followUser = (userId) => api.post(`/api/users/${userId}/follow/`);
export const unfollowUser = (userId) => api.delete(`/api/users/${userId}/follow/`);
export const getUserFollowers = (userId) => api.get(`/api/users/${userId}/followers/`);
export const getUserFollowing = (userId) => api.get(`/api/users/${userId}/following/`);

// Block/Mute endpoints
export const blockUser = (userId) => api.post(`/api/users/${userId}/block/`);
export const unblockUser = (userId) => api.delete(`/api/users/${userId}/block/`);
export const muteUser = (userId) => api.post(`/api/users/${userId}/mute/`);
export const unmuteUser = (userId) => api.delete(`/api/users/${userId}/mute/`);

export const getSuggestedUsers = () => api.get('/api/users/suggested/');

// Comments endpoints
export const getComments = (dreamId, ordering = 'recent') =>
    api.get(`/api/dreams/${dreamId}/comments/`, {
        params: { ordering },
    });

export const createComment = (dreamId, formData) => {
    if (formData instanceof FormData) {
        return api.post(`/api/dreams/${dreamId}/comments/`, formData);
    }
    return api.post(`/api/dreams/${dreamId}/comments/`, formData);
};

export const editComment = (dreamId, commentId, text) => api.patch(`/api/dreams/${dreamId}/comments/${commentId}/`, {
    conteudo_texto: text
});

export const deleteComment = (dreamId, commentId) => api.delete(`/api/dreams/${dreamId}/comments/${commentId}/`);

export const likeComment = (dreamId, commentId) => api.post(`/api/dreams/${dreamId}/comments/${commentId}/like/`);



// Notifications endpoints
export const getNotifications = () => api.get('/api/notifications/');

export const markNotificationRead = (id) => api.patch(`/api/notifications/${id}/read/`);

export const markAllNotificationsRead = () => api.patch('/api/notifications/read_all/');

export const search = (query, type = 'all', limit = 20) => api.get(`/api/search/?q=${query}&type=${type}&limit=${limit}`);

// Settings endpoints
export const getUserSettings = () => api.get('/api/settings/');

export const updateUserSettings = (data) => api.patch('/api/settings/', data);

// Close Friends endpoints
export const getCloseFriendsManage = () => api.get('/api/friends/manage/');

export const toggleCloseFriend = (userId) => api.post(`/api/friends/toggle/${userId}/`);

// Follow Requests endpoints
export const getFollowRequests = () => api.get('/api/follow-requests/');

export const acceptFollowRequest = (userId) => api.post(`/api/follow-requests/${userId}/action/`, { action: 'accept' });


export const rejectFollowRequest = (userId) => api.post(`/api/follow-requests/${userId}/action/`, { action: 'reject' });

// Community endpoints
export const getCommunities = () => api.get('/api/communities/');
export const getUserCommunities = () => api.get('/api/communities/?member=true');
export const getUserMemberCommunities = (userId) => api.get(`/api/communities/?user_id=${userId}`);
export const getUserAdminCommunities = (userId) => api.get(`/api/communities/?user_id=${userId}&role=admin,moderator`);
export const getMyAdminCommunities = () => api.get('/api/communities/?member=true&role=admin,moderator');
export const createCommunity = (data) => api.post('/api/communities/', data);
export const getCommunity = (id) => api.get(`/api/communities/${id}/`);
export const joinCommunity = (id) => api.post(`/api/communities/${id}/join/`);
export const leaveCommunity = (id) => api.post(`/api/communities/${id}/leave/`);
export const getCommunityStats = (id) => api.get(`/api/communities/${id}/moderator_stats/`);
export const getCommunityMembers = (id) => api.get(`/api/communities/${id}/members/`);
export const manageCommunityRole = (id, userId, role) => api.post(`/api/communities/${id}/manage-role/`, { user_id: userId, role });
export const deleteCommunity = (id) => api.delete(`/api/communities/${id}/`);
export const updateCommunity = (id, data) => api.patch(`/api/communities/${id}/`, data);
export const banCommunityMember = (id, userId, motivo = '') => api.post(`/api/communities/${id}/ban-member/`, { user_id: userId, motivo });
export const unbanCommunityMember = (id, userId) => api.post(`/api/communities/${id}/unban-member/`, { user_id: userId });
export const getBannedMembers = (id) => api.get(`/api/communities/${id}/banned-members/`);
export const inviteModerator = (id, userId) => api.post(`/api/communities/${id}/invite-moderator/`, { user_id: userId });
export const acceptCommunityInvite = (id, inviteId) => api.post(`/api/communities/${id}/accept-invite/`, { invite_id: inviteId });
export const rejectCommunityInvite = (id, inviteId) => api.post(`/api/communities/${id}/reject-invite/`, { invite_id: inviteId });

export const uploadCommunityIcon = (id, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`/api/communities/${id}/upload-icon/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

export const uploadCommunityBanner = (id, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`/api/communities/${id}/upload-banner/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

// Drafts endpoints
export const getDrafts = () => api.get('/api/drafts/');
export const getDraft = (id) => api.get(`/api/drafts/${id}/`);
export const createDraft = (data) => api.post('/api/drafts/', data);
export const updateDraft = (id, data) => api.patch(`/api/drafts/${id}/`, data);
export const deleteDraft = (id) => api.delete(`/api/drafts/${id}/`);

// Explore page endpoints
export const getTrends = () => api.get('/api/trends/');
export const getTopCommunityPosts = () => api.get('/api/communities/top-posts/');

// Account deletion (LGPD Art. 18, VI)
export const deleteAccountPreCheck = () => api.get('/api/profile/delete/pre-check/');
export const deleteAccount = (data) => api.delete('/api/profile/delete/', { data });
export const transferCommunityOwnership = (id, userId) => api.post(`/api/communities/${id}/transfer-ownership/`, { user_id: userId });

export default api;




