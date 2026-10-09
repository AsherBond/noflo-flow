import { Component } from "@noflo/noflo";

/**
 * Routes each complete stream to `yes` if its top-level group matches
 * one of the configured groups or regexps, otherwise to `no`.
 * @returns {import("@noflo/noflo").Component} The configured component
 */
export function getComponent() {
  const c = new Component({
    description:
      "send connection to 'yes' if its top-level group is one of the provided groups, otherwise 'no'",
    forwardBrackets: {},
    inPorts: {
      in: {
        datatype: "all",
        description: "IPs to route use their groups",
        required: true,
      },
      regexp: {
        datatype: "string",
        description: "Regexps to match groups",
      },
      group: {
        datatype: "string",
        description: "List of groups (one group per IP)",
      },
      reset: {
        datatype: "bang",
        description: "Reset the list of groups and regexps",
      },
    },
    outPorts: {
      yes: {
        datatype: "all",
        description: "IPs with group that match the groups or regexps provided",
      },
      no: {
        datatype: "all",
        description:
          "IPs with group that don't match the groups or regexps provided",
      },
    },
  });

  /** @type {string[]} */
  let matchGroups = [];
  /** @type {RegExp[]} */
  let regexps = [];
  const reset = () => {
    matchGroups = [];
    regexps = [];
  };
  c.tearDown = async () => {
    reset();
  };

  c.process((input, output) => {
    if (input.hasData("group")) {
      matchGroups.push(input.getData("group"));
      output.done();
      return;
    }
    if (input.hasData("regexp")) {
      regexps.push(new RegExp(input.getData("regexp")));
      output.done();
      return;
    }
    if (input.hasData("reset")) {
      input.getData("reset");
      reset();
      output.done();
      return;
    }
    if (!input.hasStream("in")) {
      return;
    }
    const packets = /** @type {import("@noflo/noflo").IP[]} */ (
      input.getStream("in")
    );
    if (packets[0].type !== "openBracket") {
      // Stream doesn't start with a group, send to NO
      for (const packet of packets) {
        output.send({ no: packet });
      }
      output.done();
      return;
    }
    let matched = false;
    const group = packets[0].data;
    for (const matchGroup of matchGroups) {
      if (group !== matchGroup) {
        continue;
      }
      matched = true;
    }
    for (const regexp of regexps) {
      if (typeof group !== "string" || group.match(regexp) == null) {
        continue;
      }
      matched = true;
    }
    if (!matched) {
      for (const packet of packets) {
        output.send({ no: packet });
      }
      output.done();
      return;
    }
    for (const packet of packets) {
      output.send({ yes: packet });
    }
    output.done();
  });

  return c;
}
