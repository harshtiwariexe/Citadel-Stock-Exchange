import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export const DATABASE_URL = process.env.DATABASE_URL as string;
