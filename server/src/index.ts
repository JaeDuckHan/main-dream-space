import "dotenv/config";
import cors from "cors";
import express from "express";
import plannerRoutes from "./routes/planner.js";
import accommodationRoutes from "./routes/accommodations.js";
import affiliateRoutes from "./routes/affiliate.js";
import authRoutes from "./routes/auth.js";
import listingRoutes from "./routes/listings.js";
import adminListingRoutes from "./routes/admin-listings.js";
import communityRoutes from "./routes/community.js";
import coffeeChatRoutes from "./routes/coffee-chats.js";
import residentRoutes from "./routes/residents.js";
import adminCommunityRoutes from "./routes/admin-community.js";
import adminUserRoutes from "./routes/admin-users.js";
import adminStatsRoutes from "./routes/admin-stats.js";
import productRoutes from "./routes/products.js";
import adminProductRoutes from "./routes/admin-products.js";
import orderRoutes from "./routes/orders.js";
import adminOrderRoutes from "./routes/admin-orders.js";
import settingsRoutes from "./routes/settings.js";
import adminSettingsRoutes from "./routes/admin-settings.js";
import dashboardRoutes from "./routes/dashboard.js";
import newsletterRoutes from "./routes/newsletter.js";
import statsRoutes from "./routes/stats.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { pool } from "./db.js";
import { authSessionMiddleware } from "./lib/auth.js";
import { getUploadRoot } from "./lib/upload.js";
import { exchangeCache } from "./services/exchange-service.js";
import { residentsCountCache } from "./services/residents-count-service.js";
import { weatherCache } from "./services/weather-service.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendUrl = process.env.FRONTEND_URL;
const uploadRoot = getUploadRoot();

app.use(
  cors({
    origin: frontendUrl ? [frontendUrl] : true,
    credentials: true,
  }),
);
app.use(express.json());
app.set("trust proxy", true);
app.use(authSessionMiddleware);
app.use("/uploads", (req, res, next) => {
  if (req.path.endsWith("/")) {
    return res.status(403).json({ error: "Directory access denied" });
  }

  if (!/\.(?:jpg|jpeg|png|webp|gif)$/i.test(req.path)) {
    return res.status(403).json({ error: "File type denied" });
  }

  res.setHeader("X-Content-Type-Options", "nosniff");
  return next();
});
app.use(
  "/uploads",
  express.static(uploadRoot, {
    fallthrough: false,
    index: false,
    maxAge: "30d",
  }),
);

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", uptime: process.uptime() });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/oauth", authRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/admin/listings", adminListingRoutes);
app.use("/api/accommodations", accommodationRoutes);
app.use("/api/affiliate", affiliateRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/coffee-chats", coffeeChatRoutes);
app.use("/api/residents", residentRoutes);
app.use("/api/admin/community", adminCommunityRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/stats", adminStatsRoutes);
app.use("/api/products", productRoutes);
app.use("/api/admin/products", adminProductRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin/orders", adminOrderRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api", dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`dreamspace-api listening on ${port}`);
});

setTimeout(async () => {
  console.log("[warmup] preloading dashboard cache");

  try {
    await Promise.all([weatherCache.get(), exchangeCache.get(), residentsCountCache.get()]);
    console.log("[warmup] dashboard cache ready");
  } catch (error) {
    console.error("[warmup] dashboard cache failed", error);
  }
}, 2_000);
