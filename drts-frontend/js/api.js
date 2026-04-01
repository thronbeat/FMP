// DRTS API Service

const API_BASE = 'http://localhost:5001/api';

class ApiService {
    constructor() {
        this.token = localStorage.getItem('drts_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('drts_token', token);
    }

    clearToken() {
        this.token = null;
        localStorage.removeItem('drts_token');
        localStorage.removeItem('drts_user');
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Auth endpoints
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    async login(phoneNumber, password) {
        return this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber, password })
        });
    }

    async verifyOTP(phoneNumber, otp) {
        return this.request('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber, otp })
        });
    }

    async resendOTP(phoneNumber) {
        return this.request('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ phoneNumber })
        });
    }

    async getProfile() {
        return this.request('/auth/me');
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.clearToken();
        }
    }

    // Device endpoints
    async getDevices(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/devices${query ? '?' + query : ''}`);
    }

    async getDevice(id) {
        return this.request(`/devices/${id}`);
    }

    async registerDevice(deviceData) {
        return this.request('/devices', {
            method: 'POST',
            body: JSON.stringify(deviceData)
        });
    }

    async updateDevice(id, updates) {
        return this.request(`/devices/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async deleteDevice(id) {
        return this.request(`/devices/${id}`, {
            method: 'DELETE'
        });
    }

    async checkDevice(identifier) {
        return this.request(`/devices/check/${encodeURIComponent(identifier)}`);
    }

    async generateQRCode(deviceId, expiryMinutes = 15) {
        return this.request(`/devices/${deviceId}/qr-code`, {
            method: 'POST',
            body: JSON.stringify({ expiryMinutes })
        });
    }

    // Transfer endpoints
    async getTransfers(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/transfers${query ? '?' + query : ''}`);
    }

    async getTransfer(id) {
        return this.request(`/transfers/${id}`);
    }

    async initiateTransfer(transferData) {
        return this.request('/transfers', {
            method: 'POST',
            body: JSON.stringify(transferData)
        });
    }

    async acceptTransfer(id) {
        return this.request(`/transfers/${id}/accept`, {
            method: 'PUT'
        });
    }

    async rejectTransfer(id, reason) {
        return this.request(`/transfers/${id}/reject`, {
            method: 'PUT',
            body: JSON.stringify({ reason })
        });
    }

    async cancelTransfer(id, reason) {
        return this.request(`/transfers/${id}/cancel`, {
            method: 'PUT',
            body: JSON.stringify({ reason })
        });
    }

    async processQRTransfer(qrData) {
        return this.request('/transfers/qr-scan', {
            method: 'POST',
            body: JSON.stringify({ qrData })
        });
    }

    async getTransferHistory(deviceId) {
        return this.request(`/transfers/device/${deviceId}/history`);
    }

    // Report endpoints
    async getReports(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/reports${query ? '?' + query : ''}`);
    }

    async getReport(id) {
        return this.request(`/reports/${id}`);
    }

    async createReport(reportData) {
        return this.request('/reports', {
            method: 'POST',
            body: JSON.stringify(reportData)
        });
    }

    async updateReport(id, updates) {
        return this.request(`/reports/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async resolveReport(id, resolution) {
        return this.request(`/reports/${id}/resolve`, {
            method: 'PUT',
            body: JSON.stringify({ resolution })
        });
    }

    async deleteReport(id) {
        return this.request(`/reports/${id}`, {
            method: 'DELETE'
        });
    }

    async getMyDeviceReports() {
        return this.request('/reports/my-devices');
    }
}

// Export singleton instance
const api = new ApiService();
