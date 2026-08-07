import { Router } from 'express'
import { getDashboardReport, getReportTypes, postReport } from '../controllers/report.controller.js'

const router = Router()

router.get('/types', getReportTypes)
router.get('/dashboard', getDashboardReport)
router.post('/generate', postReport)

export default router
