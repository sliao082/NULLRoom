const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

async function query(sql, params = []) {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await connection.execute(sql, params);
        return rows;
    } catch (error) {
        console.error('Database query error:', error.message);
        throw error;
    } finally {
        connection.end();
    }
}

module.exports = {
    query,
};


// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyB6yLIZJNz5nvPJqnUbaNQ-DMcN7W3w1L0",
//   authDomain: "nullroom-654aa.firebaseapp.com",
//   projectId: "nullroom-654aa",
//   storageBucket: "nullroom-654aa.firebasestorage.app",
//   messagingSenderId: "171052739586",
//   appId: "1:171052739586:web:16262bcf7dd7ae1e95cb1b",
//   measurementId: "G-ZFGQNHHWGV"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);