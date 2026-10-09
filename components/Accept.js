import { Component } from "@noflo/noflo";

/**
 * Forwards only the incoming data IPs whose value was previously named on
 * the `accept` port. Data arriving before any accept is forwarded never.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description: "accept and forward certain incoming packets",
    inPorts: {
      in: {
        datatype: "all",
        description: "An IP to be forwarded if accepted",
        required: true,
      },
      accept: {
        datatype: "all",
        description: "IP to be accepted",
      },
      reset: {
        datatype: "bang",
        description: "Reset the list accepted IPs",
      },
    },
    outPorts: {
      out: { datatype: "all" },
    },
  });

  /** @type {Map<string, unknown[]>} */
  const accepts = new Map();
  c.tearDown = async () => {
    accepts.clear();
  };

  c.process((input, output) => {
    if (input.hasData("accept")) {
      const accept = input.getData("accept");
      const key = input.scope ?? "null";
      let list = accepts.get(key);
      if (!list) {
        list = [];
        accepts.set(key, list);
      }
      list.push(accept);
      output.done();
      return;
    }
    if (input.hasData("reset")) {
      input.getData("reset");
      accepts.clear();
      output.done();
      return;
    }
    if (!input.hasData("in")) {
      return;
    }
    const data = input.getData("in");
    const list = accepts.get(input.scope ?? "null");
    // 1.x crashed when data arrived before any accept; treat a missing
    // list as accepting nothing
    if (!list?.includes(data)) {
      output.done();
      return;
    }
    output.sendDone({ out: data });
  });

  return c;
}
