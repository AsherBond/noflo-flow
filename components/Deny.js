import { Component } from "@noflo/noflo";

/**
 * Forwards incoming data IPs unless their value was previously named on
 * the `deny` port. Data arriving before any deny is forwarded.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description: "deny certain incoming packets",
    inPorts: {
      in: {
        datatype: "all",
        description: "An IP to be forwarded if accepted",
        required: true,
      },
      deny: {
        datatype: "all",
        description: "IP to be denied",
      },
      reset: {
        datatype: "bang",
        description: "Reset the list denied IPs",
      },
    },
    outPorts: {
      out: { datatype: "all" },
    },
  });

  /** @type {Map<string, unknown[]>} */
  const denied = new Map();
  c.tearDown = async () => {
    denied.clear();
  };

  c.process((input, output) => {
    if (input.hasData("deny")) {
      const deny = input.getData("deny");
      const key = input.scope ?? "null";
      let list = denied.get(key);
      if (!list) {
        list = [];
        denied.set(key, list);
      }
      list.push(deny);
      output.done();
      return;
    }
    if (input.hasData("reset")) {
      input.getData("reset");
      denied.clear();
      output.done();
      return;
    }
    if (!input.hasData("in")) {
      return;
    }
    const data = input.getData("in");
    const list = denied.get(input.scope ?? "null");
    // 1.x crashed when data arrived before any deny; treat a missing
    // list as denying nothing
    if (list?.includes(data)) {
      output.done();
      return;
    }
    output.sendDone({ out: data });
  });

  return c;
}
