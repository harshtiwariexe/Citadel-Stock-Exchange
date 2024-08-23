import { RedisClientType, createClient } from "redis";
import { MessageFromOrderbook } from "./types";
import { MessageToEngine } from "./types/to";

export class RedisManager {
  private client: RedisClientType; // Creating private client
  private publisher: RedisClientType;
  private static instance: RedisManager; // Creating private instance with return ttype of RedisManagar

  // Making constructor private so that no one can make object outside the class
  // Following Singleton Patter
  private constructor() {
    this.client = createClient();
    this.publisher = createClient();
    this.client.connect();
    this.publisher.connect();
  }

  // Lazy Initialization (better for single thread)
  // When compiler run this it checks if the instance object is already created or not

  public static getInstance() {
    if (!this.instance) {
      this.instance = new RedisManager();
    }
    return this.instance;
  }

  public sendAndAwait(message: MessageToEngine) {
    return new Promise<MessageFromOrderbook>((resolve) => {
      const id = this.getRandomClientId();
      this.client.subscribe(id, (message) => {
        this.client.unsubscribe(id);
        resolve(JSON.parse(message));
      });
      this.publisher.lPush(
        "message",
        JSON.stringify({ clientId: id, message })
      );
    });
  }
  public getRandomClientId() {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
