// newdms/database/index.js
// Complete, correct module with initialize, seedInitialData, getModels, close

const bcrypt = require('bcrypt');
// Adjust this path to where your models are exported
const models = require('./models'); // For example, { User, Role, Project, ProjectRole }

const BCRYPT_ROUNDS = 10;

// Seeds initial data (roles, admin user, projects)
async function seedInitialData(models) {
    try {
        console.log('🌱 Starting initial data seeding...');

        // Check if admin user already exists
        const existingAdmin = await models.User.findOne({
            where: { username: 'admin' }
        });

        if (existingAdmin) {
            console.log('✅ Admin user already exists, skipping seed');
            return;
        }

        const adminPassword = 'admin123';
        if (!adminPassword || adminPassword.trim() === '') {
            throw new Error('Admin password cannot be empty');
        }

        console.log('🔐 Hashing admin password...');
        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
            if (!hashedPassword) {
                throw new Error('bcrypt.hash returned empty result');
            }
        } catch (hashError) {
            console.error('❌ Password hashing failed:', hashError);
            throw new Error(`Failed to hash password: ${hashError.message}`);
        }

        console.log('✅ Password hashed successfully');

        // Create Administrator role
        console.log('📝 Creating Administrator role...');
        const [adminRole] = await models.Role.findOrCreate({
            where: { name: 'Administrator' },
            defaults: {
                name: 'Administrator',
                description: 'System Administrator with full access',
                permissions: [
                    'admin_access',
                    'user_create', 'user_edit', 'user_delete', 'user_view',
                    'role_create', 'role_edit', 'role_delete', 'role_view',
                    'project_create', 'project_edit', 'project_delete', 'project_view',
                    'document_create', 'document_edit', 'document_delete', 'document_view',
                    'document_upload', 'document_download', 'document_ocr',
                    'page_create', 'page_edit', 'page_delete', 'page_view', 'page_reorder',
                    'search_basic', 'search_advanced', 'search_fulltext',
                    'audit_view', 'system_config'
                ],
                status: 'active',
                createdBy: null
            }
        });
        console.log('✅ Administrator role created with ID:', adminRole.id);

        // Create User role
        console.log('📝 Creating User role...');
        const [userRole] = await models.Role.findOrCreate({
            where: { name: 'User' },
            defaults: {
                name: 'User',
                description: 'Regular user with document access',
                permissions: [
                    'document_view', 'document_create', 'document_edit',
                    'document_upload', 'document_download',
                    'page_view',
                    'search_basic', 'search_fulltext'
                ],
                status: 'active',
                createdBy: null
            }
        });
        console.log('✅ User role created with ID:', userRole.id);

        // Create Viewer role
        console.log('📝 Creating Viewer role...');
        const [viewerRole] = await models.Role.findOrCreate({
            where: { name: 'Viewer' },
            defaults: {
                name: 'Viewer',
                description: 'Read-only access to documents',
                permissions: [
                    'document_view',
                    'page_view',
                    'search_basic'
                ],
                status: 'active',
                createdBy: null
            }
        });
        console.log('✅ Viewer role created with ID:', viewerRole.id);

        // Create admin user
        console.log('👤 Creating admin user...');
        const adminUserData = {
            username: 'admin',
            email: 'admin@localhost',
            password: hashedPassword,
            firstName: 'System',
            lastName: 'Administrator',
            roleId: adminRole.id,
            status: 'active',
            createdBy: null
        };

        if (!adminUserData.username || !adminUserData.password || !adminUserData.email || !adminUserData.roleId) {
            throw new Error('Missing required user fields');
        }

        const adminUser = await models.User.create(adminUserData);
        console.log('✅ Admin user created with ID:', adminUser.id);

        // Update the roles to set createdBy to the admin user ID
        console.log('🔄 Updating role creators...');
        await Promise.all([
            adminRole.update({ createdBy: adminUser.id }),
            userRole.update({ createdBy: adminUser.id }),
            viewerRole.update({ createdBy: adminUser.id })
        ]);
        console.log('✅ Role creators updated');

        // Create default project
        console.log('📂 Creating default project...');
        const [defaultProject] = await models.Project.findOrCreate({
            where: { name: 'General Documents' },
            defaults: {
                name: 'General Documents',
                description: 'Default project for general document storage',
                type: 'custom',
                color: '#667eea',
                status: 'active',
                indexFields: [
                    {
                        name: 'document_type',
                        label: 'Document Type',
                        type: 'dropdown',
                        required: false,
                        options: ['Invoice', 'Contract', 'Report', 'Letter', 'Other']
                    },
                    {
                        name: 'date_received',
                        label: 'Date Received',
                        type: 'date',
                        required: false
                    },
                    {
                        name: 'priority',
                        label: 'Priority',
                        type: 'dropdown',
                        required: false,
                        options: ['Low', 'Medium', 'High', 'Urgent']
                    },
                    {
                        name: 'department',
                        label: 'Department',
                        type: 'dropdown',
                        required: false,
                        options: ['Finance', 'HR', 'Legal', 'Operations', 'Marketing']
                    },
                    {
                        name: 'amount',
                        label: 'Amount',
                        type: 'number',
                        required: false
                    }
                ],
                createdBy: adminUser.id
            }
        });
        console.log('✅ Default project created with ID:', defaultProject.id);

        // Create Finance project
        console.log('📂 Creating Finance project...');
        const [financeProject] = await models.Project.findOrCreate({
            where: { name: 'Finance Documents' },
            defaults: {
                name: 'Finance Documents',
                description: 'Financial documents, invoices, and reports',
                type: 'finance',
                color: '#28a745',
                status: 'active',
                indexFields: [
                    {
                        name: 'invoice_number',
                        label: 'Invoice Number',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'vendor',
                        label: 'Vendor',
                        type: 'text',
                        required: true
                    },
                    {
                        name: 'amount',
                        label: 'Amount',
                        type: 'number',
                        required: true
                    },
                    {
                        name: 'due_date',
                        label: 'Due Date',
                        type: 'date',
                        required: false
                    },
                    {
                        name: 'status',
                        label: 'Status',
                        type: 'dropdown',
                        required: false,
                        options: ['Pending', 'Approved', 'Paid', 'Rejected']
                    }
                ],
                createdBy: adminUser.id
            }
        });
        console.log('✅ Finance project created with ID:', financeProject.id);

        // Assign roles to projects
        console.log('🔗 Assigning roles to projects...');
        const existingDefaultAssignments = await models.ProjectRole.findAll({
            where: { projectId: defaultProject.id }
        });

        if (existingDefaultAssignments.length === 0) {
            await models.ProjectRole.bulkCreate([
                { projectId: defaultProject.id, roleId: adminRole.id },
                { projectId: defaultProject.id, roleId: userRole.id },
                { projectId: defaultProject.id, roleId: viewerRole.id }
            ]);
            console.log('✅ Roles assigned to default project');
        } else {
            console.log('✅ Default project role assignments already exist');
        }

        const existingFinanceAssignments = await models.ProjectRole.findAll({
            where: { projectId: financeProject.id }
        });

        if (existingFinanceAssignments.length === 0) {
            await models.ProjectRole.bulkCreate([
                { projectId: financeProject.id, roleId: adminRole.id },
                { projectId: financeProject.id, roleId: userRole.id }
            ]);
            console.log('✅ Roles assigned to finance project');
        } else {
            console.log('✅ Finance project role assignments already exist');
        }

        console.log('🎉 Initial data seeding completed successfully!\n');
        console.log('📋 Summary:');
        console.log(`  • Created 3 roles: Administrator, User, Viewer`);
        console.log(`  • Created admin user: admin / admin123`);
        console.log(`  • Created 2 projects with custom fields`);
        console.log(`  • Assigned roles to projects\n`);
        console.log('🔐 Default Credentials:');
        console.log('  Username: admin');
        console.log('  Password: admin123');
        console.log('  ⚠️  CHANGE THESE IN PRODUCTION!');

    } catch (error) {
        console.error('❌ Failed to seed initial data:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        throw error;
    }
}

// This function is called at server startup
async function initialize() {
    // If you use Sequelize or similar, sync all models here
    // await sequelize.sync();

    // Seed initial data
    await seedInitialData(models);
}

// Returns your models object for use elsewhere
function getModels() {
    return models;
}

// Optional: closes DB connection (if using Sequelize or similar)
async function close() {
    // If using Sequelize, for example:
    // await sequelize.close();
}

// Export all required functions so your server.js can call database.initialize()
module.exports = {
    initialize,
    seedInitialData,
    getModels,
    close
};