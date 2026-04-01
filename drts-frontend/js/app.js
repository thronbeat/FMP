// DRTS Main Application

let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Check authentication status
function checkAuth() {
    const token = localStorage.getItem('drts_token');
    const userData = localStorage.getItem('drts_user');
    
    if (token && userData) {
        currentUser = JSON.parse(userData);
        api.setToken(token);
        showAuthenticatedNav();
        showPage('dashboard');
    } else {
        showPublicNav();
        showPage('home');
    }
}

// Navigation
function showPublicNav() {
    document.getElementById('nav').style.display = 'flex';
    document.getElementById('navAuth').style.display = 'none';
}

function showAuthenticatedNav() {
    document.getElementById('nav').style.display = 'none';
    document.getElementById('navAuth').style.display = 'flex';
}

function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show requested page
    const page = document.getElementById(pageName + 'Page');
    if (page) {
        page.classList.add('active');
        
        // Load data for specific pages
        if (pageName === 'dashboard') loadDashboard();
        if (pageName === 'devices') loadDevices();
        if (pageName === 'transfers') loadTransfers();
        if (pageName === 'reports') loadReports();
        if (pageName === 'newReport') loadDevicesForReport();
    }
    
    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Navigation links
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await handleLogout();
    });
    
    // Forms
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
    document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
    document.getElementById('otpForm')?.addEventListener('submit', handleOTPVerify);
    document.getElementById('checkDeviceForm')?.addEventListener('submit', handleCheckDevice);
    document.getElementById('addDeviceForm')?.addEventListener('submit', handleAddDevice);
    document.getElementById('newReportForm')?.addEventListener('submit', handleNewReport);
    
    // Device type change
    document.getElementById('deviceType')?.addEventListener('change', handleDeviceTypeChange);
    
    // Resend OTP
    document.getElementById('resendOtp')?.addEventListener('click', handleResendOTP);
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => handleTabChange(tab));
    });
    
    // QR processing
    document.getElementById('processQrBtn')?.addEventListener('click', handleProcessQR);
}

// Auth handlers
async function handleLogin(e) {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const result = await api.login(phone, password);
        
        if (result.requiresVerification) {
            document.getElementById('otpPhone').value = phone;
            showPage('otp');
            showToast('Please verify your phone number', 'warning');
            return;
        }
        
        api.setToken(result.token);
        currentUser = result.user;
        localStorage.setItem('drts_user', JSON.stringify(result.user));
        
        showAuthenticatedNav();
        showPage('dashboard');
        showToast('Login successful!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const userData = {
        firstName: document.getElementById('regFirstName').value,
        lastName: document.getElementById('regLastName').value,
        nationalId: document.getElementById('regNationalId').value,
        phoneNumber: document.getElementById('regPhone').value,
        password: document.getElementById('regPassword').value
    };
    
    try {
        await api.register(userData);
        document.getElementById('otpPhone').value = userData.phoneNumber;
        showPage('otp');
        showToast('Registration successful! Please verify your phone.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleOTPVerify(e) {
    e.preventDefault();
    const phone = document.getElementById('otpPhone').value;
    const otp = document.getElementById('otpCode').value;
    
    try {
        const result = await api.verifyOTP(phone, otp);
        
        api.setToken(result.token);
        currentUser = result.user;
        localStorage.setItem('drts_user', JSON.stringify(result.user));
        
        showAuthenticatedNav();
        showPage('dashboard');
        showToast('Phone verified successfully!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleResendOTP(e) {
    e.preventDefault();
    const phone = document.getElementById('otpPhone').value;
    
    try {
        await api.resendOTP(phone);
        showToast('OTP sent!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleLogout() {
    try {
        await api.logout();
    } finally {
        currentUser = null;
        showPublicNav();
        showPage('home');
        showToast('Logged out', 'success');
    }
}

// Device handlers
async function handleCheckDevice(e) {
    e.preventDefault();
    const identifier = document.getElementById('checkIdentifier').value;
    const resultBox = document.getElementById('checkResult');
    
    try {
        const result = await api.checkDevice(identifier);
        resultBox.style.display = 'block';
        
        if (!result.exists) {
            resultBox.className = 'result-box success';
            resultBox.innerHTML = `<strong>Device not found</strong><p>This device is not registered. You can register it.</p>`;
        } else {
            let className = 'result-box';
            if (result.status === 'reported_lost' || result.status === 'reported_stolen') {
                className += ' danger';
            } else if (result.status === 'pending_transfer') {
                className += ' warning';
            } else {
                className += ' success';
            }
            
            resultBox.className = className;
            resultBox.innerHTML = `
                <strong>${result.brand} ${result.model}</strong>
                <p>Status: ${result.status.replace(/_/g, ' ')}</p>
                <p>${result.message}</p>
            `;
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function handleDeviceTypeChange(e) {
    const type = e.target.value;
    const phoneIdentifiers = document.getElementById('phoneIdentifiers');
    const otherIdentifiers = document.getElementById('otherIdentifiers');
    
    if (type === 'phone') {
        phoneIdentifiers.style.display = 'block';
        otherIdentifiers.style.display = 'none';
        document.getElementById('imei1').required = true;
        document.getElementById('serialNumber').required = false;
    } else {
        phoneIdentifiers.style.display = 'none';
        otherIdentifiers.style.display = 'block';
        document.getElementById('imei1').required = false;
        document.getElementById('serialNumber').required = true;
    }
}

async function handleAddDevice(e) {
    e.preventDefault();
    
    const deviceType = document.getElementById('deviceType').value;
    const identifiers = {};
    
    if (deviceType === 'phone') {
        identifiers.imei1 = document.getElementById('imei1').value;
        const imei2 = document.getElementById('imei2').value;
        if (imei2) identifiers.imei2 = imei2;
    } else {
        identifiers.serialNumber = document.getElementById('serialNumber').value;
    }
    
    const deviceData = {
        deviceType,
        brand: document.getElementById('deviceBrand').value,
        model: document.getElementById('deviceModel').value,
        identifiers,
        color: document.getElementById('deviceColor').value,
        description: document.getElementById('deviceDescription').value
    };
    
    try {
        await api.registerDevice(deviceData);
        showToast('Device registered successfully!', 'success');
        document.getElementById('addDeviceForm').reset();
        showPage('devices');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Load functions
async function loadDashboard() {
    try {
        const [devicesRes, transfersRes, reportsRes] = await Promise.all([
            api.getDevices(),
            api.getTransfers({ status: 'pending' }),
            api.getReports({ status: 'open' })
        ]);
        
        document.getElementById('myDevicesCount').textContent = devicesRes.pagination?.total || 0;
        document.getElementById('pendingTransfers').textContent = transfersRes.pagination?.total || 0;
        document.getElementById('activeReports').textContent = reportsRes.pagination?.total || 0;
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

async function loadDevices() {
    const container = document.getElementById('devicesList');
    container.innerHTML = '<div class="loading">Loading devices...</div>';
    
    try {
        const result = await api.getDevices();
        
        if (!result.devices || result.devices.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No devices registered yet.</p>
                    <button class="btn btn-primary" onclick="showPage('addDevice')">Register Your First Device</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = result.devices.map(device => `
            <div class="device-card">
                <div class="device-card-header">
                    <div>
                        <div class="device-name">${device.brand} ${device.model}</div>
                        <div class="device-type">${device.deviceType}</div>
                    </div>
                    <span class="device-status status-${device.status.replace('reported_', '')}">${device.status.replace(/_/g, ' ')}</span>
                </div>
                <div class="device-info">
                    ${device.identifiers.imei1 ? `IMEI: ${device.identifiers.imei1}` : ''}
                    ${device.identifiers.serialNumber ? `S/N: ${device.identifiers.serialNumber}` : ''}
                </div>
                <div class="device-actions">
                    ${device.status === 'registered' ? `
                        <button class="btn btn-primary btn-sm" onclick="initiateTransfer('${device._id}')">Transfer</button>
                        <button class="btn btn-secondary btn-sm" onclick="generateQR('${device._id}')">QR Code</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Failed to load devices</div>';
        showToast(error.message, 'error');
    }
}

async function loadTransfers(type = 'incoming') {
    const container = document.getElementById('transfersList');
    container.innerHTML = '<div class="loading">Loading transfers...</div>';
    
    try {
        const result = await api.getTransfers({ type });
        
        if (!result.transfers || result.transfers.length === 0) {
            container.innerHTML = '<div class="empty-state">No transfers found</div>';
            return;
        }
        
        container.innerHTML = result.transfers.map(transfer => {
            const isIncoming = transfer.toUser._id === currentUser._id;
            const otherUser = isIncoming ? transfer.fromUser : transfer.toUser;
            
            return `
                <div class="transfer-item">
                    <div class="transfer-info">
                        <div class="transfer-device">${transfer.device.brand} ${transfer.device.model}</div>
                        <div class="transfer-user">${isIncoming ? 'From' : 'To'}: ${otherUser.firstName} ${otherUser.lastName}</div>
                        <div class="device-status status-${transfer.status}">${transfer.status}</div>
                    </div>
                    <div class="transfer-actions">
                        ${transfer.status === 'pending' && isIncoming ? `
                            <button class="btn btn-success btn-sm" onclick="acceptTransfer('${transfer._id}')">Accept</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectTransfer('${transfer._id}')">Reject</button>
                        ` : ''}
                        ${transfer.status === 'pending' && !isIncoming ? `
                            <button class="btn btn-danger btn-sm" onclick="cancelTransfer('${transfer._id}')">Cancel</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Failed to load transfers</div>';
        showToast(error.message, 'error');
    }
}

async function loadReports() {
    const container = document.getElementById('reportsList');
    container.innerHTML = '<div class="loading">Loading reports...</div>';
    
    try {
        const result = await api.getReports();
        
        if (!result.reports || result.reports.length === 0) {
            container.innerHTML = '<div class="empty-state">No reports found</div>';
            return;
        }
        
        container.innerHTML = result.reports.map(report => `
            <div class="report-item">
                <div class="report-info">
                    <div class="report-device">${report.device ? `${report.device.brand} ${report.device.model}` : report.deviceIdentifier || 'Unknown device'}</div>
                    <div class="report-type">${report.reportType.toUpperCase()} - ${report.status}</div>
                </div>
                <div class="report-actions">
                    ${report.status === 'open' ? `
                        <button class="btn btn-success btn-sm" onclick="resolveReport('${report._id}')">Resolve</button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Failed to load reports</div>';
        showToast(error.message, 'error');
    }
}

async function loadDevicesForReport() {
    const select = document.getElementById('reportDevice');
    const selectGroup = document.getElementById('selectDeviceGroup');
    const reportType = document.getElementById('reportType').value;
    
    // Only show device selection for lost/stolen reports
    if (reportType === 'found') {
        selectGroup.style.display = 'none';
        return;
    }
    
    selectGroup.style.display = 'block';
    
    try {
        const result = await api.getDevices({ status: 'registered' });
        select.innerHTML = '<option value="">Select device or enter identifier below</option>';
        
        if (result.devices) {
            result.devices.forEach(device => {
                select.innerHTML += `<option value="${device._id}">${device.brand} ${device.model}</option>`;
            });
        }
    } catch (error) {
        console.error('Failed to load devices for report:', error);
    }
}

// Action functions
async function initiateTransfer(deviceId) {
    const phone = prompt('Enter buyer phone number (+250...)');
    if (!phone) return;
    
    try {
        await api.initiateTransfer({
            deviceId,
            toUserPhone: phone,
            transferType: 'sale'
        });
        showToast('Transfer request sent!', 'success');
        loadDevices();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function generateQR(deviceId) {
    try {
        const result = await api.generateQRCode(deviceId);
        
        // Show QR code in a modal/alert
        const qrWindow = window.open('', 'QR Code', 'width=400,height=500');
        qrWindow.document.write(`
            <html>
            <head><title>Transfer QR Code</title></head>
            <body style="text-align: center; padding: 20px; font-family: sans-serif;">
                <h2>Scan to Transfer Device</h2>
                <img src="${result.qrCode}" alt="QR Code" style="max-width: 300px;">
                <p>Expires: ${new Date(result.expiresAt).toLocaleString()}</p>
                <p>Let the buyer scan this QR code to receive the device.</p>
            </body>
            </html>
        `);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function acceptTransfer(transferId) {
    if (!confirm('Accept this transfer?')) return;
    
    try {
        await api.acceptTransfer(transferId);
        showToast('Transfer accepted!', 'success');
        loadTransfers('incoming');
        loadDashboard();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function rejectTransfer(transferId) {
    const reason = prompt('Reason for rejection (optional):');
    
    try {
        await api.rejectTransfer(transferId, reason);
        showToast('Transfer rejected', 'success');
        loadTransfers('incoming');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function cancelTransfer(transferId) {
    if (!confirm('Cancel this transfer?')) return;
    
    try {
        await api.cancelTransfer(transferId);
        showToast('Transfer cancelled', 'success');
        loadTransfers('outgoing');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function resolveReport(reportId) {
    const resolution = prompt('Resolution notes:');
    
    try {
        await api.resolveReport(reportId, resolution);
        showToast('Report resolved', 'success');
        loadReports();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleNewReport(e) {
    e.preventDefault();
    
    const reportData = {
        reportType: document.getElementById('reportType').value,
        deviceId: document.getElementById('reportDevice').value || undefined,
        deviceIdentifier: document.getElementById('reportIdentifier').value || undefined,
        location: {
            description: document.getElementById('reportLocation').value
        },
        notes: document.getElementById('reportNotes').value
    };
    
    try {
        const result = await api.createReport(reportData);
        showToast('Report created successfully!', 'success');
        
        if (result.potentialMatches && result.potentialMatches.length > 0) {
            alert(`Found ${result.potentialMatches.length} potential matches! Check your reports for details.`);
        }
        
        document.getElementById('newReportForm').reset();
        showPage('reports');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function handleTabChange(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const tabType = tab.dataset.tab;
    loadTransfers(tabType);
}

async function handleProcessQR() {
    const qrData = document.getElementById('qrDataInput').value;
    if (!qrData) {
        showToast('Please paste QR data', 'error');
        return;
    }
    
    try {
        await api.processQRTransfer(qrData);
        showToast('Transfer completed successfully!', 'success');
        document.getElementById('qrDataInput').value = '';
        showPage('devices');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Report type change handler
document.getElementById('reportType')?.addEventListener('change', function() {
    const selectGroup = document.getElementById('selectDeviceGroup');
    if (this.value === 'found') {
        selectGroup.style.display = 'none';
    } else {
        selectGroup.style.display = 'block';
        loadDevicesForReport();
    }
});
