import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as noflo from "@noflo/noflo";

import { getComponent as getCleanDisconnect } from "../components/CleanDisconnect.js";
import { getComponent as getCleanSplit } from "../components/CleanSplit.js";
import { getComponent as getConcat } from "../components/Concat.js";
import { getComponent as getFork } from "../components/Fork.js";
import { getComponent as getReorder } from "../components/Reorder.js";
import { getComponent as getReverseSplit } from "../components/ReverseSplit.js";
import { getComponent as getThrottle } from "../components/Throttle.js";
import { collect, render } from "./helpers.js";

describe("CleanSplit component", () => {
  it("re-emits the complete stream only at its end", async () => {
    const c = getCleanSplit();
    const inSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    inSocket.post(new noflo.IP("openBracket", "foo"));
    inSocket.post(new noflo.IP("data", "a"));
    // Nothing sent before the stream is complete
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(outIps, []);
    inSocket.post(new noflo.IP("closeBracket", "foo"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(render(outIps), ["< foo", 'DATA "a"', ">"]);
    c.tearDown?.(() => {});
  });
});

describe("CleanDisconnect component", () => {
  it("separates streams per connection index", () => {
    const c = getCleanDisconnect();
    const inA = noflo.internalSocket.createSocket();
    const inB = noflo.internalSocket.createSocket();
    const outA = noflo.internalSocket.createSocket();
    const outB = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inA, 0);
    c.inPorts.in.attach(inB, 1);
    c.outPorts.out.attach(outA, 0);
    c.outPorts.out.attach(outB, 1);
    const outAIps = collect(outA);
    const outBIps = collect(outB);
    inA.post(new noflo.IP("data", "a"));
    inB.post(new noflo.IP("data", "b"));
    assert.deepEqual(render(outAIps), ['DATA "a"']);
    assert.deepEqual(render(outBIps), ['DATA "b"']);
    c.tearDown?.(() => {});
  });
});

describe("Concat component", () => {
  it("waits for all connections and concatenates in order", async () => {
    const c = getConcat();
    const inA = noflo.internalSocket.createSocket();
    const inB = noflo.internalSocket.createSocket();
    const outA = noflo.internalSocket.createSocket();
    const outB = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inA, 0);
    c.inPorts.in.attach(inB, 1);
    c.outPorts.out.attach(outA, 0);
    c.outPorts.out.attach(outB, 1);
    const outAIps = collect(outA);
    const outBIps = collect(outB);
    inA.post(new noflo.IP("data", "a"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(
      [...outAIps, ...outBIps].filter((ip) => ip.type === "data"),
      [],
    );
    inB.post(new noflo.IP("data", "b"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const dataIps = [...outAIps, ...outBIps].filter((ip) => ip.type === "data");
    // Streams are emitted in connection order, each carrying its source
    // connection index
    assert.deepEqual(
      dataIps.map((ip) => ip.data),
      ["a", "b"],
    );
    assert.deepEqual(
      dataIps.map((ip) => ip.index),
      [0, 1],
    );
    c.tearDown?.(() => {});
  });
});

describe("Fork component", () => {
  /** @returns {{ c: import("@noflo/noflo").Component, inSocket: import("@noflo/noflo").internalSocket.InternalSocket, portSocket: import("@noflo/noflo").internalSocket.InternalSocket, sockets: import("@noflo/noflo").internalSocket.InternalSocket[], ipLists: import("@noflo/noflo").IP[][] }} */
  const build = () => {
    const c = getFork();
    const inSocket = noflo.internalSocket.createSocket();
    const portSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.port.attach(portSocket);
    /** @type {import("@noflo/noflo").internalSocket.InternalSocket[]} */
    const sockets = [];
    /** @type {import("@noflo/noflo").IP[][]} */
    const ipLists = [];
    for (let idx = 0; idx < 3; idx += 1) {
      const socket = noflo.internalSocket.createSocket();
      c.outPorts.out.attach(socket, idx);
      sockets.push(socket);
      ipLists.push(collect(socket));
    }
    return { c, inSocket, portSocket, sockets, ipLists };
  };

  it("sends to all attached connections by default", () => {
    const { c, inSocket, ipLists } = build();
    inSocket.post(new noflo.IP("data", "a"));
    assert.deepEqual(
      ipLists.map((ips) =>
        ips.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ),
      [["a"], ["a"], ["a"]],
    );
    c.tearDown?.(() => {});
  });

  it("sends only to the configured port indexes", () => {
    const { c, inSocket, portSocket, ipLists } = build();
    portSocket.post(new noflo.IP("data", 2));
    inSocket.post(new noflo.IP("data", "a"));
    assert.deepEqual(
      ipLists.map((ips) =>
        ips.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ),
      [[], [], ["a"]],
    );
    c.tearDown?.(() => {});
  });
});

describe("Reorder component", () => {
  it("sends streams to out indexes in reverse order", async () => {
    const c = getReorder();
    const inA = noflo.internalSocket.createSocket();
    const inB = noflo.internalSocket.createSocket();
    const outA = noflo.internalSocket.createSocket();
    const outB = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inA, 0);
    c.inPorts.in.attach(inB, 1);
    c.outPorts.out.attach(outA, 0);
    c.outPorts.out.attach(outB, 1);
    const outAIps = collect(outA);
    const outBIps = collect(outB);
    inA.post(new noflo.IP("data", "a"));
    inB.post(new noflo.IP("data", "b"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    // First input stream goes to the last output index
    assert.deepEqual(
      outAIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["b"],
    );
    assert.deepEqual(
      outBIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["a"],
    );
    c.tearDown?.(() => {});
  });
});

describe("ReverseSplit component", () => {
  it("sends each packet to all attached connections, last first", () => {
    const c = getReverseSplit();
    const inSocket = noflo.internalSocket.createSocket();
    const out0 = noflo.internalSocket.createSocket();
    const out1 = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.outPorts.out.attach(out0, 0);
    c.outPorts.out.attach(out1, 1);
    const ips0 = collect(out0);
    const ips1 = collect(out1);
    inSocket.post(new noflo.IP("data", "a"));
    assert.deepEqual(
      ips0.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["a"],
    );
    assert.deepEqual(
      ips1.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["a"],
    );
    c.tearDown?.(() => {});
  });
});

describe("Throttle component", () => {
  it("forwards a packet when the load is below the max", async () => {
    const c = getThrottle();
    const inSocket = noflo.internalSocket.createSocket();
    const loadSocket = noflo.internalSocket.createSocket();
    const maxSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.load.attach(loadSocket);
    c.inPorts.max.attach(maxSocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    loadSocket.post(new noflo.IP("data", 1));
    maxSocket.post(new noflo.IP("data", 2));
    inSocket.post(new noflo.IP("data", "a"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["a"],
    );
    c.tearDown?.(() => {});
  });

  it("holds packets while the load is at or above the max", async () => {
    const c = getThrottle();
    const inSocket = noflo.internalSocket.createSocket();
    const loadSocket = noflo.internalSocket.createSocket();
    const maxSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.load.attach(loadSocket);
    c.inPorts.max.attach(maxSocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    loadSocket.post(new noflo.IP("data", 2));
    maxSocket.post(new noflo.IP("data", 2));
    inSocket.post(new noflo.IP("data", "a"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data"),
      [],
    );
    c.tearDown?.(() => {});
  });
});
