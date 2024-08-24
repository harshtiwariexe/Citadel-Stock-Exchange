import { query, Router } from "express";
import { client } from "../db";

export const balanceRouter = Router();

balanceRouter.get("/", async (req, res) => {
  const userId = req.query.userId;

  const query = `SELECT balance FROM user WHERE userId = $1`;
  const values = [userId];

  try {
    const result = await client.query(query, values);
    if (result.rows.length > 0) {
      res.json({ balance: result.rows[0].balance });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
