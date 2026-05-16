import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import firmsRouter from "./firms.js";
import vouchersRouter from "./vouchers.js";
import ledgersRouter from "./ledgers.js";
import salesRouter from "./sales.js";
import reportsRouter from "./reports.js";
import settingsRouter from "./settings.js";
import backupRouter from "./backup.js";
import partiesRouter from "./parties.js";
import itemsRouter from "./items.js";
import outstandingRouter from "./outstanding.js";
import gstRouter from "./gst.js";
import chequesRouter from "./cheques.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(firmsRouter);
router.use(vouchersRouter);
router.use(ledgersRouter);
router.use(salesRouter);
router.use(reportsRouter);
router.use(settingsRouter);
router.use(backupRouter);
router.use(partiesRouter);
router.use(itemsRouter);
router.use(outstandingRouter);
router.use(gstRouter);
router.use(chequesRouter);

export default router;
