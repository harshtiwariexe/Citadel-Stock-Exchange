import axios from "axios";

const BASE_URL = "http://localhost:3000";
const TOTAL_BIDS = 15;
const TOTAL_ASKS = 15;
const MARKET = "TATA_INR";
const USER_ID = "5";

async function main() {
  const price = 1000 + Math.random() * 10;
  const openOrder = await axios.get(
    `${BASE_URL}/api/v1/order/open?userID=${USER_ID}&market=${MARKET}`
  );

  const totalBids = openOrder.data.filter(
    (order: any) => order.side === "buy"
  ).length;
  const totalAsks = openOrder.data.filter(
    (order: any) => order.side === "asks"
  ).length;

  const cancelledBids = await cancelBidsMoreThan(openOrder.data, price);
  const cancelledAsks = await cancelAsksLessThan(openOrder.data, price);

  let bidsToAdd = TOTAL_BIDS - totalBids - cancelledBids;
  let asksToAdd = TOTAL_ASKS - totalAsks - cancelledAsks;

  while (bidsToAdd > 0 || asksToAdd > 0) {
    if (asksToAdd > 0) {
      await axios.post(`${BASE_URL}/api/v1/order`, {
        market: MARKET,
        price: (price + Math.random() * 1).toFixed(1).toString(),
        quantity: "1",
        side: "sell",
        userId: USER_ID,
      });
      asksToAdd--;
    }
    if (bidsToAdd > 0) {
      await axios.post(`${BASE_URL}/api/v1/order`, {
        market: MARKET,
        price: (price + Math.random() * 1).toFixed(1).toString(),
        quantity: "1",
        side: "buy",
        userId: USER_ID,
      });
      bidsToAdd--;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));

  main();
}
async function cancelBidsMoreThan(openOrder: any[], price: number) {
  let promises: any[] = [];

  openOrder.map((order) => {
    if (order.side === "buy" && (order.price > price || Math.random() < 0.1)) {
      promises.push(
        axios.delete(`${BASE_URL}/api/v1/order`, {
          data: {
            orderId: order.orderId,
            market: MARKET,
          },
        })
      );
    }
  });
  await Promise.all(promises);
  return promises.length;
}
async function cancelAsksLessThan(openOrder: any[], price: number) {
  let promises: any[] = [];

  openOrder.map((order) => {
    if (order.side === "sell" && (order.price < price || Math.random() < 0.5)) {
      promises.push(
        axios.delete(`${BASE_URL}/api/v1/order`, {
          data: {
            orderId: order.orderId,
            market: MARKET,
          },
        })
      );
    }
  });
  await Promise.all(promises);
  return promises.length;
}
main();
