import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
const pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Export a function to get a connection
export const getDatabaseConnection = async () => {
    const connection = await pool.getConnection();
    return connection;
};

// Optionally export a function to close the pool
export const closeDatabasePool = async () => {
    await pool.end();
};
