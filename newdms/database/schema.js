// src/database/schema.js
const { STATUS, DEFAULT_ROLES, PERMISSIONS } = require('../config/constants');
const bcrypt = require('bcrypt');

class DatabaseSchema {
    constructor(db) {
        this.db = db;
    }

    initialize() {
        try {
            console.log('🏗️ Initializing database schema...');
            
            // Ensure foreign keys are enabled
            this.db.pragma('foreign_keys = ON');
            console.log('✅ Foreign key constraints enabled');
            
            // Create all tables
            this.createTables();
            
            // Run migrations
            this.runMigrations();
            
            // Create FTS table
            this.createFTSTable();
            
            // Seed initial data
            this.seedInitialData();
            
            console.log('✅ Database schema initialized successfully');
        } catch (error) {
            console.error('❌ Schema initialization failed:', error);
            throw error;
        }
    }

    createTables() {
        this.db.exec(`
            -- Roles table (must be created first due to foreign key dependencies)
            CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                permissions TEXT, -- JSON string of permissions
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name TEXT,
                last_name TEXT,
                role_id INTEGER,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES roles (id)
            );

            -- Projects table
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                type TEXT DEFAULT 'custom',
                color TEXT DEFAULT '#667eea',
                status TEXT DEFAULT 'active',
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            );

            -- Project roles table (for role-based access to projects)
            CREATE TABLE IF NOT EXISTS project_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                assigned_by INTEGER,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
                FOREIGN KEY (assigned_by) REFERENCES users (id),
                UNIQUE(project_id, role_id)
            );

            -- Project fields table (custom fields for each project)
            CREATE TABLE IF NOT EXISTS project_fields (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                field_name TEXT NOT NULL,
                field_label TEXT NOT NULL,
                field_type TEXT NOT NULL, -- text, number, date, dropdown, checkbox
                field_options TEXT, -- JSON for dropdown options
                required BOOLEAN DEFAULT 0,
                display_order INTEGER DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
            );

            -- Documents table
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                document_type TEXT,
                status TEXT DEFAULT 'active',
                total_pages INTEGER DEFAULT 0,
                has_ocr_text BOOLEAN DEFAULT 0,
                ocr_language TEXT DEFAULT 'eng',
                ocr_completed_at DATETIME,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            );

            -- Document field values (custom field values for documents)
            CREATE TABLE IF NOT EXISTS document_field_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER,
                field_id INTEGER,
                field_value TEXT,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE,
                FOREIGN KEY (field_id) REFERENCES project_fields (id) ON DELETE CASCADE
            );

            -- Document pages table
            CREATE TABLE IF NOT EXISTS document_pages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER,
                page_number INTEGER,
                file_path TEXT NOT NULL,
                file_name TEXT,
                file_size INTEGER,
                mime_type TEXT,
                thumbnail_path TEXT,
                annotations TEXT, -- JSON string of annotations
                page_order INTEGER DEFAULT 0,
                source_file_name TEXT, -- Original filename if from PDF
                status TEXT DEFAULT 'active',
                ocr_text TEXT, -- Full OCR text content
                ocr_confidence REAL, -- OCR confidence score (0-100)
                ocr_processed_at DATETIME, -- When OCR was completed
                ocr_language TEXT DEFAULT 'eng', -- Language used for OCR
                word_count INTEGER DEFAULT 0, -- Number of words found
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
            );

            -- User project access (granular user access)
            CREATE TABLE IF NOT EXISTS user_project_access (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                project_id INTEGER,
                access_level TEXT, -- read, edit, delete
                granted_by INTEGER,
                granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
                FOREIGN KEY (granted_by) REFERENCES users (id)
            );

            -- Audit log
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                table_name TEXT,
                record_id INTEGER,
                details TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        `);
    }

    createFTSTable() {
        try {
            this.db.exec(`
                -- Full Text Search virtual table for OCR content
                CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
                    page_id,
                    document_id,
                    project_id,
                    document_title,
                    page_text,
                    content='document_pages',
                    content_rowid='id'
                );
            `);
            console.log('✅ Full Text Search table created');
        } catch (ftsError) {
            console.log('⚠️  FTS table creation skipped (may already exist):', ftsError.message);
        }
    }

    runMigrations() {
        // Function to check if column exists
        const columnExists = (tableName, columnName) => {
            try {
                const tableInfo = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
                return tableInfo.some(col => col.name === columnName);
            } catch (error) {
                return false;
            }
        };

        // Migration definitions
        const migrations = [
            // Document pages OCR columns
            { 
                table: 'document_pages', 
                column: 'ocr_text', 
                definition: 'TEXT',
                updateExisting: null
            },
            { 
                table: 'document_pages', 
                column: 'ocr_confidence', 
                definition: 'REAL',
                updateExisting: null
            },
            { 
                table: 'document_pages', 
                column: 'ocr_processed_at', 
                definition: 'DATETIME',
                updateExisting: null
            },
            { 
                table: 'document_pages', 
                column: 'ocr_language', 
                definition: 'TEXT DEFAULT \'eng\'',
                updateExisting: "UPDATE document_pages SET ocr_language = 'eng' WHERE ocr_language IS NULL"
            },
            { 
                table: 'document_pages', 
                column: 'word_count', 
                definition: 'INTEGER DEFAULT 0',
                updateExisting: "UPDATE document_pages SET word_count = 0 WHERE word_count IS NULL"
            },
            
            // Documents OCR columns
            { 
                table: 'documents', 
                column: 'has_ocr_text', 
                definition: 'BOOLEAN DEFAULT 0',
                updateExisting: "UPDATE documents SET has_ocr_text = 0 WHERE has_ocr_text IS NULL"
            },
            { 
                table: 'documents', 
                column: 'ocr_language', 
                definition: 'TEXT DEFAULT \'eng\'',
                updateExisting: "UPDATE documents SET ocr_language = 'eng' WHERE ocr_language IS NULL"
            },
            { 
                table: 'documents', 
                column: 'ocr_completed_at', 
                definition: 'DATETIME',
                updateExisting: null
            },
            
            // Add source_file_name column for PDF splitting
            { 
                table: 'document_pages', 
                column: 'source_file_name', 
                definition: 'TEXT',
                updateExisting: null
            },
            // Add status column to document_pages for soft delete
            { 
                table: 'document_pages', 
                column: 'status', 
                definition: 'TEXT DEFAULT \'active\'',
                updateExisting: "UPDATE document_pages SET status = 'active' WHERE status IS NULL"
            },
            // Projects table migrations
            { 
                table: 'projects', 
                column: 'type', 
                definition: 'TEXT DEFAULT \'custom\'',
                updateExisting: "UPDATE projects SET type = 'custom' WHERE type IS NULL"
            },
            { 
                table: 'projects', 
                column: 'color', 
                definition: 'TEXT DEFAULT \'#667eea\'',
                updateExisting: "UPDATE projects SET color = '#667eea' WHERE color IS NULL"
            },
            { 
                table: 'projects', 
                column: 'status', 
                definition: 'TEXT DEFAULT \'active\'',
                updateExisting: "UPDATE projects SET status = 'active' WHERE status IS NULL"
            },
            { 
                table: 'projects', 
                column: 'updated_at', 
                definition: 'DATETIME',
                updateExisting: "UPDATE projects SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL"
            },
            
            // Documents table migrations
            { 
                table: 'documents', 
                column: 'status', 
                definition: 'TEXT DEFAULT \'active\'',
                updateExisting: "UPDATE documents SET status = 'active' WHERE status IS NULL"
            },
            { 
                table: 'documents', 
                column: 'updated_at', 
                definition: 'DATETIME',
                updateExisting: "UPDATE documents SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL"
            },
            
            // Users table migrations
            { 
                table: 'users', 
                column: 'status', 
                definition: 'TEXT DEFAULT \'active\'',
                updateExisting: "UPDATE users SET status = 'active' WHERE status IS NULL"
            },
            { 
                table: 'users', 
                column: 'updated_at', 
                definition: 'DATETIME',
                updateExisting: "UPDATE users SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL"
            },
            
            // Project fields migrations
            { 
                table: 'project_fields', 
                column: 'field_label', 
                definition: 'TEXT',
                updateExisting: "UPDATE project_fields SET field_label = field_name WHERE field_label IS NULL OR field_label = ''"
            },
            
            // Roles table migrations
            { 
                table: 'roles', 
                column: 'updated_at', 
                definition: 'DATETIME',
                updateExisting: "UPDATE roles SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE updated_at IS NULL"
            }
        ];

        migrations.forEach(migration => {
            try {
                const { table, column, definition, updateExisting } = migration;
                
                if (!columnExists(table, column)) {
                    this.db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
                    console.log(`✅ Added column ${table}.${column}`);
                    
                    if (updateExisting) {
                        const migrationResult = this.db.prepare(updateExisting).run();
                        if (migrationResult.changes > 0) {
                            console.log(`✅ Updated ${migrationResult.changes} existing records in ${table}.${column}`);
                        }
                    }
                } else {
                    console.log(`⏭️  Column ${table}.${column} already exists`);
                }
            } catch (e) {
                if (!e.message.includes('duplicate column name')) {
                    console.log(`⚠️  Migration warning for ${migration.table}.${migration.column}: ${e.message}`);
                }
            }
        });
    }

    seedInitialData() {
        try {
            // Create default roles
            const adminRole = this.db.prepare(`
                INSERT OR IGNORE INTO roles (name, description, permissions) 
                VALUES (?, ?, ?)
            `).run(
                DEFAULT_ROLES.ADMINISTRATOR.name, 
                DEFAULT_ROLES.ADMINISTRATOR.description, 
                JSON.stringify(DEFAULT_ROLES.ADMINISTRATOR.permissions)
            );

            this.db.prepare(`
                INSERT OR IGNORE INTO roles (name, description, permissions) 
                VALUES (?, ?, ?)
            `).run(
                DEFAULT_ROLES.USER.name, 
                DEFAULT_ROLES.USER.description, 
                JSON.stringify(DEFAULT_ROLES.USER.permissions)
            );

            this.db.prepare(`
                INSERT OR IGNORE INTO roles (name, description, permissions) 
                VALUES (?, ?, ?)
            `).run(
                DEFAULT_ROLES.MANAGER.name, 
                DEFAULT_ROLES.MANAGER.description, 
                JSON.stringify(DEFAULT_ROLES.MANAGER.permissions)
            );

            // Create default admin user
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            this.db.prepare(`
                INSERT OR IGNORE INTO users (username, email, password, first_name, last_name, role_id) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('admin', 'admin@dms.local', hashedPassword, 'System', 'Administrator', 1);

            console.log('✅ Initial data seeded successfully');
            console.log('📋 Default admin user: admin / admin123');
        } catch (seedError) {
            console.error('⚠️  Database seeding failed:', seedError.message);
        }
    }
}

module.exports = DatabaseSchema;