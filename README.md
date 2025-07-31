# Document Management System with OCR

A production-ready Document Management System built with Node.js and Express, featuring OCR capabilities, secure file handling, and comprehensive user management.

[![CI/CD Pipeline](https://github.com/dangill-59/zapdm/actions/workflows/ci.yml/badge.svg)](https://github.com/dangill-59/zapdm/actions/workflows/ci.yml)
[![Security Rating](https://img.shields.io/badge/security-A-green)](./SECURITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 📄 **Document Upload & Management**: Secure file upload with validation and storage
- 🔍 **OCR Processing**: Extract text from PDF and image files using Tesseract.js
- 🔐 **Authentication & Authorization**: JWT-based auth with role management
- 🛡️ **Security**: Comprehensive security features including rate limiting, input validation
- 📊 **Audit Logging**: Complete audit trail for all document operations
- 🎨 **Modern UI**: Clean, responsive interface for document management
- 🔧 **RESTful API**: Well-documented API for integration

## Architecture

This project follows a modular, layered architecture designed for scalability and maintainability:

```
zapdm/
├── backend/           # Database and backend services
├── newdms/           # Core application modules
│   ├── config/       # Configuration management
│   ├── database/     # Database models and migrations
│   ├── middleware/   # Express middleware
│   ├── routes/       # API route handlers
│   └── services/     # Business logic services
├── public/           # Static web assets
├── src/              # TypeScript source files
├── tests/            # Test suites
├── uploads/          # File upload directory
└── logs/             # Application logs
```

### Core Components

- **Express.js**: Web framework and API server
- **SQLite/Better-SQLite3**: Database for development (PostgreSQL recommended for production)
- **Tesseract.js**: OCR processing engine
- **JWT**: Authentication and session management
- **Multer**: File upload handling
- **Sharp**: Image processing and optimization

## Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/dangill-59/zapdm.git
   cd zapdm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   npm run setup
   ```

5. **Start the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database
DATABASE_PATH=./database/dms.sqlite

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png,tiff,bmp

# OCR Configuration
OCR_ENABLED=true
OCR_LANGUAGE=eng

# Security
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
BCRYPT_ROUNDS=12

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

## Usage

### Web Interface

1. Open your browser to `http://localhost:3000`
2. Create an account or log in
3. Upload documents through the web interface
4. View and manage your documents
5. Search through OCR-extracted text

### API Usage

The API provides RESTful endpoints for all operations:

```bash
# Authentication
POST /api/auth/register    # Register new user
POST /api/auth/login       # User login
POST /api/auth/logout      # User logout

# Document Management
GET    /api/documents      # List documents
POST   /api/documents      # Upload document
GET    /api/documents/:id  # Get document details
PUT    /api/documents/:id  # Update document
DELETE /api/documents/:id  # Delete document

# OCR Operations
POST /api/ocr/process/:id  # Process document OCR
GET  /api/ocr/text/:id     # Get extracted text

# User Management
GET    /api/users          # List users (admin)
GET    /api/users/profile  # Get user profile
PUT    /api/users/profile  # Update profile
```

### Example API Calls

```javascript
// Upload a document
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'My Document');

fetch('/api/documents', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

// Get document text
const response = await fetch(`/api/ocr/text/${documentId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const { text } = await response.json();
```

## API Documentation

The API is documented using OpenAPI/Swagger. Access the interactive documentation at:
- Development: `http://localhost:3000/api-docs`
- Production: `https://yourdomain.com/api-docs`

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testNamePattern="Unit"
npm test -- --testNamePattern="Integration"

# Run tests with coverage
npm test -- --coverage

# Watch mode for development
npm test -- --watch
```

### Test Structure

```
tests/
├── sample.test.js        # Sample test demonstrating patterns
├── unit/                 # Unit tests
├── integration/          # Integration tests
└── fixtures/             # Test data and fixtures
```

### Writing Tests

Follow the patterns in `tests/sample.test.js`:

```javascript
describe('Document Service', () => {
  test('should upload document successfully', async () => {
    const result = await DocumentService.upload(mockFile, mockUser);
    expect(result).toHaveProperty('id');
    expect(result.uploaded).toBe(true);
  });
});
```

## Linting and Code Quality

### ESLint Configuration

The project uses ESLint for code quality and consistency:

```bash
# Run linting
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix

# Lint specific files
npx eslint src/example.ts
```

### Prettier Configuration

Code formatting is handled by Prettier:

```bash
# Check formatting
npx prettier --check "**/*.{js,ts,json,md}"

# Format files
npx prettier --write "**/*.{js,ts,json,md}"
```

### Code Quality Rules

- ES2022 features enabled
- Strict TypeScript checking
- No unused variables (except prefixed with _)
- Consistent indentation (2 spaces)
- Single quotes for strings
- Semicolons required

## TypeScript

### Configuration

The project uses TypeScript for type safety and modern JavaScript features. Configuration is in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

### Building TypeScript

```bash
# Type check without emitting
npx tsc --noEmit

# Build TypeScript files
npx tsc --build

# Watch mode for development
npx tsc --watch
```

### TypeScript Best Practices

1. **Use strict type checking**
2. **Define interfaces for complex objects**
3. **Use type guards for runtime validation**
4. **Avoid `any` type - use `unknown` instead**
5. **Document complex types with JSDoc**

Example from `src/example.ts`:

```typescript
export interface DocumentMetadata {
  id: string;
  title: string;
  size: number;
  mimeType: string;
  uploadedBy: User;
  uploadedAt: Date;
  tags: string[];
}
```

## Security

### Security Features

This application implements comprehensive security measures:

- **Authentication**: JWT-based with secure token handling
- **Authorization**: Role-based access control
- **Input Validation**: Joi schema validation for all inputs
- **File Security**: Type validation, size limits, secure storage
- **Rate Limiting**: Protection against brute force attacks
- **CORS**: Configurable cross-origin policies
- **Headers**: Security headers via Helmet.js
- **Logging**: Comprehensive audit trails

### Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment variables** for configuration
3. **Validate all inputs** at API boundaries
4. **Implement proper error handling** without information leakage
5. **Use HTTPS** in production
6. **Keep dependencies updated** with `npm audit`

### Security Checklist

- [ ] Change default JWT secret
- [ ] Configure secure CORS policies
- [ ] Set up HTTPS certificates
- [ ] Enable rate limiting
- [ ] Configure file upload restrictions
- [ ] Set up monitoring and alerting
- [ ] Regular security audits

For detailed security information, see [SECURITY.md](./SECURITY.md).

## Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   NODE_ENV=production
   PORT=80
   DATABASE_PATH=/var/lib/zapdm/dms.sqlite
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Process Management**
   ```bash
   # Using PM2
   npm install -g pm2
   pm2 start server.js --name zapdm
   
   # Using systemd
   sudo systemctl enable zapdm
   sudo systemctl start zapdm
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### CI/CD Pipeline

The project includes a comprehensive CI/CD pipeline in `.github/workflows/ci.yml`:

- **Linting**: ESLint and Prettier checks
- **Testing**: Unit and integration tests
- **TypeScript**: Compilation and type checking
- **Security**: Dependency audit and vulnerability scanning
- **Build**: Application building and artifact creation
- **Deploy**: Automated deployment to staging/production

## Contributing

We welcome contributions! Please follow these steps:

### Development Workflow

1. **Fork the repository** and create a feature branch
2. **Install dependencies**: `npm install`
3. **Make your changes** following the coding standards
4. **Write tests** for new functionality
5. **Run the test suite**: `npm test`
6. **Lint your code**: `npm run lint`
7. **Check TypeScript**: `npx tsc --noEmit`
8. **Submit a pull request** with a clear description

### Coding Standards

- Follow existing code style and patterns
- Write meaningful commit messages
- Include tests for new features
- Update documentation as needed
- Ensure all CI checks pass

### Pull Request Process

1. Ensure your PR addresses a single concern
2. Include relevant tests and documentation updates
3. Maintain backwards compatibility when possible
4. Request review from maintainers
5. Address feedback promptly

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: Check this README and inline code comments
- **Issues**: Report bugs and request features via GitHub Issues
- **Security**: Report security issues via the process outlined in [SECURITY.md](./SECURITY.md)
- **Discussion**: Join project discussions on GitHub

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

---

**Built with ❤️ by the ZapDM team**