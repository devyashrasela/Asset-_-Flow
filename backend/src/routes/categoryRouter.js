import express from 'express';
import { listCategories, createCategory, updateCategory } from '../controllers/categoryController.js';
import { authenticateToken, requireOrganizationContext, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Plan-compliant paths
router.get('/org/categories', authenticateToken, requireOrganizationContext, listCategories);
router.post('/org/categories', authenticateToken, requireOrganizationContext, requireRole(['Admin']), createCategory);
router.patch('/org/categories/:id', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateCategory);

// Compatibility paths
router.get('/categories', authenticateToken, requireOrganizationContext, listCategories);
router.post('/categories', authenticateToken, requireOrganizationContext, requireRole(['Admin']), createCategory);
router.put('/categories/:id', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateCategory);
router.patch('/categories/:id', authenticateToken, requireOrganizationContext, requireRole(['Admin']), updateCategory);

export default router;
