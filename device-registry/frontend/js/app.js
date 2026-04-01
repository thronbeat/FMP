// Global state
let currentUser = null;
let pendingUserId = null;
let qrScanner = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Check if user is logged in
async function checkAuth() {
    const token = getToken();
    if (token) {
        try {
            const data = await api.getProfile();
            currentUser = data.user;
            document.getElementById('user-name').textContent = currentUser.firstName;
            showPage('dashboard-page');
            loadDevices();
        } catch (error) {
            removeToken();
            removeUserId();
            showPage('login-page');
        }
    } else {
        showPage('login-page');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // OTP form
    document.getElementById('otp-form').addEventListener('submit', handleOTPVerify);
    document.getElementById('resend-otp').addEventListener('click', handleResendOTP);
    
    // Device form
    document.getElementById('device-form').addEventListener('submit', handleDeviceRegistration);
    document.getElementById('device-type').addEventListener('change', toggleDeviceFields);
    
    // Check device form
    document.getElementById('check-form').addEventListener('submit', handleCheckDevice);
    
    // Transfer form
    document.getElementById('transfer-form').addEventListener('submit', handleTransfer);
    document.getElementById('transfer-type').addEventListener('change', togglePriceField);
    
    // Report form
    document.getElementById('report-form').addEventListener('submit', handleReport);
    document.getElementById('report-type').addEventListener('change', toggleReportFields);
    
    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => handleTabClick(tab));
    });
}

// Show page
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    
    // Load data for specific pages
    if (pageId === 'dashboard-page') {
        loadDevices();
    } else if (pageId === 'transfers-page') {
        loadTransfers('incoming');
    } else if (pageId === 'reports-page') {
        loadReports();
    } else if (pageId === 'scan-qr-page') {
        startQRScanner();
    } else if (pageId === 'create-report-page') {
        loadUserDevicesForReport();
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const phoneNumber = document.getElementById('login-phone').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const data = await api.login(phoneNumber, password);
        
        if (data.requiresVerification) {
            pendingUserId = data.userId;
            showPage('otp-page');
            showToast('Please verify your phone number', 'info');
        } else {
            setToken(data.token);
            currentUser = data.user;
            document.getElementById('user-name').textContent = currentUser.firstName;
            showPage('dashboard-page');
            showToast('Login successful!', 'success');
        }
    } catch (error) {
        showToast(error.error || 'Login failed', 'error');
    }
}

// Handle register
async function handleRegister(e) {
    e.preventDefault();
    const userData = {
        nationalId: document.getElementById('reg-nid').value,
        firstName: document.getElementById('reg-firstname').value,
        lastName: document.getElementById('reg-lastname').value,
        phoneNumber: document.getElementById('reg-phone').value,
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value
    };
    
    try {
        const data = await api.register(userData);
        pendingUserId = data.userId;
        showPage('otp-page');
        showToast('Registration successful! Please verify your phone.', 'success');
    } catch (error) {
        showToast(error.error || 'Registration failed', 'error');
    }
}

// Handle OTP verification
async function handleOTPVerify(e) {
    e.preventDefault();
    const otp = document.getElementById('otp-code').value;
    
    try {
        const data = await api.verifyOTP(pendingUserId, otp);
        setToken(data.token);
        currentUser = data.user;
        document.getElementById('user-name').textContent = currentUser.firstName;
        pendingUserId = null;
        showPage('dashboard-page');
        showToast('Phone verified successfully!', 'success');
    } catch (error) {
        showToast(error.error || 'Verification failed', 'error');
    }
}

// Handle resend OTP
async function handleResendOTP(e) {
    e.preventDefault();
    try {
        await api.resendOTP(pendingUserId);
        showToast('OTP sent to your phone', 'success');
    } catch (error) {
        showToast(error.error || 'Failed to send OTP', 'error');
    }
}

// Logout
function logout() {
    removeToken();
    removeUserId();
    currentUser = null;
    showPage('login-page');
    showToast('Logged out successfully', 'info');
}

// Load devices
async function loadDevices() {
    const container = document.getElementById('devices-list');
    container.innerHTML = '<div class="loading">Loading devices...</div>';
    
    try {
        const data = await api.getDevices();
        
        if (data.devices.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📱</div>
                    <p>No devices registered yet</p>
                    <button onclick="showPage('register-device-page')" class="btn btn-primary" style="margin-top: 15px;">Register Your First Device</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.devices.map(device => `
            <div class="device-card" onclick="viewDevice('${device._id}')">
                <div class="device-info">
                    <h3>${device.brand} ${device.model}</h3>
                    <p>${device.deviceType.toUpperCase()} ${device.identifiers?.imei1 ? '- IMEI: ' + device.identifiers.imei1 : device.identifiers?.serialNumber ? '- S/N: ' + device.identifiers.serialNumber : ''}</p>
                </div>
                <span class="device-status status-${device.status}">${formatStatus(device.status)}</span>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Failed to load devices</div>';
        showToast(error.error || 'Failed to load devices', 'error');
    }
}

// Format status for display
function formatStatus(status) {
    const statusMap = {
        'registered': 'Registered',
        'pending_transfer': 'Pending Transfer',
        'transferred': 'Transferred',
        'reported_lost': 'Reported Lost',
        'reported_stolen': 'Reported Stolen',
        'found': 'Found'
    };
    return statusMap[status] || status;
}

// View device details
async function viewDevice(deviceId) {
    showPage('device-details-page');
    const container = document.getElementById('device-details');
    container.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const data = await api.getDevice(deviceId);
        const device = data.device;
        
        container.innerHTML = `
            <h2>${device.brand} ${device.model}</h2>
            <div class="detail-row">
                <span class="detail-label">Type</span>
                <span>${device.deviceType.toUpperCase()}</span>
            </div>
            ${device.identifiers?.imei1 ? `
            <div class="detail-row">
                <span class="detail-label">IMEI 1</span>
                <span>${device.identifiers.imei1}</span>
            </div>` : ''}
            ${device.identifiers?.imei2 ? `
            <div class="detail-row">
                <span class="detail-label">IMEI 2</span>
                <span>${device.identifiers.imei2}</span>
            </div>` : ''}
            ${device.identifiers?.serialNumber ? `
            <div class="detail-row">
                <span class="detail-label">Serial Number</span>
                <span>${device.identifiers.serialNumber}</span>
            </div>` : ''}
            ${device.color ? `
            <div class="detail-row">
                <span class="detail-label">Color</span>
                <span>${device.color}</span>
            </div>` : ''}
            <div class="detail-row">
                <span class="detail-label">Status</span>
                <span class="device-status status-${device.status}">${formatStatus(device.status)}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Registered On</span>
                <span>${new Date(device.createdAt).toLocaleDateString()}</span>
            </div>
            ${device.description ? `
            <div class="detail-row">
                <span class="detail-label">Description</span>
                <span>${device.description}</span>
            </div>` : ''}
            
            <div class="device-actions">
                ${device.status === 'registered' || device.status === 'transferred' ? `
                    <button onclick="openTransferModal('${device._id}')" class="btn btn-primary">Transfer Device</button>
                    <button onclick="reportDevice('${device._id}', 'lost')" class="btn btn-secondary">Report Lost</button>
                ` : ''}
                ${device.status === 'reported_lost' || device.status === 'reported_stolen' ? `
                    <button onclick="markDeviceFound('${device._id}')" class="btn btn-success">Mark as Found</button>
                ` : ''}
            </div>
        `;
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Failed to load device details</div>';
        showToast(error.error || 'Failed to load device', 'error');
    }
}

// Toggle device fields based on type
function toggleDeviceFields() {
    const deviceType = document.getElementById('device-type').value;
    const phoneFields = document.getElementById('phone-fields');
    const serialFields = document.getElementById('serial-fields');
    
    if (deviceType === 'phone') {
        phoneFields.style.display = 'block';
        serialFields.style.display = 'none';
        document.getElementById('device-imei1').required = true;
        document.getElementById('device-serial').required = false;
    } else if (deviceType) {
        phoneFields.style.display = 'none';
        serialFields.style.display = 'block';
        document.getElementById('device-imei1').required = false;
        document.getElementById('device-serial').required = true;
    }
}

// Handle device registration
async function handleDeviceRegistration(e) {
    e.preventDefault();
    const deviceType = document.getElementById('device-type').value;
    
    const deviceData = {
        deviceType,
        brand: document.getElementById('device-brand').value,
        model: document.getElementById('device-model').value,
        color: document.getElementById('device-color').value,
        description: document.getElementById('device-description').value,
        identifiers: {}
    };
    
    if (deviceType === 'phone') {
        deviceData.identifiers.imei1 = document.getElementById('device-imei1').value;
        deviceData.identifiers.imei2 = document.getElementById('device-imei2').value || undefined;
    } else {
        deviceData.identifiers.serialNumber = document.getElementById('device-serial').value;
    }
    
    try {
        const data = await api.registerDevice(deviceData);
        showToast('Device registered successfully!', 'success');
        document.getElementById('device-form').reset();
        showPage('dashboard-page');
    } catch (error) {
        if (error.action === 'request_transfer') {
            showToast('This device is registered to another user. Request a transfer.', 'error');
        } else {
            showToast(error.error || 'Failed to register device', 'error');
        }
    }
}

// Check device
async function handleCheckDevice(e) {
    e.preventDefault();
    const identifier = document.getElementById('check-identifier').value;
    const resultContainer = document.getElementById('check-result');
    
    try {
        const data = await api.checkDevice(identifier);
        resultContainer.style.display = 'block';
        
        if (!data.exists) {
            resultContainer.className = 'check-result not-found';
            resultContainer.innerHTML = `
                <h3>Device Not Found</h3>
                <p>This device is not registered in the system.</p>
            `;
        } else if (data.hasActiveReport || ['reported_lost', 'reported_stolen'].includes(data.status)) {
            resultContainer.className = 'check-result warning';
            resultContainer.innerHTML = `
                <h3>Warning: Device Reported</h3>
                <p>This device has been reported as ${data.status.replace('reported_', '')}.</p>
                <p><strong>${data.brand} ${data.model}</strong> (${data.deviceType})</p>
                <p>Do not purchase this device. Contact authorities if needed.</p>
            `;
        } else {
            resultContainer.className = 'check-result found';
            resultContainer.innerHTML = `
                <h3>Device Registered</h3>
                <p><strong>${data.brand} ${data.model}</strong> (${data.deviceType})</p>
                <p>Status: ${formatStatus(data.status)}</p>
                ${data.isOwner ? '<p>You are the registered owner of this device.</p>' : '<p>This device is registered to another user.</p>'}
            `;
        }
    } catch (error) {
        showToast(error.error || 'Failed to check device', 'error');
    }
}

// Transfer modal
function openTransferModal(deviceId) {
    document.getElementById('transfer-device-id').value = deviceId;
    document.getElementById('transfer-modal').classList.add('active');
    document.getElementById('qr-display').style.display = 'none';
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function togglePriceField() {
    const type = document.getElementById('transfer-type').value;
    document.getElementById('price-group').style.display = type === 'sale' ? 'block' : 'none';
}

// Generate transfer QR
async function generateTransferQR() {
    const deviceId = document.getElementById('transfer-device-id').value;
    
    try {
        const data = await api.generateQRCode(deviceId);
        document.getElementById('qr-image').src = data.qrCode;
        document.getElementById('qr-display').style.display = 'block';
        showToast('QR Code generated! Show it to the buyer.', 'success');
    } catch (error) {
        showToast(error.error || 'Failed to generate QR code', 'error');
    }
}

// Handle transfer
async function handleTransfer(e) {
    e.preventDefault();
    const transferData = {
        deviceId: document.getElementById('transfer-device-id').value,
        buyerIdentifier: document.getElementById('buyer-phone').value,
        transferType: document.getElementById('transfer-type').value,
        price: document.getElementById('transfer-price').value || undefined
    };
    
    try {
        const data = await api.createTransfer(transferData);
        closeModal('transfer-modal');
        showToast('Transfer request sent!', 'success');
        loadDevices();
    } catch (error) {
        showToast(error.error || 'Failed to create transfer', 'error');
    }
}

// Load transfers
async function loadTransfers(type = 'incoming') {
    const container = document.getElementById('transfers-list');
    container.innerHTML = '<div class="loading">Loading transfers...</div>';
    
    try {
        const data = await api.getTransfers({ type });
        
        if (data.transfers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🔄</div>
                    <p>No ${type} transfers</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.transfers.map(transfer => `
            <div class="transfer-card">
                <h4>${transfer.device?.brand} ${transfer.device?.model}</h4>
                <div class="transfer-meta">
                    <p>${type === 'incoming' ? 'From: ' + transfer.fromUser?.firstName + ' ' + transfer.fromUser?.lastName : 'To: ' + transfer.toUser?.firstName + ' ' + transfer.toUser?.lastName}</p>
                    <p>Type: ${transfer.transferType} ${transfer.price ? '- ' + transfer.price + ' RWF' : ''}</p>
                    <p>Status: <strong>${transfer.status}</strong></p>
                    <p>Date: ${new Date(transfer.createdAt).toLocaleDateString()}</p>
                </div>
                ${transfer.status === 'pending' && type === 'incoming' ? `
                    <div class="transfer-actions">
                        <button onclick="acceptTransfer('${transfer._id}')" class="btn btn-primary btn-small">Accept</button>
                        <button onclick="rejectTransfer('${transfer._id}')" class="btn btn-danger btn-small">Reject</button>
                    </div>
                ` : ''}
                ${transfer.status === 'pending' && type === 'outgoing' ? `
                    <div class="transfer-actions">
                        <button onclick="cancelTransfer('${transfer._id}')" class="btn btn-secondary btn-small">Cancel</button>
                    </div>
                ` : ''}
                ${transfer.status === 'accepted' ? `
                    <div class="transfer-actions">
                        <button onclick="verifyTransferOTP('${transfer._id}')" class="btn btn-primary btn-small">Verify with OTP</button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Failed to load transfers</div>';
        showToast(error.error || 'Failed to load transfers', 'error');
    }
}

// Tab click handler
function handleTabClick(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadTransfers(tab.dataset.tab);
}

// Transfer actions
async function acceptTransfer(transferId) {
    try {
        await api.acceptTransfer(transferId);
        showToast('Transfer accepted! Please verify with OTP.', 'success');
        loadTransfers('incoming');
    } catch (error) {
        showToast(error.error || 'Failed to accept transfer', 'error');
    }
}

async function rejectTransfer(transferId) {
    const reason = prompt('Reason for rejection (optional):');
    try {
        await api.rejectTransfer(transferId, reason);
        showToast('Transfer rejected', 'info');
        loadTransfers('incoming');
    } catch (error) {
        showToast(error.error || 'Failed to reject transfer', 'error');
    }
}

async function cancelTransfer(transferId) {
    if (!confirm('Are you sure you want to cancel this transfer?')) return;
    try {
        await api.cancelTransfer(transferId);
        showToast('Transfer cancelled', 'info');
        loadTransfers('outgoing');
    } catch (error) {
        showToast(error.error || 'Failed to cancel transfer', 'error');
    }
}

async function verifyTransferOTP(transferId) {
    const otp = prompt('Enter the OTP sent to your phone:');
    if (!otp) return;
    
    try {
        const data = await api.verifyTransferOTP(transferId, otp);
        showToast(data.message, 'success');
        loadTransfers('incoming');
    } catch (error) {
        showToast(error.error || 'Failed to verify OTP', 'error');
    }
}

// QR Scanner
function startQRScanner() {
    const container = document.getElementById('qr-reader');
    container.innerHTML = '';
    
    qrScanner = new Html5Qrcode('qr-reader');
    
    qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
            stopScanner();
            try {
                const data = await api.scanQRCode(decodedText);
                showScanResult(data);
            } catch (error) {
                showToast(error.error || 'Invalid QR code', 'error');
                showPage('dashboard-page');
            }
        },
        () => {}
    ).catch(err => {
        container.innerHTML = '<p>Unable to access camera. Please check permissions.</p>';
    });
}

function stopScanner() {
    if (qrScanner) {
        qrScanner.stop().catch(() => {});
        qrScanner = null;
    }
}

function showScanResult(data) {
    const container = document.getElementById('scan-result');
    container.style.display = 'block';
    document.getElementById('qr-reader').innerHTML = '';
    
    container.innerHTML = `
        <h3>Transfer Details</h3>
        <p><strong>Device:</strong> ${data.device.brand} ${data.device.model}</p>
        <p><strong>Type:</strong> ${data.device.deviceType}</p>
        <p><strong>IMEI:</strong> ${data.device.identifiers?.imei1 || data.device.identifiers?.serialNumber || 'N/A'}</p>
        <p><strong>Seller:</strong> ${data.seller.name} (${data.seller.phone})</p>
        <div style="margin-top: 20px;">
            <button onclick="confirmQRTransfer('${data.transfer.id}')" class="btn btn-primary">Accept Transfer</button>
            <button onclick="showPage('dashboard-page')" class="btn btn-secondary">Cancel</button>
        </div>
    `;
}

async function confirmQRTransfer(transferId) {
    try {
        await api.acceptTransfer(transferId);
        showToast('Transfer accepted! Verify with OTP to complete.', 'success');
        showPage('transfers-page');
    } catch (error) {
        showToast(error.error || 'Failed to accept transfer', 'error');
    }
}

// Reports
function toggleReportFields() {
    const reportType = document.getElementById('report-type').value;
    const myDeviceSelect = document.getElementById('my-device-select');
    const foundFields = document.getElementById('found-device-fields');
    
    if (reportType === 'lost' || reportType === 'stolen') {
        myDeviceSelect.style.display = 'block';
        foundFields.style.display = 'none';
    } else if (reportType === 'found') {
        myDeviceSelect.style.display = 'none';
        foundFields.style.display = 'block';
    } else {
        myDeviceSelect.style.display = 'none';
        foundFields.style.display = 'none';
    }
}

async function loadUserDevicesForReport() {
    try {
        const data = await api.getDevices();
        const select = document.getElementById('report-device');
        select.innerHTML = '<option value="">Select a device</option>' +
            data.devices
                .filter(d => ['registered', 'transferred'].includes(d.status))
                .map(d => `<option value="${d._id}">${d.brand} ${d.model}</option>`)
                .join('');
    } catch (error) {
        console.error('Failed to load devices for report');
    }
}

async function handleReport(e) {
    e.preventDefault();
    const reportType = document.getElementById('report-type').value;
    
    const reportData = {
        reportType,
        location: {
            description: document.getElementById('report-location').value
        },
        notes: document.getElementById('report-notes').value
    };
    
    if (reportType === 'lost' || reportType === 'stolen') {
        reportData.deviceId = document.getElementById('report-device').value;
    } else if (reportType === 'found') {
        reportData.unregisteredDevice = {
            identifier: document.getElementById('found-identifier').value,
            brand: document.getElementById('found-brand').value,
            model: document.getElementById('found-model').value
        };
    }
    
    try {
        await api.createReport(reportData);
        showToast('Report submitted successfully!', 'success');
        document.getElementById('report-form').reset();
        showPage('reports-page');
    } catch (error) {
        showToast(error.error || 'Failed to submit report', 'error');
    }
}

async function loadReports() {
    const container = document.getElementById('reports-list');
    container.innerHTML = '<div class="loading">Loading reports...</div>';
    
    try {
        const data = await api.getReports();
        
        if (data.reports.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📋</div>
                    <p>No reports</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.reports.map(report => `
            <div class="report-card">
                <h4>${report.reportType.toUpperCase()} - ${report.device ? report.device.brand + ' ' + report.device.model : 'Unregistered Device'}</h4>
                <div class="report-meta">
                    <p>Status: <strong>${report.status}</strong></p>
                    <p>Date: ${new Date(report.reportDate).toLocaleDateString()}</p>
                    ${report.location?.description ? `<p>Location: ${report.location.description}</p>` : ''}
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<div class="empty-state">Failed to load reports</div>';
    }
}

async function reportDevice(deviceId, type) {
    if (!confirm(`Are you sure you want to report this device as ${type}?`)) return;
    
    try {
        await api.createReport({
            reportType: type,
            deviceId: deviceId
        });
        showToast(`Device reported as ${type}`, 'success');
        showPage('dashboard-page');
    } catch (error) {
        showToast(error.error || 'Failed to report device', 'error');
    }
}

async function markDeviceFound(deviceId) {
    // Find the active report for this device
    try {
        const reportsData = await api.getReports();
        const report = reportsData.reports.find(r => 
            r.device?._id === deviceId && 
            ['lost', 'stolen'].includes(r.reportType) && 
            r.status === 'open'
        );
        
        if (report) {
            await api.markDeviceFound(report._id, 'Found by owner');
            showToast('Device marked as found!', 'success');
            showPage('dashboard-page');
        } else {
            showToast('No active report found for this device', 'error');
        }
    } catch (error) {
        showToast(error.error || 'Failed to mark device as found', 'error');
    }
}
