import { Router } from 'express'
import { getReportTypes, postReport } from '../controllers/report.controller.js'

const router = Router()

router.get('/types', getReportTypes)
router.post('/generate', postReport)

export default router
