import https from "node:https";
import { EventEmitter } from "node:events";

const originalRequest = https.request;

https.request = function (input, options, callback) {
  const url = input instanceof URL ? input : new URL(input);
  if (url.hostname !== "93.184.216.34") {
    return originalRequest.call(this, input, options, callback);
  }

  const request = new EventEmitter();
  let requestBody = "";
  request.write = (chunk) => {
    requestBody += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
    return true;
  };
  request.setTimeout = () => request;
  request.destroy = (error) => {
    if (error) queueMicrotask(() => request.emit("error", error));
    return request;
  };
  request.end = () => {
    const response = new EventEmitter();
    response.statusCode = 200;
    response.headers = { "content-type": "application/json" };
    response.destroy = (error) => {
      if (error) response.emit("error", error);
    };
    const responseCallback = typeof options === "function" ? options : callback;
    responseCallback?.(response);
    queueMicrotask(() => {
      response.emit("data", Buffer.from(JSON.stringify({
        data: { amount: 150, invoiceId: "inv_mock_123" },
      })));
      response.emit("end");
    });
    return request;
  };
  return request;
};
