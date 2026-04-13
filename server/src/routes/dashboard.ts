import { Router } from "express";
import { exchangeCache } from "../services/exchange-service.js";
import { residentsCountCache } from "../services/residents-count-service.js";
import { weatherCache } from "../services/weather-service.js";

const router = Router();

router.get("/dashboard", async (_req, res) => {
  const [weather, exchange, residents] = await Promise.all([
    weatherCache.get().catch(() => null),
    exchangeCache.get().catch(() => null),
    residentsCountCache.get().catch(() => null),
  ]);

  res.json({
    weather,
    exchange,
    residents,
  });
});

export default router;
