import { describe, expect, it } from "vitest";
import {
  feedsTrackToSpeech,
  micErrorCode,
  parseMicChoice,
  realMicrophones,
  resolveChoice,
  systemDefaultLabel,
} from "./microphone";

const chromium = (version: string, platform = "macOS", mobile = false) => ({
  brands: [
    { brand: "Not-A.Brand", version: "99" },
    { brand: "Google Chrome", version },
    { brand: "Chromium", version },
  ],
  mobile,
  platform,
});

function input(deviceId: string, label: string, groupId = deviceId) {
  return { kind: "audioinput" as const, deviceId, label, groupId };
}

const builtIn = "MacBook Pro Microphone (Built-in)";
const scarlett = "Scarlett 2i2 USB (1235:8210)";

describe("feedsTrackToSpeech", () => {
  it("is true on desktop Chromium 135 and later (Chrome, Comet, Edge)", () => {
    expect(feedsTrackToSpeech(chromium("157"))).toBe(true);
    expect(feedsTrackToSpeech(chromium("156"))).toBe(true);
    expect(feedsTrackToSpeech(chromium("135", "Windows"))).toBe(true);
    expect(feedsTrackToSpeech(chromium("140", "Linux"))).toBe(true);
  });

  it("is false before Chromium 135, on phones and outside Chromium", () => {
    expect(feedsTrackToSpeech(chromium("134"))).toBe(false);
    expect(feedsTrackToSpeech(chromium("157", "Android", true))).toBe(false);
    expect(feedsTrackToSpeech(chromium("157", "Chrome OS"))).toBe(false);
    expect(
      feedsTrackToSpeech({ brands: [{ brand: "Brand", version: "200" }], platform: "macOS" }),
    ).toBe(false);
    expect(feedsTrackToSpeech(null)).toBe(false);
    expect(feedsTrackToSpeech(undefined)).toBe(false);
  });
});

describe("realMicrophones", () => {
  it("drops Chromium's aliases, outputs, and devices hidden before permission", () => {
    const devices = [
      input("default", `Default - ${builtIn}`, "g1"),
      input("communications", `Communications - ${builtIn}`, "g1"),
      input("m1", builtIn, "g1"),
      input("m2", scarlett, "g2"),
      input("", ""),
      { kind: "audiooutput" as const, deviceId: "o1", label: "Speakers", groupId: "g1" },
    ];
    expect(realMicrophones(devices)).toEqual([
      { id: "m1", label: builtIn },
      { id: "m2", label: scarlett },
    ]);
  });
});

describe("systemDefaultLabel", () => {
  it("names the device behind Chromium's default alias, in any language", () => {
    const devices = [input("m1", builtIn, "g1"), input("m2", scarlett, "g2")];
    expect(systemDefaultLabel([input("default", `Default - ${scarlett}`, "gx"), ...devices])).toBe(
      scarlett,
    );
    expect(
      systemDefaultLabel([input("default", `Predeterminado - ${builtIn}`, "gx"), ...devices]),
    ).toBe(builtIn);
  });

  it("falls back to the alias's device group", () => {
    const devices = [
      input("default", "Default", "g2"),
      input("m1", builtIn, "g1"),
      input("m2", scarlett, "g2"),
    ];
    expect(systemDefaultLabel(devices)).toBe(scarlett);
  });

  it("is null when the browser has no alias or hides names", () => {
    expect(systemDefaultLabel([input("m1", builtIn)])).toBeNull();
    expect(systemDefaultLabel([input("default", ""), input("", "")])).toBeNull();
  });
});

describe("resolveChoice", () => {
  const mics = [
    { id: "m1", label: builtIn },
    { id: "m2", label: scarlett },
  ];

  it("finds the chosen microphone by id, then by name", () => {
    expect(resolveChoice({ id: "m2", label: scarlett }, mics)).toEqual(mics[1]);
    expect(resolveChoice({ id: "old-id", label: scarlett }, mics)).toEqual(mics[1]);
  });

  it("is null when the microphone is not connected", () => {
    expect(resolveChoice({ id: "gone", label: "Yeti" }, mics)).toBeNull();
    expect(resolveChoice({ id: "gone", label: "" }, [{ id: "m3", label: "" }])).toBeNull();
  });
});

describe("parseMicChoice", () => {
  it("reads a saved choice and ignores anything else", () => {
    expect(parseMicChoice('{"id":"m2","label":"Scarlett"}')).toEqual({
      id: "m2",
      label: "Scarlett",
    });
    expect(parseMicChoice('{"id":"m2"}')).toEqual({ id: "m2", label: "" });
    expect(parseMicChoice('{"id":""}')).toBeNull();
    expect(parseMicChoice('{"label":"x"}')).toBeNull();
    expect(parseMicChoice("not json")).toBeNull();
    expect(parseMicChoice(null)).toBeNull();
  });
});

describe("micErrorCode", () => {
  it("maps getUserMedia errors to what the user can do about them", () => {
    const error = (name: string) => new DOMException("x", name);
    expect(micErrorCode(error("NotAllowedError"))).toBe("not-allowed");
    expect(micErrorCode(error("SecurityError"))).toBe("not-allowed");
    expect(micErrorCode(error("NotFoundError"))).toBe("no-microphone");
    expect(micErrorCode(error("OverconstrainedError"))).toBe("no-microphone");
    expect(micErrorCode(error("NotReadableError"))).toBe("busy");
    expect(micErrorCode(new TypeError("x"))).toBe("other");
    expect(micErrorCode(undefined)).toBe("other");
  });
});
