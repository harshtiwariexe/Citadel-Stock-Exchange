"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisManager = void 0;
const redis_1 = require("redis");
class RedisManager {
    // Making constructor private so that no one can make object outside the class
    // Following Singleton Patter
    constructor() {
        this.client = (0, redis_1.createClient)();
        this.publisher = (0, redis_1.createClient)();
        this.client.connect();
        this.publisher.connect();
    }
    // Lazy Initialization (better for single thread)
    // When compiler run this it checks if the instance object is already created or not
    static getInstance() {
        if (!this.instance) {
            this.instance = new RedisManager();
        }
        return this.instance;
    }
    sendAndAwait(message) {
        return new Promise((resolve) => {
            const id = this.getRandomClientId();
            this.client.subscribe(id, (message) => {
                this.client.unsubscribe(id);
                resolve(JSON.parse(message));
            });
            this.publisher.lPush("message", JSON.stringify({ clientId: id, message }));
        });
    }
    getRandomClientId() {
        return (Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15));
    }
}
exports.RedisManager = RedisManager;
