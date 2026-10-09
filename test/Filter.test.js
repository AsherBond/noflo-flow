import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as noflo from "@noflo/noflo";

import { getComponent as getAccept } from "../components/Accept.js";
import { getComponent as getDeny } from "../components/Deny.js";
import { getComponent as getGate } from "../components/Gate.js";
import { getComponent as getHasGroup } from "../components/HasGroup.js";
import { collect, render } from "./helpers.js";

describe("Accept component", () => {
  /** @returns {{ c: import("@noflo/noflo").Component, inSocket: import("@noflo/noflo").internalSocket.InternalSocket, acceptSocket: import("@noflo/noflo").internalSocket.InternalSocket, resetSocket: import("@noflo/noflo").internalSocket.InternalSocket, outIps: import("@noflo/noflo").IP[] }} */
  const build = () => {
    const c = getAccept();
    const inSocket = noflo.internalSocket.createSocket();
    const acceptSocket = noflo.internalSocket.createSocket();
    const resetSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.accept.attach(acceptSocket);
    c.inPorts.reset.attach(resetSocket);
    c.outPorts.out.attach(outSocket);
    return {
      c,
      inSocket,
      acceptSocket,
      resetSocket,
      outIps: collect(outSocket),
    };
  };

  it("forwards accepted packets and drops the rest", () => {
    const { c, inSocket, acceptSocket, outIps } = build();
    acceptSocket.post(new noflo.IP("data", "yes"));
    inSocket.post(new noflo.IP("data", "yes"));
    inSocket.post(new noflo.IP("data", "no"));
    assert.deepEqual(render(outIps), ['DATA "yes"']);
    c.tearDown?.();
  });

  it("forwards nothing before any accept is registered", () => {
    const { c, inSocket, outIps } = build();
    // 1.x crashed here; 2.x drops instead
    inSocket.post(new noflo.IP("data", "anything"));
    assert.deepEqual(render(outIps), []);
    c.tearDown?.();
  });

  it("reset clears the accept list", () => {
    const { c, inSocket, acceptSocket, resetSocket, outIps } = build();
    acceptSocket.post(new noflo.IP("data", "yes"));
    resetSocket.post(new noflo.IP("data", null));
    inSocket.post(new noflo.IP("data", "yes"));
    assert.deepEqual(render(outIps), []);
    c.tearDown?.();
  });
});

describe("Deny component", () => {
  /** @returns {{ c: import("@noflo/noflo").Component, inSocket: import("@noflo/noflo").internalSocket.InternalSocket, denySocket: import("@noflo/noflo").internalSocket.InternalSocket, resetSocket: import("@noflo/noflo").internalSocket.InternalSocket, outIps: import("@noflo/noflo").IP[] }} */
  const build = () => {
    const c = getDeny();
    const inSocket = noflo.internalSocket.createSocket();
    const denySocket = noflo.internalSocket.createSocket();
    const resetSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.deny.attach(denySocket);
    c.inPorts.reset.attach(resetSocket);
    c.outPorts.out.attach(outSocket);
    return {
      c,
      inSocket,
      denySocket,
      resetSocket,
      outIps: collect(outSocket),
    };
  };

  it("drops denied packets and forwards the rest", () => {
    const { c, inSocket, denySocket, outIps } = build();
    denySocket.post(new noflo.IP("data", "no"));
    inSocket.post(new noflo.IP("data", "yes"));
    inSocket.post(new noflo.IP("data", "no"));
    assert.deepEqual(render(outIps), ['DATA "yes"']);
    c.tearDown?.();
  });

  it("forwards everything before any deny is registered", () => {
    const { c, inSocket, outIps } = build();
    inSocket.post(new noflo.IP("data", "anything"));
    assert.deepEqual(render(outIps), ['DATA "anything"']);
    c.tearDown?.();
  });

  it("reset clears the deny list", () => {
    const { c, inSocket, denySocket, resetSocket, outIps } = build();
    denySocket.post(new noflo.IP("data", "no"));
    resetSocket.post(new noflo.IP("data", null));
    inSocket.post(new noflo.IP("data", "no"));
    assert.deepEqual(render(outIps), ['DATA "no"']);
    c.tearDown?.();
  });
});

describe("Gate component", () => {
  /** @returns {{ c: import("@noflo/noflo").Component, inSocket: import("@noflo/noflo").internalSocket.InternalSocket, openSocket: import("@noflo/noflo").internalSocket.InternalSocket, closeSocket: import("@noflo/noflo").internalSocket.InternalSocket, outIps: import("@noflo/noflo").IP[] }} */
  const build = () => {
    const c = getGate();
    const inSocket = noflo.internalSocket.createSocket();
    const openSocket = noflo.internalSocket.createSocket();
    const closeSocket = noflo.internalSocket.createSocket();
    const outSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.open.attach(openSocket);
    c.inPorts.close.attach(closeSocket);
    c.outPorts.out.attach(outSocket);
    return {
      c,
      inSocket,
      openSocket,
      closeSocket,
      outIps: collect(outSocket),
    };
  };

  it("drops packets while the gate is closed by default", () => {
    const { c, inSocket, outIps } = build();
    inSocket.post(new noflo.IP("data", 1));
    assert.deepEqual(render(outIps), []);
    c.tearDown?.();
  });

  it("forwards only packets sent while the gate is open", () => {
    const { c, inSocket, openSocket, closeSocket, outIps } = build();
    // Mirrors the 1.x spec: foo group opens before data 1 arrives, so
    // the group and data 1 are dropped; data 2 and the bar group pass;
    // after close, data 4 and the foo close are dropped
    inSocket.post(new noflo.IP("openBracket", "foo"));
    inSocket.post(new noflo.IP("data", 1));
    openSocket.post(new noflo.IP("data", true));
    inSocket.post(new noflo.IP("data", 2));
    inSocket.post(new noflo.IP("openBracket", "bar"));
    inSocket.post(new noflo.IP("data", 3));
    inSocket.post(new noflo.IP("closeBracket", "bar"));
    closeSocket.post(new noflo.IP("data", true));
    inSocket.post(new noflo.IP("data", 4));
    inSocket.post(new noflo.IP("closeBracket", "foo"));
    assert.deepEqual(render(outIps), ["DATA 2", "< bar", "DATA 3", ">"]);
    c.tearDown?.();
  });
});

describe("HasGroup component", () => {
  /** @returns {{ c: import("@noflo/noflo").Component, inSocket: import("@noflo/noflo").internalSocket.InternalSocket, groupSocket: import("@noflo/noflo").internalSocket.InternalSocket, regexpSocket: import("@noflo/noflo").internalSocket.InternalSocket, yesIps: import("@noflo/noflo").IP[], noIps: import("@noflo/noflo").IP[] }} */
  const build = () => {
    const c = getHasGroup();
    const inSocket = noflo.internalSocket.createSocket();
    const groupSocket = noflo.internalSocket.createSocket();
    const regexpSocket = noflo.internalSocket.createSocket();
    const yesSocket = noflo.internalSocket.createSocket();
    const noSocket = noflo.internalSocket.createSocket();
    c.inPorts.in.attach(inSocket);
    c.inPorts.group.attach(groupSocket);
    c.inPorts.regexp.attach(regexpSocket);
    c.outPorts.yes.attach(yesSocket);
    c.outPorts.no.attach(noSocket);
    return {
      c,
      inSocket,
      groupSocket,
      regexpSocket,
      yesIps: collect(yesSocket),
      noIps: collect(noSocket),
    };
  };

  it("routes streams with a matching top-level group to yes", () => {
    const { c, inSocket, groupSocket, yesIps, noIps } = build();
    groupSocket.post(new noflo.IP("data", "foo"));
    inSocket.post(new noflo.IP("openBracket", "foo"));
    inSocket.post(new noflo.IP("data", "a"));
    inSocket.post(new noflo.IP("closeBracket", "foo"));
    assert.deepEqual(render(yesIps), ["< foo", 'DATA "a"', ">"]);
    assert.deepEqual(noIps, []);
    c.tearDown?.();
  });

  it("routes non-matching groups to no", () => {
    const { c, inSocket, groupSocket, yesIps, noIps } = build();
    groupSocket.post(new noflo.IP("data", "foo"));
    inSocket.post(new noflo.IP("openBracket", "bar"));
    inSocket.post(new noflo.IP("data", "a"));
    inSocket.post(new noflo.IP("closeBracket", "bar"));
    assert.deepEqual(yesIps, []);
    assert.deepEqual(render(noIps), ["< bar", 'DATA "a"', ">"]);
    c.tearDown?.();
  });

  it("matches groups by regexp", () => {
    const { c, inSocket, regexpSocket, yesIps, noIps } = build();
    regexpSocket.post(new noflo.IP("data", "^ba"));
    inSocket.post(new noflo.IP("openBracket", "bar"));
    inSocket.post(new noflo.IP("data", "a"));
    inSocket.post(new noflo.IP("closeBracket", "bar"));
    assert.deepEqual(render(yesIps), ["< bar", 'DATA "a"', ">"]);
    assert.deepEqual(noIps, []);
    c.tearDown?.();
  });

  it("routes ungrouped streams to no", () => {
    const { c, inSocket, yesIps, noIps } = build();
    inSocket.post(new noflo.IP("data", "a"));
    assert.deepEqual(render(noIps), ['DATA "a"']);
    assert.deepEqual(yesIps, []);
    c.tearDown?.();
  });
});
