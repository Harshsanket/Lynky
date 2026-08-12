import express from "express";

export const jsonMiddleware = express.json({
  limit: "1mb",
});