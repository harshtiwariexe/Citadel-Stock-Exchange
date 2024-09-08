import { RedisClientType, createClient } from "redis";
import { UserManager } from "./UserManager";

export class SubscriptionManager {
  private static instance: SubscriptionManager;
  private subscription: Map<string, string[]> = new Map();
  private reverseSubscribtion: Map<string, string[]> = new Map();
  private redisClient: RedisClientType;

  private constructor() {
    this.redisClient = createClient();
    this.redisClient.connect();
  }

  public static getInstance() {
    if (!this.instance) {
      this.instance = new SubscriptionManager();
    }
    return this.instance;
  }

  public subscribe(userId: string, subscription: string) {
    if (this.subscription.get(userId)?.includes(subscription)) return;

    this.subscription.set(
      userId,
      (this.subscription.get(userId) || []).concat(subscription)
    );
    this.reverseSubscribtion.set(
      subscription,
      (this.reverseSubscribtion.get(subscription) || []).concat(userId)
    );

    if (this.reverseSubscribtion.get(subscription)?.length === 1) {
      this.redisClient.subscribe(subscription, this.redisCallbackHandler);
    }
  }
  private redisCallbackHandler = (message: string, channel: string) => {
    const parsedMessage = JSON.parse(message);
    this.reverseSubscribtion
      .get(channel)
      ?.forEach((s) =>
        UserManager.getInstance().getUser(s)?.emit(parsedMessage)
      );
  };

  public unsubscribe(userId: string, subscription: string) {
    const subscriptions = this.subscription.get(userId);

    if (subscriptions) {
      this.subscription.set(
        userId,
        subscriptions.filter((s) => s !== subscription)
      );
    }
    const reverseSubscribtions = this.reverseSubscribtion.get(subscription);

    if (reverseSubscribtions) {
      this.reverseSubscribtion.set(
        subscription,
        reverseSubscribtions.filter((s) => s !== userId)
      );
      if (this.reverseSubscribtion.get(subscription)?.length === 0) {
        this.reverseSubscribtion.delete(subscription);
        this.redisClient.unsubscribe(subscription);
      }
    }
  }
  public userLeft(userId: string) {
    console.log("User left" + userId);
    this.subscription.get(userId)?.forEach((s) => this.unsubscribe(userId, s));
  }
  getSubscriptions(userId: string) {
    return this.subscription.get(userId) || [];
  }
}
