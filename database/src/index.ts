import { client } from "./db";
import { createClient } from "redis";
import { DbMessage } from "./types";

async function main() {
  const redisClient = createClient();
  await redisClient.connect();

  console.log("Connected to redis");

  while (true) {
    const response = await redisClient.rPop("db_processor" as string);

    if (!response) {
    } else {
      const data: DbMessage = JSON.parse(response);

      if (data.type === "TRADE_ADDED") {
        console.log("Adding data");
        console.log(data);
        const price = data.data.price;
        const volume = data.data.quantity;
        const timestamp = new Date(data.data.timestamp);
        const query = `INSERT INTO tata_prices (time, price, volume) VALUES ($1,$2)`;
        const values = [timestamp, price, volume];
        await client.query(query, values);
      }
    }
  }
}
