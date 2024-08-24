"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tickerRouter = void 0;
const express_1 = require("express");
exports.tickerRouter = (0, express_1.Router)();
exports.tickerRouter.get("/", (req, res) => {
    res.json({
        message: "Hello ticker",
    });
});
