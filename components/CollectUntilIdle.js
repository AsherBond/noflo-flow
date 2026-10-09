import { Component } from "@noflo/noflo";

/**
 * Collects packets and sends them when input stops for a given timeout.
 * The activation is deactivated while waiting so the network can idle.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "Collect packets and send them when input stops after a given timeout",
    inPorts: {
      in: {
        datatype: "all",
        description: "IPs to collect until a timeout",
        required: true,
      },
      timeout: {
        datatype: "number",
        description: "Amount of time to hold IPs for in milliseconds",
        default: 300,
        control: true,
      },
    },
    outPorts: {
      out: {
        datatype: "all",
        description: "IPs collected until the timeout",
      },
    },
  });

  /**
   * @typedef {Object} PendingTimeout
   * @property {{ deactivate(): void }} ctx
   * @property {NodeJS.Timeout} timeout
   */

  /** @type {PendingTimeout|null} */
  let pending = null;
  const clear = () => {
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    pending.ctx.deactivate();
    pending = null;
  };
  c.tearDown = async () => {
    clear();
  };

  c.process((input, output, context) => {
    let timeout = 300;
    if (!input.hasData("in")) {
      return;
    }
    if (input.attached("timeout").length && !input.hasData("timeout")) {
      return;
    }
    if (input.hasData("timeout")) {
      timeout = Number.parseInt(input.getData("timeout"), 10);
    }

    clear();

    pending = {
      ctx: context,
      timeout: setTimeout(() => {
        pending = null;
        while (input.hasData("in")) {
          const packet = input.getData("in");
          output.send({ out: packet });
        }
        output.done();
      }, timeout),
    };
  });

  return c;
}
