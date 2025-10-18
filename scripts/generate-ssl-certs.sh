#!/bin/bash

# Generate self-signed SSL certificates for testing
# This script creates self-signed certificates for gitvizz.sutools.app
# Email: khoa0702@gmail.com

set -e

echo "🔐 Generating self-signed SSL certificates for gitvizz.sutools.app..."
echo "📧 Certificate email: khoa0702@gmail.com"

# Create SSL directory if it doesn't exist
mkdir -p ./nginx/ssl

# Generate private key
openssl genrsa -out ./nginx/ssl/privkey.pem 2048

# Generate certificate signing request with email
openssl req -new -key ./nginx/ssl/privkey.pem -out ./nginx/ssl/cert.csr -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=gitvizz.sutools.app/emailAddress=khoa0702@gmail.com"

# Generate self-signed certificate
openssl x509 -req -days 365 -in ./nginx/ssl/cert.csr -signkey ./nginx/ssl/privkey.pem -out ./nginx/ssl/cert.pem

# Create fullchain.pem (same as cert.pem for self-signed)
cp ./nginx/ssl/cert.pem ./nginx/ssl/fullchain.pem

# Set proper permissions
chmod 600 ./nginx/ssl/privkey.pem
chmod 644 ./nginx/ssl/cert.pem
chmod 644 ./nginx/ssl/fullchain.pem

# Clean up CSR file
rm ./nginx/ssl/cert.csr

echo "✅ SSL certificates generated successfully!"
echo "📁 Certificates location: ./nginx/ssl/"
echo "🔑 Private key: ./nginx/ssl/privkey.pem"
echo "📜 Certificate: ./nginx/ssl/fullchain.pem"
echo "📧 Certificate email: khoa0702@gmail.com"
echo ""
echo "⚠️  Note: These are self-signed certificates for testing only."
echo "   Browsers will show security warnings. For production, use Let's Encrypt or commercial certificates."
echo ""
echo "🚀 Next steps:"
echo "   1. Run: docker-compose -f docker-compose.prod.yaml down"
echo "   2. Run: docker-compose -f docker-compose.prod.yaml up -d"
echo "   3. Test: https://gitvizz.sutools.app (accept security warning)"
