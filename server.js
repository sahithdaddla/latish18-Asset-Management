const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const port = 3000;

// PostgreSQL connection configuration
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'asset_management',
    password: 'root',
    port: 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to check if a request exists within the last 24 hours
async function hasRecentRequest(employeeId, assetType) {
    try {
        const query = `
            SELECT COUNT(*) 
            FROM requests 
            WHERE employee_id = $1 
            AND asset_type = $2 
            AND is_active = true
            AND request_date >= NOW() - INTERVAL '24 hours'
        `;
        const result = await pool.query(query, [employeeId, assetType]);
        return parseInt(result.rows[0].count) > 0;
    } catch (error) {
        console.error('Error checking recent request:', error);
        throw error;
    }
}

// Get all requests (HR side)
app.get('/api/requests', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, employee_id, asset_type, reason, status, 
                   request_date, status_update_date, is_active 
            FROM requests 
            ORDER BY request_date DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Submit new request (Employee side)
app.post('/api/requests', async (req, res) => {
    const { employeeId, assetType, reason } = req.body;

    // Validation
    if (!employeeId || !assetType || !reason) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const idRegex = /^ATS0(?!000)\d{3}$/;
    if (!idRegex.test(employeeId)) {
        return res.status(400).json({ error: 'Invalid Employee ID format' });
    }

    if (reason.trim().length < 5 || !/^[A-Za-z0-9\s.,?@&()[\]\\|\/'"]+$/.test(reason)) {
        return res.status(400).json({ error: 'Invalid reason' });
    }

    try {
        // Check for recent request (within 24 hours)
        if (await hasRecentRequest(employeeId, assetType)) {
            return res.status(400).json({ 
                error: 'Cannot request the same asset type within 24 hours of a previous request' 
            });
        }

        const query = `
            INSERT INTO requests (
                employee_id, asset_type, reason, status, 
                request_date, is_active
            ) VALUES ($1, $2, $3, $4, NOW(), true) 
            RETURNING *
        `;
        const result = await pool.query(query, [
            employeeId, 
            assetType, 
            reason.trim(), 
            'pending'
        ]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error submitting request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update request status (HR side)
app.put('/api/requests/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const query = `
            UPDATE requests 
            SET status = $1, 
                status_update_date = NOW(),
                is_active = $2
            WHERE id = $3 
            RETURNING *
        `;
        const isActive = status === 'pending';
        const result = await pool.query(query, [status, isActive, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Clear selected requests (HR side)
app.delete('/api/requests', async (req, res) => {
    const { ids } = req.body;
    console.log('DELETE /api/requests called with IDs:', ids);

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No requests selected' });
    }

    try {
        const query = `
            DELETE FROM requests 
            WHERE id = ANY($1)
            RETURNING id
        `;
        const result = await pool.query(query, [ids]);
        console.log('Deleted rows:', result.rows);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No requests found' });
        }

        res.json({ message: `${result.rows.length} requests deleted permanently` });
    } catch (error) {
        console.error('Error deleting requests:', error.stack);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get claim history for an employee (HR side)
app.get('/api/requests/history/:employeeId', async (req, res) => {
    const { employeeId } = req.params;

    try {
        const query = `
            SELECT id, asset_type, request_date, status 
            FROM requests 
            WHERE employee_id = $1 
            ORDER BY request_date DESC
        `;
        const result = await pool.query(query, [employeeId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching claim history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
