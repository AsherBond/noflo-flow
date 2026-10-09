import { Component } from "@noflo/noflo";

/**
 * Forwards packets only while the gate is open. `open`/`close` bangs
 * toggle it; packets arriving while closed are dropped.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description: "Forward packets only when the gate is open",
    icon: "pause",
    forwardBrackets: {},
    inPorts: {
      in: { datatype: "all", required: true },
      open: {
        datatype: "bang",
        description: "Send one IP to open the gate",
      },
      close: {
        datatype: "bang",
        description: "Send one IP to close the gate",
      },
    },
    outPorts: {
      out: { datatype: "all" },
    },
  });

  let isOpen = false;
  c.tearDown = async () => {
    isOpen = false;
    c.setIcon("pause");
  };

  c.process((input, output) => {
    if (input.hasData("open")) {
      input.getData("open");
      isOpen = true;
      c.setIcon("play");
      output.done();
      return;
    }
    if (input.hasData("close")) {
      input.getData("close");
      isOpen = false;
      c.setIcon("pause");
      output.done();
      return;
    }
    if (!input.has("in")) {
      return;
    }
    const packet = /** @type {import("@noflo/noflo").IP} */ (input.get("in"));
    if (!isOpen) {
      packet.drop();
      output.done();
      return;
    }
    output.sendDone({ out: packet });
  });

  return c;
}
