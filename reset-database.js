// reset-database.js - Run this to completely reset your database
// Place this file in your root directory and run: node reset-database.js

const fs = require('fs');
const path = require('path');

async function resetDatabase() {
    try {
        console.log('🗑️ Resetting database...');
        
        // Delete existing database file
        const dbPath = './data/database.sqlite';
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
            console.log('✅ Removed existing database file');
        }
        
        // Delete data directory if it exists
        const dataDir = './data';
        if (fs.existsSync(dataDir)) {
            fs.rmSync(dataDir, { recursive: true, force: true });
            console.log('✅ Removed data directory');
        }
        
        console.log('🎉 Database reset complete!');
        console.log('🚀 Now run: node server.js');
        
    } catch (error) {
        console.error('❌ Failed to reset database:', error);
    }
}

resetDatabase();