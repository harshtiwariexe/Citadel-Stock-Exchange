import express from "express";
import cors from "cors";
import { depthRouter } from "./routes/depth";
import { klineRouter } from "./routes/kline";
import { orderRouter } from "./routes/order";
import { tradesRouter } from "./routes/trades";
import { tickerRouter } from "./routes/ticker";
import { balanceRouter } from "./routes/balance";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1/order", orderRouter);
app.use("/api/v1/depth", depthRouter);
app.use("/api/v1/trades", tradesRouter);
app.use("/api/v1/kline", klineRouter);
app.use("/api/v1/ticker", tickerRouter);
app.use("/api/v1/balance", balanceRouter);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
