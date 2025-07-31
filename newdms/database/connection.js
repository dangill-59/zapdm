// src/database/connection.js
const Database = require('better-sqlite3');
const path = require('path');
const { DATABASE_PATH } = require('../config/environment');
const { DATABASE_CONFIG } = require('../config/constants');

class DatabaseConnection {
    constructor() {
        this.db = null;
        this.isConnected = false;
    }

    connect() {
        try {
            this.db = new Database(DATABASE_PATH);
            
            // Enable foreign key constraints
            this.db.pragma('foreign_keys = ON');
            
            // Apply performance optimizations
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 1000000');
            this.db.pragma('temp_store = memory');
            
            this.isConnected = true;
            console.log('✅ Database connected successfully');
            console.log(`📁 Database file: ${path.resolve(DATABASE_PATH)}`);
            
            return this.db;
        } catch (error) {
            console.error('❌ Database connection failed:', error);
            throw error;
        }
    }

    getConnection() {
        if (!this.isConnected || !this.db) {
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.db;
    }

    close() {
        if (this.db) {
            this.db.close();
            this.isConnected = false;
            console.log('📴 Database connection closed');
        }
    }

    // Utility method for checking foreign key constraints
    checkForeignKeys() {
        try {
            const violations = this.db.prepare('PRAGMA foreign_key_check').all();
            return {
                hasViolations: violations.length > 0,
                violations: violations
            };
        } catch (error) {
            console.error('Error checking foreign keys:', error);
            return { hasViolations: false, violations: [] };
        }
    }

    // Transaction wrapper
    transaction(callback) {
        const transaction = this.db.transaction(callback);
        return transaction;
    }
}

// Singleton instance
const dbConnection = new DatabaseConnection();

module.exports = dbConnection;