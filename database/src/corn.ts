import { client } from "./db";

async function refreshViews() {
  await client.query("REFRESH MATERIALIZED VIEW klines_1m");
  await client.query("REFRESH MATERIALIZED VIEW klines_1h");
  await client.query("REFRESH MATERIALIZED VIEW klines_1w");

  console.log("Materialized view refreshed successs!!!");
}
refreshViews().catch(console.error);

setInterval(() => {
  refreshViews();
}, 10000);
