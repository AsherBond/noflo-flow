import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as noflo from "@noflo/noflo";

import { getComponent as getAll } from "../components/All.js";
import { getComponent as getCollectUntilIdle } from "../components/CollectUntilIdle.js";
import { getComponent as getCountDown } from "../components/CountDown.js";
import { getComponent as getCountedMerge } from "../components/CountedMerge.js";
import { getComponent as getRace } from "../components/Race.js";
import { getComponent as getStop } from "../components/Stop.js";
import { collect, render, waitStream } from "./helpers.js";

describe("All component", () => {
  /** @returns {{ c: import("@noflo/noflo").Component, outIps: import("@noflo/noflo").IP[], errorIps: import("@noflo/noflo").IP[], attach(idx: number): import("@noflo/noflo").internalSocket.InternalSocket }} */
  const build = () => {
    const c = getAll();
    /** @type {import("@noflo/noflo").internalSocket.InternalSocket[]} */
    const sockets = [];
    const outSocket = noflo.internalSocket.createSocket();
    const errorSocket = noflo.internalSocket.createSocket();
    c.outPorts.out.attach(outSocket);
    c.outPorts.error.attach(errorSocket);
    return {
      c,
      outIps: collect(outSocket),
      errorIps: collect(errorSocket),
      attach(idx) {
        const socket = noflo.internalSocket.createSocket();
        c.inPorts.in.attach(socket, idx);
        sockets.push(socket);
        return socket;
      },
    };
  };

  it("waits for all connected connections and sends results in order", async () => {
    const { c, outIps, attach } = build();
    const s0 = attach(0);
    attach(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    s0.post(new noflo.IP("openBracket", "conn"));
    s0.post(new noflo.IP("data", "a"));
    s0.post(new noflo.IP("closeBracket", "conn"));
    await new Promise((resolve) => setTimeout(resolve, 10));
    // Second connection still missing, nothing sent yet
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data"),
      [],
    );
    const s1 = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(s1, 1);
    s1.post(new noflo.IP("data", "b"));
    await waitStream(outIps, (ips) => ips.some((ip) => ip.type === "data"));
    const data = /** @type {import("@noflo/noflo").IP} */ (
      outIps.find((ip) => ip.type === "data")
    ).data;
    assert.deepEqual(data, [["a"], ["b"]]);
    c.tearDown?.(() => {});
  });

  it("rejects the scope when an error arrives", async () => {
    const { c, errorIps, outIps, attach } = build();
    const errorSocket = noflo.internalSocket.createSocket();
    c.inPorts.error.attach(errorSocket);
    const s0 = attach(0);
    errorSocket.post(new noflo.IP("data", new Error("boom")));
    s0.post(new noflo.IP("data", "a"));
    await waitStream(errorIps, (ips) => ips.length > 0);
    assert.equal(/** @type {Error} */ (errorIps[0].data).message, "boom");
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data"),
      [],
    );
    c.tearDown?.(() => {});
  });
});

describe("Race component", () => {
  it("sends the first result stream and drops later ones", async () => {
    const c = getRace();
    const s0 = noflo.internalSocket.createSocket();
    const s1 = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(s0, 0);
    c.inPorts.in.attach(s1, 1);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    await new Promise((resolve) => setTimeout(resolve, 10));
    s0.post(new noflo.IP("data", "first"));
    await waitStream(outIps, (ips) => ips.length > 0);
    const data = /** @type {import("@noflo/noflo").IP} */ (
      outIps.find((ip) => ip.type === "data")
    ).data;
    assert.deepEqual(data, ["first"]);
    // A later stream on the other connection is dropped
    s1.post(new noflo.IP("data", "second"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(outIps.filter((ip) => ip.type === "data").length, 1);
    c.tearDown?.(() => {});
  });
});

describe("CollectUntilIdle component", () => {
  it("collects packets and releases them once input stops", async () => {
    const c = getCollectUntilIdle();
    const inSocket = noflo.internalSocket.createSocket();
    const timeoutSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.timeout.attach(timeoutSocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    timeoutSocket.post(new noflo.IP("data", 50));
    inSocket.post(new noflo.IP("data", "a"));
    inSocket.post(new noflo.IP("data", "b"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    inSocket.post(new noflo.IP("data", "c"));
    await waitStream(
      outIps,
      (ips) => ips.filter((ip) => ip.type === "data").length === 3,
    );
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["a", "b", "c"],
    );
    c.tearDown?.(() => {});
  });

  it("resets the timer when new input arrives", async () => {
    const c = getCollectUntilIdle();
    const inSocket = noflo.internalSocket.createSocket();
    const timeoutSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.timeout.attach(timeoutSocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    timeoutSocket.post(new noflo.IP("data", 60));
    inSocket.post(new noflo.IP("data", "a"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    // Nothing sent yet — the timer was reset by the re-arming
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data"),
      [],
    );
    inSocket.post(new noflo.IP("data", "b"));
    await waitStream(
      outIps,
      (ips) => ips.filter((ip) => ip.type === "data").length === 2,
    );
    c.tearDown?.(() => {});
  });
});

describe("CountedMerge component", () => {
  /** @returns {{ c: import("@noflo/noflo").Component, inSocket: import("@noflo/noflo").internalSocket.InternalSocket, thresholdSocket: import("@noflo/noflo").internalSocket.InternalSocket | null, outIps: import("@noflo/noflo").IP[] }} */
  const build = (attachThreshold = false) => {
    const c = getCountedMerge();
    const inSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    /** @type {import("@noflo/noflo").internalSocket.InternalSocket|null} */
    let thresholdSocket = null;
    c.inPorts.in.attach(inSocket);
    if (attachThreshold) {
      thresholdSocket = noflo.internalSocket.createSocket();
      c.inPorts.threshold.attach(thresholdSocket);
    }
    c.outPorts.out.attach(outSocket);
    return { c, inSocket, thresholdSocket, outIps: collect(outSocket) };
  };

  it("forwards the first stream and drops streams past the threshold", () => {
    const { c, inSocket, outIps } = build();
    inSocket.post(new noflo.IP("data", "a"));
    inSocket.post(new noflo.IP("data", "b"));
    // Default threshold 1: first stream forwarded, second dropped
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["a"],
    );
    c.tearDown?.(() => {});
  });

  it("merges up to the configured threshold", () => {
    const { c, inSocket, thresholdSocket, outIps } = build(true);
    thresholdSocket?.post(new noflo.IP("data", 2));
    inSocket.post(new noflo.IP("data", "a"));
    inSocket.post(new noflo.IP("data", "b"));
    inSocket.post(new noflo.IP("data", "c"));
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      ["a", "b"],
    );
    c.tearDown?.(() => {});
  });
});

describe("CountDown component", () => {
  /**
   * @param {boolean} [attachCount]
   * @param {boolean} [attachRepeat]
   * @returns {{ c: import("@noflo/noflo").Component, inSocket: import("@noflo/noflo").internalSocket.InternalSocket, countSocket: import("@noflo/noflo").internalSocket.InternalSocket, repeatSocket: import("@noflo/noflo").internalSocket.InternalSocket, outIps: import("@noflo/noflo").IP[], countIps: import("@noflo/noflo").IP[] }}
   */
  const build = (attachCount = false, attachRepeat = false) => {
    const c = getCountDown();
    const inSocket = noflo.internalSocket.createSocket();
    const countSocket = noflo.internalSocket.createSocket();
    const repeatSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    const countOutSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    if (attachCount) {
      c.inPorts.count.attach(countSocket);
    }
    if (attachRepeat) {
      c.inPorts.repeat.attach(repeatSocket);
    }
    c.outPorts.out.attach(outSocket);
    c.outPorts.count.attach(countOutSocket);
    return {
      c,
      inSocket,
      countSocket,
      repeatSocket,
      outIps: collect(outSocket),
      countIps: collect(countOutSocket),
    };
  };

  it("emits on the first bang with the default count", () => {
    const { c, inSocket, outIps, countIps } = build();
    inSocket.post(new noflo.IP("data", null));
    assert.deepEqual(
      countIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      [1],
    );
    assert.equal(outIps.filter((ip) => ip.type === "data").length, 1);
    assert.equal(
      /** @type {import("@noflo/noflo").IP} */ (
        outIps.find((ip) => ip.type === "data")
      ).data,
      null,
    );
    c.tearDown?.(() => {});
  });

  it("counts down from a configured number", () => {
    const { c, inSocket, countSocket, outIps, countIps } = build(true);
    countSocket.post(new noflo.IP("data", 3));
    inSocket.post(new noflo.IP("data", null));
    inSocket.post(new noflo.IP("data", null));
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data"),
      [],
    );
    inSocket.post(new noflo.IP("data", null));
    assert.deepEqual(
      countIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      [1, 2, 3],
    );
    assert.equal(outIps.filter((ip) => ip.type === "data").length, 1);
    c.tearDown?.(() => {});
  });

  it("repeats the countdown by default", () => {
    const { c, inSocket, repeatSocket, outIps, countIps } = build(false, true);
    repeatSocket.post(new noflo.IP("data", true));
    inSocket.post(new noflo.IP("data", null));
    inSocket.post(new noflo.IP("data", null));
    assert.deepEqual(
      countIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      [1, 1],
    );
    assert.equal(outIps.filter((ip) => ip.type === "data").length, 2);
    c.tearDown?.(() => {});
  });

  it("stops repeating when repeat is false", () => {
    const { c, inSocket, repeatSocket, outIps, countIps } = build(false, true);
    repeatSocket.post(new noflo.IP("data", false));
    inSocket.post(new noflo.IP("data", null));
    inSocket.post(new noflo.IP("data", null));
    assert.deepEqual(
      countIps.filter((ip) => ip.type === "data").map((ip) => ip.data),
      [1, 2],
    );
    assert.equal(outIps.filter((ip) => ip.type === "data").length, 1);
    c.tearDown?.(() => {});
  });
});

describe("Stop component", () => {
  it("buffers packets until ready, then releases them all", () => {
    const c = getStop();
    const inSocket = noflo.internalSocket.createSocket();
    const readySocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.ready.attach(readySocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    inSocket.post(new noflo.IP("data", 1));
    inSocket.post(new noflo.IP("data", 2));
    inSocket.post(new noflo.IP("data", 3));
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data"),
      [],
    );
    readySocket.post(new noflo.IP("data", null));
    assert.deepEqual(render(outIps), ["DATA 1", "DATA 2", "DATA 3"]);
    c.tearDown?.(() => {});
  });
});

describe("Watchdog component", () => {
  it("emits a bang when the window closes without activity", async () => {
    const { getComponent: getWatchdog } = await import(
      "../components/Watchdog.js"
    );
    const c = getWatchdog();
    const intervalSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.interval.attach(intervalSocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    intervalSocket.post(new noflo.IP("data", 50));
    await waitStream(outIps, (ips) => ips.length > 0);
    assert.equal(outIps[0].type, "data");
    assert.equal(outIps[0].data, null);
    c.tearDown?.(() => {});
  });

  it("resets the window on activity", async () => {
    const { getComponent: getWatchdog } = await import(
      "../components/Watchdog.js"
    );
    const c = getWatchdog();
    const inSocket = noflo.internalSocket.createSocket();
    const intervalSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.interval.attach(intervalSocket);
    c.outPorts.out.attach(outSocket);
    const outIps = collect(outSocket);
    intervalSocket.post(new noflo.IP("data", 60));
    // Activity at 30ms keeps the watchdog quiet past the first window
    await new Promise((resolve) => setTimeout(resolve, 30));
    inSocket.post(new noflo.IP("data", "activity"));
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepEqual(
      outIps.filter((ip) => ip.type === "data"),
      [],
    );
    c.tearDown?.(() => {});
  });
});
