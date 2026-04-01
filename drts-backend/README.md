# DRTS Backend - Device Registry and Transfer System

A comprehensive device registration and ownership transfer platform for Rwanda.

## Features

- **User Management**: Registration with National ID, OTP verification
- **Device Registration**: Register phones, laptops, tablets, TVs with IMEI/serial numbers
- **Ownership Transfer**: Secure device transfer between users
- **QR Code Transfer**: Quick face-to-face transfers via QR codes
- **Lost & Found**: Report lost/stolen devices and register found devices
- **Admin Dashboard**: Statistics, device search, report management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT + OTP
- **QR Generation**: qrcode npm package

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB 6+

### Installation

1. Install dependencies:
```bash
cd drts-backend
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

The server will run on `http://localhost:5001`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/auth/resend-otp` - Resend OTP
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Devices
- `POST /api/devices` - Register new device
- `GET /api/devices` - Get user's devices
- `GET /api/devices/:id` - Get device details
- `PUT /api/devices/:id` - Update device
- `DELETE /api/devices/:id` - Remove device
- `GET /api/devices/check/:identifier` - Check if device exists
- `POST /api/devices/:id/qr-code` - Generate transfer QR

### Transfers
- `POST /api/transfers` - Initiate transfer
- `GET /api/transfers` - Get user's transfers
- `GET /api/transfers/:id` - Get transfer details
- `PUT /api/transfers/:id/accept` - Accept transfer
- `PUT /api/transfers/:id/reject` - Reject transfer
- `PUT /api/transfers/:id/cancel` - Cancel transfer
- `POST /api/transfers/qr-scan` - Process QR transfer
- `GET /api/transfers/device/:deviceId/history` - Transfer history

### Reports
- `POST /api/reports` - Create report
- `GET /api/reports` - Get user's reports
- `GET /api/reports/:id` - Get report details
- `PUT /api/reports/:id` - Update report
- `PUT /api/reports/:id/resolve` - Resolve report
- `DELETE /api/reports/:id` - Delete report
- `GET /api/reports/my-devices` - Reports about user's devices

### Admin (Police/Admin only)
- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/devices/search` - Search all devices
- `GET /api/admin/devices/:id` - Full device details
- `GET /api/admin/devices/:id/history` - Ownership history
- `GET /api/admin/reports` - All reports
- `PUT /api/admin/reports/:id/status` - Update report status
- `GET /api/admin/users` - List users (admin only)
- `PUT /api/admin/users/:id/role` - Update user role (admin only)
- `PUT /api/admin/users/:id/status` - Activate/deactivate user (admin only)
- `POST /api/admin/verify/:deviceId` - Verify device

## Data Models

### User
- nationalId (16 chars, unique)
- firstName, lastName
- phoneNumber (+250XXXXXXXXX)
- role: citizen, verified_seller, police, admin
- isVerified, isActive

### Device
- deviceType: phone, laptop, tablet, tv, other
- brand, model
- identifiers: imei1, imei2, serialNumber, macAddress
- currentOwner (User reference)
- status: registered, pending_transfer, reported_lost, reported_stolen, found

### Transfer
- device, fromUser, toUser
- transferType: sale, gift, inheritance
- status: pending, accepted, rejected, cancelled, expired, completed
- qrCodeUsed

### Report
- device (optional)
- reportType: lost, stolen, found
- reportedBy
- status: open, investigating, resolved, closed
- location, policeReference

## Security Features

- JWT authentication with refresh tokens
- OTP verification for registration and transfers
- Rate limiting (100 requests/15 min)
- Password hashing with bcrypt
- HMAC-signed QR codes with expiry

## License

ISC
