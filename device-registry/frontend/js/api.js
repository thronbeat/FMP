// API Configuration
const API_URL = 'http://localhost:5000/api';

// Token management
const getToken = () => localStorage.getItem('drts_token');
const setToken = (token) => localStorage.setItem('drts_token', token);
const removeToken = () => localStorage.removeItem('drts_token');

const getUserId = () => localStorage.getItem('drts_user_id');
const setUserId = (id) => localStorage.setItem('drts_user_id', id);
const removeUserId = () => localStorage.removeItem('drts_user_id');

// API helper
const api = {
    async request(endpoint, options = {}) {
        const url = `${API_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, ...data };
            }

            return data;
        } catch (error) {
            if (error.status === 401) {
                // Token expired or invalid
                removeToken();
                removeUserId();
                showPage('login-page');
            }
            throw error;
        }
    },

    // Auth endpoints
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    },

    async verifyOTP(userId, otp) {
        return this.request('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ userId, otp })
        });
    },

    async resendOTP(userId) {
        return this.request('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ userId })
        });
    },

    async login(phoneNumber, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber, password })
        });
    },

    async getProfile() {
        return this.request('/auth/me');
    },

    // Device endpoints
    async registerDevice(deviceData) {
        return this.request('/devices', {
            method: 'POST',
            body: JSON.stringify(deviceData)
        });
    },

    async getDevices(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/devices?${query}`);
    },

    async getDevice(id) {
        return this.request(`/devices/${id}`);
    },

    async checkDevice(identifier) {
        return this.request(`/devices/check/${identifier}`);
    },

    async generateQRCode(deviceId) {
        return this.request(`/devices/${deviceId}/qr-code`, {
            method: 'POST'
        });
    },

    // Transfer endpoints
    async createTransfer(transferData) {
        return this.request('/transfers', {
            method: 'POST',
            body: JSON.stringify(transferData)
        });
    },

    async getTransfers(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/transfers?${query}`);
    },

    async getTransfer(id) {
        return this.request(`/transfers/${id}`);
    },

    async acceptTransfer(id) {
        return this.request(`/transfers/${id}/accept`, {
            method: 'PUT'
        });
    },

    async rejectTransfer(id, reason) {
        return this.request(`/transfers/${id}/reject`, {
            method: 'PUT',
            body: JSON.stringify({ reason })
        });
    },

    async cancelTransfer(id) {
        return this.request(`/transfers/${id}/cancel`, {
            method: 'PUT'
        });
    },

    async verifyTransferOTP(id, otp) {
        return this.request(`/transfers/${id}/verify-otp`, {
            method: 'PUT',
            body: JSON.stringify({ otp })
        });
    },

    async scanQRCode(qrData) {
        return this.request('/transfers/qr-scan', {
            method: 'POST',
            body: JSON.stringify({ qrData })
        });
    },

    // Report endpoints
    async createReport(reportData) {
        return this.request('/reports', {
            method: 'POST',
            body: JSON.stringify(reportData)
        });
    },

    async getReports(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/reports?${query}`);
    },

    async getReport(id) {
        return this.request(`/reports/${id}`);
    },

    async markDeviceFound(reportId, notes) {
        return this.request(`/reports/${reportId}/found`, {
            method: 'PUT',
            body: JSON.stringify({ notes })
        });
    }
};
