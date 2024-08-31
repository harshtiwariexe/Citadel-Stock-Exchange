import fs from "fs";
import { RedisManager } from "../RedisManager";
import { ORDER_UPDATE, TRADE_ADDED } from "../types";
import {
  CANCEL_ORDER,
  CREATE_ORDER,
  GET_DEPTH,
  GET_OPEN_ORDERS,
  MessageFromApi,
  ON_RAMP,
} from "../types/fromAPI";
import { Fill, Order, Orderbook } from "./Orderbook";

export const BASE_CURRENCY = "INR";

interface UserBalance {
  [key: string]: {
    available: number;
    locked: number;
  };
}

export class Engine {
  private orderbooks: Orderbook[] = [];
  private balances: Map<string, UserBalance> = new Map();

  constructor() {
    let snapshot = null;
    try {
      if (process.env.WITH_SNAPSHOT) {
        snapshot = fs.readFileSync("./snapshot.json");
      }
    } catch (e) {
      console.log("No snapshot found");
    }

    if (snapshot) {
      const snapshotSnapshot = JSON.parse(snapshot.toString());
      this.orderbooks = snapshotSnapshot.orderbooks.map(
        (order: any) =>
          new Orderbook(
            order.baseAsset,
            order.bids,
            order.asks,
            order.lastTradeId,
            order.currentPrice
          )
      );
      this.balances = new Map(snapshotSnapshot.balances);
    } else {
      this.orderbooks = [new Orderbook("TATA", [], [], 0, 0)];
      this.setBaseBalances();
    }
    setInterval(() => {
      this.saveSnapshot();
    }, 1000 * 5);
  }

  saveSnapshot() {
    const snapshotSnapshot = {
      orderbooks: this.orderbooks.map((order) => order.getSnapshot()),
      balances: Array.from(this.balances.entries()),
    };
    fs.writeFileSync("./snapshot.json", JSON.stringify(snapshotSnapshot));
  }

  process({
    message,
    clientId,
  }: {
    message: MessageFromApi;
    clientId: string;
  }) {
    switch (message.type) {
      case CREATE_ORDER:
        try {
          const { executedQty, fills, orderId } = this.createOrder(
            message.data.market,
            message.data.price,
            message.data.quantity,
            message.data.side,
            message.data.userId
          );
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_PLACED",
            payload: {
              orderId,
              executedQty,
              fills,
            },
          });
        } catch (e) {
          console.log(e);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId: "",
              executedQty: 0,
              remainingQty: 0,
            },
          });
        }
        break;
      case CANCEL_ORDER:
        try {
          const orderId = message.data.orderId;
          const cancelMarket = message.data.market;
          const cancelOrderbook = this.orderbooks.find(
            (order) => order.ticker() === cancelMarket
          );
          const quoteAsset = cancelMarket.split("_")[1];
          if (!cancelOrderbook) {
            throw new Error("No Orderbook find");
          }
          const order =
            cancelOrderbook.asks.find((order) => order.orderId === orderId) ||
            cancelOrderbook.bids.find((order) => order.orderId === orderId);
          if (!order) {
            console.log("No order found");
            throw new Error("No Order Found");
          }

          if (order.side === "buy") {
            const price = cancelOrderbook.cancelBid(order);
            const leftQuantity = (order.quantity - order.filled) * order.price;
            //@ts-ignore
            this.balances.get(order.userId)[BASE_CURRENCY].available +=
              leftQuantity;
            //@ts-ignore
            this.balances.get(order.userId)[BASE_CURRENCY].locked -=
              leftQuantity;

            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          } else {
            const price = cancelOrderbook.cancelAsks(order);
            const leftQuantity = order.quantity - order.filled;
            //@ts-ignore
            this.balances.get(order.orderId)[quoteAsset].available +=
              leftQuantity;
            //@ts-ignore
            this.balances.get(order.userId)[quoteAsset].locked -= leftQuantity;

            if (price) {
              this.sendUpdatedDepthAt(price.toString(), cancelMarket);
            }
          }
          RedisManager.getInstance().sendToApi(clientId, {
            type: "ORDER_CANCELLED",
            payload: {
              orderId,
              executedQty: 0,
              remainingQty: 0,
            },
          });
        } catch (e) {
          console.log("Error while cancelling order");
          console.log(e);
        }
        break;
      case GET_OPEN_ORDERS:
        try {
          const openOrderbook = this.orderbooks.find(
            (order) => order.ticker() === message.data.market
          );
          if (!openOrderbook) {
            throw new Error("No Orderbook Found");
          }
          const openOrders = openOrderbook.getOpenOrders(message.data.userId);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "OPEN_ORDERS",
            payload: openOrders,
          });
        } catch (error) {
          console.log(error);
        }
        break;
      case ON_RAMP:
        try {
          const userId = message.data.userId;
          const amount = Number(message.data.amount);
          this.onRamp(userId, amount);
        } catch (error) {
          console.log(error);
        }
        break;
      case GET_DEPTH:
        try {
          const market = message.data.market;
          const orderbook = this.orderbooks.find(
            (order) => order.ticker() === market
          );
          if (!orderbook) {
            throw new Error("No Orderbook Found");
          }
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: orderbook.getDepth(),
          });
        } catch (error) {
          console.log(error);
          RedisManager.getInstance().sendToApi(clientId, {
            type: "DEPTH",
            payload: {
              bids: [],
              asks: [],
            },
          });
        }
        break;
    }
  }
  createOrder(
    market: string,
    price: string,
    quantity: string,
    side: "buy" | "sell",
    userId: string
  ) {
    const orderbook = this.orderbooks.find(
      (order) => order.ticker() === market
    );
    const baseAsset = market.split("_")[0];
    const quoteAsset = market.split("_")[1];

    if (!orderbook) {
      throw new Error("No Orderbook Found");
    }

    this.checkAndLockFunds(
      baseAsset,
      quoteAsset,
      side,
      userId,
      price,
      quantity
    );

    const order: Order = {
      price: Number(price),
      quantity: Number(price),
      orderId:
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15),
      filled: 0,
      side,
      userId,
    };
    const { fills, executedQty } = orderbook.addOrder(order);

    this.updateBalance(userId, baseAsset, quoteAsset, side, fills, executedQty);
    this.createDbTrades(fills, market, userId);
    this.updateDbOrders(order, executedQty, fills, market);
    this.publishWebSocketDepthUpdates(fills, price, side, market);
    this.publishWebSocketTrades(fills, userId, market);
    return { executedQty, fills, orderId: order.orderId };
  }

  updateDbOrders(
    order: Order,
    executedQty: number,
    fills: Fill[],
    market: string
  ) {
    RedisManager.getInstance().pushMessage({
      type: ORDER_UPDATE,
      data: {
        orderId: order.orderId,
        executedQty: executedQty,
        market: market,
        price: order.price.toString(),
        quantity: order.quantity.toString(),
        side: order.side,
      },
    });
    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: ORDER_UPDATE,
        data: {
          orderId: fill.marketOrderId,
          executedQty: fill.qty,
        },
      });
    });
  }
  createDbTrades(fills: Fill[], market: string, userId: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().pushMessage({
        type: TRADE_ADDED,
        data: {
          market: market,
          id: fill.tradeId.toString(),
          isBuyerMarket: fill.otherUserId === userId,
          price: fill.price,
          quantity: fill.qty.toString(),
          quoteQuantity: (fill.qty * Number(fill.price)).toString(),
          timestamp: Date.now(),
        },
      });
    });
  }
  publishWebSocketTrades(fills: Fill[], userId: string, market: string) {
    fills.forEach((fill) => {
      RedisManager.getInstance().publishMessage(`trade@${market}`, {
        stream: `trade@${market}`,
        data: {
          e: "trade",
          t: fill.tradeId,
          m: fill.otherUserId === userId,
          p: fill.price,
          q: fill.qty.toString(),
          s: market,
        },
      });
    });
  }
  sendUpdatedDepthAt(price: string, market: string) {
    const orderbook = this.orderbooks.find(
      (order) => order.ticker() === market
    );
    if (!orderbook) return;

    const depth = orderbook.getDepth();
    const updatedBids = depth?.bids.filter((x) => x[0] === price);
    const updatedAsks = depth?.asks.filter((x) => x[0] === price);

    RedisManager.getInstance().publishMessage(`depth@${market}`, {
      stream: `depth@${market}`,
      data: {
        a: updatedAsks.length ? updatedAsks : [[price, "0"]],
        b: updatedBids.length ? updatedBids : [[price, "0"]],
        e: "depth",
      },
    });
  }
  publishWebSocketDepthUpdates(
    fills: Fill[],
    price: string,
    side: "buy" | "sell",
    market: string
  ) {
    const orderbook = this.orderbooks.find(
      (order) => order.ticker() === market
    );
    if (!orderbook) {
      return;
    }
    const depth = orderbook.getDepth();
    if (side === "buy") {
      const updatedAsks = depth?.asks.filter((x) =>
        fills.map((f) => f.price).includes(x[0].toString())
      );
      const updatedBids = depth?.bids.find((x) => x[0] === price);
      console.log("Published WebSocket Depth Updates");

      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsks,
          b: updatedBids ? [updatedBids] : [],
          e: "depth",
        },
      });
    }
    if (side === "sell") {
      const updatedBids = depth?.bids.filter((x) =>
        fills.map((f) => f.price).includes(x[0].toString())
      );
      const updatedAsks = depth?.asks.find((x) => x[0] === price);
      console.log("Published WebSocket Depth Updates");

      RedisManager.getInstance().publishMessage(`depth@${market}`, {
        stream: `depth@${market}`,
        data: {
          a: updatedAsks ? [updatedAsks] : [],
          b: updatedBids,
          e: "depth",
        },
      });
    }
  }
  updateBalance(
    userId: string,
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    fills: Fill[],
    executedQty: number
  ) {
    if (side === "buy") {
      fills.forEach((fill) => {
        // QUOTE ASSET BALANCE
        //@ts-ignore
        this.balances.get(fill.otherUserId)[quoteAsset].available =
          //@ts-ignore
          this.balances.get(fill.otherUserId)?.[quoteAsset]?.available +
          //@ts-ignore
          fill.qty * fill.price;
        //@ts-ignore
        this.balances.get(userId)[quoteAsset].locked =
          //@ts-ignore
          this.balances.get(userId)?.[quoteAsset].locked -
          //@ts-ignore
          fill.qty * fill.price;

        // BASE ASSET BALANCE
        //@ts-ignore
        this.balances.get(fill.otherUserId)[baseAsset].available =
          //@ts-ignore
          this.balances.get(fill.otherUserId)?.[baseAsset].available + fill.qty;

        //@ts-ignore
        this.balances.get(userId)[baseAsset].locked =
          //@ts-ignore
          this.balances.get(userId)?.[baseAsset].locked - fill.qty;
      });
    } else {
      fills.forEach((fill) => {
        // QUOTE ASSET BALANCE
        //@ts-ignore
        this.balances.get(fill.otherUserId)[quoteAsset].locked =
          //@ts-ignore
          this.balances.get(fill.otherUserId)?.[quoteAsset]?.locked -
          //@ts-ignore
          fill.qty * fill.price;
        //@ts-ignore
        this.balances.get(userId)[quoteAsset].available =
          //@ts-ignore
          this.balances.get(userId)?.[quoteAsset].available +
          //@ts-ignore
          fill.qty * fill.price;

        // BASE ASSET BALANCE
        // Review It later
        //@ts-ignore
        this.balances.get(fill.otherUserId)[baseAsset].available =
          //@ts-ignore
          this.balances.get(fill.otherUserId)?.[baseAsset].available + fill.qty;

        //@ts-ignore
        this.balances.get(userId)[baseAsset].locked =
          //@ts-ignore
          this.balances.get(userId)?.[baseAsset].locked - fill.qty;
      });
    }
  }

  checkAndLockFunds(
    baseAsset: string,
    quoteAsset: string,
    side: "buy" | "sell",
    userId: string,
    price: string,
    quantity: string
  ) {
    if (side === "buy") {
      if (
        (this.balances.get(userId)?.[quoteAsset]?.available || 0) <
        Number(quantity) * Number(price)
      ) {
        throw new Error("Insufficient Funds");
      }
      //@ts-ignore
      this.balances.get(userId)[quoteAsset].available =
        //@ts-ignore
        this.balances.get(userId)?.[quoteAsset].available -
        Number(quantity) * Number(price);
      //@ts-ignore
      this.balances.get(userId)[quoteAsset].locked =
        //@ts-ignore
        this.balances.get(userId)?.[quoteAsset].locked +
        Number(quantity) * Number(price);
    } else {
      if (
        (this.balances.get(userId)?.[baseAsset]?.available || 0) <
        Number(quantity)
      ) {
        throw new Error("Insufficient Funds");
      }
      //@ts-ignore

      this.balances.get(userId)[baseAsset].available =
        //@ts-ignore
        this.balances.get(userId)?.[baseAsset].available - Number(quantity);
      //@ts-ignore
      this.balances.get(userId)[baseAsset].locked =
        //@ts-ignore
        this.balances.get(userId)?.[baseAsset].locked + Number(quantity);
    }
  }
  onRamp(userId: string, amount: number) {
    const userBalance = this.balances.get(userId);
    if (!userBalance) {
      this.balances.set(userId, {
        [BASE_CURRENCY]: {
          available: amount,
          locked: 0,
        },
      });
    } else {
      userBalance[BASE_CURRENCY].available += amount;
    }
  }
  setBaseBalances() {
    this.balances.set("1", {
      [BASE_CURRENCY]: {
        available: 10000000,
        locked: 0,
      },
      TATA: {
        available: 10000000,
        locked: 0,
      },
    });

    this.balances.set("2", {
      [BASE_CURRENCY]: {
        available: 10000000,
        locked: 0,
      },
      TATA: {
        available: 10000000,
        locked: 0,
      },
    });

    this.balances.set("5", {
      [BASE_CURRENCY]: {
        available: 10000000,
        locked: 0,
      },
      TATA: {
        available: 10000000,
        locked: 0,
      },
    });
  }
}
