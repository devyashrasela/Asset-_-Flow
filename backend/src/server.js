import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './config/swagger.js';
import { sequelize } from './models/index.js';
import { startBookingScheduler } from './utils/bookingScheduler.js';

// Import routers
import authRouter from './routes/authRouter.js';
import orgRouter from './routes/orgRouter.js';
import deptRouter from './routes/deptRouter.js';
import categoryRouter from './routes/categoryRouter.js';
import assetRouter from './routes/assetRouter.js';
import allocationRouter from './routes/allocationRouter.js';
import bookingRouter from './routes/bookingRouter.js';
import maintenanceRouter from './routes/maintenanceRouter.js';
import auditRouter from './routes/auditRouter.js';
import notificationRouter from './routes/notificationRouter.js';
import logRouter from './routes/logRouter.js';
import dashboardRouter from './routes/dashboardRouter.js';
import reportsRouter from './routes/reportsRouter.js';

const app = express();

app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  res.on('finish', () => {
    console.log(`[RESPONSE] ${req.method} ${req.url} -> ${res.statusCode}`);
  });
  next();
});

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Swagger UI Docs route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Public health check route
app.get('/', (req, res) => {
  res.json({ message: "AssetFlow API is working (Sequelize MVC)!", status: "healthy" });
});

// Register routers
app.use('/api/auth', authRouter);
app.use('/api', orgRouter);
app.use('/api', deptRouter);
app.use('/api', categoryRouter);
app.use('/api', assetRouter);
app.use('/api', allocationRouter);
app.use('/api', bookingRouter);
app.use('/api', maintenanceRouter);
app.use('/api', auditRouter);
app.use('/api', notificationRouter);
app.use('/api', logRouter);
app.use('/api', dashboardRouter);
app.use('/api', reportsRouter);

// Sync database on startup
export const syncDatabase = async () => {
  try {
    console.log('Syncing Sequelize models with MySQL Database...');
    await sequelize.sync();
    console.log('Sequelize database models synchronized successfully!');
    
    // Start the scheduled background booking scheduler
    startBookingScheduler();

  } catch (err) {
    console.error('Failed to sync Sequelize database models:', err);
    throw err;
  }
};


// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error. Please contact support.' });
});

export default app;