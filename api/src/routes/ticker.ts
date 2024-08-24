import { Router } from "express";

export const tickerRouter = Router();

tickerRouter.get("/", (req, res) => {
  res.json({
    message: "Hello ticker",
  });
});
