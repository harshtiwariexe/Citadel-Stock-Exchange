import { RedisManager } from "../RedisManager";
import { Router } from "express";
import { CREATE_ORDER, CANCEL_ORDER, ON_RAMP, GET_OPEN_ORDERS } from "../types";

export const orderRouter = Router();

orderRouter.post("/", async (req, res) => {
  const { price, quantity, market, side, userId } = req.body;
  console.log({ price, quantity, market, side, userId });

  const response = await RedisManager.getInstance().sendAndAwait({
    type: CREATE_ORDER,
    data: {
      price,
      quantity,
      market,
      side,
      userId,
    },
  });
  res.json(response.payload);
});

orderRouter.delete("/", async (req, res) => {
  const { orderId, market } = req.body;

  const response = await RedisManager.getInstance().sendAndAwait({
    type: CANCEL_ORDER,
    data: {
      market,
      orderId,
    },
  });
  res.json(response.payload);
});

orderRouter.get("/open", async (req, res) => {
  const response = await RedisManager.getInstance().sendAndAwait({
    type: GET_OPEN_ORDERS,
    data: {
      userId: req.query.userId as string,
      market: req.query.market as string,
    },
  });
  res.json(response.payload);
});
