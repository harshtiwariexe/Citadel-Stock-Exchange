"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRouter = void 0;
const RedisManager_1 = require("../RedisManager");
const express_1 = require("express");
const types_1 = require("../types");
exports.orderRouter = (0, express_1.Router)();
exports.orderRouter.post("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { price, quantity, market, side, userId } = req.body;
    console.log({ price, quantity, market, side, userId });
    const response = yield RedisManager_1.RedisManager.getInstance().sendAndAwait({
        type: types_1.CREATE_ORDER,
        data: {
            price,
            quantity,
            market,
            side,
            userId,
        },
    });
    res.json(response.payload);
}));
exports.orderRouter.delete("/", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderId, market } = req.body;
    const response = yield RedisManager_1.RedisManager.getInstance().sendAndAwait({
        type: types_1.CANCEL_ORDER,
        data: {
            market,
            orderId,
        },
    });
    res.json(response.payload);
}));
exports.orderRouter.get("/open", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const response = yield RedisManager_1.RedisManager.getInstance().sendAndAwait({
        type: types_1.GET_OPEN_ORDERS,
        data: {
            userId: req.query.userId,
            market: req.query.market,
        },
    });
    res.json(response.payload);
}));
