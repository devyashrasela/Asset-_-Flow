import dotenv from 'dotenv';
dotenv.config();

import app, { syncDatabase } from "./src/server.js";

const port = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await syncDatabase();
        app.listen(port, () => {
            console.log(`This app is listening on port: ${port}`);
        });
    }
    catch (err) {
        console.log("error: ", err.message);
    }
};

startServer();