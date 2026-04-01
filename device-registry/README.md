# DRTS - Device Registry and Transfer System

A comprehensive device registration and ownership transfer platform for Rwanda, enabling citizens to register electronic devices, transfer ownership securely, and report lost/found devices.

## Features

### User Features
- **Device Registration**: Register phones, laptops, tablets, TVs with IMEI/Serial numbers
- **Ownership Transfer**: Secure device transfer between users with OTP verification
- **QR Code Transfer**: Quick face-to-face transfers using QR codes
- **Lost/Found Reporting**: Report lost/stolen devices or register found devices
- **Device Verification**: Check if a device is registered or reported stolen

### Admin/Police Features
- **Device Search**: Search any device by identifier
- **Ownership History**: View complete ownership history
- **Report Management**: Manage lost/stolen/found reports
- **User Management**: Manage user accounts
- **Analytics Dashboard**: Statistics and insights

## Tech Stack

### Backend
- Node.js with Express.js
- MongoDB with Mongoose
- JWT Authentication
- QR Code generation

### Frontend
- HTML5, CSS3, JavaScript
- QR Code scanning with html5-qrcode

## Project Structure

```
device-registry/
├── backend/
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Auth & validation
│   ├── services/        # QR code, SMS services
│   ├── server.js        # Express app
│   └── package.json
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB

### Backend Setup

1. Navigate to backend directory:
```bash
cd device-registry/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configurations:
```
MONGODB_URI=mongodb://127.0.0.1:27017/drts_rwanda
JWT_SECRET=your-secret-key
PORT=5000
```

5. Start the server:
```bash
npm run dev
```

### Frontend Setup

1. Open `frontend/index.html` in a browser, or serve it with a local server:
```bash
cd device-registry/frontend
npx serve .
```

2. The frontend will connect to `http://localhost:5000/api`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | User login |
| POST | /api/auth/verify-otp | Verify phone with OTP |
| GET | /api/auth/me | Get current user |

### Devices
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/devices | Register device |
| GET | /api/devices | Get user's devices |
| GET | /api/devices/:id | Get device details |
| GET | /api/devices/check/:identifier | Check device status |
| POST | /api/devices/:id/qr-code | Generate transfer QR |

### Transfers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/transfers | Initiate transfer |
| GET | /api/transfers | Get user's transfers |
| PUT | /api/transfers/:id/accept | Accept transfer |
| PUT | /api/transfers/:id/reject | Reject transfer |
| PUT | /api/transfers/:id/verify-otp | Verify with OTP |
| POST | /api/transfers/qr-scan | Process QR scan |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/reports | Create report |
| GET | /api/reports | Get user's reports |
| PUT | /api/reports/:id/found | Mark as found |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/stats | Dashboard statistics |
| GET | /api/admin/devices/search | Search devices |
| GET | /api/admin/devices/:id/history | Ownership history |
| GET | /api/admin/reports | All reports |
| PUT | /api/admin/reports/:id/resolve | Resolve report |

## Data Models

### User
- National ID (16 digits, unique)
- Phone number (+250XXXXXXXXX)
- Name, email, password
- Role: citizen, verified_seller, police, admin

### Device
- Type: phone, laptop, tablet, tv, other
- Brand, model, color
- Identifiers: IMEI1, IMEI2, Serial Number
- Status: registered, pending_transfer, reported_lost, reported_stolen

### Transfer
- Device, from/to user
- Type: sale, gift, inheritance
- Status: pending, accepted, rejected, completed
- OTP verification for both parties

### Report
- Type: lost, stolen, found
- Device or unregistered device info
- Location, status, timeline

## Security Features

- JWT token authentication
- OTP verification for sensitive operations
- HMAC-signed QR codes with expiry
- Rate limiting
- Password hashing with bcrypt
- Input validation

## SMS Integration

The system includes a simulated SMS service. For production, integrate with Africa's Talking:

1. Sign up at [Africa's Talking](https://africastalking.com)
2. Get API credentials
3. Update `.env` with:
```
AT_API_KEY=your-api-key
AT_USERNAME=your-username
AT_SENDER_ID=DRTS
```
4. Uncomment the Africa's Talking code in `services/sms.service.js`

## Future Enhancements

- Mobile app (React Native)
- USSD integration for feature phones
- Dealer/shop portal
- Insurance integration
- Customs/import integration
- Multi-language support (Kinyarwanda, French, English)
- Blockchain ownership ledger

## License

ISC
