#!/bin/bash

# Database Setup Script for Shiksha LMS Service
# This script helps set up the database and run migrations

set -e

echo "🚀 Setting up Shiksha LMS Service Database..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your database credentials before continuing"
    echo "   Required variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE"
    exit 1
fi

# Load environment variables
source .env

# Check if required environment variables are set
if [ -z "$DB_HOST" ] || [ -z "$DB_PORT" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_DATABASE" ]; then
    echo "❌ Missing required database environment variables"
    echo "   Please check your .env file and ensure all DB_* variables are set"
    exit 1
fi

echo "📊 Database Configuration:"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   Database: $DB_DATABASE"
echo "   User: $DB_USER"

# Check if PostgreSQL is accessible
echo "🔍 Testing database connection..."
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Cannot connect to PostgreSQL"
    echo "   Please ensure PostgreSQL is running and credentials are correct"
    exit 1
fi

echo "✅ Database connection successful"

# Check if database exists
echo "🔍 Checking if database exists..."
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_DATABASE -c "SELECT 1;" > /dev/null 2>&1; then
    echo "📝 Creating database '$DB_DATABASE'..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE \"$DB_DATABASE\";"
    echo "✅ Database created successfully"
else
    echo "✅ Database already exists"
fi

# Enable UUID extension
echo "🔧 Enabling UUID extension..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_DATABASE -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" > /dev/null 2>&1 || true

# Create tables using schema.sql
echo "🏗️  Creating database tables..."
if [ -f scripts/schema.sql ]; then
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_DATABASE -f scripts/schema.sql > /dev/null 2>&1
    echo "✅ Database tables created successfully"
else
    echo "⚠️  scripts/schema.sql not found, skipping table creation"
fi

# Run migrations (if any)
echo "🔄 Running database migrations..."
npm run migration:run || echo "⚠️  Migration script failed or no migrations found, skipping..."

echo "✅ Database setup completed successfully!"
echo ""
echo "🎉 You can now start the application with:"
echo "   npm run start:dev" 